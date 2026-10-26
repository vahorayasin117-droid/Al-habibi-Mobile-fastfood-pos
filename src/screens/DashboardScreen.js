import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useData } from '../context/DataContext';
import { COLORS, RADIUS } from '../theme';
import { formatTokenNumber } from '../utils/token';

const TABS = [
  { key: 'products', label: 'Products' },
  { key: 'orders', label: 'Orders' },
];

export default function DashboardScreen({ onBack, onOpenSummary }) {
  const { sales = [] } = useData();

  const [activeTab, setActiveTab] = useState('products');
  const [filterPeriod, setFilterPeriod] = useState('all'); // 'today' | 'all'

  // Two-Finger Gesture: Swipe Left-to-Right (→) with 2 fingers to go Back to POS
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (evt) => {
          return evt.nativeEvent.touches && evt.nativeEvent.touches.length === 2;
        },
        onMoveShouldSetPanResponder: (evt, gestureState) => {
          const isTwoFinger = evt.nativeEvent.touches && evt.nativeEvent.touches.length === 2;
          return isTwoFinger && Math.abs(gestureState.dx) > 20;
        },
        onPanResponderRelease: (evt, gestureState) => {
          if (gestureState.dx > 50) {
            onBack && onBack();
          }
        },
      }),
    [onBack]
  );

  // Web Trackpad & Touch Listeners for 2-finger swipe Left-to-Right
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      let isTwoTouch = false;
      let touchStartX = 0;
      let accumX = 0;
      let wheelTimeout = null;

      const handleTouchStart = (e) => {
        if (e.touches && e.touches.length === 2) {
          isTwoTouch = true;
          touchStartX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        } else {
          isTwoTouch = false;
        }
      };

      const handleTouchEnd = (e) => {
        if (isTwoTouch && e.changedTouches) {
          const touchEndX = e.changedTouches[0].clientX;
          const diff = touchEndX - touchStartX;
          if (diff > 50) {
            onBack && onBack();
          }
          isTwoTouch = false;
        }
      };

      const handleWheel = (e) => {
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 15) {
          accumX += e.deltaX;
          clearTimeout(wheelTimeout);
          wheelTimeout = setTimeout(() => {
            if (accumX < -40) {
              onBack && onBack();
              accumX = 0;
            }
          }, 60);
        }
      };

      window.addEventListener('touchstart', handleTouchStart, { passive: true });
      window.addEventListener('touchend', handleTouchEnd, { passive: true });
      window.addEventListener('wheel', handleWheel, { passive: true });

      return () => {
        window.removeEventListener('touchstart', handleTouchStart);
        window.removeEventListener('touchend', handleTouchEnd);
        window.removeEventListener('wheel', handleWheel);
        clearTimeout(wheelTimeout);
      };
    }
  }, [onBack]);

  // Filter sales by period
  const filteredSales = useMemo(() => {
    if (filterPeriod === 'all') return sales;
    const todayStr = new Date().toDateString();
    return sales.filter((s) => new Date(s.createdAt).toDateString() === todayStr);
  }, [sales, filterPeriod]);

  // Overall Totals
  const totalSales = useMemo(
    () => filteredSales.reduce((sum, s) => sum + (Number(s.total) || 0), 0),
    [filteredSales]
  );

  // Product-wise Sales Aggregation
  const productSalesMap = useMemo(() => {
    const map = {};
    filteredSales.forEach((order) => {
      (order.items || []).forEach((item) => {
        const key = item.productId || item.productName;
        if (!map[key]) {
          map[key] = {
            id: key,
            name: item.productName,
            totalQty: 0,
            totalRevenue: 0,
            variantsBreakdown: {},
          };
        }
        map[key].totalQty += item.qty || 1;
        map[key].totalRevenue += (Number(item.price) || 0) * (item.qty || 1);

        const vName = item.variantName || 'Standard';
        map[key].variantsBreakdown[vName] =
          (map[key].variantsBreakdown[vName] || 0) + (item.qty || 1);
      });
    });

    return Object.values(map).sort((a, b) => b.totalQty - a.totalQty);
  }, [filteredSales]);

  const totalProductsSold = useMemo(
    () => productSalesMap.reduce((sum, p) => sum + p.totalQty, 0),
    [productSalesMap]
  );

  const avgOrderValue = filteredSales.length > 0 ? (totalSales / filteredSales.length).toFixed(0) : '0';

  return (
    <View style={styles.root} {...panResponder.panHandlers}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.8} hitSlop={8}>
          <Ionicons name="arrow-back" size={17} color={COLORS.white} />
          <Text style={styles.backText}>POS</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Sales Dashboard</Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {onOpenSummary && (
            <TouchableOpacity
              onPress={onOpenSummary}
              style={styles.summaryNavBtn}
              activeOpacity={0.8}
            >
              <Ionicons name="document-text-outline" size={13} color={COLORS.white} />
              <Text style={styles.summaryNavText}>Summary</Text>
            </TouchableOpacity>
          )}

          {/* Period Filter (Today / All) */}
          <View style={styles.periodFilter}>
            <TouchableOpacity
              style={[styles.periodBtn, filterPeriod === 'today' && styles.periodBtnActive]}
              onPress={() => setFilterPeriod('today')}
            >
              <Text style={[styles.periodText, filterPeriod === 'today' && styles.periodTextActive]}>
                Today
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.periodBtn, filterPeriod === 'all' && styles.periodBtnActive]}
              onPress={() => setFilterPeriod('all')}
            >
              <Text style={[styles.periodText, filterPeriod === 'all' && styles.periodTextActive]}>
                All
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Main Body */}
      <View style={styles.body}>
        {/* Compact 1-Row KPI Bar */}
        <View style={styles.kpiRow}>
          <View style={[styles.kpiBox, { borderLeftColor: COLORS.primary }]}>
            <Text style={styles.kpiLabel}>TOTAL SALES</Text>
            <View style={styles.kpiValueRow}>
              <Text style={[styles.kpiValue, { color: COLORS.primary }]}>₹{totalSales.toFixed(0)}</Text>
              <Text style={styles.kpiSub}>({filteredSales.length})</Text>
            </View>
          </View>

          <View style={[styles.kpiBox, { borderLeftColor: COLORS.accent }]}>
            <Text style={styles.kpiLabel}>ITEMS SOLD</Text>
            <View style={styles.kpiValueRow}>
              <Text style={[styles.kpiValue, { color: COLORS.accent }]}>{totalProductsSold}</Text>
              <Text style={styles.kpiSub}>items</Text>
            </View>
          </View>

          <View style={[styles.kpiBox, { borderLeftColor: COLORS.success }]}>
            <Text style={styles.kpiLabel}>AVG ORDER</Text>
            <View style={styles.kpiValueRow}>
              <Text style={[styles.kpiValue, { color: COLORS.success }]}>₹{avgOrderValue}</Text>
              <Text style={styles.kpiSub}>/ bill</Text>
            </View>
          </View>
        </View>

        {/* Compact Segmented Tab Selector */}
        <View style={styles.tabBar}>
          {TABS.map((t) => {
            const count = t.key === 'products' ? productSalesMap.length : filteredSales.length;
            return (
              <TouchableOpacity
                key={t.key}
                style={[styles.tabBtn, activeTab === t.key && styles.tabBtnActive]}
                onPress={() => setActiveTab(t.key)}
              >
                <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>
                  {t.label} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Scrollable List Area */}
        <ScrollView style={styles.scrollList} showsVerticalScrollIndicator={false}>
          {/* TAB 1: PRODUCT SALES CARDS */}
          {activeTab === 'products' && (
            <View style={styles.listContainer}>
              {productSalesMap.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyText}>No product sales records found.</Text>
                </View>
              ) : (
                productSalesMap.map((item, idx) => {
                  const variantsText = Object.entries(item.variantsBreakdown)
                    .map(([v, count]) => `${v}: ${count}`)
                    .join('  •  ');

                  return (
                    <View key={item.id || idx} style={styles.productCard}>
                      <View style={styles.rankBadge}>
                        <Text style={styles.rankText}>#{idx + 1}</Text>
                      </View>

                      <View style={styles.productInfo}>
                        <Text style={styles.productName} numberOfLines={1}>
                          {item.name}
                        </Text>
                        {variantsText.length > 0 && (
                          <Text style={styles.productVariants} numberOfLines={1}>
                            {variantsText}
                          </Text>
                        )}
                      </View>

                      <View style={styles.productRight}>
                        <View style={styles.qtyBadge}>
                          <Text style={styles.qtyBadgeText}>{item.totalQty} sold</Text>
                        </View>
                        <Text style={styles.revenueText}>₹{item.totalRevenue.toFixed(0)}</Text>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}

          {/* TAB 2: COMPLETED ORDERS CARDS */}
          {activeTab === 'orders' && (
            <View style={styles.listContainer}>
              {filteredSales.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyText}>No order history available.</Text>
                </View>
              ) : (
                filteredSales.map((s) => {
                  const d = new Date(s.createdAt);
                  const timeFormatted = d.toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const dateFormatted = d.toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                  });

                  const itemsSummary = (s.items || [])
                    .map(
                      (it) =>
                        `${it.qty}x ${it.productName}${it.variantName ? ` (${it.variantName})` : ''}`
                    )
                    .join(', ');

                  return (
                    <View key={s.id} style={styles.orderCard}>
                      <View style={styles.orderHeaderRow}>
                        <View style={styles.tokenBadge}>
                          <Text style={styles.tokenText}>
                            #{formatTokenNumber(s.tokenNumber || 1)}
                          </Text>
                        </View>
                        <Text style={styles.orderTimeText}>
                          {dateFormatted} • {timeFormatted}
                        </Text>
                        <Text style={styles.orderTotalText}>₹{Number(s.total).toFixed(0)}</Text>
                      </View>

                      <Text style={styles.orderItemsText} numberOfLines={2}>
                        {itemsSummary}
                      </Text>
                    </View>
                  );
                })
              )}
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    height: 38,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  backText: {
    color: COLORS.white,
    fontSize: 11.5,
    fontWeight: '700',
  },
  headerTitle: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  summaryNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingVertical: 2.5,
    paddingHorizontal: 7,
    borderRadius: RADIUS - 4,
  },
  summaryNavText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '700',
  },
  periodFilter: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: RADIUS - 3,
    padding: 1.5,
  },
  periodBtn: {
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: RADIUS - 4,
  },
  periodBtnActive: {
    backgroundColor: COLORS.white,
  },
  periodText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '600',
  },
  periodTextActive: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  body: {
    flex: 1,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 4,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  kpiBox: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS - 2,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 3,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  kpiLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.4,
  },
  kpiValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 1,
  },
  kpiValue: {
    fontSize: 15,
    fontWeight: '900',
  },
  kpiSub: {
    fontSize: 9.5,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#EAEFF5',
    borderRadius: RADIUS - 2,
    padding: 2,
    marginBottom: 8,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 5,
    alignItems: 'center',
    borderRadius: RADIUS - 3,
  },
  tabBtnActive: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  tabTextActive: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  scrollList: {
    flex: 1,
  },
  listContainer: {
    paddingBottom: 16,
    gap: 6,
  },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS - 2,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  rankBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  rankText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: COLORS.primary,
  },
  productInfo: {
    flex: 1,
    paddingRight: 8,
  },
  productName: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.text,
  },
  productVariants: {
    fontSize: 9.5,
    color: COLORS.textMuted,
    marginTop: 1.5,
  },
  productRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  qtyBadge: {
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
  },
  qtyBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  revenueText: {
    fontSize: 12.5,
    fontWeight: '900',
    color: COLORS.primary,
  },
  orderCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS - 2,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  orderHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  tokenBadge: {
    backgroundColor: '#FEF3C7',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
  },
  tokenText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#B45309',
  },
  orderTimeText: {
    flex: 1,
    fontSize: 10,
    color: COLORS.textMuted,
    marginLeft: 8,
  },
  orderTotalText: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.success,
  },
  orderItemsText: {
    fontSize: 11,
    color: COLORS.text,
    lineHeight: 15,
  },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS - 2,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
});

