import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Platform,
  PanResponder,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useData } from '../context/DataContext';
import { COLORS, RADIUS } from '../theme';
import { printReceipt } from '../utils/print';

const PERIOD_FILTERS = [
  { key: 'day', label: 'Day' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'yearly', label: 'Yearly' },
  { key: 'lifetime', label: 'Lifetime' },
  { key: 'custom', label: 'Date Range' },
];

function formatDateDisplay(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function toDateInputFormat(d) {
  const dt = d ? new Date(d) : new Date();
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function SummaryScreen({ onBack, onOpenDashboard, onOpenSetup }) {
  const { sales = [], products = [], categories = [], settings = {} } = useData();

  const [filterPeriod, setFilterPeriod] = useState('day'); // 'day' | 'yesterday' | 'weekly' | 'monthly' | 'yearly' | 'lifetime' | 'custom'
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return toDateInputFormat(d);
  });
  const [customEnd, setCustomEnd] = useState(() => toDateInputFormat(new Date()));
  const [showDateModal, setShowDateModal] = useState(false);
  const [tempStart, setTempStart] = useState(customStart);
  const [tempEnd, setTempEnd] = useState(customEnd);

  // Search & Category filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [showSoldOnly, setShowSoldOnly] = useState(false);

  // Sorting
  const [sortField, setSortField] = useState('totalRevenue'); // 'rank' | 'name' | 'category' | 'totalQty' | 'avgPrice' | 'totalRevenue' | 'percent'
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' | 'desc'

  // Expanded variant rows
  const [expandedProductId, setExpandedProductId] = useState(null);

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

  // Web Trackpad 2-finger swipe Left-to-Right listener
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      let accumX = 0;
      let wheelTimeout = null;

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

      window.addEventListener('wheel', handleWheel, { passive: true });
      return () => {
        window.removeEventListener('wheel', handleWheel);
        clearTimeout(wheelTimeout);
      };
    }
  }, [onBack]);

  // Date Filtering Logic
  const dateRangeInfo = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    switch (filterPeriod) {
      case 'day':
        return {
          start: todayStart,
          end: todayEnd,
          label: `Today (${formatDateDisplay(todayStart)})`,
        };
      case 'yesterday': {
        const yStart = new Date(todayStart);
        yStart.setDate(yStart.getDate() - 1);
        const yEnd = new Date(todayEnd);
        yEnd.setDate(yEnd.getDate() - 1);
        return {
          start: yStart,
          end: yEnd,
          label: `Yesterday (${formatDateDisplay(yStart)})`,
        };
      }
      case 'weekly': {
        const wStart = new Date(todayStart);
        wStart.setDate(wStart.getDate() - 6);
        return {
          start: wStart,
          end: todayEnd,
          label: `Last 7 Days (${formatDateDisplay(wStart)} - ${formatDateDisplay(todayEnd)})`,
        };
      }
      case 'monthly': {
        const mStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        return {
          start: mStart,
          end: todayEnd,
          label: `This Month (${formatDateDisplay(mStart)} - ${formatDateDisplay(todayEnd)})`,
        };
      }
      case 'yearly': {
        const yrStart = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
        return {
          start: yrStart,
          end: todayEnd,
          label: `This Year (${formatDateDisplay(yrStart)} - ${formatDateDisplay(todayEnd)})`,
        };
      }
      case 'lifetime':
        return {
          start: new Date(0),
          end: new Date(8640000000000000),
          label: 'Lifetime (All Time Records)',
        };
      case 'custom': {
        const cStart = new Date(customStart + 'T00:00:00');
        const cEnd = new Date(customEnd + 'T23:59:59.999');
        return {
          start: isNaN(cStart.getTime()) ? todayStart : cStart,
          end: isNaN(cEnd.getTime()) ? todayEnd : cEnd,
          label: `Custom (${formatDateDisplay(cStart)} - ${formatDateDisplay(cEnd)})`,
        };
      }
      default:
        return { start: todayStart, end: todayEnd, label: 'Today' };
    }
  }, [filterPeriod, customStart, customEnd]);

  // Filtered sales in the selected period
  const periodSales = useMemo(() => {
    const { start, end } = dateRangeInfo;
    return sales.filter((s) => {
      const saleDate = new Date(s.createdAt);
      return saleDate >= start && saleDate <= end;
    });
  }, [sales, dateRangeInfo]);

  // Category map for quick lookup
  const categoryMap = useMemo(() => {
    const map = {};
    categories.forEach((c) => {
      map[c.id] = c.name;
    });
    return map;
  }, [categories]);

  // Comprehensive Product Sales Calculation
  const { summaryTableData, grandTotalRevenue, grandTotalQty, topProduct } = useMemo(() => {
    // 1. Build map of all sales by product
    const salesMap = {};
    let totalRev = 0;
    let totalQ = 0;

    periodSales.forEach((order) => {
      (order.items || []).forEach((item) => {
        const key = item.productId || item.productName;
        if (!salesMap[key]) {
          salesMap[key] = {
            id: key,
            name: item.productName,
            categoryId: null,
            totalQty: 0,
            totalRevenue: 0,
            variantsBreakdown: {},
          };
        }
        const qty = Number(item.qty) || 1;
        const price = Number(item.price) || 0;
        const itemRev = price * qty;

        salesMap[key].totalQty += qty;
        salesMap[key].totalRevenue += itemRev;
        totalRev += itemRev;
        totalQ += qty;

        const vName = item.variantName || 'Regular';
        salesMap[key].variantsBreakdown[vName] =
          (salesMap[key].variantsBreakdown[vName] || 0) + qty;
      });
    });

    // 2. Link with full product catalogue so EVERY product in the application is accounted for
    const combinedMap = {};

    // First populate from catalog
    products.forEach((p) => {
      const salesItem = salesMap[p.id] || salesMap[p.name];
      combinedMap[p.id] = {
        id: p.id,
        name: p.name,
        categoryId: p.categoryId,
        categoryName: categoryMap[p.categoryId] || 'General',
        totalQty: salesItem ? salesItem.totalQty : 0,
        totalRevenue: salesItem ? salesItem.totalRevenue : 0,
        avgPrice:
          salesItem && salesItem.totalQty > 0
            ? Math.round(salesItem.totalRevenue / salesItem.totalQty)
            : p.variants && p.variants[0]
            ? Number(p.variants[0].price) || 0
            : 0,
        variantsBreakdown: salesItem ? salesItem.variantsBreakdown : {},
        inCatalog: true,
      };
    });

    // Also include any sales items that might have been deleted from catalog or sold as custom
    Object.values(salesMap).forEach((s) => {
      const foundInCatalog = products.find((p) => p.id === s.id || p.name === s.name);
      if (!foundInCatalog && !combinedMap[s.id]) {
        combinedMap[s.id] = {
          id: s.id,
          name: s.name,
          categoryId: null,
          categoryName: 'Uncategorized',
          totalQty: s.totalQty,
          totalRevenue: s.totalRevenue,
          avgPrice: s.totalQty > 0 ? Math.round(s.totalRevenue / s.totalQty) : 0,
          variantsBreakdown: s.variantsBreakdown,
          inCatalog: false,
        };
      }
    });

    let itemsArray = Object.values(combinedMap);

    // Calculate percentage share for each item
    itemsArray = itemsArray.map((it) => ({
      ...it,
      percentShare: totalRev > 0 ? ((it.totalRevenue / totalRev) * 100).toFixed(1) : '0.0',
    }));

    // Find top selling product
    let bestProduct = null;
    itemsArray.forEach((it) => {
      if (it.totalQty > 0 && (!bestProduct || it.totalQty > bestProduct.totalQty)) {
        bestProduct = it;
      }
    });

    return {
      summaryTableData: itemsArray,
      grandTotalRevenue: totalRev,
      grandTotalQty: totalQ,
      topProduct: bestProduct,
    };
  }, [periodSales, products, categoryMap]);

  // Filtered & Sorted Table Rows
  const processedRows = useMemo(() => {
    let rows = summaryTableData;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(query) ||
          (r.categoryName && r.categoryName.toLowerCase().includes(query))
      );
    }

    // Category filter
    if (selectedCategory !== 'ALL') {
      rows = rows.filter((r) => r.categoryId === selectedCategory);
    }

    // Sold items only filter
    if (showSoldOnly) {
      rows = rows.filter((r) => r.totalQty > 0);
    }

    // Sorting
    rows.sort((a, b) => {
      let valA, valB;
      switch (sortField) {
        case 'name':
          valA = a.name.toLowerCase();
          valB = b.name.toLowerCase();
          return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        case 'category':
          valA = (a.categoryName || '').toLowerCase();
          valB = (b.categoryName || '').toLowerCase();
          return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        case 'totalQty':
          valA = a.totalQty;
          valB = b.totalQty;
          break;
        case 'avgPrice':
          valA = a.avgPrice;
          valB = b.avgPrice;
          break;
        case 'percent':
        case 'totalRevenue':
        default:
          valA = a.totalRevenue;
          valB = b.totalRevenue;
          break;
      }
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });

    return rows;
  }, [summaryTableData, searchQuery, selectedCategory, showSoldOnly, sortField, sortOrder]);

  // Handle Sort Column Header Click
  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Quick Preset Selection in Date Modal
  const applyDatePreset = (preset) => {
    const now = new Date();
    const todayStr = toDateInputFormat(now);

    if (preset === 'today') {
      setTempStart(todayStr);
      setTempEnd(todayStr);
    } else if (preset === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yStr = toDateInputFormat(y);
      setTempStart(yStr);
      setTempEnd(yStr);
    } else if (preset === 'last7') {
      const d7 = new Date();
      d7.setDate(d7.getDate() - 6);
      setTempStart(toDateInputFormat(d7));
      setTempEnd(todayStr);
    } else if (preset === 'last30') {
      const d30 = new Date();
      d30.setDate(d30.getDate() - 29);
      setTempStart(toDateInputFormat(d30));
      setTempEnd(todayStr);
    } else if (preset === 'thisMonth') {
      const mStart = new Date(now.getFullYear(), now.getMonth(), 1);
      setTempStart(toDateInputFormat(mStart));
      setTempEnd(todayStr);
    } else if (preset === 'lastMonth') {
      const lmStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lmEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      setTempStart(toDateInputFormat(lmStart));
      setTempEnd(toDateInputFormat(lmEnd));
    }
  };

  const confirmCustomDate = () => {
    setCustomStart(tempStart);
    setCustomEnd(tempEnd);
    setFilterPeriod('custom');
    setShowDateModal(false);
  };

  // Print Summary Slip
  const handlePrintSummary = async () => {
    const soldItems = summaryTableData.filter((i) => i.totalQty > 0);
    if (soldItems.length === 0) {
      Alert.alert('No Sales', 'There are no sales to print in this selected period.');
      return;
    }

    try {
      await printReceipt({
        shopName: settings.shopName || 'SALES SUMMARY',
        phone: settings.phone || '',
        address: dateRangeInfo.label,
        footerMessage: `Generated on ${new Date().toLocaleDateString('en-IN')}`,
        paperSize: settings.paperSize || '58mm',
        tokenNumber: 0,
        copies: 1,
        items: soldItems.map((it) => ({
          productName: it.name,
          variantName: it.categoryName,
          qty: it.totalQty,
          price: it.avgPrice,
          notes: [`Rev: ₹${it.totalRevenue.toFixed(0)} (${it.percentShare}%)`],
        })),
        total: grandTotalRevenue,
        printerAddress: settings.printerAddress,
        printMode: settings.printMode || 'bluetooth',
      });
      Alert.alert('Summary Printed', 'Sales summary slip sent to thermal printer!');
    } catch (e) {
      Alert.alert('Print Notice', e.message || 'Could not print summary.');
    }
  };

  const totalFilteredUnits = processedRows.reduce((sum, r) => sum + r.totalQty, 0);
  const totalFilteredRevenue = processedRows.reduce((sum, r) => sum + r.totalRevenue, 0);
  const avgOrderBill =
    periodSales.length > 0 ? (grandTotalRevenue / periodSales.length).toFixed(0) : '0';

  return (
    <View style={styles.root} {...panResponder.panHandlers}>
      {/* Top Navigation Bar */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.8} hitSlop={8}>
            <Ionicons name="arrow-back" size={17} color={COLORS.white} />
            <Text style={styles.backText}>POS</Text>
          </TouchableOpacity>
          <View style={styles.headerDivider} />
          <Text style={styles.headerTitle}>Product Sales Summary</Text>
        </View>

        {/* Quick Actions in Header */}
        <View style={styles.headerActions}>
          {onOpenDashboard && (
            <TouchableOpacity
              onPress={onOpenDashboard}
              style={styles.headerActionBtn}
              activeOpacity={0.8}
            >
              <Ionicons name="bar-chart-outline" size={14} color={COLORS.white} />
              <Text style={styles.headerActionText}>Dashboard</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={handlePrintSummary}
            style={[styles.headerActionBtn, styles.headerPrintBtn]}
            activeOpacity={0.8}
          >
            <Ionicons name="print-outline" size={14} color={COLORS.white} />
            <Text style={styles.headerActionText}>Print Slip</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Body */}
      <View style={styles.body}>
        {/* Top Control Section: Date Filters + Compact KPI Bar */}
        <View style={styles.filterSection}>
          {/* Horizontal Date Filter Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.periodScroll}
          >
            {PERIOD_FILTERS.map((f) => {
              const isActive = filterPeriod === f.key;
              return (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.periodChip, isActive && styles.periodChipActive]}
                  onPress={() => {
                    if (f.key === 'custom') {
                      setShowDateModal(true);
                    } else {
                      setFilterPeriod(f.key);
                    }
                  }}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name={
                      f.key === 'custom'
                        ? 'calendar-outline'
                        : f.key === 'lifetime'
                        ? 'infinite-outline'
                        : 'time-outline'
                    }
                    size={12}
                    color={isActive ? COLORS.white : COLORS.textMuted}
                  />
                  <Text style={[styles.periodChipText, isActive && styles.periodChipTextActive]}>
                    {f.label}
                  </Text>
                  {isActive && f.key === 'custom' && (
                    <Ionicons name="pencil" size={10} color={COLORS.white} style={{ marginLeft: 2 }} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Active Period Label */}
          <View style={styles.periodBanner}>
            <Ionicons name="information-circle-outline" size={13} color={COLORS.primary} />
            <Text style={styles.periodBannerText} numberOfLines={1}>
              {dateRangeInfo.label}
            </Text>
          </View>
        </View>

        {/* Compact 1-Row KPI Metric Bar */}
        <View style={styles.kpiRow}>
          <View style={[styles.kpiCard, { borderLeftColor: COLORS.primary }]}>
            <Text style={styles.kpiLabel}>TOTAL REVENUE</Text>
            <View style={styles.kpiValRow}>
              <Text style={[styles.kpiValue, { color: COLORS.primary }]}>
                ₹{grandTotalRevenue.toFixed(0)}
              </Text>
            </View>
          </View>

          <View style={[styles.kpiCard, { borderLeftColor: COLORS.accent }]}>
            <Text style={styles.kpiLabel}>TOTAL SOLD</Text>
            <View style={styles.kpiValRow}>
              <Text style={[styles.kpiValue, { color: COLORS.accent }]}>{grandTotalQty}</Text>
              <Text style={styles.kpiUnit}>items</Text>
            </View>
          </View>

          <View style={[styles.kpiCard, { borderLeftColor: COLORS.success }]}>
            <Text style={styles.kpiLabel}>ORDERS / BILLS</Text>
            <View style={styles.kpiValRow}>
              <Text style={[styles.kpiValue, { color: COLORS.success }]}>
                {periodSales.length}
              </Text>
              <Text style={styles.kpiUnit}>bills</Text>
            </View>
          </View>

          <View style={[styles.kpiCard, { borderLeftColor: '#7C3AED' }]}>
            <Text style={styles.kpiLabel}>AVG ORDER</Text>
            <View style={styles.kpiValRow}>
              <Text style={[styles.kpiValue, { color: '#7C3AED' }]}>₹{avgOrderBill}</Text>
              <Text style={styles.kpiUnit}>/ bill</Text>
            </View>
          </View>

          <View style={[styles.kpiCard, { borderLeftColor: '#059669' }]}>
            <Text style={styles.kpiLabel}>TOP SELLING</Text>
            <View style={styles.kpiValRow}>
              <Text style={[styles.kpiValueSmall, { color: '#059669' }]} numberOfLines={1}>
                {topProduct ? `${topProduct.name} (${topProduct.totalQty})` : 'None'}
              </Text>
            </View>
          </View>
        </View>

        {/* Secondary Controls Bar: Search, Category Filter, Sold-Only Toggle */}
        <View style={styles.controlsBar}>
          {/* Search Input */}
          <View style={styles.searchBox}>
            <Ionicons name="search" size={13} color={COLORS.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search product or category..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={6}>
                <Ionicons name="close-circle" size={14} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Category Filter Scroll */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
            <TouchableOpacity
              style={[styles.catFilterChip, selectedCategory === 'ALL' && styles.catFilterChipActive]}
              onPress={() => setSelectedCategory('ALL')}
            >
              <Text
                style={[
                  styles.catFilterText,
                  selectedCategory === 'ALL' && styles.catFilterTextActive,
                ]}
              >
                All Categories
              </Text>
            </TouchableOpacity>

            {categories.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.catFilterChip, selectedCategory === c.id && styles.catFilterChipActive]}
                onPress={() => setSelectedCategory(c.id)}
              >
                <Text
                  style={[
                    styles.catFilterText,
                    selectedCategory === c.id && styles.catFilterTextActive,
                  ]}
                >
                  {c.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Sold Items Only Toggle */}
          <TouchableOpacity
            style={[styles.toggleBtn, showSoldOnly && styles.toggleBtnActive]}
            onPress={() => setShowSoldOnly(!showSoldOnly)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={showSoldOnly ? 'checkmark-circle' : 'ellipse-outline'}
              size={13}
              color={showSoldOnly ? COLORS.white : COLORS.textMuted}
            />
            <Text style={[styles.toggleBtnText, showSoldOnly && styles.toggleBtnTextActive]}>
              {showSoldOnly ? 'Sold Only' : 'All Products'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Space-Efficient Data Table */}
        <View style={styles.tableCard}>
          {/* Table Header Row */}
          <View style={styles.tableHeaderRow}>
            <TouchableOpacity style={styles.colRank} onPress={() => handleSort('rank')}>
              <Text style={styles.tableHeaderCol}>#</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.colName}
              onPress={() => handleSort('name')}
              activeOpacity={0.7}
            >
              <Text style={styles.tableHeaderCol}>PRODUCT NAME</Text>
              {sortField === 'name' && (
                <Ionicons
                  name={sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'}
                  size={10}
                  color={COLORS.primary}
                />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.colCategory}
              onPress={() => handleSort('category')}
              activeOpacity={0.7}
            >
              <Text style={styles.tableHeaderCol}>CATEGORY</Text>
              {sortField === 'category' && (
                <Ionicons
                  name={sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'}
                  size={10}
                  color={COLORS.primary}
                />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.colQty}
              onPress={() => handleSort('totalQty')}
              activeOpacity={0.7}
            >
              <Text style={[styles.tableHeaderCol, { textAlign: 'right' }]}>SOLD QTY</Text>
              {sortField === 'totalQty' && (
                <Ionicons
                  name={sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'}
                  size={10}
                  color={COLORS.primary}
                />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.colPrice}
              onPress={() => handleSort('avgPrice')}
              activeOpacity={0.7}
            >
              <Text style={[styles.tableHeaderCol, { textAlign: 'right' }]}>AVG PRICE</Text>
              {sortField === 'avgPrice' && (
                <Ionicons
                  name={sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'}
                  size={10}
                  color={COLORS.primary}
                />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.colRevenue}
              onPress={() => handleSort('totalRevenue')}
              activeOpacity={0.7}
            >
              <Text style={[styles.tableHeaderCol, { textAlign: 'right' }]}>TOTAL AMOUNT</Text>
              {sortField === 'totalRevenue' && (
                <Ionicons
                  name={sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'}
                  size={10}
                  color={COLORS.primary}
                />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.colPercent}
              onPress={() => handleSort('percent')}
              activeOpacity={0.7}
            >
              <Text style={[styles.tableHeaderCol, { textAlign: 'right' }]}>% SHARE</Text>
              {sortField === 'percent' && (
                <Ionicons
                  name={sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'}
                  size={10}
                  color={COLORS.primary}
                />
              )}
            </TouchableOpacity>
          </View>

          {/* Table Body Scroll */}
          <ScrollView style={styles.tableBodyScroll} showsVerticalScrollIndicator={true}>
            {processedRows.length === 0 ? (
              <View style={styles.emptyTableBox}>
                <Ionicons name="document-text-outline" size={28} color={COLORS.border} />
                <Text style={styles.emptyTableText}>No product sales records in this period.</Text>
                <Text style={styles.emptyTableSub}>Try changing date filters or search query.</Text>
              </View>
            ) : (
              processedRows.map((item, idx) => {
                const isEven = idx % 2 === 0;
                const isExpanded = expandedProductId === item.id;
                const hasVariants =
                  item.variantsBreakdown && Object.keys(item.variantsBreakdown).length > 0;
                const isSold = item.totalQty > 0;

                return (
                  <View key={item.id || idx}>
                    <TouchableOpacity
                      style={[
                        styles.tableRow,
                        isEven ? styles.tableRowEven : styles.tableRowOdd,
                        !isSold && styles.tableRowZero,
                        isExpanded && styles.tableRowExpanded,
                      ]}
                      onPress={() => {
                        if (hasVariants) {
                          setExpandedProductId(isExpanded ? null : item.id);
                        }
                      }}
                      activeOpacity={hasVariants ? 0.7 : 1}
                    >
                      {/* Rank Col */}
                      <View style={styles.colRank}>
                        <Text style={[styles.cellTextMuted, { fontWeight: '700' }]}>{idx + 1}</Text>
                      </View>

                      {/* Product Name Col */}
                      <View style={styles.colName}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Text
                            style={[
                              styles.productNameCell,
                              !isSold && { color: COLORS.textMuted },
                            ]}
                            numberOfLines={1}
                          >
                            {item.name}
                          </Text>
                          {hasVariants && (
                            <Ionicons
                              name={isExpanded ? 'chevron-up' : 'chevron-down'}
                              size={12}
                              color={COLORS.textMuted}
                            />
                          )}
                        </View>
                      </View>

                      {/* Category Col */}
                      <View style={styles.colCategory}>
                        <View style={styles.categoryBadge}>
                          <Text style={styles.categoryBadgeText} numberOfLines={1}>
                            {item.categoryName}
                          </Text>
                        </View>
                      </View>

                      {/* Sold Qty Col */}
                      <View style={styles.colQty}>
                        <View
                          style={[
                            styles.qtyPill,
                            isSold ? styles.qtyPillActive : styles.qtyPillZero,
                          ]}
                        >
                          <Text
                            style={[
                              styles.qtyPillText,
                              isSold ? styles.qtyPillTextActive : styles.qtyPillTextZero,
                            ]}
                          >
                            {item.totalQty}
                          </Text>
                        </View>
                      </View>

                      {/* Avg Price Col */}
                      <View style={styles.colPrice}>
                        <Text style={styles.priceCellText}>₹{item.avgPrice.toFixed(0)}</Text>
                      </View>

                      {/* Total Amount Generated Col */}
                      <View style={styles.colRevenue}>
                        <Text
                          style={[
                            styles.revenueCellText,
                            !isSold && { color: COLORS.textMuted },
                          ]}
                        >
                          ₹{item.totalRevenue.toFixed(0)}
                        </Text>
                      </View>

                      {/* % Share Col */}
                      <View style={styles.colPercent}>
                        <View style={styles.percentContainer}>
                          <Text style={styles.percentText}>{item.percentShare}%</Text>
                          {/* Mini Progress Bar */}
                          <View style={styles.miniBarTrack}>
                            <View
                              style={[
                                styles.miniBarFill,
                                {
                                  width: `${Math.min(100, Math.max(0, parseFloat(item.percentShare) || 0))}%`,
                                },
                              ]}
                            />
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>

                    {/* Expandable Variants Breakdown Dropdown */}
                    {isExpanded && hasVariants && (
                      <View style={styles.variantDetailRow}>
                        <Text style={styles.variantDetailTitle}>Variant Sales Breakdown:</Text>
                        <View style={styles.variantChipsContainer}>
                          {Object.entries(item.variantsBreakdown).map(([vName, vQty]) => (
                            <View key={vName} style={styles.variantChip}>
                              <Text style={styles.variantChipName}>{vName}:</Text>
                              <Text style={styles.variantChipQty}>{vQty} sold</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* Sticky Table Footer (Grand Totals Row) */}
          <View style={styles.tableFooterRow}>
            <View style={styles.colRank}>
              <Text style={styles.footerLabel}>Σ</Text>
            </View>
            <View style={styles.colName}>
              <Text style={styles.footerTitle}>TOTALS ({processedRows.length} Products)</Text>
            </View>
            <View style={styles.colCategory}>
              <Text style={styles.footerMuted}>Filtered View</Text>
            </View>
            <View style={styles.colQty}>
              <Text style={styles.footerQty}>{totalFilteredUnits} pcs</Text>
            </View>
            <View style={styles.colPrice}>
              <Text style={styles.footerMuted}>-</Text>
            </View>
            <View style={styles.colRevenue}>
              <Text style={styles.footerRevenue}>₹{totalFilteredRevenue.toFixed(0)}</Text>
            </View>
            <View style={styles.colPercent}>
              <Text style={styles.footerPercent}>
                {grandTotalRevenue > 0
                  ? ((totalFilteredRevenue / grandTotalRevenue) * 100).toFixed(0) + '%'
                  : '100%'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Date Range Modal */}
      <Modal
        visible={showDateModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="calendar" size={17} color={COLORS.primary} />
                <Text style={styles.modalTitle}>Select Custom Date Range</Text>
              </View>
              <TouchableOpacity onPress={() => setShowDateModal(false)} hitSlop={8}>
                <Ionicons name="close" size={20} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Quick Presets */}
            <Text style={styles.presetHeading}>QUICK PRESETS:</Text>
            <View style={styles.presetsGrid}>
              <TouchableOpacity
                style={styles.presetBtn}
                onPress={() => applyDatePreset('today')}
              >
                <Text style={styles.presetBtnText}>Today</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetBtn}
                onPress={() => applyDatePreset('yesterday')}
              >
                <Text style={styles.presetBtnText}>Yesterday</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetBtn}
                onPress={() => applyDatePreset('last7')}
              >
                <Text style={styles.presetBtnText}>Last 7 Days</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetBtn}
                onPress={() => applyDatePreset('last30')}
              >
                <Text style={styles.presetBtnText}>Last 30 Days</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetBtn}
                onPress={() => applyDatePreset('thisMonth')}
              >
                <Text style={styles.presetBtnText}>This Month</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetBtn}
                onPress={() => applyDatePreset('lastMonth')}
              >
                <Text style={styles.presetBtnText}>Previous Month</Text>
              </TouchableOpacity>
            </View>

            {/* Date Inputs */}
            <View style={styles.dateInputsRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.dateInputLabel}>START DATE (YYYY-MM-DD):</Text>
                <TextInput
                  style={styles.dateInput}
                  value={tempStart}
                  onChangeText={setTempStart}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <View style={{ width: 14, alignItems: 'center', justifyContent: 'center', marginTop: 14 }}>
                <Ionicons name="arrow-forward" size={15} color={COLORS.textMuted} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.dateInputLabel}>END DATE (YYYY-MM-DD):</Text>
                <TextInput
                  style={styles.dateInput}
                  value={tempEnd}
                  onChangeText={setTempEnd}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            {/* Modal Actions */}
            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowDateModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalApplyBtn} onPress={confirmCustomDate}>
                <Ionicons name="checkmark" size={16} color={COLORS.white} />
                <Text style={styles.modalApplyText}>Apply Filter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backText: {
    color: COLORS.white,
    fontSize: 11.5,
    fontWeight: '700',
  },
  headerDivider: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  headerTitle: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: RADIUS - 4,
  },
  headerPrintBtn: {
    backgroundColor: COLORS.accent,
  },
  headerActionText: {
    color: COLORS.white,
    fontSize: 10.5,
    fontWeight: '700',
  },
  body: {
    flex: 1,
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 4,
  },

  // Date Filter Strip
  filterSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 8,
  },
  periodScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  periodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 3.5,
    paddingHorizontal: 8,
    borderRadius: RADIUS - 3,
  },
  periodChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  periodChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  periodChipTextActive: {
    color: COLORS.white,
  },
  periodBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    borderWidth: 0.8,
    borderColor: '#BFDBFE',
    paddingVertical: 2.5,
    paddingHorizontal: 8,
    borderRadius: RADIUS - 4,
  },
  periodBannerText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: COLORS.primary,
  },

  // KPI Metrics Row
  kpiRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS - 3,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 3,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  kpiLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.4,
  },
  kpiValRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
    marginTop: 1,
  },
  kpiValue: {
    fontSize: 14,
    fontWeight: '900',
  },
  kpiValueSmall: {
    fontSize: 11,
    fontWeight: '800',
  },
  kpiUnit: {
    fontSize: 8.5,
    color: COLORS.textMuted,
    fontWeight: '600',
  },

  // Secondary Controls Bar
  controlsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS - 3,
    paddingHorizontal: 7,
    height: 28,
    width: 170,
    gap: 5,
  },
  searchInput: {
    flex: 1,
    fontSize: 10.5,
    color: COLORS.text,
    padding: 0,
  },
  catScroll: {
    flex: 1,
  },
  catFilterChip: {
    paddingVertical: 3.5,
    paddingHorizontal: 7,
    borderRadius: RADIUS - 4,
    backgroundColor: '#F1F5F9',
    marginRight: 4,
    borderWidth: 0.8,
    borderColor: '#E2E8F0',
  },
  catFilterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  catFilterText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  catFilterTextActive: {
    color: COLORS.white,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 3.5,
    paddingHorizontal: 8,
    borderRadius: RADIUS - 3,
    height: 28,
  },
  toggleBtnActive: {
    backgroundColor: '#334155',
    borderColor: '#334155',
  },
  toggleBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  toggleBtnTextActive: {
    color: COLORS.white,
  },

  // Space-Efficient Table
  tableCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS - 2,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1.5,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  tableHeaderCol: {
    fontSize: 9,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.3,
  },

  // Defined Column Widths - Snug and proportional
  colRank: { width: 30, alignItems: 'center' },
  colName: { flex: 2.2, flexDirection: 'row', alignItems: 'center', gap: 3, paddingRight: 6 },
  colCategory: { width: 105, paddingRight: 4 },
  colQty: { width: 75, alignItems: 'flex-end', paddingRight: 4 },
  colPrice: { width: 75, alignItems: 'flex-end', paddingRight: 4 },
  colRevenue: { width: 95, alignItems: 'flex-end', paddingRight: 4 },
  colPercent: { width: 75, alignItems: 'flex-end' },

  tableBodyScroll: {
    flex: 1,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4.5,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tableRowEven: {
    backgroundColor: '#FFFFFF',
  },
  tableRowOdd: {
    backgroundColor: '#FBFDFE',
  },
  tableRowZero: {
    opacity: 0.65,
  },
  tableRowExpanded: {
    backgroundColor: '#EFF6FF',
    borderBottomColor: '#BFDBFE',
  },

  productNameCell: {
    fontSize: 11,
    fontWeight: '750',
    color: COLORS.text,
  },
  cellTextMuted: {
    fontSize: 10,
    color: COLORS.textMuted,
  },
  categoryBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 3,
    alignSelf: 'flex-start',
  },
  categoryBadgeText: {
    fontSize: 8.5,
    fontWeight: '700',
    color: '#475569',
  },
  qtyPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 3,
    minWidth: 32,
    alignItems: 'center',
  },
  qtyPillActive: {
    backgroundColor: '#EFF6FF',
  },
  qtyPillZero: {
    backgroundColor: '#F8FAFC',
  },
  qtyPillText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  qtyPillTextActive: {
    color: COLORS.primary,
  },
  qtyPillTextZero: {
    color: '#94A3B8',
  },
  priceCellText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: COLORS.text,
  },
  revenueCellText: {
    fontSize: 11,
    fontWeight: '850',
    color: COLORS.success,
  },
  percentContainer: {
    alignItems: 'flex-end',
    width: '100%',
  },
  percentText: {
    fontSize: 9.5,
    fontWeight: '750',
    color: COLORS.text,
  },
  miniBarTrack: {
    width: 44,
    height: 3,
    backgroundColor: '#E2E8F0',
    borderRadius: 1.5,
    overflow: 'hidden',
    marginTop: 1.5,
  },
  miniBarFill: {
    height: '100%',
    backgroundColor: COLORS.accent,
  },

  // Expandable Variant Details
  variantDetailRow: {
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 4,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  variantDetailTitle: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.textMuted,
  },
  variantChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  variantChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 0.8,
    borderColor: COLORS.border,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    gap: 3,
  },
  variantChipName: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.text,
  },
  variantChipQty: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.primary,
  },

  // Table Footer Row (Sticky Grand Totals)
  tableFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderTopWidth: 1.5,
    borderTopColor: '#0F172A',
  },
  footerLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#94A3B8',
  },
  footerTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 0.3,
  },
  footerMuted: {
    fontSize: 9,
    color: '#94A3B8',
    textAlign: 'right',
  },
  footerQty: {
    fontSize: 11,
    fontWeight: '900',
    color: '#38BDF8',
    textAlign: 'right',
  },
  footerRevenue: {
    fontSize: 12,
    fontWeight: '900',
    color: '#4ADE80',
    textAlign: 'right',
  },
  footerPercent: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.white,
    textAlign: 'right',
  },

  // Empty State
  emptyTableBox: {
    paddingVertical: 36,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  emptyTableText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: COLORS.text,
  },
  emptyTableSub: {
    fontSize: 10,
    color: COLORS.textMuted,
  },

  // Date Range Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    width: 380,
    maxWidth: '95%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
  },
  presetHeading: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.textMuted,
    marginBottom: 5,
    letterSpacing: 0.4,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginBottom: 12,
  },
  presetBtn: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: RADIUS - 4,
    borderWidth: 0.8,
    borderColor: '#CBD5E1',
  },
  presetBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.text,
  },
  dateInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  dateInputLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    color: COLORS.textMuted,
    marginBottom: 3,
  },
  dateInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS - 3,
    paddingHorizontal: 8,
    paddingVertical: 5,
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  modalCancelBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: RADIUS - 3,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalCancelText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  modalApplyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: RADIUS - 3,
  },
  modalApplyText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.white,
  },
});
