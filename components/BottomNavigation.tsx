// components/BottomNavigation.tsx
import { Ionicons } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";
import React from "react";
import {
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: screenWidth } = Dimensions.get("window");

interface BottomNavProps {
  currentPage?: string;
}

export default function BottomNavigation({ currentPage }: BottomNavProps) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  const tabs = [
    {
      id: "pos",
      name: "POS",
      icon: "storefront" as keyof typeof Ionicons.glyphMap,
      route: "/pos",
    },
    {
      id: "buku-pesanan",
      name: "Pesanan",
      icon: "book" as keyof typeof Ionicons.glyphMap,
      route: "/buku-pesanan",
    },
    {
      id: "lacak-pesanan",
      name: "Lacak",
      icon: "search" as keyof typeof Ionicons.glyphMap,
      route: "/lacak-pesanan",
    },
    {
      id: "kelola-produk",
      name: "Produk",
      icon: "cube" as keyof typeof Ionicons.glyphMap,
      route: "/kelola-produk",
    },
    {
      id: "kelola-harga",
      name: "Harga",
      icon: "pricetag" as keyof typeof Ionicons.glyphMap,
      route: "/kelola-harga",
    },
    {
      id: "laporan",
      name: "Laporan",
      icon: "bar-chart" as keyof typeof Ionicons.glyphMap,
      route: "/laporan",
    },
  ];

  const handleTabPress = (route: string) => {
    try {
      router.push(route as any);
    } catch (error) {
      console.error("Navigation error:", error);
      // Fallback to replace
      router.replace(route as any);
    }
  };

  const isActive = (tabId: string, route: string) => {
    // Check both currentPage prop and pathname
    if (currentPage === tabId) return true;
    if (pathname === route) return true;

    // Additional check for root routes
    if (
      route === "/pos" &&
      (pathname === "/pos" || pathname.startsWith("/pos"))
    )
      return true;
    if (
      route === "/buku-pesanan" &&
      (pathname === "/buku-pesanan" || pathname.startsWith("/buku-pesanan"))
    )
      return true;
    if (
      route === "/lacak-pesanan" &&
      (pathname === "/lacak-pesanan" || pathname.startsWith("/lacak-pesanan"))
    )
      return true;
    if (
      route === "/kelola-produk" &&
      (pathname === "/kelola-produk" || pathname.startsWith("/kelola-produk"))
    )
      return true;
    if (
      route === "/kelola-harga" &&
      (pathname === "/kelola-harga" || pathname.startsWith("/kelola-harga"))
    )
      return true;
    if (
      route === "/laporan" &&
      (pathname === "/laporan" || pathname.startsWith("/laporan"))
    )
      return true;

    return false;
  };

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom:
            Platform.OS === "android" ? insets.bottom + 8 : insets.bottom || 8,
        },
      ]}>
      {tabs.map((tab) => {
        const active = isActive(tab.id, tab.route);
        return (
          <TouchableOpacity
            key={tab.id}
            style={styles.tab}
            onPress={() => handleTabPress(tab.route)}
            activeOpacity={0.7}>
            <View
              style={[
                styles.iconContainer,
                active && styles.activeIconContainer,
              ]}>
              <Ionicons
                name={tab.icon}
                size={18}
                color={active ? "#EA580C" : "#6B7280"}
              />
            </View>
            <Text style={[styles.label, active && styles.activeLabel]}>
              {tab.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 16,
    zIndex: 1000, // Ensure it's above other components
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 4,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 2,
  },
  activeIconContainer: {
    backgroundColor: "#FED7AA",
  },
  label: {
    fontSize: 9,
    color: "#6B7280",
    fontWeight: "500",
    textAlign: "center",
  },
  activeLabel: {
    color: "#EA580C",
    fontWeight: "600",
  },
});
