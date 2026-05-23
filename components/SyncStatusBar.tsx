// components/SyncStatusBar.tsx - Komponen UI untuk menampilkan status sync
// Path: NurCakePOS/client/components/SyncStatusBar.tsx

import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSync, useSyncProgress } from "../hooks/useSync";

// ============================================
// MAIN COMPONENT
// ============================================

interface SyncStatusBarProps {
  showDetails?: boolean;
  compact?: boolean;
}

export function SyncStatusBar({
  showDetails = true,
  compact = false,
}: SyncStatusBarProps): JSX.Element {
  const {
    status,
    isOnline,
    isSyncing,
    pendingCount,
    lastSyncTimeFormatted,
    statusLabel,
    statusColor,
    forceSync,
  } = useSync();

  const [modalVisible, setModalVisible] = useState(false);

  // Render compact version (untuk header)
  if (compact) {
    return (
      <TouchableOpacity
        style={[
          styles.compactContainer,
          { backgroundColor: statusColor + "20" },
        ]}
        onPress={() => setModalVisible(true)}>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <Text style={[styles.compactText, { color: statusColor }]}>
          {pendingCount > 0 ? `${pendingCount}` : "✓"}
        </Text>

        <SyncDetailModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
        />
      </TouchableOpacity>
    );
  }

  // Render full version
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => showDetails && setModalVisible(true)}
      disabled={!showDetails}>
      <View style={styles.leftSection}>
        <View
          style={[styles.statusIndicator, { backgroundColor: statusColor }]}>
          {isSyncing ? (
            <SyncSpinner color="#FFF" />
          ) : (
            <Ionicons
              name={
                status === "idle"
                  ? "checkmark"
                  : status === "offline"
                  ? "cloud-offline"
                  : "alert"
              }
              size={16}
              color="white"
            />
          )}
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.statusText}>{statusLabel}</Text>
          <Text style={styles.lastSyncText}>{lastSyncTimeFormatted}</Text>
        </View>
      </View>

      <View style={styles.rightSection}>
        {pendingCount > 0 && (
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingText}>{pendingCount}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.syncButton, isSyncing && styles.syncButtonDisabled]}
          onPress={forceSync}
          disabled={isSyncing}>
          <Ionicons name="sync" size={18} color="white" />
        </TouchableOpacity>
      </View>

      {showDetails && (
        <SyncDetailModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
        />
      )}
    </TouchableOpacity>
  );
}

// ============================================
// SYNC SPINNER
// ============================================

function SyncSpinner({ color = "#FFF" }: { color?: string }): JSX.Element {
  const spinValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const spin = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      })
    );
    spin.start();
    return () => spin.stop();
  }, [spinValue]);

  const rotate = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <Ionicons name="sync" size={16} color={color} />
    </Animated.View>
  );
}

// ============================================
// SYNC DETAIL MODAL
// ============================================

interface SyncDetailModalProps {
  visible: boolean;
  onClose: () => void;
}

