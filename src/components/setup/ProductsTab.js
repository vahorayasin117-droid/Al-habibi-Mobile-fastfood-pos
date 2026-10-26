import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useData } from '../../context/DataContext';
import { COLORS, RADIUS } from '../../theme';
import { genId } from '../../utils/id';

export default function ProductsTab() {
  const { categories, products, addProduct, updateProduct, deleteProduct } = useData();
  const [activeCat, setActiveCat] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [pname, setPname] = useState('');
  const [variants, setVariants] = useState([{ id: genId(), name: '', price: '' }]);

  useEffect(() => {
    if (!activeCat && categories.length) setActiveCat(categories[0].id);
  }, [categories]);

  const catProducts = products.filter((p) => p.categoryId === activeCat);

  function openAdd() {
    setEditId(null);
    setPname('');
    setVariants([{ id: genId(), name: '', price: '' }]);
    setFormOpen(true);
  }

  function openEdit(p) {
    setEditId(p.id);
    setPname(p.name);
    setVariants(
      p.variants && p.variants.length
        ? p.variants.map((v) => ({ ...v, price: String(v.price) }))
        : [{ id: genId(), name: '', price: '' }]
    );
    setFormOpen(true);
  }

  function addVariantRow() {
    setVariants((v) => [...v, { id: genId(), name: '', price: '' }]);
  }

  function updateVariantField(id, field, value) {
    setVariants((v) => v.map((x) => (x.id === id ? { ...x, [field]: value } : x)));
  }

  function removeVariantRow(id) {
    setVariants((v) => v.filter((x) => x.id !== id));
  }

  function handleSave() {
    if (!pname.trim() || !activeCat) return;
    const cleanVariants = variants
      .filter((v) => v.name.trim())
      .map((v) => ({ id: v.id, name: v.name.trim(), price: parseFloat(v.price) || 0 }));
    if (editId) {
      updateProduct(editId, { name: pname.trim(), variants: cleanVariants });
    } else {
      addProduct(activeCat, pname.trim(), cleanVariants);
    }
    setFormOpen(false);
  }

  function confirmDelete(p) {
    Alert.alert('Delete Product', `Are you sure you want to delete "${p.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteProduct(p.id) },
    ]);
  }

  return (
    <View style={styles.container}>
      {categories.length === 0 ? (
        <Text style={styles.emptyText}>Please add a category from the Categories tab first</Text>
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.catTabs}
            contentContainerStyle={{ gap: 8 }}
          >
            {categories.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.catChip, activeCat === c.id && styles.catChipActive]}
                onPress={() => setActiveCat(c.id)}
              >
                <Text style={[styles.catChipText, activeCat === c.id && styles.catChipTextActive]}>
                  {c.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
            <Ionicons name="add" size={20} color={COLORS.white} />
            <Text style={styles.addBtnText}>Add Product</Text>
          </TouchableOpacity>

          <FlatList
            data={catProducts}
            keyExtractor={(i) => i.id}
            renderItem={({ item }) => (
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowText}>{item.name}</Text>
                  <Text style={styles.rowSub}>
                    {item.variants.map((v) => `${v.name} ₹${v.price}`).join('   ·   ')}
                  </Text>
                </View>
                <View style={styles.rowActions}>
                  <TouchableOpacity onPress={() => openEdit(item)} hitSlop={8}>
                    <Ionicons name="pencil" size={20} color={COLORS.textMuted} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => confirmDelete(item)} style={{ marginLeft: 18 }} hitSlop={8}>
                    <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
            ListEmptyComponent={<Text style={styles.emptyText}>No products found in this category</Text>}
          />
        </>
      )}

      {formOpen && (
        <View style={styles.formOverlay}>
          <View style={styles.formBox}>
            <ScrollView>
              <Text style={styles.formLabel}>Product Name</Text>
              <TextInput style={styles.input} value={pname} onChangeText={setPname} placeholder="e.g. Khabus" />

              <Text style={[styles.formLabel, { marginTop: 18 }]}>Variants & Price</Text>
              {variants.map((v) => (
                <View key={v.id} style={styles.variantRow}>
                  <TextInput
                    style={[styles.input, { flex: 1.4 }]}
                    placeholder="Variant (Regular)"
                    value={v.name}
                    onChangeText={(t) => updateVariantField(v.id, 'name', t)}
                  />
                  <TextInput
                    style={[styles.input, { flex: 0.8, marginLeft: 8 }]}
                    placeholder="Price"
                    keyboardType="numeric"
                    value={String(v.price)}
                    onChangeText={(t) => updateVariantField(v.id, 'price', t)}
                  />
                  <TouchableOpacity onPress={() => removeVariantRow(v.id)} style={{ marginLeft: 8 }} hitSlop={8}>
                    <Ionicons name="close-circle" size={22} color={COLORS.danger} />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity onPress={addVariantRow} style={styles.addVariantBtn}>
                <Ionicons name="add" size={16} color={COLORS.primary} />
                <Text style={styles.addVariantText}>Add Variant</Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.formFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setFormOpen(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 18 },
  catTabs: { flexGrow: 0, marginBottom: 14 },
  catChip: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  catChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  catChipText: { fontSize: 11.5, fontWeight: '600', color: COLORS.text },
  catChipTextActive: { color: COLORS.white },
  addBtn: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS,
    paddingVertical: 6,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
  },
  addBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 12 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 6,
  },
  rowText: { fontSize: 12, fontWeight: '700', color: COLORS.text },
  rowSub: { fontSize: 10.5, color: COLORS.textMuted, marginTop: 2 },
  rowActions: { flexDirection: 'row', alignItems: 'center' },
  emptyText: { color: COLORS.textMuted, fontSize: 11.5, marginTop: 8 },
  input: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    color: COLORS.text,
  },
  formOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  formBox: {
    width: '65%',
    maxHeight: '90%',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS,
    padding: 14,
  },
  formLabel: { fontSize: 12, fontWeight: '700', color: COLORS.text, marginBottom: 5 },
  variantRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  addVariantBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  addVariantText: { color: COLORS.primary, fontWeight: '600', fontSize: 11.5 },
  formFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 10 },
  cancelBtn: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: RADIUS, borderWidth: 1, borderColor: COLORS.border },
  cancelBtnText: { color: COLORS.text, fontWeight: '600', fontSize: 12 },
  saveBtn: { paddingVertical: 7, paddingHorizontal: 18, borderRadius: RADIUS, backgroundColor: COLORS.accent },
  saveBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 12 },
});
