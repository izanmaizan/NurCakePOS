// app/kelola-harga.tsx - Complete Fixed Version with Modal Dropdown
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
  KriteriaItem,
  RulesHargaWithDetails,
  usePricing,
} from "../hooks/usePricing";

type TabType = "kriteria" | "rules";
type KriteriaType = "jenisKue" | "variasiKue" | "ukuranKue" | "kotakKue";

interface RulesForm {
  jenisKueId: string;
  variasiKueId: string;
  ukuranKueId: string;
  kotakKueId: string;
  hargaModal: string;
  hargaJual: string;
}

/**
 * Komponen Dropdown dengan Modal Bottom Sheet
 * Menggunakan modal terpisah untuk menghindari konflik scroll dengan parent modal
 */
const CriteriaDropdown: React.FC<{
  items: KriteriaItem[];
  selectedValue: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  dropdownId: string;
  isOpen: boolean;
  onDropdownToggle?: (isOpen: boolean) => void;
}> = ({
  items,
  selectedValue,
  onValueChange,
  placeholder,
  disabled = false,
  dropdownId,
  isOpen,
  onDropdownToggle,
}) => {
  const selectedItem = items.find((item) => item.id === selectedValue);

  const handleToggle = () => {
    if (!disabled && items.length > 0) {
      onDropdownToggle?.(!isOpen);
    }
  };

  const handleSelect = (value: string) => {
    onValueChange(value);
    setTimeout(() => {
      onDropdownToggle?.(false);
    }, 50);
  };

  const handleClose = () => {
    onDropdownToggle?.(false);
  };

  return (
    <View style={styles.dropdownContainer}>
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
        <Modal
          visible={isOpen}
          transparent={true}
          animationType="fade"
          onRequestClose={handleClose}>
          <TouchableOpacity
            style={styles.dropdownModalOverlay}
            activeOpacity={1}
            onPress={handleClose}>
            <View style={styles.dropdownModalContent}>
              <View style={styles.dropdownModalHeader}>
                <Text style={styles.dropdownModalTitle}>{placeholder}</Text>
                <TouchableOpacity onPress={handleClose}>
                  <Ionicons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.dropdownModalList}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}>
                {items.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    activeOpacity={0.7}
                    style={[
                      styles.dropdownModalItem,
                      selectedValue === item.id &&
                        styles.dropdownModalItemSelected,
                    ]}
                    onPress={() => handleSelect(item.id)}>
                    <Text
                      style={[
                        styles.dropdownModalItemText,
                        selectedValue === item.id &&
                          styles.dropdownModalItemTextSelected,
                      ]}>
                      {item.nama}
                    </Text>
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

export default function KelolaHargaScreen() {
  const insets = useSafeAreaInsets();
  const { isInitialized } = useDatabase();
  const {
    masterKriteria,
    rulesHarga,
    loading,
    error,
    addKriteriaItem,
    updateKriteriaItem,
    deleteKriteriaItem,
    addRulesHarga,
    updateRulesHarga,
    deleteRulesHarga,
    searchRulesHarga,
    calculateMargin,
    getPricingStats,
    checkCombinationExists,
    refetch,
  } = usePricing();

  // State untuk tab dan kriteria aktif
  const [activeTab, setActiveTab] = useState<TabType>("kriteria");
  const [activeKriteria, setActiveKriteria] =
    useState<KriteriaType>("jenisKue");

  // State untuk modal management
  const [showKriteriaModal, setShowKriteriaModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [editingKriteria, setEditingKriteria] = useState<KriteriaItem | null>(
    null
  );
  const [editingRules, setEditingRules] =
    useState<RulesHargaWithDetails | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  // State untuk form data
  const [kriteriaForm, setKriteriaForm] = useState({ nama: "" });
  const [rulesForm, setRulesForm] = useState<RulesForm>({
    jenisKueId: "",
    variasiKueId: "",
    ukuranKueId: "",
    kotakKueId: "",
    hargaModal: "",
    hargaJual: "",
  });

  // State untuk search dan filter
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredRules, setFilteredRules] = useState<RulesHargaWithDetails[]>(
    []
  );
  const [stats, setStats] = useState({
    totalRules: 0,
    averageMargin: 0,
    totalKriteria: { jenisKue: 0, variasiKue: 0, ukuranKue: 0, kotakKue: 0 },
  });

  /**
   * Handle dropdown toggle untuk mengontrol state dropdown
   */
  const handleDropdownToggle = (dropdownId: string, isOpen: boolean) => {
    setOpenDropdownId(isOpen ? dropdownId : null);
  };

  /**
   * Update filtered rules dengan debounce 300ms agar tidak query tiap keystroke
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      const filtered = searchRulesHarga(searchTerm);
      setFilteredRules(filtered);
    }, 300);
    return () => clearTimeout(timer);
  }, [rulesHarga, searchTerm, searchRulesHarga]);

  /**
   * Update statistik ketika rules berubah
   */
  useEffect(() => {
    const updateStats = async () => {
      try {
        const statsData = await getPricingStats();
        setStats(statsData);
      } catch (error) {
        console.error("Error getting stats:", error);
      }
    };
    updateStats();
  }, [rulesHarga, getPricingStats]);

  /**
   * Navigate kembali ke halaman sebelumnya
   */
  const handleBack = () => {
    router.back();
  };

  /**
   * Konfigurasi untuk setiap tipe kriteria
   */
  const kriteriaConfig = {
    jenisKue: { title: "Jenis Kue", data: masterKriteria.jenisKue },
    variasiKue: { title: "Variasi Kue", data: masterKriteria.variasiKue },
    ukuranKue: { title: "Ukuran Kue", data: masterKriteria.ukuranKue },
    kotakKue: { title: "Kotak Kue", data: masterKriteria.kotakKue },
  };

  /**
   * Buka modal untuk tambah/edit kriteria
   */
  const openKriteriaModal = (item?: KriteriaItem) => {
    if (item) {
      setEditingKriteria(item);
      setKriteriaForm({ nama: item.nama });
    } else {
      setEditingKriteria(null);
      setKriteriaForm({ nama: "" });
    }
    setShowKriteriaModal(true);
  };

  /**
   * Tutup modal kriteria dan reset form
   */
  const closeKriteriaModal = () => {
    setShowKriteriaModal(false);
    setEditingKriteria(null);
    setKriteriaForm({ nama: "" });
  };

  /**
   * Simpan kriteria (tambah atau update)
   */
  const saveKriteria = async () => {
    if (!kriteriaForm.nama.trim()) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Nama kriteria harus diisi",
      });
      return;
    }

    try {
      setSubmitting(true);

      if (editingKriteria) {
        await updateKriteriaItem(
          activeKriteria,
          editingKriteria.id,
          kriteriaForm.nama.trim()
        );
        Toast.show({
          type: "success",
          text1: "Berhasil",
          text2: "Kriteria berhasil diperbarui",
        });
      } else {
        await addKriteriaItem(activeKriteria, kriteriaForm.nama.trim());
        Toast.show({
          type: "success",
          text1: "Berhasil",
          text2: "Kriteria berhasil ditambahkan",
        });
      }

      closeKriteriaModal();
    } catch (error: any) {
      console.error("Error saving kriteria:", error);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: error.message || "Gagal menyimpan kriteria",
      });
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Hapus kriteria dengan konfirmasi
   */
  const handleDeleteKriteria = (id: string, nama: string) => {
    Alert.alert(
      "Hapus Kriteria",
      `Apakah Anda yakin ingin menghapus kriteria "${nama}"?`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteKriteriaItem(activeKriteria, id);
              Toast.show({
                type: "success",
                text1: "Berhasil",
                text2: "Kriteria berhasil dihapus",
              });
            } catch (error: any) {
              Toast.show({
                type: "error",
                text1: "Error",
                text2: error.message || "Gagal menghapus kriteria",
              });
            }
          },
        },
      ]
    );
  };

  /**
   * Buka modal untuk tambah/edit rules harga
   */
  const openRulesModal = (rule?: RulesHargaWithDetails) => {
    if (rule) {
      setEditingRules(rule);
      setRulesForm({
        jenisKueId: rule.jenisKueId,
        variasiKueId: rule.variasiKueId,
        ukuranKueId: rule.ukuranKueId,
        kotakKueId: rule.kotakKueId,
        hargaModal: rule.hargaModal.toString(),
        hargaJual: rule.hargaJual.toString(),
      });
    } else {
      setEditingRules(null);
      setRulesForm({
        jenisKueId: "",
        variasiKueId: "",
        ukuranKueId: "",
        kotakKueId: "",
        hargaModal: "",
        hargaJual: "",
      });
    }
    setShowRulesModal(true);
  };

  /**
   * Tutup modal rules dan reset form
   */
  const closeRulesModal = () => {
    setShowRulesModal(false);
    setEditingRules(null);
    setOpenDropdownId(null);
    setRulesForm({
      jenisKueId: "",
      variasiKueId: "",
      ukuranKueId: "",
      kotakKueId: "",
      hargaModal: "",
      hargaJual: "",
    });
  };

  /**
   * Simpan rules harga dengan validasi lengkap
   */
  const saveRules = async () => {
    if (
      !rulesForm.jenisKueId ||
      !rulesForm.variasiKueId ||
      !rulesForm.ukuranKueId ||
      !rulesForm.kotakKueId ||
      !rulesForm.hargaModal ||
      !rulesForm.hargaJual
    ) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Semua field harus diisi",
      });
      return;
    }

    const hargaModal = parseInt(rulesForm.hargaModal);
    const hargaJual = parseInt(rulesForm.hargaJual);

    if (hargaJual <= hargaModal) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Harga jual harus lebih tinggi dari harga modal",
      });
      return;
    }

    const isDuplicate = checkCombinationExists(
      rulesForm.jenisKueId,
      rulesForm.variasiKueId,
      rulesForm.ukuranKueId,
      rulesForm.kotakKueId,
      editingRules?.id
    );

    if (isDuplicate) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Kombinasi kriteria ini sudah ada",
      });
      return;
    }

    try {
      setSubmitting(true);

      const rulesData = {
        jenisKueId: rulesForm.jenisKueId,
        variasiKueId: rulesForm.variasiKueId,
        ukuranKueId: rulesForm.ukuranKueId,
        kotakKueId: rulesForm.kotakKueId,
        hargaModal,
        hargaJual,
      };

      if (editingRules) {
        await updateRulesHarga(editingRules.id, rulesData);
        Toast.show({
          type: "success",
          text1: "Berhasil",
          text2: "Rules harga berhasil diperbarui",
        });
      } else {
        await addRulesHarga(rulesData);
        Toast.show({
          type: "success",
          text1: "Berhasil",
          text2: "Rules harga berhasil ditambahkan",
        });
      }

      closeRulesModal();
    } catch (error: any) {
      console.error("Error saving rules:", error);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: error.message || "Gagal menyimpan rules harga",
      });
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Hapus rules harga dengan konfirmasi
   */
  const handleDeleteRules = (id: string, title: string) => {
    Alert.alert(
      "Hapus Rules Harga",
      `Apakah Anda yakin ingin menghapus rules harga "${title}"?`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteRulesHarga(id);
              Toast.show({
                type: "success",
                text1: "Berhasil",
                text2: "Rules harga berhasil dihapus",
              });
            } catch (error: any) {
              Toast.show({
                type: "error",
                text1: "Error",
                text2: error.message || "Gagal menghapus rules harga",
              });
            }
          },
        },
      ]
    );
  };

  /**
   * Hitung margin saat ini berdasarkan input harga
   */
  const currentMargin =
    rulesForm.hargaModal && rulesForm.hargaJual
      ? calculateMargin(
          parseInt(rulesForm.hargaModal),
          parseInt(rulesForm.hargaJual)
        )
      : 0;

  /**
   * Render tab kriteria dengan list kriteria yang bisa diedit
   */
  const renderKriteriaTab = () => (
    <View style={styles.tabContent}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.kriteriaSelector}
        contentContainerStyle={styles.kriteriaSelectorContent}>
        {Object.entries(kriteriaConfig).map(([key, config]) => (
          <TouchableOpacity
            key={key}
            style={[
              styles.kriteriaSelectorButton,
              activeKriteria === key && styles.kriteriaSelectorButtonActive,
            ]}
            onPress={() => setActiveKriteria(key as KriteriaType)}>
            <Text
              style={[
                styles.kriteriaSelectorText,
                activeKriteria === key && styles.kriteriaSelectorTextActive,
              ]}>
              {config.title}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.addButtonContainer}>
        <Button
          title={`Tambah ${kriteriaConfig[activeKriteria].title}`}
          onPress={() => openKriteriaModal()}
          icon="add"
          size="small"
          disabled={loading}
        />
      </View>

      <View style={styles.kriteriaList}>
        <Text style={styles.sectionTitle}>
          {kriteriaConfig[activeKriteria].title} (
          {kriteriaConfig[activeKriteria].data.length})
        </Text>
        {kriteriaConfig[activeKriteria].data.length === 0 ? (
          <EmptyState
            icon="cube-outline"
            title={`Belum ada ${kriteriaConfig[activeKriteria].title.toLowerCase()}`}
            description={`Tambahkan ${kriteriaConfig[activeKriteria].title.toLowerCase()} pertama untuk mulai membuat rules harga`}
          />
        ) : (
          kriteriaConfig[activeKriteria].data.map((item) => (
            <View key={item.id} style={styles.kriteriaItem}>
              <Text style={styles.kriteriaItemName}>{item.nama}</Text>
              <View style={styles.kriteriaItemActions}>
                <TouchableOpacity
                  onPress={() => openKriteriaModal(item)}
                  style={styles.editButton}>
                  <Ionicons name="create" size={16} color="#2563EB" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDeleteKriteria(item.id, item.nama)}
                  style={styles.deleteButton}>
                  <Ionicons name="trash" size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>
    </View>
  );

  /**
   * Render tab rules dengan list rules harga dan statistik
   */
  const renderRulesTab = () => (
    <View style={styles.tabContent}>
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
            placeholder="Cari rules harga..."
            placeholderTextColor="#9CA3AF"
          />
          {searchTerm && (
            <TouchableOpacity
              onPress={() => setSearchTerm("")}
              style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.addButtonContainer}>
        <Button
          title="Tambah Rules Harga"
          onPress={() => openRulesModal()}
          icon="add"
          size="small"
          disabled={loading}
        />
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.totalRules}</Text>
          <Text style={styles.statLabel}>Total Rules</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.averageMargin}%</Text>
          <Text style={styles.statLabel}>Rata-rata Margin</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>
            {Object.values(stats.totalKriteria).reduce((a, b) => a + b, 0)}
          </Text>
          <Text style={styles.statLabel}>Total Kriteria</Text>
        </View>
      </View>

      <View style={styles.rulesList}>
        <Text style={styles.sectionTitle}>
          Rules Harga ({filteredRules.length})
        </Text>
        {filteredRules.length === 0 ? (
          <EmptyState
            icon="pricetag-outline"
            title={searchTerm ? "Rules tidak ditemukan" : "Belum ada rules harga"}
            description={searchTerm ? "Coba ubah kata kunci pencarian" : "Buat rules harga pertama dengan menentukan kriteria dan harga"}
            actionLabel={searchTerm ? "Hapus Pencarian" : undefined}
            onAction={searchTerm ? () => setSearchTerm("") : undefined}
          />
        ) : (
          filteredRules.map((rule) => (
            <View key={rule.id} style={styles.ruleItem}>
              <View style={styles.ruleItemHeader}>
                <Text style={styles.ruleItemTitle}>
                  {rule.jenisKue} - {rule.variasiKue}
                </Text>
                <View style={styles.ruleItemActions}>
                  <TouchableOpacity
                    onPress={() => openRulesModal(rule)}
                    style={styles.editButton}>
                    <Ionicons name="create" size={16} color="#2563EB" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() =>
                      handleDeleteRules(
                        rule.id,
                        `${rule.jenisKue} - ${rule.variasiKue}`
                      )
                    }
                    style={styles.deleteButton}>
                    <Ionicons name="trash" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={styles.ruleItemSubtitle}>
                {rule.ukuranKue} | {rule.kotakKue}
              </Text>
              <View style={styles.ruleItemPrices}>
                <View style={styles.priceItem}>
                  <Text style={styles.priceLabel}>Modal</Text>
                  <Text style={styles.priceValue}>
                    Rp {rule.hargaModal.toLocaleString("id-ID")}
                  </Text>
                </View>
                <View style={styles.priceItem}>
                  <Text style={styles.priceLabel}>Jual</Text>
                  <Text style={[styles.priceValue, { color: "#10B981" }]}>
                    Rp {rule.hargaJual.toLocaleString("id-ID")}
                  </Text>
                </View>
                <View style={styles.marginBadge}>
                  <Text style={styles.marginText}>{rule.margin}%</Text>
                </View>
              </View>
            </View>
          ))
        )}
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
          <Text style={styles.headerTitle}>Kelola Harga</Text>
          <View style={styles.headerRight} />
        </View>
        <SkeletonList count={5} />
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
          <Text style={styles.headerTitle}>Kelola Harga</Text>
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
        <BottomNavigation currentPage="kelola-harga" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Kelola Harga</Text>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.tabNavigation}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === "kriteria" && styles.tabButtonActive,
          ]}
          onPress={() => setActiveTab("kriteria")}>
          <Ionicons
            name="settings"
            size={20}
            color={activeTab === "kriteria" ? "#EA580C" : "#6B7280"}
          />
          <Text
            style={[
              styles.tabButtonText,
              activeTab === "kriteria" && styles.tabButtonTextActive,
            ]}>
            Kriteria
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === "rules" && styles.tabButtonActive,
          ]}
          onPress={() => setActiveTab("rules")}>
          <Ionicons
            name="pricetag"
            size={20}
            color={activeTab === "rules" ? "#EA580C" : "#6B7280"}
          />
          <Text
            style={[
              styles.tabButtonText,
              activeTab === "rules" && styles.tabButtonTextActive,
            ]}>
            Rules Harga
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: 24,
          },
        ]}
        showsVerticalScrollIndicator={false}>
        {activeTab === "kriteria" ? renderKriteriaTab() : renderRulesTab()}
      </ScrollView>

      {submitting && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContent}>
            <ActivityIndicator size="large" color="#EA580C" />
            <Text style={styles.loadingOverlayText}>Memproses...</Text>
          </View>
        </View>
      )}

      <Modal
        visible={showKriteriaModal}
        animationType="slide"
        transparent={true}
        onRequestClose={closeKriteriaModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainerRounded}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingKriteria ? "Edit" : "Tambah"}{" "}
                {kriteriaConfig[activeKriteria].title}
              </Text>
              <TouchableOpacity
                onPress={closeKriteriaModal}
                style={styles.modalCloseButton}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Nama {kriteriaConfig[activeKriteria].title} *
                </Text>
                <TextInput
                  style={styles.textInput}
                  value={kriteriaForm.nama}
                  onChangeText={(text) => setKriteriaForm({ nama: text })}
                  placeholder={`Masukkan nama ${kriteriaConfig[
                    activeKriteria
                  ].title.toLowerCase()}`}
                  placeholderTextColor="#9CA3AF"
                  editable={!submitting}
                />
              </View>

              <View style={styles.modalActionButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={closeKriteriaModal}
                  disabled={submitting}>
                  <Text style={styles.cancelButtonText}>Batal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.saveButton,
                    submitting && styles.saveButtonDisabled,
                  ]}
                  onPress={saveKriteria}
                  disabled={submitting}>
                  <Text style={styles.saveButtonText}>
                    {submitting
                      ? "Menyimpan..."
                      : editingKriteria
                      ? "Perbarui"
                      : "Simpan"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showRulesModal}
        animationType="slide"
        transparent={true}
        onRequestClose={closeRulesModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainerRounded}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingRules ? "Edit" : "Tambah"} Rules Harga
              </Text>
              <TouchableOpacity
                onPress={closeRulesModal}
                style={styles.modalCloseButton}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
              scrollEnabled={true}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled={true}
              contentContainerStyle={{ paddingBottom: 20 }}>
              <Text style={styles.sectionTitle}>Kriteria Kue</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Jenis Kue *</Text>
                <CriteriaDropdown
                  items={masterKriteria.jenisKue}
                  selectedValue={rulesForm.jenisKueId}
                  onValueChange={(value) =>
                    setRulesForm({ ...rulesForm, jenisKueId: value })
                  }
                  placeholder="Pilih jenis kue"
                  disabled={submitting}
                  dropdownId="jenisKue"
                  isOpen={openDropdownId === "jenisKue"}
                  onDropdownToggle={(isOpen) =>
                    handleDropdownToggle("jenisKue", isOpen)
                  }
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Variasi Kue *</Text>
                <CriteriaDropdown
                  items={masterKriteria.variasiKue}
                  selectedValue={rulesForm.variasiKueId}
                  onValueChange={(value) =>
                    setRulesForm({ ...rulesForm, variasiKueId: value })
                  }
                  placeholder="Pilih variasi kue"
                  disabled={submitting}
                  dropdownId="variasiKue"
                  isOpen={openDropdownId === "variasiKue"}
                  onDropdownToggle={(isOpen) =>
                    handleDropdownToggle("variasiKue", isOpen)
                  }
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Ukuran Kue *</Text>
                <CriteriaDropdown
                  items={masterKriteria.ukuranKue}
                  selectedValue={rulesForm.ukuranKueId}
                  onValueChange={(value) =>
                    setRulesForm({ ...rulesForm, ukuranKueId: value })
                  }
                  placeholder="Pilih ukuran kue"
                  disabled={submitting}
                  dropdownId="ukuranKue"
                  isOpen={openDropdownId === "ukuranKue"}
                  onDropdownToggle={(isOpen) =>
                    handleDropdownToggle("ukuranKue", isOpen)
                  }
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Kotak Kue *</Text>
                <CriteriaDropdown
                  items={masterKriteria.kotakKue}
                  selectedValue={rulesForm.kotakKueId}
                  onValueChange={(value) =>
                    setRulesForm({ ...rulesForm, kotakKueId: value })
                  }
                  placeholder="Pilih kotak kue"
                  disabled={submitting}
                  dropdownId="kotakKue"
                  isOpen={openDropdownId === "kotakKue"}
                  onDropdownToggle={(isOpen) =>
                    handleDropdownToggle("kotakKue", isOpen)
                  }
                />
              </View>

              <Text style={styles.sectionTitle}>Harga</Text>

              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.inputLabel}>Harga Modal *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={rulesForm.hargaModal}
                    onChangeText={(text) =>
                      setRulesForm({
                        ...rulesForm,
                        hargaModal: text.replace(/[^0-9]/g, ""),
                      })
                    }
                    placeholder="0"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                    editable={!submitting}
                  />
                </View>

                <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.inputLabel}>Harga Jual *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={rulesForm.hargaJual}
                    onChangeText={(text) =>
                      setRulesForm({
                        ...rulesForm,
                        hargaJual: text.replace(/[^0-9]/g, ""),
                      })
                    }
                    placeholder="0"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                    editable={!submitting}
                  />
                </View>
              </View>

              {rulesForm.hargaModal && rulesForm.hargaJual && (
                <View
                  style={[
                    styles.marginPreview,
                    currentMargin >= 50
                      ? styles.marginGood
                      : currentMargin >= 25
                      ? styles.marginOk
                      : styles.marginBad,
                  ]}>
                  <View style={styles.marginPreviewContent}>
                    <Text style={styles.marginPreviewLabel}>
                      Preview Margin
                    </Text>
                    <Text style={styles.marginPreviewValue}>
                      {currentMargin}%
                    </Text>
                  </View>
                  <Text style={styles.marginPreviewProfit}>
                    Keuntungan: Rp{" "}
                    {(
                      parseInt(rulesForm.hargaJual) -
                      parseInt(rulesForm.hargaModal)
                    ).toLocaleString("id-ID")}
                  </Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalActionButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={closeRulesModal}
                disabled={submitting}>
                <Text style={styles.cancelButtonText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  submitting && styles.saveButtonDisabled,
                ]}
                onPress={saveRules}
                disabled={submitting}>
                <Text style={styles.saveButtonText}>
                  {submitting
                    ? "Menyimpan..."
                    : editingRules
                    ? "Perbarui"
                    : "Simpan"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <BottomNavigation currentPage="kelola-harga" />
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
  tabNavigation: {
    flexDirection: "row",
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
  },
  tabButtonActive: {
    borderBottomWidth: 2,
    borderBottomColor: "#EA580C",
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
  },
  tabButtonTextActive: {
    color: "#EA580C",
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  tabContent: {
    flex: 1,
  },
  kriteriaSelector: {
    marginBottom: 16,
  },
  kriteriaSelectorContent: {
    paddingRight: 20,
  },
  kriteriaSelectorButton: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  kriteriaSelectorButtonActive: {
    backgroundColor: "#EA580C",
    borderColor: "#EA580C",
  },
  kriteriaSelectorText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
  },
  kriteriaSelectorTextActive: {
    color: "white",
  },
  addButtonContainer: {
    marginBottom: 20,
    alignItems: "flex-start",
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 12,
  },
  kriteriaList: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  rulesList: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  kriteriaItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  kriteriaItemName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#111827",
    flex: 1,
  },
  kriteriaItemActions: {
    flexDirection: "row",
    gap: 8,
  },
  editButton: {
    padding: 8,
  },
  deleteButton: {
    padding: 8,
  },
  ruleItem: {
    padding: 16,
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  ruleItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  ruleItemTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    flex: 1,
  },
  ruleItemActions: {
    flexDirection: "row",
    gap: 8,
  },
  ruleItemSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 12,
  },
  ruleItemPrices: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  priceItem: {
    flex: 1,
  },
  priceLabel: {
    fontSize: 10,
    color: "#6B7280",
    marginBottom: 2,
  },
  priceValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "#111827",
  },
  marginBadge: {
    backgroundColor: "#10B981",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  marginText: {
    fontSize: 12,
    fontWeight: "600",
    color: "white",
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
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContainerRounded: {
    backgroundColor: "white",
    borderRadius: 20,
    width: "100%",
    maxWidth: 500,
    maxHeight: "80%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
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
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  modalScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    maxHeight: 400,
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
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  disabledInput: {
    opacity: 0.6,
    backgroundColor: "#F3F4F6",
  },
  marginPreview: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  marginGood: {
    backgroundColor: "#D1FAE5",
    borderWidth: 1,
    borderColor: "#10B981",
  },
  marginOk: {
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#F59E0B",
  },
  marginBad: {
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#EF4444",
  },
  marginPreviewContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  marginPreviewLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#111827",
  },
  marginPreviewValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
  },
  marginPreviewProfit: {
    fontSize: 12,
    color: "#6B7280",
  },
  modalActionButtons: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    gap: 12,
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
    flex: 1,
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
    flex: 1,
  },
  dropdownModalItemTextSelected: {
    color: "#EA580C",
    fontWeight: "600",
  },
});
