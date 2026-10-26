import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import CategoriesTab from '../components/setup/CategoriesTab';
import ProductsTab from '../components/setup/ProductsTab';
import TagsTab from '../components/setup/TagsTab';
import SettingsTab from '../components/setup/SettingsTab';

const TABS = [
  { key: 'categories', icon: 'grid-outline', activeIcon: 'grid' },
  { key: 'products', icon: 'fast-food-outline', activeIcon: 'fast-food' },
  { key: 'tags', icon: 'pricetag-outline', activeIcon: 'pricetag' },
  { key: 'settings', icon: 'settings-outline', activeIcon: 'settings' },
];

export default function SetupScreen({ onBack, initialTab }) {
  const [tab, setTab] = useState(initialTab || 'categories');

  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);

  return (
    <View style={styles.root}>
      {/* Vertical Icon Sidebar on Left */}
      <View style={styles.sidebar}>
        {/* Back Button */}
        <TouchableOpacity onPress={onBack} style={styles.iconBtn} hitSlop={10} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={COLORS.textMuted} />
        </TouchableOpacity>

        <View style={styles.divider} />

        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.iconBtn, tab === t.key && styles.iconBtnActive]}
            onPress={() => setTab(t.key)}
            activeOpacity={0.7}
            hitSlop={4}
          >
            <Ionicons
              name={tab === t.key ? t.activeIcon : t.icon}
              size={20}
              color={tab === t.key ? COLORS.accent : COLORS.textMuted}
            />
          </TouchableOpacity>
        ))}
      </View>

      {/* Content Area */}
      <View style={{ flex: 1 }}>
        {tab === 'categories' && <CategoriesTab />}
        {tab === 'products' && <ProductsTab />}
        {tab === 'tags' && <TagsTab />}
        {tab === 'settings' && <SettingsTab />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
    flexDirection: 'row',
  },
  sidebar: {
    width: 44,
    backgroundColor: COLORS.card,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 8,
    gap: 4,
    ...(Platform.OS === 'web' ? {} : {}),
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBtnActive: {
    backgroundColor: COLORS.bg,
  },
  divider: {
    width: 24,
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 4,
  },
});
