// app/buku-pesanan.tsx - Fixed Complete Version
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import EmptyState from "../components/EmptyState";
import { SkeletonList } from "../components/SkeletonLoader";
import { useDatabase } from "../context/DatabaseProvider";
import { useResponsive } from "../hooks/useResponsive";
import { OrderWithDetails, useOrders } from "../hooks/useOrders";
import {
  TransactionWithDetails,
  useTransactions,
} from "../hooks/useTransactions";


type StatusFilter =
  | "semua"
  | "kue_custom_pending"
  | "siap_diambil"
  | "sudah_diambil"
  | "pending"
  | "in_progress"
  | "ready"
  | "completed";

interface CombinedBooking {
  id: string;
  nomorTransaksi: string;
  namaPelanggan: string;
  tanggalTransaksi: string;
  tanggalPengambilan: string;
  jamPengambilan?: string;
  totalHarga: number;
  metodePembayaran?: string;
  jumlahBayar?: number;
  statusPesanan: string;
  catatan?: string;
  hasKueCustom: boolean;
  ringkasanItems: {
    nama: string;
    jumlah: number;
    harga: number;
    subtotal: number;
  }[];
  totalItems: number;
  type: "order" | "transaction";
  originalData: OrderWithDetails | TransactionWithDetails;
  gambarReferensi?: string;
}

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
    { value: "semua", label: "Semua Status", icon: "apps" },
    { value: "kue_custom_pending", label: "Kue Custom Pending", icon: "time" },
    { value: "siap_diambil", label: "Siap Diambil", icon: "checkmark-circle" },
    { value: "sudah_diambil", label: "Sudah Diambil", icon: "checkmark-done" },
    { value: "pending", label: "Menunggu", icon: "hourglass" },
    { value: "in_progress", label: "Sedang Proses", icon: "refresh" },
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
          color="#6B7280"
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
                        selectedValue === option.value ? "#EA580C" : "#6B7280"
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

  // Generate dates: today - 7 days to today + 30 days
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
            : "Pilih Tanggal"}
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

