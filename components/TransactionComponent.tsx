// components/TransactionComponent.tsx - Fixed v6
// Fixes:
// 1. DateTimePicker tidak reset saat diubah
// 2. Custom cake selalu dimulai dengan status "pending"
// 3. Status transaksi berdasarkan waktu pengambilan

import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { sqliteService } from "../database/SQLiteService";
import { useOrders } from "../hooks/useOrders";
import { usePricing } from "../hooks/usePricing";
import { useTransactions } from "../hooks/useTransactions";

// Types
interface AdditionalCost {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

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

interface CustomCakeDetails {
  cakeType: string;
  variation: string;
  size: string;
  box: string;
  images?: string[];
  notes?: string;
  additionalCosts?: AdditionalCost[];
}

interface OrderForm {
  pickupDate: Date;
  pickupTime: string;
  paymentMethod: "cash" | "transfer";
  paidAmount: number;
  transferProof?: string;
  additionalCosts: AdditionalCost[];
}

interface TransactionComponentProps {
  transactionItems: TransactionItem[];
  customerName: string;
  notes: string;
  currentTime: Date;
  onCustomerNameChange: (name: string) => void;
  onNotesChange: (notes: string) => void;
  onUpdateQuantity: (itemId: string, newQuantity: number) => void;
  onRemoveItem: (itemId: string) => void;
  onProcessTransaction: (orderData: any) => void;
  isTablet?: boolean;
  processing?: boolean;
}

export default function TransactionComponent({
  transactionItems,
  customerName,
  notes,
  currentTime,
  onCustomerNameChange,
  onNotesChange,
  onUpdateQuantity,
  onRemoveItem,
  onProcessTransaction,
  isTablet = false,
}: TransactionComponentProps) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { createTransaction, loading: transactionLoading } = useTransactions();
  const { createOrder, loading: orderLoading, masterData } = useOrders();
  const { masterKriteria } = usePricing();

