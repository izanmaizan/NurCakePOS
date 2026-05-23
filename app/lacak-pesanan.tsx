// app/lacak-pesanan.tsx - Fixed Complete Version
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  Platform,
  RefreshControl,
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
import { useDatabase } from "../context/DatabaseProvider";
import { OrderWithDetails, useOrders } from "../hooks/useOrders";

const { width: screenWidth } = Dimensions.get("window");
const isTablet = screenWidth >= 768;

type OrderStatus =
  | "pending"
  | "in_progress"
  | "ready"
  | "completed"
  | "cancelled";

/**
 * Dropdown Status dengan Modal Bottom Sheet
 */
const StatusDropdown: React.FC<{
  selectedValue: string;
  onValueChange: (value: string) => void;
  isOpen: boolean;
  onToggle: (isOpen: boolean) => void;
}> = ({ selectedValue, onValueChange, isOpen, onToggle }) => {
  const statusOptions = [
    { value: "semua", label: "Semua Status", icon: "apps", color: "#6B7280" },
    {
      value: "pending",
      label: "Menunggu",
      icon: "hourglass",
      color: "#F59E0B",
    },
    {
      value: "in_progress",
      label: "Sedang Proses",
      icon: "refresh",
      color: "#3B82F6",
    },
    {
      value: "ready",
      label: "Siap Diambil",
      icon: "checkmark-circle",
      color: "#8B5CF6",
    },
    {
      value: "completed",
      label: "Selesai",
      icon: "checkmark-done",
      color: "#10B981",
    },
    {
      value: "cancelled",
      label: "Dibatalkan",
      icon: "close-circle",
      color: "#EF4444",
    },
  ];

  const selectedOption = statusOptions.find(
    (opt) => opt.value === selectedValue
  );

  const handleSelect = (value: string) => {
    onValueChange(value);
    setTimeout(() => {
      onToggle(false);
    }, 50);
  };

  return (
    <View style={styles.statusDropdownContainer}>
      <TouchableOpacity
        style={[
          styles.statusDropdownButton,
          isOpen && styles.statusDropdownButtonOpen,
        ]}
        onPress={() => onToggle(!isOpen)}>
        <Ionicons
          name={(selectedOption?.icon as any) || "filter"}
          size={16}
          color={selectedOption?.color || "#6B7280"}
        />
        <Text style={styles.statusDropdownText}>
          {selectedOption?.label || "Semua Status"}
        </Text>
        <Ionicons
          name={isOpen ? "chevron-up" : "chevron-down"}
          size={16}
          color="#6B7280"
        />
      </TouchableOpacity>

      {isOpen && (
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
                <Text style={styles.dropdownModalTitle}>Filter Status</Text>
                <TouchableOpacity onPress={() => onToggle(false)}>
                  <Ionicons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.dropdownModalList}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}>
                {statusOptions.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    activeOpacity={0.7}
                    style={[
                      styles.dropdownModalItem,
                      selectedValue === option.value &&
                        styles.dropdownModalItemSelected,
                    ]}
                    onPress={() => handleSelect(option.value)}>
                    <Ionicons
                      name={option.icon as any}
                      size={20}
                      color={
                        selectedValue === option.value
                          ? "#EA580C"
                          : option.color
                      }
                    />
                    <Text
                      style={[
                        styles.dropdownModalItemText,
                        selectedValue === option.value &&
                          styles.dropdownModalItemTextSelected,
                      ]}>
                      {option.label}
                    </Text>
                    {selectedValue === option.value && (
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
 * Date Picker dengan Modal
 */
const DatePickerModal: React.FC<{
  selectedDate: string;
  onDateChange: (date: string) => void;
  isOpen: boolean;
  onToggle: (isOpen: boolean) => void;
}> = ({ selectedDate, onDateChange, isOpen, onToggle }) => {
  const today = new Date();
  const dates = [];

  for (let i = -7; i <= 30; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    dates.push(date);
  }

  const formatDate = (date: Date) => {
    return date.toISOString().split("T")[0];
  };

  const formatDisplayDate = (date: Date) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const dateStr = formatDate(date);
    const todayStr = formatDate(today);
    const tomorrowStr = formatDate(tomorrow);
    const yesterdayStr = formatDate(yesterday);

    if (dateStr === todayStr) return "Hari Ini";
    if (dateStr === tomorrowStr) return "Besok";
    if (dateStr === yesterdayStr) return "Kemarin";

    return date.toLocaleDateString("id-ID", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  };

  const handleSelect = (date: Date) => {
    onDateChange(formatDate(date));
    setTimeout(() => {
      onToggle(false);
    }, 50);
  };

  const handleClear = () => {
    onDateChange("");
    setTimeout(() => {
      onToggle(false);
    }, 50);
  };

  return (
    <View style={styles.datePickerContainer}>
      <TouchableOpacity
        style={[styles.datePickerButton, isOpen && styles.datePickerButtonOpen]}
        onPress={() => onToggle(!isOpen)}>
        <Ionicons name="calendar" size={16} color="#6B7280" />
        <Text style={styles.datePickerText}>
          {selectedDate
            ? new Date(selectedDate + "T00:00:00").toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })
            : "Semua Tanggal"}
        </Text>
        <Ionicons
          name={isOpen ? "chevron-up" : "chevron-down"}
          size={16}
          color="#6B7280"
        />
      </TouchableOpacity>

      {isOpen && (
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
                <Text style={styles.dropdownModalTitle}>Pilih Tanggal</Text>
                <TouchableOpacity onPress={() => onToggle(false)}>
                  <Ionicons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.dropdownModalList}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}>
                <TouchableOpacity
                  style={[
                    styles.dropdownModalItem,
                    !selectedDate && styles.dropdownModalItemSelected,
                  ]}
                  onPress={handleClear}>
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color={!selectedDate ? "#EA580C" : "#6B7280"}
                  />
                  <Text
                    style={[
                      styles.dropdownModalItemText,
                      !selectedDate && styles.dropdownModalItemTextSelected,
                    ]}>
                    Semua Tanggal
                  </Text>
                  {!selectedDate && (
                    <Ionicons name="checkmark" size={20} color="#EA580C" />
                  )}
                </TouchableOpacity>

                {dates.map((date, index) => {
                  const dateStr = formatDate(date);
                  const isSelected = selectedDate === dateStr;
                  const isToday = dateStr === formatDate(new Date());

                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.dropdownModalItem,
                        isSelected && styles.dropdownModalItemSelected,
                        isToday && styles.todayItem,
                      ]}
                      onPress={() => handleSelect(date)}>
                      <Ionicons
                        name="calendar"
                        size={20}
                        color={isSelected ? "#EA580C" : "#6B7280"}
                      />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.dropdownModalItemText,
                            isSelected && styles.dropdownModalItemTextSelected,
                          ]}>
                          {formatDisplayDate(date)}
                        </Text>
                        <Text style={styles.dateFullText}>
                          {date.toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </Text>
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark" size={20} color="#EA580C" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
};

export default function LacakPesananScreen() {
  const insets = useSafeAreaInsets();
  const { isInitialized } = useDatabase();

  const { orders, loading, error, updateOrderStatus, searchOrders, refetch } =
    useOrders();

  const [selectedPesanan, setSelectedPesanan] =
    useState<OrderWithDetails | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [searchResults, setSearchResults] = useState<OrderWithDetails[]>([]);
  const [isImageGalleryOpen, setIsImageGalleryOpen] = useState(false);
  const [currentImage, setCurrentImage] = useState<string>("");

  const [searchTerm, setSearchTerm] = useState("");
  const [filterTanggal, setFilterTanggal] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("semua");
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  useEffect(() => {
    if (searchTerm) {
      handleSearch(searchTerm);
    } else {
      setSearchResults(orders);
    }
  }, [searchTerm, orders]);

  const filteredOrders = searchResults.filter((order) => {
    const matchDate =
      filterTanggal === "" ||
      new Date(order.tanggalAmbil).toISOString().split("T")[0] ===
        filterTanggal;

    const matchStatus =
      filterStatus === "semua" || order.statusPesanan === filterStatus;

    return matchDate && matchStatus;
  });

  const handleBack = () => {
    router.back();
  };

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
      Toast.show({
        type: "success",
        text1: "Data berhasil diperbarui",
      });
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Gagal memperbarui data",
      });
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const handleSearch = async (term: string) => {
    try {
      if (term.trim()) {
        const results = await searchOrders(term);
        setSearchResults(results);
      } else {
        setSearchResults(orders);
      }
    } catch (error) {
      console.error("Error searching orders:", error);
      setSearchResults(orders);
    }
  };

  const handleOpenImageGallery = (imageUri: string) => {
    setCurrentImage(imageUri);
    setIsImageGalleryOpen(true);
  };

  const handleSelectPesanan = (pesanan: OrderWithDetails) => {
    setSelectedPesanan(pesanan);
    setIsDetailOpen(true);
  };

  const handleUpdateStatus = async (newStatus: OrderStatus) => {
    if (!selectedPesanan) return;

    Alert.alert(
      "Ubah Status",
      `Apakah Anda yakin ingin mengubah status menjadi "${getStatusLabel(
        newStatus
      )}"?`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Ya, Ubah",
          onPress: async () => {
            setIsUpdatingStatus(true);
            try {
              await updateOrderStatus(selectedPesanan.id, newStatus);

              setSelectedPesanan((prev) =>
                prev ? { ...prev, statusPesanan: newStatus } : null
              );

              Toast.show({
                type: "success",
                text1: "Berhasil",
                text2: "Status berhasil diperbarui!",
              });
            } catch (error: any) {
              Toast.show({
                type: "error",
                text1: "Error",
                text2: error.message || "Gagal memperbarui status",
              });
            } finally {
              setIsUpdatingStatus(false);
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "#F59E0B";
      case "in_progress":
        return "#3B82F6";
      case "ready":
        return "#8B5CF6";
      case "completed":
        return "#10B981";
      case "cancelled":
        return "#EF4444";
      default:
        return "#6B7280";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "Menunggu";
      case "in_progress":
        return "Sedang Proses";
      case "ready":
        return "Siap Diambil";
      case "completed":
        return "Selesai";
      case "cancelled":
        return "Dibatalkan";
      default:
        return status;
    }
  };

  const renderPesananCard = (order: OrderWithDetails) => {
    const hasImages = order.gambarReferensiPath;

    return (
      <TouchableOpacity
        key={order.id}
        style={[
          styles.pesananCard,
          selectedPesanan?.id === order.id && styles.pesananCardSelected,
        ]}
        onPress={() => handleSelectPesanan(order)}
        activeOpacity={0.7}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Ionicons name="person" size={16} color="#6B7280" />
            <Text style={styles.customerName}>{order.namaPelanggan}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
        </View>

        <View style={styles.statusContainer}>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(order.statusPesanan) },
            ]}>
            <Text style={styles.statusText}>
              {getStatusLabel(order.statusPesanan)}
            </Text>
          </View>
        </View>

        {hasImages && (
          <TouchableOpacity
            style={styles.imagePreviewContainer}
            onPress={() => handleOpenImageGallery(order.gambarReferensiPath!)}>
            <Image
              source={{ uri: order.gambarReferensiPath }}
              style={styles.imagePreview}
              resizeMode="cover"
            />
            <View style={styles.imageOverlay}>
              <Ionicons name="eye" size={16} color="white" />
              <Text style={styles.imageOverlayText}>Lihat Gambar</Text>
            </View>
          </TouchableOpacity>
        )}

        <View style={styles.cakeInfo}>
          <Text style={styles.cakeTitle}>
            {order.jenisKueDetail?.nama || "Unknown"} -{" "}
            {order.variasiKueDetail?.nama || "Unknown"}
          </Text>
          <Text style={styles.cakeSubtitle}>
            {order.ukuranKueDetail?.nama || "Unknown"} •{" "}
            {order.aksesorisDetail?.map((a) => a.nama).join(", ") ||
              "Tanpa Aksesoris"}
          </Text>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.dateInfo}>
            <View style={styles.dateRow}>
              <Ionicons name="calendar" size={12} color="#6B7280" />
              <Text style={styles.dateText}>
                Pesan:{" "}
                {new Date(order.tanggalPesan).toLocaleDateString("id-ID")}
              </Text>
            </View>
            <View style={styles.dateRow}>
              <Ionicons name="time" size={12} color="#6B7280" />
              <Text style={styles.dateText}>
                Ambil:{" "}
                {new Date(order.tanggalAmbil).toLocaleDateString("id-ID")}
              </Text>
            </View>
          </View>
          <View style={styles.priceInfo}>
            <Text style={styles.totalPrice}>
              Rp {order.hargaTotal.toLocaleString("id-ID")}
            </Text>
            <View style={[styles.paymentBadge, { backgroundColor: "#EA580C" }]}>
              <Text style={styles.paymentBadgeText}>Custom</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (!isInitialized || loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#EA580C" />
          <Text style={styles.loadingText}>Memuat pesanan...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#EF4444" />
          <Text style={styles.errorText}>Terjadi Kesalahan</Text>
          <Text style={styles.errorDescription}>{error}</Text>
          <Button
            title="Coba Lagi"
            onPress={refetch}
            style={styles.retryButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Lacak Pesanan Kue</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
          <Ionicons name="refresh" size={20} color="#EA580C" />
        </TouchableOpacity>
      </View>

      <View style={styles.filterSection}>
        <View style={styles.searchContainer}>
          <Ionicons
            name="search"
            size={16}
            color="#9CA3AF"
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholder="Cari berdasarkan nama pelanggan atau nomor pesanan..."
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

        <View style={styles.filtersRow}>
          <DatePickerModal
            selectedDate={filterTanggal}
            onDateChange={setFilterTanggal}
            isOpen={datePickerOpen}
            onToggle={setDatePickerOpen}
          />

          <StatusDropdown
            selectedValue={filterStatus}
            onValueChange={setFilterStatus}
            isOpen={statusDropdownOpen}
            onToggle={setStatusDropdownOpen}
          />
        </View>

        <View style={styles.statsRow}>
          <Text style={styles.statText}>
            Total: <Text style={styles.statNumber}>{orders.length}</Text>
          </Text>
          <Text style={styles.statText}>
            Tampil:{" "}
            <Text style={styles.statNumber}>{filteredOrders.length}</Text>
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.orderList}
        contentContainerStyle={[
          styles.orderListContent,
          {
            paddingBottom: Platform.OS === "android" ? insets.bottom + 80 : 80,
          },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}>
        {filteredOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="bag-outline" size={48} color="#9CA3AF" />
            <Text style={styles.emptyStateText}>
              {searchTerm ? "Pesanan tidak ditemukan" : "Belum ada pesanan"}
            </Text>
            <Text style={styles.emptyStateDescription}>
              {searchTerm
                ? "Coba ubah kata kunci pencarian"
                : "Pesanan akan muncul di sini setelah dibuat"}
            </Text>
          </View>
        ) : (
          filteredOrders.map(renderPesananCard)
        )}
      </ScrollView>

      <Modal
        visible={isDetailOpen}
        animationType="slide"
        transparent={true}
        statusBarTranslucent
        onRequestClose={() => setIsDetailOpen(false)}>
        {/* ✅ FIXED: Full screen backdrop */}
        <View style={styles.fullScreenBackdrop}>
          <SafeAreaView style={styles.fullScreenModalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Detail Pesanan</Text>
              <TouchableOpacity
                onPress={() => setIsDetailOpen(false)}
                style={styles.modalCloseButton}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {selectedPesanan && (
              <ScrollView
                style={styles.modalContent}
                showsVerticalScrollIndicator={false}>
                <View style={styles.detailSection}>
                  <Text style={styles.sectionTitle}>Informasi Pelanggan</Text>
                  <View style={styles.infoCard}>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Nama</Text>
                      <Text style={styles.infoValue}>
                        {selectedPesanan.namaPelanggan}
                      </Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>No. Telepon</Text>
                      <Text style={styles.infoValue}>
                        {selectedPesanan.nomorTelepon}
                      </Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>No. Pesanan</Text>
                      <Text style={styles.infoValue}>
                        {selectedPesanan.nomorPesanan}
                      </Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Tanggal Pesan</Text>
                      <Text style={styles.infoValue}>
                        {new Date(
                          selectedPesanan.tanggalPesan
                        ).toLocaleDateString("id-ID")}
                      </Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Tanggal Ambil</Text>
                      <Text style={styles.infoValue}>
                        {new Date(
                          selectedPesanan.tanggalAmbil
                        ).toLocaleDateString("id-ID")}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.sectionTitle}>Spesifikasi Kue</Text>
                  <View style={styles.cakeSpecCard}>
                    {selectedPesanan.gambarReferensiPath && (
                      <View style={styles.imagesSection}>
                        <Text style={styles.imagesSectionTitle}>
                          Gambar Referensi
                        </Text>
                        <TouchableOpacity
                          style={styles.referenceImageContainer}
                          onPress={() =>
                            handleOpenImageGallery(
                              selectedPesanan.gambarReferensiPath!
                            )
                          }>
                          <Image
                            source={{
                              uri: selectedPesanan.gambarReferensiPath,
                            }}
                            style={styles.referenceImage}
                            resizeMode="cover"
                          />
                          <View style={styles.imageOverlay}>
                            <Ionicons name="eye" size={20} color="white" />
                            <Text style={styles.imageOverlayText}>Lihat</Text>
                          </View>
                        </TouchableOpacity>
                      </View>
                    )}

                    <View style={styles.specGrid}>
                      <View style={styles.specItem}>
                        <Text style={styles.specLabel}>Jenis Kue</Text>
                        <Text style={styles.specValue}>
                          {selectedPesanan.jenisKueDetail?.nama || "Unknown"}
                        </Text>
                      </View>
                      <View style={styles.specItem}>
                        <Text style={styles.specLabel}>Variasi</Text>
                        <Text style={styles.specValue}>
                          {selectedPesanan.variasiKueDetail?.nama || "Unknown"}
                        </Text>
                      </View>
                      <View style={styles.specItem}>
                        <Text style={styles.specLabel}>Ukuran</Text>
                        <Text style={styles.specValue}>
                          {selectedPesanan.ukuranKueDetail?.nama || "Unknown"}
                        </Text>
                      </View>
                      <View style={styles.specItem}>
                        <Text style={styles.specLabel}>Aksesoris</Text>
                        <Text style={styles.specValue}>
                          {selectedPesanan.aksesorisDetail
                            ?.map((a) => a.nama)
                            .join(", ") || "Tanpa Aksesoris"}
                        </Text>
                      </View>
                    </View>

                    {selectedPesanan.catatan && (
                      <View style={styles.notesContainer}>
                        <Text style={styles.notesLabel}>Catatan</Text>
                        <Text style={styles.notesText}>
                          {selectedPesanan.catatan}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.sectionTitle}>Informasi Harga</Text>
                  <View style={styles.paymentCard}>
                    <View style={styles.paymentRow}>
                      <Text style={styles.paymentLabel}>Total Harga</Text>
                      <Text style={styles.paymentTotal}>
                        Rp {selectedPesanan.hargaTotal.toLocaleString("id-ID")}
                      </Text>
                    </View>
                    {selectedPesanan.jenisKueDetail && (
                      <View style={styles.paymentRow}>
                        <Text style={styles.paymentLabel}>Harga Base</Text>
                        <Text style={styles.paymentValue}>
                          Rp{" "}
                          {selectedPesanan.jenisKueDetail.hargaBase.toLocaleString(
                            "id-ID"
                          )}
                        </Text>
                      </View>
                    )}
                    {selectedPesanan.variasiKueDetail &&
                      selectedPesanan.variasiKueDetail.hargaTambahan > 0 && (
                        <View style={styles.paymentRow}>
                          <Text style={styles.paymentLabel}>
                            Harga Tambahan Variasi
                          </Text>
                          <Text style={styles.paymentValue}>
                            Rp{" "}
                            {selectedPesanan.variasiKueDetail.hargaTambahan.toLocaleString(
                              "id-ID"
                            )}
                          </Text>
                        </View>
                      )}
                    {selectedPesanan.aksesorisDetail &&
                      selectedPesanan.aksesorisDetail.length > 0 && (
                        <View style={styles.paymentRow}>
                          <Text style={styles.paymentLabel}>
                            Harga Aksesoris
                          </Text>
                          <Text style={styles.paymentValue}>
                            Rp{" "}
                            {selectedPesanan.aksesorisDetail
                              .reduce((sum, acc) => sum + acc.harga, 0)
                              .toLocaleString("id-ID")}
                          </Text>
                        </View>
                      )}
                  </View>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.sectionTitle}>Ubah Status Pesanan</Text>
                  <View style={styles.statusActions}>
                    {(
                      ["pending", "in_progress", "ready", "completed"] as const
                    ).map((status) => (
                      <TouchableOpacity
                        key={status}
                        onPress={() => handleUpdateStatus(status)}
                        disabled={
                          isUpdatingStatus ||
                          selectedPesanan.statusPesanan === status
                        }
                        style={[
                          styles.statusActionButton,
                          selectedPesanan.statusPesanan === status &&
                            styles.statusActionButtonActive,
                        ]}>
                        <Text
                          style={[
                            styles.statusActionText,
                            selectedPesanan.statusPesanan === status &&
                              styles.statusActionTextActive,
                          ]}>
                          {getStatusLabel(status)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {selectedPesanan.statusPesanan === "completed" && (
                    <View style={styles.completedBadge}>
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color="#10B981"
                      />
                      <Text style={styles.completedText}>
                        Pesanan telah selesai dan siap diambil!
                      </Text>
                    </View>
                  )}
                </View>
              </ScrollView>
            )}
          </SafeAreaView>
        </View>
      </Modal>

      <Modal
        visible={isImageGalleryOpen}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIsImageGalleryOpen(false)}>
        <View style={styles.galleryOverlay}>
          <SafeAreaView style={styles.galleryContainer}>
            <View style={styles.galleryHeader}>
              <Text style={styles.galleryTitle}>Gambar Referensi</Text>
              <TouchableOpacity
                onPress={() => setIsImageGalleryOpen(false)}
                style={styles.galleryCloseButton}>
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
            </View>

            <View style={styles.galleryImageContainer}>
              {currentImage && (
                <Image
                  source={{ uri: currentImage }}
                  style={styles.galleryImage}
                  resizeMode="contain"
                />
              )}
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {isUpdatingStatus && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingOverlayContent}>
            <ActivityIndicator size="large" color="#EA580C" />
            <Text style={styles.loadingOverlayText}>Memperbarui status...</Text>
          </View>
        </View>
      )}

      <BottomNavigation currentPage="lacak-pesanan" />
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
  loadingOverlayContent: {
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
  refreshButton: {
    padding: 8,
  },
  filterSection: {
    backgroundColor: "white",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: "#111827",
  },
  clearButton: {
    marginLeft: 8,
    padding: 4,
  },
  filtersRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: "row",
    gap: 16,
  },
  statText: {
    fontSize: 12,
    color: "#6B7280",
  },
  statNumber: {
    fontWeight: "600",
    color: "#111827",
  },
  orderList: {
    flex: 1,
  },
  orderListContent: {
    padding: 16,
  },
  pesananCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  pesananCardSelected: {
    borderColor: "#EA580C",
    backgroundColor: "#FEF7ED",
    borderWidth: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  customerName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  statusContainer: {
    marginBottom: 8,
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "600",
    color: "white",
  },
  imagePreviewContainer: {
    width: "100%",
    height: 120,
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 12,
    position: "relative",
  },
  imagePreview: {
    width: "100%",
    height: "100%",
  },
  imageOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
  },
  imageOverlayText: {
    fontSize: 12,
    color: "white",
    fontWeight: "500",
  },
  cakeInfo: {
    marginBottom: 12,
  },
  cakeTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#111827",
    marginBottom: 4,
  },
  cakeSubtitle: {
    fontSize: 12,
    color: "#6B7280",
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  dateInfo: {
    flex: 1,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  dateText: {
    fontSize: 11,
    color: "#6B7280",
  },
  priceInfo: {
    alignItems: "flex-end",
  },
  totalPrice: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 4,
  },
  paymentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  paymentBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "white",
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
  detailSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    padding: 16,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: "#6B7280",
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "500",
    color: "#111827",
    flex: 1,
    textAlign: "right",
  },
  cakeSpecCard: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 16,
  },
  imagesSection: {
    marginBottom: 16,
  },
  imagesSectionTitle: {
    fontSize: 12,
    fontWeight: "500",
    color: "#6B7280",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  referenceImageContainer: {
    width: "100%",
    height: 200,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    position: "relative",
  },
  referenceImage: {
    width: "100%",
    height: "100%",
  },
  specGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginBottom: 16,
  },
  specItem: {
    width: "45%",
  },
  specLabel: {
    fontSize: 11,
    color: "#6B7280",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  specValue: {
    fontSize: 14,
    fontWeight: "500",
    color: "#111827",
  },
  notesContainer: {
    marginTop: 8,
  },
  notesLabel: {
    fontSize: 11,
    color: "#6B7280",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    color: "#111827",
    backgroundColor: "#F9FAFB",
    padding: 8,
    borderRadius: 4,
  },
  paymentCard: {
    backgroundColor: "#EFF6FF",
    borderRadius: 8,
    padding: 16,
  },
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  paymentLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  paymentValue: {
    fontSize: 14,
    fontWeight: "500",
    color: "#111827",
  },
  paymentTotal: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
  },
  statusActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statusActionButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    minWidth: "48%",
    alignItems: "center",
  },
  statusActionButtonActive: {
    backgroundColor: "#EA580C",
    borderColor: "#EA580C",
  },
  statusActionText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6B7280",
  },
  statusActionTextActive: {
    color: "white",
  },
  completedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    padding: 12,
    backgroundColor: "#D1FAE5",
    borderRadius: 8,
  },
  completedText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#065F46",
  },
  galleryOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
  },
  galleryContainer: {
    flex: 1,
  },
  galleryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  galleryTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
  galleryCloseButton: {
    padding: 4,
  },
  galleryImageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  galleryImage: {
    width: screenWidth - 40,
    height: "80%",
  },
  statusDropdownContainer: {
    flex: 1,
    position: "relative",
  },
  statusDropdownButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  statusDropdownButtonOpen: {
    borderColor: "#EA580C",
    borderWidth: 2,
  },
  statusDropdownText: {
    fontSize: 14,
    color: "#111827",
    flex: 1,
  },
  datePickerContainer: {
    flex: 1,
    position: "relative",
  },
  datePickerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  datePickerButtonOpen: {
    borderColor: "#EA580C",
    borderWidth: 2,
  },
  datePickerText: {
    fontSize: 14,
    color: "#111827",
    flex: 1,
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
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    gap: 12,
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
  todayItem: {
    backgroundColor: "#FEF9F5",
  },
  dateFullText: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
});
