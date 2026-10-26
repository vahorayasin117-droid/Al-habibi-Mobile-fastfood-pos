import { Platform, PermissionsAndroid, Linking, Alert } from 'react-native';
import { formatTokenNumber } from './token';

// Safely require native thermal printer driver to prevent crash if not compiled yet
let ThermalPrinter = null;
let DriverNodes = null;

try {
  const driver = require('react-native-thermal-printer-driver');
  ThermalPrinter = driver.default || driver.ThermalPrinter || driver;
  DriverNodes = driver;
} catch (e) {
  // Native driver not compiled yet (e.g. running in Expo Go or Web)
}

/**
 * Check if native Bluetooth thermal printer driver is available in the current binary
 */
export function isNativeDriverAvailable() {
  return !!ThermalPrinter;
}

/**
 * Request runtime Bluetooth permissions on Android
 */
export async function requestBluetoothPermissions() {
  if (Platform.OS !== 'android') return true;

  try {
    if (Platform.Version >= 31) {
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]);
      const scan = results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED;
      const connect = results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED;
      return scan && connect;
    } else {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Bluetooth Permission',
          message: 'FastFood POS needs location permission to detect nearby Bluetooth thermal printers.',
          buttonPositive: 'Allow',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
  } catch (err) {
    console.warn('Error requesting Bluetooth permissions:', err);
    return false;
  }
}

/**
 * Normalize printer address to ensure Bluetooth scheme prefix (bt:<MAC>)
 * as expected by native TransportFactory
 */
export function normalizePrinterAddress(address) {
  if (!address) return '';
  const clean = String(address).trim();
  if (clean.startsWith('bt:') || clean.startsWith('ble:') || clean.startsWith('lan:')) {
    return clean;
  }
  return `bt:${clean}`;
}

/**
 * Remove transport prefixes for clean UI display of MAC address
 */
export function cleanPrinterAddress(address) {
  if (!address) return '';
  return String(address).replace(/^(bt:|ble:|lan:)/i, '').trim();
}

/**
 * Scan for paired and nearby Bluetooth printers
 */
export async function scanBluetoothPrinters() {
  if (!isNativeDriverAvailable()) {
    throw new Error('NATIVE_MODULE_NOT_FOUND');
  }

  const hasPerm = await requestBluetoothPermissions();
  if (!hasPerm) {
    throw new Error('PERMISSION_DENIED');
  }

  try {
    const result = await ThermalPrinter.scan();
    const paired = (result?.paired || []).map((dev) => ({
      name: dev.name || 'Bluetooth Printer',
      address: normalizePrinterAddress(dev.address),
      rawAddress: dev.address,
      deviceType: dev.deviceType || 'bt',
      isPaired: true,
    }));

    const found = (result?.found || []).map((dev) => ({
      name: dev.name || 'Unknown Device',
      address: normalizePrinterAddress(dev.address),
      rawAddress: dev.address,
      deviceType: dev.deviceType || 'bt',
      isPaired: false,
    }));

    return { paired, found, all: [...paired, ...found] };
  } catch (err) {
    console.error('Scan printers error:', err);
    throw err;
  }
}

/**
 * Connect to a specific printer address (e.g. "bt:66:32:8E:0A:11:22")
 */
export async function connectPrinter(address) {
  if (!isNativeDriverAvailable()) {
    throw new Error('NATIVE_MODULE_NOT_FOUND');
  }
  if (!address) {
    throw new Error('NO_PRINTER_ADDRESS');
  }

  const norm = normalizePrinterAddress(address);
  return await ThermalPrinter.connect(norm, { timeout: 8000 });
}

/**
 * Disconnect from printer
 */
export async function disconnectPrinter(address) {
  if (!isNativeDriverAvailable()) return;
  try {
    const norm = normalizePrinterAddress(address);
    await ThermalPrinter.disconnect(norm || null);
  } catch (e) {
    console.warn('Disconnect error:', e);
  }
}

/**
 * Test whether printer is currently connected and responding
 */
