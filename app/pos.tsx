// app/pos.tsx - Complete Fixed Version with Auto Delete Kue Ready
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Dimensions,
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
import { useKueReady } from "../hooks/useKueReady";
import { useOrders } from "../hooks/useOrders";
import { usePricing } from "../hooks/usePricing";
import { useProducts } from "../hooks/useProducts";
import { useTransactions } from "../hooks/useTransactions";
import { CartItem } from "../repositories/TransactionRepository";

const { width: screenWidth } = Dimensions.get("screen");
const isTablet = screenWidth >= 768;

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
interface Product {
  id: string;
  nama: string;
  harga: number;
  stok: number;
  kategori: {
    id: string;
    nama: string;
  };
  gambarPath?: string;
}

// Interface untuk kue ready
interface KueReady {
  id: string;
  nama: string;
  jenisKue: string;
  variasiKue: string;
  ukuranKue: string;
  hargaJual: number;
  gambarPath?: string;
  status: "available" | "unavailable";
  catatan?: string;
}

export default function POSScreen() {
  const insets = useSafeAreaInsets();
  
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
  const [selectedKueReadyIds, setSelectedKueReadyIds] = useState<string[]>([]);

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
    setTransactionItems((items) => items.filter((item) => item.id !== itemId));
    setSelectedKueReadyIds((ids) => ids.filter((id) => !itemId.includes(id)));
  };

  /**
   * Tambah produk lainnya ke transaksi dengan validasi stok
   */
  const addProductToTransaction = (product: Product, quantity: number = 1) => {
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
  const addKueReadyToTransaction = (kueReady: KueReady, cakeName: string) => {
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
  const processTransaction = async (orderData: any) => {
    if (transactionItems.length === 0) {
      Toast.show({ 
        type: "error", 
        text1: "Error", 
        text2: "Transaksi kosong" 
      });
      return;
    }

    try {
      setProcessing(true);

      // Pisahkan items berdasarkan tipe untuk proses berbeda
      const productItems = transactionItems.filter(item => item.type === "produk_lainnya");
      const customCakeItems = transactionItems.filter(item => item.type === "kue_custom");
      const kueReadyItems = transactionItems.filter(item => item.type === "kue_ready");

      // Mapping items ke format CartItem untuk repository
      const mappedTransactionItems: CartItem[] = productItems.map((item) => ({
        produkId: item.productId!,
        namaProduk: item.name,
        hargaSatuan: item.unitPrice,
        jumlah: item.quantity,
        subtotal: item.subtotal,
      }));

      const customCakeTransactionItems: CartItem[] = customCakeItems.map((item) => ({
        produkId: item.id,
        namaProduk: item.name,
        hargaSatuan: item.unitPrice,
        jumlah: item.quantity,
        subtotal: item.subtotal,
      }));

      const kueReadyTransactionItems: CartItem[] = kueReadyItems.map((item) => ({
        produkId: item.kueReadyId || item.id,
        namaProduk: item.name,
        hargaSatuan: item.unitPrice,
        jumlah: item.quantity,
        subtotal: item.subtotal,
      }));

      // Gabungkan semua items untuk transaksi
      const allTransactionItems = [
        ...mappedTransactionItems,
        ...customCakeTransactionItems,
        ...kueReadyTransactionItems,
      ];

      const totalHarga = allTransactionItems.reduce((sum, item) => sum + item.subtotal, 0);

      console.log("💾 Saving Transaction:", {
        totalItems: allTransactionItems.length,
        totalHarga,
        customCakeItems: customCakeItems.length,
        kueReadyItems: kueReadyItems.length,
      });

      // STEP 1: Simpan transaksi ke database
      const transactionResult = await createTransaction({
        items: allTransactionItems,
        metodePembayaran: orderData.paymentMethod || "cash",
        catatan: notes || orderData.notes || "",
        namaPelanggan: customerName || orderData.customerName || "",
      });

      console.log("✅ Transaction Saved:", transactionResult.nomorTransaksi);

      // STEP 2: Simpan custom cake orders ke buku pesanan
      for (const customCakeItem of customCakeItems) {
        if (!customCakeItem.customDetails) continue;

        const details = customCakeItem.customDetails;
        
        // Cari ID dari master data berdasarkan nama
        const jenisKue = masterKriteria?.jenisKue?.find(
          (k: any) => k.nama === details.cakeType
        );
        const variasiKue = masterKriteria?.variasiKue?.find(
          (k: any) => k.nama === details.variation
        );
        const ukuranKue = masterKriteria?.ukuranKue?.find(
          (k: any) => k.nama === details.size
        );
        const kotakKue = masterKriteria?.kotakKue?.find(
          (k: any) => k.nama === details.box
        );

        if (!jenisKue || !variasiKue || !ukuranKue || !kotakKue) {
          console.warn("⚠️ Missing master data for custom cake:", details);
          continue;
        }

        // Tentukan status order berdasarkan tanggal pickup
        let orderStatus = "ready";
        let pickupDate = new Date();

        if (orderData.pickupDate) {
          pickupDate = new Date(orderData.pickupDate);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          pickupDate.setHours(0, 0, 0, 0);

          if (pickupDate > today) {
            orderStatus = "pending";
          } else {
            orderStatus = "ready";
          }
        }

        console.log("📋 Creating Order for Custom Cake:", {
          name: customCakeItem.name,
          status: orderStatus,
          pickupDate: pickupDate.toISOString(),
        });

        try {
          const orderResult = await createOrder({
            namaPelanggan: customerName || orderData.customerName || "Guest",
            nomorTelepon: orderData.phoneNumber || "000000000000",
            jenisKue: jenisKue.id,
            variasiKue: variasiKue.id,
            ukuranKue: ukuranKue.id,
            aksesoris: kotakKue.id,
            tanggalAmbil: pickupDate,
            catatan: details.notes || notes || "",
            gambarReferensiPath: details.images?.[0],
          });

          // Update status jika bukan pending
          if (orderStatus !== "pending") {
            await updateOrderStatus(orderResult.id, orderStatus);
            console.log(`✅ Order status set to: ${orderStatus}`);
          }

          console.log("✅ Order Created:", orderResult.nomorPesanan);
        } catch (orderError) {
          console.error("❌ Failed to create order:", orderError);
        }
      }

      // STEP 3: Hapus kue ready yang sudah terjual dari database
      console.log("🗑️ Deleting sold Kue Ready items...");
      for (const kueReadyItem of kueReadyItems) {
        if (kueReadyItem.kueReadyId) {
          try {
            await deleteKueReady(kueReadyItem.kueReadyId);
            console.log(`✅ Deleted Kue Ready: ${kueReadyItem.name}`);
          } catch (deleteError) {
            console.error(`❌ Failed to delete Kue Ready ${kueReadyItem.name}:`, deleteError);
          }
        }
      }

      // STEP 4: Clear state dan refresh data
      setTransactionItems([]);
      setSelectedKueReadyIds([]);
      setCustomerName("");
      setNotes("");
      await refetchProducts();

      // Show success message
      const successMessage = [];
      successMessage.push(`Transaksi #${transactionResult.nomorTransaksi} tersimpan`);
      if (customCakeItems.length > 0) {
        successMessage.push(`${customCakeItems.length} order kue custom dibuat`);
      }
      if (kueReadyItems.length > 0) {
        successMessage.push(`${kueReadyItems.length} kue ready terjual`);
      }

      Toast.show({
        type: "success",
        text1: "Transaksi Berhasil!",
        text2: successMessage.join(", "),
        visibilityTime: 4000,
      });

    } catch (error: any) {
      console.error("❌ Error proses transaksi:", error);
      Toast.show({ 
        type: "error", 
        text1: "Error", 
        text2: error.message || "Gagal proses transaksi" 
      });
    } finally {
      setProcessing(false);
    }
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
      {/* Header dengan logo dan logout button */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logoContainer}>
            <Ionicons name="cafe" size={24} color="#EA580C" />
          </View>
          <Text style={styles.headerTitle}>NurCake POS</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Ionicons name="log-out" size={24} color="#EF4444" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {/* Main scrollable content area */}
        <ScrollView
          style={isTablet ? styles.tabletMainContent : styles.mobileMainContent}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingBottom: isTablet ? 20 : insets.bottom + 180,
            },
          ]}>
          
          {/* Button untuk membuka modal pesan kue custom */}
          <TouchableOpacity
            style={styles.customCakeButton}
            onPress={() => setShowCustomCakeModal(true)}>
            <Ionicons name="add" size={20} color="white" />
            <Text style={styles.customCakeButtonText}>Pesan Kue Custom</Text>
          </TouchableOpacity>

          {/* Section untuk menampilkan dan memilih kue ready */}
          <KueReadyComponent 
            onAddToTransaction={addKueReadyToTransaction}
            selectedKueReadyIds={selectedKueReadyIds}
          />

          {/* Section untuk menampilkan dan memilih produk lainnya */}
          <OtherProductsComponent
            onAddToTransaction={addProductToTransaction}
            transactionItems={transactionItems}
          />
        </ScrollView>

        {/* Transaction panel untuk tablet (side panel) */}
        {isTablet && (
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
        )}
      </View>

      {/* Transaction panel untuk mobile (bottom floating panel) */}
      {!isTablet && (
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

      {/* Modal untuk membuat pesanan kue custom */}
      <CustomCakeComponent
        visible={showCustomCakeModal}
        onClose={() => setShowCustomCakeModal(false)}
        onSave={addCustomCakeToTransaction}
      />

      {/* Bottom navigation bar */}
      <BottomNavigation currentPage="pos" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
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
    zIndex: 10,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoContainer: {
    width: 40,
    height: 40,
    backgroundColor: "#FED7AA",
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
  },
  logoutButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    flexDirection: isTablet ? "row" : "column",
  },
  tabletMainContent: {
    flex: 1,
  },
  mobileMainContent: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  customCakeButton: {
    backgroundColor: "#EA580C",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 24,
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