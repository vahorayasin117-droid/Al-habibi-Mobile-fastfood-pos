import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { useData } from '../../context/DataContext';
import { COLORS, RADIUS } from '../../theme';
import { getStorageSizeEstimate } from '../../utils/storage';

export default function DatabaseTab() {
  const { sales = [], archiveOldSales, exportSalesCSV, clearSales } = useData();

  const [storageInfo, setStorageInfo] = useState(null);
  const [loadingStorage, setLoadingStorage] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchStorageStats();
  }, [sales.length]);

  const fetchStorageStats = async () => {
    setLoadingStorage(true);
    try {
      const stats = await getStorageSizeEstimate();
      setStorageInfo(stats);
    } catch (e) {
      console.warn('Storage stats error:', e);
    } finally {
      setLoadingStorage(false);
    }
  };

  // Safe CSV export with sharing or print
  const handleExportCSV = async () => {
    if (sales.length === 0) {
      Alert.alert('No Sales Records', 'There are no sales records available to export.');
      return;
    }

    setExporting(true);
    try {
      const csvContent = exportSalesCSV();

      if (Platform.OS === 'web') {
        // Web direct download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `FastFood_POS_Sales_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        Alert.alert('Download Complete', 'Sales CSV backup downloaded successfully!');
      } else {
        // Mobile device: generate printable HTML or share file
        const html = `
          <html>
            <head>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
              <style>
                body { font-family: monospace; padding: 12px; }
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid #ccc; padding: 6px; font-size: 11px; text-align: left; }
                th { background-color: #f2f2f2; }
              </style>
            </head>
            <body>
              <h2>FastFood POS - Sales Backup</h2>
              <p>Generated on: ${new Date().toLocaleString('en-IN')}</p>
              <p>Total Orders: ${sales.length}</p>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Token</th>
                    <th>Total</th>
                    <th>Items</th>
                  </tr>
                </thead>
                <tbody>
                  ${sales
            .map(
              (s) => `
                    <tr>
                      <td>${new Date(s.createdAt).toLocaleDateString('en-IN')}</td>
                      <td>#${s.tokenNumber || 1}</td>
                      <td>₹${Number(s.total).toFixed(0)}</td>
                      <td>${(s.items || []).map((i) => `${i.qty}x ${i.productName}`).join(', ')}</td>
                    </tr>
                  `
            )
            .join('')}
                </tbody>
              </table>
            </body>
          </html>
        `;

        const { uri } = await Print.printToFileAsync({ html });
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
        } else {
          Alert.alert('Export Ready', `Backup report saved to:\n${uri}`);
        }
      }
    } catch (e) {
      console.error('Export error:', e);
      Alert.alert('Export Notice', e.message || 'Could not export backup.');
    } finally {
      setExporting(false);
    }
  };

  // Archive sales older than 60 days
  const handleArchive = () => {
    if (sales.length === 0) {
      Alert.alert('Empty Sales', 'No sales to archive.');
      return;
    }

    Alert.alert(
      'Archive Old Sales (>60 Days)',
      'This will move completed sales older than 60 days to the local storage archive.\n\nYour active POS memory will become lighter and 100% fast!\n\nDo you want to proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive Now',
          onPress: async () => {
            setArchiving(true);
            try {
              const res = await archiveOldSales(60);
              Alert.alert(
                'Archive Finished',
                `Successfully archived ${res.archivedCount} old orders!\n\nActive orders remaining in memory: ${res.activeCount}.\nTotal orders safely archived: ${res.totalArchiveCount || res.archivedCount}.`
              );
              fetchStorageStats();
            } catch (err) {
              Alert.alert('Archive Error', err.message || 'Could not archive.');
            } finally {
              setArchiving(false);
            }
          },
        },
      ]
    );
  };

  // Safe Clear Confirmation
  const handleClearAll = () => {
    Alert.alert(
      'Reset All Sales Records?',
      'WARNING: This will permanently delete all order history from this device.\n\nOnly perform this if you are testing or starting fresh.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All Sales',
          style: 'destructive',
          onPress: () => {
            clearSales();
            Alert.alert('Cleared', 'Sales history has been reset.');
            fetchStorageStats();
          },
        },
      ]
    );
  };

  // Calculate stats
  const totalRevenue = sales.reduce((sum, s) => sum + (Number(s.total) || 0), 0);
  const oldestDate =
    sales.length > 0
      ? new Date(sales[sales.length - 1].createdAt).toLocaleDateString('en-IN')
      : 'None';
  const newestDate =
    sales.length > 0 ? new Date(sales[0].createdAt).toLocaleDateString('en-IN') : 'None';

  // Capacity evaluation
  const isHealthy = sales.length < 8000;
  const isWarning = sales.length >= 8000 && sales.length < 15000;
  const isHeavy = sales.length >= 15000;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

      {/* 2. LIVE STORAGE & DATABASE HEALTH CARD */}
      <View style={[styles.card, { marginTop: 14 }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="server-outline" size={20} color={COLORS.accent} />
          <Text style={styles.cardTitle}>Live Database & Storage Statistics</Text>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>ACTIVE ORDERS</Text>
            <Text style={[styles.statValue, { color: COLORS.primary }]}>{sales.length}</Text>
          </View>

          <View style={styles.statBox}>
            <Text style={styles.statLabel}>TOTAL REVENUE</Text>
            <Text style={[styles.statValue, { color: COLORS.success }]}>₹{totalRevenue.toFixed(0)}</Text>
          </View>

          <View style={styles.statBox}>
            <Text style={styles.statLabel}>STORAGE USED</Text>
            <Text style={[styles.statValue, { color: '#7C3AED' }]}>
              {loadingStorage ? '...' : `${storageInfo?.totalKB || 0} KB`}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <Text style={[styles.label, { marginTop: 16 }]}>DATA MANAGEMENT ACTIONS:</Text>
        <View style={styles.actionRow}>
          {/* Export CSV */}
          <TouchableOpacity
            style={styles.exportBtn}
            onPress={handleExportCSV}
            disabled={exporting}
            activeOpacity={0.8}
          >
            {exporting ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Ionicons name="download-outline" size={16} color={COLORS.white} />
            )}
            <Text style={styles.exportBtnText}>
              {exporting ? 'Exporting...' : 'Export Backup (CSV / Excel)'}
            </Text>
          </TouchableOpacity>

          {/* Archive Old Sales */}
          <TouchableOpacity
            style={styles.archiveBtn}
            onPress={handleArchive}
            disabled={archiving}
            activeOpacity={0.8}
          >
            {archiving ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Ionicons name="archive-outline" size={16} color={COLORS.white} />
            )}
            <Text style={styles.archiveBtnText}>
              {archiving ? 'Archiving...' : 'Archive Sales (>60 Days)'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Danger Zone: Clear Sales */}
        <View style={styles.dangerZone}>
          <View style={{ flex: 1 }}>
            <Text style={styles.dangerTitle}>Clear All Sales Records</Text>
          </View>
          <TouchableOpacity style={styles.dangerBtn} onPress={handleClearAll} activeOpacity={0.8}>
            <Ionicons name="trash-outline" size={14} color={COLORS.white} />
            <Text style={styles.dangerBtnText}>Reset Sales</Text>
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
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: RADIUS,
    padding: 10,
    marginBottom: 12,
  },
  infoBannerTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0369A1',
    marginBottom: 4,
  },
  infoBannerText: {
    fontSize: 11,
    color: '#0284C7',
    lineHeight: 16,
  },
  capacityNote: {
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS - 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
  },
  capacityNoteTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 4,
  },
  capacityNoteText: {
    fontSize: 10.5,
    color: COLORS.textMuted,
    lineHeight: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  statBox: {
    flex: 1,
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS - 2,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 8,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.3,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '900',
    marginVertical: 2,
  },
  statValueSmall: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.text,
    marginVertical: 4,
    textAlign: 'center',
  },
  statSub: {
    fontSize: 8.5,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  exportBtn: {
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
  exportBtnText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 11.5,
  },
  archiveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  archiveBtnText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 11.5,
  },
  dangerZone: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: RADIUS,
    padding: 10,
  },
  dangerTitle: {
    fontSize: 11.5,
    fontWeight: '750',
    color: COLORS.danger,
  },
  dangerSub: {
    fontSize: 9.5,
    color: '#991B1B',
    marginTop: 1,
  },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.danger,
    borderRadius: RADIUS - 2,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  dangerBtnText: {
    color: COLORS.white,
    fontSize: 10.5,
    fontWeight: '700',
  },
});
