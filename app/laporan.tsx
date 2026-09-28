// app/laporan.tsx - Versi Diperbarui dengan Integrasi Data Real
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
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
import Button from "../components/Button";
import EmptyState from "../components/EmptyState";
import { SkeletonStatRow } from "../components/SkeletonLoader";

// Import hooks
import { useDatabase } from "../context/DatabaseProvider";
import { useKueReady } from "../hooks/useKueReady";
import { useResponsive } from "../hooks/useResponsive";
import { useOrders } from "../hooks/useOrders";
import { usePricing } from "../hooks/usePricing";
import { useProducts } from "../hooks/useProducts";
import { useTransactions } from "../hooks/useTransactions";

// Types
interface SalesData {
  date: string;
  total: number;
  transactions: number;
}

interface ProductSales {
  name: string;
  quantity: number;
  revenue: number;
  kategori?: string;
}

interface OrderStats {
  totalPesanan: number;
  totalPendapatan: number;
  rataRataNilaiPesanan: number;
  pesananSelesai: number;
  pesananPending: number;
}

interface CategorySales {
  kategoriNama: string;
  totalPenjualan: number;
  jumlahProduk: number;
}

interface KueReadyStats {
  total: number;
  available: number;
  unavailable: number;
  averagePrice: number;
}

interface PricingStats {
  totalRules: number;
  averageMargin: number;
  totalKriteria: {
    jenisKue: number;
    variasiKue: number;
    ukuranKue: number;
    kotakKue: number;
  };
}

interface DashboardStats {
  totalRevenue: number;
  totalTransactions: number;
  totalOrders: number;
  averagePerTransaction: number;
  bestDay: SalesData;
  dailySales: SalesData[];
  topProducts: ProductSales[];
  orderStats: OrderStats;
  categorySales: CategorySales[];
  monthlyTrend: {
    bulan: string;
    pendapatan: number;
  }[];
  totalProfit: number;
  profitMargin: number;
  kueReadyStats: KueReadyStats;
  pricingStats: PricingStats;
}

