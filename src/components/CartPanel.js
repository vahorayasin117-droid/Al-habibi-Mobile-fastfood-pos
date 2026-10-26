import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  PanResponder,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useData } from '../context/DataContext';
import { COLORS, RADIUS } from '../theme';
import { printReceipt } from '../utils/print';
import { getBusinessDayKey } from '../utils/token';
import {
  isNativeDriverAvailable,
  openRawBTPlayStore,
  scanBluetoothPrinters,
} from '../utils/thermalPrinter';

const MIN_PANEL_WIDTH = 200;
const MAX_PANEL_WIDTH = 460;
const DEFAULT_PANEL_WIDTH = 210;
const EXPANDED_PANEL_WIDTH = 340;

export default function CartPanel({ onOpenSetup, onOpenDashboard, onOpenSummary }) {
  const { cart, updateCartQty, removeFromCart, clearCart, settings, updateSettings, addSale } = useData();
  const [printing, setPrinting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
  const widthRef = useRef(DEFAULT_PANEL_WIDTH);
  widthRef.current = panelWidth;
  const startWidthRef = useRef(DEFAULT_PANEL_WIDTH);

  const resizePanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          startWidthRef.current = widthRef.current;
        },
        onPanResponderMove: (evt, gestureState) => {
          // Dragging left (dx < 0) means expanding sidebar width
          const newWidth = Math.min(
            MAX_PANEL_WIDTH,
            Math.max(MIN_PANEL_WIDTH, startWidthRef.current - gestureState.dx)
          );
          setPanelWidth(newWidth);
        },
        onPanResponderRelease: (evt, gestureState) => {
          // Quick tap to toggle between compact and expanded
          if (Math.abs(gestureState.dx) < 5) {
            setPanelWidth((prev) =>
              prev > 260 ? DEFAULT_PANEL_WIDTH : EXPANDED_PANEL_WIDTH
            );
          }
        },
      }),
    []
  );

  const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0);

  async function executeDirectPrint(targetAddress) {
    const currentKey = getBusinessDayKey();
    let tokenNumber = Number(settings.tokenCounter) || 1;
    if (settings.lastTokenDate !== currentKey) {
      tokenNumber = 1;
    }

    const isNative = isNativeDriverAvailable();
    const mode = isNative ? 'bluetooth' : (settings.printMode || 'rawbt');
    const finalAddress = targetAddress || settings.printerAddress;

    await printReceipt({
      shopName: settings.shopName,
      phone: settings.phone,
      address: settings.address,
      footerMessage: settings.footerMessage,
      paperSize: settings.paperSize || '58mm',
      tokenNumber,
      items: cart,
      total,
      copies: settings.printCopies || 2,
      printerAddress: finalAddress,
      printMode: mode,
    });

    if (addSale) {
      addSale({
        tokenNumber,
        items: cart.map((it) => ({
          productId: it.productId,
          productName: it.productName,
          variantName: it.variantName,
          price: it.price,
          qty: it.qty,
          notes: it.notes,
        })),
        total,
        createdAt: new Date().toISOString(),
      });
    }

    if (updateSettings) {
      updateSettings({
        tokenCounter: tokenNumber + 1,
        lastTokenDate: currentKey,
      });
    }
    clearCart();
  }

  async function handlePrint() {
    if (cart.length === 0 || printing) return;

    setPrinting(true);
    const isNative = isNativeDriverAvailable();

    // If Bluetooth printer is already saved, print directly right away!
    if (settings.printerAddress) {
      try {
        await executeDirectPrint(settings.printerAddress);
      } catch (err) {
        console.error('Direct print error:', err);
        Alert.alert(
          'Bluetooth Print Failed',
          'Mobile printer se slip nahi nikal payi.\n\nKripya check karein:\n1. Printer ON hai aur Bluetooth range mein hai\n2. Mobile ka Bluetooth ON hai',
          [
            { text: 'Retry', onPress: () => handlePrint() },
            { text: 'Printer Settings', onPress: onOpenSetup },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
      } finally {
        setPrinting(false);
      }
      return;
    }

    // If native driver and no printer saved yet: auto-detect paired Bluetooth printers!
    if (isNative) {
      try {
        const scanRes = await scanBluetoothPrinters();
        const paired = scanRes?.paired || [];

        if (paired.length === 1) {
          // Exactly 1 paired printer: auto-connect, save & print directly!
          const chosen = paired[0];
          updateSettings({
            printerAddress: chosen.address,
            printerName: chosen.name,
            printMode: 'bluetooth',
          });
          await executeDirectPrint(chosen.address);
        } else if (paired.length > 1) {
          // Multiple paired printers: let user tap one
          setPrinting(false);
          Alert.alert(
            'Select Bluetooth Mobile Printer',
            'Apna mobile Bluetooth printer select karein taaki direct print nikal sake:',
            [
              ...paired.slice(0, 4).map((dev) => ({
                text: dev.name || 'Printer',
                onPress: async () => {
                  setPrinting(true);
                  updateSettings({
                    printerAddress: dev.address,
                    printerName: dev.name,
                    printMode: 'bluetooth',
                  });
                  try {
                    await executeDirectPrint(dev.address);
                  } catch (e) {
                    Alert.alert('Print Error', e.message || 'Printer se slip nahi nikal payi.');
                  } finally {
                    setPrinting(false);
                  }
                },
              })),
              { text: 'Settings', onPress: onOpenSetup },
              { text: 'Cancel', style: 'cancel' },
            ]
          );
          return;
        } else {
          // No paired devices found
          setPrinting(false);
          Alert.alert(
            'Bluetooth Printer Not Found',
            'Koi Bluetooth printer connect nahi hai.\n\nKripya apna mobile printer ON karein aur phone ke Bluetooth Settings mein jaakar pair karein (PIN: 0000 ya 1234).',
            [
              { text: 'Printer Settings', onPress: onOpenSetup },
              { text: 'Cancel', style: 'cancel' },
            ]
          );
          return;
        }
      } catch (scanErr) {
        console.warn('Bluetooth auto-scan error:', scanErr);
        setPrinting(false);
        Alert.alert(
          'Bluetooth Printer Required',
          'Direct print ke liye Bluetooth mobile printer connect hona zaroori hai. Kripya phone ka Bluetooth ON karein.',
          [
            { text: 'Printer Settings', onPress: onOpenSetup },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
        return;
      } finally {
        setPrinting(false);
      }
      return;
    }

    // Expo Go direct fallback (RawBT)
    try {
      await executeDirectPrint();
    } catch (e) {
      if (e.message === 'RAWBT_NOT_INSTALLED') {
        Alert.alert(
          'RawBT App Needed (Expo Go)',
          'Expo Go mein direct bina preview print ke liye Play Store se free "RawBT" app install karein.',
          [
            { text: 'Install RawBT', onPress: openRawBTPlayStore },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
      } else {
        Alert.alert(
          'Print Failed',
          e.message || 'Direct print failed. Please check printer connection.'
        );
      }
    } finally {
      setPrinting(false);
    }
  }

  function handleClear() {
    if (cart.length === 0) return;
    Alert.alert('Clear Order', 'Are you sure you want to clear the entire order?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: clearCart },
    ]);
  }

  return (
    <View style={[styles.panel, { width: panelWidth }]}>
      {/* Draggable / Slide Resizer Handle on Left Edge */}
      <View
        style={styles.resizeHandle}
        {...resizePanResponder.panHandlers}
        hitSlop={{ left: 14, right: 14, top: 0, bottom: 0 }}
      >
        <View style={styles.resizeHandleBar} />
      </View>

      {/* Invisible backdrop to close dropdown on outside tap */}
      {menuOpen && (
        <TouchableOpacity
          style={styles.dropdownBackdrop}
          activeOpacity={1}
          onPress={() => setMenuOpen(false)}
        />
      )}

      {/* Sidebar Header */}
      <View style={styles.header}>
        <View style={styles.shopInfo}>
          <Text style={styles.shopName} numberOfLines={1}>
            {settings.shopName || 'FastFood POS'}
          </Text>
          <View style={styles.shopSubRow}>
            <Text style={styles.orderBadge}>
              {cart.length} {cart.length === 1 ? 'item' : 'items'}
            </Text>
            <TouchableOpacity
              onPress={() => onOpenSetup && onOpenSetup('settings')}
              hitSlop={6}
              style={[
                styles.printerPill,
                settings.printerAddress ? styles.printerPillConnected : styles.printerPillDisconnected,
              ]}
            >
              <Ionicons
                name="bluetooth"
                size={10}
                color={settings.printerAddress ? COLORS.success : '#F59E0B'}
              />
              <Text
                style={[
                  styles.printerPillText,
                  { color: settings.printerAddress ? COLORS.success : '#F59E0B' },
                ]}
                numberOfLines={1}
              >
                {settings.printerName
                  ? settings.printerName.slice(0, 10)
                  : settings.printerAddress
                    ? 'BT Ready'
                    : 'Connect BT'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.headerActions}>
          {cart.length > 0 && (
            <TouchableOpacity onPress={handleClear} hitSlop={8} style={styles.iconBtn}>
              <Ionicons name="trash-outline" size={15} color={COLORS.danger} />
            </TouchableOpacity>
          )}

          {/* 3 Lines (Menu) Icon Button on the Right - No gray background */}
          <TouchableOpacity
            onPress={() => setMenuOpen(!menuOpen)}
            hitSlop={8}
            style={styles.menuIconBtn}
          >
            <Ionicons name="menu" size={19} color={COLORS.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Right-there Dropdown Menu directly below 3 lines - Basic & clean */}
      {menuOpen && (
        <View style={styles.dropdownMenu}>
          <TouchableOpacity
            style={styles.dropdownItem}
            activeOpacity={0.7}
            onPress={() => {
              setMenuOpen(false);
              onOpenSummary && onOpenSummary();
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="document-text-outline" size={14} color={COLORS.primary} />
              <Text style={styles.dropdownText}>Summary</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.dropdownDivider} />

          <TouchableOpacity
            style={styles.dropdownItem}
            activeOpacity={0.7}
            onPress={() => {
              setMenuOpen(false);
              onOpenDashboard && onOpenDashboard();
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="bar-chart-outline" size={14} color={COLORS.primary} />
              <Text style={styles.dropdownText}>Dashboard</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.dropdownDivider} />

          <TouchableOpacity
            style={styles.dropdownItem}
            activeOpacity={0.7}
            onPress={() => {
              setMenuOpen(false);
              onOpenSetup && onOpenSetup();
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="settings-outline" size={14} color={COLORS.primary} />
              <Text style={styles.dropdownText}>Setting</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Cart Items List */}
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {cart.length === 0 && (
          <View style={styles.emptyBox}>
            <Ionicons name="cart-outline" size={28} color={COLORS.border} />
            <Text style={styles.emptyText}>Order is empty</Text>
          </View>
        )}
        {cart.map((item) => (
          <View key={item.id} style={styles.item}>
            <View style={{ flex: 1, paddingRight: 4 }}>
              <Text style={styles.itemName} numberOfLines={1}>
                {item.productName}
                {item.variantName ? ` (${item.variantName})` : ''}
              </Text>
              {item.notes && item.notes.length > 0 && (
                <Text style={styles.itemNotes} numberOfLines={1}>
                  {item.notes.join(', ')}
                </Text>
              )}
              <Text style={styles.itemPrice}>₹{(item.price * item.qty).toFixed(0)}</Text>
            </View>
            <View style={styles.itemActions}>
              <TouchableOpacity
                style={styles.smallBtn}
                onPress={() => updateCartQty(item.id, item.qty - 1)}
                hitSlop={4}
              >
                <Ionicons name="remove" size={12} color={COLORS.white} />
              </TouchableOpacity>
              <Text style={styles.itemQty}>{item.qty}</Text>
              <TouchableOpacity
                style={styles.smallBtn}
                onPress={() => updateCartQty(item.id, item.qty + 1)}
                hitSlop={4}
              >
                <Ionicons name="add" size={12} color={COLORS.white} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => removeFromCart(item.id)}
                style={{ marginLeft: 6 }}
                hitSlop={6}
              >
                <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Cart Footer */}
      <View style={styles.footer}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>₹{total.toFixed(0)}</Text>
        </View>
        <TouchableOpacity
          style={[styles.printBtn, cart.length === 0 && styles.printBtnDisabled]}
          onPress={handlePrint}
          disabled={cart.length === 0 || printing}
        >
          <Ionicons name="print-outline" size={14} color={COLORS.white} />
          <Text style={styles.printBtnText}>{printing ? 'Printing...' : 'Print Bill'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: COLORS.card,
    borderLeftWidth: 1,
    borderLeftColor: COLORS.border,
    paddingHorizontal: 8,
    paddingVertical: 6,
    position: 'relative',
  },
  resizeHandle: {
    position: 'absolute',
    left: -7,
    top: 0,
    bottom: 0,
    width: 14,
    zIndex: 95,
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? { cursor: 'col-resize', userSelect: 'none' } : {}),
  },
  resizeHandleBar: {
    width: 3.5,
    height: 44,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    borderWidth: 0.5,
    borderColor: '#94A3B8',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 3,
  },
  shopInfo: {
    flex: 1,
    paddingRight: 4,
  },
  shopName: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.text,
  },
  shopSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 1,
  },
  orderBadge: {
    fontSize: 9,
    color: COLORS.textMuted,
  },
  printerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 0.8,
  },
  printerPillConnected: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  printerPillDisconnected: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  printerPillText: {
    fontSize: 8.5,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconBtn: {
    padding: 2,
  },
  menuIconBtn: {
    padding: 2,
    backgroundColor: 'transparent',
  },

  // Dropdown directly under 3 lines icon - Basic & clean
  dropdownBackdrop: {
    position: 'absolute',
    top: 0,
    left: -1000,
    right: 0,
    bottom: -1000,
    backgroundColor: 'transparent',
    zIndex: 90,
  },
  dropdownMenu: {
    position: 'absolute',
    top: 36,
    right: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS - 2,
    width: 120,
    zIndex: 100,
    paddingVertical: 4,
  },
  dropdownItem: {
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  dropdownText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginHorizontal: 4,
  },

  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    gap: 3,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 10.5,
    textAlign: 'center',
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F5',
  },
  itemName: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.text,
  },
  itemNotes: {
    fontSize: 8.5,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  itemPrice: {
    fontSize: 10.5,
    color: COLORS.primary,
    fontWeight: '700',
    marginTop: 1,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  smallBtn: {
    backgroundColor: COLORS.primary,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemQty: {
    fontSize: 10.5,
    fontWeight: '700',
    color: COLORS.text,
    marginHorizontal: 4,
    minWidth: 12,
    textAlign: 'center',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 5,
    marginTop: 3,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.text,
  },
  totalValue: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primary,
  },
  printBtn: {
    flexDirection: 'row',
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS - 1,
    paddingVertical: 6.5,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
  },
  printBtnDisabled: {
    backgroundColor: COLORS.border,
  },
  printBtnText: {
    color: COLORS.white,
    fontSize: 11.5,
    fontWeight: '700',
  },
});
