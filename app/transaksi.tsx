// app/transaksi.tsx
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useResponsive } from "../hooks/useResponsive";
import Toast from "react-native-toast-message";
import BottomNavigation from "../components/BottomNavigation";
import Button from "../components/Button";
import EmptyState from "../components/EmptyState";
import { SkeletonList, SkeletonStatRow } from "../components/SkeletonLoader";
import { BORDER_RADIUS, COLORS, FONT_SIZE, FONT_WEIGHT, SHADOW, SPACING } from "../constants/theme";
import { useDatabase } from "../context/DatabaseProvider";
import { TransactionWithDetails, useTransactions } from "../hooks/useTransactions";

type StatusFilter = "all" | "selesai" | "dibatalkan";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  selesai:    { label: "Selesai",     color: COLORS.success,  bg: COLORS.successLight },
  dibatalkan: { label: "Dibatalkan",  color: COLORS.error,    bg: COLORS.errorLight },
};

const PAYMENT_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  cash:     "cash-outline",
  transfer: "phone-portrait-outline",
  qris:     "qr-code-outline",
};

function formatRupiah(amount: number) {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

// ─────────────────────────────────────
// Transaction Card
// ─────────────────────────────────────
const TransactionCard = React.memo(
  ({ item, onPress }: { item: TransactionWithDetails; onPress: () => void }) => {
    const status = STATUS_CONFIG[item.statusPembayaran] ?? {
      label: item.statusPembayaran,
      color: COLORS.gray500,
      bg: COLORS.gray100,
    };
    const payIcon = PAYMENT_ICON[item.metodePembayaran ?? "cash"] ?? "cash-outline";
    const tgl = new Date(item.dibuat);

    return (
      <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
        {/* Row 1: nomor + status */}
        <View style={styles.cardRow}>
          <Text style={styles.cardNumber}>{item.nomorTransaksi}</Text>
          <View style={[styles.badge, { backgroundColor: status.bg }]}>
            <Text style={[styles.badgeText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>

        {/* Row 2: pelanggan */}
        <View style={[styles.cardRow, { marginTop: 6 }]}>
          <View style={styles.iconLabel}>
            <Ionicons name="person-outline" size={13} color={COLORS.gray400} />
            <Text style={styles.cardMeta} numberOfLines={1}>
              {item.namaPelanggan || "Pelanggan"}
            </Text>
          </View>
          <Text style={styles.cardAmount}>{formatRupiah(item.totalHarga)}</Text>
        </View>

        {/* Row 3: item count + waktu + metode */}
        <View style={[styles.cardRow, { marginTop: 6 }]}>
          <View style={styles.iconLabel}>
            <Ionicons name="layers-outline" size={13} color={COLORS.gray400} />
            <Text style={styles.cardMeta}>{item.details?.length ?? 0} item</Text>
          </View>
          <View style={styles.iconLabel}>
            <Ionicons name={payIcon} size={13} color={COLORS.gray400} />
            <Text style={styles.cardMeta}>
              {tgl.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
              {"  "}
              {tgl.toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }
);

// ─────────────────────────────────────
// Main Screen
// ─────────────────────────────────────
export default function TransaksiScreen() {
  const insets = useSafeAreaInsets();
  const { isLandscape } = useResponsive();
  const { isInitialized } = useDatabase();
  const { transactions, loading, error, deleteTransaction, updateTransactionStatus, refetch } =
    useTransactions();

  const [searchTerm, setSearchTerm]           = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter]       = useState<StatusFilter>("all");
  const [showDetail, setShowDetail]           = useState(false);
  const [selected, setSelected]               = useState<TransactionWithDetails | null>(null);
  const [updatingStatus, setUpdatingStatus]   = useState(false);

  // Search debounce 300ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Filter + sort — memoized
  const filtered = useMemo(() => {
    let list = transactions;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(
        (t) =>
          t.nomorTransaksi.toLowerCase().includes(q) ||
          (t.namaPelanggan ?? "").toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") {
      list = list.filter((t) => t.statusPembayaran === statusFilter);
    }
    return [...list].sort((a, b) => new Date(b.dibuat).getTime() - new Date(a.dibuat).getTime());
  }, [transactions, debouncedSearch, statusFilter]);

  // Stats — memoized
  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todayTx = transactions.filter((t) => t.dibuat.slice(0, 10) === today);
    const totalNilai = transactions
      .filter((t) => t.statusPembayaran === "selesai")
      .reduce((s, t) => s + t.totalHarga, 0);
    const todayNilai = todayTx.reduce((s, t) => s + t.totalHarga, 0);
    return { total: transactions.length, todayCount: todayTx.length, totalNilai, todayNilai };
  }, [transactions]);

  const filterOptions: { value: StatusFilter; label: string }[] = [
    { value: "all",       label: `Semua (${transactions.length})` },
    { value: "selesai",   label: `Selesai (${transactions.filter(t => t.statusPembayaran === "selesai").length})` },
    { value: "dibatalkan",label: `Dibatalkan (${transactions.filter(t => t.statusPembayaran === "dibatalkan").length})` },
  ];

  const openDetail = useCallback((t: TransactionWithDetails) => {
    setSelected(t);
    if (!isLandscape) setShowDetail(true);
  }, [isLandscape]);

  const handleUpdateStatus = async (id: string, status: string) => {
    setUpdatingStatus(true);
    try {
      await updateTransactionStatus(id, status);
      Toast.show({ type: "success", text1: "Status diperbarui" });
      setShowDetail(false);
    } catch (e: any) {
      Toast.show({ type: "error", text1: "Gagal", text2: e.message });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert("Hapus Transaksi", "Tindakan ini tidak dapat dibatalkan.", [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteTransaction(id);
            Toast.show({ type: "success", text1: "Transaksi dihapus" });
            setShowDetail(false);
          } catch (e: any) {
            Toast.show({ type: "error", text1: "Gagal", text2: e.message });
          }
        },
      },
    ]);
  };

  const renderItem = useCallback(
    ({ item }: { item: TransactionWithDetails }) => (
      <TransactionCard item={item} onPress={() => openDetail(item)} />
    ),
    [openDetail]
  );

  const keyExtractor = useCallback((item: TransactionWithDetails) => item.id, []);

  const ListEmpty = useCallback(
    () => (
      <EmptyState
        icon="receipt-outline"
        title={debouncedSearch || statusFilter !== "all" ? "Tidak ditemukan" : "Belum ada transaksi"}
        description={
          debouncedSearch || statusFilter !== "all"
            ? "Coba ubah kata kunci atau filter pencarian"
            : "Transaksi akan muncul di sini setelah dibuat dari POS"
        }
      />
    ),
    [debouncedSearch, statusFilter]
  );

  const ListHeader = useCallback(
    () => (
      <View>
        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { borderLeftColor: COLORS.primary }]}>
            <Text style={styles.statValue}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total Transaksi</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: COLORS.success }]}>
            <Text style={[styles.statValue, { color: COLORS.success }]}>{stats.todayCount}</Text>
            <Text style={styles.statLabel}>Hari Ini</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: COLORS.info }]}>
            <Text style={[styles.statValue, { color: COLORS.info, fontSize: FONT_SIZE.sm }]}>
              {formatRupiah(stats.todayNilai)}
            </Text>
            <Text style={styles.statLabel}>Nilai Hari Ini</Text>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={COLORS.gray400} />
          <TextInput
            style={styles.searchInput}
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholder="Cari nomor atau nama pelanggan..."
            placeholderTextColor={COLORS.gray400}
            returnKeyType="search"
          />
          {searchTerm ? (
            <TouchableOpacity onPress={() => setSearchTerm("")}>
              <Ionicons name="close-circle" size={18} color={COLORS.gray400} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
          style={styles.filterBar}>
          {filterOptions.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.pill, statusFilter === opt.value && styles.pillActive]}
              onPress={() => setStatusFilter(opt.value)}
              activeOpacity={0.8}>
              <Text style={[styles.pillText, statusFilter === opt.value && styles.pillTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    ),
    [stats, searchTerm, statusFilter, filterOptions]
  );

  // ─── Detail Content (digunakan oleh Modal portrait DAN side panel landscape) ───
  const renderDetailContent = () => {
    if (!selected) return null;
    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Info Utama */}
        <View style={styles.detailSection}>
          <View style={styles.detailRowBetween}>
            <Text style={styles.detailLabel}>Nomor</Text>
            <Text style={styles.detailValue}>{selected.nomorTransaksi}</Text>
          </View>
          <View style={styles.detailRowBetween}>
            <Text style={styles.detailLabel}>Tanggal</Text>
            <Text style={styles.detailValue}>
              {new Date(selected.dibuat).toLocaleString("id-ID", {
                day: "2-digit", month: "short", year: "numeric",
                hour: "2-digit", minute: "2-digit",
              })}
            </Text>
          </View>
          <View style={styles.detailRowBetween}>
            <Text style={styles.detailLabel}>Pelanggan</Text>
            <Text style={styles.detailValue}>{selected.namaPelanggan || "—"}</Text>
          </View>
          <View style={styles.detailRowBetween}>
            <Text style={styles.detailLabel}>Status</Text>
            {(() => {
              const s = STATUS_CONFIG[selected.statusPembayaran] ?? {
                label: selected.statusPembayaran, color: COLORS.gray500, bg: COLORS.gray100,
              };
              return (
                <View style={[styles.badge, { backgroundColor: s.bg }]}>
                  <Text style={[styles.badgeText, { color: s.color }]}>{s.label}</Text>
                </View>
              );
            })()}
          </View>
        </View>

        {/* Items */}
        <View style={styles.detailSection}>
          <Text style={styles.sectionTitle}>Item ({selected.details?.length ?? 0})</Text>
          {selected.details?.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.namaItem}</Text>
                <Text style={styles.itemQty}>
                  {item.jumlah} × {formatRupiah(item.hargaSatuan)}
                </Text>
              </View>
              <Text style={styles.itemSubtotal}>{formatRupiah(item.subtotal)}</Text>
            </View>
          ))}
        </View>

        {/* Pembayaran */}
        <View style={[styles.detailSection, styles.totalSection]}>
          <View style={styles.detailRowBetween}>
            <Text style={styles.detailLabel}>Metode</Text>
            <Text style={styles.detailValue}>
              {selected.metodePembayaran === "cash" ? "Tunai" :
               selected.metodePembayaran === "transfer" ? "Transfer" : "QRIS"}
            </Text>
          </View>
          <View style={[styles.detailRowBetween, { marginTop: 8 }]}>
            <Text style={[styles.detailLabel, { fontWeight: FONT_WEIGHT.semibold, color: COLORS.gray900 }]}>Total</Text>
            <Text style={styles.totalAmount}>{formatRupiah(selected.totalHarga)}</Text>
          </View>
        </View>

        {selected.catatan ? (
          <View style={styles.detailSection}>
            <Text style={styles.sectionTitle}>Catatan</Text>
            <Text style={styles.notesText}>{selected.catatan}</Text>
          </View>
        ) : null}

        {/* Aksi */}
        {selected.statusPembayaran === "selesai" && (
          <View style={styles.actionRow}>
            <Button
              title="Batalkan"
              onPress={() => handleUpdateStatus(selected.id, "dibatalkan")}
              loading={updatingStatus}
              variant="outline"
              style={{ flex: 1, borderColor: COLORS.error }}
              textStyle={{ color: COLORS.error }}
            />
          </View>
        )}
        <View style={[styles.actionRow, { marginTop: 8 }]}>
          <Button
            title="Hapus Transaksi"
            onPress={() => handleDelete(selected.id)}
            variant="outline"
            style={{ flex: 1, borderColor: COLORS.error }}
            textStyle={{ color: COLORS.error }}
            icon="trash-outline"
          />
        </View>
      </ScrollView>
    );
  };

  // ─── RENDER ───
  if (!isInitialized || loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={COLORS.gray900} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Transaksi</Text>
          <View style={{ width: 38 }} />
        </View>
        <SkeletonStatRow />
        <SkeletonList count={5} />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={COLORS.gray900} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Transaksi</Text>
          <View style={{ width: 38 }} />
        </View>
        <EmptyState
          icon="alert-circle-outline"
          iconColor={COLORS.error}
          title="Gagal Memuat Data"
          description={error}
          actionLabel="Coba Lagi"
          onAction={refetch}
        />
        <BottomNavigation currentPage="transaksi" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, isLandscape && styles.headerLandscape]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.gray900} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Transaksi</Text>
        <TouchableOpacity onPress={refetch} style={styles.backBtn}>
          <Ionicons name="refresh" size={20} color={COLORS.gray500} />
        </TouchableOpacity>
      </View>

      {/* Content area — split di landscape */}
      <View style={[styles.bodyRow, isLandscape && styles.bodyRowLandscape]}>
        {/* List column */}
        <View style={[styles.listColumn, isLandscape && styles.listColumnLandscape]}>
          <FlatList
            data={filtered}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            ListHeaderComponent={ListHeader}
            ListEmptyComponent={ListEmpty}
            contentContainerStyle={[
              styles.listContent,
              filtered.length === 0 && styles.listContentEmpty,
              { paddingBottom: 24 },
            ]}
            showsVerticalScrollIndicator={false}
            initialNumToRender={12}
            maxToRenderPerBatch={10}
            windowSize={10}
            getItemLayout={(_, index) => ({ length: 100, offset: 100 * index, index })}
          />
        </View>

        {/* Side panel — hanya di landscape */}
        {isLandscape && (
          <View style={styles.sidePanel}>
            <View style={styles.sidePanelHeader}>
              <Text style={styles.modalTitle}>
                {selected ? "Detail Transaksi" : "Pilih Transaksi"}
              </Text>
              {selected && (
                <TouchableOpacity
                  onPress={() => setSelected(null)}
                  style={styles.closeBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close" size={22} color={COLORS.gray500} />
                </TouchableOpacity>
              )}
            </View>
            {selected ? (
              renderDetailContent()
            ) : (
              <View style={styles.sidePanelEmpty}>
                <EmptyState
                  icon="receipt-outline"
                  title="Pilih Transaksi"
                  description="Ketuk transaksi di sebelah kiri untuk melihat detail"
                />
              </View>
            )}
          </View>
        )}
      </View>

      {/* Modal detail — hanya di portrait */}
      {!isLandscape && (
        <Modal
          visible={showDetail}
          animationType="slide"
          transparent
          statusBarTranslucent
          onRequestClose={() => setShowDetail(false)}>
          <View style={styles.backdrop}>
            <SafeAreaView style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Detail Transaksi</Text>
                <TouchableOpacity
                  onPress={() => setShowDetail(false)}
                  style={styles.closeBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close" size={22} color={COLORS.gray500} />
                </TouchableOpacity>
              </View>
              {renderDetailContent()}
            </SafeAreaView>
          </View>
        </Modal>
      )}

      {/* Updating overlay */}
      {updatingStatus && (
        <View style={styles.overlay}>
          <View style={styles.overlayCard}>
            <ActivityIndicator color={COLORS.primary} />
            <Text style={styles.overlayText}>Memperbarui...</Text>
          </View>
        </View>
      )}

      <BottomNavigation currentPage="transaksi" />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────
// Styles
// ─────────────────────────────────────
const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: COLORS.background },
  header:         {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerLandscape: { paddingVertical: SPACING.sm },

  // Layout body
  bodyRow:              { flex: 1 },
  bodyRowLandscape:     { flexDirection: "row" },
  listColumn:           { flex: 1 },
  listColumnLandscape:  { flex: 7 },

  // Side panel (landscape)
  sidePanel: {
    flex: 3,
    backgroundColor: COLORS.white,
    borderLeftWidth: 1,
    borderLeftColor: COLORS.border,
  },
  sidePanelHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.base,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  sidePanelEmpty: {
    flex: 1, justifyContent: "center", alignItems: "center",
  },
  backBtn:        { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: BORDER_RADIUS.md, backgroundColor: COLORS.gray100 },
  headerTitle:    { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.semibold, color: COLORS.gray900 },

  // Stats
  statsRow:       { flexDirection: "row", gap: SPACING.sm, padding: SPACING.lg, paddingBottom: SPACING.md },
  statCard:       {
    flex: 1, backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md, borderLeftWidth: 3, borderLeftColor: COLORS.primary,
    ...SHADOW.sm,
  },
  statValue:      { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, color: COLORS.primary, marginBottom: 2 },
  statLabel:      { fontSize: FONT_SIZE.xs, color: COLORS.gray500 },

  // Search
  searchBox: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md, paddingVertical: Platform.OS === "ios" ? 12 : 8,
    marginHorizontal: SPACING.lg, marginBottom: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  searchInput:    { flex: 1, fontSize: FONT_SIZE.base, color: COLORS.gray900 },

  // Filter
  filterBar:      { marginBottom: SPACING.md },
  filterScroll:   { paddingHorizontal: SPACING.lg, gap: SPACING.sm },
  pill: {
    paddingHorizontal: SPACING.md, paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full, backgroundColor: COLORS.white,
    borderWidth: 1, borderColor: COLORS.border,
  },
  pillActive:     { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pillText:       { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.medium, color: COLORS.gray600 },
  pillTextActive: { color: COLORS.white },

  // List
  listContent:      { paddingHorizontal: SPACING.lg },
  listContentEmpty: { flexGrow: 1 },

  // Card
  card: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.base, marginBottom: SPACING.md,
    ...SHADOW.sm,
  },
  cardRow:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardNumber:     { fontSize: FONT_SIZE.base, fontWeight: FONT_WEIGHT.semibold, color: COLORS.gray900 },
  cardMeta:       { fontSize: FONT_SIZE.sm, color: COLORS.gray500, marginLeft: 4 },
  cardAmount:     { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, color: COLORS.primary },
  iconLabel:      { flexDirection: "row", alignItems: "center" },
  badge:          { paddingHorizontal: 8, paddingVertical: 3, borderRadius: BORDER_RADIUS.full },
  badgeText:      { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.semibold },

  // Modal
  backdrop:       { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  modalSheet:     {
    flex: 1, backgroundColor: COLORS.white,
    marginTop: 48, borderTopLeftRadius: BORDER_RADIUS.xxl, borderTopRightRadius: BORDER_RADIUS.xxl,
    overflow: "hidden",
  },
  modalHeader:    {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.base,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  modalTitle:     { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.semibold, color: COLORS.gray900 },
  closeBtn:       { padding: SPACING.sm, borderRadius: BORDER_RADIUS.md, backgroundColor: COLORS.gray100 },

  detailSection:  {
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.gray100,
  },
  detailRowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  detailLabel:    { fontSize: FONT_SIZE.sm, color: COLORS.gray500 },
  detailValue:    { fontSize: FONT_SIZE.base, color: COLORS.gray900, fontWeight: FONT_WEIGHT.medium },
  sectionTitle:   { fontSize: FONT_SIZE.base, fontWeight: FONT_WEIGHT.semibold, color: COLORS.gray900, marginBottom: SPACING.sm },

  itemRow:        { flexDirection: "row", alignItems: "center", paddingVertical: 6 },
  itemName:       { fontSize: FONT_SIZE.base, color: COLORS.gray900, fontWeight: FONT_WEIGHT.medium },
  itemQty:        { fontSize: FONT_SIZE.sm, color: COLORS.gray500, marginTop: 2 },
  itemSubtotal:   { fontSize: FONT_SIZE.base, fontWeight: FONT_WEIGHT.semibold, color: COLORS.gray900 },

  totalSection:   { backgroundColor: COLORS.gray50 },
  totalAmount:    { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, color: COLORS.primary },

  notesText:      { fontSize: FONT_SIZE.base, color: COLORS.gray600, lineHeight: 22 },
  actionRow:      { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md },

  // Overlay
  overlay:        {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center", justifyContent: "center", zIndex: 999,
  },
  overlayCard:    {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl, alignItems: "center", gap: SPACING.md, minWidth: 120,
  },
  overlayText:    { fontSize: FONT_SIZE.sm, color: COLORS.gray600 },
});