  const [isTransactionPanelOpen, setIsTransactionPanelOpen] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedItemForDetail, setSelectedItemForDetail] =
    useState<TransactionItem | null>(null);

  const [currentStep, setCurrentStep] = useState<
    "items" | "payment" | "receipt"
  >("items");
  const [processing, setProcessing] = useState(false);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // FIX: Initialize with function to ensure proper Date object
  const [orderForm, setOrderForm] = useState<OrderForm>(() => {
    const now = new Date();
    return {
      pickupDate: now,
      pickupTime: `${now.getHours().toString().padStart(2, "0")}:${now
        .getMinutes()
        .toString()
        .padStart(2, "0")}`,
      paymentMethod: "cash",
      paidAmount: 0,
      transferProof: undefined,
      additionalCosts: [],
    };
  });

  const [orderResult, setOrderResult] = useState<any>(null);

  // Additional Costs Functions
  const addAdditionalCost = () => {
    const newCost: AdditionalCost = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      name: "",
      quantity: 1,
      unitPrice: 0,
      subtotal: 0,
    };
    setOrderForm((prev) => ({
      ...prev,
      additionalCosts: [...prev.additionalCosts, newCost],
    }));
  };

  const updateAdditionalCost = (
    id: string,
    field: keyof AdditionalCost,
    value: string | number
  ) => {
    setOrderForm((prev) => ({
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
    setOrderForm((prev) => ({
      ...prev,
      additionalCosts: prev.additionalCosts.filter((cost) => cost.id !== id),
    }));
  };

  const calculateAdditionalCostsTotal = (): number => {
    return orderForm.additionalCosts.reduce((sum, cost) => {
      return sum + cost.quantity * cost.unitPrice;
    }, 0);
  };

  const getTotalPrice = () => {
    const itemsTotal = transactionItems.reduce(
      (total, item) => total + item.subtotal,
      0
    );
    const additionalTotal = calculateAdditionalCostsTotal();
    return itemsTotal + additionalTotal;
  };

  const getTotalItems = () => {
    return transactionItems.reduce((total, item) => total + item.quantity, 0);
  };

  const getChangeAmount = () => {
    const total = getTotalPrice();
    return Math.max(0, orderForm.paidAmount - total);
  };

  const getShortageAmount = () => {
    const total = getTotalPrice();
    return Math.max(0, total - orderForm.paidAmount);
  };

  const formatDate = (date: Date | undefined) => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      return new Date().toLocaleDateString("id-ID", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }
    return date.toLocaleDateString("id-ID", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (date: Date | undefined) => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      return new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    }
    return date.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  // FIX: Handle date change - only update if user confirmed (not dismissed)
  const onDateChange = useCallback((event: any, selectedDate?: Date) => {
    // On Android, dismiss picker first
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }

    // Only update if user selected a date (not cancelled)
    if (event.type === "set" && selectedDate) {
      setOrderForm((prev) => ({ ...prev, pickupDate: selectedDate }));
    } else if (event.type === "dismissed") {
      // User cancelled - don't update
      setShowDatePicker(false);
    }

    // For iOS, keep picker open until explicitly closed
    if (Platform.OS === "ios" && selectedDate) {
      setOrderForm((prev) => ({ ...prev, pickupDate: selectedDate }));
    }
  }, []);

  // FIX: Handle time change - only update if user confirmed (not dismissed)
  const onTimeChange = useCallback((event: any, selectedTime?: Date) => {
    // On Android, dismiss picker first
    if (Platform.OS === "android") {
      setShowTimePicker(false);
    }

    // Only update if user selected a time (not cancelled)
    if (event.type === "set" && selectedTime) {
      const hours = selectedTime.getHours().toString().padStart(2, "0");
      const minutes = selectedTime.getMinutes().toString().padStart(2, "0");
      setOrderForm((prev) => ({ ...prev, pickupTime: `${hours}:${minutes}` }));
    } else if (event.type === "dismissed") {
      // User cancelled - don't update
      setShowTimePicker(false);
    }

    // For iOS
    if (Platform.OS === "ios" && selectedTime) {
      const hours = selectedTime.getHours().toString().padStart(2, "0");
      const minutes = selectedTime.getMinutes().toString().padStart(2, "0");
      setOrderForm((prev) => ({ ...prev, pickupTime: `${hours}:${minutes}` }));
    }
  }, []);

  // Handle transfer proof image
  const pickTransferProof = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const fileName = `transfer_proof_${Date.now()}.jpg`;
        const savedImagePath = await sqliteService.saveFile(
          result.assets[0].uri,
          fileName,
          "transfer_proofs"
        );

        setOrderForm((prev) => ({
          ...prev,
          transferProof: savedImagePath,
        }));

        Toast.show({
          type: "success",
          text1: "Berhasil",
          text2: "Bukti transfer berhasil dipilih",
        });
      }
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Gagal memilih bukti transfer",
      });
    }
  };

  const removeTransferProof = () => {
    setOrderForm((prev) => ({
      ...prev,
      transferProof: undefined,
    }));
  };

  const handleItemDetail = (item: TransactionItem) => {
    setSelectedItemForDetail(item);
    setShowDetailModal(true);
  };

  const handleOpenImageModal = (images: string | string[]) => {
    if (typeof images === "string") {
      setSelectedImages([images]);
    } else {
      setSelectedImages(images);
    }
    setCurrentImageIndex(0);
    setShowImageModal(true);
  };

  const nextImage = () => {
    setCurrentImageIndex((prev) =>
      prev < selectedImages.length - 1 ? prev + 1 : 0
    );
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) =>
      prev > 0 ? prev - 1 : selectedImages.length - 1
    );
  };

  // Helper function to find kriteria ID by name
  const findKriteriaId = (
    type: "jenisKue" | "variasiKue" | "ukuranKue" | "kotakKue",
    name: string
  ): string => {
    const list = masterKriteria[type];
    const item = list?.find(
      (k: any) => k.nama?.toLowerCase() === name?.toLowerCase()
    );
    return item?.id || "";
  };

  // Proceed to payment step
  const handleProceedToPayment = () => {
    if (!customerName.trim()) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Nama pelanggan harus diisi",
      });
      return;
    }

    if (transactionItems.length === 0) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Tambahkan minimal 1 item ke transaksi",
      });
      return;
    }

    // Auto-set paid amount to total price
    const totalPrice = getTotalPrice();
    setOrderForm((prev) => ({
      ...prev,
      paidAmount: totalPrice,
    }));

    setCurrentStep("payment");
  };

  // Main transaction creation function
  const handleCreateTransaction = async () => {
    if (transactionItems.length === 0) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Tambahkan minimal 1 item ke transaksi",
      });
      return;
    }

    if (!customerName.trim()) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Nama pelanggan harus diisi",
      });
      return;
    }

    const totalPrice = getTotalPrice();

    // Determine payment status
    let statusPembayaran: "lunas" | "dp" | "belum_bayar" = "lunas";
    if (orderForm.paidAmount <= 0) {
      statusPembayaran = "belum_bayar";
    } else if (orderForm.paidAmount < totalPrice) {
      statusPembayaran = "dp";
    }

    // FIX: Safe pickup datetime with null checks
    const pickupDate = orderForm.pickupDate || new Date();
    const pickupDateTime = new Date(pickupDate);
    const timeParts = (orderForm.pickupTime || "00:00").split(":");
    pickupDateTime.setHours(
      parseInt(timeParts[0]) || 0,
      parseInt(timeParts[1]) || 0,
      0,
      0
    );

    // FIX: Check if there are custom cakes
    const hasCustomCake = transactionItems.some(
      (item) => item.type === "kue_custom"
    );

    const now = new Date();
    const isPickupNowOrPast = pickupDateTime <= now;

    // FIX: Transaction status
    // - If has custom cake AND pickup is in future -> "pending" (menunggu kue dibuat)
    // - If pickup is now/past AND no custom cake -> "ready" (siap diambil)
    // - Otherwise -> "pending"
    let statusPesanan: string;
    if (hasCustomCake) {
      // Custom cake always starts as pending (perlu diproses)
      statusPesanan = "pending";
    } else if (isPickupNowOrPast) {
      // No custom cake and pickup now/past -> ready
      statusPesanan = "ready";
    } else {
      // No custom cake but pickup in future -> pending (menunggu waktu)
      statusPesanan = "pending";
    }

    // Validate transfer proof
    if (orderForm.paymentMethod === "transfer" && !orderForm.transferProof) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Mohon upload bukti transfer",
      });
      return;
    }

    setProcessing(true);

    try {
      console.log("💾 Step 1: Menyimpan transaksi...");

      const mapItemType = (
        type: string
      ): "produk" | "kue_ready" | "pesanan" => {
        switch (type) {
          case "kue_ready":
            return "kue_ready";
          case "kue_custom":
            return "pesanan";
          case "produk_lainnya":
          default:
            return "produk";
        }
      };

      const cartItems = transactionItems.map((item) => ({
        tipeItem: mapItemType(item.type),
        itemId: item.kueReadyId || item.productId || item.id,
        namaItem: item.name,
        hargaSatuan: item.unitPrice,
        jumlah: item.quantity,
        subtotal: item.subtotal,
        catatan: item.notes || "",
      }));

      // Add additional costs
      orderForm.additionalCosts.forEach((cost) => {
        if (cost.name && cost.quantity > 0 && cost.unitPrice > 0) {
          cartItems.push({
            tipeItem: "produk" as const,
            itemId: cost.id,
            namaItem: `[Biaya Tambahan] ${cost.name}`,
            hargaSatuan: cost.unitPrice,
            jumlah: cost.quantity,
            subtotal: cost.subtotal,
            catatan: "",
          });
        }
      });

      const transactionData = {
        items: cartItems,
        metodePembayaran: orderForm.paymentMethod,
        catatan: notes,
        namaPelanggan: customerName,
        statusPembayaran: statusPembayaran,
        statusPesanan: statusPesanan,
        jumlahBayar: orderForm.paidAmount,
        tanggalPengambilan: pickupDateTime.toISOString(),
      };

      const newTransaction = await createTransaction(transactionData);
      console.log("✅ Transaksi berhasil disimpan:", newTransaction.id);

      // 2. SAVE CUSTOM CAKES TO ORDER BOOK
      console.log("📖 Step 2: Menyimpan kue custom ke buku pesanan...");

      const customCakeItems = transactionItems.filter(
        (item) => item.type === "kue_custom" && item.customDetails
      );

      if (customCakeItems.length > 0) {
        console.log(
          `🔍 Ditemukan ${customCakeItems.length} kue custom untuk disimpan`
        );

        for (const customCake of customCakeItems) {
          try {
            const jenisKueId = findKriteriaId(
              "jenisKue",
              customCake.customDetails!.cakeType
            );
            const variasiKueId = findKriteriaId(
              "variasiKue",
              customCake.customDetails!.variation
            );
            const ukuranKueId = findKriteriaId(
              "ukuranKue",
              customCake.customDetails!.size
            );
            const kotakKueId = findKriteriaId(
              "kotakKue",
              customCake.customDetails!.box
            );

            let savedImagePath = undefined;
            if (
              customCake.customDetails?.images &&
              customCake.customDetails.images.length > 0
            ) {
              savedImagePath = customCake.customDetails.images[0];
            }

            // FIX: Custom cake order ALWAYS starts with "pending" status
            // This means it needs to be processed/made first
            const orderData = {
              namaPelanggan: customerName,
              noHp: "",
              tanggalAmbil: pickupDateTime.toISOString().split('T')[0],
              jenisKue: jenisKueId,
              variasiKue: variasiKueId,
              ukuranKue: ukuranKueId,
              kotakKue: kotakKueId,
              totalHarga: customCake.subtotal,
              catatan:
                customCake.customDetails?.notes ||
                customCake.notes ||
                notes ||
                "",
              gambarReferensi: savedImagePath,
            };

            console.log("📝 Creating order:", orderData);
            await createOrder(orderData);
            console.log("✅ Pesanan kue custom berhasil disimpan");
          } catch (orderError) {
            console.error("⚠️ Gagal menyimpan kue custom:", orderError);
          }
        }
      }

      // 3. CREATE RESULT FOR RECEIPT
      const shortageAmount = getShortageAmount();
      const changeAmount = getChangeAmount();

      const result = {
        orderNumber: newTransaction.nomorTransaksi,
        customerName: customerName,
        items: transactionItems,
        additionalCosts: orderForm.additionalCosts,
        totalPrice: totalPrice,
        paidAmount: orderForm.paidAmount,
        changeAmount: changeAmount,
        shortageAmount: shortageAmount,
        paymentMethod: orderForm.paymentMethod,
        transferProof: orderForm.transferProof,
        pickupDate: pickupDateTime,
        notes: notes,
        createdAt: new Date(),
        statusPembayaran: statusPembayaran,
        hasCustomCake: hasCustomCake,
      };

      setOrderResult(result);
      setCurrentStep("receipt");

      Toast.show({
        type: "success",
        text1: "Berhasil!",
        text2: `Transaksi ${newTransaction.nomorTransaksi} tersimpan`,
      });

      // Clear items
      transactionItems.forEach((item) => onRemoveItem(item.id));
      onCustomerNameChange("");
      onNotesChange("");
    } catch (error: any) {
      console.error("❌ Error creating transaction:", error);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: error.message || "Gagal membuat transaksi",
      });
    } finally {
      setProcessing(false);
    }
  };

  const generateReceiptText = (order: any) => {
    let receiptText =
      `*STRUK TRANSAKSI NURCAKE*\n\n` +
      `No. Transaksi: ${order.orderNumber}\n` +
      `Pelanggan: ${order.customerName}\n` +
      `Tanggal: ${new Date(order.createdAt).toLocaleDateString("id-ID")}\n` +
      `Waktu: ${new Date(order.createdAt).toLocaleTimeString("id-ID")}\n\n` +
      `*JADWAL PENGAMBILAN:*\n` +
      `${new Date(order.pickupDate).toLocaleDateString("id-ID")} ${new Date(
        order.pickupDate
      ).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      })}\n\n` +
      `*DETAIL TRANSAKSI:*\n` +
      order.items
        .map(
          (item: TransactionItem) =>
            `${item.name}\n${
              item.quantity
            }x @ Rp ${item.unitPrice.toLocaleString(
              "id-ID"
            )} = Rp ${item.subtotal.toLocaleString("id-ID")}`
        )
        .join("\n\n");

    if (order.additionalCosts && order.additionalCosts.length > 0) {
      receiptText += `\n\n*BIAYA TAMBAHAN:*\n`;
      order.additionalCosts.forEach((cost: AdditionalCost) => {
        if (cost.name && cost.quantity > 0 && cost.unitPrice > 0) {
          receiptText += `${cost.name}\n${
            cost.quantity
          }x @ Rp ${cost.unitPrice.toLocaleString(
            "id-ID"
          )} = Rp ${cost.subtotal.toLocaleString("id-ID")}\n`;
        }
      });
    }

    receiptText +=
      `\n*TOTAL: Rp ${order.totalPrice.toLocaleString("id-ID")}*\n` +
      `Dibayar: Rp ${order.paidAmount.toLocaleString("id-ID")}\n` +
      `Metode: ${order.paymentMethod === "cash" ? "Tunai" : "Transfer"}\n`;

    if (order.shortageAmount > 0) {
      receiptText += `Kekurangan: Rp ${order.shortageAmount.toLocaleString(
        "id-ID"
      )}\n`;
      receiptText += `⚠️ *Sisa pembayaran dilunasi saat pengambilan*\n`;
    }

    if (order.changeAmount > 0) {
      receiptText += `Kembalian: Rp ${order.changeAmount.toLocaleString(
        "id-ID"
      )}\n`;
    }

    if (order.hasCustomCake) {
      receiptText += `\n📋 *Kue custom akan diproses. Cek status di Lacak Pesanan.*\n`;
    }

    if (order.notes) {
      receiptText += `\nCatatan: ${order.notes}\n`;
    }

    receiptText += `\nTerima kasih atas kepercayaan Anda!`;

    return receiptText;
  };

  const handlePrintReceipt = async () => {
    if (!orderResult) return;

    try {
      const receiptText = generateReceiptText(orderResult);
      await Share.share({
        message: receiptText,
        title: "Struk Transaksi NurCake",
      });
    } catch (error) {
      Alert.alert("Error", "Gagal mencetak struk");
    }
  };

  const handleShareWhatsApp = async () => {
    if (!orderResult) return;

    try {
      const receiptText = generateReceiptText(orderResult);
      const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(
        receiptText
      )}`;
      const canOpen = await Linking.canOpenURL(whatsappUrl);

      if (canOpen) {
        await Linking.openURL(whatsappUrl);
      } else {
        Alert.alert("Error", "WhatsApp tidak terinstall");
      }
    } catch (error) {
      Alert.alert("Error", "Gagal mengirim via WhatsApp");
    }
  };

  const handleClosePanel = () => {
    setCurrentStep("items");
    setIsTransactionPanelOpen(false);
    setOrderResult(null);

    // Reset form to NOW
    const now = new Date();
    setOrderForm({
      pickupDate: now,
      pickupTime: `${now.getHours().toString().padStart(2, "0")}:${now
        .getMinutes()
        .toString()
        .padStart(2, "0")}`,
      paymentMethod: "cash",
      paidAmount: 0,
      transferProof: undefined,
      additionalCosts: [],
    });
  };

  // Render Payment Step Content
  const renderPaymentContent = () => {
    const totalPrice = getTotalPrice();
    const isPaidLessThanTotal = orderForm.paidAmount < totalPrice;
    const isPaidMoreThanTotal = orderForm.paidAmount > totalPrice;
    const shortageAmount = Math.max(0, totalPrice - orderForm.paidAmount);
    const changeAmount = Math.max(0, orderForm.paidAmount - totalPrice);
    const hasCustomCake = transactionItems.some(
      (item) => item.type === "kue_custom"
    );

    return (
      <ScrollView
        style={styles.transactionPanelContent}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        {/* Step Indicator */}
        <View style={styles.stepIndicator}>
          <View style={styles.stepIndicatorContainer}>
            <View style={[styles.stepDot, styles.stepDotCompleted]}>
              <Ionicons name="checkmark" size={16} color="white" />
            </View>
            <Text style={styles.stepLabel}>Detail</Text>
          </View>
          <View style={styles.stepLine} />
          <View style={styles.stepIndicatorContainer}>
            <View style={[styles.stepDot, styles.stepDotActive]}>
              <Text style={styles.stepDotText}>2</Text>
            </View>
            <Text style={styles.stepLabel}>Bayar</Text>
          </View>
        </View>

        {/* Order Summary */}
        <View style={styles.orderSummaryCard}>
          <Text style={styles.orderSummaryTitle}>Ringkasan Pesanan</Text>
          <View style={styles.orderSummaryRow}>
            <Text style={styles.orderSummaryLabel}>Pelanggan:</Text>
            <Text style={styles.orderSummaryValue}>{customerName}</Text>
          </View>
          <View style={styles.orderSummaryRow}>
            <Text style={styles.orderSummaryLabel}>Total Item:</Text>
            <Text style={styles.orderSummaryValue}>{getTotalItems()} item</Text>
          </View>
          <View style={styles.orderSummaryRow}>
            <Text style={styles.orderSummaryLabel}>Total Harga:</Text>
            <Text style={styles.orderSummaryValueBold}>
              Rp {totalPrice.toLocaleString("id-ID")}
            </Text>
          </View>
          {hasCustomCake && (
            <View
              style={[
                styles.orderSummaryRow,
                {
                  marginTop: 8,
                  paddingTop: 8,
                  borderTopWidth: 1,
                  borderTopColor: "#E5E7EB",
                },
              ]}>
              <Ionicons name="information-circle" size={16} color="#F59E0B" />
              <Text
                style={[
                  styles.orderSummaryValue,
                  { color: "#F59E0B", flex: 1, marginLeft: 8 },
                ]}>
                Ada kue custom - akan masuk ke Lacak Pesanan
              </Text>
            </View>
          )}
        </View>

        {/* Pickup Info */}
        <View style={styles.pickupInfoCard}>
          <Ionicons name="time" size={20} color="#EA580C" />
          <View style={styles.pickupInfoText}>
            <Text style={styles.pickupInfoTitle}>Jadwal Pengambilan:</Text>
            <Text style={styles.pickupInfoDetail}>
              {formatDate(orderForm.pickupDate)},{" "}
              {orderForm.pickupTime || "00:00"} WIB
            </Text>
          </View>
        </View>

        {/* Payment Method */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Metode Pembayaran *</Text>
          <View style={styles.paymentMethodContainer}>
            <TouchableOpacity
              style={[
                styles.paymentMethodButton,
                orderForm.paymentMethod === "cash" &&
                  styles.paymentMethodButtonActive,
              ]}
              onPress={() =>
                setOrderForm((prev) => ({
                  ...prev,
                  paymentMethod: "cash",
                  transferProof: undefined,
                }))
              }>
              <Ionicons
                name="cash"
                size={24}
                color={orderForm.paymentMethod === "cash" ? "white" : "#6B7280"}
              />
              <Text
                style={[
                  styles.paymentMethodText,
                  orderForm.paymentMethod === "cash" &&
                    styles.paymentMethodTextActive,
                ]}>
                Tunai
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.paymentMethodButton,
                orderForm.paymentMethod === "transfer" &&
                  styles.paymentMethodButtonActive,
              ]}
              onPress={() =>
                setOrderForm((prev) => ({
                  ...prev,
                  paymentMethod: "transfer",
                }))
              }>
              <Ionicons
                name="card"
                size={24}
                color={
                  orderForm.paymentMethod === "transfer" ? "white" : "#6B7280"
                }
              />
              <Text
                style={[
                  styles.paymentMethodText,
                  orderForm.paymentMethod === "transfer" &&
                    styles.paymentMethodTextActive,
                ]}>
                Transfer
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Transfer Proof Upload */}
        {orderForm.paymentMethod === "transfer" && (
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Bukti Transfer *</Text>
            {!orderForm.transferProof ? (
              <TouchableOpacity
                style={styles.transferProofUploadButton}
                onPress={pickTransferProof}>
                <Ionicons name="cloud-upload" size={24} color="#6B7280" />
                <Text style={styles.transferProofUploadText}>
                  Upload Bukti Transfer
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.transferProofPreview}>
                <Image
                  source={{
                    uri: orderForm.transferProof.startsWith("file://")
                      ? orderForm.transferProof
                      : `file://${orderForm.transferProof}`,
                  }}
                  style={styles.transferProofImage}
                  resizeMode="cover"
                />
                <TouchableOpacity
                  style={styles.removeTransferProofButton}
                  onPress={removeTransferProof}>
                  <Ionicons name="trash" size={16} color="white" />
                  <Text style={styles.removeTransferProofText}>Hapus</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Amount Paid */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Jumlah Dibayar *</Text>
          <View style={styles.inputContainer}>
            <Ionicons
              name="cash"
              size={20}
              color="#9CA3AF"
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.textInput}
              value={
                orderForm.paidAmount > 0
                  ? orderForm.paidAmount.toLocaleString("id-ID")
                  : ""
              }
              onChangeText={(text) => {
                const numericValue = parseInt(text.replace(/[^0-9]/g, "")) || 0;
                setOrderForm((prev) => ({
                  ...prev,
                  paidAmount: numericValue,
                }));
              }}
              placeholder="0"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
            />
          </View>

          {/* Payment Status */}
          <View style={styles.paymentStatusContainer}>
            <View style={styles.paymentTotalRow}>
              <Text style={styles.paymentTotalLabel}>Total Transaksi:</Text>
              <Text style={styles.paymentTotalValue}>
                Rp {totalPrice.toLocaleString("id-ID")}
              </Text>
            </View>

            {isPaidLessThanTotal && orderForm.paidAmount > 0 && (
              <View style={styles.paymentWarningCard}>
                <View style={styles.paymentWarningHeader}>
                  <Ionicons name="alert-circle" size={20} color="#F59E0B" />
                  <Text style={styles.paymentWarningTitle}>
                    Pembayaran Kurang (DP)
                  </Text>
                </View>
                <Text style={styles.paymentWarningText}>
                  Kekurangan: Rp {shortageAmount.toLocaleString("id-ID")}
                </Text>
                <View style={styles.paymentWarningNote}>
                  <Ionicons
                    name="information-circle"
                    size={16}
                    color="#F59E0B"
                  />
                  <Text style={styles.paymentWarningNoteText}>
                    Sisa pembayaran dilunasi saat pengambilan
                  </Text>
                </View>
              </View>
            )}

            {isPaidMoreThanTotal && (
              <View style={styles.paymentSuccessCard}>
                <View style={styles.paymentSuccessHeader}>
                  <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                  <Text style={styles.paymentSuccessTitle}>
                    Pembayaran Berlebih
                  </Text>
                </View>
                <Text style={styles.paymentSuccessText}>
                  Kembalian: Rp {changeAmount.toLocaleString("id-ID")}
                </Text>
              </View>
            )}

            {orderForm.paidAmount === totalPrice &&
              orderForm.paidAmount > 0 && (
                <View style={styles.paymentExactCard}>
                  <View style={styles.paymentExactHeader}>
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color="#2563EB"
                    />
                    <Text style={styles.paymentExactTitle}>
                      Pembayaran Pas (Lunas)
                    </Text>
                  </View>
                </View>
              )}
          </View>
        </View>
      </ScrollView>
    );
  };

  // Render Receipt Step Content
  const renderReceiptContent = () => {
    if (!orderResult) return null;

    return (
      <ScrollView
        style={styles.transactionPanelContent}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        {/* Success Icon */}
        <View style={styles.receiptSuccessContainer}>
          <View style={styles.receiptSuccessIcon}>
            <Ionicons name="checkmark-circle" size={80} color="#10B981" />
          </View>
          <Text style={styles.receiptSuccessTitle}>Transaksi Berhasil!</Text>
          <Text style={styles.receiptOrderNumber}>
            {orderResult.orderNumber}
          </Text>
        </View>

        {/* Receipt Summary */}
        <View style={styles.orderSummaryCard}>
          <Text style={styles.orderSummaryTitle}>Ringkasan</Text>
          <View style={styles.orderSummaryRow}>
            <Text style={styles.orderSummaryLabel}>Pelanggan:</Text>
            <Text style={styles.orderSummaryValue}>
              {orderResult.customerName}
            </Text>
          </View>
          <View style={styles.orderSummaryRow}>
            <Text style={styles.orderSummaryLabel}>Total:</Text>
            <Text style={styles.orderSummaryValueBold}>
              Rp {orderResult.totalPrice?.toLocaleString("id-ID")}
            </Text>
          </View>
          <View style={styles.orderSummaryRow}>
            <Text style={styles.orderSummaryLabel}>Dibayar:</Text>
            <Text style={styles.orderSummaryValue}>
              Rp {orderResult.paidAmount?.toLocaleString("id-ID")}
            </Text>
          </View>
          {orderResult.changeAmount > 0 && (
            <View style={styles.orderSummaryRow}>
              <Text style={styles.orderSummaryLabel}>Kembalian:</Text>
              <Text style={[styles.orderSummaryValue, { color: "#10B981" }]}>
                Rp {orderResult.changeAmount?.toLocaleString("id-ID")}
              </Text>
            </View>
          )}
          {orderResult.shortageAmount > 0 && (
            <View style={styles.orderSummaryRow}>
              <Text style={styles.orderSummaryLabel}>Kekurangan:</Text>
              <Text style={[styles.orderSummaryValue, { color: "#F59E0B" }]}>
                Rp {orderResult.shortageAmount?.toLocaleString("id-ID")}
              </Text>
            </View>
          )}
          <View style={styles.orderSummaryRow}>
            <Text style={styles.orderSummaryLabel}>Status:</Text>
            <Text
              style={[
                styles.orderSummaryValue,
                {
                  color:
                    orderResult.statusPembayaran === "lunas"
                      ? "#10B981"
                      : "#F59E0B",
                },
              ]}>
              {orderResult.statusPembayaran === "lunas"
                ? "LUNAS"
                : orderResult.statusPembayaran === "dp"
                ? "DP"
                : "BELUM BAYAR"}
            </Text>
          </View>
        </View>

        {/* Custom Cake Info */}
        {orderResult.hasCustomCake && (
          <View
            style={[
              styles.orderSummaryCard,
              { backgroundColor: "#FEF3C7", borderColor: "#FDE68A" },
            ]}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="information-circle" size={24} color="#F59E0B" />
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.orderSummaryTitle,
                    { color: "#92400E", marginBottom: 4 },
                  ]}>
                  Kue Custom Perlu Diproses
                </Text>
                <Text style={{ color: "#78350F", fontSize: 13 }}>
                  Cek dan update status di menu "Lacak Pesanan"
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.receiptActions}>
          <TouchableOpacity
            style={styles.receiptActionButton}
            onPress={handlePrintReceipt}>
            <Ionicons name="share-social" size={20} color="#EA580C" />
            <Text style={styles.receiptActionButtonText}>Bagikan Struk</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.receiptActionButton}
            onPress={handleShareWhatsApp}>
            <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
            <Text style={styles.receiptActionButtonText}>WhatsApp</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  };

  // Render Items Step Content (main transaction details)
  const renderItemsContent = () => (
    <ScrollView
      style={styles.transactionPanelContent}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
      <View style={styles.transactionDateSection}>
        <Text style={styles.sectionLabel}>Tanggal Transaksi</Text>
        <View style={styles.dateTimeDisplay}>
          <View style={styles.dateTimeRow}>
            <Ionicons name="calendar" size={16} color="#EA580C" />
            <Text style={styles.dateTimeText}>{formatDate(currentTime)}</Text>
          </View>
          <View style={styles.dateTimeRow}>
            <Ionicons name="time" size={16} color="#EA580C" />
            <Text style={styles.dateTimeText}>{formatTime(currentTime)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Nama Pelanggan *</Text>
        <View style={styles.inputContainer}>
          <Ionicons
            name="person"
            size={20}
            color="#9CA3AF"
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.textInput}
            value={customerName}
            onChangeText={onCustomerNameChange}
            placeholder="Masukkan nama pelanggan"
            placeholderTextColor="#9CA3AF"
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Tanggal & Jam Pengambilan</Text>
        <View style={styles.dateTimeRow}>
          <TouchableOpacity
            style={styles.dateButtonFlex}
            onPress={() => setShowDatePicker(true)}>
            <Ionicons name="calendar" size={18} color="#6B7280" />
            <Text style={styles.dateTimeButtonTextCompact}>
              {(orderForm.pickupDate || new Date()).toLocaleDateString(
                "id-ID",
                {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                }
              )}
            </Text>
            <Ionicons name="chevron-down" size={18} color="#6B7280" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.timeButtonFixed}
            onPress={() => setShowTimePicker(true)}>
            <Ionicons name="time" size={18} color="#6B7280" />
            <Text style={styles.dateTimeButtonTextCompact}>
              {orderForm.pickupTime || "00:00"}
            </Text>
            <Ionicons name="chevron-down" size={18} color="#6B7280" />
          </TouchableOpacity>
        </View>
        <Text style={styles.pickupDateHelper}>
          Default: Sekarang. Ubah jika pesanan diambil nanti.
        </Text>
      </View>

      {/* DateTimePicker - Rendered outside ScrollView for Android */}
      {showDatePicker && (
        <DateTimePicker
          value={orderForm.pickupDate || new Date()}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={onDateChange}
        />
      )}

      {showTimePicker && (
        <DateTimePicker
          value={(() => {
            const timeParts = (orderForm.pickupTime || "00:00").split(":");
            const d = new Date();
            d.setHours(
              parseInt(timeParts[0]) || 0,
              parseInt(timeParts[1]) || 0,
              0,
              0
            );
            return d;
          })()}
          mode="time"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={onTimeChange}
        />
      )}

      {transactionItems.length > 0 && (
        <View style={styles.additionalCostsSection}>
          <View style={styles.sectionHeaderContainer}>
            <Text style={styles.sectionLabel}>Biaya Tambahan</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={addAdditionalCost}>
              <Ionicons name="add" size={16} color="white" />
              <Text style={styles.addButtonText}>Tambah</Text>
            </TouchableOpacity>
          </View>

          {orderForm.additionalCosts.length === 0 ? (
            <Text style={styles.emptyAdditionalText}>
              Tidak ada biaya tambahan
            </Text>
          ) : (
            orderForm.additionalCosts.map((cost) => (
              <View key={cost.id} style={styles.additionalCostItemCompact}>
                <View style={styles.additionalCostHeader}>
                  <TextInput
                    style={styles.additionalCostNameInput}
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
                <View style={styles.additionalCostDetails}>
                  <View style={styles.additionalCostInput}>
                    <Text style={styles.additionalCostInputLabel}>Qty</Text>
                    <TextInput
                      style={styles.additionalCostInputField}
                      placeholder="0"
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
                  <Text style={styles.additionalCostMultiplier}>×</Text>
                  <View style={styles.additionalCostInput}>
                    <Text style={styles.additionalCostInputLabel}>Harga</Text>
                    <TextInput
                      style={styles.additionalCostInputField}
                      placeholder="0"
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
                  <Text style={styles.additionalCostEquals}>=</Text>
                  <View style={styles.additionalCostSubtotal}>
                    <Text style={styles.additionalCostSubtotalLabel}>
                      Total
                    </Text>
                    <Text style={styles.additionalCostSubtotalValue}>
                      Rp {cost.subtotal.toLocaleString("id-ID")}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}

          {orderForm.additionalCosts.length > 0 && (
            <View style={styles.additionalCostsTotalContainerCompact}>
              <Text style={styles.additionalCostsTotalLabel}>
                Total Biaya Tambahan:
              </Text>
              <Text style={styles.additionalCostsTotalValue}>
                Rp {calculateAdditionalCostsTotal().toLocaleString("id-ID")}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Notes */}
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Catatan</Text>
        <TextInput
          style={styles.notesInput}
          value={notes}
          onChangeText={onNotesChange}
          placeholder="Catatan tambahan (opsional)"
          placeholderTextColor="#9CA3AF"
          multiline
          numberOfLines={3}
        />
      </View>

      {/* Transaction Items */}
      <View style={styles.itemsSection}>
        <Text style={styles.sectionLabel}>
          Daftar Item ({transactionItems.length})
        </Text>
        {transactionItems.length === 0 ? (
          <View style={styles.emptyItemsContainer}>
            <Ionicons name="cart-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyItemsText}>Belum ada item</Text>
            <Text style={styles.emptyItemsSubtext}>
              Tambahkan produk dari menu di sebelah kiri
            </Text>
          </View>
        ) : (
          transactionItems.map((item) => (
            <View key={item.id} style={styles.transactionItem}>
              <TouchableOpacity
                style={styles.itemDetailButton}
                onPress={() => handleItemDetail(item)}>
                <Ionicons name="eye-outline" size={18} color="#6B7280" />
              </TouchableOpacity>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName} numberOfLines={2}>
                  {item.name}
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                  }}>
                  <Text style={styles.itemPrice}>
                    Rp {item.unitPrice.toLocaleString("id-ID")}
                  </Text>
                  {item.type === "kue_custom" && (
                    <View style={styles.customBadge}>
                      <Text style={styles.customBadgeText}>Custom</Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={styles.itemActions}>
                <View style={styles.quantityContainer}>
                  <TouchableOpacity
                    onPress={() =>
                      onUpdateQuantity(item.id, Math.max(1, item.quantity - 1))
                    }
                    style={styles.quantityButton}>
                    <Ionicons name="remove" size={16} color="#EA580C" />
                  </TouchableOpacity>
                  <Text style={styles.quantityText}>{item.quantity}</Text>
                  <TouchableOpacity
                    onPress={() => onUpdateQuantity(item.id, item.quantity + 1)}
                    style={styles.quantityButton}>
                    <Ionicons name="add" size={16} color="#EA580C" />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  onPress={() => onRemoveItem(item.id)}
                  style={styles.removeButton}>
                  <Ionicons name="trash" size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>

      {transactionItems.length > 0 && (
        <View style={styles.totalSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalItemsLabel}>
              Total Items: {getTotalItems()}
            </Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Harga:</Text>
            <Text style={styles.totalAmount}>
              Rp {getTotalPrice().toLocaleString("id-ID")}
            </Text>
          </View>
        </View>
      )}
    </ScrollView>
  );

  // Render mobile floating button and expandable panel
  const renderMobileTransactionSummary = () => (
    <>
      {!isTransactionPanelOpen && transactionItems.length > 0 && (
        <TouchableOpacity
          style={[
            styles.floatingTransactionButton,
            { bottom: 16 },
          ]}
          onPress={() => setIsTransactionPanelOpen(true)}>
          <View style={styles.floatingButtonContent}>
            <View style={styles.floatingItemCount}>
              <Text style={styles.floatingItemCountText}>
                {transactionItems.length}
              </Text>
            </View>
            <View style={styles.floatingTransactionInfo}>
              <Text style={styles.floatingTransactionLabel}>Total</Text>
              <Text style={styles.floatingTransactionTotal}>
                Rp {getTotalPrice().toLocaleString("id-ID")}
              </Text>
            </View>
            <Ionicons name="chevron-up" size={16} color="white" />
          </View>
        </TouchableOpacity>
      )}

      {isTransactionPanelOpen && (
        <View
          style={[styles.expandableTransactionPanel, { bottom: 0, top: 0 }]}>
          {/* Header */}
          <View style={styles.transactionPanelHeader}>
            <TouchableOpacity
              onPress={() => {
                if (currentStep === "items") {
                  setIsTransactionPanelOpen(false);
                } else if (currentStep === "payment") {
                  setCurrentStep("items");
                } else {
                  handleClosePanel();
                }
              }}
              style={styles.closePanelButton}>
              <Ionicons
                name={currentStep === "items" ? "chevron-down" : "arrow-back"}
                size={24}
                color="#6B7280"
              />
            </TouchableOpacity>
            <Text style={styles.transactionPanelTitle}>
              {currentStep === "items"
                ? "Transaksi"
                : currentStep === "payment"
                ? "Pembayaran"
                : "Struk"}
            </Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Content based on step */}
          {currentStep === "items" && renderItemsContent()}
          {currentStep === "payment" && renderPaymentContent()}
          {currentStep === "receipt" && renderReceiptContent()}

          {/* Action Buttons */}
          {currentStep === "items" && transactionItems.length > 0 && (
            <View
              style={[
                styles.panelActionButtons,
                { paddingBottom: 16 },
              ]}>
              <TouchableOpacity
                style={styles.processButton}
                onPress={handleProceedToPayment}>
                <Ionicons name="card" size={20} color="white" />
                <Text style={styles.processButtonText}>
                  Lanjut ke Pembayaran
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {currentStep === "payment" && (
            <View
              style={[
                styles.panelActionButtons,
                { paddingBottom: insets.bottom + 16, gap: 8 },
              ]}>
              <TouchableOpacity
                style={[
                  styles.processButton,
                  { backgroundColor: "#6B7280", flex: 0.4 },
                ]}
                onPress={() => setCurrentStep("items")}>
                <Ionicons name="arrow-back" size={20} color="white" />
                <Text style={styles.processButtonText}>Kembali</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.processButton, { flex: 0.6 }]}
                onPress={handleCreateTransaction}
                disabled={processing || transactionLoading}>
                {processing || transactionLoading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="white" />
                    <Text style={styles.processButtonText}>Selesaikan</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {currentStep === "receipt" && (
            <View
              style={[
                styles.panelActionButtons,
                { paddingBottom: 16 },
              ]}>
              <TouchableOpacity
                style={[styles.processButton, { backgroundColor: "#10B981" }]}
                onPress={handleClosePanel}>
                <Ionicons name="checkmark" size={20} color="white" />
                <Text style={styles.processButtonText}>Selesai</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </>
  );

  // ─────────────────────────────────────────────────────────────────
  // WIDE PANEL — panel samping khusus landscape / tablet
  // Desain compact & professional, tidak pakai expand/collapse
  // ─────────────────────────────────────────────────────────────────

  const renderWidePanelItems = () => {
    const total = getTotalPrice();
    const totalItem = getTotalItems();

    return (
      <View style={wp.container}>
        {/* Header */}
        <View style={wp.header}>
          <View style={wp.headerLeft}>
            <View style={wp.headerIcon}>
              <Ionicons name="receipt" size={14} color="#EA580C" />
            </View>
            <Text style={wp.headerTitle}>Pesanan</Text>
            {transactionItems.length > 0 && (
              <View style={wp.headerBadge}>
                <Text style={wp.headerBadgeText}>{transactionItems.length}</Text>
              </View>
            )}
          </View>
          {/* Step dots */}
          <View style={wp.steps}>
            <View style={[wp.stepDot, wp.stepDotActive]} />
            <View style={[wp.stepDot, wp.stepDotInactive]} />
            <View style={[wp.stepDot, wp.stepDotInactive]} />
          </View>
        </View>

        {/* Customer input — compact */}
        <View style={wp.customerRow}>
          <Ionicons name="person-outline" size={15} color="#9CA3AF" />
          <TextInput
            style={wp.customerInput}
            value={customerName}
            onChangeText={onCustomerNameChange}
            placeholder="Nama pelanggan..."
            placeholderTextColor="#9CA3AF"
            returnKeyType="done"
          />
        </View>

        {/* Items list */}
        {transactionItems.length === 0 ? (
          <View style={wp.emptyState}>
            <Ionicons name="cart-outline" size={36} color="#D1D5DB" />
            <Text style={wp.emptyTitle}>Keranjang kosong</Text>
            <Text style={wp.emptySubtext}>Pilih produk dari panel kiri</Text>
          </View>
        ) : (
          <ScrollView
            style={wp.itemsList}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            {transactionItems.map((item, idx) => {
              const typeColor =
                item.type === "kue_custom"
                  ? "#D97706"
                  : item.type === "kue_ready"
                  ? "#2563EB"
                  : "#16A34A";
              const typeBg =
                item.type === "kue_custom"
                  ? "#FEF3C7"
                  : item.type === "kue_ready"
                  ? "#DBEAFE"
                  : "#DCFCE7";
              const typeIcon =
                item.type === "kue_custom"
                  ? "star"
                  : item.type === "kue_ready"
                  ? "cafe"
                  : ("cube" as any);

              return (
                <View
                  key={item.id}
                  style={[wp.itemRow, idx < transactionItems.length - 1 && wp.itemRowBorder]}>
                  {/* Type badge */}
                  <View style={[wp.typeBadge, { backgroundColor: typeBg }]}>
                    <Ionicons name={typeIcon} size={11} color={typeColor} />
                  </View>

                  {/* Name + price */}
                  <View style={wp.itemInfo}>
                    <Text style={wp.itemName} numberOfLines={1}>{item.name}</Text>
                    <Text style={wp.itemUnit}>
                      Rp {item.unitPrice.toLocaleString("id-ID")}
                    </Text>
                  </View>

                  {/* Qty stepper */}
                  <View style={wp.qtyRow}>
                    <TouchableOpacity
                      onPress={() => onUpdateQuantity(item.id, Math.max(1, item.quantity - 1))}
                      style={wp.qtyBtn}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                      <Ionicons name="remove" size={13} color="#EA580C" />
                    </TouchableOpacity>
                    <Text style={wp.qtyText}>{item.quantity}</Text>
                    <TouchableOpacity
                      onPress={() => onUpdateQuantity(item.id, item.quantity + 1)}
                      style={wp.qtyBtn}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                      <Ionicons name="add" size={13} color="#EA580C" />
                    </TouchableOpacity>
                  </View>

                  {/* Subtotal + delete */}
                  <View style={wp.itemRight}>
                    <Text style={wp.itemSubtotal}>
                      {(item.subtotal / 1000).toFixed(0)}K
                    </Text>
                    <TouchableOpacity
                      onPress={() => onRemoveItem(item.id)}
                      style={wp.deleteBtn}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                      <Ionicons name="close" size={13} color="#9CA3AF" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}

        {/* Total footer */}
        <View style={wp.footer}>
          <View style={wp.totalRow}>
            <Text style={wp.totalLabel}>{totalItem} item</Text>
            <Text style={wp.totalValue}>
              Rp {total.toLocaleString("id-ID")}
            </Text>
          </View>
          <TouchableOpacity
            style={[wp.payBtn, transactionItems.length === 0 && wp.payBtnDisabled]}
            onPress={transactionItems.length > 0 ? handleProceedToPayment : undefined}
            disabled={transactionItems.length === 0}
            activeOpacity={0.85}>
            <Ionicons name="card" size={16} color="white" />
            <Text style={wp.payBtnText}>Proses Pembayaran</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderWidePanelPayment = () => {
    const total = getTotalPrice();
    const shortage = Math.max(0, total - orderForm.paidAmount);
    const change = Math.max(0, orderForm.paidAmount - total);
    const quickAmounts = [total, total + 10000, total + 50000, 100000, 200000];
    const uniqueQuick = [...new Set(quickAmounts)].slice(0, 4);

    return (
      <View style={wp.container}>
        {/* Header */}
        <View style={wp.header}>
          <TouchableOpacity
            onPress={() => setCurrentStep("items")}
            style={wp.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={18} color="#6B7280" />
          </TouchableOpacity>
          <Text style={wp.headerTitle}>Pembayaran</Text>
          <View style={wp.steps}>
            <View style={[wp.stepDot, wp.stepDotDone]}>
              <Ionicons name="checkmark" size={8} color="white" />
            </View>
            <View style={[wp.stepDot, wp.stepDotActive]} />
            <View style={[wp.stepDot, wp.stepDotInactive]} />
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={wp.payScroll}>

          {/* Total besar */}
          <View style={wp.totalCard}>
            <Text style={wp.totalCardLabel}>Total Pembayaran</Text>
            <Text style={wp.totalCardAmount}>
              Rp {total.toLocaleString("id-ID")}
            </Text>
            <Text style={wp.totalCardSub}>
              {customerName || "Pelanggan"} · {getTotalItems()} item
            </Text>
          </View>

          {/* Metode pembayaran */}
          <Text style={wp.sectionLabel}>Metode</Text>
          <View style={wp.methodRow}>
            <TouchableOpacity
              style={[wp.methodBtn, orderForm.paymentMethod === "cash" && wp.methodBtnActive]}
              onPress={() => setOrderForm(p => ({ ...p, paymentMethod: "cash", transferProof: undefined }))}>
              <Ionicons name="cash" size={16} color={orderForm.paymentMethod === "cash" ? "white" : "#6B7280"} />
              <Text style={[wp.methodLabel, orderForm.paymentMethod === "cash" && wp.methodLabelActive]}>Tunai</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[wp.methodBtn, orderForm.paymentMethod === "transfer" && wp.methodBtnActive]}
              onPress={() => setOrderForm(p => ({ ...p, paymentMethod: "transfer" }))}>
              <Ionicons name="phone-portrait" size={16} color={orderForm.paymentMethod === "transfer" ? "white" : "#6B7280"} />
              <Text style={[wp.methodLabel, orderForm.paymentMethod === "transfer" && wp.methodLabelActive]}>Transfer</Text>
            </TouchableOpacity>
          </View>

          {/* Jumlah bayar */}
          <Text style={wp.sectionLabel}>Jumlah Bayar</Text>
          <View style={wp.amountInputRow}>
            <Text style={wp.amountPrefix}>Rp</Text>
            <TextInput
              style={wp.amountInput}
              value={orderForm.paidAmount > 0 ? orderForm.paidAmount.toString() : ""}
              onChangeText={t => setOrderForm(p => ({ ...p, paidAmount: parseInt(t.replace(/[^0-9]/g, "")) || 0 }))}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* Quick amounts */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={wp.quickRow} contentContainerStyle={{ gap: 6 }}>
            {uniqueQuick.map(amt => (
              <TouchableOpacity
                key={amt}
                style={[wp.quickBtn, orderForm.paidAmount === amt && wp.quickBtnActive]}
                onPress={() => setOrderForm(p => ({ ...p, paidAmount: amt }))}>
                <Text style={[wp.quickBtnText, orderForm.paidAmount === amt && wp.quickBtnTextActive]}>
                  {amt >= 1000 ? `${(amt / 1000).toFixed(0)}K` : `${amt}`}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Kembalian / kekurangan */}
          {change > 0 && (
            <View style={[wp.changeRow, { backgroundColor: "#DCFCE7" }]}>
              <Ionicons name="arrow-down-circle" size={15} color="#16A34A" />
              <Text style={[wp.changeLabel, { color: "#16A34A" }]}>Kembalian</Text>
              <Text style={[wp.changeValue, { color: "#16A34A" }]}>
                Rp {change.toLocaleString("id-ID")}
              </Text>
            </View>
          )}
          {shortage > 0 && (
            <View style={[wp.changeRow, { backgroundColor: "#FEF3C7" }]}>
              <Ionicons name="alert-circle" size={15} color="#D97706" />
              <Text style={[wp.changeLabel, { color: "#D97706" }]}>Kekurangan</Text>
              <Text style={[wp.changeValue, { color: "#D97706" }]}>
                Rp {shortage.toLocaleString("id-ID")}
              </Text>
            </View>
          )}

          {/* Jadwal ambil (compact) */}
          <Text style={wp.sectionLabel}>Jadwal Ambil</Text>
          <View style={wp.pickupRow}>
            <TouchableOpacity style={wp.pickupBtn} onPress={() => setShowDatePicker(true)}>
              <Ionicons name="calendar" size={14} color="#6B7280" />
              <Text style={wp.pickupBtnText}>
                {(orderForm.pickupDate || new Date()).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={wp.pickupBtn} onPress={() => setShowTimePicker(true)}>
              <Ionicons name="time" size={14} color="#6B7280" />
              <Text style={wp.pickupBtnText}>{orderForm.pickupTime || "00:00"}</Text>
            </TouchableOpacity>
          </View>

          {showDatePicker && (
            <DateTimePicker
              value={orderForm.pickupDate || new Date()}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={onDateChange}
            />
          )}
          {showTimePicker && (
            <DateTimePicker
              value={(() => {
                const p = (orderForm.pickupTime || "00:00").split(":");
                const d = new Date();
                d.setHours(parseInt(p[0]) || 0, parseInt(p[1]) || 0, 0, 0);
                return d;
              })()}
              mode="time"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={onTimeChange}
            />
          )}
        </ScrollView>

        {/* Footer action */}
        <View style={wp.footer}>
          <TouchableOpacity
            style={[wp.payBtn, (processing || transactionLoading) && wp.payBtnDisabled]}
            onPress={handleCreateTransaction}
            disabled={processing || transactionLoading}
            activeOpacity={0.85}>
            {processing || transactionLoading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={16} color="white" />
                <Text style={wp.payBtnText}>Selesaikan Transaksi</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderWidePanelReceipt = () => {
    if (!orderResult) return null;
    return (
      <View style={wp.container}>
        {/* Header */}
        <View style={wp.header}>
          <View style={wp.headerIcon}>
            <Ionicons name="checkmark-circle" size={14} color="#10B981" />
          </View>
          <Text style={wp.headerTitle}>Selesai</Text>
          <View style={wp.steps}>
            {[1, 2, 3].map(i => (
              <View key={i} style={[wp.stepDot, wp.stepDotDone]}>
                <Ionicons name="checkmark" size={8} color="white" />
              </View>
            ))}
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={wp.payScroll}>
          {/* Success card */}
          <View style={wp.receiptSuccess}>
            <View style={wp.receiptSuccessIcon}>
              <Ionicons name="checkmark-circle" size={28} color="#10B981" />
            </View>
            <Text style={wp.receiptSuccessTitle}>Transaksi Berhasil!</Text>
            <Text style={wp.receiptSuccessNumber}>#{orderResult.orderNumber}</Text>
          </View>

          {/* Summary */}
          <View style={wp.receiptCard}>
            {[
              { label: "Pelanggan", value: orderResult.customerName || "—" },
              { label: "Total", value: `Rp ${orderResult.totalPrice?.toLocaleString("id-ID")}`, bold: true },
              { label: "Dibayar", value: `Rp ${orderResult.paidAmount?.toLocaleString("id-ID")}` },
              ...(orderResult.changeAmount > 0 ? [{ label: "Kembalian", value: `Rp ${orderResult.changeAmount?.toLocaleString("id-ID")}`, color: "#10B981" }] : []),
              ...(orderResult.shortageAmount > 0 ? [{ label: "Kekurangan", value: `Rp ${orderResult.shortageAmount?.toLocaleString("id-ID")}`, color: "#F59E0B" }] : []),
              { label: "Metode", value: orderResult.paymentMethod === "cash" ? "Tunai" : "Transfer" },
            ].map((row: any, i) => (
              <View key={i} style={[wp.receiptRow, i > 0 && { borderTopWidth: 1, borderTopColor: "#F3F4F6" }]}>
                <Text style={wp.receiptRowLabel}>{row.label}</Text>
                <Text style={[wp.receiptRowValue, row.bold && { fontWeight: "700", color: "#EA580C" }, row.color && { color: row.color }]}>
                  {row.value}
                </Text>
              </View>
            ))}
          </View>

          {/* Share buttons */}
          <View style={wp.receiptBtns}>
            <TouchableOpacity style={wp.receiptShareBtn} onPress={handlePrintReceipt}>
              <Ionicons name="share-social" size={15} color="#EA580C" />
              <Text style={wp.receiptShareBtnText}>Bagikan</Text>
            </TouchableOpacity>
            <TouchableOpacity style={wp.receiptShareBtn} onPress={handleShareWhatsApp}>
              <Ionicons name="logo-whatsapp" size={15} color="#25D366" />
              <Text style={wp.receiptShareBtnText}>WhatsApp</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        <View style={wp.footer}>
          <TouchableOpacity
            style={[wp.payBtn, { backgroundColor: "#10B981" }]}
            onPress={handleClosePanel}
            activeOpacity={0.85}>
            <Ionicons name="add-circle" size={16} color="white" />
            <Text style={wp.payBtnText}>Transaksi Baru</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Render wide panel: items / payment / receipt — modals di dalam agar component return View tunggal
  const renderTabletTransactionPanel = () => {
    return (
      <View style={styles.transactionPanel}>
        {currentStep === "items" && renderWidePanelItems()}
        {currentStep === "payment" && renderWidePanelPayment()}
        {currentStep === "receipt" && renderWidePanelReceipt()}
        {renderDetailModal()}
        {renderImageModal()}
      </View>
    );
  };

  // Render Detail Modal
  const renderDetailModal = () => (
    <Modal
      visible={showDetailModal}
      animationType="slide"
      transparent={true}
      statusBarTranslucent
      onRequestClose={() => setShowDetailModal(false)}>
      <View style={styles.fullScreenBackdrop}>
        <View style={styles.fullScreenModalContainer}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => setShowDetailModal(false)}
                style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Detail Item</Text>
              <View style={{ width: 40 }} />
            </View>

            {selectedItemForDetail && (
              <ScrollView
                style={styles.modalContent}
                showsVerticalScrollIndicator={false}>
                <View style={styles.stepContainer}>
                  <Text
                    style={[
                      styles.orderSummaryTitle,
                      { fontSize: 20, marginBottom: 16 },
                    ]}>
                    {selectedItemForDetail.name}
                  </Text>

                  <View style={styles.orderSummaryCard}>
                    <View style={styles.orderSummaryRow}>
                      <Text style={styles.orderSummaryLabel}>Tipe:</Text>
                      <Text style={styles.orderSummaryValue}>
                        {selectedItemForDetail.type === "kue_custom"
                          ? "Kue Custom"
                          : selectedItemForDetail.type === "kue_ready"
                          ? "Kue Ready"
                          : "Produk Lainnya"}
                      </Text>
                    </View>
                    <View style={styles.orderSummaryRow}>
                      <Text style={styles.orderSummaryLabel}>Jumlah:</Text>
                      <Text style={styles.orderSummaryValue}>
                        {selectedItemForDetail.quantity}
                      </Text>
                    </View>
                    <View style={styles.orderSummaryRow}>
                      <Text style={styles.orderSummaryLabel}>
                        Harga Satuan:
                      </Text>
                      <Text style={styles.orderSummaryValue}>
                        Rp{" "}
                        {selectedItemForDetail.unitPrice.toLocaleString(
                          "id-ID"
                        )}
                      </Text>
                    </View>
                    <View style={styles.orderSummaryRow}>
                      <Text style={styles.orderSummaryLabel}>Subtotal:</Text>
                      <Text style={styles.orderSummaryValueBold}>
                        Rp{" "}
                        {selectedItemForDetail.subtotal.toLocaleString("id-ID")}
                      </Text>
                    </View>
                  </View>

                  {selectedItemForDetail.customDetails && (
                    <View style={[styles.orderSummaryCard, { marginTop: 16 }]}>
                      <Text style={styles.orderSummaryTitle}>
                        Detail Kue Custom
                      </Text>
                      <View style={styles.orderSummaryRow}>
                        <Text style={styles.orderSummaryLabel}>Jenis:</Text>
                        <Text style={styles.orderSummaryValue}>
                          {selectedItemForDetail.customDetails.cakeType}
                        </Text>
                      </View>
                      <View style={styles.orderSummaryRow}>
                        <Text style={styles.orderSummaryLabel}>Variasi:</Text>
                        <Text style={styles.orderSummaryValue}>
                          {selectedItemForDetail.customDetails.variation}
                        </Text>
                      </View>
                      <View style={styles.orderSummaryRow}>
                        <Text style={styles.orderSummaryLabel}>Ukuran:</Text>
                        <Text style={styles.orderSummaryValue}>
                          {selectedItemForDetail.customDetails.size}
                        </Text>
                      </View>
                      <View style={styles.orderSummaryRow}>
                        <Text style={styles.orderSummaryLabel}>Kotak:</Text>
                        <Text style={styles.orderSummaryValue}>
                          {selectedItemForDetail.customDetails.box}
                        </Text>
                      </View>
                    </View>
                  )}

                  {selectedItemForDetail.customDetails?.images &&
                    selectedItemForDetail.customDetails.images.length > 0 && (
                      <View
                        style={[styles.orderSummaryCard, { marginTop: 16 }]}>
                        <Text style={styles.orderSummaryTitle}>
                          Gambar Referensi
                        </Text>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          style={{ marginTop: 12 }}>
                          {selectedItemForDetail.customDetails.images.map(
                            (img, index) => (
                              <TouchableOpacity
                                key={index}
                                onPress={() =>
                                  handleOpenImageModal(
                                    selectedItemForDetail.customDetails!.images!
                                  )
                                }
                                style={{ marginRight: 12 }}>
                                <Image
                                  source={{
                                    uri: img.startsWith("file://")
                                      ? img
                                      : `file://${img}`,
                                  }}
                                  style={{
                                    width: 100,
                                    height: 100,
                                    borderRadius: 8,
                                  }}
                                  resizeMode="cover"
                                />
                              </TouchableOpacity>
                            )
                          )}
                        </ScrollView>
                      </View>
                    )}
                </View>
              </ScrollView>
            )}
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );

  // Render Image Modal
  const renderImageModal = () => (
    <Modal
      visible={showImageModal}
      animationType="fade"
      transparent={true}
      statusBarTranslucent
      onRequestClose={() => setShowImageModal(false)}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.9)",
          justifyContent: "center",
          alignItems: "center",
        }}>
        <TouchableOpacity
          style={{ position: "absolute", top: 50, right: 20, zIndex: 10 }}
          onPress={() => setShowImageModal(false)}>
          <Ionicons name="close-circle" size={36} color="white" />
        </TouchableOpacity>

        {selectedImages.length > 0 && (
          <Image
            source={{
              uri: selectedImages[currentImageIndex]?.startsWith("file://")
                ? selectedImages[currentImageIndex]
                : `file://${selectedImages[currentImageIndex]}`,
            }}
            style={{
              width: windowWidth - 40,
              height: windowWidth - 40,
              borderRadius: 8,
            }}
            resizeMode="contain"
          />
        )}

        {selectedImages.length > 1 && (
          <View
            style={{
              flexDirection: "row",
              position: "absolute",
              bottom: 80,
              gap: 40,
            }}>
            <TouchableOpacity onPress={prevImage} style={{ padding: 10 }}>
              <Ionicons name="chevron-back-circle" size={44} color="white" />
            </TouchableOpacity>
            <Text style={{ color: "white", fontSize: 16, alignSelf: "center" }}>
              {currentImageIndex + 1} / {selectedImages.length}
            </Text>
            <TouchableOpacity onPress={nextImage} style={{ padding: 10 }}>
              <Ionicons name="chevron-forward-circle" size={44} color="white" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );

  if (processing || transactionLoading || orderLoading) {
    return (
      <View style={styles.loadingOverlay}>
        <View style={styles.loadingOverlayContent}>
          <ActivityIndicator size="large" color="#EA580C" />
          <Text style={styles.loadingOverlayText}>
            {orderLoading ? "Menyimpan pesanan..." : "Memproses transaksi..."}
          </Text>
        </View>
      </View>
    );
  }

  if (isTablet) {
    return renderTabletTransactionPanel();
  }

  return (
    <>
      {renderMobileTransactionSummary()}
      {renderDetailModal()}
      {renderImageModal()}
    </>
  );
}

const styles = StyleSheet.create({
  transferProofUploadButton: {
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
  },
  transferProofUploadText: {
    fontSize: 14,
    color: "#6B7280",
    marginLeft: 8,
  },
  transferProofPreview: {
    position: "relative",
    borderRadius: 8,
    overflow: "hidden",
  },
  transferProofImage: {
    width: "100%",
    height: 200,
    backgroundColor: "#F3F4F6",
  },
  removeTransferProofButton: {
    position: "absolute",
    bottom: 12,
    right: 12,
    backgroundColor: "#EF4444",
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    gap: 4,
  },
  removeTransferProofText: {
    color: "white",
    fontSize: 12,
    fontWeight: "500",
  },
  pickupInfoCard: {
    flexDirection: "row",
    backgroundColor: "#FFF7ED",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#FED7AA",
    gap: 12,
  },
  pickupInfoText: {
    flex: 1,
  },
  pickupInfoTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#9A3412",
    marginBottom: 4,
  },
  pickupInfoDetail: {
    fontSize: 14,
    color: "#7C2D12",
  },
  transactionPanel: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    borderLeftWidth: 1,
    borderLeftColor: "#E5E7EB",
  },
  transactionDateSection: {
    backgroundColor: "#FFF7ED",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#FED7AA",
  },
  dateTimeDisplay: {
    gap: 8,
  },
  pickupDateHelper: {
    fontSize: 11,
    color: "#6B7280",
    fontStyle: "italic",
    marginTop: 6,
    marginLeft: 4,
  },
  dateTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dateTimeText: {
    fontSize: 14,
    color: "#9A3412",
    fontWeight: "500",
  },
  floatingTransactionButton: {
    position: "absolute",
    left: "50%",
    transform: [{ translateX: -120 }],
    width: 240,
    backgroundColor: "#EA580C",
    borderRadius: 30,
    paddingHorizontal: 20,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 12,
    zIndex: 1100,
  },
  floatingButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  floatingItemCount: {
    width: 24,
    height: 24,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  floatingItemCountText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "white",
  },
  floatingTransactionInfo: {
    flex: 1,
    alignItems: "center",
    marginHorizontal: 12,
  },
  floatingTransactionLabel: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.8)",
    marginBottom: 2,
  },
  floatingTransactionTotal: {
    fontSize: 16,
    fontWeight: "bold",
    color: "white",
  },
  expandableTransactionPanel: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 16,
    zIndex: 1100,
  },
  transactionPanelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  transactionPanelTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  closePanelButton: {
    padding: 4,
  },
  transactionPanelContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
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
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    paddingHorizontal: 12,
    flex: 1,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: "#111827",
  },
  notesInput: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    backgroundColor: "#F9FAFB",
    textAlignVertical: "top",
    fontSize: 14,
    color: "#111827",
  },
  additionalCostsSection: {
    marginBottom: 16,
  },
  sectionHeaderContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 12,
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
  emptyAdditionalText: {
    fontSize: 12,
    color: "#9CA3AF",
    textAlign: "center",
    fontStyle: "italic",
    paddingVertical: 12,
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
  },
  additionalCostItemCompact: {
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  additionalCostHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  additionalCostNameInput: {
    flex: 1,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: "#111827",
  },
  additionalCostDetails: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
  },
  additionalCostInput: {
    flex: 1,
  },
  additionalCostInputLabel: {
    fontSize: 11,
    color: "#6B7280",
    marginBottom: 4,
    fontWeight: "500",
  },
  additionalCostInputField: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 13,
    color: "#111827",
    textAlign: "center",
  },
  additionalCostMultiplier: {
    fontSize: 16,
    color: "#6B7280",
    fontWeight: "600",
    marginBottom: 6,
  },
  additionalCostEquals: {
    fontSize: 16,
    color: "#6B7280",
    fontWeight: "600",
    marginBottom: 6,
  },
  additionalCostSubtotal: {
    flex: 1.5,
  },
  additionalCostSubtotalLabel: {
    fontSize: 11,
    color: "#6B7280",
    marginBottom: 4,
    fontWeight: "500",
  },
  additionalCostSubtotalValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "#10B981",
    textAlign: "right",
  },
  additionalCostsTotalContainerCompact: {
    backgroundColor: "#EFF6FF",
    borderRadius: 8,
    padding: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  additionalCostsTotalLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: "#1E40AF",
  },
  additionalCostsTotalValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E40AF",
  },
  itemsSection: {
    marginBottom: 16,
  },
  emptyItemsContainer: {
    alignItems: "center",
    paddingVertical: 32,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderStyle: "dashed",
  },
  emptyItemsText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#6B7280",
    marginTop: 12,
  },
  emptyItemsSubtext: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 4,
    textAlign: "center",
  },
  customBadge: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  customBadgeText: {
    fontSize: 10,
    color: "#92400E",
    fontWeight: "600",
  },
  transactionItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  itemDetailButton: {
    padding: 8,
    marginRight: 8,
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
  itemPrice: {
    fontSize: 12,
    color: "#EA580C",
    fontWeight: "500",
  },
  itemActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  quantityContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  quantityButton: {
    padding: 8,
  },
  quantityText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    minWidth: 24,
    textAlign: "center",
  },
  removeButton: {
    padding: 8,
  },
  totalSection: {
    backgroundColor: "#FFF7ED",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#FED7AA",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  totalItemsLabel: {
    fontSize: 14,
    color: "#9A3412",
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#9A3412",
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#EA580C",
  },
  panelActionButtons: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    gap: 8,
  },
  processButton: {
    flex: 1,
    backgroundColor: "#EA580C",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  processButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  dateButtonFlex: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 8,
  },
  timeButtonFixed: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
    minWidth: 100,
  },
  dateTimeButtonTextCompact: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "500",
  },
  stepIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  stepIndicatorContainer: {
    alignItems: "center",
  },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  stepDotActive: {
    backgroundColor: "#EA580C",
  },
  stepDotCompleted: {
    backgroundColor: "#10B981",
  },
  stepDotText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  stepLine: {
    width: 60,
    height: 2,
    backgroundColor: "#E5E7EB",
    marginHorizontal: 8,
    marginBottom: 24,
  },
  stepLabel: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },
  orderSummaryCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  orderSummaryTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 12,
  },
  orderSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  orderSummaryLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  orderSummaryValue: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "500",
  },
  orderSummaryValueBold: {
    fontSize: 16,
    color: "#EA580C",
    fontWeight: "700",
  },
  paymentMethodContainer: {
    flexDirection: "row",
    gap: 12,
  },
  paymentMethodButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  paymentMethodButtonActive: {
    backgroundColor: "#EA580C",
    borderColor: "#EA580C",
  },
  paymentMethodText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  paymentMethodTextActive: {
    color: "white",
  },
  paymentStatusContainer: {
    marginTop: 16,
  },
  paymentTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  paymentTotalLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  paymentTotalValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  paymentWarningCard: {
    backgroundColor: "#FFFBEB",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  paymentWarningHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  paymentWarningTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#B45309",
  },
  paymentWarningText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#D97706",
    marginBottom: 8,
  },
  paymentWarningNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  paymentWarningNoteText: {
    fontSize: 12,
    color: "#B45309",
    flex: 1,
  },
  paymentSuccessCard: {
    backgroundColor: "#ECFDF5",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  paymentSuccessHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  paymentSuccessTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#047857",
  },
  paymentSuccessText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#059669",
  },
  paymentExactCard: {
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  paymentExactHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  paymentExactTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1D4ED8",
  },
  receiptSuccessContainer: {
    alignItems: "center",
    paddingVertical: 24,
  },
  receiptSuccessIcon: {
    marginBottom: 16,
  },
  receiptSuccessTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#10B981",
    marginBottom: 8,
  },
  receiptOrderNumber: {
    fontSize: 18,
    fontWeight: "600",
    color: "#6B7280",
  },
  receiptActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  receiptActionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  receiptActionButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
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
  closeButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  stepContainer: {
    paddingBottom: 24,
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
    minWidth: 150,
  },
  loadingOverlayText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
});

// ─────────────────────────────────────────────────────────────────
// WIDE PANEL STYLES — compact & professional untuk landscape
// ─────────────────────────────────────────────────────────────────
const wp = StyleSheet.create({
  container:        { flex: 1, backgroundColor: "white" },

  // Header
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: "#F3F4F6",
    backgroundColor: "white", gap: 8,
  },
  headerLeft:       { flexDirection: "row", alignItems: "center", flex: 1, gap: 6 },
  headerIcon: {
    width: 26, height: 26, borderRadius: 7,
    backgroundColor: "#FEF3C7", alignItems: "center", justifyContent: "center",
  },
  headerTitle:      { fontSize: 14, fontWeight: "700", color: "#111827" },
  headerBadge: {
    minWidth: 18, height: 18, borderRadius: 9, backgroundColor: "#EA580C",
    alignItems: "center", justifyContent: "center", paddingHorizontal: 4,
  },
  headerBadgeText:  { fontSize: 10, fontWeight: "700", color: "white" },

  backBtn: {
    width: 28, height: 28, borderRadius: 8, backgroundColor: "#F3F4F6",
    alignItems: "center", justifyContent: "center",
  },

  // Step dots
  steps:            { flexDirection: "row", gap: 4, alignItems: "center" },
  stepDot:          { width: 7, height: 7, borderRadius: 4 },
  stepDotActive:    { backgroundColor: "#EA580C", width: 18, borderRadius: 4 },
  stepDotInactive:  { backgroundColor: "#E5E7EB" },
  stepDotDone:      {
    backgroundColor: "#10B981", width: 13, height: 13, borderRadius: 7,
    alignItems: "center", justifyContent: "center",
  },

  // Customer input
  customerRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: "#F3F4F6",
    backgroundColor: "#FAFAFA",
  },
  customerInput: {
    flex: 1, fontSize: 13, color: "#111827", paddingVertical: 4,
  },

  // Empty
  emptyState: {
    flex: 1, alignItems: "center", justifyContent: "center", padding: 20, gap: 6,
  },
  emptyTitle:       { fontSize: 13, fontWeight: "600", color: "#9CA3AF" },
  emptySubtext:     { fontSize: 11, color: "#D1D5DB", textAlign: "center" },

  // Items list
  itemsList:        { flex: 1 },
  itemRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 12, paddingVertical: 8, gap: 6,
  },
  itemRowBorder:    { borderBottomWidth: 1, borderBottomColor: "#F9FAFB" },
  typeBadge: {
    width: 22, height: 22, borderRadius: 6,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  itemInfo:         { flex: 1, minWidth: 0 },
  itemName:         { fontSize: 12, fontWeight: "600", color: "#111827", marginBottom: 1 },
  itemUnit:         { fontSize: 10, color: "#9CA3AF" },
  qtyRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#F9FAFB", borderRadius: 6, borderWidth: 1, borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  qtyBtn: {
    width: 22, height: 22, alignItems: "center", justifyContent: "center",
  },
  qtyText:          { fontSize: 12, fontWeight: "600", color: "#111827", minWidth: 18, textAlign: "center" },
  itemRight:        { alignItems: "flex-end", gap: 2, flexShrink: 0 },
  itemSubtotal:     { fontSize: 12, fontWeight: "700", color: "#111827" },
  deleteBtn:        { padding: 2 },

  // Footer
  footer: {
    paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: "#F3F4F6", backgroundColor: "white", gap: 8,
  },
  totalRow:         { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel:       { fontSize: 11, color: "#9CA3AF", fontWeight: "500" },
  totalValue:       { fontSize: 15, fontWeight: "700", color: "#111827" },
  payBtn: {
    backgroundColor: "#EA580C", borderRadius: 10,
    paddingVertical: 11, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 6,
    shadowColor: "#EA580C", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 4, elevation: 3,
  },
  payBtnDisabled:   { backgroundColor: "#FED7AA", shadowOpacity: 0 },
  payBtnText:       { fontSize: 13, fontWeight: "700", color: "white" },

  // Payment step
  payScroll:        { padding: 12, gap: 12 },
  totalCard: {
    backgroundColor: "#FFF7ED", borderRadius: 10,
    padding: 14, alignItems: "center",
    borderWidth: 1, borderColor: "#FED7AA",
  },
  totalCardLabel:   { fontSize: 11, color: "#9A3412", fontWeight: "500", marginBottom: 4 },
  totalCardAmount:  { fontSize: 22, fontWeight: "800", color: "#EA580C" },
  totalCardSub:     { fontSize: 11, color: "#B45309", marginTop: 3 },

  sectionLabel:     { fontSize: 11, fontWeight: "600", color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.3 },

  methodRow:        { flexDirection: "row", gap: 8 },
  methodBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 9, borderRadius: 8,
    borderWidth: 1, borderColor: "#E5E7EB", backgroundColor: "#F9FAFB",
  },
  methodBtnActive:  { backgroundColor: "#EA580C", borderColor: "#EA580C" },
  methodLabel:      { fontSize: 12, fontWeight: "600", color: "#374151" },
  methodLabelActive:{ color: "white" },

  amountInputRow: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 8,
    backgroundColor: "#F9FAFB", paddingHorizontal: 10,
  },
  amountPrefix:     { fontSize: 13, color: "#6B7280", marginRight: 4 },
  amountInput:      { flex: 1, fontSize: 16, fontWeight: "700", color: "#111827", paddingVertical: 10 },

  quickRow:         { marginTop: 4 },
  quickBtn: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 6,
    backgroundColor: "#F3F4F6", borderWidth: 1, borderColor: "#E5E7EB",
  },
  quickBtnActive:   { backgroundColor: "#FEF3C7", borderColor: "#F59E0B" },
  quickBtnText:     { fontSize: 12, fontWeight: "600", color: "#374151" },
  quickBtnTextActive:{ color: "#92400E" },

  changeRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    padding: 10, borderRadius: 8,
  },
  changeLabel:      { flex: 1, fontSize: 12, fontWeight: "600" },
  changeValue:      { fontSize: 13, fontWeight: "700" },

  pickupRow:        { flexDirection: "row", gap: 8 },
  pickupBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 5,
    paddingVertical: 9, paddingHorizontal: 10,
    borderRadius: 8, borderWidth: 1, borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
  },
  pickupBtnText:    { fontSize: 12, color: "#374151", flex: 1 },

  // Receipt
  receiptSuccess: {
    alignItems: "center", padding: 16, gap: 4,
    backgroundColor: "#F0FDF4", borderRadius: 10,
    borderWidth: 1, borderColor: "#BBF7D0",
  },
  receiptSuccessIcon: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: "#DCFCE7",
    alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  receiptSuccessTitle:{ fontSize: 14, fontWeight: "700", color: "#15803D" },
  receiptSuccessNumber:{ fontSize: 11, color: "#16A34A", fontWeight: "500" },

  receiptCard: {
    backgroundColor: "white", borderRadius: 10,
    borderWidth: 1, borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  receiptRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 12, paddingVertical: 9,
  },
  receiptRowLabel:  { fontSize: 11, color: "#6B7280" },
  receiptRowValue:  { fontSize: 12, color: "#111827", fontWeight: "500" },

  receiptBtns:      { flexDirection: "row", gap: 8 },
  receiptShareBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 5, paddingVertical: 10, borderRadius: 8,
    borderWidth: 1, borderColor: "#E5E7EB", backgroundColor: "#F9FAFB",
  },
  receiptShareBtnText:{ fontSize: 12, fontWeight: "600", color: "#374151" },
});
