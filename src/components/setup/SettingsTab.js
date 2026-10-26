import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useData } from '../../context/DataContext';
import { COLORS, RADIUS } from '../../theme';
import { printReceipt } from '../../utils/print';
import { getBusinessDayKey } from '../../utils/token';
import {
  isNativeDriverAvailable,
  scanBluetoothPrinters,
  connectPrinter,
  disconnectPrinter,
  isPrinterConnected,
  cleanPrinterAddress,
} from '../../utils/thermalPrinter';

export default function SettingsTab() {
  const { settings, updateSettings } = useData();

  // Shop info
  const [shopName, setShopName] = useState(settings.shopName || '');
  const [phone, setPhone] = useState(settings.phone || '');
  const [address, setAddress] = useState(settings.address || '');
  const [footerMessage, setFooterMessage] = useState(settings.footerMessage || 'Thank You Visit Again');
  const [paperSize, setPaperSize] = useState(settings.paperSize || '58mm');
  const [printCopies, setPrintCopies] = useState(settings.printCopies || 2);
  const [tokenCounter, setTokenCounter] = useState(String(settings.tokenCounter || 1));
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Bluetooth / Printing states
  const [printerAddress, setPrinterAddress] = useState(settings.printerAddress || '');
  const [printerName, setPrinterName] = useState(settings.printerName || '');
  const [printMode, setPrintMode] = useState(settings.printMode || 'bluetooth');
  const [isConnected, setIsConnected] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [devices, setDevices] = useState([]);
  const [statusMessage, setStatusMessage] = useState('');

  const isNative = isNativeDriverAvailable();

  // Check RawBT and Native connection
  useEffect(() => {
    let isMounted = true;
    async function checkStatus() {
      if (settings.printerAddress && isNative) {
        try {
          const connected = await isPrinterConnected(settings.printerAddress);
          if (isMounted) setIsConnected(connected);
        } catch (e) {
          if (isMounted) setIsConnected(false);
        }
      } else {
        if (isMounted) setIsConnected(false);
      }
    }
    checkStatus();
    return () => {
      isMounted = false;
    };
  }, [settings.printerAddress, isNative]);

  // Auto-scan paired devices on mount for seamless experience
  useEffect(() => {
    if (isNative && devices.length === 0) {
      handleScan(true);
    }
  }, [isNative]);

  useEffect(() => {
    const currentKey = getBusinessDayKey();
    let currentToken = settings.tokenCounter || 1;
    if (settings.lastTokenDate && settings.lastTokenDate !== currentKey) {
      currentToken = 1;
    }
    setShopName(settings.shopName || '');
    setPhone(settings.phone || '');
    setAddress(settings.address || '');
    setFooterMessage(settings.footerMessage || 'Thank You Visit Again');
    setPaperSize(settings.paperSize || '58mm');
    setPrintCopies(settings.printCopies || 2);
    setTokenCounter(String(currentToken));
    setPrinterAddress(settings.printerAddress || '');
    setPrinterName(settings.printerName || '');
    setPrintMode(settings.printMode || (isNative ? 'bluetooth' : 'rawbt'));
  }, [settings, isNative]);

  function handleSave() {
    updateSettings({
      shopName: shopName.trim(),
      phone: phone.trim(),
      address: address.trim(),
      footerMessage: footerMessage.trim(),
      paperSize,
      printCopies: parseInt(printCopies, 10) || 2,
      tokenCounter: parseInt(tokenCounter, 10) || 1,
      lastTokenDate: getBusinessDayKey(),
      printerAddress,
      printerName,
      printMode,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  }

  // Scan Bluetooth printers
  async function handleScan(silent = false) {
    if (Platform.OS === 'web') {
      if (!silent) Alert.alert('Not Supported on Web', 'Bluetooth printing requires a physical Android device.');
      return;
    }

    setIsScanning(true);
    if (!silent) setStatusMessage('Scanning for Bluetooth thermal printers...');
    try {
      const res = await scanBluetoothPrinters();
      const list = res?.all || [];
      setDevices(list);
      if (list.length === 0) {
        if (!silent) setStatusMessage('No Bluetooth printers found. Make sure your printer is turned ON and paired in phone Bluetooth settings.');
      } else {
        setStatusMessage(`Found ${list.length} Bluetooth device(s). Tap "Connect" on your printer.`);
      }
    } catch (err) {
      console.error('Scan error:', err);
      if (!silent) {
        if (err.message === 'PERMISSION_DENIED') {
          Alert.alert('Permission Denied', 'Please grant Bluetooth and Nearby Devices permission to find the printer.');
        } else {
          Alert.alert('Scan Error', 'Could not scan for Bluetooth printers. Ensure Bluetooth is ON.');
        }
        setStatusMessage('Scan failed. Please check Bluetooth.');
      }
    } finally {
      setIsScanning(false);
    }
  }

  // Connect to selected device (Native APK)
  async function handleConnect(device) {
    setIsConnecting(true);
    setStatusMessage(`Connecting to ${device.name || 'Printer'}...`);
    try {
      await connectPrinter(device.address);
      setPrinterAddress(device.address);
      setPrinterName(device.name || 'Bluetooth Printer');
      setIsConnected(true);
      updateSettings({
        printerAddress: device.address,
        printerName: device.name || 'Bluetooth Printer',
        printMode: 'bluetooth',
      });
      setStatusMessage(`Connected successfully to ${device.name}!`);
      Alert.alert('Printer Connected!', `${device.name} is now connected. Prints will come out directly with NO preview.`);
    } catch (err) {
      console.error('Connect error:', err);
      Alert.alert('Connection Failed', `Could not connect to ${device.name}. Ensure it is turned ON and within range.`);
      setStatusMessage('Connection failed.');
    } finally {
      setIsConnecting(false);
    }
  }

  // Disconnect from printer
  async function handleDisconnect() {
    try {
      await disconnectPrinter(printerAddress);
    } catch (e) {
      console.warn(e);
    }
    setPrinterAddress('');
    setPrinterName('');
    setIsConnected(false);
    updateSettings({
      printerAddress: '',
      printerName: '',
    });
    setStatusMessage('Printer disconnected.');
  }

  // Test Print (Works with RawBT or Bluetooth or System)
  async function handleTestPrint(modeOverride) {
    setIsTesting(true);
    const mode = modeOverride || printMode;
    try {
      if (mode === 'rawbt') {
        await printViaRawBT({
          shopName: shopName.trim() || 'SAMPLE HOTEL POS',
          phone: phone.trim() || '+91 98765 43210',
          address: address.trim() || 'Station Road, Food Street',
          footerMessage: footerMessage.trim() || 'Thank You Visit Again',
          paperSize,
          copies: printCopies,
          tokenNumber: parseInt(tokenCounter, 10) || 1,
          items: [
            { productName: 'Chicken Burger', variantName: 'Regular', qty: 1, price: 120, notes: ['Extra Mayo'] },
            { productName: 'French Fries', variantName: 'Large', qty: 2, price: 80, notes: ['Spicy Masala'] },
            { productName: 'Cold Drink', variantName: '300ml', qty: 1, price: 40, notes: [] },
          ],
          total: 320,
        });
        Alert.alert('Test Sent!', 'Slip RawBT ke through direct printer ko bhej di gayi hai!');
      } else {
        await printReceipt({
          shopName: shopName.trim() || 'SAMPLE HOTEL POS',
          phone: phone.trim() || '+91 98765 43210',
          address: address.trim() || 'Station Road, Food Street',
          footerMessage: footerMessage.trim() || 'Thank You Visit Again',
          paperSize,
          copies: printCopies,
          tokenNumber: parseInt(tokenCounter, 10) || 1,
          items: [
            { productName: 'Chicken Burger', variantName: 'Regular', qty: 1, price: 120, notes: ['Extra Mayo'] },
            { productName: 'French Fries', variantName: 'Large', qty: 2, price: 80, notes: ['Spicy Masala'] },
            { productName: 'Cold Drink', variantName: '300ml', qty: 1, price: 40, notes: [] },
          ],
          total: 320,
          printerAddress,
          printMode: mode,
        });

        if (mode === 'bluetooth' && printerAddress) {
          Alert.alert('Test Printed!', 'Test receipt sent directly to Bluetooth printer!');
        }
      }
    } catch (e) {
      console.error('Test print error:', e);
      if (e.message === 'RAWBT_NOT_INSTALLED') {
        Alert.alert(
          'RawBT App Chahiye',
          'Expo Go mein direct print karne ke liye Play Store se free "RawBT" app install karni padegi.',
          [
            { text: 'Download RawBT', onPress: openRawBTPlayStore },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
      } else {
        Alert.alert('Print Error', e.message || 'Failed to print test receipt.');
      }
    } finally {
      setIsTesting(false);
    }
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      {/* 1. EXPO GO / BLUETOOTH PRINTER CARD */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="print-outline" size={20} color={COLORS.accent} />
          <Text style={styles.cardTitle}>Bluetooth Printer</Text>
        </View>

        {/* Unified BT UI - works on all builds */}
        <View>
          {/* Connection Status */}
          <View style={[styles.statusBox, isConnected ? styles.statusBoxConnected : printerAddress ? styles.statusBoxWarning : styles.statusBoxDisconnected]}>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: isConnected ? COLORS.success : printerAddress ? '#F59E0B' : COLORS.danger }]} />
              <Text style={styles.statusTitle} numberOfLines={1}>
                {isConnected
                  ? (printerName || 'Connected')
                  : printerAddress
                    ? (printerName || 'Saved')
                    : 'No Printer'}
              </Text>
              {printerAddress ? (
                <TouchableOpacity style={styles.disconnectBtn} onPress={handleDisconnect} hitSlop={6}>
                  <Text style={styles.disconnectBtnText}>Disconnect</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {/* Scan Button */}
          <View style={styles.printerActionRow}>
            <TouchableOpacity
              style={[styles.scanBtn, isScanning && styles.btnDisabled]}
              onPress={() => handleScan()}
              disabled={isScanning}
              activeOpacity={0.8}
            >
              {isScanning ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Ionicons name="search" size={15} color={COLORS.white} />
              )}
              <Text style={styles.scanBtnText}>
                {isScanning ? 'Scanning...' : 'Scan Devices'}
              </Text>
            </TouchableOpacity>

            {printerAddress ? (
              <TouchableOpacity
                style={[styles.testPrintBtn, isTesting && styles.btnDisabled]}
                onPress={() => handleTestPrint('bluetooth')}
                disabled={isTesting}
                activeOpacity={0.8}
              >
                {isTesting ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <Ionicons name="print" size={15} color={COLORS.primary} />
                )}
                <Text style={styles.testPrintBtnText}>
                  {isTesting ? 'Printing...' : 'Test Print'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Device List */}
          {devices.length > 0 && (
            <View style={styles.deviceList}>
              {devices.map((dev, idx) => {
                const isSelected = printerAddress === dev.address;
                return (
                  <TouchableOpacity
                    key={dev.address || idx}
                    style={[styles.deviceItem, isSelected && styles.deviceItemActive]}
                    onPress={() => handleConnect(dev)}
                    disabled={isConnecting}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons
                        name="bluetooth"
                        size={15}
                        color={isSelected ? COLORS.accent : COLORS.textMuted}
                      />
                      <Text style={[styles.deviceName, isSelected && styles.deviceNameActive]} numberOfLines={1}>
                        {dev.name || 'Unknown Device'}
                      </Text>
                    </View>
                    <View style={[styles.connectPill, isSelected && styles.connectPillActive]}>
                      <Text style={[styles.connectPillText, isSelected && styles.connectPillTextActive]}>
                        {isSelected ? 'Connected' : 'Connect'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </View>

      {/* 2. RESTAURANT & RECEIPT DETAILS CARD */}
      <View style={[styles.card, { marginTop: 14 }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="receipt-outline" size={20} color={COLORS.primary} />
          <Text style={styles.cardTitle}>Shop Details</Text>
        </View>

        {/* Shop Name */}
        <Text style={styles.label}>Restaurant Name</Text>
        <TextInput
          style={styles.input}
          value={shopName}
          onChangeText={setShopName}
        />

        {/* Phone */}
        <Text style={styles.label}>Phone No.</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />

        {/* Address */}
        <Text style={styles.label}>Address</Text>
        <TextInput
          style={styles.input}
          value={address}
          onChangeText={setAddress}
        />

        {/* Footer Message */}
        <Text style={styles.label}>Footer Message</Text>
        <TextInput
          style={styles.input}
          value={footerMessage}
          onChangeText={setFooterMessage}
          placeholder="e.g. Thank You! Visit Again"
          placeholderTextColor="#999"
        />

        {savedSuccess && (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
            <Text style={styles.successText}>Settings saved successfully!</Text>
          </View>
        )}

        {/* Save Settings Button */}
        <View style={styles.btnRow}>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8}>
            <Ionicons name="save-outline" size={16} color={COLORS.white} />
            <Text style={styles.saveBtnText}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  container: { padding: 14 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    maxWidth: 620,
    width: '100%',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    marginBottom: 4,
    letterSpacing: 0.5,
  },

  // Status Box
  statusBox: {
    padding: 10,
    borderRadius: RADIUS,
    borderWidth: 1,
    marginBottom: 12,
  },
  statusBoxConnected: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  statusBoxWarning: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  statusBoxDisconnected: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusTitle: {
    fontSize: 12.5,
    fontWeight: '750',
    color: COLORS.text,
  },
  statusSub: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
    lineHeight: 14,
  },
  disconnectBtn: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: RADIUS - 2,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  disconnectBtnText: {
    color: COLORS.danger,
    fontSize: 10,
    fontWeight: '700',
  },

  // Action Buttons
  printerActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  scanBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  scanBtnText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 12,
  },
  testPrintBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: RADIUS,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: COLORS.card,
  },
  testPrintBtnText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  systemFallbackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 6,
    marginBottom: 8,
  },
  systemFallbackBtnText: {
    color: COLORS.textMuted,
    fontSize: 11,
    textDecorationLine: 'underline',
  },
  btnDisabled: {
    opacity: 0.65,
  },
  statusMessageText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    marginBottom: 8,
  },

  // Guide box
  guideBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: RADIUS,
    padding: 10,
    marginTop: 4,
  },
  guideTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0369A1',
    marginBottom: 4,
  },
  guideText: {
    fontSize: 10.5,
    color: '#0284C7',
    lineHeight: 16,
  },

  // Device list
  deviceList: {
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 8,
    marginBottom: 10,
  },
  deviceListHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textMuted,
    marginBottom: 6,
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS - 2,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 8,
    marginBottom: 6,
  },
  deviceItemActive: {
    borderColor: COLORS.accent,
    backgroundColor: '#FFF7ED',
  },
  deviceName: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
  },
  deviceNameActive: {
    color: COLORS.accent,
  },
  pairedBadge: {
    fontSize: 8.5,
    fontWeight: '800',
    backgroundColor: '#E0E7FF',
    color: '#3730A3',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  deviceAddress: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  connectPill: {
    backgroundColor: COLORS.primary,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: RADIUS - 2,
  },
  connectPillActive: {
    backgroundColor: COLORS.success,
  },
  connectPillText: {
    color: COLORS.white,
    fontSize: 10.5,
    fontWeight: '700',
  },
  connectPillTextActive: {
    color: COLORS.white,
  },

  // Paper Row
  paperRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  paperBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  paperBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  paperBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: COLORS.text,
  },
  paperBtnTextActive: {
    color: COLORS.white,
  },
  paperBtnSub: {
    fontSize: 9.5,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  paperBtnSubActive: {
    color: '#E0E7FF',
  },

  input: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12,
    color: COLORS.text,
    marginBottom: 10,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EDF7ED',
    padding: 8,
    borderRadius: RADIUS,
    marginBottom: 10,
  },
  successText: {
    color: COLORS.success,
    fontSize: 11.5,
    fontWeight: '600',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS,
    paddingVertical: 10,
  },
  saveBtnText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 12.5,
  },
});
