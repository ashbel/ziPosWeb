import React, { useState } from 'react';
import { useReceiptSettings } from '@/hooks/useReceiptSettings';
import { usePrinters } from '@/hooks/usePrinters';
import { Preview } from './Preview';

export const ReceiptCustomization = () => {
  const { data: settings, updateSettings } = useReceiptSettings();
  const { data: printers } = usePrinters();
  const [preview, setPreview] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Receipt Settings</h2>
        <button
          onClick={() => setPreview(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg"
        >
          Preview Receipt
        </button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Content Settings</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Header Text
              </label>
              <textarea
                value={settings?.headerText}
                onChange={(e) => updateSettings({ headerText: e.target.value })}
                rows={3}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Footer Text
              </label>
              <textarea
                value={settings?.footerText}
                onChange={(e) => updateSettings({ footerText: e.target.value })}
                rows={3}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Font Size
                </label>
                <select
                  value={settings?.fontSize}
                  onChange={(e) => updateSettings({ fontSize: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                >
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Paper Width
                </label>
                <select
                  value={settings?.paperWidth}
                  onChange={(e) => updateSettings({ paperWidth: Number(e.target.value) })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                >
                  <option value="58">58mm</option>
                  <option value="80">80mm</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Printer Settings</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Default Printer
              </label>
              <select
                value={settings?.defaultPrinterId}
                onChange={(e) => updateSettings({ defaultPrinterId: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
              >
                {printers?.map((printer) => (
                  <option key={printer.id} value={printer.id}>
                    {printer.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings?.autoPrint}
                  onChange={(e) => updateSettings({ autoPrint: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="ml-2">Auto-print after sale</span>
              </label>
            </div>

            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings?.printLogo}
                  onChange={(e) => updateSettings({ printLogo: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="ml-2">Include logo</span>
              </label>
            </div>

            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings?.printBarcode}
                  onChange={(e) => updateSettings({ printBarcode: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="ml-2">Include barcode</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <Preview
        isOpen={preview}
        onClose={() => setPreview(false)}
        settings={settings}
      />
    </div>
  );
}; 