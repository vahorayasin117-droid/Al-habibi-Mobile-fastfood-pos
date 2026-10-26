import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useData } from '../context/DataContext';
import { COLORS, RADIUS } from '../theme';

export default function OrderModal({ visible, category, products = [], tags = [], onClose }) {
  const { addToCart } = useData();
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [selectedTags, setSelectedTags] = useState([]);
  const [qty, setQty] = useState(1);

  // Initialize selection whenever modal opens or category/products change
  useEffect(() => {
    if (visible) {
      if (products && products.length > 0) {
        const firstProd = products[0];
        setSelectedProduct(firstProd);
        if (firstProd.variants && firstProd.variants.length > 0) {
          setSelectedVariant(firstProd.variants[0]);
        } else {
          setSelectedVariant(null);
        }
      } else {
        setSelectedProduct(null);
        setSelectedVariant(null);
      }
      setSelectedTags([]);
      setQty(1);
    }
  }, [visible, category, products]);

  function handleSelectProduct(p) {
    setSelectedProduct(p);
    if (p.variants && p.variants.length > 0) {
      const sameVariant = selectedVariant
        ? p.variants.find((v) => v.name.toLowerCase() === selectedVariant.name.toLowerCase())
        : null;
      setSelectedVariant(sameVariant || p.variants[0]);
    } else {
      setSelectedVariant(null);
    }
  }

  function handleSelectVariant(v) {
    setSelectedVariant(v);
  }

  function toggleTag(label) {
    setSelectedTags((prev) =>
      prev.includes(label) ? prev.filter((t) => t !== label) : [...prev, label]
    );
  }

  function handleAdd() {
    if (!selectedProduct) return;
    addToCart({
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      categoryName: category ? category.name : '',
      variantId: selectedVariant ? selectedVariant.id : null,
      variantName: selectedVariant ? selectedVariant.name : '',
      price: selectedVariant ? Number(selectedVariant.price) || 0 : 0,
      notes: selectedTags,
      qty,
    });
    onClose();
  }

  if (!visible) return null;

  const currentPrice = selectedVariant ? Number(selectedVariant.price) || 0 : 0;
  const totalPrice = currentPrice * qty;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Backdrop tap to dismiss */}
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        {/* Center Modal Dialog - Flat, No Shadows, Fast */}
        <View style={styles.dialog}>
          {/* Header with Title on Left, Qty + Total + Close on Right */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {category ? category.name : 'Select Item'}
              </Text>
            </View>

            <View style={styles.headerRight}>
              {/* Qty (+ / -) in Header */}
              <View style={styles.qtyContainer}>
                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() => setQty((q) => Math.max(1, q - 1))}
                  hitSlop={6}
                >
                  <Ionicons name="remove" size={13} color={COLORS.text} />
                </TouchableOpacity>
                <Text style={styles.qtyText}>{qty}</Text>
                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() => setQty((q) => q + 1)}
                  hitSlop={6}
                >
                  <Ionicons name="add" size={13} color={COLORS.text} />
                </TouchableOpacity>
              </View>

              {/* Total Price in Header */}
              <View style={styles.headerTotalBox}>
                <Text style={styles.headerTotalLabel}>Total</Text>
                <Text style={styles.headerTotalValue}>₹{totalPrice}</Text>
              </View>

              {/* Close Button */}
              <TouchableOpacity onPress={onClose} hitSlop={10} style={styles.closeBtn}>
                <Ionicons name="close" size={16} color={COLORS.text} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Products Row */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Select Product</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.row}
              >
                {products.length === 0 ? (
                  <Text style={styles.emptyText}>No Product Found</Text>
                ) : (
                  products.map((p) => {
                    const isSelected = selectedProduct?.id === p.id;
                    return (
                      <TouchableOpacity
                        key={p.id}
                        style={[styles.chip, isSelected && styles.chipActive]}
                        onPress={() => handleSelectProduct(p)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[styles.chipText, isSelected && styles.chipTextActive]}
                          numberOfLines={1}
                        >
                          {p.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
            </View>

            {/* Variants Row - Compact horizontal pill buttons */}
            {selectedProduct &&
              selectedProduct.variants &&
              selectedProduct.variants.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Select Variant</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.row}
                  >
                    {selectedProduct.variants.map((v) => {
                      const isSelected = selectedVariant?.id === v.id;
                      return (
                        <TouchableOpacity
                          key={v.id}
                          style={[styles.variantChip, isSelected && styles.variantChipActive]}
                          onPress={() => handleSelectVariant(v)}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[styles.variantText, isSelected && styles.variantTextActive]}
                          >
                            {v.name}
                          </Text>
                          <Text
                            style={[styles.variantPrice, isSelected && styles.variantPriceActive]}
                          >
                            ₹{v.price}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

            {/* Tags / Instructions Row */}
            {tags && tags.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Add On</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.row}
                >
                  {tags.map((tag) => {
                    const isSelected = selectedTags.includes(tag.label);
                    return (
                      <TouchableOpacity
                        key={tag.id}
                        style={[styles.tagChip, isSelected && styles.tagChipActive]}
                        onPress={() => toggleTag(tag.label)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[styles.tagChipText, isSelected && styles.tagChipTextActive]}
                        >
                          {tag.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </ScrollView>

          {/* Bottom Action Footer - Tight margin */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.addBtn, !selectedProduct && styles.addBtnDisabled]}
              onPress={handleAdd}
              disabled={!selectedProduct}
              activeOpacity={0.8}
            >
              <Text style={styles.addBtnText}>
                Add to Order {totalPrice > 0 ? `(₹${totalPrice})` : ''}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 6,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  dialog: {
    width: '97%',
    maxWidth: 840,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS + 2,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 6,
    height: '92%',
    maxHeight: 480,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 5,
  },
  headerLeft: {
    flex: 1,
    paddingRight: 8,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: 0.2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTotalBox: {
    alignItems: 'flex-end',
    backgroundColor: COLORS.bg,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: RADIUS - 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerTotalLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    lineHeight: 10,
  },
  headerTotalValue: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.primary,
    lineHeight: 16,
  },
  closeBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: {
    flex: 1,
  },
  section: {
    marginBottom: 6,
  },
  sectionLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
    paddingRight: 6,
  },
  chip: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS,
    paddingVertical: 7,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 65,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
  },
  chipTextActive: {
    color: COLORS.white,
  },
  variantChip: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS,
    paddingVertical: 6,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  variantChipActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  variantText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: COLORS.text,
  },
  variantTextActive: {
    color: COLORS.white,
  },
  variantPrice: {
    fontSize: 11.5,
    fontWeight: '800',
    color: COLORS.accent,
  },
  variantPriceActive: {
    color: COLORS.white,
  },
  tagChip: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  tagChipActive: {
    backgroundColor: '#334155',
    borderColor: '#334155',
  },
  tagChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.text,
  },
  tagChipTextActive: {
    color: COLORS.white,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 11,
    paddingVertical: 4,
  },
  footer: {
    paddingTop: 6,
    marginTop: 2,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  qtyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS - 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 2,
  },
  qtyBtn: {
    width: 24,
    height: 24,
    borderRadius: RADIUS - 2,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.text,
    marginHorizontal: 7,
    minWidth: 16,
    textAlign: 'center',
  },
  addBtn: {
    width: '100%',
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS,
    paddingVertical: 9,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtnDisabled: {
    backgroundColor: '#CBD5E1',
  },
  addBtnText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '800',
  },
});
