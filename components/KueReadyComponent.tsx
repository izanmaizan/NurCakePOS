// components/KueReadyComponent.tsx - Complete Fixed Version with Better Dropdown
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { sqliteService } from "../database/SQLiteService";
import { KueReadyForm, KueReadyItem, useKueReady } from "../hooks/useKueReady";
import { usePricing } from "../hooks/usePricing";

const { width: screenWidth } = Dimensions.get("screen");
const isTablet = screenWidth >= 768;

interface KueReadyComponentProps {
  onAddToTransaction: (kueReady: KueReadyItem, cakeName: string) => void;
  selectedKueReadyIds: string[];
}

// Improved Dropdown Component
const PricingDropdown: React.FC<{
  items: any[];
  selectedValue: string;
  onValueChange: (value: string) => void;
  placeholder: string;
}> = ({ items, selectedValue, onValueChange, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedItem = items.find((item) => item.nama === selectedValue);

  const handleSelect = (value: string) => {
    onValueChange(value);
    setIsOpen(false);
  };

  return (
    <View style={styles.dropdownWrapper}>
      <TouchableOpacity
        activeOpacity={0.7}
        style={[styles.dropdownButton, isOpen && styles.dropdownButtonOpen]}
        onPress={() => setIsOpen(!isOpen)}>
        <Text
          style={[
            styles.dropdownButtonText,
            !selectedValue && styles.dropdownPlaceholder,
          ]}>
          {selectedItem ? selectedItem.nama : placeholder}
        </Text>
        <Ionicons
          name={isOpen ? "chevron-up" : "chevron-down"}
          size={20}
          color="#6B7280"
        />
      </TouchableOpacity>

      {isOpen && (
        <Modal
          visible={isOpen}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setIsOpen(false)}>
          <TouchableOpacity
            activeOpacity={1}
            style={styles.dropdownModalOverlay}
            onPress={() => setIsOpen(false)}>
            <View style={styles.dropdownModalContent}>
              <View style={styles.dropdownModalHeader}>
                <Text style={styles.dropdownModalTitle}>{placeholder}</Text>
                <TouchableOpacity onPress={() => setIsOpen(false)}>
                  <Ionicons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.dropdownModalList}
                showsVerticalScrollIndicator={true}>
                {items.length === 0 ? (
                  <View style={styles.emptyDropdown}>
                    <Text style={styles.emptyDropdownText}>
                      Tidak ada pilihan
                    </Text>
                  </View>
                ) : (
                  items.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      activeOpacity={0.7}
                      style={[
                        styles.dropdownModalItem,
                        selectedValue === item.nama &&
                          styles.dropdownModalItemSelected,
                      ]}
                      onPress={() => handleSelect(item.nama)}>
                      <Text
                        style={[
                          styles.dropdownModalItemText,
                          selectedValue === item.nama &&
                            styles.dropdownModalItemTextSelected,
                        ]}>
                        {item.nama}
                      </Text>
                      {selectedValue === item.nama && (
                        <Ionicons name="checkmark" size={20} color="#16A34A" />
                      )}
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
};

export default function KueReadyComponent({
  onAddToTransaction,
  selectedKueReadyIds,
}: KueReadyComponentProps) {
  const { kueReadyList, loading, error, addKueReady, deleteKueReady, refetch } =
    useKueReady();
  const { masterKriteria } = usePricing();

  const [selectedKueReady, setSelectedKueReady] = useState<KueReadyItem | null>(
    null
  );
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [cakeName, setCakeName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState<KueReadyForm>({
    nama: "",
    jenisKue: "",
    variasiKue: "",
    ukuranKue: "",
    hargaJual: 0,
    gambarPath: "",
    status: "available",
    catatan: "",
  });

  const availableKueReady = kueReadyList.filter(
    (kue) => kue.status === "available"
  );

  const isKueSelected = (kueId: string) => {
    return selectedKueReadyIds.includes(kueId);
  };

  const handleSelectKue = (kue: KueReadyItem) => {
    if (!isKueSelected(kue.id)) {
      setSelectedKueReady(kue);
      setShowOrderModal(true);
    }
  };

  const handleShowDetail = (kue: KueReadyItem) => {
    setSelectedKueReady(kue);
    setShowDetailModal(true);
  };

  const handleImagePicker = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const fileName = `kue_ready_${Date.now()}.jpg`;
        const savedImagePath = await sqliteService.saveFile(
          result.assets[0].uri,
          fileName,
          "kue_ready_images"
        );

        setFormData((prev) => ({
          ...prev,
          gambarPath: savedImagePath,
        }));

        Toast.show({
          type: "success",
          text1: "Berhasil",
          text2: "Gambar berhasil dipilih",
        });
      }
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Gagal memilih gambar",
      });
    }
  };

  const handleAddToTransaction = () => {
    if (!selectedKueReady || !cakeName.trim()) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Mohon masukkan nama yang akan ditulis di atas kue",
      });
      return;
    }

    onAddToTransaction(selectedKueReady, cakeName);

    setShowOrderModal(false);
    setCakeName("");
    setSelectedKueReady(null);

    Toast.show({
      type: "success",
      text1: "Berhasil",
      text2: `${selectedKueReady.nama} ditambahkan ke transaksi`,
    });
  };

  const handleAddKueReady = async () => {
    if (
      !formData.nama.trim() ||
      !formData.jenisKue.trim() ||
      !formData.variasiKue.trim() ||
      !formData.ukuranKue.trim()
    ) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Mohon lengkapi semua field yang wajib",
      });
      return;
    }

    if (formData.hargaJual <= 0) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Harga jual harus lebih dari 0",
      });
      return;
    }

    try {
      setSubmitting(true);
      await addKueReady(formData);
      Toast.show({
        type: "success",
        text1: "Berhasil",
        text2: "Kue ready berhasil ditambahkan!",
      });
      setShowAddModal(false);
      resetForm();
    } catch (error: any) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: error.message || "Gagal menambahkan kue ready",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteKueReady = (kueId: string, nama: string) => {
    if (isKueSelected(kueId)) {
      Alert.alert(
        "Tidak Dapat Dihapus",
        "Kue ini sedang dalam transaksi. Hapus dari transaksi terlebih dahulu.",
        [{ text: "OK" }]
      );
      return;
    }

    Alert.alert(
      "Hapus Kue Ready",
      `Apakah Anda yakin ingin menghapus "${nama}"?`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteKueReady(kueId);
              Toast.show({
                type: "success",
                text1: "Berhasil",
                text2: "Kue ready berhasil dihapus",
              });
            } catch (error: any) {
              Toast.show({
                type: "error",
                text1: "Error",
                text2: error.message || "Gagal menghapus kue ready",
              });
            }
          },
        },
      ]
    );
  };

  const resetForm = () => {
    setFormData({
      nama: "",
      jenisKue: "",
      variasiKue: "",
      ukuranKue: "",
      hargaJual: 0,
      gambarPath: "",
      status: "available",
      catatan: "",
    });
  };

  if (loading && kueReadyList.length === 0) {
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeaderContainer}>
          <View style={styles.sectionInfo}>
            <Text style={styles.sectionTitle}>Kue Ready</Text>
            <Text style={styles.sectionDescription}>
              Memuat data kue ready...
            </Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#EA580C" />
          <Text style={styles.loadingText}>Memuat kue ready...</Text>
        </View>
      </View>
    );
  }

  if (error && kueReadyList.length === 0) {
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeaderContainer}>
          <View style={styles.sectionInfo}>
            <Text style={styles.sectionTitle}>Kue Ready</Text>
            <Text style={styles.sectionDescription}>
              Gagal memuat data kue ready
            </Text>
          </View>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#EF4444" />
          <Text style={styles.errorText}>Gagal memuat data</Text>
          <Text style={styles.errorDescription}>{error}</Text>
        </View>
      </View>
    );
  }

  return (
    <>
      {/* Main Card */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderContainer}>
          <View style={styles.sectionInfo}>
            <Text style={styles.sectionTitle}>Kue Ready</Text>
            {/* <Text style={styles.sectionDescription}>
              {availableKueReady.length} kue tersedia
              {selectedKueReadyIds.length > 0 && ` • ${selectedKueReadyIds.length} dalam transaksi`}
            </Text> */}
          </View>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowAddModal(true)}>
            <Ionicons name="add" size={isTablet ? 20 : 16} color="white" />
            <Text style={styles.addButtonText}>
              {isTablet ? "Tambah Kue Ready" : "Tambah"}
            </Text>
          </TouchableOpacity>
        </View>

        {availableKueReady.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="cafe-outline" size={48} color="#9CA3AF" />
            <Text style={styles.emptyStateText}>Belum ada kue ready</Text>
            <Text style={styles.emptyStateDescription}>
              Tambahkan kue ready pertama Anda!
            </Text>
          </View>
        ) : (
          <View style={styles.kueReadyGrid}>
            {availableKueReady.map((kue) => {
              const isSelected = isKueSelected(kue.id);

              return (
                <View
                  key={kue.id}
                  style={[
                    styles.kueReadyCard,
                    isSelected && styles.kueReadyCardSelected,
                  ]}>
                  {isSelected && (
                    <View style={styles.statusBadgeContainer}>
                      <View style={styles.selectedBadge}>
                        <Ionicons
                          name="checkmark-circle"
                          size={14}
                          color="white"
                        />
                        <Text style={styles.selectedBadgeText}>
                          Dalam Transaksi
                        </Text>
                      </View>
                    </View>
                  )}

                  <TouchableOpacity
                    style={[
                      styles.kueImageContainer,
                      isSelected && styles.kueImageContainerSelected,
                    ]}
                    onPress={() => {
                      if (kue.gambarPath && !isSelected) {
                        setSelectedKueReady(kue);
                        setShowImageModal(true);
                      }
                    }}
                    disabled={!kue.gambarPath || isSelected}>
                    {kue.gambarPath ? (
                      <Image
                        source={{
                          uri:
                            kue.gambarPath &&
                            (kue.gambarPath.startsWith("file://")
                              ? kue.gambarPath
                              : `file://${kue.gambarPath}`),
                        }}
                        style={styles.kueImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.imagePlaceholder}>
                        <Ionicons
                          name="image-outline"
                          size={isTablet ? 32 : 24}
                          color="#9CA3AF"
                        />
                        <Text style={styles.imagePlaceholderText}>
                          Tidak ada gambar
                        </Text>
                      </View>
                    )}
                    {isSelected && (
                      <View style={styles.selectedOverlay}>
                        <Ionicons name="lock-closed" size={24} color="white" />
                      </View>
                    )}
                  </TouchableOpacity>

                  <View style={styles.kueInfo}>
                    <Text
                      style={[
                        styles.kueName,
                        isSelected && styles.kueNameSelected,
                      ]}
                      numberOfLines={2}>
                      {kue.nama}
                    </Text>

                    <Text
                      style={[
                        styles.kuePrice,
                        isSelected && styles.kuePriceSelected,
                      ]}>
                      Rp {kue.hargaJual.toLocaleString("id-ID")}
                    </Text>

                    <View style={styles.actionButtons}>
                      <TouchableOpacity
                        style={[
                          styles.detailButton,
                          isSelected && styles.detailButtonDisabled,
                        ]}
                        onPress={() => handleShowDetail(kue)}
                        disabled={isSelected}>
                        <Ionicons
                          name="information-circle"
                          size={14}
                          color={isSelected ? "#9CA3AF" : "#6B7280"}
                        />
                        {isTablet && (
                          <Text
                            style={[
                              styles.detailButtonText,
                              isSelected && { color: "#9CA3AF" },
                            ]}>
                            Info
                          </Text>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.selectButton,
                          isSelected && styles.selectButtonDisabled,
                        ]}
                        onPress={() => handleSelectKue(kue)}
                        disabled={isSelected}>
                        <Ionicons
                          name={isSelected ? "lock-closed" : "add"}
                          size={14}
                          color="white"
                        />
                        <Text style={styles.selectButtonText}>
                          {isSelected ? "Terpilih" : "Pilih"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* Add Kue Ready Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddModal(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Tambah Kue Ready</Text>
            <TouchableOpacity
              onPress={() => {
                setShowAddModal(false);
                resetForm();
              }}
              style={styles.modalCloseButton}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Gambar Kue</Text>
              <TouchableOpacity
                style={styles.imageUploadContainer}
                onPress={handleImagePicker}>
                {formData.gambarPath ? (
                  <Image
                    source={{
                      uri: formData.gambarPath.startsWith("file://")
                        ? formData.gambarPath
                        : `file://${formData.gambarPath}`,
                    }}
                    style={styles.uploadedImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.imageUploadPlaceholder}>
                    <Ionicons name="camera" size={32} color="#9CA3AF" />
                    <Text style={styles.imageUploadText}>
                      Tap untuk upload gambar
                    </Text>
                    <Text style={styles.imageUploadSubtext}>
                      PNG, JPG, JPEG hingga 5MB
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nama Kue *</Text>
              <TextInput
                style={styles.textInput}
                value={formData.nama}
                onChangeText={(text) =>
                  setFormData((prev) => ({ ...prev, nama: text }))
                }
                placeholder="Contoh: Birthday Cake Coklat Special"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Jenis Kue *</Text>
              <PricingDropdown
                items={masterKriteria.jenisKue}
                selectedValue={formData.jenisKue}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, jenisKue: value }))
                }
                placeholder="Pilih jenis kue"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Variasi Kue *</Text>
              <PricingDropdown
                items={masterKriteria.variasiKue}
                selectedValue={formData.variasiKue}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, variasiKue: value }))
                }
                placeholder="Pilih variasi kue"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Ukuran Kue *</Text>
              <PricingDropdown
                items={masterKriteria.ukuranKue}
                selectedValue={formData.ukuranKue}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, ukuranKue: value }))
                }
                placeholder="Pilih ukuran kue"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Harga Jual *</Text>
              <View style={styles.priceInputContainer}>
                <Text style={styles.currencyPrefix}>Rp</Text>
                <TextInput
                  style={styles.priceInput}
                  value={
                    formData.hargaJual > 0
                      ? formData.hargaJual.toLocaleString("id-ID")
                      : ""
                  }
                  onChangeText={(text) => {
                    const numericValue =
                      parseInt(text.replace(/[^0-9]/g, "")) || 0;
                    setFormData((prev) => ({
                      ...prev,
                      hargaJual: numericValue,
                    }));
                  }}
                  placeholder="0"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Catatan (Opsional)</Text>
              <TextInput
                style={[styles.textInput, styles.notesInput]}
                value={formData.catatan}
                onChangeText={(text) =>
                  setFormData((prev) => ({ ...prev, catatan: text }))
                }
                placeholder="Catatan tambahan tentang kue..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            {formData.hargaJual > 0 && (
              <View style={styles.totalPriceContainer}>
                <Text style={styles.totalPriceLabel}>Harga Jual:</Text>
                <Text style={styles.totalPriceValue}>
                  Rp {formData.hargaJual.toLocaleString("id-ID")}
                </Text>
              </View>
            )}

            <View style={styles.modalActionButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowAddModal(false);
                  resetForm();
                }}
                disabled={submitting}>
                <Text style={styles.cancelButtonText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  submitting && styles.saveButtonDisabled,
                ]}
                onPress={handleAddKueReady}
                disabled={submitting}>
                {submitting ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.saveButtonText}>Simpan</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Detail Modal */}
      <Modal
        visible={showDetailModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDetailModal(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Detail Kue Ready</Text>
            <TouchableOpacity
              onPress={() => setShowDetailModal(false)}
              style={styles.modalCloseButton}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {selectedKueReady && (
            <ScrollView
              style={styles.modalContent}
              showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                style={styles.detailImageContainer}
                onPress={() => {
                  if (selectedKueReady.gambarPath) {
                    setShowImageModal(true);
                  }
                }}
                disabled={!selectedKueReady.gambarPath}>
                {selectedKueReady.gambarPath ? (
                  <>
                    <Image
                      source={{
                        uri:
                          selectedKueReady.gambarPath &&
                          (selectedKueReady.gambarPath.startsWith("file://")
                            ? selectedKueReady.gambarPath
                            : `file://${selectedKueReady.gambarPath}`),
                      }}
                      style={styles.detailImage}
                      resizeMode="cover"
                    />
                    <View style={styles.imageExpandHint}>
                      <Ionicons name="expand" size={16} color="white" />
                      <Text style={styles.imageExpandText}>
                        Tap untuk perbesar
                      </Text>
                    </View>
                  </>
                ) : (
                  <View style={styles.detailImagePlaceholder}>
                    <Ionicons name="cafe" size={60} color="#9CA3AF" />
                    <Text style={styles.detailImagePlaceholderText}>
                      Foto Kue
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              <View style={styles.detailInfo}>
                <Text style={styles.detailTitle}>{selectedKueReady.nama}</Text>

                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Spesifikasi Kue</Text>

                  <View style={styles.detailRow}>
                    <View style={styles.detailIconLabel}>
                      <Ionicons name="layers" size={16} color="#6B7280" />
                      <Text style={styles.detailLabel}>Jenis:</Text>
                    </View>
                    <Text style={styles.detailValue}>
                      {selectedKueReady.jenisKue}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <View style={styles.detailIconLabel}>
                      <Ionicons
                        name="color-palette"
                        size={16}
                        color="#6B7280"
                      />
                      <Text style={styles.detailLabel}>Variasi:</Text>
                    </View>
                    <Text style={styles.detailValue}>
                      {selectedKueReady.variasiKue}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <View style={styles.detailIconLabel}>
                      <Ionicons name="resize" size={16} color="#6B7280" />
                      <Text style={styles.detailLabel}>Ukuran:</Text>
                    </View>
                    <Text style={styles.detailValue}>
                      {selectedKueReady.ukuranKue}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <View style={styles.detailIconLabel}>
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color="#6B7280"
                      />
                      <Text style={styles.detailLabel}>Status:</Text>
                    </View>
                    <View
                      style={[
                        styles.statusDetailBadge,
                        isKueSelected(selectedKueReady.id) &&
                          styles.statusDetailBadgeSelected,
                      ]}>
                      <Text style={styles.statusDetailBadgeText}>
                        {isKueSelected(selectedKueReady.id)
                          ? "Dalam Transaksi"
                          : "Tersedia"}
                      </Text>
                    </View>
                  </View>
                </View>

                {selectedKueReady.catatan && (
                  <View style={styles.notesSection}>
                    <Text style={styles.detailSectionTitle}>Catatan</Text>
                    <View style={styles.notesContainer}>
                      <Ionicons
                        name="document-text"
                        size={16}
                        color="#92400E"
                      />
                      <Text style={styles.notesText}>
                        {selectedKueReady.catatan}
                      </Text>
                    </View>
                  </View>
                )}

                <View style={styles.priceSection}>
                  <Text style={styles.priceSectionLabel}>Harga Jual</Text>
                  <Text style={styles.priceSectionValue}>
                    Rp {selectedKueReady.hargaJual.toLocaleString("id-ID")}
                  </Text>
                </View>

                <View style={styles.timestampSection}>
                  <View style={styles.timestampRow}>
                    <Ionicons name="time" size={12} color="#9CA3AF" />
                    <Text style={styles.timestampText}>
                      Dibuat:{" "}
                      {new Date(selectedKueReady.dibuat).toLocaleDateString(
                        "id-ID",
                        {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.detailActionButtons}>
                {!isKueSelected(selectedKueReady.id) && (
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => {
                      setShowDetailModal(false);
                      setTimeout(() => {
                        handleDeleteKueReady(
                          selectedKueReady.id,
                          selectedKueReady.nama
                        );
                      }, 300);
                    }}>
                    <Ionicons name="trash" size={16} color="white" />
                    <Text style={styles.deleteButtonText}>Hapus</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[
                    styles.closeDetailButton,
                    isKueSelected(selectedKueReady.id) && { flex: 1 },
                  ]}
                  onPress={() => setShowDetailModal(false)}>
                  <Text style={styles.closeDetailButtonText}>Tutup</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* Image Modal */}
      <Modal
        visible={showImageModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowImageModal(false)}>
        <TouchableOpacity
          activeOpacity={1}
          style={styles.imageModalContainer}
          onPress={() => setShowImageModal(false)}>
          <View style={styles.imageModalContentWrapper}>
            <View style={styles.imageModalHeader}>
              <Text style={styles.imageModalTitle}>Foto Kue</Text>
              <TouchableOpacity
                onPress={() => setShowImageModal(false)}
                style={styles.imageModalCloseButton}>
                <Ionicons name="close-circle" size={32} color="white" />
              </TouchableOpacity>
            </View>

            {selectedKueReady?.gambarPath && (
              <Image
                source={{
                  uri:
                    selectedKueReady.gambarPath &&
                    (selectedKueReady.gambarPath.startsWith("file://")
                      ? selectedKueReady.gambarPath
                      : `file://${selectedKueReady.gambarPath}`),
                }}
                style={styles.fullScreenImage}
                resizeMode="contain"
              />
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Order Modal */}
      <Modal
        visible={showOrderModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowOrderModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.orderModalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Tambah ke Transaksi</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowOrderModal(false);
                  setCakeName("");
                  setSelectedKueReady(null);
                }}
                style={styles.modalCloseButton}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {selectedKueReady && (
              <View style={styles.orderContent}>
                <View style={styles.kueInfoCard}>
                  {selectedKueReady.gambarPath && (
                    <Image
                      source={{
                        uri:
                          selectedKueReady.gambarPath &&
                          (selectedKueReady.gambarPath.startsWith("file://")
                            ? selectedKueReady.gambarPath
                            : `file://${selectedKueReady.gambarPath}`),
                      }}
                      style={styles.kueInfoImage}
                      resizeMode="cover"
                    />
                  )}
                  <Text style={styles.kueInfoTitle}>
                    {selectedKueReady.nama}
                  </Text>
                  <View style={styles.kueInfoDetailsContainer}>
                    <View style={styles.kueInfoDetailRow}>
                      <Ionicons name="layers" size={14} color="#6B7280" />
                      <Text style={styles.kueInfoDetails}>
                        {selectedKueReady.jenisKue}
                      </Text>
                    </View>
                    <View style={styles.kueInfoDetailRow}>
                      <Ionicons
                        name="color-palette"
                        size={14}
                        color="#6B7280"
                      />
                      <Text style={styles.kueInfoDetails}>
                        {selectedKueReady.variasiKue}
                      </Text>
                    </View>
                    <View style={styles.kueInfoDetailRow}>
                      <Ionicons name="resize" size={14} color="#6B7280" />
                      <Text style={styles.kueInfoDetails}>
                        {selectedKueReady.ukuranKue}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.kueInfoPrice}>
                    Rp {selectedKueReady.hargaJual.toLocaleString("id-ID")}
                  </Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>
                    Nama yang akan ditulis di atas kue *
                  </Text>
                  <View style={styles.cakeNameInputContainer}>
                    <Ionicons name="create" size={20} color="#9CA3AF" />
                    <TextInput
                      style={styles.cakeNameInput}
                      value={cakeName}
                      onChangeText={setCakeName}
                      placeholder="Contoh: Happy Birthday Sarah"
                      placeholderTextColor="#9CA3AF"
                      autoFocus
                    />
                  </View>
                  <Text style={styles.inputHint}>
                    Tulisan ini akan ditulis di atas kue oleh baker
                  </Text>
                </View>

                <View style={styles.orderModalActions}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => {
                      setShowOrderModal(false);
                      setCakeName("");
                      setSelectedKueReady(null);
                    }}>
                    <Text style={styles.cancelButtonText}>Batal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.addToCartButton,
                      !cakeName.trim() && styles.addToCartButtonDisabled,
                    ]}
                    onPress={handleAddToTransaction}
                    disabled={!cakeName.trim()}>
                    <Ionicons name="cart" size={16} color="white" />
                    <Text style={styles.addToCartButtonText}>
                      Tambah ke Transaksi
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  sectionHeaderContainer: {
    flexDirection: isTablet ? "row" : "column",
    justifyContent: "space-between",
    alignItems: isTablet ? "center" : "flex-start",
    marginBottom: 16,
    gap: 12,
  },
  sectionInfo: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 20,
  },
  addButton: {
    backgroundColor: "#16A34A",
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: isTablet ? 10 : 8,
    paddingHorizontal: isTablet ? 16 : 12,
    borderRadius: 8,
    gap: 6,
    minWidth: isTablet ? undefined : 100,
    justifyContent: "center",
    shadowColor: "#16A34A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  addButtonText: {
    color: "white",
    fontSize: isTablet ? 14 : 12,
    fontWeight: "600",
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 8,
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
  },
  kueReadyGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: isTablet ? 16 : 12,
    justifyContent: "flex-start",
  },
  kueReadyCard: {
    width: isTablet ? (screenWidth - 80) / 5 - 16 : (screenWidth - 64) / 2 - 6,
    backgroundColor: "white",
    borderRadius: 12,
    padding: isTablet ? 12 : 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    minHeight: isTablet ? 260 : 220,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  kueReadyCardSelected: {
    borderColor: "#FB923C",
    backgroundColor: "#FFF7ED",
    borderWidth: 2,
    opacity: 0.85,
  },
  statusBadgeContainer: {
    marginBottom: 8,
    alignItems: "flex-start",
  },
  selectedBadge: {
    backgroundColor: "#FB923C",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    shadowColor: "#FB923C",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  selectedBadgeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "600",
  },
  kueImageContainer: {
    aspectRatio: 1,
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    marginBottom: 12,
    overflow: "hidden",
    position: "relative",
  },
  kueImageContainerSelected: {
    opacity: 0.7,
  },
  kueImage: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  imagePlaceholderText: {
    fontSize: isTablet ? 11 : 10,
    color: "#9CA3AF",
    marginTop: 4,
    textAlign: "center",
  },
  selectedOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(251, 146, 60, 0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  kueInfo: {
    flex: 1,
    justifyContent: "space-between",
  },
  kueName: {
    fontSize: isTablet ? 14 : 13,
    fontWeight: "600",
    color: "#111827",
    textAlign: "center",
    // marginBottom: 8,
    // lineHeight: 18,
    // minHeight: 36,
  },
  kueNameSelected: {
    color: "#9A3412",
  },
  kuePrice: {
    fontSize: isTablet ? 18 : 16,
    fontWeight: "bold",
    color: "#16A34A",
    textAlign: "center",
    // marginBottom: 12,
  },
  kuePriceSelected: {
    color: "#FB923C",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 6,
  },
  detailButton: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    paddingVertical: 8,
    borderRadius: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  detailButtonDisabled: {
    opacity: 0.5,
  },
  detailButtonText: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },
  selectButton: {
    flex: 2,
    backgroundColor: "#EA580C",
    paddingVertical: 8,
    borderRadius: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    shadowColor: "#EA580C",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  selectButtonDisabled: {
    backgroundColor: "#9CA3AF",
    shadowOpacity: 0,
    elevation: 0,
  },
  selectButtonText: {
    fontSize: isTablet ? 12 : 11,
    color: "white",
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
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
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "white",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
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
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
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
  notesInput: {
    textAlignVertical: "top",
    minHeight: 80,
  },
  priceInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    backgroundColor: "#F9FAFB",
    paddingLeft: 12,
  },
  currencyPrefix: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6B7280",
    marginRight: 8,
  },
  priceInput: {
    flex: 1,
    paddingVertical: 12,
    paddingRight: 12,
    fontSize: 16,
    color: "#111827",
  },
  imageUploadContainer: {
    height: 200,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    borderStyle: "dashed",
    borderRadius: 12,
    overflow: "hidden",
  },
  uploadedImage: {
    width: "100%",
    height: "100%",
  },
  imageUploadPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
  },
  imageUploadText: {
    fontSize: 16,
    color: "#6B7280",
    marginTop: 8,
    textAlign: "center",
    fontWeight: "500",
  },
  imageUploadSubtext: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 4,
    textAlign: "center",
  },
  // Improved Dropdown Styles
  dropdownWrapper: {
    position: "relative",
    zIndex: 1,
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
    borderColor: "#16A34A",
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
  emptyDropdown: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyDropdownText: {
    fontSize: 14,
    color: "#9CA3AF",
    fontStyle: "italic",
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
    backgroundColor: "#F0FDF4",
  },
  dropdownModalItemText: {
    fontSize: 16,
    color: "#111827",
    fontWeight: "500",
    flex: 1,
  },
  dropdownModalItemTextSelected: {
    color: "#16A34A",
    fontWeight: "600",
  },
  totalPriceContainer: {
    backgroundColor: "#16A34A",
    borderRadius: 8,
    padding: 16,
    marginVertical: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
  modalActionButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
    marginBottom: 20,
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
  saveButton: {
    flex: 2,
    backgroundColor: "#16A34A",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  saveButtonDisabled: {
    backgroundColor: "#9CA3AF",
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
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
  detailContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
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
    flex: 1,
    textAlign: "right",
  },
  statusDetailBadge: {
    backgroundColor: "#10B981",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDetailBadgeSelected: {
    backgroundColor: "#FB923C",
  },
  statusDetailBadgeText: {
    fontSize: 12,
    color: "white",
    fontWeight: "500",
  },
  notesSection: {
    marginBottom: 16,
  },
  notesContainer: {
    backgroundColor: "#FFFBEB",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#FEF3C7",
    flexDirection: "row",
    gap: 8,
  },
  notesText: {
    flex: 1,
    fontSize: 14,
    color: "#92400E",
    lineHeight: 20,
  },
  priceSection: {
    backgroundColor: "#F0FDF4",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    marginBottom: 12,
  },
  priceSectionLabel: {
    fontSize: 14,
    color: "#15803D",
    marginBottom: 4,
  },
  priceSectionValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#15803D",
  },
  timestampSection: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  timestampRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  timestampText: {
    fontSize: 11,
    color: "#9CA3AF",
  },
  detailActionButtons: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    backgroundColor: "white",
  },
  deleteButton: {
    flex: 1,
    backgroundColor: "#EF4444",
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "white",
  },
  closeDetailButton: {
    flex: 2,
    backgroundColor: "#6B7280",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  closeDetailButtonText: {
    fontSize: 16,
    fontWeight: "500",
    color: "white",
  },
  imageModalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.95)",
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
  orderModalContainer: {
    backgroundColor: "white",
    borderRadius: 16,
    width: "100%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 20,
  },
  orderContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  kueInfoCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  kueInfoImage: {
    width: "100%",
    height: 120,
    borderRadius: 8,
    marginBottom: 12,
  },
  kueInfoTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 12,
    textAlign: "center",
  },
  kueInfoDetailsContainer: {
    gap: 6,
    marginBottom: 12,
  },
  kueInfoDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  kueInfoDetails: {
    fontSize: 13,
    color: "#6B7280",
  },
  kueInfoPrice: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#16A34A",
    textAlign: "center",
  },
  cakeNameInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: "#F9FAFB",
  },
  cakeNameInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: "#111827",
    marginLeft: 8,
  },
  inputHint: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 4,
    fontStyle: "italic",
  },
  orderModalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  addToCartButton: {
    flex: 2,
    backgroundColor: "#EA580C",
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  addToCartButtonDisabled: {
    backgroundColor: "#FED7AA",
    opacity: 0.6,
  },
  addToCartButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
});