export async function isPrinterConnected(address) {
  if (!isNativeDriverAvailable() || !address) return false;
  try {
    const norm = normalizePrinterAddress(address);
    return await ThermalPrinter.isConnected(norm);
  } catch (e) {
    return false;
  }
}

/**
 * Build clean ESC/POS document nodes formatted for 58mm or 80mm thermal receipt
 */
export function buildReceiptNodes({
  shopName,
  phone,
  address,
  footerMessage,
  paperSize = '58mm',
  tokenNumber = 1,
  items = [],
  total = 0,
}) {
  if (!DriverNodes) return [];
  const { text, line, columns, feed, cut } = DriverNodes;

  const is58mm = paperSize !== '80mm';
  // Use percentage fractions (0.0 to 1.0) because compiler multiplies by totalChars!
  const itemColWidth = 0.50;
  const qtyColWidth = 0.20;
  const priceColWidth = 0.30;
  const metaColWidth = 0.50;

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

  const formattedToken = formatTokenNumber(tokenNumber);
  const totalQty = items.reduce((sum, it) => sum + (it.qty || 1), 0);

  const nodes = [
    // 1. Restaurant Header
    text(shopName ? shopName.toUpperCase() : 'FAST FOOD POS', {
      align: 'center',
      bold: true,
      size: 2,
    }),
  ];

  if (address) {
    nodes.push(text(address, { align: 'center' }));
  }
  if (phone) {
    nodes.push(text(`Tel: ${phone}`, { align: 'center' }));
  }

  // 2. Token Number
  nodes.push(line({ style: 'dashed' }));
  nodes.push(text('TOKEN NUMBER', { align: 'center', bold: true }));
  nodes.push(
    text(formattedToken, {
      align: 'center',
      bold: true,
      size: 2,
    })
  );
  nodes.push(line({ style: 'dashed' }));

  // 3. Date & Time
  nodes.push(
    columns([
      { content: `Date: ${dateStr}`, width: metaColWidth, align: 'left' },
      { content: `Time: ${timeStr}`, width: metaColWidth, align: 'right' },
    ])
  );
  nodes.push(line());

  // 4. Table Header
  nodes.push(
    columns([
      { content: 'ITEM', width: itemColWidth, align: 'left' },
      { content: 'QTY', width: qtyColWidth, align: 'center' },
      { content: 'PRICE', width: priceColWidth, align: 'right' },
    ])
  );
  nodes.push(line());

  // 5. Items
  items.forEach((item) => {
    const itemTotal = (item.price * item.qty).toFixed(0);
    const prodName = (item.productName || 'Item').toUpperCase();

    nodes.push(
      columns([
        { content: prodName, width: itemColWidth, align: 'left' },
        { content: String(item.qty), width: qtyColWidth, align: 'center' },
        { content: `Rs.${itemTotal}`, width: priceColWidth, align: 'right' },
      ])
    );

    if (item.variantName) {
      nodes.push(text(`  Var: ${item.variantName}`, { font: 'B' }));
    }
    if (item.notes && item.notes.length > 0) {
      nodes.push(text(`  Note: ${item.notes.join(', ')}`, { font: 'B' }));
    }
  });

  // 6. Summary & Total
  nodes.push(line({ style: 'dashed' }));
  nodes.push(
    columns([
      { content: `Items: ${items.length}`, width: metaColWidth, align: 'left' },
      { content: `Total Qty: ${totalQty}`, width: metaColWidth, align: 'right' },
    ])
  );
  nodes.push(line());

  nodes.push(
    columns([
      { content: 'TOTAL AMOUNT', width: 0.60, align: 'left' },
      { content: `Rs.${total.toFixed(0)}`, width: 0.40, align: 'right' },
    ])
  );
  nodes.push(line());

  // 7. Footer
  nodes.push(
    text(footerMessage || 'Thank You! Visit Again', {
      align: 'center',
      bold: true,
    })
  );

  // 8. Feed 3 lines (No cutter command for mobile printers!)
  nodes.push(feed(3));

  return nodes;
}

/**
 * Print directly to Bluetooth Thermal Printer (Instant, No Preview Dialog!)
 */
