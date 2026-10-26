import * as Print from 'expo-print';
import { Platform } from 'react-native';
import { formatTokenNumber } from './token';
import {
  isNativeDriverAvailable,
  printReceiptBluetooth,
  isRawBTAvailable,
  printViaRawBT,
} from './thermalPrinter';

/**
 * Print clean thermal receipt formatted for mini hotel POS printers (58mm / 80mm).
 * Supports:
 * 1. Direct Bluetooth Thermal Printer (Instant, No Preview Dialog!)
 * 2. RawBT Android Print Service (Instant, No Preview)
 * 3. Expo Print / System Print Dialog (Preview fallback)
 */
export async function printReceipt(receiptParams) {
  const {
    shopName,
    phone,
    address,
    footerMessage,
    paperSize = '58mm',
    tokenNumber = 1,
    items = [],
    total = 0,
    copies = 2,
    printerAddress,
    printMode = 'bluetooth', // 'bluetooth' | 'rawbt' | 'system'
  } = receiptParams;

  const fullReceiptParams = {
    ...receiptParams,
    copies,
  };

  // 1. Direct Bluetooth Thermal Print (Instant - Zero Preview!)
  if (printMode === 'bluetooth') {
    if (isNativeDriverAvailable()) {
      if (!printerAddress) {
        throw new Error('NO_PRINTER_ADDRESS');
      }
      const res = await printReceiptBluetooth(fullReceiptParams, printerAddress);
      return { success: true, method: 'bluetooth', result: res };
    }

    // If running in Expo Go or native driver not compiled, check RawBT as direct zero-preview fallback
    if (Platform.OS === 'android') {
      const rawBtAvailable = await isRawBTAvailable();
      if (rawBtAvailable) {
        await printViaRawBT(fullReceiptParams);
        return { success: true, method: 'rawbt' };
      }
      throw new Error('RAWBT_NOT_INSTALLED');
    }

    throw new Error('NATIVE_MODULE_NOT_FOUND');
  }

  // 2. RawBT Intent Print (Instant - Zero Preview Dialog on Android)
  if (printMode === 'rawbt') {
    if (Platform.OS === 'android') {
      const rawBtAvailable = await isRawBTAvailable();
      if (rawBtAvailable) {
        await printViaRawBT(fullReceiptParams);
        return { success: true, method: 'rawbt' };
      }
      throw new Error('RAWBT_NOT_INSTALLED');
    }
    throw new Error('RawBT is only supported on Android devices.');
  }

  const is58mm = paperSize !== '80mm';
  const paperWidth = is58mm ? '58mm' : '80mm';
  const printableWidth = is58mm ? '48mm' : '72mm';

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const totalQty = items.reduce((sum, it) => sum + (it.qty || 1), 0);

  // Clean table rows: No emojis, no stars, no dots, no index numbers
  const tableRowsHtml = items
    .map((it, idx) => {
      const isLast = idx === items.length - 1;
      const variantHtml = it.variantName
        ? `<div style="font-size: 10px; color: #333; margin-top: 1px;">Variant: ${it.variantName}</div>`
        : '';
      const notesHtml =
        it.notes && it.notes.length > 0
          ? `<div style="font-size: 10px; font-weight: bold; color: #111; margin-top: 2px;">Note: ${it.notes.join(', ')}</div>`
          : '';
      const itemTotal = (it.price * it.qty).toFixed(0);

      return `
        <tr style="border-bottom: ${isLast ? 'none' : '1px solid #ddd'};">
          <td style="vertical-align: top; padding: 6px 2px; width: 60%;">
            <div style="font-size: 11.5px; font-weight: bold; text-transform: uppercase; line-height: 1.25;">
              ${it.productName}
            </div>
            ${variantHtml}
            ${notesHtml}
          </td>
          <td style="text-align: center; vertical-align: top; padding: 6px 2px; width: 15%; font-size: 13px; font-weight: bold;">
            ${it.qty}
          </td>
          <td style="text-align: right; vertical-align: top; padding: 6px 2px; width: 25%; font-size: 12px; font-weight: bold;">
            ₹${itemTotal}
          </td>
        </tr>
      `;
    })
    .join('');

  const formattedToken = formatTokenNumber(tokenNumber);

  const singleReceiptHtml = `
    <div class="bill-wrapper">
      <!-- Restaurant / Hotel Header -->
      <div class="center">
        <div class="shop-title">${shopName || 'FAST FOOD POS'}</div>
        ${address ? `<div class="shop-sub">${address}</div>` : ''}
        ${phone ? `<div class="shop-sub">Tel: ${phone}</div>` : ''}
      </div>

      <hr class="line" />

      <!-- Token Number -->
      <div class="token-box">
        <div class="token-label">TOKEN NUMBER</div>
        <div class="token-number">${formattedToken}</div>
      </div>

      <hr class="line" />

      <!-- Date & Time -->
      <div class="meta-row">
        <span>Date: ${dateStr}</span>
        <span>Time: ${timeStr}</span>
      </div>

      <!-- Clean Table -->
      <table class="order-table">
        <thead>
          <tr>
            <th style="text-align: left; width: 60%;">ITEM</th>
            <th style="text-align: center; width: 15%;">QTY</th>
            <th style="text-align: right; width: 25%;">PRICE</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
      </table>

      <hr class="line" />

      <!-- Summary: Total Items and Total Quantity -->
      <div class="summary-row">
        <span>Items: ${items.length}</span>
        <span>Total Qty: ${totalQty}</span>
      </div>

      <hr class="line-thick" />

      <!-- Grand Total -->
      <div class="total-row">
        <span class="total-label">TOTAL AMOUNT</span>
        <span class="total-amount">₹${total.toFixed(0)}</span>
      </div>

      <hr class="line-thick" />

      <!-- Footer Message (No emojis, no stars, no dots) -->
      <div class="footer">
        <div>${footerMessage || 'Thank You Visit Again'}</div>
      </div>
    </div>
  `;

  const receiptsContent = Array.from({ length: copies })
    .map((_, idx) => {
      const isLast = idx === copies - 1;
      return `
        ${singleReceiptHtml}
        ${!isLast ? `<div class="receipt-divider"><hr class="cut-line" /></div>` : ''}
      `;
    })
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Receipt ${formattedToken}</title>
        <style>
          @page {
            size: ${paperWidth} auto;
            margin: 0mm;
          }
          @media print {
            html, body {
              width: ${paperWidth} !important;
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
            }
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          body {
            width: ${paperWidth};
            margin: 0 auto;
            padding: 0;
            background: #ffffff;
            color: #000000;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .bill-wrapper {
            width: ${printableWidth};
            margin: 0 auto;
            padding: 4mm 0 6mm 0;
          }
          .receipt-divider {
            width: ${printableWidth};
            margin: 6mm auto;
            padding: 4mm 0;
            text-align: center;
            page-break-after: always;
            break-after: page;
          }
          .cut-line {
            border: none;
            border-top: 1px dashed #000000;
            width: 100%;
          }
          .center {
            text-align: center;
          }
          .shop-title {
            font-size: 16px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            line-height: 1.2;
          }
          .shop-sub {
            font-size: 10px;
            color: #333;
            margin-top: 2px;
            line-height: 1.2;
          }
          .line {
            border: none;
            border-top: 1px solid #000000;
            margin: 5px 0;
          }
          .line-thick {
            border: none;
            border-top: 2px solid #000000;
            margin: 5px 0;
          }
          .token-box {
            text-align: center;
            padding: 4px 0;
          }
          .token-label {
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 1px;
            color: #444;
          }
          .token-number {
            font-size: 28px;
            font-weight: 900;
            letter-spacing: 2px;
            line-height: 1.1;
            margin: 2px 0;
          }
          .meta-row {
            display: flex;
            justify-content: space-between;
            font-size: 9.5px;
            color: #333;
            padding: 1px 0;
          }
          .order-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 3px;
          }
          .order-table th {
            font-size: 10px;
            font-weight: 800;
            padding: 4px 2px;
            border-top: 1px solid #000000;
            border-bottom: 1px solid #000000;
          }
          .summary-row {
            display: flex;
            justify-content: space-between;
            font-size: 10px;
            font-weight: 700;
            padding: 4px 0;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 5px 0;
          }
          .total-label {
            font-size: 13px;
            font-weight: 800;
          }
          .total-amount {
            font-size: 18px;
            font-weight: 900;
          }
          .footer {
            text-align: center;
            margin-top: 8px;
            font-size: 10px;
            font-weight: 600;
            color: #444;
          }
        </style>
      </head>
      <body>
        ${receiptsContent}
      </body>
    </html>
  `;

  // On Web: use isolated iframe print so only the receipt prints, not the POS screen
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    return new Promise((resolve) => {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow.document;
      doc.open();
      doc.write(html);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } catch (e) {
          console.error('Print iframe error:', e);
        }
        setTimeout(() => {
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
          resolve();
        }, 1200);
      }, 300);
    });
  }

  // Only if explicitly specified as 'system', allow OS preview dialog
  if (printMode === 'system') {
    return await Print.printAsync({ html });
  }

  throw new Error('Bluetooth mobile printer connected nahi hai. Kripya Settings mein printer check karein.');
}
