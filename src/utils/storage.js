import AsyncStorage from '@react-native-async-storage/async-storage';

export const KEYS = {
  CATEGORIES: '@pos_categories',
  PRODUCTS: '@pos_products',
  TAGS: '@pos_tags',
  SETTINGS: '@pos_settings',
  SALES: '@pos_sales',
  SALES_ARCHIVE: '@pos_sales_archive',
  PURCHASES: '@pos_purchases',
};

export async function loadData(key) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn(`Storage load error for ${key}:`, e);
    return null;
  }
}

let saveTimers = {};

export async function saveData(key, value, debounceMs = 0) {
  if (debounceMs > 0) {
    if (saveTimers[key]) clearTimeout(saveTimers[key]);
    return new Promise((resolve) => {
      saveTimers[key] = setTimeout(async () => {
        try {
          await AsyncStorage.setItem(key, JSON.stringify(value));
          resolve(true);
        } catch (e) {
          console.warn(`Storage write error for ${key}:`, e);
          resolve(false);
        }
      }, debounceMs);
    });
  }

  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.warn(`Storage direct write error for ${key}:`, e);
    return false;
  }
}

export async function getStorageSizeEstimate() {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const pairs = await AsyncStorage.multiGet(allKeys);
    let totalBytes = 0;
    const breakdown = {};

    pairs.forEach(([k, v]) => {
      const bytes = (k ? k.length : 0) + (v ? v.length : 0);
      totalBytes += bytes;
      breakdown[k] = bytes;
    });

    return {
      totalBytes,
      totalKB: (totalBytes / 1024).toFixed(1),
      totalMB: (totalBytes / (1024 * 1024)).toFixed(2),
      breakdown,
    };
  } catch (e) {
    return { totalBytes: 0, totalKB: '0', totalMB: '0', breakdown: {} };
  }
}
