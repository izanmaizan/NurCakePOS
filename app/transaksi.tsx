// app/transaksi.tsx - Updated with SQLite Integration
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
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

// Import hooks
import { useDatabase } from "../context/DatabaseProvider";
import {
  TransactionWithDetails,
  useTransactions,
} from "../hooks/useTransactions";

const { width: screenWidth } = Dimensions.get("window");
const isTablet = screenWidth >= 768;

type StatusFilter = "all" | "selesai" | "dibatalkan";

export default function TransaksiScreen() {
  const insets = useSafeAreaInsets();
  const { isInitialized } = useDatabase();

  const {
    transactions,
    loading,
    error,
    deleteTransaction,
    updateTransactionStatus,
    searchTransactions,
    refetch,
  } = useTransactions();

  // State management
  const [filteredTransactions, setFilteredTransactions] = useState<
    TransactionWithDetails[]
  >([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] =
    useState<TransactionWithDetails | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Filter transactions
  useEffect(() => {
    let filtered = transactions;

    if (searchTerm) {
      filtered = filtered.filter(
        (transaction) =>
          (transaction.namaPelanggan &&
            transaction.namaPelanggan
              .toLowerCase()
              .includes(searchTerm.toLowerCase())) ||
          transaction.nomorTransaksi
            .toLowerCase()
            .includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(
        (transaction) => transaction.statusTransaksi === statusFilter
      );
    }

    // Sort by creation date (newest first)
    filtered.sort((a, b) => b.dibuat.getTime() - a.dibuat.getTime());

    setFilteredTransactions(filtered);
  }, [transactions, searchTerm, statusFilter]);

  const handleBack = () => {
    router.back();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "selesai":
        return "#10B981";
      case "dibatalkan":
        return "#EF4444";
      default:
        return "#6B7280";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "selesai":
        return "Selesai";
      case "dibatalkan":
        return "Dibatalkan";
      default:
        return status;
    }
  };

  const openDetailModal = (transaction: TransactionWithDetails) => {
    setSelectedTransaction(transaction);
    setShowDetailModal(true);
  };

  const closeDetailModal = () => {
    setShowDetailModal(false);
    setSelectedTransaction(null);
  };

  const handleUpdateTransactionStatus = async (
    transactionId: string,
    newStatus: string
  ) => {
    setIsUpdatingStatus(true);
    try {
      await updateTransactionStatus(transactionId, newStatus);

      Toast.show({
        type: "success",
        text1: "Berhasil",
        text2: `Status transaksi berhasil diubah ke ${getStatusText(
          newStatus
        )}`,
      });

      closeDetailModal();
    } catch (error: any) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: error.message || "Gagal mengubah status transaksi",
      });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleDeleteTransaction = (transactionId: string) => {
    Alert.alert(
      "Hapus Transaksi",
      "Apakah Anda yakin ingin menghapus transaksi ini? Tindakan ini tidak dapat dibatalkan.",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteTransaction(transactionId);
              Toast.show({
                type: "success",
                text1: "Berhasil",
                text2: "Transaksi berhasil dihapus",
              });
              closeDetailModal();
            } catch (error: any) {
              Toast.show({
                type: "error",
                text1: "Error",
                text2: error.message || "Gagal menghapus transaksi",
              });
            }
          },
        },
      ]
    );
  };

  const statusOptions = [
    { value: "all", label: "Semua", count: transactions.length },
    {
      value: "selesai",
      label: "Selesai",
      count: transactions.filter((t) => t.statusTransaksi === "selesai").length,
    },
    {
      value: "dibatalkan",
      label: "Dibatalkan",
      count: transactions.filter((t) => t.statusTransaksi === "dibatalkan")
        .length,
    },
  ];

  const renderTransactionCard = (transaction: TransactionWithDetails) => (
    <TouchableOpacity
      key={transaction.id}
      style={styles.transactionCard}
      onPress={() => openDetailModal(transaction)}
      activeOpacity={0.7}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.transactionNumber}>
            {transaction.nomorTransaksi}
          </Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(transaction.statusTransaksi) },
            ]}>
            <Text style={styles.statusText}>
              {getStatusText(transaction.statusTransaksi)}
            </Text>
          </View>
        </View>
        <Text style={styles.transactionDate}>
          {transaction.dibuat.toLocaleDateString("id-ID", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
        </Text>
      </View>

      {/* Customer */}
      <View style={styles.customerInfo}>
        <Ionicons name="person" size={16} color="#6B7280" />
        <Text style={styles.customerName}>
          {transaction.namaPelanggan || "Customer"}
        </Text>
      </View>

      {/* Items Summary */}
      <View style={styles.itemsSummary}>
        <Text style={styles.itemsCount}>{transaction.jumlahItem} item</Text>
        <Text style={styles.totalAmount}>
          Rp {transaction.totalHarga.toLocaleString("id-ID")}
        </Text>
      </View>

      {/* Transaction Info */}
      <View style={styles.transactionInfo}>
        <Ionicons name="time" size={16} color="#6B7280" />
        <Text style={styles.transactionTime}>
          {transaction.dibuat.toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>

      {/* Payment Method */}
      <View style={styles.paymentInfo}>
        <Ionicons
          name={transaction.metodePembayaran === "cash" ? "cash" : "card"}
          size={16}
          color="#6B7280"
        />
        <Text style={styles.paymentText}>
          {transaction.metodePembayaran === "cash" ? "Tunai" : "Transfer"}
        </Text>
      </View>
    </TouchableOpacity>
  );

  // Loading state
  if (!isInitialized || loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#EA580C" />
          <Text style={styles.loadingText}>Memuat transaksi...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Transaksi</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: Platform.OS === "android" ? insets.bottom + 80 : 80,
          },
        ]}
        showsVerticalScrollIndicator={false}>
        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{transactions.length}</Text>
            <Text style={styles.statLabel}>Total Transaksi</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              Rp{" "}
              {transactions
                .filter((t) => t.statusTransaksi === "selesai")
                .reduce((sum, t) => sum + t.totalHarga, 0)
                .toLocaleString("id-ID")}
            </Text>
            <Text style={styles.statLabel}>Total Nilai</Text>
          </View>
        </View>

        {/* Search */}
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
              placeholder="Cari nomor transaksi atau nama pelanggan..."
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

        {/* Status Filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.statusFilter}
          contentContainerStyle={styles.statusFilterContent}>
          {statusOptions.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.statusFilterButton,
                statusFilter === option.value &&
                  styles.statusFilterButtonActive,
              ]}
              onPress={() => setStatusFilter(option.value as StatusFilter)}>
              <Text
                style={[
                  styles.statusFilterText,
                  statusFilter === option.value &&
                    styles.statusFilterTextActive,
                ]}>
                {option.label} ({option.count})
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Transactions List */}
        {filteredTransactions.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={48} color="#9CA3AF" />
            <Text style={styles.emptyStateText}>
              {searchTerm || statusFilter !== "all"
                ? "Transaksi tidak ditemukan"
                : "Belum ada transaksi"}
            </Text>
            <Text style={styles.emptyStateDescription}>
              {searchTerm || statusFilter !== "all"
                ? "Coba ubah kata kunci atau filter pencarian"
                : "Transaksi akan muncul di sini setelah dibuat dari POS"}
            </Text>
          </View>
        ) : (
          <View style={styles.transactionsList}>
            {filteredTransactions.map(renderTransactionCard)}
          </View>
        )}
      </ScrollView>

      {/* Detail Modal */}
      <Modal
        visible={showDetailModal}
        animationType="slide"
        transparent={true}
        statusBarTranslucent
        onRequestClose={closeDetailModal}>
        {/* ✅ FIXED: Full screen backdrop */}
        <View style={styles.fullScreenBackdrop}>
          <SafeAreaView style={styles.fullScreenModalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Detail Transaksi</Text>
              <TouchableOpacity
                onPress={closeDetailModal}
                style={styles.modalCloseButton}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {selectedTransaction && (
              <ScrollView
                style={styles.modalContent}
                showsVerticalScrollIndicator={false}>
                {/* Transaction Info */}
                <View style={styles.detailSection}>
                  <Text style={styles.sectionTitle}>Informasi Transaksi</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Nomor Transaksi</Text>
                    <Text style={styles.detailValue}>
                      {selectedTransaction.nomorTransaksi}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Tanggal & Waktu</Text>
                    <Text style={styles.detailValue}>
                      {selectedTransaction.dibuat.toLocaleDateString("id-ID")} -{" "}
                      {selectedTransaction.dibuat.toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Status</Text>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: getStatusColor(
                            selectedTransaction.statusTransaksi
                          ),
                        },
                      ]}>
                      <Text style={styles.statusText}>
                        {getStatusText(selectedTransaction.statusTransaksi)}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Customer Info */}
                <View style={styles.detailSection}>
                  <Text style={styles.sectionTitle}>Informasi Pelanggan</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Nama</Text>
                    <Text style={styles.detailValue}>
                      {selectedTransaction.namaPelanggan || "Customer"}
                    </Text>
                  </View>
                </View>

                {/* Items */}
                <View style={styles.detailSection}>
                  <Text style={styles.sectionTitle}>Item Transaksi</Text>
                  {selectedTransaction.details.map((item) => (
                    <View key={item.id} style={styles.itemRow}>
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName}>{item.namaProduk}</Text>
                        <Text style={styles.itemQuantity}>
                          {item.jumlah} x Rp{" "}
                          {item.hargaSatuan.toLocaleString("id-ID")}
                        </Text>
                      </View>
                      <Text style={styles.itemSubtotal}>
                        Rp {item.subtotal.toLocaleString("id-ID")}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Payment Info */}
                <View style={styles.detailSection}>
                  <Text style={styles.sectionTitle}>Informasi Pembayaran</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Metode Pembayaran</Text>
                    <Text style={styles.detailValue}>
                      {selectedTransaction.metodePembayaran === "cash"
                        ? "Tunai"
                        : "Transfer"}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Total Harga</Text>
                    <Text style={styles.detailValue}>
                      Rp{" "}
                      {selectedTransaction.totalHarga.toLocaleString("id-ID")}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Jumlah Item</Text>
                    <Text style={styles.detailValue}>
                      {selectedTransaction.jumlahItem} item
                    </Text>
                  </View>
                </View>

                {/* Notes */}
                {selectedTransaction.catatan && (
                  <View style={styles.detailSection}>
                    <Text style={styles.sectionTitle}>Catatan</Text>
                    <Text style={styles.notesText}>
                      {selectedTransaction.catatan}
                    </Text>
                  </View>
                )}

                {/* Actions */}
                {selectedTransaction.statusTransaksi === "selesai" && (
                  <View style={styles.actionSection}>
                    <Text style={styles.sectionTitle}>Tindakan</Text>
                    <View style={styles.statusActions}>
                      <Button
                        title="Batalkan Transaksi"
                        onPress={() =>
                          handleUpdateTransactionStatus(
                            selectedTransaction.id,
                            "dibatalkan"
                          )
                        }
                        loading={isUpdatingStatus}
                        icon="close-circle"
                        variant="outline"
                        style={[
                          styles.actionButton,
                          { borderColor: "#EF4444", marginBottom: 8 },
                        ]}
                        textStyle={{ color: "#EF4444" }}
                      />
                      <Button
                        title="Hapus Transaksi"
                        onPress={() =>
                          handleDeleteTransaction(selectedTransaction.id)
                        }
                        icon="trash"
                        variant="outline"
                        style={[
                          styles.actionButton,
                          { borderColor: "#EF4444" },
                        ]}
                        textStyle={{ color: "#EF4444" }}
                      />
                    </View>
                  </View>
                )}

                {selectedTransaction.statusTransaksi === "dibatalkan" && (
                  <View style={styles.actionSection}>
                    <Text style={styles.sectionTitle}>Tindakan</Text>
                    <View style={styles.statusActions}>
                      <Button
                        title="Hapus Transaksi"
                        onPress={() =>
                          handleDeleteTransaction(selectedTransaction.id)
                        }
                        icon="trash"
                        variant="outline"
                        style={[
                          styles.actionButton,
                          { borderColor: "#EF4444" },
                        ]}
                        textStyle={{ color: "#EF4444" }}
                      />
                    </View>
                  </View>
                )}
              </ScrollView>
            )}
          </SafeAreaView>
        </View>
      </Modal>

      {/* Loading Overlay */}
      {isUpdatingStatus && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingOverlayContent}>
            <ActivityIndicator size="large" color="#EA580C" />
            <Text style={styles.loadingOverlayText}>Memperbarui status...</Text>
          </View>
        </View>
      )}

      {/* Bottom Navigation */}
      <BottomNavigation currentPage="transaksi" />
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
  },
  statNumber: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#EA580C",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
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
  statusFilter: {
    marginBottom: 20,
  },
  statusFilterContent: {
    paddingRight: 20,
  },
  statusFilterButton: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  statusFilterButtonActive: {
    backgroundColor: "#EA580C",
    borderColor: "#EA580C",
  },
  statusFilterText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#6B7280",
  },
  statusFilterTextActive: {
    color: "white",
  },
  transactionsList: {
    gap: 12,
  },
  transactionCard: {
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
  },
  transactionNumber: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
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
  transactionDate: {
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
  transactionInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  transactionTime: {
    fontSize: 12,
    color: "#6B7280",
  },
  paymentInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  paymentText: {
    fontSize: 12,
    color: "#6B7280",
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
    paddingHorizontal: 20,
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
  itemQuantity: {
    fontSize: 12,
    color: "#6B7280",
  },
  itemSubtotal: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  notesText: {
    fontSize: 14,
    color: "#111827",
    backgroundColor: "#F9FAFB",
    padding: 12,
    borderRadius: 8,
  },
  actionSection: {
    marginBottom: 20,
  },
  statusActions: {
    gap: 8,
  },
  actionButton: {
    width: "100%",
  },
});
