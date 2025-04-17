import { EventEmitter } from 'events';
import SerialPort from 'serialport';
import { WebUSB } from 'usb';
import { escpos } from 'escpos';
import { BehaviorSubject } from 'rxjs';

interface HardwareDevice {
  id: string;
  type: 'printer' | 'scanner' | 'cashDrawer' | 'customerDisplay' | 'scale' | 'cardReader' | 'labelPrinter';
  port: string;
  status: 'connected' | 'disconnected' | 'error';
  manufacturer?: string;
  model?: string;
  error?: string;
}

export class HardwareIntegrationService extends EventEmitter {
  private devices = new Map<string, HardwareDevice>();
  private ports = new Map<string, SerialPort>();
  private deviceStatus$ = new BehaviorSubject<Map<string, HardwareDevice>>(new Map());

  constructor() {
    super();
    this.initializeHardware();
  }

  private async initializeHardware() {
    try {
      // Scan for connected devices
      const ports = await SerialPort.list();
      
      for (const port of ports) {
        try {
          const device = await this.identifyDevice(port.path);
          if (device) {
            this.devices.set(device.id, device);
            await this.connectDevice(device);
          }
        } catch (error) {
          console.error(`Failed to initialize device on port ${port.path}:`, error);
        }
      }

      this.deviceStatus$.next(this.devices);
      
      // Watch for hardware changes
      this.watchHardwareChanges();
    } catch (error) {
      console.error('Failed to initialize hardware:', error);
    }
  }

  private async identifyDevice(port: string): Promise<HardwareDevice | null> {
    const serialPort = new SerialPort(port, { autoOpen: false });
    
    return new Promise((resolve, reject) => {
      serialPort.open(error => {
        if (error) {
          serialPort.close();
          resolve(null);
          return;
        }

        // Send identification command
        serialPort.write([0x1B, 0x76], async (writeError) => {
          if (writeError) {
            serialPort.close();
            resolve(null);
            return;
          }

          // Wait for response
          const response = await this.readPortResponse(serialPort);
          serialPort.close();

          if (response) {
            const device = this.parseDeviceIdentification(response, port);
            resolve(device);
          } else {
            resolve(null);
          }
        });
      });
    });
  }

  private async readPortResponse(port: SerialPort): Promise<Buffer | null> {
    return new Promise(resolve => {
      let response: Buffer | null = null;
      const timeout = setTimeout(() => {
        port.removeAllListeners('data');
        resolve(response);
      }, 1000);

      port.on('data', (data: Buffer) => {
        response = data;
        clearTimeout(timeout);
        port.removeAllListeners('data');
        resolve(response);
      });
    });
  }

  private parseDeviceIdentification(data: Buffer, port: string): HardwareDevice | null {
    // Implementation will vary based on device protocols
    // This is a simplified example
    const deviceTypes = new Map([
      [0x01, 'printer'],
      [0x02, 'scanner'],
      [0x03, 'cashDrawer'],
      [0x04, 'customerDisplay'],
      [0x05, 'scale'],
      [0x06, 'cardReader'],
      [0x07, 'labelPrinter']
    ]);

    const deviceType = deviceTypes.get(data[0]);
    if (!deviceType) return null;

    return {
      id: `${deviceType}-${port}`,
      type: deviceType as HardwareDevice['type'],
      port,
      status: 'disconnected',
      manufacturer: data.slice(1, 17).toString().trim(),
      model: data.slice(17, 33).toString().trim()
    };
  }

  private async connectDevice(device: HardwareDevice) {
    try {
      const port = new SerialPort(device.port, {
        baudRate: this.getBaudRate(device.type),
        autoOpen: false
      });

      return new Promise<void>((resolve, reject) => {
        port.open(error => {
          if (error) {
            this.updateDeviceStatus(device.id, 'error', error.message);
            reject(error);
            return;
          }

          this.ports.set(device.id, port);
          this.updateDeviceStatus(device.id, 'connected');
          this.setupDeviceListeners(device.id, port);
          resolve();
        });
      });
    } catch (error) {
      this.updateDeviceStatus(device.id, 'error', error.message);
      throw error;
    }
  }

  private getBaudRate(deviceType: HardwareDevice['type']): number {
    switch (deviceType) {
      case 'printer':
        return 9600;
      case 'scanner':
        return 115200;
      case 'customerDisplay':
        return 19200;
      case 'scale':
        return 4800;
      default:
        return 9600;
    }
  }

  private setupDeviceListeners(deviceId: string, port: SerialPort) {
    port.on('error', (error) => {
      this.updateDeviceStatus(deviceId, 'error', error.message);
      this.emit('device-error', { deviceId, error });
    });

    port.on('close', () => {
      this.updateDeviceStatus(deviceId, 'disconnected');
      this.emit('device-disconnected', deviceId);
    });

    // Device-specific data handlers
    port.on('data', (data: Buffer) => {
      const device = this.devices.get(deviceId);
      if (!device) return;

      switch (device.type) {
        case 'scanner':
          this.handleScannerData(deviceId, data);
          break;
        case 'scale':
          this.handleScaleData(deviceId, data);
          break;
        case 'cardReader':
          this.handleCardReaderData(deviceId, data);
          break;
      }
    });
  }

  private updateDeviceStatus(
    deviceId: string,
    status: HardwareDevice['status'],
    error?: string
  ) {
    const device = this.devices.get(deviceId);
    if (device) {
      device.status = status;
      device.error = error;
      this.devices.set(deviceId, device);
      this.deviceStatus$.next(this.devices);
    }
  }

