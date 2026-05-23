// services/SyncApiClient.ts - API Client untuk komunikasi dengan server sync
import { SYNC_CONFIG } from "../config/sync.config";
import type {
  SyncPullParams,
  SyncPullResponse,
  SyncPushRequest,
  SyncPushResponse,
} from "../types/sync";

class SyncApiClient {
  private baseUrl: string;
  private timeout: number;

  constructor() {
    this.baseUrl = SYNC_CONFIG.SERVER_URL;
    this.timeout = SYNC_CONFIG.REQUEST_TIMEOUT;
  }

  setServerUrl(url: string): void {
    this.baseUrl = url;
  }

  private async getHeaders(): Promise<HeadersInit> {
    // Import dynamically to avoid circular dependency
    const { sqliteService } = await import("../database/SQLiteService");
    const deviceId = sqliteService.getDeviceId();
    const deviceInfo = await sqliteService.getDeviceInfo();
    return {
      "Content-Type": "application/json",
      "X-Device-ID": deviceId,
      "X-API-Key": deviceInfo?.api_key || "",
    };
  }

  async healthCheck(): Promise<{ status: string; serverTime: string }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseUrl}/health`, {
        method: "GET",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.json();
    } catch (error) {
      console.error("[SyncApiClient] Health check failed:", error);
      return { status: "unhealthy", serverTime: "" };
    }
  }

  async isServerAvailable(): Promise<boolean> {
    try {
      const result = await this.healthCheck();
      return result.status === "healthy";
    } catch {
      return false;
    }
  }

  async registerDevice(
    deviceName: string,
    deviceType: string
  ): Promise<{ success: boolean; apiKey: string; deviceId: string }> {
    try {
      const { sqliteService } = await import("../database/SQLiteService");
      const deviceId = sqliteService.getDeviceId();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseUrl}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device_id: deviceId,
          device_name: deviceName,
          device_type: deviceType,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const result = await response.json();

      if (result.success && result.api_key) {
        await sqliteService.saveDeviceInfo({
          deviceName,
          deviceType,
          apiKey: result.api_key,
        });
      }

      return {
        success: result.success,
        apiKey: result.api_key,
        deviceId: result.device_id,
      };
    } catch (error) {
      console.error("[SyncApiClient] Register device failed:", error);
      return { success: false, apiKey: "", deviceId: "" };
    }
  }

  async verifyDevice(): Promise<{ valid: boolean; device?: any }> {
    try {
      const headers = await this.getHeaders();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseUrl}/auth/verify`, {
        method: "POST",
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.json();
    } catch (error) {
      console.error("[SyncApiClient] Verify device failed:", error);
      return { valid: false };
    }
  }

  async pushChanges(request: SyncPushRequest): Promise<SyncPushResponse> {
    try {
      const headers = await this.getHeaders();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout * 3); // Longer timeout for push

      const response = await fetch(`${this.baseUrl}/sync/push`, {
        method: "POST",
        headers,
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.json();
    } catch (error) {
      console.error("[SyncApiClient] Push changes failed:", error);
      return {
        success: false,
        batch_id: request.batch_id,
        processed_at: new Date().toISOString(),
        results: [],
        conflicts: [],
      };
    }
  }

  async pullChanges(params: SyncPullParams): Promise<SyncPullResponse> {
    try {
      const headers = await this.getHeaders();
      const url = new URL(`${this.baseUrl}/sync/pull`);
      url.searchParams.set("since", params.since);
      if (params.tables) url.searchParams.set("tables", params.tables);
      if (params.limit) url.searchParams.set("limit", String(params.limit));
      if (params.exclude_device)
        url.searchParams.set("exclude_device", params.exclude_device);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout * 2);

      const response = await fetch(url.toString(), {
        method: "GET",
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.json();
    } catch (error) {
      console.error("[SyncApiClient] Pull changes failed:", error);
      return {
        success: false,
        server_time: new Date().toISOString(),
        has_more: false,
        changes: {},
      };
    }
  }

  async getSyncStatus(): Promise<any> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${this.baseUrl}/sync/status`, {
        method: "GET",
        headers,
      });
      return response.json();
    } catch (error) {
      console.error("[SyncApiClient] Get sync status failed:", error);
      return null;
    }
  }

  async getMasterData(): Promise<any> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${this.baseUrl}/master/all`, {
        method: "GET",
        headers,
      });
      return response.json();
    } catch (error) {
      console.error("[SyncApiClient] Get master data failed:", error);
      return null;
    }
  }
}

export const syncApiClient = new SyncApiClient();
export default syncApiClient;