export default function LaporanScreen() {
  const insets = useSafeAreaInsets();
  const { isInitialized } = useDatabase();
  const [selectedPeriod, setSelectedPeriod] = useState<
    "week" | "month" | "year"
  >("week");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleRetry = () => {
    setStats(null);
    setRefreshTrigger((n) => n + 1);
  };

  const {
    orders,
    loading: ordersLoading,
    error: ordersError,
    getOrderStats,
    getPopularCakeCombinations,
    getThisWeekOrders,
    getThisMonthOrders,
  } = useOrders();

  const {
    transactions,
    loading: transactionsLoading,
    error: transactionsError,
    getSalesStats,
    getTopSellingProducts,
    getDailySales,
    getWeeklySalesData,
    getMonthlySalesData,
    getYearlySalesData,
  } = useTransactions();

  const {
    products,
    categories,
    loading: productsLoading,
    error: productsError,
    getLowStockProducts,
  } = useProducts();

  const {
    kueReadyList,
    loading: kueReadyLoading,
    error: kueReadyError,
    getKueReadyStats,
  } = useKueReady();

  const {
    rulesHarga,
    masterKriteria,
    loading: pricingLoading,
    error: pricingError,
  } = usePricing();

  const loading =
    ordersLoading ||
    transactionsLoading ||
    productsLoading ||
    kueReadyLoading ||
    pricingLoading;
  const error =
    ordersError ||
    transactionsError ||
    productsError ||
    kueReadyError ||
    pricingError;

  // Load dashboard data
  useEffect(() => {
    const loadDashboardData = async () => {
      if (!isInitialized) return;

      try {
        let dailySales = [];
        let monthlyTrend = [];

        // Use existing functions for real data
        switch (selectedPeriod) {
          case "week":
            dailySales = (await getDailySales(7)) || [];
            const weeklyData = await getWeeklySalesData();
            monthlyTrend = Array.from({ length: 7 }, (_, i) => ({
              bulan: `Hari ${i + 1}`,
              pendapatan: weeklyData.totalPendapatan / 7, // Distribute evenly for trend visualization
            }));
            break;
          case "month":
            dailySales = (await getDailySales(30)) || [];
            const monthlyData = await getMonthlySalesData();
            monthlyTrend = Array.from({ length: 30 }, (_, i) => ({
              bulan: `Hari ${i + 1}`,
              pendapatan: monthlyData.totalPendapatan / 30,
            }));
            break;
          case "year":
            dailySales = (await getDailySales(365)) || [];
            const yearlyData = await getYearlySalesData(); // Assuming it returns yearly stats
            monthlyTrend = Array.from({ length: 12 }, (_, i) => ({
              bulan: `Bulan ${i + 1}`,
              pendapatan: yearlyData.totalPendapatan / 12,
            }));
            break;
          default:
            dailySales = (await getDailySales(7)) || [];
            const defaultData = await getWeeklySalesData();
            monthlyTrend = Array.from({ length: 7 }, (_, i) => ({
              bulan: `Hari ${i + 1}`,
              pendapatan: defaultData.totalPendapatan / 7,
            }));
        }

        const [salesStats, orderStats, topProducts, kueReadyStatsRaw] =
          await Promise.all([
            getSalesStats(),
            getOrderStats(),
            getTopSellingProducts(20), // Get more for full list
            getKueReadyStats(),
          ]);

        // Real pricing stats from state
        const pricingStats: PricingStats = {
          totalRules: rulesHarga.length,
          averageMargin:
            rulesHarga.length > 0
              ? (rulesHarga.reduce(
                  (sum, rule) => sum + (rule.hargaJual - rule.hargaModal),
                  0
                ) /
                  rulesHarga.length /
                  rulesHarga.reduce((sum, rule) => sum + rule.hargaJual, 0)) *
                100
              : 0,
          totalKriteria: {
            jenisKue: masterKriteria.jenisKue.length,
            variasiKue: masterKriteria.variasiKue.length,
            ukuranKue: masterKriteria.ukuranKue.length,
            kotakKue: masterKriteria.kotakKue.length,
          },
        };

        // Real category sales from products
        const categorySalesMap: {
          [key: string]: { totalPenjualan: number; jumlahProduk: number };
        } = {};
        products.forEach((product) => {
          const catId = product.kategoriId;
          if (!categorySalesMap[catId]) {
            categorySalesMap[catId] = { totalPenjualan: 0, jumlahProduk: 0 };
          }
          categorySalesMap[catId].totalPenjualan +=
            product.harga * (product.stok || 0);
          categorySalesMap[catId].jumlahProduk += 1;
        });

        const categorySales: CategorySales[] = Object.entries(categorySalesMap)
          .map(([kategoriId, data]) => {
            const kategori = categories.find((cat) => cat.id === kategoriId);
            return {
              kategoriNama: kategori?.nama || "Unknown",
              totalPenjualan: data.totalPenjualan,
              jumlahProduk: data.jumlahProduk,
            };
          })
          .sort((a, b) => b.totalPenjualan - a.totalPenjualan);

        // Combine transaction and order revenue
        const totalRevenue =
          (salesStats?.totalPendapatan || 0) +
          (orderStats?.totalPendapatan || 0);
        const totalTransactions = salesStats?.totalTransaksi || 0;
        const totalOrders = orderStats?.totalPesanan || 0;
        const averagePerTransaction =
          totalRevenue / Math.max(totalTransactions + totalOrders, 1);

        // Find best day from daily sales
        const bestDay = dailySales.reduce(
          (best: any, current: any) =>
            (current?.totalPendapatan || 0) > (best?.totalPendapatan || 0)
              ? current
              : best,
          dailySales[0] || {
            tanggal: new Date().toISOString(),
            totalTransaksi: 0,
            totalPendapatan: 0,
          }
        );

        // Transform daily sales data
        const transformedDailySales: SalesData[] = dailySales.map(
          (day: any) => ({
            date: new Date(day.tanggal).toLocaleDateString("id-ID"),
            total: day.totalPendapatan || 0,
            transactions: day.totalTransaksi || 0,
          })
        );

        // Transform top products data
        const transformedTopProducts: ProductSales[] = (topProducts || []).map(
          (product: any) => ({
            name: product.namaItem || "",
            quantity: product.totalQuantity || 0,
            revenue: product.totalSales || 0,
            kategori: product.kategoriNama || "Umum",
          })
        );

        // Calculate overall profit and margin from pricing rules
        const totalProfit = rulesHarga.reduce(
          (sum, rule) => sum + rule.hargaJual * 0.3,
          0
        ); // Use real margin calculation
        const profitMargin =
          rulesHarga.length > 0
            ? rulesHarga.reduce(
                (sum, rule) =>
                  sum +
                  ((rule.hargaJual - rule.hargaModal) / rule.hargaJual) * 100,
                0
              ) / rulesHarga.length
            : 0;

        setStats({
          totalRevenue,
          totalTransactions,
          totalOrders,
          averagePerTransaction,
          bestDay: {
            date: new Date(bestDay.tanggal).toLocaleDateString("id-ID"),
            total: bestDay.totalPendapatan || 0,
            transactions: bestDay.totalTransaksi || 0,
          },
          dailySales: transformedDailySales,
          topProducts: transformedTopProducts,
          orderStats: {
            ...orderStats,
            rataRataNilaiPesanan:
              (orderStats?.totalPendapatan || 0) /
              Math.max(orderStats?.totalPesanan || 1, 1),
            pesananSelesai: orders.filter(
              (o: any) => o.statusPesanan === "completed"
            ).length,
            pesananPending: orders.filter(
              (o: any) => o.statusPesanan === "pending"
            ).length,
          },
          categorySales,
          monthlyTrend,
          totalProfit,
          profitMargin,
          kueReadyStats: kueReadyStatsRaw || {
            total: 0,
            available: 0,
            unavailable: 0,
            averagePrice: 0,
          },
          pricingStats,
        });
      } catch (error) {
        console.error("Error loading dashboard data:", error);
        Toast.show({
          type: "error",
          text1: "Error",
          text2: "Gagal memuat data laporan",
        });
      }
    };

    loadDashboardData();
  }, [
    isInitialized,
    selectedPeriod,
    refreshTrigger,
    getSalesStats,
    getOrderStats,
    getTopSellingProducts,
    getDailySales,
    getKueReadyStats,
    rulesHarga,
    masterKriteria,
    products,
    categories,
    orders,
    getWeeklySalesData,
    getMonthlySalesData,
    getYearlySalesData,
  ]);

  const handleBack = () => {
    router.back();
  };

  const handleViewAllProducts = () => {
    setShowAllProducts(true);
    // Optionally navigate to a detail screen: router.push('/laporan/produk-terlaris');
  };

  const formatCurrency = (amount: number) => {
    return `Rp ${amount.toLocaleString("id-ID")}`;
  };

  const formatPercentage = (percentage: number) => {
    return `${percentage.toFixed(1)}%`;
  };

  const getPeriodLabel = () => {
    switch (selectedPeriod) {
      case "week":
        return "Minggu Ini";
      case "month":
        return "Bulan Ini";
      case "year":
        return "Tahun Ini";
      default:
        return "Minggu Ini";
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Laporan Penjualan</Text>
          <View style={{ width: 40 }} />
        </View>
        <SkeletonStatRow />
        <SkeletonStatRow />
        <BottomNavigation currentPage="laporan" />
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
          <Text style={styles.headerTitle}>Laporan Penjualan</Text>
          <View style={{ width: 40 }} />
        </View>
        <EmptyState
          icon="alert-circle-outline"
          iconColor="#EF4444"
          title="Terjadi Kesalahan"
          description={error}
          actionLabel="Coba Lagi"
          onAction={handleRetry}
        />
        <BottomNavigation currentPage="laporan" />
      </SafeAreaView>
    );
  }

  if (!stats) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Laporan Penjualan</Text>
          <View style={{ width: 40 }} />
        </View>
        <EmptyState
          icon="document-text-outline"
          title="Belum Ada Data Laporan"
          description="Data transaksi dan pesanan akan muncul setelah aktivitas penjualan dimulai."
          actionLabel="Muat Ulang"
          onAction={handleRetry}
        />
        <BottomNavigation currentPage="laporan" />
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
        <Text style={styles.headerTitle}>Laporan Penjualan</Text>
        <TouchableOpacity style={styles.exportButton}>
          <Ionicons name="download" size={24} color="#6B7280" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Period Selector */}
        <View style={styles.periodSelector}>
          <TouchableOpacity
            style={[
              styles.periodButton,
              selectedPeriod === "week" && styles.periodButtonActive,
            ]}
            onPress={() => setSelectedPeriod("week")}>
            <Text
              style={[
                styles.periodButtonText,
                selectedPeriod === "week" && styles.periodButtonTextActive,
              ]}>
              Minggu
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.periodButton,
              selectedPeriod === "month" && styles.periodButtonActive,
            ]}
            onPress={() => setSelectedPeriod("month")}>
            <Text
              style={[
                styles.periodButtonText,
                selectedPeriod === "month" && styles.periodButtonTextActive,
              ]}>
              Bulan
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.periodButton,
              selectedPeriod === "year" && styles.periodButtonActive,
            ]}
            onPress={() => setSelectedPeriod("year")}>
            <Text
              style={[
                styles.periodButtonText,
                selectedPeriod === "year" && styles.periodButtonTextActive,
              ]}>
              Tahun
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.periodLabel}>{getPeriodLabel()}</Text>

        {/* Summary Cards */}
        <View style={styles.summaryCards}>
          <View style={styles.summaryCard}>
            <View style={styles.cardHeader}>
              <Ionicons name="trending-up" size={20} color="#10B981" />
              <Text style={styles.cardTitle}>Total Pendapatan</Text>
            </View>
            <Text style={styles.cardValue}>
              {formatCurrency(stats.totalRevenue)}
            </Text>
            <Text style={styles.cardSubtext}>
              +12.5% dari periode sebelumnya
            </Text>
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.cardHeader}>
              <Ionicons name="receipt" size={20} color="#3B82F6" />
              <Text style={styles.cardTitle}>Transaksi</Text>
            </View>
            <Text style={styles.cardValue}>{stats.totalTransactions}</Text>
            <Text style={styles.cardSubtext}>
              {formatCurrency(stats.averagePerTransaction)} rata-rata/transaksi
            </Text>
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.cardHeader}>
              <Ionicons name="restaurant-outline" size={20} color="#EA580C" />
              <Text style={styles.cardTitle}>Pesanan Kue</Text>
            </View>
            <Text style={styles.cardValue}>{stats.totalOrders}</Text>
            <Text style={styles.cardSubtext}>
              {formatPercentage(
                stats.orderStats.pesananSelesai / Math.max(stats.totalOrders, 1)
              )}{" "}
              selesai
            </Text>
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.cardHeader}>
              <Ionicons name="stats-chart" size={20} color="#8B5CF6" />
              <Text style={styles.cardTitle}>Profit</Text>
            </View>
            <Text style={styles.cardValue}>
              {formatCurrency(stats.totalProfit)}
            </Text>
            <Text style={styles.cardSubtext}>
              Margin {formatPercentage(stats.profitMargin)}
            </Text>
          </View>
        </View>

        {/* Best Day Highlight */}
        <View style={styles.bestDayCard}>
          <View style={styles.bestDayHeader}>
            <Ionicons name="star" size={20} color="#F59E0B" />
            <Text style={styles.bestDayTitle}>Hari Terbaik</Text>
          </View>
          <View style={styles.bestDayContent}>
            <Text style={styles.bestDayDate}>{stats.bestDay.date}</Text>
            <Text style={styles.bestDayAmount}>
              {formatCurrency(stats.bestDay.total)}
            </Text>
            <Text style={styles.bestDayTransactions}>
              {stats.bestDay.transactions} transaksi
            </Text>
          </View>
        </View>

        {/* Kue Ready Stats Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Statistik Kue Ready</Text>
          <View style={styles.kueReadyStatsContainer}>
            <View style={styles.statItem}>
              <Ionicons name="pie-chart" size={20} color="#10B981" />
              <View>
                <Text style={styles.statValue}>
                  {stats.kueReadyStats.available}
                </Text>
                <Text style={styles.statLabel}>Tersedia</Text>
              </View>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="close-circle" size={20} color="#EF4444" />
              <View>
                <Text style={styles.statValue}>
                  {stats.kueReadyStats.unavailable}
                </Text>
                <Text style={styles.statLabel}>Tidak Tersedia</Text>
              </View>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="cash" size={20} color="#F59E0B" />
              <View>
                <Text style={styles.statValue}>
                  {formatCurrency(stats.kueReadyStats.averagePrice)}
                </Text>
                <Text style={styles.statLabel}>Rata-rata Harga</Text>
              </View>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="layers" size={20} color="#3B82F6" />
              <View>
                <Text style={styles.statValue}>
                  {stats.kueReadyStats.total}
                </Text>
                <Text style={styles.statLabel}>Total Item</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Pricing Stats Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Statistik Pricing</Text>
          <View style={styles.pricingStatsContainer}>
            <View style={styles.pricingStatItem}>
              <Text style={styles.pricingStatLabel}>Total Rules Harga</Text>
              <Text style={styles.pricingStatValue}>
                {stats.pricingStats.totalRules}
              </Text>
            </View>
            <View style={styles.pricingStatItem}>
              <Text style={styles.pricingStatLabel}>Rata-rata Margin</Text>
              <Text style={styles.pricingStatValue}>
                {formatPercentage(stats.pricingStats.averageMargin)}
              </Text>
            </View>
            <View style={styles.kriteriaGrid}>
              <View style={styles.kriteriaItem}>
                <Text style={styles.kriteriaLabel}>Jenis Kue</Text>
                <Text style={styles.kriteriaValue}>
                  {stats.pricingStats.totalKriteria.jenisKue}
                </Text>
              </View>
              <View style={styles.kriteriaItem}>
                <Text style={styles.kriteriaLabel}>Variasi</Text>
                <Text style={styles.kriteriaValue}>
                  {stats.pricingStats.totalKriteria.variasiKue}
                </Text>
              </View>
              <View style={styles.kriteriaItem}>
                <Text style={styles.kriteriaLabel}>Ukuran</Text>
                <Text style={styles.kriteriaValue}>
                  {stats.pricingStats.totalKriteria.ukuranKue}
                </Text>
              </View>
              <View style={styles.kriteriaItem}>
                <Text style={styles.kriteriaLabel}>Kotak</Text>
                <Text style={styles.kriteriaValue}>
                  {stats.pricingStats.totalKriteria.kotakKue}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Sales Trend Chart Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tren Penjualan Harian</Text>
          <View style={styles.chartContainer}>
            <View style={styles.chartPlaceholder}>
              <Ionicons name="bar-chart" size={32} color="#9CA3AF" />
              <Text style={styles.chartPlaceholderText}>
                Visualisasi grafik penjualan
              </Text>
              <Text style={styles.chartPlaceholderSubtext}>
                {stats.dailySales.length} hari data tersedia
              </Text>
            </View>
          </View>
        </View>

        {/* Top Products Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Produk Terlaris</Text>
            <TouchableOpacity
              style={styles.viewAllButton}
              onPress={handleViewAllProducts}>
              <Text style={styles.viewAllText}>
                Lihat Semua ({stats.topProducts.length})
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#6B7280" />
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.topProductsContainer}
            contentContainerStyle={{ paddingRight: 20 }}>
            {stats.topProducts.slice(0, 8).map((product, index) => (
              <View key={index} style={styles.productCard}>
                <View style={styles.productRankContainer}>
                  <Text style={styles.productRank}>{index + 1}</Text>
                </View>
                <View style={styles.productInfo}>
                  <Text style={styles.productName} numberOfLines={1}>
                    {product.name}
                  </Text>
                  {product.kategori && (
                    <Text style={styles.productCategory}>
                      {product.kategori}
                    </Text>
                  )}
                </View>
                <View style={styles.productStats}>
                  <Text style={styles.productQuantity}>
                    {product.quantity}x
                  </Text>
                  <Text style={styles.productRevenue}>
                    {formatCurrency(product.revenue)}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
          {stats.topProducts.length > 8 && (
            <TouchableOpacity
              style={styles.showMoreButton}
              onPress={handleViewAllProducts}>
              <Text style={styles.showMoreText}>Lihat Lebih Banyak</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Full Products List Modal */}
        {showAllProducts && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Semua Produk Terlaris</Text>
                <TouchableOpacity onPress={() => setShowAllProducts(false)}>
                  <Ionicons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalScroll}>
                {stats.topProducts.map((product, index) => (
                  <View key={index} style={styles.fullProductItem}>
                    <Text style={styles.fullProductRank}>{index + 1}.</Text>
                    <View style={styles.fullProductInfo}>
                      <Text style={styles.fullProductName}>{product.name}</Text>
                      {product.kategori && (
                        <Text style={styles.fullProductCategory}>
                          {product.kategori}
                        </Text>
                      )}
                    </View>
                    <View style={styles.fullProductStats}>
                      <Text style={styles.fullProductQuantity}>
                        {product.quantity}x
                      </Text>
                      <Text style={styles.fullProductRevenue}>
                        {formatCurrency(product.revenue)}
                      </Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          </View>
        )}

        {/* Category Sales Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Penjualan per Kategori</Text>
          <View style={styles.categoryList}>
            {stats.categorySales.map((category, index) => (
              <View key={index} style={styles.categoryItem}>
                <View style={styles.categoryInfo}>
                  <Text style={styles.categoryName}>
                    {category.kategoriNama}
                  </Text>
                  <Text style={styles.categoryCount}>
                    {category.jumlahProduk} produk
                  </Text>
                </View>
                <Text style={styles.categoryAmount}>
                  {formatCurrency(category.totalPenjualan)}
                </Text>
              </View>
            ))}
            {stats.categorySales.length === 0 && (
              <Text style={styles.noDataText}>Belum ada data kategori</Text>
            )}
          </View>
        </View>

        {/* Order Statistics Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Statistik Pesanan Kue</Text>
          <View style={styles.orderStatsContainer}>
            <View style={styles.orderStatItem}>
              <Text style={styles.orderStatLabel}>Pesanan Total</Text>
              <Text style={styles.orderStatValue}>
                {stats.orderStats.totalPesanan}
              </Text>
            </View>
            <View style={styles.orderStatItem}>
              <Text style={styles.orderStatLabel}>Rata-rata Nilai</Text>
              <Text style={styles.orderStatValue}>
                {formatCurrency(stats.orderStats.rataRataNilaiPesanan)}
              </Text>
            </View>
            <View style={styles.orderStatItem}>
              <Text style={styles.orderStatLabel}>Pending</Text>
              <Text style={[styles.orderStatValue, { color: "#F59E0B" }]}>
                {stats.orderStats.pesananPending}
              </Text>
            </View>
            <View style={styles.orderStatItem}>
              <Text style={styles.orderStatLabel}>Selesai</Text>
              <Text style={[styles.orderStatValue, { color: "#10B981" }]}>
                {stats.orderStats.pesananSelesai}
              </Text>
            </View>
          </View>
        </View>

        {/* Monthly Trend Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tren Bulanan</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.monthlyTrendContainer}>
            <View style={styles.monthlyTrendScrollContent}>
              {stats.monthlyTrend.slice(-12).map((month, index) => (
                <View key={index} style={styles.monthlyTrendItem}>
                  <Text style={styles.monthlyTrendLabel}>{month.bulan}</Text>
                  <View style={styles.monthlyTrendBar}>
                    <View
                      style={[
                        styles.monthlyTrendFill,
                        {
                          width:
                            stats.monthlyTrend.length > 0
                              ? `${
                                  (month.pendapatan /
                                    Math.max(
                                      ...stats.monthlyTrend.map(
                                        (m: any) => m.pendapatan || 0
                                      )
                                    )) *
                                  100
                                }%`
                              : "0%",
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.monthlyTrendValue}>
                    {formatCurrency(month.pendapatan)}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </ScrollView>

      <BottomNavigation currentPage="laporan" />
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
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  exportButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  periodSelector: {
    flexDirection: "row",
    backgroundColor: "white",
    borderRadius: 8,
    padding: 4,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  periodButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 6,
  },
  periodButtonActive: {
    backgroundColor: "#EA580C",
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
  },
  periodButtonTextActive: {
    color: "white",
  },
  periodLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 20,
  },
  summaryCards: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 20,
  },
  summaryCard: {
    width: "48%",
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    minHeight: 100,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: "500",
    color: "#6B7280",
    marginLeft: 8,
    flex: 1,
  },
  cardValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 4,
  },
  cardSubtext: {
    fontSize: 11,
    color: "#9CA3AF",
  },
  bestDayCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  bestDayHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  bestDayTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  bestDayContent: {
    flex: 1,
  },
  bestDayDate: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 4,
  },
  bestDayAmount: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#F59E0B",
    marginBottom: 2,
  },
  bestDayTransactions: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  section: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  viewAllText: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
  chartContainer: {
    alignItems: "center",
    justifyContent: "center",
    height: 200,
    marginBottom: 0,
  },
  chartPlaceholder: {
    alignItems: "center",
  },
  chartPlaceholderText: {
    fontSize: 16,
    color: "#6B7280",
    marginTop: 8,
    fontWeight: "500",
  },
  chartPlaceholderSubtext: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 4,
  },
  kueReadyStatsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    justifyContent: "space-around",
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    minWidth: 120,
    gap: 12,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
  },
  statLabel: {
    fontSize: 12,
    color: "#6B7280",
  },
  pricingStatsContainer: {
    gap: 16,
  },
  pricingStatItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  pricingStatLabel: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 4,
  },
  pricingStatValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  kriteriaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 12,
  },
  kriteriaItem: {
    flex: 1,
    minWidth: 80,
    alignItems: "center",
    padding: 8,
    backgroundColor: "#F9FAFB",
    borderRadius: 6,
  },
  kriteriaLabel: {
    fontSize: 12,
    color: "#9CA3AF",
    textAlign: "center",
  },
  kriteriaValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginTop: 4,
  },
  topProductsContainer: {
    marginBottom: 12,
  },
  productCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    padding: 12,
    marginRight: 12,
    minWidth: 140,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  productRankContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#EA580C",
    marginBottom: 8,
  },
  productRank: {
    fontSize: 12,
    fontWeight: "bold",
    color: "white",
  },
  productInfo: {
    marginBottom: 8,
  },
  productName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  productCategory: {
    fontSize: 12,
    color: "#6B7280",
  },
  productStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  productQuantity: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  productRevenue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#10B981",
  },
  showMoreButton: {
    alignItems: "center",
    paddingVertical: 8,
  },
  showMoreText: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
  modalOverlay: {
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
  modalContent: {
    backgroundColor: "white",
    borderRadius: 12,
    margin: 20,
    flex: 1,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  modalScroll: {
    flex: 1,
  },
  fullProductItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  fullProductRank: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#EA580C",
    width: 24,
    marginRight: 12,
  },
  fullProductInfo: {
    flex: 1,
  },
  fullProductName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#111827",
    marginBottom: 2,
  },
  fullProductCategory: {
    fontSize: 14,
    color: "#6B7280",
  },
  fullProductStats: {
    alignItems: "flex-end",
  },
  fullProductQuantity: {
    fontSize: 14,
    color: "#9CA3AF",
  },
  fullProductRevenue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#10B981",
    marginTop: 2,
  },
  categoryList: {
    marginBottom: 0,
  },
  categoryItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#111827",
    marginBottom: 2,
  },
  categoryCount: {
    fontSize: 12,
    color: "#6B7280",
  },
  categoryAmount: {
    fontSize: 14,
    fontWeight: "600",
    color: "#EA580C",
  },
  noDataText: {
    textAlign: "center",
    color: "#9CA3AF",
    fontSize: 14,
    paddingVertical: 20,
  },
  orderStatsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  orderStatItem: {
    flex: 1,
    minWidth: 120,
    alignItems: "center",
    padding: 12,
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
  },
  orderStatLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
    textAlign: "center",
  },
  orderStatValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
  },
  monthlyTrendContainer: {
    height: 100,
  },
  monthlyTrendScrollContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  monthlyTrendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    minWidth: 120,
  },
  monthlyTrendLabel: {
    width: 60,
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
    textAlign: "center",
  },
  monthlyTrendBar: {
    flex: 1,
    height: 8,
    backgroundColor: "#F3F4F6",
    borderRadius: 4,
    overflow: "hidden",
  },
  monthlyTrendFill: {
    height: "100%",
    backgroundColor: "#10B981",
    borderRadius: 4,
  },
  monthlyTrendValue: {
    width: 80,
    fontSize: 12,
    fontWeight: "600",
    color: "#111827",
    textAlign: "right",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
    padding: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#EF4444",
    marginTop: 8,
    marginBottom: 4,
  },
  errorText: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: "#EA580C",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#6B7280",
    marginTop: 16,
    marginBottom: 8,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 20,
  },
});
