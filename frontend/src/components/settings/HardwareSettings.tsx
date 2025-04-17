import React, { useState, useEffect } from 'react';
import { useHardware } from '@/hooks/useHardware';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';

interface DeviceConfig {
  id: string;
  name: string;
  type: string;
  port: string;
  enabled: boolean;
  settings: Record<string, any>;
}

export const HardwareSettings = () => {
  const [devices, setDevices] = useState<DeviceConfig[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const { hardwareService } = useHardware();

  useEffect(() => {
    loadDevices();
    const subscription = hardwareService.onDeviceStatus(handleDeviceUpdate);
    return () => subscription.unsubscribe();
  }, []);

  const loadDevices = async () => {
    const connectedDevices = hardwareService.getConnectedDevices();
    const savedConfigs = await loadSavedConfigs();

    setDevices(connectedDevices.map(device => ({
      id: device.id,
      name: device.manufacturer
        ? `${device.manufacturer} ${device.model}`
        : `${device.type} (${device.port})`,
      type: device.type,
      port: device.port,
      enabled: device.status === 'connected',
      settings: savedConfigs[device.id] || getDefaultSettings(device.type)
    })));
  };

  const handleDeviceUpdate = (deviceMap: Map<string, any>) => {
    setDevices(current => {
      const updated = [...current];
      for (const [id, device] of deviceMap.entries()) {
        const index = updated.findIndex(d => d.id === id);
        if (index >= 0) {
          updated[index] = {
            ...updated[index],
            enabled: device.status === 'connected'
          };
        } else {
          updated.push({
            id: device.id,
            name: device.manufacturer
              ? `${device.manufacturer} ${device.model}`
              : `${device.type} (${device.port})`,
            type: device.type,
            port: device.port,
            enabled: device.status === 'connected',
            settings: getDefaultSettings(device.type)
          });
        }
      }
      return updated;
    });
  };

  const getDefaultSettings = (type: string) => {
    switch (type) {
      case 'printer':
        return {
          paperWidth: 80,
          characterSet: 'UTF-8',
          cutType: 'partial',
          logo: false
        };
      case 'scanner':
        return {
          prefix: '',
          suffix: '\r',
          scanMode: 'continuous'
        };
      case 'cashDrawer':
        return {
          openTime: 200,
          checkStatus: true
        };
      case 'customerDisplay':
        return {
          brightness: 100,
          scrollSpeed: 'medium',
          welcomeMessage: 'Welcome!'
        };
      case 'scale':
        return {
          unit: 'kg',
          precision: 2,
          autoZero: true
        };
      case 'cardReader':
        return {
          trackFormat: 'ISO',
          encryption: true
        };
      case 'labelPrinter':
        return {
          width: 50,
          height: 30,
          density: 'medium'
        };
      default:
        return {};
    }
  };

  const handleScanDevices = async () => {
    setIsScanning(true);
    try {
      await loadDevices();
      toast.success('Hardware scan completed');
    } catch (error) {
      toast.error('Failed to scan hardware');
    } finally {
      setIsScanning(false);
    }
  };

  const handleTestDevice = async (device: DeviceConfig) => {
    try {
      switch (device.type) {
        case 'printer':
          await hardwareService.printReceipt(device.id, {
            text: 'Test Print\n\nThis is a test receipt.\n\n'
          });
          break;
        case 'cashDrawer':
          await hardwareService.openCashDrawer(device.id);
          break;
        case 'customerDisplay':
          await hardwareService.displayCustomerInfo(device.id, {
            message: 'Display Test',
            total: 0
          });
          break;
        case 'labelPrinter':
          await hardwareService.printLabel(device.id, {
            text: 'Test Label'
          });
          break;
      }
      toast.success('Test successful');
    } catch (error) {
      toast.error(`Test failed: ${error.message}`);
    }
  };

  const handleSaveSettings = async (device: DeviceConfig) => {
    try {
      await saveDeviceConfig(device);
      toast.success('Settings saved');
    } catch (error) {
      toast.error('Failed to save settings');
    }
  };

  const handleReconnect = async (deviceId: string) => {
    try {
      await hardwareService.reconnectDevice(deviceId);
      toast.success('Device reconnected');
    } catch (error) {
      toast.error('Failed to reconnect device');
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Hardware Settings</h2>
        <button
          onClick={handleScanDevices}
          disabled={isScanning}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {isScanning ? 'Scanning...' : 'Scan Devices'}
        </button>
      </div>

      <AnimatePresence>
        {devices.map(device => (
          <motion.div
            key={device.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -100 }}
            className="bg-white rounded-lg shadow p-6"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-medium">{device.name}</h3>
                <p className="text-sm text-gray-500">
                  {device.type} - {device.port}
                </p>
                <div className="mt-1">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      device.enabled
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {device.enabled ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
              </div>

              <div className="flex space-x-2">
                {!device.enabled && (
                  <button
                    onClick={() => handleReconnect(device.id)}
                    className="px-3 py-1 bg-blue-100 text-blue-600 rounded hover:bg-blue-200"
                  >
                    Reconnect
                  </button>
                )}
                <button
                  onClick={() => handleTestDevice(device)}
                  disabled={!device.enabled}
                  className="px-3 py-1 bg-green-100 text-green-600 rounded hover:bg-green-200 disabled:opacity-50"
                >
                  Test
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              {Object.entries(device.settings).map(([key, value]) => (
                <div key={key} className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">
                    {key.charAt(0).toUpperCase() + key.slice(1)}
                  </label>
                  {typeof value === 'boolean' ? (
                    <input
                      type="checkbox"
                      checked={value}
                      onChange={e => {
                        const updated = [...devices];
                        const index = updated.findIndex(d => d.id === device.id);
                        updated[index] = {
                          ...device,
                          settings: {
                            ...device.settings,
                            [key]: e.target.checked
                          }
                        };
                        setDevices(updated);
                      }}
                      className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                    />
                  ) : (
                    <input
                      type={typeof value === 'number' ? 'number' : 'text'}
                      value={value}
                      onChange={e => {
                        const updated = [...devices];
                        const index = updated.findIndex(d => d.id === device.id);
                        updated[index] = {
                          ...device,
                          settings: {
                            ...device.settings,
                            [key]: typeof value === 'number'
                              ? parseFloat(e.target.value)
                              : e.target.value
                          }
                        };
                        setDevices(updated);
                      }}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => handleSaveSettings(device)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Save Settings
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {devices.length === 0 && !isScanning && (
        <div className="text-center py-12 text-gray-500">
          No hardware devices detected
        </div>
      )}
    </div>
  );
}; 