  private watchHardwareChanges() {
    // Implementation depends on the operating system
    // This is a simplified example
    setInterval(async () => {
      const currentPorts = await SerialPort.list();
      const currentPaths = new Set(currentPorts.map(p => p.path));
      
      // Check for disconnected devices
      for (const [deviceId, device] of this.devices) {
        if (!currentPaths.has(device.port)) {
          this.updateDeviceStatus(deviceId, 'disconnected');
        }
      }

      // Check for new devices
      for (const port of currentPorts) {
        const existingDevice = Array.from(this.devices.values())
          .find(d => d.port === port.path);
        
        if (!existingDevice) {
          const device = await this.identifyDevice(port.path);
          if (device) {
            this.devices.set(device.id, device);
            await this.connectDevice(device);
          }
        }
      }
    }, 5000); // Check every 5 seconds
  }

  // Device-specific handlers
  private handleScannerData(deviceId: string, data: Buffer) {
    const scannedData = data.toString().trim();
    this.emit('barcode-scanned', { deviceId, barcode: scannedData });
  }

  private handleScaleData(deviceId: string, data: Buffer) {
    // Parse scale data format
    // This is a simplified example
    const weight = parseFloat(data.toString());
    this.emit('weight-measured', { deviceId, weight });
  }

  private handleCardReaderData(deviceId: string, data: Buffer) {
    // Parse card data
    // This is a simplified example
    const cardData = this.parseCardData(data);
    this.emit('card-read', { deviceId, ...cardData });
  }

  private parseCardData(data: Buffer) {
    // Implementation depends on card reader protocol
    return {
      cardNumber: '',
      expiryDate: '',
      cardholderName: ''
    };
  }

  // Public methods for device control
  async printReceipt(printerId: string, data: any) {
    const printer = this.ports.get(printerId);
    if (!printer) throw new Error('Printer not found');

    const device = this.devices.get(printerId);
    if (device?.status !== 'connected') {
      throw new Error('Printer not connected');
    }

    try {
      // Convert data to printer commands
      const commands = this.formatReceiptCommands(data);
      await this.sendCommand(printerId, commands);
    } catch (error) {
      throw new Error(`Failed to print: ${error.message}`);
    }
  }

  async openCashDrawer(drawerId: string) {
    const drawer = this.ports.get(drawerId);
    if (!drawer) throw new Error('Cash drawer not found');

    const device = this.devices.get(drawerId);
    if (device?.status !== 'connected') {
      throw new Error('Cash drawer not connected');
    }

    try {
      // Standard cash drawer command
      const command = Buffer.from([0x1B, 0x70, 0x00, 0x19, 0xFA]);
      await this.sendCommand(drawerId, command);
    } catch (error) {
      throw new Error(`Failed to open cash drawer: ${error.message}`);
    }
  }

  async displayCustomerInfo(displayId: string, data: {
    total: number;
    items?: number;
    message?: string;
  }) {
    const display = this.ports.get(displayId);
    if (!display) throw new Error('Customer display not found');

    const device = this.devices.get(displayId);
    if (device?.status !== 'connected') {
      throw new Error('Customer display not connected');
    }

    try {
      const commands = this.formatDisplayCommands(data);
      await this.sendCommand(displayId, commands);
    } catch (error) {
      throw new Error(`Failed to update display: ${error.message}`);
    }
  }

  async printLabel(printerId: string, data: {
    text: string;
    barcodeType?: string;
    barcodeData?: string;
    width?: number;
    height?: number;
  }) {
    const printer = this.ports.get(printerId);
    if (!printer) throw new Error('Label printer not found');

    const device = this.devices.get(printerId);
    if (device?.status !== 'connected') {
      throw new Error('Label printer not connected');
    }

    try {
      const commands = this.formatLabelCommands(data);
      await this.sendCommand(printerId, commands);
    } catch (error) {
      throw new Error(`Failed to print label: ${error.message}`);
    }
  }

  private async sendCommand(deviceId: string, command: Buffer): Promise<void> {
    const port = this.ports.get(deviceId);
    if (!port) throw new Error('Device not found');

    return new Promise((resolve, reject) => {
      port.write(command, error => {
        if (error) {
          reject(error);
          return;
        }
        port.drain(() => resolve());
      });
    });
  }

  private formatReceiptCommands(data: any): Buffer {
    // Implementation depends on printer protocol
    // This is a simplified example
    return Buffer.from([]);
  }

  private formatDisplayCommands(data: any): Buffer {
    // Implementation depends on display protocol
    // This is a simplified example
    return Buffer.from([]);
  }

  private formatLabelCommands(data: any): Buffer {
    // Implementation depends on label printer protocol
    // This is a simplified example
    return Buffer.from([]);
  }

  // Public methods for device management
  getConnectedDevices() {
    return Array.from(this.devices.values());
  }

  getDeviceStatus(deviceId: string) {
    return this.devices.get(deviceId);
  }

  async reconnectDevice(deviceId: string) {
    const device = this.devices.get(deviceId);
    if (!device) throw new Error('Device not found');

    const port = this.ports.get(deviceId);
    if (port) {
      port.close();
      this.ports.delete(deviceId);
    }

    await this.connectDevice(device);
  }

  onDeviceStatus(callback: (devices: Map<string, HardwareDevice>) => void) {
    return this.deviceStatus$.subscribe(callback);
  }
} 