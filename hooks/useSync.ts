// hooks/useSync.ts - Hook untuk mengakses sync state
// Path: NurCakePOS/client/hooks/useSync.ts

import { useCallback, useEffect, useState } from "react";
import { syncManager } from "../services/SyncManager";

// ============================================
// TYPES
// ============================================

type SyncStatusType = "idle" | "syncing" | "offline" | "error" | "pending";

interface SyncStats {
  totalPushed: number;
  totalPulled: number;
  totalConflicts: number;
  failedAttempts: number;
  lastSync: string | null;
}

interface UseSyncReturn {
  status: SyncStatusType;
  isOnline: boolean;
  isSyncing: boolean;
  isOffline: boolean;
  pendingCount: number;
  lastSyncTime: string | null;
  lastSyncTimeFormatted: string;
  statusLabel: string;
  statusColor: string;
  stats: SyncStats;
  forceSync: () => Promise<void>;
  retryFailed: () => Promise<void>;
  clearQueue: () => Promise<void>;
}

interface UseSyncProgressReturn {
  isActive: boolean;
  phase: "idle" | "push" | "pull" | "complete";
  current: number;
  total: number;
  percent: number;
  message: string;
}

// ============================================
// MAIN HOOK
// ============================================

export function useSync(): UseSyncReturn {
  const [status, setStatus] = useState<SyncStatusType>("idle");
  const [pendingCount, setPendingCount] = useState(0);
  const [stats, setStats] = useState<SyncStats>({
    totalPushed: 0,
    totalPulled: 0,
    totalConflicts: 0,
    failedAttempts: 0,
    lastSync: null,
  });

  // Subscribe to status changes
  useEffect(() => {
    const unsubscribe = syncManager.subscribe((newStatus) => {
      setStatus(newStatus);
      setPendingCount(syncManager.getPendingCount());
    });

    // Initial load
    setStatus(syncManager.getStatus());
    setPendingCount(syncManager.getPendingCount());

    // Load stats
    syncManager.getStats().then(setStats);

    return unsubscribe;
  }, []);

  // Derived states
  const isOnline = syncManager.getIsOnline();
  const isSyncing = status === "syncing";
  const isOffline = status === "offline";
  const lastSyncTime = syncManager.getLastSyncTime();

  // Format last sync time
  const lastSyncTimeFormatted = lastSyncTime
    ? formatRelativeTime(lastSyncTime)
    : "Belum pernah sync";

  // Status label
  const statusLabel = getStatusLabel(status, pendingCount);

  // Status color
  const statusColor = getStatusColor(status);

  // Actions
  const forceSync = useCallback(async () => {
    await syncManager.forceSync();
    const newStats = await syncManager.getStats();
    setStats(newStats);
  }, []);

  const retryFailed = useCallback(async () => {
    await syncManager.retryFailed();
    const newStats = await syncManager.getStats();
    setStats(newStats);
  }, []);

  const clearQueue = useCallback(async () => {
    await syncManager.clearQueue();
    setPendingCount(0);
  }, []);

  return {
    status,
    isOnline,
    isSyncing,
    isOffline,
    pendingCount,
    lastSyncTime,
    lastSyncTimeFormatted,
    statusLabel,
    statusColor,
    stats,
    forceSync,
    retryFailed,
    clearQueue,
  };
}

// ============================================
// PROGRESS HOOK
// ============================================

export function useSyncProgress(): UseSyncProgressReturn {
  const [progress, setProgress] = useState({
    isActive: false,
    phase: "idle" as "idle" | "push" | "pull" | "complete",
    current: 0,
    total: 0,
    percent: 0,
    message: "",
  });

  useEffect(() => {
    const unsubscribe = syncManager.subscribeProgress((p) => {
      setProgress({
        isActive: true,
        phase: p.phase,
        current: p.current,
        total: p.total,
        percent: p.total > 0 ? Math.round((p.current / p.total) * 100) : 0,
        message: p.message ?? "",
      });

      // Reset after completion
      if (p.current >= p.total) {
        setTimeout(() => {
          setProgress((prev) => ({ ...prev, isActive: false }));
        }, 1000);
      }
    });

    return unsubscribe;
  }, []);

  return progress;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) {
    return "Baru saja";
  } else if (diffMin < 60) {
    return `${diffMin} menit lalu`;
  } else if (diffHour < 24) {
    return `${diffHour} jam lalu`;
  } else if (diffDay === 1) {
    return "Kemarin";
  } else if (diffDay < 7) {
    return `${diffDay} hari lalu`;
  } else {
    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
}

function getStatusLabel(status: SyncStatusType, pendingCount: number): string {
  switch (status) {
    case "idle":
      return pendingCount > 0
        ? `${pendingCount} menunggu sync`
        : "Tersinkronisasi";
    case "syncing":
      return "Menyinkronkan...";
    case "offline":
      return "Mode Offline";
    case "error":
      return "Error Sync";
    case "pending":
      return `${pendingCount} menunggu sync`;
    default:
      return "Unknown";
  }
}

function getStatusColor(status: SyncStatusType): string {
  switch (status) {
    case "idle":
      return "#10B981"; // Green
    case "syncing":
      return "#3B82F6"; // Blue
    case "offline":
      return "#F59E0B"; // Amber
    case "error":
      return "#EF4444"; // Red
    case "pending":
      return "#F59E0B"; // Amber
    default:
      return "#6B7280"; // Gray
  }
}

export default useSync;
