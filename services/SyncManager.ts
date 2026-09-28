// services/SyncManager.ts - Main Sync Orchestration Service
// Path: NurCakePOS/client/services/SyncManager.ts

import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import uuid from "react-native-uuid";
import { POLLING_INTERVALS, SYNC_CONFIG } from "../config/sync.config";
import { sqliteService } from "../database/SQLiteService";
import { SyncProgress } from "../types/sync";
import { syncApiClient } from "./SyncApiClient";

// ============================================================
// TYPES
// ============================================================

type SyncStatusType = "idle" | "syncing" | "offline" | "error" | "pending";

interface SyncManagerState {
  status: SyncStatusType;
  isOnline: boolean;
  lastSyncTime: string | null;
  pendingCount: number;
  error: string | null;
}

interface SyncStats {
  totalPushed: number;
  totalPulled: number;
  totalConflicts: number;
  failedAttempts: number;
  lastSync: string | null;
}

type StatusListener = (status: SyncStatusType) => void;
type ProgressListener = (progress: SyncProgress) => void;

// ============================================================
// SYNC MANAGER CLASS
// ============================================================

class SyncManager {
  private isInitialized: boolean = false;
  private isRunning: boolean = false;
  private pollingInterval: NodeJS.Timeout | null = null;
  private currentState: SyncManagerState = {
    status: "idle",
    isOnline: false,
    lastSyncTime: null,
    pendingCount: 0,
    error: null,
  };

  private statusListeners: Set<StatusListener> = new Set();
  private progressListeners: Set<ProgressListener> = new Set();
  private netInfoUnsubscribe: (() => void) | null = null;
  private lastPullTimestamp: string | null = null;

