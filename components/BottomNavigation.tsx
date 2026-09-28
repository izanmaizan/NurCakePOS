import { Ionicons } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";
import React from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResponsive } from "../hooks/useResponsive";

interface BottomNavProps {
  currentPage?: string;
}

const tabs = [
  { id: "pos", name: "POS", icon: "storefront" as keyof typeof Ionicons.glyphMap, route: "/pos" },
  { id: "buku-pesanan", name: "Pesanan", icon: "book" as keyof typeof Ionicons.glyphMap, route: "/buku-pesanan" },
  { id: "lacak-pesanan", name: "Lacak", icon: "search" as keyof typeof Ionicons.glyphMap, route: "/lacak-pesanan" },
  { id: "kelola-produk", name: "Produk", icon: "cube" as keyof typeof Ionicons.glyphMap, route: "/kelola-produk" },
  { id: "kelola-harga", name: "Harga", icon: "pricetag" as keyof typeof Ionicons.glyphMap, route: "/kelola-harga" },
  { id: "laporan", name: "Laporan", icon: "bar-chart" as keyof typeof Ionicons.glyphMap, route: "/laporan" },
];

export default function BottomNavigation({ currentPage }: BottomNavProps) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { isLandscape } = useResponsive();

  const handleTabPress = (route: string) => {
    try {
      router.push(route as any);
    } catch {
      router.replace(route as any);
    }
  };

  const isActive = (tabId: string, route: string) => {
    if (currentPage === tabId) return true;
    return pathname === route || pathname.startsWith(route + "/");
  };

  const pb = Platform.OS === "android" ? insets.bottom + 3 : insets.bottom || 3;

  return (
    <View style={[styles.container, { paddingBottom: pb }]}>
      {tabs.map((tab) => {
        const active = isActive(tab.id, tab.route);
        return (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, isLandscape && styles.tabLandscape]}
            onPress={() => handleTabPress(tab.route)}
            activeOpacity={0.7}>
            <View style={[styles.iconContainer, active && styles.activeIconContainer, isLandscape && styles.iconContainerLandscape]}>
              <Ionicons
                name={tab.icon}
                size={isLandscape ? 15 : 16}
                color={active ? "#EA580C" : "#6B7280"}
              />
            </View>
            {!isLandscape && (
              <Text style={[styles.label, active && styles.activeLabel]}>
                {tab.name}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 12,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 3,
  },
  tabLandscape: {
    paddingVertical: 4,
  },
  iconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 1,
  },
  iconContainerLandscape: {
    marginBottom: 0,
  },
  activeIconContainer: {
    backgroundColor: "#FED7AA",
  },
  label: {
    fontSize: 8,
    color: "#6B7280",
    fontWeight: "500",
    textAlign: "center",
  },
  activeLabel: {
    color: "#EA580C",
    fontWeight: "600",
  },
});
