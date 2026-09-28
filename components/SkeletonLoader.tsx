// components/SkeletonLoader.tsx — Skeleton loading placeholder
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, ViewStyle } from "react-native";
import { BORDER_RADIUS, COLORS, SPACING } from "../constants/theme";

interface SkeletonBoxProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

function SkeletonBox({ width = "100%", height = 16, borderRadius = BORDER_RADIUS.sm, style }: SkeletonBoxProps) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  return (
    <Animated.View
      style={[
        { width: width as any, height, borderRadius, backgroundColor: COLORS.gray200 },
        { opacity },
        style,
      ]}
    />
  );
}

export function SkeletonCard() {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <SkeletonBox width="45%" height={14} />
        <SkeletonBox width={60} height={22} borderRadius={11} />
      </View>
      <SkeletonBox width="65%" height={13} style={{ marginTop: SPACING.sm }} />
      <View style={styles.cardFooter}>
        <SkeletonBox width="40%" height={13} />
        <SkeletonBox width="30%" height={16} />
      </View>
    </View>
  );
}

export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </View>
  );
}

export function SkeletonStatRow() {
  return (
    <View style={styles.statRow}>
      {[1, 2].map((i) => (
        <View key={i} style={styles.statCard}>
          <SkeletonBox width={32} height={32} borderRadius={16} style={{ marginBottom: SPACING.sm }} />
          <SkeletonBox width="60%" height={20} style={{ marginBottom: SPACING.xs }} />
          <SkeletonBox width="80%" height={12} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.base,
    marginBottom: SPACING.md,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: SPACING.md,
  },
  statRow: {
    flexDirection: "row",
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
    marginBottom: SPACING.base,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.base,
    alignItems: "flex-start",
  },
});

export default SkeletonBox;
