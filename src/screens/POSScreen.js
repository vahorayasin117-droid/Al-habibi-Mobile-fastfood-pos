import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  PanResponder,
  ImageBackground,
} from 'react-native';
import { useData } from '../context/DataContext';
import { COLORS, RADIUS } from '../theme';
import OrderModal from '../components/OrderModal';
import CartPanel from '../components/CartPanel';

export default function POSScreen({ onOpenSetup, onOpenDashboard, onOpenSummary }) {
  const { categories, products, tags } = useData();
  const [activeCategory, setActiveCategory] = useState(null);

  // Two-Finger Gesture: Swipe Right-to-Left (←) with 2 fingers to open Dashboard
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
          // Swipe Right-to-Left (dx < -50) -> Go to Dashboard
          if (gestureState.dx < -50) {
            onOpenDashboard && onOpenDashboard();
          }
        },
      }),
    [onOpenDashboard]
  );

  // Web Trackpad & Touch Listeners for 2-finger swipe Right-to-Left
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
          // Swipe Right to Left (diff < -50)
          if (diff < -50) {
            onOpenDashboard && onOpenDashboard();
          }
          isTwoTouch = false;
        }
      };

      const handleWheel = (e) => {
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 15) {
          accumX += e.deltaX;
          clearTimeout(wheelTimeout);
          wheelTimeout = setTimeout(() => {
            // Trackpad two-finger swipe right-to-left
            if (accumX > 40) {
              onOpenDashboard && onOpenDashboard();
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
  }, [onOpenDashboard]);

  const categoryProducts = activeCategory
    ? products.filter((p) => p.categoryId === activeCategory.id)
    : [];

  return (
    <View style={styles.root} {...panResponder.panHandlers}>
      {/* Body: Left Categories Grid + Right CartPanel */}
      <View style={styles.body}>
        {/* Left Side Categories Grid */}
        <View style={styles.menuContainer}>
          <ScrollView
            contentContainerStyle={styles.grid}
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
          >
            {categories.length === 0 && (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No categories available.</Text>
                <TouchableOpacity style={styles.setupPromptBtn} onPress={onOpenSetup}>
                  <Text style={styles.setupPromptText}>Add categories from Setup</Text>
                </TouchableOpacity>
              </View>
            )}
            {categories.map((cat) => {
              const count = products.filter((p) => p.categoryId === cat.id).length;
              const hasImage = !!cat.image;

              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.catCard, hasImage && styles.catCardWithImg]}
                  activeOpacity={0.75}
                  onPress={() => setActiveCategory(cat)}
                >
                  {hasImage ? (
                    <ImageBackground
                      source={{ uri: cat.image }}
                      style={styles.catImageBg}
                      imageStyle={styles.catImageStyle}
                    >
                      <View style={styles.catDarkOverlay}>
                        <Text style={styles.catImageText} numberOfLines={2}>
                          {cat.name}
                        </Text>
                        <Text style={styles.catImageCount}>{count} items</Text>
                      </View>
                    </ImageBackground>
                  ) : (
                    <View style={styles.catNoImageContent}>
                      <Text style={styles.catText} numberOfLines={2}>
                        {cat.name}
                      </Text>
                      <Text style={styles.catCount}>{count} items</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Right Side Sidebar (Cart Panel) */}
        <CartPanel
          onOpenSetup={onOpenSetup}
          onOpenDashboard={onOpenDashboard}
          onOpenSummary={onOpenSummary}
        />
      </View>

      <OrderModal
        visible={!!activeCategory}
        category={activeCategory}
        products={categoryProducts}
        tags={tags}
        onClose={() => setActiveCategory(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  body: { flex: 1, flexDirection: 'row' },
  menuContainer: { flex: 1 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 6,
    gap: 6,
    alignContent: 'flex-start',
  },
  catCard: {
    width: 96,
    height: 52,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS - 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  catCardWithImg: {
    borderColor: 'transparent',
  },
  catImageBg: {
    width: '100%',
    height: '100%',
  },
  catImageStyle: {
    borderRadius: RADIUS - 1,
  },
  catDarkOverlay: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.46)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  catImageText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.white,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  catImageCount: {
    fontSize: 8.5,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 1,
    fontWeight: '600',
  },
  catNoImageContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  catText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },
  catCount: {
    fontSize: 8.5,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    width: '100%',
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  setupPromptBtn: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS,
  },
  setupPromptText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '600',
  },
});
