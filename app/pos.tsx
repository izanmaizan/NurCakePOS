// app/pos.tsx - Complete Fixed Version with Auto Delete Kue Ready
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import BottomNavigation from "../components/BottomNavigation";
import CustomCakeComponent from "../components/CustomCakeComponent";
import KueReadyComponent from "../components/KueReadyComponent";
import OtherProductsComponent from "../components/OtherProductsComponent";
import TransactionComponent from "../components/TransactionComponent";
import { KueReadyItem, useKueReady } from "../hooks/useKueReady";
import { useOrders } from "../hooks/useOrders";
import { usePricing } from "../hooks/usePricing";
import { ProductWithCategory, useProducts } from "../hooks/useProducts";
import { useTransactions } from "../hooks/useTransactions";
import { CartItem } from "../repositories/TransactionRepository";
import { useResponsive } from "../hooks/useResponsive";

// Interface untuk item dalam transaksi
interface TransactionItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  type: "kue_custom" | "kue_ready" | "produk_lainnya";
  notes?: string;
  cakeName?: string;
  customDetails?: CustomCakeDetails;
  kueReadyId?: string;
  productId?: string;
}

// Interface untuk detail kue custom
interface CustomCakeDetails {
  cakeType: string;
  variation: string;
  size: string;
  box: string;
  images?: string[];
  notes?: string;
  additionalCosts?: AdditionalCost[];
}