function SyncDetailModal({
  visible,
  onClose,
}: SyncDetailModalProps): JSX.Element {
  const {
    status,
    isOnline,
    pendingCount,
    lastSyncTimeFormatted,
    stats,
    forceSync,
    retryFailed,
    clearQueue,
  } = useSync();

  const { isActive, phase, percent } = useSyncProgress();

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}>
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalBackdrop} />
      </TouchableWithoutFeedback>

      {/* Bottom Sheet */}
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          {/* Handle Bar */}
          <View style={styles.handleBarContainer}>
            <View style={styles.handleBar} />
          </View>

          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Status Sinkronisasi</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalBody}
            showsVerticalScrollIndicator={false}>
            {/* Status Info */}
            <View style={styles.infoSection}>
              <InfoRow label="Status" value={status} />
              <InfoRow
                label="Koneksi"
                value={isOnline ? "Online" : "Offline"}
              />
              <InfoRow label="Sync Terakhir" value={lastSyncTimeFormatted} />
              <InfoRow label="Menunggu Sync" value={`${pendingCount} item`} />
            </View>

            {/* Progress Bar */}
            {isActive && (
              <View style={styles.progressSection}>
                <Text style={styles.progressLabel}>
                  {phase === "push" ? "Mengirim data..." : "Menerima data..."}
                </Text>
                <View style={styles.progressBar}>
                  <View
                    style={[styles.progressFill, { width: `${percent}%` }]}
                  />
                </View>
                <Text style={styles.progressPercent}>{percent}%</Text>
              </View>
            )}

            {/* Statistics */}
            <View style={styles.statsSection}>
              <Text style={styles.sectionTitle}>Statistik</Text>
              <View style={styles.statsGrid}>
                <StatBox label="Total Push" value={stats.totalPushed} />
                <StatBox label="Total Pull" value={stats.totalPulled} />
                <StatBox label="Konflik" value={stats.totalConflicts} />
                <StatBox label="Gagal" value={stats.failedAttempts} />
              </View>
            </View>

            {/* Actions */}
            <View style={styles.actionsSection}>
              <TouchableOpacity style={styles.actionButton} onPress={forceSync}>
                <Ionicons name="sync" size={18} color="white" />
                <Text style={styles.actionButtonText}>Sync Sekarang</Text>
              </TouchableOpacity>

              {stats.failedAttempts > 0 && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.actionButtonSecondary]}
                  onPress={retryFailed}>
                  <Ionicons name="refresh" size={18} color="#EA580C" />
                  <Text style={styles.actionButtonTextSecondary}>
                    Coba Ulang Gagal
                  </Text>
                </TouchableOpacity>
              )}

              {pendingCount > 0 && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.actionButtonDanger]}
                  onPress={clearQueue}>
                  <Ionicons name="trash" size={18} color="#EF4444" />
                  <Text style={styles.actionButtonTextDanger}>
                    Hapus Antrian
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ============================================
// HELPER COMPONENTS
// ============================================

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}): JSX.Element {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function StatBox({
  label,
  value,
}: {
  label: string;
  value: number;
}): JSX.Element {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ============================================
// INLINE SYNC INDICATOR (untuk headers)
// ============================================

export function SyncIndicator(): JSX.Element {
  const { status, pendingCount, statusColor, isSyncing } = useSync();
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <>
      <TouchableOpacity
        style={styles.indicatorContainer}
        onPress={() => setModalVisible(true)}>
        {isSyncing ? (
          <SyncSpinner color={statusColor} />
        ) : (
          <View
            style={[styles.indicatorDot, { backgroundColor: statusColor }]}
          />
        )}
        {pendingCount > 0 && (
          <View style={styles.indicatorBadge}>
            <Text style={styles.indicatorBadgeText}>{pendingCount}</Text>
          </View>
        )}
      </TouchableOpacity>

      <SyncDetailModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
      />
    </>
  );
}

// ============================================
// OFFLINE BANNER
// ============================================

export function OfflineBanner(): JSX.Element | null {
  const { isOffline, pendingCount } = useSync();

  if (!isOffline) return null;

  return (
    <View style={styles.offlineBanner}>
      <Ionicons name="cloud-offline" size={16} color="white" />
      <Text style={styles.offlineBannerText}>
        Mode Offline {pendingCount > 0 && `(${pendingCount} menunggu sync)`}
      </Text>
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  // Main container
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFF",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },

  // Compact version
  compactContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  compactText: {
    fontSize: 12,
    fontWeight: "600",
  },

  // Left section
  leftSection: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  statusIndicator: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  lastSyncText: {
    fontSize: 12,
    color: "#888",
    marginTop: 2,
  },

  // Right section
  rightSection: {
    flexDirection: "row",
    alignItems: "center",
  },
  pendingBadge: {
    backgroundColor: "#F59E0B",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    marginRight: 8,
  },
  pendingText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "bold",
  },
  syncButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#EA580C",
    justifyContent: "center",
    alignItems: "center",
  },
  syncButtonDisabled: {
    backgroundColor: "#CCC",
  },

  // Modal
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
  },
  handleBarContainer: {
    alignItems: "center",
    paddingVertical: 12,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: "#D1D5DB",
    borderRadius: 2,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  closeButton: {
    padding: 4,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
  },
  modalBody: {
    padding: 16,
  },

  // Info section
  infoSection: {
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
  },
  infoLabel: {
    fontSize: 14,
    color: "#666",
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },

  // Progress section
  progressSection: {
    marginBottom: 16,
  },
  progressLabel: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: "#EEE",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#EA580C",
  },
  progressPercent: {
    fontSize: 12,
    color: "#888",
    textAlign: "right",
    marginTop: 4,
  },

  // Stats section
  statsSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -6,
  },
  statBox: {
    width: "25%",
    paddingHorizontal: 6,
    alignItems: "center",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#EA580C",
  },
  statLabel: {
    fontSize: 11,
    color: "#888",
    textAlign: "center",
  },

  // Actions section
  actionsSection: {
    marginTop: 8,
    gap: 10,
  },
  actionButton: {
    backgroundColor: "#EA580C",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  actionButtonSecondary: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#EA580C",
  },
  actionButtonDanger: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#EF4444",
  },
  actionButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
  actionButtonTextSecondary: {
    color: "#EA580C",
    fontSize: 16,
    fontWeight: "600",
  },
  actionButtonTextDanger: {
    color: "#EF4444",
    fontSize: 16,
    fontWeight: "600",
  },

  // Inline indicator
  indicatorContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 4,
  },
  indicatorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  indicatorBadge: {
    backgroundColor: "#F59E0B",
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: -6,
    marginTop: -10,
  },
  indicatorBadgeText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "bold",
  },

  // Offline banner
  offlineBanner: {
    backgroundColor: "#F59E0B",
    paddingVertical: 8,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  offlineBannerText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "500",
  },
});

export default SyncStatusBar;
