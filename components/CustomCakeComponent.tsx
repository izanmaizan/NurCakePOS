// components/CustomCakeComponent.tsx - Fixed with Filtered Dropdowns
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { usePricing } from "../hooks/usePricing";

const { width: screenWidth } = Dimensions.get("screen");
const isTablet = screenWidth >= 768;

// Types
interface AdditionalCost {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface CustomCakeForm {
  jenisKueId: string;
  variasiKueId: string;
  ukuranKueId: string;
  kotakKueId: string;
  quantity: number;
  images: string[];
  notes: string;
  additionalCosts: AdditionalCost[];
}

interface CustomCakeComponentProps {
  visible: boolean;
  onClose: () => void;
  onSave: (orderData: any) => void;
}

// Dropdown Component
const CriteriaDropdown: React.FC<{
  items: any[];
  selectedValue: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  onDropdownToggle?: (isOpen: boolean) => void;
}> = ({
  items,
  selectedValue,
  onValueChange,
  placeholder,
  disabled = false,
  onDropdownToggle,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const selectedItem = items.find((item) => item.id === selectedValue);

  const handleToggle = () => {
    if (!disabled && items.length > 0) {
      const newState = !isOpen;
      setIsOpen(newState);
      onDropdownToggle?.(newState);
    }
  };

  const handleSelect = (value: string) => {
    onValueChange(value);
    setTimeout(() => {
      setIsOpen(false);
      onDropdownToggle?.(false);
    }, 50);
  };

  const handleOverlayPress = () => {
    setIsOpen(false);
    onDropdownToggle?.(false);
  };

  return (
    <View style={[styles.dropdownContainer, isOpen && { zIndex: 9999 }]}>
      <TouchableOpacity
        activeOpacity={0.7}
        style={[
          styles.dropdownButton,
          disabled && styles.disabledInput,
          isOpen && styles.dropdownButtonOpen,
        ]}
        onPress={handleToggle}
        disabled={disabled || items.length === 0}>
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
          color={disabled ? "#D1D5DB" : "#6B7280"}
        />
      </TouchableOpacity>

      {isOpen && items.length > 0 && (
        <>
          <TouchableOpacity
            style={styles.dropdownOverlay}
            activeOpacity={1}
            onPress={handleOverlayPress}
          />

          <View style={styles.dropdownList}>
            <ScrollView
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={true}
              bounces={false}
              keyboardShouldPersistTaps="always"
              persistentScrollbar={true}
              contentContainerStyle={styles.dropdownScrollContent}>
              {items.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.7}
                  style={[
                    styles.dropdownItem,
                    selectedValue === item.id && styles.dropdownItemSelected,
                  ]}
                  onPress={() => handleSelect(item.id)}>
                  <Text
                    style={[
                      styles.dropdownItemText,
                      selectedValue === item.id &&
                        styles.dropdownItemTextSelected,
                    ]}>
                    {item.nama}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </>
      )}
    </View>
  );
};

export default function CustomCakeComponent({
  visible,
  onClose,
  onSave,
}: CustomCakeComponentProps) {
  const {
    masterKriteria,
    rulesHarga,
    getRulesHargaByCombination,
    loading,
    error,
  } = usePricing();

  const scrollViewRef = useRef<ScrollView>(null);
  const [scrollEnabled, setScrollEnabled] = useState(true);

  const [customCakeForm, setCustomCakeForm] = useState<CustomCakeForm>({
    jenisKueId: "",
    variasiKueId: "",
    ukuranKueId: "",
    kotakKueId: "",
    quantity: 1,
    images: [],
    notes: "",
    additionalCosts: [],
  });

  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [currentRules, setCurrentRules] = useState<any>(null);
  const [isCalculatingPrice, setIsCalculatingPrice] = useState(false);

  // Filter kriteria berdasarkan rules harga yang tersedia
  const availableJenisKue = useMemo(() => {
    const uniqueIds = new Set(rulesHarga.map((rule) => rule.jenisKueId));
    return masterKriteria.jenisKue.filter((item) => uniqueIds.has(item.id));
  }, [masterKriteria.jenisKue, rulesHarga]);

  const availableVariasiKue = useMemo(() => {
    if (!customCakeForm.jenisKueId) return [];

    const uniqueIds = new Set(
      rulesHarga
        .filter((rule) => rule.jenisKueId === customCakeForm.jenisKueId)
        .map((rule) => rule.variasiKueId)
    );
    return masterKriteria.variasiKue.filter((item) => uniqueIds.has(item.id));
  }, [customCakeForm.jenisKueId, masterKriteria.variasiKue, rulesHarga]);

  const availableUkuranKue = useMemo(() => {
    if (!customCakeForm.jenisKueId || !customCakeForm.variasiKueId) return [];

    const uniqueIds = new Set(
      rulesHarga
        .filter(
          (rule) =>
            rule.jenisKueId === customCakeForm.jenisKueId &&
            rule.variasiKueId === customCakeForm.variasiKueId
        )
        .map((rule) => rule.ukuranKueId)
    );
    return masterKriteria.ukuranKue.filter((item) => uniqueIds.has(item.id));
  }, [
    customCakeForm.jenisKueId,
    customCakeForm.variasiKueId,
    masterKriteria.ukuranKue,
    rulesHarga,
  ]);

  const availableKotakKue = useMemo(() => {
    if (
      !customCakeForm.jenisKueId ||
      !customCakeForm.variasiKueId ||
      !customCakeForm.ukuranKueId
    )
      return [];

    const uniqueIds = new Set(
      rulesHarga
        .filter(
          (rule) =>
            rule.jenisKueId === customCakeForm.jenisKueId &&
            rule.variasiKueId === customCakeForm.variasiKueId &&
            rule.ukuranKueId === customCakeForm.ukuranKueId
        )
        .map((rule) => rule.kotakKueId)
    );
    return masterKriteria.kotakKue.filter((item) => uniqueIds.has(item.id));
  }, [
    customCakeForm.jenisKueId,
    customCakeForm.variasiKueId,
    customCakeForm.ukuranKueId,
    masterKriteria.kotakKue,
    rulesHarga,
  ]);

  // Handle dropdown state to disable parent scroll
  const handleDropdownToggle = (isOpen: boolean) => {
    setScrollEnabled(!isOpen);
  };

  // Reset form when modal closes
  useEffect(() => {
    if (!visible) {
      resetCustomCakeForm();
      setScrollEnabled(true);
    }
  }, [visible]);

  // Calculate price when all criteria are selected
  useEffect(() => {
    const calculatePrice = async () => {
      if (
        customCakeForm.jenisKueId &&
        customCakeForm.variasiKueId &&
        customCakeForm.ukuranKueId &&
        customCakeForm.kotakKueId
      ) {
        try {
          setIsCalculatingPrice(true);
          const rulesHarga = await getRulesHargaByCombination(
            customCakeForm.jenisKueId,
            customCakeForm.variasiKueId,
            customCakeForm.ukuranKueId,
            customCakeForm.kotakKueId
          );

          if (rulesHarga) {
            setCurrentPrice(rulesHarga.hargaJual);
            setCurrentRules(rulesHarga);
          } else {
            setCurrentPrice(0);
            setCurrentRules(null);
            Toast.show({
              type: "warning",
              text1: "Peringatan",
              text2: "Kombinasi kriteria tidak ditemukan dalam rules harga",
            });
          }
        } catch (error) {
          console.error("Error calculating price:", error);
          setCurrentPrice(0);
          setCurrentRules(null);
        } finally {
          setIsCalculatingPrice(false);
        }
      } else {
        setCurrentPrice(0);
        setCurrentRules(null);
      }
    };

    calculatePrice();
  }, [
    customCakeForm.jenisKueId,
    customCakeForm.variasiKueId,
    customCakeForm.ukuranKueId,
    customCakeForm.kotakKueId,
    getRulesHargaByCombination,
  ]);

  const calculateAdditionalCostsTotal = (): number => {
    return customCakeForm.additionalCosts.reduce((sum, cost) => {
      return sum + cost.quantity * cost.unitPrice;
    }, 0);
  };

  const calculateUnitPrice = (): number => {
    const basePrice = currentPrice;
    const additionalCosts = calculateAdditionalCostsTotal();
    return basePrice + additionalCosts;
  };

  const calculateTotalPrice = (): number => {
    const unitPrice = calculateUnitPrice();
    return unitPrice * Math.max(1, customCakeForm.quantity);
  };

  const getSelectedNames = () => {
    const jenisKue = masterKriteria.jenisKue.find(
      (item) => item.id === customCakeForm.jenisKueId
    );
    const variasiKue = masterKriteria.variasiKue.find(
      (item) => item.id === customCakeForm.variasiKueId
    );
    const ukuranKue = masterKriteria.ukuranKue.find(
      (item) => item.id === customCakeForm.ukuranKueId
    );
    const kotakKue = masterKriteria.kotakKue.find(
      (item) => item.id === customCakeForm.kotakKueId
    );

    return { jenisKue, variasiKue, ukuranKue, kotakKue };
  };

  // Additional Cost Functions
  const addAdditionalCost = () => {
    const newCost: AdditionalCost = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      name: "",
      quantity: 1,
      unitPrice: 0,
      subtotal: 0,
    };
    setCustomCakeForm((prev) => ({
      ...prev,
      additionalCosts: [...prev.additionalCosts, newCost],
    }));
  };

  const updateAdditionalCost = (
    id: string,
    field: keyof AdditionalCost,
    value: string | number
  ) => {
    setCustomCakeForm((prev) => ({
      ...prev,
      additionalCosts: prev.additionalCosts.map((cost) => {
        if (cost.id === id) {
          const updated = { ...cost };
          if (field === "name") {
            updated.name = String(value);
          } else if (field === "quantity") {
            updated.quantity = Math.max(0, Number(value) || 0);
          } else if (field === "unitPrice") {
            updated.unitPrice = Math.max(0, Number(value) || 0);
          }
          updated.subtotal = updated.quantity * updated.unitPrice;
          return updated;
        }
        return cost;
      }),
    }));
  };

  const removeAdditionalCost = (id: string) => {
    setCustomCakeForm((prev) => ({
      ...prev,
      additionalCosts: prev.additionalCosts.filter((cost) => cost.id !== id),
    }));
  };

  // Image Picker Functions
  const pickImages = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 5 - customCakeForm.images.length,
      });

      if (!result.canceled && result.assets) {
        const newImages = result.assets.map((asset) => asset.uri);
        setCustomCakeForm((prev) => ({
          ...prev,
          images: [...prev.images, ...newImages],
        }));
      }
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Gagal memilih gambar",
      });
    }
  };

  const removeImage = (index: number) => {
    setCustomCakeForm((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  // Reset Custom Cake Form
  const resetCustomCakeForm = () => {
    setCustomCakeForm({
      jenisKueId: "",
      variasiKueId: "",
      ukuranKueId: "",
      kotakKueId: "",
      quantity: 1,
      images: [],
      notes: "",
      additionalCosts: [],
    });
    setCurrentPrice(0);
    setCurrentRules(null);
  };

  // Save Custom Cake Order
  const saveCustomCakeOrder = () => {
    if (!currentPrice || currentPrice <= 0) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Kombinasi kriteria tidak valid atau belum lengkap",
      });
      return;
    }

    if (customCakeForm.quantity < 1) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Jumlah minimal adalah 1",
      });
      return;
    }

    const { jenisKue, variasiKue, ukuranKue, kotakKue } = getSelectedNames();

    const orderData = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      name: `Kue Custom - ${jenisKue?.nama} ${variasiKue?.nama} ${ukuranKue?.nama} ${kotakKue?.nama}`,
      quantity: customCakeForm.quantity,
      unitPrice: calculateUnitPrice(),
      subtotal: calculateTotalPrice(),
      type: "kue_custom",
      customDetails: {
        cakeType: jenisKue?.nama || "",
        variation: variasiKue?.nama || "",
        size: ukuranKue?.nama || "",
        box: kotakKue?.nama || "",
        images: customCakeForm.images,
        notes: customCakeForm.notes,
        additionalCosts: customCakeForm.additionalCosts,
        rulesHargaId: currentRules?.id,
        hargaModal: currentRules?.hargaModal || 0,
        hargaJual: currentRules?.hargaJual || 0,
        margin: currentRules?.margin || 0,
      },
    };

    onSave(orderData);
    onClose();

    Toast.show({
      type: "success",
      text1: "Berhasil",
      text2: "Pesanan kue custom ditambahkan ke transaksi",
    });
  };

  const handleClose = () => {
    onClose();
  };

  if (loading) {
    return (
      <Modal visible={visible} transparent>
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContent}>
            <ActivityIndicator size="large" color="#EA580C" />
            <Text style={styles.loadingText}>Memuat data...</Text>
          </View>
        </View>
      </Modal>
    );
  }

  if (error) {
    return (
      <Modal visible={visible} transparent>
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContent}>
            <Ionicons name="alert-circle" size={48} color="#EF4444" />
            <Text style={styles.errorText}>Terjadi Kesalahan</Text>
            <Text style={styles.errorDescription}>{error}</Text>
            <TouchableOpacity
              style={styles.closeErrorButton}
              onPress={handleClose}>
              <Text style={styles.closeErrorButtonText}>Tutup</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}>
      <View style={styles.fullScreenBackdrop}>
        <SafeAreaView style={styles.fullScreenModalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Pesan Kue Custom</Text>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.modalCloseButton}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView
            ref={scrollViewRef}
            style={styles.modalContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={scrollEnabled}
            contentContainerStyle={{ paddingBottom: 100 }}>
            {/* Kriteria Selection */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Kriteria Kue</Text>

              {/* Jenis Kue */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Jenis Kue *</Text>
                <CriteriaDropdown
                  items={availableJenisKue}
                  selectedValue={customCakeForm.jenisKueId}
                  onValueChange={(value) =>
                    setCustomCakeForm((prev) => ({
                      ...prev,
                      jenisKueId: value,
                      variasiKueId: "",
                      ukuranKueId: "",
                      kotakKueId: "",
                    }))
                  }
                  placeholder="Pilih Jenis Kue"
                  onDropdownToggle={handleDropdownToggle}
                />
                {availableJenisKue.length === 0 && (
                  <Text style={styles.noOptionsText}>
                    Belum ada jenis kue dengan rules harga. Tambahkan di menu
                    Kelola Harga.
                  </Text>
                )}
              </View>

              {/* Variasi Kue */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Variasi Kue *</Text>
                <CriteriaDropdown
                  items={availableVariasiKue}
                  selectedValue={customCakeForm.variasiKueId}
                  onValueChange={(value) =>
                    setCustomCakeForm((prev) => ({
                      ...prev,
                      variasiKueId: value,
                      ukuranKueId: "",
                      kotakKueId: "",
                    }))
                  }
                  placeholder="Pilih Variasi Kue"
                  disabled={!customCakeForm.jenisKueId}
                  onDropdownToggle={handleDropdownToggle}
                />
                {customCakeForm.jenisKueId &&
                  availableVariasiKue.length === 0 && (
                    <Text style={styles.noOptionsText}>
                      Tidak ada variasi kue yang tersedia untuk jenis kue ini.
                    </Text>
                  )}
              </View>

              {/* Ukuran Kue */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Ukuran Kue *</Text>
                <CriteriaDropdown
                  items={availableUkuranKue}
                  selectedValue={customCakeForm.ukuranKueId}
                  onValueChange={(value) =>
                    setCustomCakeForm((prev) => ({
                      ...prev,
                      ukuranKueId: value,
                      kotakKueId: "",
                    }))
                  }
                  placeholder="Pilih Ukuran Kue"
                  disabled={!customCakeForm.variasiKueId}
                  onDropdownToggle={handleDropdownToggle}
                />
                {customCakeForm.variasiKueId &&
                  availableUkuranKue.length === 0 && (
                    <Text style={styles.noOptionsText}>
                      Tidak ada ukuran kue yang tersedia untuk kombinasi ini.
                    </Text>
                  )}
              </View>

              {/* Kotak Kue */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Kotak Kue *</Text>
                <CriteriaDropdown
                  items={availableKotakKue}
                  selectedValue={customCakeForm.kotakKueId}
                  onValueChange={(value) =>
                    setCustomCakeForm((prev) => ({
                      ...prev,
                      kotakKueId: value,
                    }))
                  }
                  placeholder="Pilih Kotak Kue"
                  disabled={!customCakeForm.ukuranKueId}
                  onDropdownToggle={handleDropdownToggle}
                />
                {customCakeForm.ukuranKueId &&
                  availableKotakKue.length === 0 && (
                    <Text style={styles.noOptionsText}>
                      Tidak ada kotak kue yang tersedia untuk kombinasi ini.
                    </Text>
                  )}
              </View>
            </View>

            {/* Jumlah */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Detail Pesanan</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Jumlah *</Text>
                <TextInput
                  style={styles.textInput}
                  value={customCakeForm.quantity.toString()}
                  onChangeText={(text) =>
                    setCustomCakeForm((prev) => ({
                      ...prev,
                      quantity: Math.max(1, parseInt(text) || 1),
                    }))
                  }
                  keyboardType="numeric"
                  placeholder="Masukkan jumlah"
                />
              </View>
            </View>

            {/* Biaya Tambahan */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderContainer}>
                <Text style={styles.sectionTitle}>Biaya Tambahan</Text>
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={addAdditionalCost}>
                  <Ionicons name="add" size={16} color="white" />
                  <Text style={styles.addButtonText}>Tambah</Text>
                </TouchableOpacity>
              </View>

              {customCakeForm.additionalCosts.length === 0 ? (
                <Text style={styles.emptyStateText}>
                  Belum ada biaya tambahan
                </Text>
              ) : (
                customCakeForm.additionalCosts.map((cost) => (
                  <View key={cost.id} style={styles.additionalCostItem}>
                    <View style={styles.additionalCostRow}>
                      <TextInput
                        style={[styles.textInput, styles.flexInput]}
                        placeholder="Nama item"
                        value={cost.name}
                        onChangeText={(text) =>
                          updateAdditionalCost(cost.id, "name", text)
                        }
                      />
                      <TouchableOpacity
                        onPress={() => removeAdditionalCost(cost.id)}
                        style={styles.removeButton}>
                        <Ionicons name="trash" size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.additionalCostRow}>
                      <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>Jumlah</Text>
                        <TextInput
                          style={styles.textInput}
                          placeholder="Qty"
                          value={cost.quantity.toString()}
                          onChangeText={(text) =>
                            updateAdditionalCost(
                              cost.id,
                              "quantity",
                              parseInt(text) || 0
                            )
                          }
                          keyboardType="numeric"
                        />
                      </View>
                      <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>Harga</Text>
                        <TextInput
                          style={styles.textInput}
                          placeholder="Harga per item"
                          value={cost.unitPrice.toString()}
                          onChangeText={(text) =>
                            updateAdditionalCost(
                              cost.id,
                              "unitPrice",
                              parseInt(text) || 0
                            )
                          }
                          keyboardType="numeric"
                        />
                      </View>
                      <View style={styles.subtotalContainer}>
                        <Text style={styles.inputLabel}>Subtotal</Text>
                        <Text style={styles.subtotalText}>
                          Rp {cost.subtotal.toLocaleString("id-ID")}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>

            {/* Images Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Gambar Model Kue</Text>

              <TouchableOpacity
                style={styles.imageUploadButton}
                onPress={pickImages}
                disabled={customCakeForm.images.length >= 5}>
                <Ionicons name="camera" size={24} color="#6B7280" />
                <Text style={styles.imageUploadText}>
                  {customCakeForm.images.length === 0
                    ? "Pilih Gambar"
                    : `Tambah Gambar (${customCakeForm.images.length}/5)`}
                </Text>
              </TouchableOpacity>

              {customCakeForm.images.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.imagePreviewContainer}>
                  {customCakeForm.images.map((uri, index) => (
                    <View key={index} style={styles.imagePreviewItem}>
                      <Image source={{ uri }} style={styles.imagePreview} />
                      <TouchableOpacity
                        style={styles.removeImageButton}
                        onPress={() => removeImage(index)}>
                        <Ionicons
                          name="close-circle"
                          size={20}
                          color="#EF4444"
                        />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>

            {/* Catatan */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Catatan (Opsional)</Text>
              <TextInput
                style={[styles.textInput, styles.notesInput]}
                value={customCakeForm.notes}
                onChangeText={(text) =>
                  setCustomCakeForm((prev) => ({ ...prev, notes: text }))
                }
                placeholder="Catatan khusus untuk pesanan..."
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* Price Breakdown */}
            {currentPrice > 0 && currentRules && (
              <View style={styles.priceBreakdownContainer}>
                <Text style={styles.priceBreakdownTitle}>Rincian Harga:</Text>
                <View style={styles.priceBreakdownItem}>
                  {/* <Text style={styles.priceBreakdownLabel}>Harga Modal:</Text> */}
                  <Text style={styles.priceBreakdownValue}>
                    Rp {currentRules.hargaModal.toLocaleString("id-ID")}
                  </Text>
                </View>
                <View style={styles.priceBreakdownItem}>
                  <Text style={styles.priceBreakdownLabel}>
                    Harga Jual Kue:
                  </Text>
                  <Text style={styles.priceBreakdownValue}>
                    Rp {currentPrice.toLocaleString("id-ID")}
                  </Text>
                </View>
                {/* <View style={styles.priceBreakdownItem}>
                <Text style={styles.priceBreakdownLabel}>Margin:</Text>
                <Text style={[styles.priceBreakdownValue, { color: "#10B981" }]}>
                  {currentRules.margin}%
                </Text>
              </View> */}
                {customCakeForm.additionalCosts.length > 0 && (
                  <View style={styles.priceBreakdownItem}>
                    <Text style={styles.priceBreakdownLabel}>
                      Biaya Tambahan:
                    </Text>
                    <Text style={styles.priceBreakdownValue}>
                      +Rp{" "}
                      {calculateAdditionalCostsTotal().toLocaleString("id-ID")}
                    </Text>
                  </View>
                )}
                <View
                  style={[
                    styles.priceBreakdownItem,
                    styles.priceBreakdownTotal,
                  ]}>
                  <Text style={styles.priceBreakdownTotalLabel}>
                    Harga per Unit:
                  </Text>
                  <Text style={styles.priceBreakdownTotalValue}>
                    Rp {calculateUnitPrice().toLocaleString("id-ID")}
                  </Text>
                </View>
                {customCakeForm.quantity > 1 && (
                  <View style={styles.priceBreakdownItem}>
                    <Text style={styles.priceBreakdownLabel}>
                      Jumlah: {customCakeForm.quantity} unit
                    </Text>
                    <Text style={styles.priceBreakdownValue}></Text>
                  </View>
                )}
              </View>
            )}

            {/* Total Price */}
            <View style={styles.totalPriceContainer}>
              <Text style={styles.totalPriceLabel}>Total Harga:</Text>
              <Text style={styles.totalPriceValue}>
                {isCalculatingPrice
                  ? "Menghitung..."
                  : `Rp ${calculateTotalPrice().toLocaleString("id-ID")}`}
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.modalActionButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleClose}>
                <Text style={styles.cancelButtonText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  (!currentPrice || currentPrice <= 0) &&
                    styles.saveButtonDisabled,
                ]}
                onPress={saveCustomCakeOrder}
                disabled={
                  !currentPrice || currentPrice <= 0 || isCalculatingPrice
                }>
                <Text style={styles.saveButtonText}>Simpan Pesanan</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 16,
  },
  sectionHeaderContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
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
    minHeight: 100,
  },
  noOptionsText: {
    fontSize: 12,
    color: "#EF4444",
    marginTop: 4,
    fontStyle: "italic",
  },
  addButton: {
    backgroundColor: "#2563EB",
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  addButtonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "500",
    marginLeft: 4,
  },
  emptyStateText: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
    fontStyle: "italic",
    paddingVertical: 20,
  },
  additionalCostItem: {
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  additionalCostRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 8,
  },
  flexInput: {
    flex: 1,
    marginRight: 8,
  },
  inputContainer: {
    flex: 1,
    marginHorizontal: 4,
  },
  subtotalContainer: {
    flex: 1,
    marginLeft: 8,
  },
  subtotalText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#10B981",
    marginTop: 8,
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
  removeButton: {
    padding: 8,
  },
  imageUploadButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    borderStyle: "dashed",
    borderRadius: 8,
    backgroundColor: "#F9FAFB",
    marginBottom: 16,
  },
  imageUploadText: {
    fontSize: 14,
    color: "#6B7280",
    marginLeft: 8,
  },
  imagePreviewContainer: {
    marginTop: 12,
  },
  imagePreviewItem: {
    position: "relative",
    marginRight: 8,
  },
  imagePreview: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
  },
  removeImageButton: {
    position: "absolute",
    // top: -1,
    right: -2,
    backgroundColor: "white",
    borderRadius: 10,
  },
  priceBreakdownContainer: {
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
  },
  priceBreakdownTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 12,
  },
  priceBreakdownItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  priceBreakdownLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  priceBreakdownValue: {
    fontSize: 14,
    fontWeight: "500",
    color: "#111827",
  },
  priceBreakdownTotal: {
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 8,
    marginTop: 8,
  },
  priceBreakdownTotalLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  priceBreakdownTotalValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#10B981",
  },
  totalPriceContainer: {
    backgroundColor: "#FEF3C7",
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalPriceLabel: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  totalPriceValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#EA580C",
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
    backgroundColor: "#EA580C",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  saveButtonDisabled: {
    backgroundColor: "#FED7AA",
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
  loadingOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingContent: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 8,
    alignItems: "center",
    minWidth: 200,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6B7280",
  },
  errorText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#EF4444",
    marginTop: 12,
    textAlign: "center",
  },
  errorDescription: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 8,
    textAlign: "center",
  },
  closeErrorButton: {
    backgroundColor: "#EA580C",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginTop: 16,
  },
  closeErrorButtonText: {
    color: "white",
    fontWeight: "500",
  },
  // Dropdown Styles
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
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderColor: "#EA580C",
  },
  dropdownButtonText: {
    fontSize: 16,
    color: "#111827",
    flex: 1,
  },
  dropdownPlaceholder: {
    color: "#9CA3AF",
  },
  dropdownList: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    backgroundColor: "white",
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: "#EA580C",
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    maxHeight: 300,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 10001,
  },
  dropdownScrollContent: {
    paddingVertical: 4,
  },
  dropdownItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    backgroundColor: "white",
    minHeight: 48,
  },
  dropdownItemSelected: {
    backgroundColor: "#FEF3F2",
  },
  dropdownItemText: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "500",
    lineHeight: 20,
  },
  dropdownItemTextSelected: {
    color: "#EA580C",
    fontWeight: "600",
  },
  dropdownOverlay: {
    position: "absolute",
    top: -10000,
    left: -10000,
    right: -10000,
    bottom: -10000,
    backgroundColor: "transparent",
    zIndex: 10000,
  },
  disabledInput: {
    opacity: 0.6,
    backgroundColor: "#F3F4F6",
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
