import React, { createContext, useContext, useEffect, useState } from 'react';
import { loadData, saveData, KEYS } from '../utils/storage';
import { genId } from '../utils/id';
import { getBusinessDayKey } from '../utils/token';

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [tags, setTags] = useState([]);
  const [settings, setSettings] = useState({
    shopName: '',
    tokenCounter: 1,
    lastTokenDate: getBusinessDayKey(),
    printMode: 'bluetooth',
    paperSize: '58mm',
    printCopies: 2,
  });
  const [cart, setCart] = useState([]);
  const [sales, setSales] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const [c, p, t, s, sl, pc] = await Promise.all([
        loadData(KEYS.CATEGORIES),
        loadData(KEYS.PRODUCTS),
        loadData(KEYS.TAGS),
        loadData(KEYS.SETTINGS),
        loadData(KEYS.SALES),
        loadData(KEYS.PURCHASES),
      ]);
      if (c) setCategories(c);
      if (p) setProducts(p);
      if (t) setTags(t);
      if (s) {
        const currentKey = getBusinessDayKey();
        if (s.lastTokenDate !== currentKey) {
          s.tokenCounter = 1;
          s.lastTokenDate = currentKey;
        }
        setSettings({
          printMode: 'bluetooth',
          paperSize: '58mm',
          printCopies: s.printCopies || 2,
          ...s,
        });
      }
      if (sl) setSales(sl);
      if (pc) setPurchases(pc);
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (loaded) saveData(KEYS.CATEGORIES, categories);
  }, [categories, loaded]);
  useEffect(() => {
    if (loaded) saveData(KEYS.PRODUCTS, products);
  }, [products, loaded]);
  useEffect(() => {
    if (loaded) saveData(KEYS.TAGS, tags);
  }, [tags, loaded]);
  useEffect(() => {
    if (loaded) saveData(KEYS.SETTINGS, settings);
  }, [settings, loaded]);
  useEffect(() => {
    if (loaded) saveData(KEYS.SALES, sales, 200);
  }, [sales, loaded]);
  useEffect(() => {
    if (loaded) saveData(KEYS.PURCHASES, purchases, 200);
  }, [purchases, loaded]);

  // Archive sales older than X days to keep live memory lightweight
  const archiveOldSales = async (daysToKeep = 60) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const active = [];
    const toArchive = [];

    sales.forEach((s) => {
      if (new Date(s.createdAt) >= cutoffDate) {
        active.push(s);
      } else {
        toArchive.push(s);
      }
    });

    if (toArchive.length === 0) {
      return { archivedCount: 0, activeCount: sales.length };
    }

    // Load existing archive and merge
    const existingArchive = (await loadData(KEYS.SALES_ARCHIVE)) || [];
    const updatedArchive = [...toArchive, ...existingArchive];
    await saveData(KEYS.SALES_ARCHIVE, updatedArchive);

    // Update active state
    setSales(active);
    await saveData(KEYS.SALES, active);

    return {
      archivedCount: toArchive.length,
      activeCount: active.length,
      totalArchiveCount: updatedArchive.length,
    };
  };

  // Generate clean CSV of all sales records for tax / backup
  const exportSalesCSV = () => {
    const headers = ['Order ID', 'Date', 'Time', 'Token', 'Total Amount', 'Items Count', 'Items Detail'];
    const rows = sales.map((s) => {
      const d = new Date(s.createdAt);
      const dateStr = d.toLocaleDateString('en-IN');
      const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      const itemsDetail = (s.items || [])
        .map((it) => `${it.qty}x ${it.productName}${it.variantName ? `(${it.variantName})` : ''}`)
        .join('; ');

      return [
        `"${s.id}"`,
        `"${dateStr}"`,
        `"${timeStr}"`,
        `"#${s.tokenNumber || 1}"`,
        `"${Number(s.total).toFixed(0)}"`,
        `"${(s.items || []).length}"`,
        `"${itemsDetail.replace(/"/g, '""')}"`,
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  };

  // Categories
  const addCategory = (nameOrObj, image = '') => {
    if (typeof nameOrObj === 'object') {
      setCategories((prev) => [...prev, { id: genId(), name: nameOrObj.name, image: nameOrObj.image || '' }]);
    } else {
      setCategories((prev) => [...prev, { id: genId(), name: nameOrObj, image }]);
    }
  };
  const updateCategory = (id, data) =>
    setCategories((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, ...(typeof data === 'string' ? { name: data } : data) } : c
      )
    );
  const deleteCategory = (id) => {
    setCategories((prev) => prev.filter((c) => c.id !== id));
    setProducts((prev) => prev.filter((p) => p.categoryId !== id));
  };

  // Products
  const addProduct = (categoryId, name, variants) =>
    setProducts((prev) => [...prev, { id: genId(), categoryId, name, variants }]);
  const updateProduct = (id, data) =>
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p)));
  const deleteProduct = (id) =>
    setProducts((prev) => prev.filter((p) => p.id !== id));

  // Tags (customer add-on instructions)
  const addTag = (label) => setTags((prev) => [...prev, { id: genId(), label }]);
  const deleteTag = (id) => setTags((prev) => prev.filter((t) => t.id !== id));

  // Cart
  const addToCart = (item) =>
    setCart((prev) => [...prev, { ...item, id: genId() }]);
  const updateCartQty = (id, qty) =>
    setCart((prev) =>
      prev.map((i) => (i.id === id ? { ...i, qty: Math.max(1, qty) } : i))
    );
  const removeFromCart = (id) =>
    setCart((prev) => prev.filter((i) => i.id !== id));
  const clearCart = () => setCart([]);

  // Sales (Orders Completed)
  const addSale = (saleData) => {
    const newSale = {
      id: genId(),
      tokenNumber: saleData.tokenNumber || 1,
      items: saleData.items || [],
      total: Number(saleData.total) || 0,
      createdAt: saleData.createdAt || new Date().toISOString(),
    };
    setSales((prev) => [newSale, ...prev]);
  };
  const deleteSale = (id) =>
    setSales((prev) => prev.filter((s) => s.id !== id));
  const clearSales = () => setSales([]);

  // Purchases (Stock & Expenses)
  const addPurchase = ({ title, amount, category, notes, date }) => {
    const newPurchase = {
      id: genId(),
      title: title || 'General Purchase',
      amount: Number(amount) || 0,
      category: category || 'Raw Materials',
      notes: notes || '',
      createdAt: date || new Date().toISOString(),
    };
    setPurchases((prev) => [newPurchase, ...prev]);
  };
  const deletePurchase = (id) =>
    setPurchases((prev) => prev.filter((p) => p.id !== id));
  const clearPurchases = () => setPurchases([]);

  const updateSettings = (data) =>
    setSettings((prev) => ({ ...prev, ...data }));

  return (
    <DataContext.Provider
      value={{
        categories,
        products,
        tags,
        settings,
        cart,
        sales,
        purchases,
        loaded,
        addCategory,
        updateCategory,
        deleteCategory,
        addProduct,
        updateProduct,
        deleteProduct,
        addTag,
        deleteTag,
        addToCart,
        updateCartQty,
        removeFromCart,
        clearCart,
        addSale,
        deleteSale,
        clearSales,
        archiveOldSales,
        exportSalesCSV,
        addPurchase,
        deletePurchase,
        clearPurchases,
        updateSettings,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export const useData = () => useContext(DataContext);
