// components/OtherProductsComponent.tsx - Fixed with Real-time Stock Management
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
// Dimensions removed — using static values for card widths
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import EmptyState from "./EmptyState";
import { SkeletonList } from "./SkeletonLoader";
import { useResponsive } from "../hooks/useResponsive";
import { ProductWithCategory, useProducts } from "../hooks/useProducts";


interface OtherProductsComponentProps {
  onAddToTransaction: (product: ProductWithCategory, quantity: number) => void;
  transactionItems?: Array<{
    id: string;
    name: string;
    quantity: number;
    type: string;
  }>;
  numColumns?: number;
}

export default function OtherProductsComponent({
  onAddToTransaction,
  transactionItems = [],
  numColumns = 2,
}: OtherProductsComponentProps) {
  const { isLandscape } = useResponsive();
  const {
    products,
    categories,
    loading,
    error,
    searchProducts,
    getProductById,
    refetch,
  } = useProducts();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductWithCategory | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [quantity, setQuantity] = useState(1);

  // Filter products berdasarkan search dan kategori — debounce 300ms
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchTerm.trim() || selectedCategory) {
        try {
          const filtered = await searchProducts(searchTerm, selectedCategory);
          setFilteredProducts(filtered);
        } catch {
          setFilteredProducts(products);
        }
      } else {
        setFilteredProducts(products);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [products, searchTerm, selectedCategory]);

  // Get quantity already in transaction for a product
  const getTransactionQuantity = (productId: string): number => {
    return transactionItems
      .filter(
        (item) =>
          item.id.startsWith(`produk_${productId}_`) &&
          item.type === "produk_lainnya"
      )
      .reduce((sum, item) => sum + item.quantity, 0);
  };

  // Get available stock (actual stock - quantity in transaction)
  const getAvailableStock = (product: ProductWithCategory): number => {
    const inTransaction = getTransactionQuantity(product.id);
    return product.stok - inTransaction;
  };

  // Check if product can be added to transaction
  const canAddToTransaction = (
    product: ProductWithCategory,
    requestedQuantity: number = 1
  ): boolean => {
    const availableStock = getAvailableStock(product);
    return availableStock >= requestedQuantity;
  };

  const handleQuickAdd = (product: ProductWithCategory) => {
    if (!canAddToTransaction(product, 1)) {
      Toast.show({
        type: "warning",
        text1: "Stok Habis",
        text2: `Stok ${product.nama} sudah habis sementara.`,
      });
      return;
    }
    onAddToTransaction(product, 1);
    setShowDetailModal(false);
  };

  // FIXED: Tambah fungsi handleAddToTransaction untuk modal (dengan quantity custom & cek stok)
  const handleAddToTransaction = () => {
    if (!selectedProduct || quantity <= 0) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Pilih quantity yang valid",
      });
      return;
    }
    if (!canAddToTransaction(selectedProduct, quantity)) {
      Toast.show({
        type: "warning",
        text1: "Stok Habis",
        text2: `Stok ${selectedProduct.nama} hanya ${getAvailableStock(
          selectedProduct
        )}. Maksimal ${getAvailableStock(selectedProduct)} item.`,
      });
      return;
    }
    onAddToTransaction(selectedProduct, quantity);
    setShowDetailModal(false);
  };

  const handleShowDetail = async (product: ProductWithCategory) => {
    // Get latest product data
    const latestProduct = await getProductById(product.id);
    if (latestProduct) {
      setSelectedProduct(latestProduct);
      setQuantity(1);
      setShowDetailModal(true);
    }
  };

  const handleAddWithQuantity = () => {
    if (!selectedProduct) return;

    if (quantity <= 0) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Jumlah minimal adalah 1",
      });
      return;
    }

    if (!canAddToTransaction(selectedProduct, quantity)) {
      Toast.show({
        type: "warning",
        text1: "Stok Tidak Cukup",
        text2: `Stok tersedia: ${getAvailableStock(selectedProduct)}`,
      });
      return;
    }

    onAddToTransaction(selectedProduct, quantity);

    Toast.show({
      type: "success",
      text1: "Berhasil",
      text2: `${quantity}x ${selectedProduct.nama} ditambahkan ke transaksi`,
    });

    setShowDetailModal(false);
    setSelectedProduct(null);
    setQuantity(1);
  };

  const resetFilters = () => {
    setSearchTerm("");
    setSelectedCategory("");
  };

  const getStockBadgeColor = (availableStock: number, totalStock: number) => {
    if (availableStock === 0) return "#EF4444"; // Red - habis
    if (availableStock <= totalStock * 0.2) return "#F59E0B"; // Orange - hampir habis
    return "#10B981"; // Green - aman
  };

  const getStockBadgeText = (availableStock: number, totalStock: number) => {
    if (availableStock === 0) return "Habis";
    if (availableStock <= totalStock * 0.2) return `Tersisa ${availableStock}`;
    return `Stok: ${availableStock}`;
  };

  // Render product card
  const renderProductCard = (product: ProductWithCategory) => {
    const availableStock = getAvailableStock(product);
    const inTransaction = getTransactionQuantity(product.id);
    const stockColor = getStockBadgeColor(availableStock, product.stok);
    const stockText = getStockBadgeText(availableStock, product.stok);
    const compact = isLandscape;
    const cardWidth = numColumns === 4 ? "23%" : numColumns === 3 ? "31%" : "48%";

    return (
      <View key={product.id} style={[styles.productCard, { width: cardWidth }, compact && { padding: 7, minHeight: 180 }]}>
        {/* In Transaction Badge */}
        {inTransaction > 0 && (
          <View style={styles.inTransactionBadge}>
            <Ionicons name="cart" size={10} color="white" />
            <Text style={styles.inTransactionText}>
              {inTransaction} di keranjang
            </Text>
          </View>
        )}

        {/* Product Image */}
        <TouchableOpacity
          style={[styles.productImage, compact && { height: 70 }]}
          onPress={() => handleShowDetail(product)}
          activeOpacity={0.7}>
          {product.gambarPath ? (
            <Image
              source={{ uri: product.gambarPath }}
              style={styles.productImageView}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="cube" size={compact ? 22 : 30} color="#9CA3AF" />
            </View>
          )}
        </TouchableOpacity>

        {/* Product Info */}
        <View style={[styles.productInfo, compact && { gap: 2 }]}>
          <Text style={[styles.productName, compact && { fontSize: 11 }]} numberOfLines={2}>
            {product.nama}
          </Text>
          <Text style={[styles.productCategory, compact && { fontSize: 10 }]} numberOfLines={1}>
            {product.kategoriNama || "-"}
          </Text>
          <Text style={[styles.productPrice, compact && { fontSize: 12 }]}>
            Rp {product.harga.toLocaleString("id-ID")}
          </Text>

          {/* Stock Badge */}
          <View style={[styles.stockBadge, { backgroundColor: stockColor }, compact && { paddingVertical: 2, paddingHorizontal: 5 }]}>
            <Text style={[styles.stockText, compact && { fontSize: 9 }]}>{stockText}</Text>
          </View>

          {/* Action Buttons */}
          <View style={[styles.productActions, compact && { marginTop: 4 }]}>
            <TouchableOpacity
              style={styles.detailButton}
              onPress={() => handleShowDetail(product)}>
              <Ionicons name="information-circle" size={compact ? 14 : 16} color="#6B7280" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.addButton,
                availableStock === 0 && styles.addButtonDisabled,
                compact && { paddingVertical: 4, paddingHorizontal: 8 },
              ]}
              onPress={() => handleQuickAdd(product)}
              disabled={availableStock === 0}>
              <Ionicons name="add" size={compact ? 13 : 16} color="white" />
              <Text style={[styles.addButtonText, compact && { fontSize: 10 }]}>
                {availableStock > 0 ? "Tambah" : "Habis"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.section, isLandscape && { padding: 10, marginBottom: 10 }]}>
        <Text style={[styles.sectionTitle, isLandscape && { fontSize: 13 }]}>Produk Lainnya</Text>
        <SkeletonList count={4} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.section, isLandscape && { padding: 10, marginBottom: 10 }]}>
        <Text style={[styles.sectionTitle, isLandscape && { fontSize: 13 }]}>Produk Lainnya</Text>
        <EmptyState
          icon="alert-circle-outline"
          iconColor="#EF4444"
          title="Gagal memuat produk"
          description={error}
          actionLabel="Coba Lagi"
          onAction={refetch}
        />
      </View>
    );
  }

  return (
    <>
      <View style={[styles.section, isLandscape && { padding: 10, marginBottom: 10 }]}>
        {/* Search and Filter */}
        <View style={[styles.searchFilterContainer, isLandscape && { marginBottom: 8 }]}>
          <View style={[styles.searchContainer, isLandscape && { height: 34 }]}>
            <Ionicons
              name="search"
              size={isLandscape ? 16 : 20}
              color="#9CA3AF"
              style={styles.searchIcon}
            />
            <TextInput
              style={[styles.searchInput, isLandscape && { fontSize: 12 }]}
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholder="Cari produk..."
              placeholderTextColor="#9CA3AF"
            />
            {searchTerm.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchTerm("")}
                style={styles.clearSearchButton}>
                <Ionicons name="close-circle" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>

          {/* Category Filter */}
          {categories.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.categoryFilter}
              contentContainerStyle={styles.categoryFilterContent}>
              <TouchableOpacity
                style={[
                  styles.categoryButton,
                  selectedCategory === "" && styles.categoryButtonActive,
                ]}
                onPress={() => setSelectedCategory("")}>
                <Text
                  style={[
                    styles.categoryButtonText,
                    selectedCategory === "" && styles.categoryButtonTextActive,
                  ]}>
                  Semua
                </Text>
              </TouchableOpacity>
              {categories.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.categoryButton,
                    selectedCategory === category.id &&
                      styles.categoryButtonActive,
                  ]}
                  onPress={() => setSelectedCategory(category.id)}>
                  <Text
                    style={[
                      styles.categoryButtonText,
                      selectedCategory === category.id &&
                        styles.categoryButtonTextActive,
                    ]}>
                    {category.nama}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Results Info */}
          {(searchTerm || selectedCategory) && (
            <View style={styles.resultsInfoContainer}>
              <Text style={styles.resultsInfo}>
                Menampilkan {filteredProducts.length} dari {products.length}{" "}
                produk
                {searchTerm && ` untuk "${searchTerm}"`}
                {selectedCategory && (
                  <>
                    {" "}
                    dalam kategori "
                    {categories.find((c) => c.id === selectedCategory)?.nama}"
                  </>
                )}
              </Text>
              {(searchTerm || selectedCategory) && (
                <TouchableOpacity
                  onPress={resetFilters}
                  style={styles.resetFiltersButton}>
                  <Ionicons name="refresh" size={14} color="#2563EB" />
                  <Text style={styles.resetFiltersText}>Reset</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Products Grid */}
        {filteredProducts.length === 0 ? (
          <EmptyState
            icon="cube-outline"
            title={searchTerm || selectedCategory ? "Produk tidak ditemukan" : "Belum ada produk"}
            description={searchTerm || selectedCategory ? "Coba ubah kata kunci atau filter pencarian" : "Tambahkan produk untuk mulai berjualan"}
            actionLabel={searchTerm || selectedCategory ? "Reset Filter" : undefined}
            onAction={searchTerm || selectedCategory ? resetFilters : undefined}
          />
        ) : (
          <View style={[styles.productsGrid, isLandscape && { gap: 8 }]}>
            {filteredProducts.map(renderProductCard)}
          </View>
        )}
      </View>

      {/* Detail Modal */}
      <Modal
        visible={showDetailModal}
        animationType="slide"
        onRequestClose={() => setShowDetailModal(false)}
        presentationStyle={Platform.OS === "web" ? "pageSheet" : "formSheet"}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Detail Produk</Text>
            <TouchableOpacity
              onPress={() => setShowDetailModal(false)}
              style={styles.modalCloseButton}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {!selectedProduct ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#EA580C" />
              <Text style={styles.loadingText}>Memuat detail produk...</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.modalContent}
              showsVerticalScrollIndicator={false}>
              {selectedProduct.gambarPath ? (
                <TouchableOpacity onPress={() => setShowImageModal(true)}>
                  <Image
                    source={{ uri: selectedProduct.gambarPath }}
                    style={styles.productImage}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ) : (
                <View style={styles.placeholderImage}>
                  <Ionicons name="image-outline" size={80} color="#D1D5DB" />
                  <Text style={styles.placeholderText}>Tidak ada gambar</Text>
                </View>
              )}

              <View style={styles.infoSection}>
                <Text style={styles.productName}>{selectedProduct.nama}</Text>
                <Text style={styles.productCategory}>
                  Kategori: {selectedProduct.kategoriNama || "-"}
                </Text>
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Harga:</Text>
                  <Text style={styles.priceValue}>
                    Rp {selectedProduct.harga.toLocaleString("id-ID")}
                  </Text>
                </View>

                <View style={styles.stockRow}>
                  <Text style={styles.stockLabel}>Stok Tersedia:</Text>
                  <Text
                    style={[
                      styles.stockValue,
                      {
                        color:
                          getAvailableStock(selectedProduct) === 0
                            ? "#EF4444"
                            : "#10B981",
                      },
                    ]}>
                    {getAvailableStock(selectedProduct)} unit
                  </Text>
                </View>
              </View>


              <View style={styles.quantitySection}>
                <Text style={styles.sectionTitle}>Quantity</Text>
                <View style={styles.quantityControls}>
                  <TouchableOpacity
                    style={styles.quantityButton}
                    onPress={() => setQuantity(Math.max(1, quantity - 1))}>
                    <Ionicons name="remove" size={20} color="#EF4444" />
                  </TouchableOpacity>
                  <TextInput
                    style={styles.quantityInput}
                    value={quantity.toString()}
                    onChangeText={(text) => {
                      const num = parseInt(text) || 1;
                      const available = getAvailableStock(selectedProduct);
                      if (num > available) {
                        setQuantity(available);
                        Toast.show({
                          type: "warning",
                          text1: "Stok Max",
                          text2: `Maksimal ${available}`,
                        });
                      } else {
                        setQuantity(num);
                      }
                    }}
                    keyboardType="numeric"
                    maxLength={3}
                  />
                  <TouchableOpacity
                    style={styles.quantityButton}
                    onPress={() => {
                      const available = getAvailableStock(selectedProduct);
                      if (quantity + 1 > available) {
                        Toast.show({
                          type: "warning",
                          text1: "Stok Habis",
                          text2: `Maksimal ${available}`,
                        });
                      } else {
                        setQuantity(quantity + 1);
                      }
                    }}>
                    <Ionicons name="add" size={20} color="#10B981" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.quantityHint}>
                  Stok tersedia: {getAvailableStock(selectedProduct)} unit
                </Text>
              </View>

              <View style={styles.totalPriceSection}>
                <Text style={styles.totalPriceLabel}>Total Harga</Text>
                <Text style={styles.totalPriceValue}>
                  Rp{" "}
                  {(selectedProduct.harga * quantity).toLocaleString("id-ID")}
                </Text>
              </View>
            </ScrollView>
          )}

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowDetailModal(false)}>
              <Text style={styles.cancelButtonText}>Batal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.addToCartButton,
                !canAddToTransaction(
                  selectedProduct ?? ({ stok: 0 } as ProductWithCategory),
                  quantity
                ) && styles.addToCartButtonDisabled,
              ]}
              onPress={handleAddToTransaction}
              disabled={
                !canAddToTransaction(selectedProduct ?? ({ stok: 0 } as ProductWithCategory), quantity)
              }>
              <Ionicons name="add" size={16} color="white" />
              <Text style={styles.addToCartButtonText}>
                Tambah {quantity}x ke Transaksi
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        <Modal
          visible={showImageModal}
          transparent={true}
          onRequestClose={() => setShowImageModal(false)}>
          <View style={styles.imageModalContainer}>
            <TouchableOpacity
              style={styles.imageModalBackdrop}
              onPress={() => setShowImageModal(false)}
            />
            <View style={styles.imageModalContentWrapper}>
              <View style={styles.imageModalHeader}>
                <Text style={styles.imageModalTitle}>Gambar Produk</Text>
                <TouchableOpacity
                  onPress={() => setShowImageModal(false)}
                  style={styles.imageModalCloseButton}>
                  <Ionicons name="close" size={24} color="white" />
                </TouchableOpacity>
              </View>
              {selectedProduct?.gambarPath ? (
                <Image
                  source={{ uri: selectedProduct.gambarPath }}
                  style={styles.fullScreenImage}
                />
              ) : (
                <Text style={styles.imageModalTitle}>Tidak ada gambar</Text>
              )}
            </View>
          </View>
        </Modal>
      </Modal>

      {/* Image Modal */}
      <Modal
        visible={showImageModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowImageModal(false)}>
        <View style={styles.imageModalContainer}>
          <TouchableOpacity
            activeOpacity={1}
            style={styles.imageModalBackdrop}
            onPress={() => setShowImageModal(false)}>
            <View style={styles.imageModalContentWrapper}>
              <View style={styles.imageModalHeader}>
                <Text style={styles.imageModalTitle}>Foto Produk</Text>
                <TouchableOpacity
                  onPress={() => setShowImageModal(false)}
                  style={styles.imageModalCloseButton}>
                  <Ionicons name="close-circle" size={32} color="white" />
                </TouchableOpacity>
              </View>

              {selectedProduct?.gambarPath && (
                <Image
                  source={{ uri: selectedProduct.gambarPath }}
                  style={styles.fullScreenImage}
                  resizeMode="contain"
                />
              )}
            </View>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
  },
  notesText: {
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 20,
  },
  sectionDescription: {
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 20,
  },
  refreshButton: {
    padding: 8,
    backgroundColor: "#FEF3F2",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FED7AA",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6B7280",
  },
  errorContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  errorText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#EF4444",
    marginTop: 8,
    marginBottom: 4,
    textAlign: "center",
  },
  errorDescription: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: "#EA580C",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  retryButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "500",
  },
  searchFilterContainer: {
    marginBottom: 20,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#111827",
  },
  clearSearchButton: {
    padding: 4,
    marginLeft: 8,
  },
  categoryFilter: {
    maxHeight: 50,
  },
  categoryFilterContent: {
    paddingRight: 20,
  },
  categoryButton: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  categoryButtonActive: {
    backgroundColor: "#EA580C",
    borderColor: "#EA580C",
  },
  categoryButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
  },
  categoryButtonTextActive: {
    color: "white",
  },
  resultsInfoContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  resultsInfo: {
    fontSize: 12,
    color: "#6B7280",
    flex: 1,
    fontStyle: "italic",
  },
  resetFiltersButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#DBEAFE",
  },
  resetFiltersText: {
    fontSize: 12,
    color: "#2563EB",
    fontWeight: "500",
    marginLeft: 4,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#6B7280",
    marginTop: 16,
    marginBottom: 8,
    textAlign: "center",
  },
  emptyStateDescription: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  resetButton: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  resetButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "500",
  },
  productsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  productCard: {
    width: "48%",
    backgroundColor: "white",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    position: "relative",
  },
  inTransactionBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#EA580C",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    zIndex: 10,
    shadowColor: "#EA580C",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  inTransactionText: {
    color: "white",
    fontSize: 9,
    fontWeight: "600",
  },
  productImage: {
    width: "100%",
    height: 100,
    borderRadius: 12,
    marginBottom: 16,
  },
  placeholderImage: {
    width: "100%",
    height: 200,
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  productImageView: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 4,
  },
  productCategory: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 12,
  },
  productPrice: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#2563EB",
    textAlign: "center",
    marginBottom: 6,
  },
  stockBadge: {
    alignSelf: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginBottom: 8,
  },
  stockText: {
    fontSize: 10,
    color: "white",
    fontWeight: "500",
  },
  productActions: {
    flexDirection: "row",
    gap: 6,
  },
  detailButton: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  addButton: {
    flex: 2,
    backgroundColor: "#EA580C",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 6,
    gap: 4,
    shadowColor: "#EA580C",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  addButtonDisabled: {
    backgroundColor: "#9CA3AF",
    shadowOpacity: 0,
    elevation: 0,
  },
  addButtonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "500",
  },
  statisticsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  statisticItem: {
    alignItems: "center",
    flex: 1,
  },
  statisticValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 4,
  },
  statisticLabel: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  detailModalContainer: {
    backgroundColor: "white",
    borderRadius: 16,
    width: "100%",
    maxWidth: 400,
    maxHeight: "85%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 20,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    backgroundColor: "white",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  modalCloseButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  detailImageContainer: {
    height: 200,
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    marginBottom: 20,
    overflow: "hidden",
    position: "relative",
  },
  detailImage: {
    width: "100%",
    height: "100%",
  },
  detailImagePlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    marginTop: 8,
    color: "#9CA3AF",
    fontSize: 14,
  },
  infoSection: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  detailImagePlaceholderText: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 8,
  },
  imageExpandHint: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  imageExpandText: {
    fontSize: 10,
    color: "white",
    fontWeight: "500",
  },
  detailInfo: {
    marginBottom: 20,
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 16,
    textAlign: "center",
  },
  detailSection: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  detailSectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  detailIconLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    textAlign: "right",
  },
  quantitySection: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  quantityControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  quantityButton: {
    width: 44,
    height: 44,
    backgroundColor: "#FEF3F2",
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FED7AA",
  },
  quantityInput: {
    width: 60,
    height: 44,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  quantityHint: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 8,
    fontStyle: "italic",
  },
  totalPriceSection: {
    backgroundColor: "#EA580C", // FIXED: Warna oren
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  totalPriceLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
  totalPriceValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  priceLabel: {
    fontSize: 16,
    color: "#6B7280",
    fontWeight: "500",
  },
  priceValue: {
    fontSize: 18,
    fontWeight: "600",
    color: "#EA580C", // FIXED: Warna oren
  },
  stockRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  stockLabel: {
    fontSize: 16,
    color: "#6B7280",
    fontWeight: "500",
  },
  stockValue: {
    fontSize: 16,
    fontWeight: "600",
  },
  notesSection: {
    backgroundColor: "#F9FAFB",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    gap: 12,
    backgroundColor: "white",
  },
  cancelButton: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#6B7280",
  },
  addToCartButton: {
    flex: 2,
    backgroundColor: "#EA580C", // FIXED: Warna oren seperti tombol kelola-produk
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  addToCartButtonDisabled: {
    backgroundColor: "#9CA3AF",
  },
  addToCartButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
  imageModalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.95)",
  },
  imageModalBackdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  imageModalContentWrapper: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  imageModalHeader: {
    position: "absolute",
    top: 40,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    zIndex: 10,
  },
  imageModalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "white",
  },
  imageModalCloseButton: {
    padding: 4,
  },
  fullScreenImage: {
    width: "90%",
    height: "70%",
  },
  // Full Screen Modal (untuk Add Modal)
  fullScreenBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  fullScreenModalContainer: {
    flex: 1,
    backgroundColor: "white",
    marginTop: 50,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
  },
});
