// app/_layout.tsx - Fixed dengan Toast Config dan OfflineBanner
// Path: NurCakePOS/client/app/_layout.tsx

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Toast, { BaseToast, ErrorToast } from "react-native-toast-message";
import { OfflineBanner } from "../components/SyncStatusBar";
import { DatabaseProvider, useDatabase } from "../context/DatabaseProvider";

// Toast Configuration
const toastConfig = {
  success: (props: any) => (
    <BaseToast
      {...props}
      style={{ borderLeftColor: "#10B981" }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{
        fontSize: 15,
        fontWeight: "600",
      }}
      text2Style={{
        fontSize: 13,
      }}
    />
  ),
  error: (props: any) => (
    <ErrorToast
      {...props}
      style={{ borderLeftColor: "#EF4444" }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{
        fontSize: 15,
        fontWeight: "600",
      }}
      text2Style={{
        fontSize: 13,
      }}
    />
  ),
  warning: (props: any) => (
    <BaseToast
      {...props}
      style={{ borderLeftColor: "#F59E0B", backgroundColor: "#FEF3C7" }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{
        fontSize: 15,
        fontWeight: "600",
        color: "#92400E",
      }}
      text2Style={{
        fontSize: 13,
        color: "#78350F",
      }}
    />
  ),
  info: (props: any) => (
    <BaseToast
      {...props}
      style={{ borderLeftColor: "#3B82F6" }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{
        fontSize: 15,
        fontWeight: "600",
      }}
      text2Style={{
        fontSize: 13,
      }}
    />
  ),
};

function AppContent() {
  const { isInitialized, isLoading, error } = useDatabase();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#EA580C" />
        <Text style={styles.loadingText}>Menginisialisasi database...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Error Database</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Offline Banner - tampil di atas semua halaman ketika offline */}
      <OfflineBanner />

      {/* Stack Navigator */}
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "slide_from_right",
          animationDuration: 220,
        }}>
        <Stack.Screen name="index" options={{ animation: "fade" }} />
        <Stack.Screen name="login" options={{ animation: "fade" }} />
        <Stack.Screen name="pos" />
        <Stack.Screen name="kelola-produk" />
        <Stack.Screen name="kelola-harga" />
        <Stack.Screen name="transaksi" />
        <Stack.Screen name="laporan" />
        <Stack.Screen name="buku-pesanan" />
        <Stack.Screen name="lacak-pesanan" />
      </Stack>

      <StatusBar style="dark" />
      <Toast config={toastConfig} />
    </View>
  );
}

export default function RootLayout() {
  return (
    <DatabaseProvider>
      <AppContent />
    </DatabaseProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    textAlign: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    padding: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#EF4444",
    marginBottom: 8,
    textAlign: "center",
  },
  errorText: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
  },
});
