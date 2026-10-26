import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useData } from '../../context/DataContext';
import { COLORS, RADIUS } from '../../theme';

export default function TagsTab() {
  const { tags, addTag, deleteTag } = useData();
  const [label, setLabel] = useState('');

  function handleAdd() {
    const trimmed = label.trim();
    if (!trimmed) return;
    addTag(trimmed);
    setLabel('');
  }

  function confirmDelete(tag) {
    Alert.alert('Delete Tag', `Are you sure you want to delete "${tag.label}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteTag(tag.id) },
    ]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          placeholder="e.g. Less Cheese, Extra Sauce"
          value={label}
          onChangeText={setLabel}
          onSubmitEditing={handleAdd}
          returnKeyType="done"
        />
        <TouchableOpacity style={styles.addBtn} onPress={handleAdd}>
          <Ionicons name="add" size={20} color={COLORS.white} />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={tags}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.rowText}>{item.label}</Text>
            <TouchableOpacity onPress={() => confirmDelete(item)} hitSlop={8}>
              <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>No tags found</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10 },
  addRow: { flexDirection: 'row', marginBottom: 10, gap: 8 },
  input: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    color: COLORS.text,
  },
  addBtn: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 4,
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
    paddingVertical: 7,
    marginBottom: 6,
  },
  rowText: { fontSize: 12, fontWeight: '600', color: COLORS.text },
  emptyText: { color: COLORS.textMuted, fontSize: 11.5, marginTop: 8 },
});