// Interface untuk biaya tambahan
interface AdditionalCost {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

// Interface untuk produk lainnya
// Interface untuk kue ready

export default function POSScreen() {
  const insets = useSafeAreaInsets();
  const { isWide, isLandscape } = useResponsive();

  // Hooks untuk data management
  const { deleteKueReady } = useKueReady();
  const { products, refetch: refetchProducts } = useProducts();
  const { createTransaction } = useTransactions();
  const { createOrder, updateOrderStatus } = useOrders();
  const { masterKriteria } = usePricing();
  
  // State management
  const [currentTime, setCurrentTime] = useState(new Date());
  const [customerName, setCustomerName] = useState("");
  const [notes, setNotes] = useState("");
  const [transactionItems, setTransactionItems] = useState<TransactionItem[]>([]);
  const [showCustomCakeModal, setShowCustomCakeModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [showTransactionPanel, setShowTransactionPanel] = useState(true);
  const [selectedKueReadyIds, setSelectedKueReadyIds] = useState<string[]>([]);

  // Kolom grid: 4 saat panel tersembunyi (landscape full), 2 saat panel terbuka
  const numColumns = isWide && !showTransactionPanel ? 4 : 2;

  // Update waktu setiap detik untuk display real-time
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  /**
   * Mendapatkan stok tersedia untuk produk tertentu
   * Menghitung stok DB dikurangi quantity yang sudah ada di transaksi
   */
  const getAvailableStockForItem = (itemId: string): number => {
    const item = transactionItems.find(it => it.id === itemId);
    if (!item || item.type !== "produk_lainnya" || !item.productId) {
      return Infinity;
    }

    const product = products.find(p => p.id === item.productId);
    if (!product) return 0;

    const inOtherTransactions = transactionItems
      .filter(it => it.productId === item.productId && it.id !== itemId)
      .reduce((sum, it) => sum + it.quantity, 0);

    return product.stok - inOtherTransactions;
  };

  /**
   * Update quantity item dalam transaksi dengan validasi stok
   */
  const updateQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) {
      Toast.show({
        type: "warning",
        text1: "Peringatan",
        text2: "Quantity minimal 1",
      });
      return;
    }

    const available = getAvailableStockForItem(itemId);
    if (newQuantity > available) {
      Toast.show({
        type: "error",
        text1: "Stok Tidak Cukup",
        text2: `Stok tersedia: ${available}. Maksimal ${available} item.`,
      });
      return;
    }

    setTransactionItems((items) =>
      items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              quantity: newQuantity,
              subtotal: newQuantity * item.unitPrice,
            }
          : item
      )
    );
  };

  /**
   * Hapus item dari transaksi dan update selectedKueReadyIds
   */
  const removeFromTransaction = (itemId: string) => {
    const item = transactionItems.find((i) => i.id === itemId);
    setTransactionItems((items) => items.filter((i) => i.id !== itemId));
    if (item?.kueReadyId) {
      setSelectedKueReadyIds((ids) => ids.filter((id) => id !== item.kueReadyId));
    }
  };

  /**
   * Tambah produk lainnya ke transaksi dengan validasi stok
   */
  const addProductToTransaction = (product: ProductWithCategory, quantity: number = 1) => {
    if (!product || !product.harga || typeof product.harga !== 'number') {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Data produk tidak valid",
      });
      return;
    }

    const currentInTransaction = transactionItems
      .filter((item) => item.productId === product.id && item.type === "produk_lainnya")
      .reduce((sum, item) => sum + item.quantity, 0);

    const availableStock = product.stok - currentInTransaction;
    if (quantity > availableStock) {
      Toast.show({
        type: "error",
        text1: "Stok Tidak Cukup",
        text2: `Stok tersedia: ${availableStock}. Maksimal ${availableStock} item.`,
      });
      return;
    }

    const existingItem = transactionItems.find(
      (item) => item.productId === product.id && item.type === "produk_lainnya"
    );

    if (existingItem) {
      setTransactionItems((items) =>
        items.map((item) =>
          item.id === existingItem.id
            ? {
                ...item,
                quantity: item.quantity + quantity,
                subtotal: (item.quantity + quantity) * item.unitPrice,
              }
            : item
        )
      );
    } else {
      const uniqueId = `produk_${product.id}_${Date.now()}`;
      const newItem: TransactionItem = {
        id: uniqueId,
        name: product.nama,
        quantity: quantity,
        unitPrice: product.harga,
        subtotal: product.harga * quantity,
        type: "produk_lainnya",
        productId: product.id,
      };
      setTransactionItems((items) => [...items, newItem]);
    }

    Toast.show({
      type: "success",
      text1: "Berhasil",
      text2: `${quantity}x ${product.nama} ditambahkan ke transaksi`,
    });
  };

  /**
   * Tambah kue ready ke transaksi (unlimited, tidak ada validasi stok)
   */
  const addKueReadyToTransaction = (kueReady: KueReadyItem, cakeName: string) => {
    const totalPrice = kueReady.hargaJual || 0;
    const uniqueId = `ready_${kueReady.id}_${Date.now()}`;
    
    const newItem: TransactionItem = {
      id: uniqueId,
      name: `${kueReady.nama} - "${cakeName}"`,
      quantity: 1,
      unitPrice: totalPrice,
      subtotal: totalPrice,
      type: "kue_ready",
      cakeName: cakeName,
      kueReadyId: kueReady.id,
    };
    
    setTransactionItems((items) => [...items, newItem]);
    setSelectedKueReadyIds((ids) => [...ids, kueReady.id]);

    Toast.show({
      type: "success",
      text1: "Berhasil",
      text2: `${kueReady.nama} ditambahkan ke transaksi`,
    });
  };

  /**
   * Tambah kue custom ke transaksi (unlimited, tidak ada validasi stok)
   */
  const addCustomCakeToTransaction = (customCake: any) => {
    console.log("📦 Custom Cake Data Received:", customCake);
    
    if (!customCake || !customCake.subtotal) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Data kue custom tidak valid"
      });
      return;
    }

    const uniqueId = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newItem: TransactionItem = {
      id: uniqueId,
      name: customCake.name,
      quantity: customCake.quantity,
      unitPrice: customCake.unitPrice,
      subtotal: customCake.subtotal,
      type: "kue_custom",
      customDetails: customCake.customDetails,
      notes: customCake.customDetails?.notes || "",
    };
    
    setTransactionItems((items) => [...items, newItem]);
    setShowCustomCakeModal(false);

    Toast.show({
      type: "success",
      text1: "Berhasil",
      text2: `${customCake.name} ditambahkan ke transaksi`,
    });
  };

  /**
   * Proses transaksi lengkap:
   * 1. Validasi transaksi tidak kosong
   * 2. Simpan transaksi ke database
   * 3. Simpan order kue custom jika ada
   * 4. Hapus kue ready yang terjual
   * 5. Refetch products untuk update stok
   * 6. Clear semua state dan refresh UI
   */
  const executeTransaction = async (orderData: any) => {
    try {
      setProcessing(true);

      const productItems = transactionItems.filter(item => item.type === "produk_lainnya");
      const customCakeItems = transactionItems.filter(item => item.type === "kue_custom");
      const kueReadyItems = transactionItems.filter(item => item.type === "kue_ready");

      const allTransactionItems: CartItem[] = [
        ...productItems.map(item => ({
          produkId: item.productId!,
          namaProduk: item.name,
          hargaSatuan: item.unitPrice,
          jumlah: item.quantity,
          subtotal: item.subtotal,
        })),
        ...customCakeItems.map(item => ({
          produkId: item.id,
          namaProduk: item.name,
          hargaSatuan: item.unitPrice,
          jumlah: item.quantity,
          subtotal: item.subtotal,
        })),
        ...kueReadyItems.map(item => ({
          produkId: item.kueReadyId || item.id,
          namaProduk: item.name,
          hargaSatuan: item.unitPrice,
          jumlah: item.quantity,
          subtotal: item.subtotal,
        })),
      ];

      // STEP 1: Simpan transaksi
      const transactionResult = await createTransaction({
        items: allTransactionItems,
        metodePembayaran: orderData.paymentMethod || "cash",
        catatan: notes || orderData.notes || "",
        namaPelanggan: customerName || orderData.customerName || "",
      });

      // STEP 2: Simpan pesanan kue custom ke buku pesanan
      for (const customCakeItem of customCakeItems) {
        if (!customCakeItem.customDetails) continue;
        const details = customCakeItem.customDetails;

        const jenisKue = masterKriteria?.jenisKue?.find((k: any) => k.nama === details.cakeType);
        const variasiKue = masterKriteria?.variasiKue?.find((k: any) => k.nama === details.variation);
        const ukuranKue = masterKriteria?.ukuranKue?.find((k: any) => k.nama === details.size);
        const kotakKue = masterKriteria?.kotakKue?.find((k: any) => k.nama === details.box);

        if (!jenisKue || !variasiKue || !ukuranKue || !kotakKue) continue;

        let pickupDate = new Date();
        let orderStatus = "ready";

        if (orderData.pickupDate) {
          pickupDate = new Date(orderData.pickupDate);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          pickupDate.setHours(0, 0, 0, 0);
          orderStatus = pickupDate > today ? "pending" : "ready";
        }

        try {
          const orderResult = await createOrder({
            namaPelanggan: customerName || orderData.customerName || "Guest",
            noHp: orderData.phoneNumber || "",
            jenisKue: jenisKue.id,
            variasiKue: variasiKue.id,
            ukuranKue: ukuranKue.id,
            kotakKue: kotakKue.id,
            tanggalAmbil: pickupDate.toISOString().split("T")[0],
            catatan: details.notes || notes || "",
            gambarReferensi: details.images?.[0],
            totalHarga: customCakeItem.subtotal,
          });
          if (orderStatus !== "pending") {
            await updateOrderStatus(orderResult.id, orderStatus);
          }
        } catch (orderError) {
          console.error("Gagal buat order kue custom:", orderError);
        }
      }

      // STEP 3: Hapus kue ready yang terjual
      for (const item of kueReadyItems) {
        if (item.kueReadyId) {
          try { await deleteKueReady(item.kueReadyId); } catch { /* non-blocking */ }
        }
      }

      // STEP 4: Reset state
      setTransactionItems([]);
      setSelectedKueReadyIds([]);
      setCustomerName("");
      setNotes("");
      await refetchProducts();

      const parts = [`#${transactionResult.nomorTransaksi} tersimpan`];
      if (customCakeItems.length > 0) parts.push(`${customCakeItems.length} order dibuat`);
      if (kueReadyItems.length > 0) parts.push(`${kueReadyItems.length} kue ready terjual`);

      Toast.show({
        type: "success",
        text1: "Transaksi Berhasil!",
        text2: parts.join(" · "),
        visibilityTime: 4000,
      });
    } catch (error: any) {
      Toast.show({
        type: "error",
        text1: "Transaksi Gagal",
        text2: error.message || "Terjadi kesalahan",
      });
    } finally {
      setProcessing(false);
    }
  };

  const processTransaction = (orderData: any) => {
    if (transactionItems.length === 0) {
      Toast.show({ type: "error", text1: "Error", text2: "Transaksi kosong" });
      return;
    }

    const total = transactionItems.reduce((s, i) => s + i.subtotal, 0);
    const totalFormatted = total.toLocaleString("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    });

    Alert.alert(
      "Konfirmasi Transaksi",
      `${transactionItems.length} item  ·  Total ${totalFormatted}`,
      [
        { text: "Batal", style: "cancel" },
        { text: "Proses", onPress: () => executeTransaction(orderData) },
      ]
    );
  };

  /**
   * Handle logout dengan konfirmasi
   */
  const handleLogout = () => {
    Alert.alert("Logout", "Apakah Anda yakin ingin keluar?", [
      { text: "Batal", style: "cancel" },
      {
        text: "Keluar",
        style: "destructive",
        onPress: () => router.replace("/login"),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Tombol logout — floating minimal, tidak memakan layout */}
      <TouchableOpacity onPress={handleLogout} style={[styles.logoutFloating, { top: insets.top > 0 ? 8 : 12 }]}>
        <Ionicons name="log-out-outline" size={16} color="#9CA3AF" />
      </TouchableOpacity>

      {/* Wrapper flex — konten di atas, navbar di bawah dalam layout normal */}
      <View style={styles.innerWrapper}>
        <View style={[styles.content, { flexDirection: isWide ? "row" : "column" }]}>
          {/* Area produk */}
          <ScrollView
            style={styles.mainContent}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.scrollContent,
              {
                paddingBottom: isWide ? 20 : 140,
                paddingHorizontal: isLandscape ? 12 : 20,
              },
            ]}>

            <TouchableOpacity
              style={styles.customCakeButton}
              onPress={() => setShowCustomCakeModal(true)}>
              <Ionicons name="add" size={20} color="white" />
              <Text style={styles.customCakeButtonText}>Pesan Kue Custom</Text>
            </TouchableOpacity>

            <KueReadyComponent
              onAddToTransaction={addKueReadyToTransaction}
              selectedKueReadyIds={selectedKueReadyIds}
              numColumns={numColumns}
            />

            <OtherProductsComponent
              onAddToTransaction={addProductToTransaction}
              transactionItems={transactionItems}
              numColumns={numColumns}
            />
          </ScrollView>

          {/* Tombol toggle bulat — sembunyikan/tampilkan panel transaksi */}
          {isWide && (
            <View style={styles.toggleWrapper}>
              <TouchableOpacity
                style={styles.toggleButton}
                onPress={() => setShowTransactionPanel(v => !v)}
                activeOpacity={0.7}>
                <Ionicons
                  name={showTransactionPanel ? "chevron-forward" : "chevron-back"}
                  size={14}
                  color="#6B7280"
                />
              </TouchableOpacity>
            </View>
          )}

          {/* Panel transaksi — side panel 30% di wide/landscape */}
          {isWide && showTransactionPanel && (
            <View style={styles.transactionPanelWrapper}>
              <TransactionComponent
                transactionItems={transactionItems}
                customerName={customerName}
                notes={notes}
                currentTime={currentTime}
                onCustomerNameChange={setCustomerName}
                onNotesChange={setNotes}
                onUpdateQuantity={updateQuantity}
                onRemoveItem={removeFromTransaction}
                onProcessTransaction={processTransaction}
                isTablet={true}
                processing={processing}
              />
            </View>
          )}
        </View>

        {/* Panel transaksi — bottom sheet di portrait */}
        {!isWide && (
          <TransactionComponent
            transactionItems={transactionItems}
            customerName={customerName}
            notes={notes}
            currentTime={currentTime}
            onCustomerNameChange={setCustomerName}
            onNotesChange={setNotes}
            onUpdateQuantity={updateQuantity}
            onRemoveItem={removeFromTransaction}
            onProcessTransaction={processTransaction}
            isTablet={false}
            processing={processing}
          />
        )}
      </View>

      {/* Modal kue custom */}
      <CustomCakeComponent
        visible={showCustomCakeModal}
        onClose={() => setShowCustomCakeModal(false)}
        onSave={addCustomCakeToTransaction}
      />

      {/* Navbar — layout normal, tidak absolute, tidak pernah menutupi konten */}
      <BottomNavigation currentPage="pos" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  logoutFloating: {
    position: "absolute",
    right: 14,
    zIndex: 50,
    backgroundColor: "rgba(255,255,255,0.85)",
    borderRadius: 8,
    padding: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 4,
  },
  innerWrapper: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  toggleWrapper: {
    width: 20,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  toggleButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  transactionPanelWrapper: {
    width: "30%",
    overflow: "hidden",
  },
  mainContent: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 10,
  },
  customCakeButton: {
    backgroundColor: "#EA580C",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 16,
    shadowColor: "#EA580C",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  customCakeButtonText: {
    color: "white",
    fontWeight: "600",
    marginLeft: 8,
    fontSize: 16,
  },
});