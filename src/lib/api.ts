const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1";
const TOKEN_STORAGE_KEY = "axogram_token";

export type ApiError = Error & { status?: number };

export function getStoredToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
  else localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export async function apiFetch<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const authToken = token ?? getStoredToken();
  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const data = await response.json();
      message = data.detail || data.message || message;
    } catch {
      // ignore JSON parse failure
    }
    const err: ApiError = new Error(message);
    err.status = response.status;
    throw err;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json() as Promise<T>;
  }

  return response.text() as unknown as T;
}

export async function downloadApiFile(path: string, filename: string, token?: string | null) {
  const headers = new Headers();
  const authToken = token ?? getStoredToken();
  if (authToken) headers.set("Authorization", `Bearer ${authToken}`);
  const response = await fetch(`${API_BASE_URL}${path}`, { headers });
  if (!response.ok) {
    throw new Error(`Download failed with status ${response.status}`);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export type DashboardSummary = {
  accounts_total: number;
  accounts_active: number;
  proxies_total: number;
  proxies_active: number;
  campaigns_active: number;
  campaigns_total: number;
  last_activity_at: string | null;
};

export type AccountRecord = {
  id: number;
  phone: string;
  name: string;
  username?: string | null;
  status: "active" | "blocked" | "restricted";
  proxy_id?: number | null;
  groups_count: number;
  age_label?: string | null;
  last_used_label?: string | null;
  notes?: string | null;
  session_file_path?: string | null;
  telegram_user_id?: string | null;
  created_at: string;
  updated_at: string;
};

export type ProxyRecord = {
  id: number;
  address: string;
  proxy_type: string;
  status: "active" | "dead" | "slow";
  speed_ms?: number | null;
  auth_login?: string | null;
  auth_password?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
};

export type ActivityLogRecord = {
  id: number;
  level: string;
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  message: string;
  details_json?: string | null;
  actor_user_id?: number | null;
  created_at: string;
};

export type TelegramStatus = {
  configured: boolean;
  has_api_id: boolean;
  has_api_hash: boolean;
  sessions_path: string;
};

export type TelegramRequestCodeResponse = {
  message: string;
  phone: string;
  session_path: string;
};

export type TelegramVerifyCodeResponse = {
  message: string;
  needs_password: boolean;
  account?: AccountRecord | null;
};

export type TelegramAuthSessionRecord = {
  id: number;
  phone: string;
  session_file_path?: string | null;
  status: string;
  needs_password: boolean;
  error_message?: string | null;
  account_id?: number | null;
  created_at: string;
  updated_at: string;
};

export type JobStartResponse = {
  mode: "queued" | "finished";
  message: string;
  job_id?: string | null;
  result?: Record<string, unknown> | null;
};

export type JobStatusResponse = {
  job_id: string;
  status: string;
  result?: Record<string, unknown> | null;
  error?: string | null;
  enqueued_at?: string | null;
  ended_at?: string | null;
};

export type AccountValidationResult = {
  summary: {
    total: number;
    active: number;
    blocked: number;
    restricted: number;
  };
  rows: Array<{
    account_id: number;
    phone: string;
    name: string;
    status: "active" | "blocked" | "restricted";
    reason: string;
    last_checked: string;
  }>;
  generated_at: string;
};

export type WarmupResult = {
  summary: {
    target_count: number;
    days: number;
    intensity: string;
  };
  steps: Array<{
    phone: string;
    action: string;
    result: string;
  }>;
  generated_at: string;
};

export type GatherExportRecord = {
  id: number;
  source_label: string;
  source_type: string;
  file_name: string;
  file_path: string;
  member_count: number;
  status: string;
  notes?: string | null;
  created_by?: number | null;
  created_at: string;
};

export type GatherStats = {
  total_exports: number;
  total_members: number;
  latest_export_at?: string | null;
};

export type GatherExtractResult = {
  export_id: number;
  file_name: string;
  member_count: number;
  source_label: string;
  execution_mode?: string;
  warning?: string | null;
  generated_at: string;
};

export type GatherMergeResult = {
  export_id: number;
  file_name: string;
  input_count: number;
  member_count: number;
  deduplicated: boolean;
  generated_at: string;
};

export type AddOperationRecord = {
  id: number;
  source_label: string;
  source_type: string;
  target_label: string;
  method: string;
  status: string;
  total_count: number;
  success_count: number;
  skipped_count: number;
  failed_count: number;
  details_json?: string | null;
  created_by?: number | null;
  created_at: string;
};

export type AddStats = {
  total_operations: number;
  total_success: number;
  total_failed: number;
  total_skipped: number;
  latest_operation_at?: string | null;
};

export type BlacklistEntryRecord = {
  id: number;
  user_value: string;
  reason?: string | null;
  created_by?: number | null;
  created_at: string;
};

export type AddResult = {
  operation_id: number;
  total_count: number;
  success_count: number;
  skipped_count: number;
  failed_count: number;
  source_label: string;
  target_label: string;
  generated_at: string;
};

export type SettingItem = {
  key: string;
  value: string | null;
  is_secret: boolean;
  description?: string | null;
  updated_at: string;
};

export type AuthUser = {
  id: number;
  username: string;
  full_name?: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
};

export type LoginResponse = {
  access_token: string;
  token_type: string;
  user: AuthUser;
};
