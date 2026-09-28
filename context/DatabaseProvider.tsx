// context/DatabaseProvider.tsx - Database & Sync Provider
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { sqliteService } from "../database/SQLiteService";
import { seedDevData } from "../database/seedDevData";
import { syncManager } from "../services/SyncManager";

// ============================================
// TYPES
// ============================================

type ManagerStatus = "idle" | "syncing" | "offline" | "error" | "pending";

interface DatabaseContextType {
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;

  // Device info
  deviceId: string | null;

  // Sync status
  syncStatus: ManagerStatus;
  isOnline: boolean;
  lastSyncTime: string | null;
  pendingCount: number;

  // Actions
  reinitialize: () => Promise<void>;
  registerDevice: (
    name: string,
    type: "kasir" | "dapur" | "admin"
  ) => Promise<boolean>;
  forceSync: () => Promise<void>;
  // Dev only
  runDevSeed: (force?: boolean) => Promise<void>;
}

interface DatabaseProviderProps {
  children: ReactNode;
  onInitialized?: () => void;
  onError?: (error: Error) => void;
}

// ============================================
// CONTEXT
// ============================================

const DatabaseContext = createContext<DatabaseContextType | undefined>(
  undefined
);

// ============================================
// PROVIDER COMPONENT
// ============================================

export function DatabaseProvider({
  children,
  onInitialized,
  onError,
}: DatabaseProviderProps): React.ReactElement {
  // State
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  // Sync state
  const [syncStatus, setSyncStatus] = useState<ManagerStatus>("idle");
  const [isOnline, setIsOnline] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const syncUnsubscribeRef = useRef<(() => void) | null>(null);

  // ============================================
  // INITIALIZATION
  // ============================================

  useEffect(() => {
    initializeDatabase();

    return () => {
      syncUnsubscribeRef.current?.();
      syncManager.stop();
    };
  }, []);

  const initializeDatabase = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      console.log("[DatabaseProvider] Initializing database...");

      // 1. Initialize SQLite
      await sqliteService.initialize();
      console.log("[DatabaseProvider] SQLite initialized");

      // 2. Get device ID
      const id = sqliteService.getDeviceId();
      setDeviceId(id);
      console.log("[DatabaseProvider] Device ID:", id);

      // 3. Initialize sync manager
      await syncManager.initialize();
      console.log("[DatabaseProvider] SyncManager initialized");

      // 4. Subscribe to sync status changes
      const unsubscribe = syncManager.subscribe((status) => {
        setSyncStatus(status);
        setIsOnline(syncManager.getIsOnline());
        setLastSyncTime(syncManager.getLastSyncTime());
        setPendingCount(syncManager.getPendingCount());
      });
      syncUnsubscribeRef.current = unsubscribe;

      // 5. Set initial sync values
      setIsOnline(syncManager.getIsOnline());
      setLastSyncTime(syncManager.getLastSyncTime());
      setPendingCount(syncManager.getPendingCount());

      // Done
      setIsInitialized(true);
      setIsLoading(false);

      console.log("[DatabaseProvider] Initialization complete");
      onInitialized?.();
    } catch (err: any) {
      console.error("[DatabaseProvider] Initialization error:", err);
      setError(err.message || "Failed to initialize database");
      setIsLoading(false);
      onError?.(err);
    }
  };

  // ============================================
  // ACTIONS
  // ============================================

  const reinitialize = async (): Promise<void> => {
    setIsInitialized(false);
    await initializeDatabase();
  };

  const registerDevice = async (
    name: string,
    type: "kasir" | "dapur" | "admin"
  ): Promise<boolean> => {
    try {
      const success = await syncManager.registerDevice(name, type);
      if (success) {
        // Trigger sync after registration
        await syncManager.forceSync();
      }
      return success;
    } catch (err) {
      console.error("[DatabaseProvider] Device registration error:", err);
      return false;
    }
  };

  const forceSync = async (): Promise<void> => {
    await syncManager.forceSync();
  };

  const runDevSeed = async (force = false): Promise<void> => {
    if (!isInitialized) throw new Error("Database belum siap");
    await seedDevData(force);
  };

  // ============================================
  // CONTEXT VALUE
  // ============================================

  const contextValue: DatabaseContextType = {
    isInitialized,
    isLoading,
    error,
    deviceId,
    syncStatus,
    isOnline,
    lastSyncTime,
    pendingCount,
    reinitialize,
    registerDevice,
    forceSync,
    runDevSeed,
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <DatabaseContext.Provider value={contextValue}>
      {children}
    </DatabaseContext.Provider>
  );
}

// ============================================
// HOOK
// ============================================

export function useDatabase(): DatabaseContextType {
  const context = useContext(DatabaseContext);

  if (!context) {
    throw new Error("useDatabase must be used within a DatabaseProvider");
  }

  return context;
}

// ============================================
// LOADING COMPONENT (Optional)
// ============================================

interface DatabaseLoadingProps {
  children: ReactNode;
  loadingComponent?: ReactNode;
  errorComponent?: (error: string, retry: () => void) => ReactNode;
}

export function DatabaseGate({
  children,
  loadingComponent,
  errorComponent,
}: DatabaseLoadingProps): React.ReactElement {
  const { isInitialized, isLoading, error, reinitialize } = useDatabase();

  if (isLoading) {
    return <>{loadingComponent || <DefaultLoadingComponent />}</>;
  }

  if (error) {
    return (
      <>
        {errorComponent ? (
          errorComponent(error, reinitialize)
        ) : (
          <DefaultErrorComponent error={error} onRetry={reinitialize} />
        )}
      </>
    );
  }

  if (!isInitialized) {
    return <>{loadingComponent || <DefaultLoadingComponent />}</>;
  }

  return <>{children}</>;
}

// ============================================
// DEFAULT COMPONENTS
// ============================================

function DefaultLoadingComponent(): React.ReactElement {
  return (
    <View style={styles.container}>
      <View style={styles.loadingLogoContainer}>
        <ActivityIndicator size="large" color="#EA580C" />
      </View>
      <Text style={styles.loadingTitle}>NurCake POS</Text>
      <Text style={styles.loadingText}>Menyiapkan aplikasi...</Text>
    </View>
  );
}

function DefaultErrorComponent({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}): React.ReactElement {
  return (
    <View style={styles.container}>
      <View style={styles.errorIconContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
      </View>
      <Text style={styles.errorTitle}>Gagal Memuat Database</Text>
      <Text style={styles.errorMessage}>{error}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
        <Text style={styles.retryButtonText}>Coba Lagi</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFF7ED",
    padding: 20,
  },
  loadingLogoContainer: {
    width: 80,
    height: 80,
    backgroundColor: "#FED7AA",
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  loadingTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  loadingText: {
    fontSize: 14,
    color: "#6B7280",
  },
  errorIconContainer: {
    marginBottom: 16,
  },
  errorIcon: {
    fontSize: 48,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
    textAlign: "center",
  },
  errorMessage: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 28,
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: "#EA580C",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 10,
  },
  retryButtonText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "600",
  },
});

export default DatabaseProvider;
