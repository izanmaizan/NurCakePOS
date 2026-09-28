// app/dev-seed.tsx — Halaman khusus development untuk mengisi data demo
// Akses via: ketik /dev-seed di URL atau tekan tombol di login page
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { BORDER_RADIUS, COLORS, FONT_SIZE, FONT_WEIGHT, SHADOW, SPACING } from "../constants/theme";
import { useDatabase } from "../context/DatabaseProvider";

type SeedStep = {
  label: string;
  done: boolean;
  error?: string;
};

export default function DevSeedScreen() {
  const { runDevSeed, isInitialized } = useDatabase();
  const [running, setRunning]   = useState(false);
  const [done, setDone]         = useState(false);
  const [steps, setSteps]       = useState<SeedStep[]>([]);

  const seedItems = [
    { icon: "cube-outline"       as const, label: "18 Produk (kue basah, kering, roti, minuman)", color: COLORS.primary },
    { icon: "cafe-outline"       as const, label: "7 Kue Ready tersedia di POS",                  color: COLORS.warning },
    { icon: "receipt-outline"    as const, label: "30+ Transaksi selama 30 hari terakhir",         color: COLORS.success },
    { icon: "book-outline"       as const, label: "12 Pesanan kue (pending/proses/siap/selesai)",  color: COLORS.info    },
    { icon: "pricetag-outline"   as const, label: "Rules harga untuk semua kombinasi kue",         color: "#8B5CF6"      },
  ];

  const handleSeed = async (force: boolean) => {
    if (!isInitialized) {
      Toast.show({ type: "error", text1: "Database belum siap" });
      return;
    }

    setRunning(true);
    setDone(false);
    setSteps([]);

    const addStep = (label: string, ok: boolean, error?: string) => {
      setSteps((prev) => [...prev, { label, done: ok, error }]);
    };

    try {
      addStep("Menginisialisasi...", true);
      await runDevSeed(force);
      addStep("Produk & kategori", true);
      addStep("Kue ready", true);
      addStep("Transaksi & detail", true);
      addStep("Pesanan kue", true);
      addStep("Rules harga", true);
      setDone(true);
      Toast.show({ type: "success", text1: "Seed berhasil!", text2: "Semua data demo sudah tersedia" });
    } catch (err: any) {
      addStep(`Error: ${err.message}`, false, err.message);
      Toast.show({ type: "error", text1: "Seed gagal", text2: err.message });
    } finally {
      setRunning(false);
    }
  };

  const confirmSeed = (force: boolean) => {
    if (force) {
      Alert.alert(
        "Reset & Seed Ulang",
        "Semua data transaksi, pesanan, produk, dan kue ready akan DIHAPUS dan diganti data demo. Lanjutkan?",
        [
          { text: "Batal", style: "cancel" },
          { text: "Reset & Seed", style: "destructive", onPress: () => handleSeed(true) },
        ]
      );
    } else {
      handleSeed(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.gray900} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Dev Seed</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Banner */}
        <View style={styles.banner}>
          <Ionicons name="flask-outline" size={32} color={COLORS.warning} />
          <Text style={styles.bannerTitle}>Development Seed</Text>
          <Text style={styles.bannerDesc}>
            Isi semua halaman dengan data demo realistis. Gunakan hanya untuk development & testing.
          </Text>
        </View>

        {/* Data yang akan di-seed */}
        <Text style={styles.sectionLabel}>Data yang akan di-seed:</Text>
        <View style={styles.itemsCard}>
          {seedItems.map((item, i) => (
            <View key={i} style={[styles.seedItem, i < seedItems.length - 1 && styles.seedItemBorder]}>
              <View style={[styles.seedIcon, { backgroundColor: item.color + "20" }]}>
                <Ionicons name={item.icon} size={20} color={item.color} />
              </View>
              <Text style={styles.seedLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* Progress Steps */}
        {steps.length > 0 && (
          <View style={styles.stepsCard}>
            <Text style={styles.sectionLabel}>Progress:</Text>
            {steps.map((step, i) => (
              <View key={i} style={styles.stepRow}>
                <Ionicons
                  name={step.done ? "checkmark-circle" : "close-circle"}
                  size={18}
                  color={step.done ? COLORS.success : COLORS.error}
                />
                <Text style={[styles.stepText, !step.done && { color: COLORS.error }]}>
                  {step.label}
                </Text>
              </View>
            ))}
            {done && (
              <TouchableOpacity style={styles.goToPos} onPress={() => router.replace("/pos")}>
                <Ionicons name="storefront-outline" size={18} color={COLORS.white} />
                <Text style={styles.goToPosText}>Buka POS</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Buttons */}
        <TouchableOpacity
          style={[styles.btn, styles.btnPrimary, (running || !isInitialized) && styles.btnDisabled]}
          onPress={() => confirmSeed(false)}
          disabled={running || !isInitialized}
          activeOpacity={0.8}>
          <Ionicons name="download-outline" size={20} color={COLORS.white} />
          <Text style={styles.btnText}>
            {running ? "Sedang seed..." : "Seed Data Demo"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.btnDanger, (running || !isInitialized) && styles.btnDisabled]}
          onPress={() => confirmSeed(true)}
          disabled={running || !isInitialized}
          activeOpacity={0.8}>
          <Ionicons name="refresh-outline" size={20} color={COLORS.error} />
          <Text style={[styles.btnText, { color: COLORS.error }]}>Reset & Seed Ulang</Text>
        </TouchableOpacity>

        <Text style={styles.note}>
          • "Seed Data Demo" hanya berjalan jika belum ada transaksi.{"\n"}
          • "Reset & Seed Ulang" menghapus semua data lama terlebih dahulu.{"\n"}
          • Master data (jenis kue, variasi, dll) tidak dihapus.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.background },
  header:       {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn:      { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: BORDER_RADIUS.md, backgroundColor: COLORS.gray100 },
  headerTitle:  { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.semibold, color: COLORS.gray900 },

  content:      { padding: SPACING.lg, paddingBottom: 40 },

  banner:       {
    backgroundColor: COLORS.warningLight, borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl, alignItems: "center", marginBottom: SPACING.xl,
    borderWidth: 1, borderColor: COLORS.warning + "40",
  },
  bannerTitle:  { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold, color: COLORS.gray900, marginTop: SPACING.md, marginBottom: SPACING.sm },
  bannerDesc:   { fontSize: FONT_SIZE.sm, color: COLORS.gray600, textAlign: "center", lineHeight: 20 },

  sectionLabel: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold, color: COLORS.gray500, marginBottom: SPACING.sm, textTransform: "uppercase", letterSpacing: 0.5 },

  itemsCard:    { backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg, marginBottom: SPACING.xl, ...SHADOW.sm },
  seedItem:     { flexDirection: "row", alignItems: "center", padding: SPACING.base, gap: SPACING.md },
  seedItemBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.gray100 },
  seedIcon:     { width: 36, height: 36, borderRadius: BORDER_RADIUS.md, alignItems: "center", justifyContent: "center" },
  seedLabel:    { flex: 1, fontSize: FONT_SIZE.sm, color: COLORS.gray700 },

  stepsCard:    { backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg, padding: SPACING.base, marginBottom: SPACING.xl, ...SHADOW.sm },
  stepRow:      { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginBottom: SPACING.sm },
  stepText:     { fontSize: FONT_SIZE.sm, color: COLORS.gray700 },

  goToPos:      {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: SPACING.sm, backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.md, marginTop: SPACING.md,
  },
  goToPosText:  { color: COLORS.white, fontWeight: FONT_WEIGHT.semibold, fontSize: FONT_SIZE.base },

  btn:          {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: SPACING.sm, borderRadius: BORDER_RADIUS.lg, paddingVertical: 14,
    marginBottom: SPACING.md, ...SHADOW.sm,
  },
  btnPrimary:   { backgroundColor: COLORS.primary },
  btnDanger:    { backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.error },
  btnDisabled:  { opacity: 0.5 },
  btnText:      { fontSize: FONT_SIZE.base, fontWeight: FONT_WEIGHT.semibold, color: COLORS.white },

  note:         { fontSize: FONT_SIZE.xs, color: COLORS.gray400, lineHeight: 18, marginTop: SPACING.sm },
});
