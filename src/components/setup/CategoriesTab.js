import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useData } from '../../context/DataContext';
import { COLORS, RADIUS } from '../../theme';

export default function CategoriesTab() {
  const { categories, addCategory, updateCategory, deleteCategory } = useData();
  const [name, setName] = useState('');
  const [image, setImage] = useState('');
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editImage, setEditImage] = useState('');

  async function pickImage(onSelected) {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.6,
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        onSelected(res.assets[0].uri);
      }
    } catch (e) {
      Alert.alert('Error', 'Could not select the image.');
    }
  }

  function handleAdd() {
    const trimmed = name.trim();
    if (!trimmed) return;
    addCategory({ name: trimmed, image });
    setName('');
    setImage('');
  }

  function startEdit(cat) {
    setEditId(cat.id);
    setEditName(cat.name);
    setEditImage(cat.image || '');
  }

  function saveEdit() {
    if (editName.trim()) {
      updateCategory(editId, { name: editName.trim(), image: editImage });
    }
    setEditId(null);
    setEditName('');
    setEditImage('');
  }

  function confirmDelete(cat) {
    Alert.alert('Delete Category', `"${cat.name}" and all its products will be deleted.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteCategory(cat.id) },
    ]);
  }

  return (
    <View style={styles.container}>
      {/* Add New Category Row */}
      <View style={styles.addSection}>
        <View style={styles.addRow}>
          <TextInput
            style={styles.input}
            placeholder="Category name"
            value={name}
            onChangeText={setName}
            onSubmitEditing={handleAdd}
            returnKeyType="done"
          />

          <TouchableOpacity
            style={[styles.imgPickBtn, !!image && styles.imgPickBtnActive]}
            onPress={() => pickImage(setImage)}
            hitSlop={6}
          >
            <Ionicons
              name={image ? 'image' : 'image-outline'}
              size={18}
              color={image ? COLORS.white : COLORS.text}
            />
            <Text style={[styles.imgPickBtnText, image && styles.imgPickBtnTextActive]}>
              {image ? 'Change' : 'Photo'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.addBtn} onPress={handleAdd}>
            <Ionicons name="add" size={18} color={COLORS.white} />
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>

        {/* Thumbnail Preview if Image Selected */}
        {!!image && (
          <View style={styles.previewRow}>
            <Image source={{ uri: image }} style={styles.previewThumb} />
            <Text style={styles.previewLabel}>Image selected</Text>
            <TouchableOpacity onPress={() => setImage('')} style={styles.removeImgBtn} hitSlop={6}>
              <Ionicons name="close-circle" size={16} color={COLORS.danger} />
              <Text style={styles.removeImgText}>Remove</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Categories List */}
      <FlatList
        data={categories}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => {
          const isEditing = editId === item.id;

          return (
            <View style={styles.row}>
              {isEditing ? (
                <View style={styles.editRowContainer}>
                  <View style={styles.editInputsRow}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      value={editName}
                      onChangeText={setEditName}
                      onSubmitEditing={saveEdit}
                      autoFocus
                    />
                    <TouchableOpacity
                      style={[styles.imgPickBtn, !!editImage && styles.imgPickBtnActive]}
                      onPress={() => pickImage(setEditImage)}
                      hitSlop={6}
                    >
                      <Ionicons
                        name={editImage ? 'image' : 'image-outline'}
                        size={16}
                        color={editImage ? COLORS.white : COLORS.text}
                      />
                      <Text
                        style={[
                          styles.imgPickBtnText,
                          editImage && styles.imgPickBtnTextActive,
                        ]}
                      >
                        {editImage ? 'Change' : 'Photo'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {!!editImage && (
                    <View style={styles.previewRow}>
                      <Image source={{ uri: editImage }} style={styles.previewThumbSmall} />
                      <TouchableOpacity
                        onPress={() => setEditImage('')}
                        style={styles.removeImgBtn}
                        hitSlop={6}
                      >
                        <Ionicons name="close-circle" size={14} color={COLORS.danger} />
                        <Text style={styles.removeImgText}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.catInfoRow}>
                  {item.image ? (
                    <Image source={{ uri: item.image }} style={styles.catThumb} />
                  ) : (
                    <View style={styles.noThumbBox}>
                      <Ionicons name="restaurant-outline" size={14} color={COLORS.textMuted} />
                    </View>
                  )}
                  <Text style={styles.rowText}>{item.name}</Text>
                </View>
              )}

              <View style={styles.rowActions}>
                {isEditing ? (
                  <>
                    <TouchableOpacity onPress={saveEdit} hitSlop={8}>
                      <Ionicons name="checkmark" size={20} color={COLORS.success} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setEditId(null)}
                      style={{ marginLeft: 12 }}
                      hitSlop={8}
                    >
                      <Ionicons name="close" size={20} color={COLORS.textMuted} />
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity onPress={() => startEdit(item)} hitSlop={8}>
                      <Ionicons name="pencil" size={18} color={COLORS.textMuted} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => confirmDelete(item)}
                      style={{ marginLeft: 14 }}
                      hitSlop={8}
                    >
                      <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={<Text style={styles.emptyText}>No categories found</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10 },
  addSection: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 8,
    marginBottom: 8,
  },
  addRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS - 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
    fontSize: 11.5,
    color: COLORS.text,
  },
  imgPickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS - 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  imgPickBtnActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  imgPickBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.text,
  },
  imgPickBtnTextActive: {
    color: COLORS.white,
  },
  addBtn: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS - 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    gap: 3,
  },
  addBtnText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 11.5,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  previewThumb: {
    width: 44,
    height: 26,
    borderRadius: 4,
    backgroundColor: COLORS.bg,
  },
  previewThumbSmall: {
    width: 36,
    height: 22,
    borderRadius: 3,
    backgroundColor: COLORS.bg,
  },
  previewLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  removeImgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: 'auto',
  },
  removeImgText: {
    fontSize: 10,
    color: COLORS.danger,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS - 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginBottom: 5,
  },
  catInfoRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  catThumb: {
    width: 32,
    height: 22,
    borderRadius: 3,
    backgroundColor: COLORS.bg,
  },
  noThumbBox: {
    width: 32,
    height: 22,
    borderRadius: 3,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: COLORS.text,
    flex: 1,
  },
  editRowContainer: {
    flex: 1,
    paddingRight: 8,
  },
  editInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 8,
  },
});

