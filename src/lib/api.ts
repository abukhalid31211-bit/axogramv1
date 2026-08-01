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
  classification: string;
  proxy_id?: number | null;
  pool_id?: number | null;
  groups_count: number;
  health_score: number;
  gather_count: number;
  add_count: number;
  dm_count: number;
  flood_waits_count: number;
  telegram_created_at?: string | null;
  data_center?: string | null;
  device_model?: string | null;
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

// ---------- Campaigns ----------
export type CampaignRecord = {
  id: number;
  name: string;
  kind: string;
  status: string;
  progress: number;
  total: number;
  sent: number;
  created_at: string;
  updated_at: string;
};

export type CampaignStats = {
  total: number;
  active: number;
  paused: number;
  done: number;
  drafts: number;
  dm: number;
  group: number;
  total_sent: number;
};

export type MessageTemplateRecord = {
  id: number;
  name: string;
  kind: string;
  message_kind: string;
  category?: string | null;
  content: string;
  last_used_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type CampaignScheduleRecord = {
  id: number;
  campaign_id?: number | null;
  campaign_name: string;
  kind: string;
  pattern: string;
  next_run?: string | null;
  runs: number;
  status: string;
  created_at: string;
};

// ---------- Rotation ----------
export type RotationSettings = Record<string, string>;
export type RotationProfile = {
  id: string;
  name: string;
  icon: string;
  lines: string[];
  delay_min: number;
  delay_max: number;
  switch_ops: number;
  rest_after: number;
  daily_add_limit: number;
};
export type RotationAnalytics = {
  switches_today: number;
  switches_week: number;
  avg_ops_before_switch: number;
  switch_reasons: Record<string, number>;
  last_switch_at?: string | null;
};
export type RotationLogRecord = {
  from_phone: string;
  to_phone: string;
  reason: string;
  switched_at: string;
};

// ---------- Security ----------
export type SecurityStatus = {
  general_status: string;
  score: number;
  active_alerts: number;
  blocked_today: number;
  flood_waits_today: number;
};
export type SecurityAuditResult = {
  score: number;
  excellent: number;
  warnings: number;
  critical: number;
  items: Array<{ check: string; status: string; recommendation?: string | null }>;
  generated_at: string;
};
export type DeviceSession = {
  account_id?: number | null;
  phone: string;
  hash?: string | null;
  device: string;
  app: string;
  ip: string;
  last_active: string;
  suspicious: boolean;
  current?: boolean;
};
export type SecurityEventRecord = {
  id: number;
  event_type: string;
  level: string;
  account_id?: number | null;
  message: string;
  details_json?: string | null;
  created_at: string;
};
export type SecurityReport = {
  date: string;
  flood_waits: number;
  bans: number;
  restrictions: number;
  suspicious: number;
  alerts: number;
  score: number;
};

// ---------- Proxy pools / stats ----------
export type ProxyPoolRecord = {
  id: number;
  name: string;
  description?: string | null;
  purpose: string;
  created_at: string;
  updated_at: string;
};
export type ProxyStats = {
  total: number;
  active: number;
  dead: number;
  slow: number;
  avg_speed_ms: number;
  by_type: Record<string, number>;
  fastest?: number | null;
  slowest?: number | null;
};

// ---------- Reports extras ----------
export type AccountPerformance = {
  account_id: number;
  phone: string;
  gather: number;
  add: number;
  dm: number;
  success_rate: number;
  flood_waits: number;
};
export type LeaderboardRow = {
  rank: number;
  account_id: number;
  phone: string;
  value: number;
  metric: string;
};

// ---------- Job runs (unified) ----------
export type JobRun = {
  id: string;
  kind: string;
  label: string;
  status: "queued" | "running" | "paused" | "cancelled" | "done" | "failed";
  control: string;
  progress: number;
  current_step?: string | null;
  progress_json?: string | null;
  result_json?: string | null;
  error?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  created_by?: number | null;
  created_at: string;
  started_at?: string | null;
  ended_at?: string | null;
  updated_at: string;
};

export type JobRunStatus = {
  job_id: string;
  status: string;
  progress: number;
  current_step?: string | null;
  kind?: string;
  label?: string;
  result?: Record<string, unknown> | null;
  error?: string | null;
  enqueued_at?: string | null;
  ended_at?: string | null;
};

// ---------- Account pools ----------
export type AccountPool = {
  id: number;
  name: string;
  description?: string | null;
  purpose: string;
  created_at: string;
  updated_at: string;
  accounts?: AccountRecord[];
};

export type AccountSettings = {
  account_id: number;
  gather_limit: number;
  add_limit: number;
  dm_limit: number;
  delay_min: number;
  delay_max: number;
  priority: string;
  allow_gather: boolean;
  allow_add: boolean;
  allow_dm: boolean;
  allow_campaign: boolean;
  allow_rotation: boolean;
  limit_work_hours: boolean;
  work_hours_from: string;
  work_hours_to: string;
};

// ---------- Groups ----------
export type GroupRecord = {
  id: number;
  name: string;
  group_type: string;
  members_count: number;
  category_id?: number | null;
  category_name?: string | null;
  account_id?: number | null;
  account_phone?: string | null;
  status: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
};

export type GroupCategory = {
  id: number;
  name: string;
  description?: string | null;
  groups_count: number;
  created_at: string;
};

export type GroupBlacklistEntry = {
  id: number;
  group_value: string;
  reason?: string | null;
  created_by?: number | null;
  created_at: string;
};

export type GroupStats = {
  total_groups: number;
  total_members: number;
  by_type: Record<string, number>;
  by_status: Record<string, number>;
  by_category: Record<string, number>;
  largest: Array<{ name: string; members: number }>;
  joined_today: number;
};

// ---------- Notification events ----------
export type NotificationEvent = {
  id: number;
  event_type: string;
  level: string;
  title: string;
  message: string;
  details_json?: string | null;
  delivery_status: string;
  delivery_error?: string | null;
  created_at: string;
  sent_at?: string | null;
};

// ---------- Reports ----------
export type TodayReport = {
  date: string;
  gathered_today: number;
  added_today: number;
  add_failed_today: number;
  dm_today: number;
  group_today: number;
  flood_today: number;
  accounts_total: number;
  accounts_active: number;
  proxies_total: number;
  proxies_active: number;
  campaigns_active: number;
  campaigns_sent_today: number;
  total_operations_today: number;
  compare_yesterday_pct?: number | null;
  best_account?: { account_id: number; phone: string; operations: number } | null;
  bans_today: number;
};

export type WeekReport = {
  days: Array<{ date: string; gathered: number; added: number; dm: number; group: number; flood: number }>;
  totals: { gathered: number; added: number; dm: number; group: number; flood: number };
  best_day: string;
};

export type RotationLive = {
  active_jobs: Array<{ id: string; kind: string; label: string; status: string; progress: number; current_step?: string | null; created_at: string }>;
  usage: Array<{ account_id: number; phone: string; name: string; status: string; gather: number; add: number; dm: number; group: number; total: number; flood_waits: number }>;
  active_accounts: number;
  total_accounts: number;
};

export type CampaignProgress = {
  campaign_id: number;
  status: string;
  progress: number;
  sent: number;
  total: number;
  last_error?: string | null;
  job_status?: string | null;
  job_current_step?: string | null;
  job_id?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
};

export type CampaignReport = {
  campaign_id: number;
  campaign_name: string;
  success: number;
  skipped: number;
  failed: number;
  total: number;
  failure_reasons: Record<string, number>;
  per_account: Record<string, { sent: number; failed: number; flood: number }>;
  failed_items: Array<string | Record<string, unknown>>;
  duration_minutes: number;
  generated_at: string;
};

export type GatherTemplate = {
  id: number;
  name: string;
  source_label: string;
  source_type: string;
  extract_mode: string;
  limit: number;
  category?: string | null;
  created_at: string;
};

export type SystemInfo = {
  version: string;
  python: string;
  os: string;
  cpu: string;
  ram: string;
  storage_disk: string;
  storage_files: number;
  storage_size: string;
  uptime: string;
  database: string;
  counts: Record<string, number>;
};

export type BanMonitorStatus = {
  enabled: boolean;
  interval_minutes: number;
  action: string;
  last_run?: string | null;
};