export default function BukuPesananScreen() {
  const insets = useSafeAreaInsets();
  const { isInitialized } = useDatabase();

  const {
    orders,
    loading: ordersLoading,
    error: ordersError,
    completeOrder,
    refetch: refetchOrders,
  } = useOrders();

  const {
    transactions,
    loading: transactionsLoading,
    error: transactionsError,
    updateTransactionStatus,
    refetch: refetchTransactions,
  } = useTransactions();

  const [combinedBookings, setCombinedBookings] = useState<CombinedBooking[]>(
    []
  );
  const [filteredBookings, setFilteredBookings] = useState<CombinedBooking[]>(
    []
  );
  const [selectedPesanan, setSelectedPesanan] =
    useState<CombinedBooking | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isConfirmingPickup, setIsConfirmingPickup] = useState<string | null>(
    null
  );
  const [refreshing, setRefreshing] = useState(false);
  const [isImageGalleryOpen, setIsImageGalleryOpen] = useState(false);
  const [currentImage, setCurrentImage] = useState<string>("");

  const [searchTerm, setSearchTerm] = useState("");
  const [filterTanggal, setFilterTanggal] = useState(
    new Date().toISOString().split("T")[0]
  ); // Default: hari ini
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("semua");
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const loading = ordersLoading || transactionsLoading;
  const error = ordersError || transactionsError;

  useEffect(() => {
    const combined: CombinedBooking[] = [];

    // FIX: Track order IDs to avoid duplicates
    const orderTransactionIds = new Set<string>();

    orders.forEach((order) => {
      // FIX: Handle date properly
      const tanggalPesan =
        typeof order.tanggalPesan === "string"
          ? new Date(order.tanggalPesan)
          : order.tanggalPesan;
      const tanggalAmbil =
        typeof order.tanggalAmbil === "string"
          ? new Date(order.tanggalAmbil)
          : order.tanggalAmbil;

      const isValidTanggalPesan =
        tanggalPesan instanceof Date && !isNaN(tanggalPesan.getTime());
      const isValidTanggalAmbil =
        tanggalAmbil instanceof Date && !isNaN(tanggalAmbil.getTime());

      combined.push({
        id: order.id,
        nomorTransaksi: order.nomorPesanan,
        namaPelanggan: order.namaPelanggan,
        tanggalTransaksi: isValidTanggalPesan
          ? tanggalPesan.toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
        tanggalPengambilan: isValidTanggalAmbil
          ? tanggalAmbil.toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
        jamPengambilan: isValidTanggalAmbil
          ? tanggalAmbil.toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "00:00",
        totalHarga: order.totalHarga,
        statusPesanan: order.statusPesanan,
        catatan: order.catatan,
        hasKueCustom: true,
        ringkasanItems: [
          {
            nama: `${order.jenisKue || "Kue Custom"} - ${
              order.variasiKue || "Variasi"
            }`,
            jumlah: 1,
            harga: order.totalHarga,
            subtotal: order.totalHarga,
          },
        ],
        totalItems: 1,
        type: "order",
        originalData: order,
        gambarReferensi: order.gambarReferensi
          ? order.gambarReferensi.startsWith("file://")
            ? order.gambarReferensi
            : `file://${order.gambarReferensi}`
          : undefined,
      });
    });

    transactions.forEach((transaction) => {
      // FIX: Skip if this transaction is already shown in orders (custom cake)
      if (orderTransactionIds.has(transaction.id)) {
        return;
      }

      // FIX: Convert string to Date for dibuat field
      const dibuatDate =
        typeof transaction.dibuat === "string"
          ? new Date(transaction.dibuat)
          : transaction.dibuat || new Date();

      const isValidDate =
        dibuatDate instanceof Date && !isNaN(dibuatDate.getTime());
      const tanggalStr = isValidDate
        ? dibuatDate.toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0];

      // FIX: Get tanggalPengambilan from transaction if available
      const tanggalPengambilan = transaction.tanggalPengambilan || tanggalStr;
      const jamPengambilan =
        transaction.jamPengambilan ||
        (isValidDate
          ? dibuatDate.toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "00:00");

      // FIX: Determine status based on pickup datetime
      let statusPesanan = transaction.statusPesanan || "completed";
      if (tanggalPengambilan && jamPengambilan) {
        const pickupDateTime = new Date(
          `${tanggalPengambilan}T${jamPengambilan}`
        );
        if (!isNaN(pickupDateTime.getTime())) {
          const now = new Date();
          if (
            pickupDateTime > now &&
            !transaction.catatan?.includes("Sudah Diambil")
          ) {
            statusPesanan = "pending";
          }
        }
      }

      combined.push({
        id: transaction.id,
        nomorTransaksi: transaction.nomorTransaksi,
        namaPelanggan: transaction.namaPelanggan || "Customer",
        tanggalTransaksi: tanggalStr,
        tanggalPengambilan: tanggalPengambilan,
        jamPengambilan: jamPengambilan,
        totalHarga: transaction.totalHarga,
        metodePembayaran: transaction.metodePembayaran,
        jumlahBayar: transaction.totalHarga,
        statusPesanan: statusPesanan,
        hasKueCustom: false,
        // FIX: Use namaItem instead of namaProduk
        ringkasanItems:
          transaction.details?.map((detail: any) => ({
            nama: detail.namaItem || detail.namaProduk || "Item",
            jumlah: detail.jumlah,
            harga: detail.hargaSatuan,
            subtotal: detail.subtotal,
          })) || [],
        // FIX: Calculate totalItems from details
        totalItems:
          transaction.details?.reduce(
            (sum: number, d: any) => sum + d.jumlah,
            0
          ) || 0,
        type: "transaction",
        originalData: transaction,
      });
    });

    setCombinedBookings(combined);
  }, [orders, transactions]);

  useEffect(() => {
    const filtered = combinedBookings.filter((booking) => {
      const matchSearch =
        searchTerm === "" ||
        booking.namaPelanggan
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        booking.nomorTransaksi.toLowerCase().includes(searchTerm.toLowerCase());

      const matchDate =
        filterTanggal === "" || booking.tanggalPengambilan === filterTanggal;

      let matchStatus = true;
      if (filterStatus !== "semua") {
        if (filterStatus === "kue_custom_pending") {
          matchStatus =
            booking.hasKueCustom &&
            ["pending", "in_progress"].includes(booking.statusPesanan);
        } else if (filterStatus === "siap_diambil") {
          // FIX: Siap diambil = pending dengan pickup time sudah lewat atau hari ini
          const pickupDateTime = new Date(
            `${booking.tanggalPengambilan}T${booking.jamPengambilan || "00:00"}`
          );
          const now = new Date();
          matchStatus =
            booking.statusPesanan === "pending" && pickupDateTime <= now;
        } else if (filterStatus === "sudah_diambil") {
          matchStatus = booking.statusPesanan === "completed";
        } else {
          matchStatus = booking.statusPesanan === filterStatus;
        }
      }

      return matchSearch && matchDate && matchStatus;
    });

    // FIX: No grouping - each booking shown separately
    // Sort by pickup datetime
    filtered.sort((a, b) => {
      const dateTimeA = new Date(
        a.tanggalPengambilan + " " + (a.jamPengambilan || "00:00")
      );
      const dateTimeB = new Date(
        b.tanggalPengambilan + " " + (b.jamPengambilan || "00:00")
      );
      return dateTimeA.getTime() - dateTimeB.getTime();
    });

    setFilteredBookings(filtered);
  }, [combinedBookings, searchTerm, filterTanggal, filterStatus]);

  const handleBack = () => {
    router.back();
  };

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchOrders(), refetchTransactions()]);
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
  }, [refetchOrders, refetchTransactions]);

  const canConfirmPickup = (booking: CombinedBooking): boolean => {
    if (booking.statusPesanan === "completed") {
      return false;
    }

    if (booking.hasKueCustom) {
      return ["ready", "in_progress"].includes(booking.statusPesanan);
    }

    return booking.statusPesanan !== "pending";
  };

  const getPickupButtonText = (booking: CombinedBooking): string => {
    if (booking.hasKueCustom) {
      if (booking.statusPesanan === "pending") {
        return "Kue Belum Dikerjakan";
      } else if (booking.statusPesanan === "in_progress") {
        return "Konfirmasi Sudah Diambil";
      } else if (booking.statusPesanan === "ready") {
        return "Konfirmasi Sudah Diambil";
      }
      return "Kue Custom Belum Selesai";
    } else {
      if (booking.statusPesanan === "pending") {
        return "Belum Direservasi";
      }
      return "Konfirmasi Sudah Diambil";
    }
  };

  const handleKonfirmasiPickup = async (bookingId: string) => {
    const booking = filteredBookings.find((p) => p.id === bookingId);
    if (!booking) return;

    if (!canConfirmPickup(booking)) {
      if (booking.hasKueCustom && booking.statusPesanan !== "ready") {
        Toast.show({
          type: "error",
          text1: "Error",
          text2: "Kue custom belum selesai, tidak bisa dikonfirmasi pickup",
        });
      } else if (!booking.hasKueCustom && booking.statusPesanan === "pending") {
        Toast.show({
          type: "error",
          text1: "Error",
          text2: "Pesanan belum direservasi, gunakan tombol reservasi di POS",
        });
      }
      return;
    }

    if (booking.statusPesanan === "completed") {
      Toast.show({
        type: "info",
        text1: "Info",
        text2: "Pesanan sudah dikonfirmasi diambil",
      });
      return;
    }

    Alert.alert(
      "Konfirmasi Pickup",
      `Apakah Anda yakin pesanan ${booking.nomorTransaksi} sudah diambil pelanggan?`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Ya, Konfirmasi",
          onPress: async () => {
            setIsConfirmingPickup(bookingId);
            try {
              if (booking.type === "order") {
                await completeOrder(booking.id);
              } else {
                await updateTransactionStatus(booking.id, "selesai");
              }

              Toast.show({
                type: "success",
                text1: "Berhasil",
                text2: "Pickup berhasil dikonfirmasi",
              });
            } catch (error: any) {
              Toast.show({
                type: "error",
                text1: "Error",
                text2: error.message || "Gagal mengkonfirmasi pickup",
              });
            } finally {
              setIsConfirmingPickup(null);
            }
          },
        },
      ]
    );
  };

  const handleViewDetail = (booking: CombinedBooking) => {
    setSelectedPesanan(booking);
    setIsDetailModalOpen(true);
  };

  const handleViewImage = (imageUri: string) => {
    setCurrentImage(imageUri);
    setIsImageGalleryOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "#F59E0B";
      case "in_progress":
        return "#3B82F6";
      case "ready":
        return "#10B981";
      case "completed":
        return "#6B7280";
      case "selesai":
        return "#10B981";
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
        return "Sudah Diambil";
      case "selesai":
        return "Siap Diambil";
      default:
        return status;
    }
  };

  const getPaymentStatus = (booking: CombinedBooking) => {
    if (booking.metodePembayaran === "cash") {
      return (booking.jumlahBayar || 0) >= booking.totalHarga
        ? "Lunas"
        : "Belum Bayar";
    } else {
      return "Lunas";
    }
  };

  const getPaymentStatusColor = (booking: CombinedBooking) => {
    return getPaymentStatus(booking) === "Lunas" ? "#10B981" : "#EF4444";
  };

  const getPickupStatusInfo = (booking: CombinedBooking) => {
    if (booking.statusPesanan === "completed") {
      return {
        text: "Sudah Diambil",
        color: "#6B7280",
        canConfirm: false,
      };
    }

    if (booking.hasKueCustom) {
      if (booking.statusPesanan === "pending") {
        return {
          text: "Kue Belum Dikerjakan",
          color: "#F59E0B",
          canConfirm: false,
        };
      } else if (booking.statusPesanan === "in_progress") {
        return {
          text: "Kue Sedang Diproses - Bisa Dikonfirmasi",
          color: "#3B82F6",
          canConfirm: true,
        };
      } else if (booking.statusPesanan === "ready") {
        return {
          text: "Siap Diambil",
          color: "#10B981",
          canConfirm: true,
        };
      } else {
        return {
          text: "Kue Custom Belum Selesai",
          color: "#F59E0B",
          canConfirm: false,
        };
      }
    } else {
      if (booking.statusPesanan === "pending") {
        return {
          text: "Belum Direservasi",
          color: "#EF4444",
          canConfirm: false,
        };
      } else {
        return {
          text: "Siap Diambil",
          color: "#10B981",
          canConfirm: true,
        };
      }
    }
  };

  const renderPesananCard = (booking: CombinedBooking) => {
    const pickupInfo = getPickupStatusInfo(booking);

    return (
      <View key={booking.id} style={styles.pesananCard}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text style={styles.nomorTransaksi}>{booking.nomorTransaksi}</Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor(booking.statusPesanan) },
              ]}>
              <Text style={styles.statusText}>
                {getStatusLabel(booking.statusPesanan)}
              </Text>
            </View>
          </View>
          <Text style={styles.tanggalTransaksi}>
            {new Date(booking.tanggalTransaksi).toLocaleDateString("id-ID", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </Text>
        </View>

        <View style={styles.customerInfo}>
          <Ionicons name="person" size={16} color="#6B7280" />
          <Text style={styles.customerName}>{booking.namaPelanggan}</Text>
        </View>

        {booking.gambarReferensi && (
          <TouchableOpacity
            style={styles.imagePreviewContainer}
            onPress={() => handleViewImage(booking.gambarReferensi!)}>
            <Image
              source={{ uri: booking.gambarReferensi }}
              style={styles.imagePreview}
              resizeMode="cover"
            />
            <View style={styles.imageOverlay}>
              <Ionicons name="eye" size={16} color="white" />
              <Text style={styles.imageOverlayText}>Lihat Gambar</Text>
            </View>
          </TouchableOpacity>
        )}

        <View style={styles.itemsSummary}>
          <Text style={styles.itemsCount}>{booking.totalItems} item</Text>
          <Text style={styles.totalAmount}>
            Rp {booking.totalHarga.toLocaleString("id-ID")}
          </Text>
        </View>

        <View style={styles.pickupInfo}>
          <Ionicons name="calendar" size={16} color="#6B7280" />
          <Text style={styles.pickupText}>
            Ambil:{" "}
            {new Date(booking.tanggalPengambilan).toLocaleDateString("id-ID")}{" "}
            {booking.jamPengambilan && `- ${booking.jamPengambilan}`}
          </Text>
        </View>

        {booking.metodePembayaran && (
          <View style={styles.paymentInfo}>
            <Ionicons
              name={booking.metodePembayaran === "cash" ? "cash" : "card"}
              size={16}
              color="#6B7280"
            />
            <Text style={styles.paymentText}>
              {booking.metodePembayaran === "cash" ? "Tunai" : "Transfer"}
            </Text>
            <Text
              style={[
                styles.paymentStatus,
                { color: getPaymentStatusColor(booking) },
              ]}>
              {getPaymentStatus(booking)}
            </Text>
          </View>
        )}

        <View style={styles.pickupStatus}>
          <Text style={[styles.pickupStatusText, { color: pickupInfo.color }]}>
            {pickupInfo.text}
          </Text>
          {booking.hasKueCustom && (
            <Text style={styles.kueCustomBadge}>Kue Custom</Text>
          )}
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity
            onPress={() => handleViewDetail(booking)}
            style={styles.detailButton}>
            <Ionicons name="eye" size={16} color="#3B82F6" />
            <Text style={styles.detailButtonText}>Detail</Text>
          </TouchableOpacity>
          {pickupInfo.canConfirm && (
            <TouchableOpacity
              onPress={() => handleKonfirmasiPickup(booking.id)}
              disabled={isConfirmingPickup === booking.id}
              style={[
                styles.confirmButton,
                isConfirmingPickup === booking.id &&
                  styles.confirmButtonDisabled,
              ]}>
              {isConfirmingPickup === booking.id ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Ionicons name="checkmark-circle" size={16} color="white" />
              )}
              <Text style={styles.confirmButtonText}>
                {isConfirmingPickup === booking.id
                  ? "Loading..."
                  : "Konfirmasi"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (!isInitialized || loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Buku Pesanan</Text>
          <View style={{ width: 38 }} />
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
          <Text style={styles.headerTitle}>Buku Pesanan</Text>
          <View style={{ width: 38 }} />
        </View>
        <EmptyState
          icon="alert-circle-outline"
          iconColor="#EF4444"
          title="Terjadi Kesalahan"
          description={error}
          actionLabel="Coba Lagi"
          onAction={() => { refetchOrders(); refetchTransactions(); }}
        />
        <BottomNavigation currentPage="buku-pesanan" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Buku Pesanan</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
          <Ionicons name="refresh" size={20} color="#EA580C" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.filterBar}>
          <View style={styles.searchContainer}>
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
              placeholder="Cari nama pelanggan atau nomor transaksi..."
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

          <View style={styles.filterRow}>
            <DatePickerModal
              selectedDate={filterTanggal}
              onDateChange={setFilterTanggal}
              isOpen={datePickerOpen}
              onToggle={setDatePickerOpen}
            />

            <StatusDropdown
              selectedValue={filterStatus}
              onValueChange={(value) => setFilterStatus(value as StatusFilter)}
              isOpen={statusDropdownOpen}
              onToggle={setStatusDropdownOpen}
            />
          </View>

          <View style={styles.statsRow}>
            <Text style={styles.statText}>
              Total:{" "}
              <Text style={styles.statNumber}>{combinedBookings.length}</Text>
            </Text>
            <Text style={styles.statText}>
              Tampil:{" "}
              <Text style={styles.statNumber}>{filteredBookings.length}</Text>
            </Text>
          </View>
        </View>

        <FlatList
          style={styles.pesananList}
          data={filteredBookings}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => renderPesananCard(item)}
          contentContainerStyle={[
            styles.scrollContent,
            filteredBookings.length === 0 && { flexGrow: 1 },
            { paddingBottom: 24 },
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
          initialNumToRender={10}
          maxToRenderPerBatch={8}
          windowSize={8}
          ListEmptyComponent={
            <EmptyState
              icon="book-outline"
              title={searchTerm || filterStatus !== "semua" ? "Pesanan tidak ditemukan" : "Belum ada pesanan"}
              description={searchTerm || filterStatus !== "semua" ? "Coba ubah kata kunci atau filter pencarian" : "Pesanan akan muncul di sini setelah dibuat dari POS"}
            />
          }
        />
      </View>

      <Modal
        visible={isDetailModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsDetailModalOpen(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              Detail Pesanan {selectedPesanan?.nomorTransaksi}
            </Text>
            <TouchableOpacity
              onPress={() => setIsDetailModalOpen(false)}
              style={styles.modalCloseButton}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {selectedPesanan && (
            <ScrollView
              style={styles.modalContent}
              showsVerticalScrollIndicator={false}>
              {selectedPesanan.gambarReferensi && (
                <View style={styles.detailSection}>
                  <Text style={styles.sectionTitle}>Gambar Referensi</Text>
                  <TouchableOpacity
                    style={styles.referenceImageContainer}
                    onPress={() =>
                      handleViewImage(selectedPesanan.gambarReferensi!)
                    }>
                    <Image
                      source={{ uri: selectedPesanan.gambarReferensi }}
                      style={styles.referenceImage}
                      resizeMode="cover"
                    />
                    <View style={styles.imageOverlay}>
                      <Ionicons name="eye" size={20} color="white" />
                      <Text style={styles.imageOverlayText}>Lihat Gambar</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.detailSection}>
                <Text style={styles.sectionTitle}>Informasi Pelanggan</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Nama Pelanggan</Text>
                  <Text style={styles.detailValue}>
                    {selectedPesanan.namaPelanggan}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Tanggal Pengambilan</Text>
                  <Text style={styles.detailValue}>
                    {new Date(
                      selectedPesanan.tanggalPengambilan
                    ).toLocaleDateString("id-ID")}{" "}
                    {selectedPesanan.jamPengambilan}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status Pesanan</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: getStatusColor(
                          selectedPesanan.statusPesanan
                        ),
                      },
                    ]}>
                    <Text style={styles.statusText}>
                      {getStatusLabel(selectedPesanan.statusPesanan)}
                    </Text>
                  </View>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Tanggal Transaksi</Text>
                  <Text style={styles.detailValue}>
                    {new Date(
                      selectedPesanan.tanggalTransaksi
                    ).toLocaleDateString("id-ID")}
                  </Text>
                </View>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.sectionTitle}>Detail Pesanan</Text>
                {selectedPesanan.ringkasanItems.map((item, index) => (
                  <View key={index} style={styles.itemRow}>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName}>{item.nama}</Text>
                      <Text style={styles.itemDetail}>
                        {item.jumlah}x @ Rp {item.harga.toLocaleString("id-ID")}
                      </Text>
                    </View>
                    <Text style={styles.itemSubtotal}>
                      Rp {item.subtotal.toLocaleString("id-ID")}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.sectionTitle}>Informasi Pembayaran</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Total Harga</Text>
                  <Text style={styles.detailValue}>
                    Rp {selectedPesanan.totalHarga.toLocaleString("id-ID")}
                  </Text>
                </View>
                {selectedPesanan.metodePembayaran && (
                  <>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Metode Pembayaran</Text>
                      <Text style={styles.detailValue}>
                        {selectedPesanan.metodePembayaran === "cash"
                          ? "Tunai"
                          : "Transfer"}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Jumlah Bayar</Text>
                      <Text style={styles.detailValue}>
                        Rp{" "}
                        {(selectedPesanan.jumlahBayar || 0).toLocaleString(
                          "id-ID"
                        )}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Status Pembayaran</Text>
                      <Text
                        style={[
                          styles.detailValue,
                          { color: getPaymentStatusColor(selectedPesanan) },
                        ]}>
                        {getPaymentStatus(selectedPesanan)}
                      </Text>
                    </View>
                  </>
                )}
              </View>

              <View style={styles.pickupStatusSection}>
                <Text style={styles.sectionTitle}>Status Pengambilan</Text>
                {selectedPesanan.hasKueCustom ? (
                  <View>
                    <Text style={styles.statusDescription}>
                      Pesanan mengandung kue custom
                    </Text>
                    <Text
                      style={[
                        styles.statusIndicator,
                        { color: getPickupStatusInfo(selectedPesanan).color },
                      ]}>
                      {getPickupStatusInfo(selectedPesanan).text}
                    </Text>
                    {selectedPesanan.statusPesanan !== "ready" &&
                      selectedPesanan.statusPesanan !== "completed" && (
                        <Text style={styles.statusNote}>
                          Konfirmasi pickup hanya tersedia setelah kue custom
                          selesai dibuat
                        </Text>
                      )}
                  </View>
                ) : (
                  <View>
                    <Text style={styles.statusDescription}>
                      Pesanan kue ready / produk lainnya
                    </Text>
                    <Text
                      style={[
                        styles.statusIndicator,
                        { color: getPickupStatusInfo(selectedPesanan).color },
                      ]}>
                      {getPickupStatusInfo(selectedPesanan).text}
                    </Text>
                    {selectedPesanan.statusPesanan === "pending" && (
                      <Text style={styles.statusNote}>
                        Gunakan tombol reservasi di POS terlebih dahulu
                      </Text>
                    )}
                  </View>
                )}
              </View>

              {selectedPesanan.catatan && (
                <View style={styles.detailSection}>
                  <Text style={styles.sectionTitle}>Catatan</Text>
                  <Text style={styles.notesText}>
                    {selectedPesanan.catatan}
                  </Text>
                </View>
              )}
            </ScrollView>
          )}

          <View style={styles.modalActions}>
            <Button
              title="Tutup"
              onPress={() => setIsDetailModalOpen(false)}
              variant="outline"
              style={[styles.modalActionButton, { marginRight: 8 }]}
            />
            {selectedPesanan && canConfirmPickup(selectedPesanan) && (
              <Button
                title={getPickupButtonText(selectedPesanan)}
                onPress={() => {
                  handleKonfirmasiPickup(selectedPesanan.id);
                  setIsDetailModalOpen(false);
                }}
                loading={isConfirmingPickup === selectedPesanan.id}
                icon="checkmark-circle"
                style={[styles.modalActionButton, { marginLeft: 8 }]}
              />
            )}
          </View>
        </SafeAreaView>
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

      {isConfirmingPickup && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingOverlayContent}>
            <ActivityIndicator size="large" color="#EA580C" />
            <Text style={styles.loadingOverlayText}>
              Memproses konfirmasi...
            </Text>
          </View>
        </View>
      )}

      <BottomNavigation currentPage="buku-pesanan" />
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
  content: {
    flex: 1,
  },
  filterBar: {
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
    paddingVertical: 12,
    fontSize: 16,
    color: "#111827",
  },
  clearButton: {
    marginLeft: 8,
    padding: 4,
  },
  filterRow: {
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
  pesananList: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  scrollContent: {
    padding: 16,
  },
  pesananCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1, // FIX: Take available space
    marginRight: 8, // FIX: Give space for status badge
  },
  nomorTransaksi: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
    flexShrink: 1, // FIX: Allow text to shrink
    maxWidth: 100, // FIX: Limit width to prevent overflow
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "600",
    color: "white",
  },
  tanggalTransaksi: {
    fontSize: 12,
    color: "#6B7280",
  },
  customerInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  customerName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#111827",
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
  itemsSummary: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  itemsCount: {
    fontSize: 12,
    color: "#6B7280",
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#EA580C",
  },
  pickupInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  pickupText: {
    fontSize: 12,
    color: "#6B7280",
  },
  paymentInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  paymentText: {
    fontSize: 12,
    color: "#6B7280",
  },
  paymentStatus: {
    fontSize: 12,
    fontWeight: "500",
    marginLeft: "auto",
  },
  pickupStatus: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  pickupStatusText: {
    fontSize: 12,
    fontWeight: "500",
  },
  kueCustomBadge: {
    fontSize: 10,
    color: "#EA580C",
    backgroundColor: "#FED7AA",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cardActions: {
    flexDirection: "row",
    gap: 8,
  },
  detailButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EFF6FF",
    paddingVertical: 8,
    borderRadius: 6,
    gap: 4,
  },
  detailButtonText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#3B82F6",
  },
  confirmButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#10B981",
    paddingVertical: 8,
    borderRadius: 6,
    gap: 4,
  },
  confirmButtonDisabled: {
    backgroundColor: "#9CA3AF",
  },
  confirmButtonText: {
    fontSize: 12,
    fontWeight: "500",
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
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  detailLabel: {
    fontSize: 14,
    color: "#6B7280",
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "500",
    color: "#111827",
    flex: 1,
    textAlign: "right",
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#111827",
    marginBottom: 4,
  },
  itemDetail: {
    fontSize: 12,
    color: "#6B7280",
  },
  itemSubtotal: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  pickupStatusSection: {
    backgroundColor: "#EFF6FF",
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },
  statusDescription: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 8,
  },
  statusIndicator: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 8,
  },
  statusNote: {
    fontSize: 12,
    color: "#F59E0B",
  },
  notesText: {
    fontSize: 14,
    color: "#111827",
    backgroundColor: "#F9FAFB",
    padding: 12,
    borderRadius: 8,
  },
  modalActions: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  modalActionButton: {
    flex: 1,
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
    width: "90%",
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
    backgroundColor: "#FEF3F2",
  },
  dateFullText: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
});