export async function printReceiptBluetooth(receiptData, printerAddress) {
  if (!isNativeDriverAvailable()) {
    throw new Error('NATIVE_MODULE_NOT_FOUND');
  }
  if (!printerAddress) {
    throw new Error('NO_PRINTER_ADDRESS');
  }

  const normAddress = normalizePrinterAddress(printerAddress);
  const is58mm = receiptData.paperSize !== '80mm';

  // Build compact, byte-exact ESC/POS commands (handles 2 slips cleanly, no cutter overflow!)
  const rawBytes = buildEscPosBytes(receiptData);

  const result = await ThermalPrinter.printRaw(normAddress, rawBytes, {
    paperWidthMm: is58mm ? 58 : 80,
    timeout: 12000,
  });

  if (result && result.success === false) {
    throw new Error(result.error || 'Failed to print on Bluetooth printer. Please ensure printer is ON.');
  }

  return result;
}

/**
 * Generate formatted plain-text receipt for RawBT print service
 */
export function buildPlainTextReceipt({
  shopName,
  phone,
  address,
  footerMessage,
  paperSize = '58mm',
  tokenNumber = 1,
  items = [],
  total = 0,
}) {
  const is58mm = paperSize !== '80mm';
  const width = is58mm ? 32 : 48;
  const lineStr = '-'.repeat(width);
  const doubleLineStr = '='.repeat(width);

  const center = (str) => {
    const s = String(str || '').trim();
    if (s.length >= width) return s.slice(0, width);
    const leftPad = Math.floor((width - s.length) / 2);
    return ' '.repeat(leftPad) + s;
  };

  const padRow = (left, right) => {
    const l = String(left || '');
    const r = String(right || '');
    const space = Math.max(1, width - l.length - r.length);
    return l + ' '.repeat(space) + r;
  };

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

  const formattedToken = formatTokenNumber(tokenNumber);
  const totalQty = items.reduce((sum, it) => sum + (it.qty || 1), 0);

  let text = '';
  text += center(shopName || 'FAST FOOD POS') + '\n';
  if (address) text += center(address) + '\n';
  if (phone) text += center(`Tel: ${phone}`) + '\n';
  text += lineStr + '\n';
  text += center('TOKEN NUMBER') + '\n';
  text += center(formattedToken) + '\n';
  text += lineStr + '\n';
  text += padRow(`Date: ${dateStr}`, `Time: ${timeStr}`) + '\n';
  text += lineStr + '\n';
  text += padRow('ITEM', 'QTY  PRICE') + '\n';
  text += lineStr + '\n';

  items.forEach((it) => {
    const itemTotal = (it.price * it.qty).toFixed(0);
    const right = `${it.qty}   Rs.${itemTotal}`;
    const left = (it.productName || 'Item').toUpperCase();
    text += padRow(left.slice(0, width - right.length - 1), right) + '\n';
    if (it.variantName) {
      text += `  Var: ${it.variantName}\n`;
    }
    if (it.notes && it.notes.length > 0) {
      text += `  Note: ${it.notes.join(', ')}\n`;
    }
  });

  text += lineStr + '\n';
  text += padRow(`Items: ${items.length}`, `Total Qty: ${totalQty}`) + '\n';
  text += doubleLineStr + '\n';
  text += padRow('TOTAL AMOUNT', `Rs.${total.toFixed(0)}`) + '\n';
  text += doubleLineStr + '\n';
  text += center(footerMessage || 'Thank You! Visit Again') + '\n';
  text += '\n\n\n';

  return text;
}

// Safe Base64 encoder for React Native / Expo
const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function toBase64(bytes) {
  let result = '';
  let i = 0;
  while (i < bytes.length) {
    const b1 = bytes[i++];
    const b2 = i < bytes.length ? bytes[i++] : NaN;
    const b3 = i < bytes.length ? bytes[i++] : NaN;

    result += B64_CHARS.charAt(b1 >> 2);
    result += B64_CHARS.charAt(((b1 & 3) << 4) | (isNaN(b2) ? 0 : b2 >> 4));
    result += isNaN(b2) ? '=' : B64_CHARS.charAt(((b2 & 15) << 2) | (isNaN(b3) ? 0 : b3 >> 6));
    result += isNaN(b3) ? '=' : B64_CHARS.charAt(b3 & 63);
  }
  return result;
}

