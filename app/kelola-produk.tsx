// app/kelola-produk.tsx - Complete Fixed Version with Modal Dropdown
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import BottomNavigation from "../components/BottomNavigation";
import Button from "../components/Button";
import EmptyState from "../components/EmptyState";
import { SkeletonList } from "../components/SkeletonLoader";
import { useDatabase } from "../context/DatabaseProvider";
import { useResponsive } from "../hooks/useResponsive";
import {
  CategoryData,
  ProductData,
  ProductWithCategory,
  useProducts,
} from "../hooks/useProducts";

interface ProductForm {
  nama: string;
  harga: string;
  stok: string;
  kategoriId: string;
  imageUri?: string;
}

interface CategoryForm {
  nama: string;
  deskripsi: string;
}

/**
 * Komponen Dropdown untuk kategori dengan Modal Bottom Sheet
 * Menghindari error VirtualizedList nested di ScrollView
 */
const CategoryDropdown: React.FC<{
  categories: any[];
  selectedValue: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  isOpen: boolean;
  onToggle: (isOpen: boolean) => void;
}> = ({
  categories,
  selectedValue,
  onValueChange,
  placeholder = "Pilih kategori",
  disabled = false,
  isOpen,
  onToggle,
}) => {
  const selectedCategory = categories.find((cat) => cat.id === selectedValue);

  const handleSelect = (value: string) => {
    onValueChange(value);
    setTimeout(() => {
      onToggle(false);
    }, 50);
  };

  return (
    <View style={styles.dropdownContainer}>
      <TouchableOpacity
        style={[
          styles.dropdownButton,
          disabled && styles.disabledInput,
          isOpen && styles.dropdownButtonOpen,
        ]}
        onPress={() => !disabled && onToggle(!isOpen)}
        disabled={disabled}>
        <Text
          style={[
            styles.dropdownButtonText,
            !selectedValue && styles.dropdownPlaceholder,
          ]}>
          {selectedCategory ? selectedCategory.nama : placeholder}
        </Text>
        <Ionicons
          name={isOpen ? "chevron-up" : "chevron-down"}
          size={20}
          color={disabled ? "#D1D5DB" : "#6B7280"}
        />
      </TouchableOpacity>

      {isOpen && categories.length > 0 && (
        <Modal
          visible={isOpen}
          transparent={true}
          animationType="fade"
          onRequestClose={() => onToggle(false)}>
          <TouchableOpacity
            style={styles.dropdownModalOverlay}
            activeOpacity={1}
            onPress={() => onToggle(false)}>
            <View style={styles.dropdownModalContent}>
              <View style={styles.dropdownModalHeader}>
                <Text style={styles.dropdownModalTitle}>{placeholder}</Text>
                <TouchableOpacity onPress={() => onToggle(false)}>
                  <Ionicons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.dropdownModalList}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}>
                {categories.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    activeOpacity={0.7}
                    style={[
                      styles.dropdownModalItem,
                      selectedValue === item.id &&
                        styles.dropdownModalItemSelected,
                    ]}
                    onPress={() => handleSelect(item.id)}>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.dropdownModalItemText,
                          selectedValue === item.id &&
                            styles.dropdownModalItemTextSelected,
                        ]}>
                        {item.nama}
                      </Text>
                      {item.deskripsi && (
                        <Text style={styles.dropdownItemDescription}>
                          {item.deskripsi}
                        </Text>
                      )}
                    </View>
                    {selectedValue === item.id && (
                      <Ionicons name="checkmark" size={20} color="#EA580C" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
};

/**
 * Component untuk Category List Modal
 * Menampilkan semua kategori dengan aksi edit dan hapus
 */
const CategoryListModal: React.FC<{
  visible: boolean;
  categories: any[];
  onClose: () => void;
  onEdit: (category: any) => void;
  onDelete: (id: string, nama: string) => void;
  onAdd: () => void;
}> = ({ visible, categories, onClose, onEdit, onDelete, onAdd }) => {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Kelola Kategori</Text>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
            <Ionicons name="close" size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>

        <View style={styles.modalContent}>
          <View style={styles.addButtonContainer}>
            <Button
              title="Tambah Kategori"
              onPress={onAdd}
              icon="add"
              size="small"
            />
          </View>

          <Text style={styles.sectionTitle}>
            Kategori ({categories.length})
          </Text>

          {categories.length === 0 ? (
            <View style={styles.emptyCategory}>
              <Ionicons name="folder-outline" size={48} color="#9CA3AF" />
              <Text style={styles.emptyCategoryText}>Belum ada kategori</Text>
              <Text style={styles.emptyCategoryDescription}>
                Tambahkan kategori pertama untuk mengelompokkan produk Anda
              </Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {categories.map((category) => (
                <View key={category.id} style={styles.categoryItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.categoryItemName}>{category.nama}</Text>
                    {category.deskripsi ? (
                      <Text style={styles.categoryItemDesc}>
                        {category.deskripsi}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.categoryItemActions}>
                    <TouchableOpacity
                      onPress={() => onEdit(category)}
                      style={styles.categoryEditButton}>
                      <Ionicons name="create" size={16} color="#2563EB" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => onDelete(category.id, category.nama)}
                      style={styles.categoryDeleteButton}>
                      <Ionicons name="trash" size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

export default function KelolaProdukScreen() {
  const insets = useSafeAreaInsets();
  const { isInitialized } = useDatabase();
  const {
    products,
    categories,
    loading,
    error,
    addProduct,
    updateProduct,
    deleteProduct,
    addCategory,
    updateCategory,
    deleteCategory,
    searchProducts,
    refetch,
  } = useProducts();

  // State management
  const [filteredProducts, setFilteredProducts] = useState<
    ProductWithCategory[]
  >([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showCategoryListModal, setShowCategoryListModal] = useState(false);
  const [editingProduct, setEditingProduct] =
    useState<ProductWithCategory | null>(null);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const [productForm, setProductForm] = useState<ProductForm>({
    nama: "",
    harga: "",
    stok: "",
    kategoriId: "",
  });

  const [categoryForm, setCategoryForm] = useState<CategoryForm>({
    nama: "",
    deskripsi: "",
  });

  /**
   * Refetch data saat component mount
   */
  useEffect(() => {
    refetch();
  }, [refetch]);

  // Filter products — debounce 300ms untuk hemat query
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchTerm.trim() || selectedCategory) {
        const filtered = await searchProducts(searchTerm, selectedCategory);
        setFilteredProducts(filtered);
      } else {
        setFilteredProducts(products);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [products, searchTerm, selectedCategory]);

  /**
   * Navigate kembali ke halaman sebelumnya
   */
  const handleBack = () => {
    router.back();
  };

  /**
   * Buka modal untuk tambah/edit produk
   */
  const openProductModal = (product?: ProductWithCategory) => {
    if (product) {
      setEditingProduct(product);
      setProductForm({
        nama: product.nama,
        harga: product.harga.toString(),
        stok: product.stok.toString(),
        kategoriId: product.kategoriId,
        imageUri: product.gambarPath,
      });
    } else {
      setEditingProduct(null);
      setProductForm({
        nama: "",
        harga: "",
        stok: "",
        kategoriId: "",
      });
    }
    setShowModal(true);
  };

  /**
   * Tutup modal produk dan reset form
   */
  const closeProductModal = () => {
    setShowModal(false);
    setEditingProduct(null);
    setDropdownOpen(false);
    setProductForm({
      nama: "",
      harga: "",
      stok: "",
      kategoriId: "",
    });
  };

  /**
   * Buka modal untuk tambah/edit kategori
   */
  const openCategoryModal = (category?: any) => {
    setShowCategoryListModal(false);
    if (category) {
      setEditingCategory(category);
      setCategoryForm({
        nama: category.nama,
        deskripsi: category.deskripsi || "",
      });
    } else {
      setEditingCategory(null);
      setCategoryForm({ nama: "", deskripsi: "" });
    }
    setShowCategoryModal(true);
  };

  /**
   * Tutup modal kategori dan reset form
   */
  const closeCategoryModal = () => {
    setShowCategoryModal(false);
    setEditingCategory(null);
    setCategoryForm({ nama: "", deskripsi: "" });
  };

  /**
   * Pilih gambar dari galeri
   */
  const pickImage = async () => {
    try {
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permissionResult.granted === false) {
        Toast.show({
          type: "error",
          text1: "Error",
          text2: "Izin akses galeri diperlukan",
        });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        // Validasi ukuran file — max 5MB
        const MAX_SIZE_BYTES = 5 * 1024 * 1024;
        if (asset.fileSize && asset.fileSize > MAX_SIZE_BYTES) {
          Toast.show({
            type: "error",
            text1: "Gambar Terlalu Besar",
            text2: `Maksimal ukuran gambar adalah 5MB (saat ini: ${(asset.fileSize / 1024 / 1024).toFixed(1)}MB)`,
          });
          return;
        }
        setProductForm((prev) => ({ ...prev, imageUri: asset.uri }));
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Gagal memilih gambar",
      });
    }
  };

  /**
   * Simpan produk (tambah atau update)
   */
  const saveProduct = async () => {
    if (
      !productForm.nama.trim() ||
      !productForm.harga ||
      !productForm.kategoriId
    ) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Mohon lengkapi semua field yang diperlukan",
      });
      return;
    }

    if (parseFloat(productForm.harga) <= 0) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Harga harus lebih dari 0",
      });
      return;
    }

    const stokValue = parseInt(productForm.stok) || 0;
    if (stokValue < 0) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Stok tidak boleh negatif",
      });
      return;
    }

    try {
      setSubmitting(true);

      const productData: ProductData = {
        nama: productForm.nama.trim(),
        harga: parseFloat(productForm.harga),
        stok: parseInt(productForm.stok) || 0,
        kategoriId: productForm.kategoriId,
      };

      if (editingProduct) {
        await updateProduct(
          editingProduct.id,
          productData,
          productForm.imageUri
        );
        Toast.show({
          type: "success",
          text1: "Berhasil",
          text2: "Produk berhasil diperbarui",
        });
      } else {
        await addProduct(productData, productForm.imageUri);
        Toast.show({
          type: "success",
          text1: "Berhasil",
          text2: "Produk berhasil ditambahkan",
        });
      }

      closeProductModal();
    } catch (error: any) {
      console.error("Error saving product:", error);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: error.message || "Gagal menyimpan produk",
      });
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Hapus produk dengan konfirmasi
   */
  const handleDeleteProduct = (id: string, nama: string) => {
    Alert.alert(
      "Hapus Produk",
      `Apakah Anda yakin ingin menghapus produk "${nama}"?`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteProduct(id);
              Toast.show({
                type: "success",
                text1: "Berhasil",
                text2: "Produk berhasil dihapus",
              });
            } catch (error: any) {
              Toast.show({
                type: "error",
                text1: "Error",
                text2: error.message || "Gagal menghapus produk",
              });
            }
          },
        },
      ]
    );
  };

  /**
   * Simpan kategori (tambah atau update)
   */
  const saveCategory = async () => {
    if (!categoryForm.nama.trim()) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Nama kategori harus diisi",
      });
      return;
    }

    try {
      setSubmitting(true);

      const categoryData: CategoryData = {
        nama: categoryForm.nama.trim(),
        deskripsi: categoryForm.deskripsi.trim(),
      };

      if (editingCategory) {
        await updateCategory(editingCategory.id, categoryData);
        Toast.show({
          type: "success",
          text1: "Berhasil",
          text2: "Kategori berhasil diperbarui",
        });
      } else {
        await addCategory(categoryData);
        Toast.show({
          type: "success",
          text1: "Berhasil",
          text2: "Kategori berhasil ditambahkan",
        });
      }

      closeCategoryModal();
    } catch (error: any) {
      console.error("Error saving category:", error);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: error.message || "Gagal menyimpan kategori",
      });
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Hapus kategori dengan konfirmasi
   */
  const handleDeleteCategory = (id: string, nama: string) => {
    Alert.alert(
      "Hapus Kategori",
      `Apakah Anda yakin ingin menghapus kategori "${nama}"?`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteCategory(id);
              Toast.show({
                type: "success",
                text1: "Berhasil",
                text2: "Kategori berhasil dihapus",
              });
            } catch (error: any) {
              Toast.show({
                type: "error",
                text1: "Error",
                text2: error.message || "Gagal menghapus kategori",
              });
            }
          },
        },
      ]
    );
  };

  /**
   * Reset filter search dan kategori
   */
  const resetFilter = () => {
    setSearchTerm("");
    setSelectedCategory("");
  };

  /**
   * Render product card untuk grid
   */
  const renderProductCard = (product: ProductWithCategory) => (
    <View key={product.id} style={styles.productCard}>
      <View style={styles.productImage}>
        {product.gambarPath ? (
          <Image
            source={{ uri: product.gambarPath }}
            style={styles.productImageView}
            resizeMode="cover"
          />
        ) : (
          <Ionicons name="cube" size={30} color="#9CA3AF" />
        )}
      </View>
      <Text style={styles.productName} numberOfLines={2}>
        {product.nama}
      </Text>
      <Text style={styles.productCategory}>{product.kategoriNama || "-"}</Text>
      <Text style={styles.productPrice}>
        Rp {product.harga.toLocaleString("id-ID")}
      </Text>
      <View
        style={[
          styles.stockBadge,
          {
            backgroundColor:
              product.stok > 10
                ? "#10B981"
                : product.stok > 0
                ? "#F59E0B"
                : "#EF4444",
          },
        ]}>
        <Text style={styles.stockText}>Stok: {product.stok}</Text>
      </View>
      <View style={styles.productActions}>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => openProductModal(product)}>
          <Ionicons name="create" size={16} color="white" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteProduct(product.id, product.nama)}>
          <Ionicons name="trash" size={16} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (!isInitialized || loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Kelola Produk</Text>
          <View style={styles.headerRight} />
        </View>
        <SkeletonList count={6} />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Kelola Produk</Text>
          <View style={styles.headerRight} />
        </View>
        <EmptyState
          icon="alert-circle-outline"
          iconColor="#EF4444"
          title="Terjadi Kesalahan"
          description={error}
          actionLabel="Coba Lagi"
          onAction={refetch}
        />
        <BottomNavigation currentPage="kelola-produk" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Kelola Produk</Text>
        <View style={styles.headerRight} />
      </View>

      <FlatList
        style={styles.content}
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        renderItem={({ item }) => renderProductCard(item)}
        contentContainerStyle={[
          styles.scrollContent,
          filteredProducts.length === 0 && { flexGrow: 1 },
          { paddingBottom: 24 },
        ]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        windowSize={8}
        ListHeaderComponent={
          <View>
            <View style={styles.actionButtons}>
              <Button
                title="Tambah Produk"
                onPress={() => openProductModal()}
                icon="add"
                style={[styles.actionButton, { backgroundColor: "#EA580C" }]}
              />
              <Button
                title="Kelola Kategori"
                onPress={() => setShowCategoryListModal(true)}
                icon="settings"
                variant="outline"
                style={styles.actionButton}
              />
            </View>

            <View style={styles.searchContainer}>
              <View style={styles.searchInputContainer}>
                <Ionicons
                  name="search"
                  size={20}
                  color="#9CA3AF"
                  style={styles.searchIcon}
                />
                <TextInput
                  style={styles.searchInput}
                  value={searchTerm}
                  onChangeText={setSearchTerm}
                  placeholder="Cari produk..."
                  placeholderTextColor="#9CA3AF"
                />
                {(searchTerm || selectedCategory) && (
                  <TouchableOpacity
                    onPress={resetFilter}
                    style={styles.clearButton}>
                    <Ionicons name="close-circle" size={20} color="#9CA3AF" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

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
                    selectedCategory === category.id && styles.categoryButtonActive,
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
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="cube-outline"
            title={searchTerm || selectedCategory ? "Produk tidak ditemukan" : "Belum ada produk"}
            description={searchTerm || selectedCategory ? "Coba ubah kata kunci atau filter pencarian" : "Tambahkan produk pertama Anda!"}
            actionLabel={searchTerm || selectedCategory ? "Lihat Semua Produk" : undefined}
            onAction={searchTerm || selectedCategory ? resetFilter : undefined}
          />
        }
      />

      {submitting && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContent}>
            <ActivityIndicator size="large" color="#EA580C" />
            <Text style={styles.loadingOverlayText}>Memproses...</Text>
          </View>
        </View>
      )}

      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeProductModal}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editingProduct ? "Edit Produk" : "Tambah Produk"}
            </Text>
            <TouchableOpacity
              onPress={closeProductModal}
              style={styles.modalCloseButton}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalContent}
            showsVerticalScrollIndicator={false}
            scrollEnabled={true}
            nestedScrollEnabled={true}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Gambar Produk</Text>
              <TouchableOpacity
                style={styles.imagePicker}
                onPress={pickImage}
                disabled={submitting}>
                {productForm.imageUri ? (
                  <Image
                    source={{ uri: productForm.imageUri }}
                    style={styles.imagePreview}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.imagePickerPlaceholder}>
                    <Ionicons name="camera" size={32} color="#9CA3AF" />
                    <Text style={styles.imagePickerText}>Pilih Gambar</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nama Produk *</Text>
              <TextInput
                style={styles.textInput}
                value={productForm.nama}
                onChangeText={(text) =>
                  setProductForm({ ...productForm, nama: text })
                }
                placeholder="Masukkan nama produk"
                placeholderTextColor="#9CA3AF"
                editable={!submitting}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Kategori *</Text>
              <CategoryDropdown
                categories={categories}
                selectedValue={productForm.kategoriId}
                onValueChange={(value) =>
                  setProductForm({ ...productForm, kategoriId: value })
                }
                placeholder="Pilih kategori"
                disabled={submitting}
                isOpen={dropdownOpen}
                onToggle={setDropdownOpen}
              />
            </View>

            <View style={styles.inputRow}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.inputLabel}>Harga *</Text>
                <TextInput
                  style={styles.textInput}
                  value={productForm.harga}
                  onChangeText={(text) =>
                    setProductForm({
                      ...productForm,
                      harga: text.replace(/[^0-9]/g, ""),
                    })
                  }
                  placeholder="0"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                  editable={!submitting}
                />
              </View>

              <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.inputLabel}>Stok</Text>
                <TextInput
                  style={styles.textInput}
                  value={productForm.stok}
                  onChangeText={(text) =>
                    setProductForm({
                      ...productForm,
                      stok: text.replace(/[^0-9]/g, ""),
                    })
                  }
                  placeholder="0"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                  editable={!submitting}
                />
              </View>
            </View>

            <View style={styles.modalActionButtons}>
              <Button
                title="Batal"
                onPress={closeProductModal}
                variant="outline"
                style={[styles.modalActionButton, { marginRight: 8 }]}
                disabled={submitting}
              />
              <Button
                title={
                  submitting
                    ? "Menyimpan..."
                    : editingProduct
                    ? "Perbarui"
                    : "Simpan"
                }
                onPress={saveProduct}
                style={[styles.modalActionButton, { marginLeft: 8 }]}
                disabled={submitting}
              />
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <CategoryListModal
        visible={showCategoryListModal}
        categories={categories}
        onClose={() => setShowCategoryListModal(false)}
        onEdit={openCategoryModal}
        onDelete={handleDeleteCategory}
        onAdd={() => openCategoryModal()}
      />

      <Modal
        visible={showCategoryModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeCategoryModal}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editingCategory ? "Edit Kategori" : "Tambah Kategori"}
            </Text>
            <TouchableOpacity
              onPress={closeCategoryModal}
              style={styles.modalCloseButton}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nama Kategori *</Text>
              <TextInput
                style={styles.textInput}
                value={categoryForm.nama}
                onChangeText={(text) =>
                  setCategoryForm({ ...categoryForm, nama: text })
                }
                placeholder="Masukkan nama kategori"
                placeholderTextColor="#9CA3AF"
                editable={!submitting}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Deskripsi</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={categoryForm.deskripsi}
                onChangeText={(text) =>
                  setCategoryForm({ ...categoryForm, deskripsi: text })
                }
                placeholder="Masukkan deskripsi kategori (opsional)"
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
                editable={!submitting}
              />
            </View>

            <View style={styles.modalActionButtons}>
              <Button
                title="Batal"
                onPress={closeCategoryModal}
                variant="outline"
                style={[styles.modalActionButton, { marginRight: 8 }]}
                disabled={submitting}
              />
              <Button
                title={
                  submitting
                    ? "Menyimpan..."
                    : editingCategory
                    ? "Perbarui"
                    : "Simpan"
                }
                onPress={saveCategory}
                style={[styles.modalActionButton, { marginLeft: 8 }]}
                disabled={submitting}
              />
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      <BottomNavigation currentPage="kelola-produk" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#6B7280",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#EF4444",
    marginTop: 16,
    marginBottom: 8,
    textAlign: "center",
  },
  errorDescription: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: "#EA580C",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  loadingContent: {
    backgroundColor: "white",
    padding: 24,
    borderRadius: 12,
    alignItems: "center",
    minWidth: 120,
  },
  loadingOverlayText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  statsContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: "white",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#EA580C",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
  },
  searchContainer: {
    marginBottom: 16,
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    paddingHorizontal: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: "#111827",
  },
  clearButton: {
    marginLeft: 8,
    padding: 4,
  },
  categoryFilter: {
    marginBottom: 20,
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
  productsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  columnWrapper: {
    justifyContent: "space-between",
  },
  productCard: {
    width: "48%",
    backgroundColor: "white",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  productImage: {
    aspectRatio: 1,
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    overflow: "hidden",
  },
  productImageView: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
  },
  productName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
    textAlign: "center",
  },
  productCategory: {
    fontSize: 11,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 6,
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
    gap: 8,
  },
  editButton: {
    flex: 1,
    backgroundColor: "#2563EB",
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: "center",
  },
  deleteButton: {
    flex: 1,
    backgroundColor: "#EF4444",
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: "center",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
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
    lineHeight: 20,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "white",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
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
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: "#111827",
    backgroundColor: "#F9FAFB",
  },
  textArea: {
    height: 80,
    textAlignVertical: "top",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  disabledInput: {
    opacity: 0.6,
    backgroundColor: "#F3F4F6",
  },
  imagePicker: {
    height: 120,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    borderStyle: "dashed",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    overflow: "hidden",
  },
  imagePickerPlaceholder: {
    alignItems: "center",
  },
  imagePickerText: {
    fontSize: 14,
    color: "#9CA3AF",
    marginTop: 8,
  },
  imagePreview: {
    width: "100%",
    height: "100%",
    borderRadius: 6,
  },
  modalActionButtons: {
    flexDirection: "row",
    marginTop: 24,
    marginBottom: 20,
  },
  modalActionButton: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 12,
  },
  emptyCategory: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyCategoryText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#6B7280",
    marginTop: 16,
    marginBottom: 8,
    textAlign: "center",
  },
  emptyCategoryDescription: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 20,
  },
  categoryItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  categoryItemName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  categoryItemDesc: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
    lineHeight: 16,
  },
  categoryItemActions: {
    flexDirection: "row",
    gap: 12,
  },
  categoryEditButton: {
    padding: 8,
  },
  categoryDeleteButton: {
    padding: 8,
  },
  addButtonContainer: {
    marginBottom: 20,
    alignItems: "flex-start",
  },
  dropdownContainer: {
    position: "relative",
    marginBottom: 4,
  },
  dropdownButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    backgroundColor: "#F9FAFB",
    minHeight: 48,
  },
  dropdownButtonOpen: {
    borderColor: "#EA580C",
    borderWidth: 2,
  },
  dropdownButtonText: {
    fontSize: 16,
    color: "#111827",
    flex: 1,
  },
  dropdownPlaceholder: {
    color: "#9CA3AF",
  },
  dropdownModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  dropdownModalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "70%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10,
  },
  dropdownModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  dropdownModalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  dropdownModalList: {
    maxHeight: 400,
  },
  dropdownModalItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  dropdownModalItemSelected: {
    backgroundColor: "#FEF3F2",
  },
  dropdownModalItemText: {
    fontSize: 16,
    color: "#111827",
    fontWeight: "500",
  },
  dropdownModalItemTextSelected: {
    color: "#EA580C",
    fontWeight: "600",
  },
  dropdownItemDescription: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
    lineHeight: 16,
  },
});
