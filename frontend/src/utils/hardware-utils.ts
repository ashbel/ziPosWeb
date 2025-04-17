import { HardwareIntegrationService } from '@/services/hardware-integration.service';

export const printReceipt = async (
  hardwareService: HardwareIntegrationService,
  data: {
    items: Array<{
      name: string;
      quantity: number;
      price: number;
    }>;
    total: number;
    tax?: number;
    paymentMethod: string;
    customerInfo?: {
      name: string;
      phone?: string;
    };
    orderNumber: string;
    date: Date;
  }
) => {
  const printers = hardwareService.getConnectedDevices()
    .filter(device => device.type === 'printer');

  if (printers.length === 0) {
    throw new Error('No printer connected');
  }

  // Use the first available printer
  const printer = printers[0];

  await hardwareService.printReceipt(printer.id, data);
};

export const openCashDrawer = async (
  hardwareService: HardwareIntegrationService
) => {
  const drawers = hardwareService.getConnectedDevices()
    .filter(device => device.type === 'cashDrawer');

  if (drawers.length === 0) {
    throw new Error('No cash drawer connected');
  }

  // Use the first available drawer
  const drawer = drawers[0];

  await hardwareService.openCashDrawer(drawer.id);
};

export const updateCustomerDisplay = async (
  hardwareService: HardwareIntegrationService,
  data: {
    total: number;
    items?: number;
    message?: string;
  }
) => {
  const displays = hardwareService.getConnectedDevices()
    .filter(device => device.type === 'customerDisplay');

  if (displays.length === 0) {
    throw new Error('No customer display connected');
  }

  // Use the first available display
  const display = displays[0];

  await hardwareService.displayCustomerInfo(display.id, data);
};

export const printLabel = async (
  hardwareService: HardwareIntegrationService,
  data: {
    text: string;
    barcodeType?: string;
    barcodeData?: string;
    width?: number;
    height?: number;
  }
) => {
  const printers = hardwareService.getConnectedDevices()
    .filter(device => device.type === 'labelPrinter');

  if (printers.length === 0) {
    throw new Error('No label printer connected');
  }

  // Use the first available printer
  const printer = printers[0];

  await hardwareService.printLabel(printer.id, data);
};

export const handleBarcodeScanned = (
  hardwareService: HardwareIntegrationService,
  callback: (barcode: string) => void
) => {
  const subscription = hardwareService.on('barcode-scanned', ({ barcode }) => {
    callback(barcode);
  });

  return () => {
    subscription.removeAllListeners();
  };
};

export const handleWeightMeasured = (
  hardwareService: HardwareIntegrationService,
  callback: (weight: number) => void
) => {
  const subscription = hardwareService.on('weight-measured', ({ weight }) => {
    callback(weight);
  });

  return () => {
    subscription.removeAllListeners();
  };
};

export const handleCardRead = (
  hardwareService: HardwareIntegrationService,
  callback: (cardData: {
    cardNumber: string;
    expiryDate: string;
    cardholderName: string;
  }) => void
) => {
  const subscription = hardwareService.on('card-read', (cardData) => {
    callback(cardData);
  });

  return () => {
    subscription.removeAllListeners();
  };
}; 