function strToAsciiBytes(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    bytes.push(code < 128 ? code : 63);
  }
  return bytes;
}

/**
 * Build a single crisp, compact ESC/POS receipt slip
 */
function buildSingleSlipBytes(params, slipTitle = null) {
  const {
    shopName,
    phone,
    address,
    footerMessage,
    paperSize = '58mm',
    tokenNumber = 1,
    items = [],
    total = 0,
  } = params;

  const is58mm = paperSize !== '80mm';
  const width = is58mm ? 32 : 48;
  const lineStr = '-'.repeat(width);
  const doubleLineStr = '='.repeat(width);

  const bytes = [];
  const add = (...b) => bytes.push(...b);
  const addStr = (s) => add(...strToAsciiBytes(s));
  const addLine = (s) => {
    addStr(s);
    add(0x0a);
  };

  const padRow = (left, right) => {
    const l = String(left || '');
    const r = String(right || '');
    const space = Math.max(1, width - l.length - r.length);
    return l + ' '.repeat(space) + r;
  };

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  const formattedToken = formatTokenNumber(tokenNumber);
  const totalQty = items.reduce((sum, it) => sum + (it.qty || 1), 0);

  // 1. Initialize printer
  add(0x1b, 0x40);

  // 2. Shop Header (Center, Bold)
  add(0x1b, 0x61, 0x01); // Center
  add(0x1b, 0x45, 0x01); // Bold on
  add(0x1d, 0x21, 0x01); // Double height
  addLine(shopName ? shopName.toUpperCase() : 'FAST FOOD POS');
  add(0x1d, 0x21, 0x00);
  add(0x1b, 0x45, 0x00);

  if (address) addLine(address);
  if (phone) addLine(`Tel: ${phone}`);

  if (slipTitle) {
    add(0x1b, 0x45, 0x01);
    addLine(`*** ${slipTitle.toUpperCase()} ***`);
    add(0x1b, 0x45, 0x00);
  }

  // 3. Token Section (Bold & Large)
  addLine(lineStr);
  add(0x1b, 0x45, 0x01);
  addLine('TOKEN NUMBER');
  add(0x1d, 0x21, 0x11); // Double width & height
  addLine(formattedToken);
  add(0x1d, 0x21, 0x00);
  add(0x1b, 0x45, 0x00);
  addLine(lineStr);

  // 4. Date & Time
  add(0x1b, 0x61, 0x00); // Left align
  addLine(padRow(`Date: ${dateStr}`, `Time: ${timeStr}`));
  addLine(lineStr);

  if (slipTitle === 'Kitchen Order') {
    // Kitchen Slip: focus on item names and preparation notes
    addLine(padRow('ITEM', 'QTY'));
    addLine(lineStr);
    items.forEach((it) => {
      const right = `x ${it.qty}`;
      const left = (it.productName || 'Item').toUpperCase();
      addLine(padRow(left.slice(0, width - right.length - 1), right));
      if (it.variantName) {
        addLine(`  Var: ${it.variantName}`);
      }
      if (it.notes && it.notes.length > 0) {
        addLine(`  Note: ${it.notes.join(', ')}`);
      }
    });
    addLine(lineStr);
    addLine(padRow(`Items: ${items.length}`, `Total Qty: ${totalQty}`));
    addLine(lineStr);
  } else {
    // Customer Bill: includes item prices and grand total
    addLine(padRow('ITEM', 'QTY  PRICE'));
    addLine(lineStr);
    items.forEach((it) => {
      const itemTotal = (it.price * it.qty).toFixed(0);
      const right = `${it.qty}  Rs.${itemTotal}`;
      const left = (it.productName || 'Item').toUpperCase();
      addLine(padRow(left.slice(0, width - right.length - 1), right));
      if (it.variantName) {
        addLine(`  Var: ${it.variantName}`);
      }
      if (it.notes && it.notes.length > 0) {
        addLine(`  Note: ${it.notes.join(', ')}`);
      }
    });

    addLine(lineStr);
    addLine(padRow(`Items: ${items.length}`, `Total Qty: ${totalQty}`));
    addLine(doubleLineStr);

    // Total Amount (Double height, Bold)
    add(0x1d, 0x21, 0x01);
    add(0x1b, 0x45, 0x01);
    addLine(padRow('TOTAL AMOUNT', `Rs.${total.toFixed(0)}`));
    add(0x1d, 0x21, 0x00);
    add(0x1b, 0x45, 0x00);
    addLine(doubleLineStr);

    // Footer
    add(0x1b, 0x61, 0x01);
    add(0x1b, 0x45, 0x01);
    addLine(footerMessage || 'Thank You! Visit Again');
    add(0x1b, 0x45, 0x00);
  }

  // Small feed after slip (2 lines)
  add(0x0a, 0x0a);

  return bytes;
}

