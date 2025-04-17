import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

interface ReceiptData {
  saleId: string;
  date: Date;
  items: CartItem[];
  total: number;
  paymentType: string;
  cashReceived?: number;
  change?: number;
  customer?: {
    name: string;
    phone?: string;
  };
  businessInfo: {
    name: string;
    address: string;
    phone: string;
    taxId?: string;
  };
}

export const generateReceipt = (data: ReceiptData) => {
  const doc = new jsPDF({
    format: [80, 'auto'], // 80mm width receipt
    unit: 'mm'
  });

  // Set font
  doc.setFont('helvetica');
  doc.setFontSize(8);

  let yPos = 10;
  const leftMargin = 5;
  const width = 70;

  // Business info
  doc.setFontSize(10);
  doc.text(data.businessInfo.name, leftMargin, yPos, { align: 'center' });
  yPos += 5;
  doc.setFontSize(8);
  doc.text(data.businessInfo.address, leftMargin, yPos, { align: 'center' });
  yPos += 4;
  doc.text(data.businessInfo.phone, leftMargin, yPos, { align: 'center' });
  yPos += 4;
  if (data.businessInfo.taxId) {
    doc.text(`Tax ID: ${data.businessInfo.taxId}`, leftMargin, yPos, { align: 'center' });
    yPos += 4;
  }

  // Sale info
  doc.text(`Receipt #: ${data.saleId}`, leftMargin, yPos);
  yPos += 4;
  doc.text(`Date: ${new Date(data.date).toLocaleString()}`, leftMargin, yPos);
  yPos += 4;

  if (data.customer) {
    doc.text(`Customer: ${data.customer.name}`, leftMargin, yPos);
    yPos += 4;
    if (data.customer.phone) {
      doc.text(`Phone: ${data.customer.phone}`, leftMargin, yPos);
      yPos += 4;
    }
  }

  yPos += 2;
  doc.line(leftMargin, yPos, width + leftMargin, yPos);
  yPos += 4;

  // Items
  doc.autoTable({
    startY: yPos,
    head: [['Item', 'Qty', 'Price', 'Total']],
    body: data.items.map(item => [
      item.name,
      item.quantity.toString(),
      item.price.toFixed(2),
      (item.price * item.quantity).toFixed(2)
    ]),
    margin: { left: leftMargin },
    styles: { fontSize: 8, cellPadding: 1 },
    theme: 'plain'
  });

  yPos = (doc as any).lastAutoTable.finalY + 4;

  // Totals
  doc.line(leftMargin, yPos, width + leftMargin, yPos);
  yPos += 4;
  doc.text(`Total: ${data.total.toFixed(2)}`, width - 10, yPos, { align: 'right' });
  yPos += 4;

  if (data.paymentType === 'cash' && data.cashReceived) {
    doc.text(`Cash Received: ${data.cashReceived.toFixed(2)}`, width - 10, yPos, { align: 'right' });
    yPos += 4;
    doc.text(`Change: ${data.change?.toFixed(2)}`, width - 10, yPos, { align: 'right' });
    yPos += 4;
  }

  doc.text(`Payment Method: ${data.paymentType.toUpperCase()}`, leftMargin, yPos);
  yPos += 8;

  // Footer
  doc.setFontSize(7);
  doc.text('Thank you for your business!', leftMargin, yPos, { align: 'center' });

  return doc;
}; 