  // ============================================================
  // INITIALIZATION
  // ============================================================

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log("[SyncManager] Already initialized");
      return;
    }

    console.log("[SyncManager] Initializing...");

    try {
      // Load last pull timestamp from settings
      this.lastPullTimestamp = await sqliteService.getSetting(
        "last_pull_timestamp"
      );

      // Setup network listener
      this.netInfoUnsubscribe = NetInfo.addEventListener(
        this.handleNetworkChange.bind(this)
      );

      // Check initial network state
      const networkState = await NetInfo.fetch();
      await this.handleNetworkChange(networkState);

      // Update pending count
      await this.updatePendingCount();

      // Load last sync time
      const deviceInfo = await sqliteService.getDeviceInfo();
      if (deviceInfo?.last_sync_at) {
        this.currentState.lastSyncTime = deviceInfo.last_sync_at;
      }

      this.isInitialized = true;
      console.log("[SyncManager] Initialized successfully");
    } catch (error) {
      console.error("[SyncManager] Initialization failed:", error);
      throw error;
    }
  }

  // ============================================================
  // NETWORK HANDLING
  // ============================================================

  private async handleNetworkChange(state: NetInfoState): Promise<void> {
    const wasOnline = this.currentState.isOnline;
    const isNowOnline =
      state.isConnected === true && state.isInternetReachable !== false;

    console.log("[SyncManager] Network state changed:", {
      isConnected: state.isConnected,
      isInternetReachable: state.isInternetReachable,
      type: state.type,
    });

    this.currentState.isOnline = isNowOnline;

    if (isNowOnline && !wasOnline) {
      console.log("[SyncManager] Network came online, starting sync...");
      this.updateStatus("pending");
      this.startPolling();
      // Immediate sync when coming online
      this.performSync();
    } else if (!isNowOnline && wasOnline) {
      console.log("[SyncManager] Network went offline");
      this.stopPolling();
      this.updateStatus("offline");
    }

    this.notifyStatusChange();
  }

  // ============================================================
  // POLLING MANAGEMENT
  // ============================================================

  private startPolling(): void {
    if (this.pollingInterval) {
      return; // Already polling
    }

    console.log("[SyncManager] Starting polling...");

    const poll = async () => {
      if (!this.currentState.isOnline) {
        return;
      }

      await this.performSync();

      // Schedule next poll based on current state
      const interval = this.getPollingInterval();
      this.pollingInterval = setTimeout(poll, interval);
    };

    // Start first poll
    this.pollingInterval = setTimeout(poll, this.getPollingInterval());
  }

  private stopPolling(): void {
    if (this.pollingInterval) {
      clearTimeout(this.pollingInterval);
      this.pollingInterval = null;
      console.log("[SyncManager] Polling stopped");
    }
  }

  private getPollingInterval(): number {
    if (!this.currentState.isOnline || this.currentState.status === "error") {
      return POLLING_INTERVALS?.OFFLINE || 30000;
    }

    if (this.currentState.pendingCount > 0) {
      return POLLING_INTERVALS?.PENDING || 1000;
    }

    if (this.currentState.status === "syncing") {
      return POLLING_INTERVALS?.ACTIVE || 2000;
    }

    return POLLING_INTERVALS?.IDLE || 5000;
  }

  // ============================================================
  // DEVICE REGISTRATION (AUTO)
  // ============================================================

  private async ensureDeviceRegistered(): Promise<boolean> {
    try {
      const deviceInfo = await sqliteService.getDeviceInfo();

      // Already registered
      if (deviceInfo?.api_key) {
        console.log("[SyncManager] Device already registered");
        return true;
      }

      console.log("[SyncManager] Device not registered, auto-registering...");

      // Auto-register with default values
      const deviceId = sqliteService.getDeviceId();
      const deviceName = `Device-${deviceId.substring(7, 15)}`;
      const deviceType = "kasir"; // Default type

      const result = await syncApiClient.registerDevice(deviceName, deviceType);

      if (result.success && result.apiKey) {
        console.log("[SyncManager] Device registered successfully:", {
          deviceId: result.deviceId,
          apiKey: result.apiKey.substring(0, 10) + "...",
        });
        return true;
      }

      console.error("[SyncManager] Device registration failed");
      return false;
    } catch (error) {
      console.error("[SyncManager] Error during device registration:", error);
      return false;
    }
  }

  // ============================================================
  // SYNC FLOW
  // ============================================================

  async performSync(): Promise<void> {
    if (this.isRunning) {
      console.log("[SyncManager] Sync already in progress, skipping...");
      return;
    }

    if (!this.currentState.isOnline) {
      console.log("[SyncManager] Offline, skipping sync");
      return;
    }

    this.isRunning = true;
    this.updateStatus("syncing");

    const syncStartTime = new Date().toISOString();
    let recordsPushed = 0;
    let recordsPulled = 0;
    let conflicts = 0;

    try {
      // Check server health first
      const healthResult = await syncApiClient.healthCheck();
      if (!healthResult || healthResult.status !== "healthy") {
        throw new Error("Server is not reachable");
      }

      // ========== AUTO-REGISTER DEVICE IF NEEDED ==========
      const isRegistered = await this.ensureDeviceRegistered();
      if (!isRegistered) {
        throw new Error("Device registration failed");
      }
      // ====================================================

      // Push local changes
      const pushResult = await this.pushChanges();
      recordsPushed = pushResult.pushed;
      conflicts += pushResult.conflicts;

      // Pull remote changes
      const pullResult = await this.pullChanges();
      recordsPulled = pullResult.pulled;

      // Update last sync time
      await sqliteService.updateLastSyncTime();
      this.currentState.lastSyncTime = new Date().toISOString();

      // Log successful sync
      await sqliteService.addSyncLog({
        sync_type: "push",
        status: "success",
        records_pushed: recordsPushed,
        records_pulled: recordsPulled,
        conflicts,
        started_at: syncStartTime,
        completed_at: new Date().toISOString(),
      });

      // Update status
      await this.updatePendingCount();
      this.updateStatus(
        this.currentState.pendingCount > 0 ? "pending" : "idle"
      );
      this.currentState.error = null;

      console.log("[SyncManager] Sync completed:", {
        recordsPushed,
        recordsPulled,
        conflicts,
      });
    } catch (error: any) {
      const isAlreadyInError = this.currentState.status === "error" &&
        this.currentState.error === (error.message || "Sync failed");
      if (!isAlreadyInError) {
        console.error("[SyncManager] Sync failed:", error);
      }

      this.currentState.error = error.message || "Sync failed";
      this.updateStatus("error");

      // Log failed sync
      await sqliteService.addSyncLog({
        sync_type: "push",
        status: "failed",
        records_pushed: recordsPushed,
        records_pulled: recordsPulled,
        conflicts,
        error_message: error.message,
        started_at: syncStartTime,
        completed_at: new Date().toISOString(),
      });
    } finally {
      this.isRunning = false;
      this.notifyStatusChange();
    }
  }

  // ============================================================
  // PUSH CHANGES TO SERVER
  // ============================================================

  private async pushChanges(): Promise<{ pushed: number; conflicts: number }> {
    const pendingItems = await sqliteService.getPendingSyncItems(
      SYNC_CONFIG.BATCH_SIZE
    );

    if (pendingItems.length === 0) {
      return { pushed: 0, conflicts: 0 };
    }

    console.log(`[SyncManager] Pushing ${pendingItems.length} changes...`);

    // Group items by table for batch processing
    const changes: any[] = [];
    for (const item of pendingItems) {
      try {
        const data = JSON.parse(item.data);
        changes.push({
          table: item.table_name,
          operation: item.operation,
          client_id: item.record_id,
          data: data,
          version: data.version || 1,
        });
      } catch (e) {
        console.error("[SyncManager] Failed to parse sync item:", e);
      }
    }

    if (changes.length === 0) {
      return { pushed: 0, conflicts: 0 };
    }

    try {
      const batchId = `batch_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      const deviceId = sqliteService.getDeviceId();

      const response = await syncApiClient.pushChanges({
        batch_id: batchId,
        device_id: deviceId,
        changes: changes,
      });

      let pushed = 0;
      let conflicts = 0;

      if (response.success) {
        // Mark items as processed
        for (const item of pendingItems) {
          await sqliteService.markSyncItemProcessed(item.id);
        }

        // Update local records with server IDs
        if (response.results) {
          for (const result of response.results) {
            if (result.status === "inserted" || result.status === "updated") {
              // Find which table this belongs to
              const item = pendingItems.find(
                (i) => i.record_id === result.client_id
              );
              if (item) {
                await sqliteService.markRecordAsSynced(
                  item.table_name,
                  result.client_id,
                  result.server_id
                );
              }
              pushed++;
            }
          }
        }

        // Handle conflicts
        if (response.conflicts && response.conflicts.length > 0) {
          conflicts = response.conflicts.length;
          for (const conflict of response.conflicts) {
            const item = pendingItems.find(
              (i) => i.record_id === conflict.client_id
            );
            if (item) {
              await sqliteService.markRecordAsConflict(
                item.table_name,
                conflict.client_id
              );
            }
          }
        }
      }

      // Notify progress
      this.notifyProgress({
        phase: "push",
        current: pushed,
        total: pendingItems.length,
        message: "Mengirim perubahan...",
      });

      console.log(
        `[SyncManager] Pushed ${pushed} changes, ${conflicts} conflicts`
      );
      return { pushed, conflicts };
    } catch (error) {
      console.error("[SyncManager] Push failed:", error);
      throw error;
    }
  }

  // ============================================================
  // PULL CHANGES FROM SERVER
  // ============================================================

  private async pullChanges(): Promise<{ pulled: number }> {
    const deviceId = sqliteService.getDeviceId();

    try {
      const response = await syncApiClient.pullChanges({
        since: this.lastPullTimestamp || "1970-01-01T00:00:00.000Z",
        exclude_device: deviceId,
        limit: 100,
      });

      if (!response.success) {
        // Log the actual error for debugging
        console.error("[SyncManager] Pull response:", response);
        throw new Error(
          "Pull failed: " + ((response as any).error || "Unknown error")
        );
      }

      let pulled = 0;

      // Process each table's changes
      if (response.changes) {
        for (const [tableName, changes] of Object.entries(response.changes)) {
          if (Array.isArray(changes)) {
            for (const change of changes) {
              await this.applyChange(tableName, change);
              pulled++;
            }
          }
        }
      }

      // Update last pull timestamp
      if (response.server_time) {
        this.lastPullTimestamp = response.server_time;
        await sqliteService.setSetting(
          "last_pull_timestamp",
          response.server_time
        );
      }

      // Notify progress
      this.notifyProgress({
        phase: "pull",
        current: pulled,
        total: pulled,
        message: "Menerima perubahan...",
      });

      if (response.has_more) {
        console.log(
          "[SyncManager] More changes available, will pull in next cycle"
        );
      }

      console.log(`[SyncManager] Pulled ${pulled} changes`);
      return { pulled };
    } catch (error) {
      console.error("[SyncManager] Pull failed:", error);
      throw error;
    }
  }

  private async applyChange(tableName: string, change: any): Promise<void> {
    if (change.operation === "DELETE") {
      // Soft delete locally
      await sqliteService.run(
        `UPDATE ${tableName} SET deleted_at = ?, sync_status = 'synced' WHERE server_id = ?`,
        [change.data?.deleted_at || new Date().toISOString(), change.server_id]
      );
    } else {
      // Check if record exists by server_id
      const existing = await sqliteService.getRecordByServerId(
        tableName,
        change.server_id
      );

      if (existing) {
        // Update existing record (but only if server version is newer)
        if (change.version > (existing as any).version) {
          await this.updateLocalRecord(
            tableName,
            (existing as any).id,
            change.data,
            change.version
          );
        }
      } else {
        // Check if we have it by client_id (race condition)
        const byClientId = await sqliteService.getFirst(
          `SELECT * FROM ${tableName} WHERE id = ?`,
          [change.client_id]
        );

        if (byClientId) {
          // Update with server_id
          await this.updateLocalRecord(
            tableName,
            (byClientId as any).id,
            {
              ...change.data,
              server_id: change.server_id,
            },
            change.version
          );
        } else {
          // Insert new record from other device
          await this.insertRemoteRecord(tableName, change);
        }
      }
    }
  }

  private async updateLocalRecord(
    tableName: string,
    id: string,
    data: any,
    version: number
  ): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    // Build update statement dynamically
    for (const [key, value] of Object.entries(data)) {
      if (key !== "id" && key !== "dibuat") {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }

    fields.push(`version = ?`, `sync_status = 'synced'`);
    values.push(version, id);

    await sqliteService.run(
      `UPDATE ${tableName} SET ${fields.join(", ")} WHERE id = ?`,
      values
    );
  }

  private async insertRemoteRecord(
    tableName: string,
    change: any
  ): Promise<void> {
    const data = {
      ...change.data,
      id: change.client_id || uuid.v4().toString(),
      server_id: change.server_id,
      version: change.version,
      sync_status: "synced",
    };

    const columns = Object.keys(data);
    const placeholders = columns.map(() => "?").join(", ");
    const values = Object.values(data);

    await sqliteService.run(
      `INSERT OR REPLACE INTO ${tableName} (${columns.join(
        ", "
      )}) VALUES (${placeholders})`,
      values
    );
  }

  // ============================================================
  // STATUS MANAGEMENT
  // ============================================================

  private updateStatus(status: SyncStatusType): void {
    this.currentState.status = status;
    this.notifyStatusChange();
  }

  private async updatePendingCount(): Promise<void> {
    this.currentState.pendingCount = await sqliteService.getSyncQueueCount();
  }

  private notifyStatusChange(): void {
    for (const listener of this.statusListeners) {
      listener(this.currentState.status);
    }
  }

  private notifyProgress(progress: SyncProgress): void {
    for (const listener of this.progressListeners) {
      listener(progress);
    }
  }

  // ============================================================
  // PUBLIC API - Status Getters
  // ============================================================

  getStatus(): SyncStatusType {
    return this.currentState.status;
  }

  getIsOnline(): boolean {
    return this.currentState.isOnline;
  }

  getLastSyncTime(): string | null {
    return this.currentState.lastSyncTime;
  }

  getPendingCount(): number {
    return this.currentState.pendingCount;
  }

  getFullState(): SyncManagerState {
    return { ...this.currentState };
  }

  // ============================================================
  // PUBLIC API - Subscriptions
  // ============================================================

  /**
   * Subscribe to status changes
   * @returns unsubscribe function
   */
  subscribe(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    // Immediately notify with current state
    listener(this.currentState.status);
    return () => this.statusListeners.delete(listener);
  }

  /**
   * Subscribe to sync progress updates
   * @returns unsubscribe function
   */
  subscribeProgress(listener: ProgressListener): () => void {
    this.progressListeners.add(listener);
    return () => this.progressListeners.delete(listener);
  }

  // ============================================================
  // PUBLIC API - Actions
  // ============================================================

  async forceSync(): Promise<void> {
    console.log("[SyncManager] Force sync requested");
    await this.performSync();
  }

  async retryFailed(): Promise<void> {
    console.log("[SyncManager] Retrying failed items...");
    await sqliteService.retryFailedSyncItems();
    await this.updatePendingCount();
    this.notifyStatusChange();

    if (this.currentState.isOnline) {
      await this.performSync();
    }
  }

  async clearQueue(): Promise<void> {
    console.log("[SyncManager] Clearing sync queue...");
    await sqliteService.clearAllSyncQueue();
    await this.updatePendingCount();
    this.updateStatus("idle");
  }

  async getStats(): Promise<SyncStats> {
    const dbStats = await sqliteService.getSyncStats();
    return {
      lastSync: dbStats.lastSync,
      totalPushed: dbStats.totalPushed,
      totalPulled: dbStats.totalPulled,
      totalConflicts: dbStats.totalConflicts,
      failedAttempts: 0,
    };
  }

  // ============================================================
  // DEVICE REGISTRATION (PUBLIC)
  // ============================================================

  async registerDevice(
    name: string,
    type: "kasir" | "dapur" | "admin"
  ): Promise<boolean> {
    try {
      const result = await syncApiClient.registerDevice(name, type);

      if (result.success && result.apiKey) {
        await sqliteService.saveDeviceInfo({
          deviceName: name,
          deviceType: type,
          apiKey: result.apiKey,
        });

        console.log("[SyncManager] Device registered successfully");
        return true;
      }

      return false;
    } catch (error) {
      console.error("[SyncManager] Device registration failed:", error);
      return false;
    }
  }

  async isDeviceRegistered(): Promise<boolean> {
    const info = await sqliteService.getDeviceInfo();
    return !!info?.api_key;
  }

  // ============================================================
  // CLEANUP
  // ============================================================

  stop(): void {
    console.log("[SyncManager] Stopping...");
    this.stopPolling();

    if (this.netInfoUnsubscribe) {
      this.netInfoUnsubscribe();
      this.netInfoUnsubscribe = null;
    }

    this.statusListeners.clear();
    this.progressListeners.clear();
    this.isInitialized = false;
  }
}

// Export singleton instance
export const syncManager = new SyncManager();