/**
 * Build raw ESC/POS command bytes for 58mm / 80mm thermal receipt
 * Compatible with mobile Bluetooth thermal printers, RawBT, and SPP sockets
 */
export function buildEscPosBytes(receiptData) {
  const copies = Number(receiptData.copies) || 2;
  const is58mm = receiptData.paperSize !== '80mm';
  const width = is58mm ? 32 : 48;
  const tearStr = '- '.repeat(Math.floor(width / 2));

  // If 2 copies: Print Slip 1 (Customer Bill) + Tear line + Slip 2 (Kitchen Slip)
  if (copies === 2) {
    const slip1 = buildSingleSlipBytes(receiptData, 'Customer Bill');
    const slip2 = buildSingleSlipBytes(receiptData, 'Kitchen Order');

    const separator = [];
    separator.push(0x1b, 0x61, 0x01); // Center
    separator.push(...strToAsciiBytes(tearStr), 0x0a);
    separator.push(...strToAsciiBytes('--- TEAR HERE ---'), 0x0a);
    separator.push(...strToAsciiBytes(tearStr), 0x0a);
    separator.push(0x0a, 0x0a);

    // Final feed 3 lines so slip2 clears the manual tear bar
    const finalFeed = [0x0a, 0x0a, 0x0a];

    return [...slip1, ...separator, ...slip2, ...finalFeed];
  }

  // Single slip
  const single = buildSingleSlipBytes(receiptData);
  return [...single, 0x0a, 0x0a, 0x0a];
}

/**
 * Check if RawBT intent print is available on the device
 */
export async function isRawBTAvailable() {
  if (Platform.OS !== 'android') return false;
  try {
    return await Linking.canOpenURL('rawbt:');
  } catch (e) {
    return false;
  }
}

/**
 * Open RawBT on Google Play Store
 */
export async function openRawBTPlayStore() {
  const marketUrl = 'market://details?id=ru.a402d.rawbtprinter';
  const webUrl = 'https://play.google.com/store/apps/details?id=ru.a402d.rawbtprinter';
  try {
    const can = await Linking.canOpenURL(marketUrl);
    if (can) {
      await Linking.openURL(marketUrl);
    } else {
      await Linking.openURL(webUrl);
    }
  } catch (e) {
    await Linking.openURL(webUrl);
  }
}

/**
 * Open RawBT App directly
 */
export async function openRawBTApp() {
  try {
    await Linking.openURL('rawbt:');
  } catch (e) {
    await openRawBTPlayStore();
  }
}

/**
 * Print via RawBT intent using raw ESC/POS binary (Instant direct print with no preview!)
 * Works directly in Expo Go!
 */
export async function printViaRawBT(receiptData) {
  const bytes = buildEscPosBytes(receiptData);
  const b64 = toBase64(bytes);
  const url = `rawbt:data:application/octet-stream;base64,${b64}`;

  try {
    await Linking.openURL(url);
    return { success: true };
  } catch (err) {
    console.error('RawBT open URL error:', err);
    throw new Error('RAWBT_NOT_INSTALLED');
  }
}
