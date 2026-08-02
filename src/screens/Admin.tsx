import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Crown, Users, UserPlus, Gem, Activity, Megaphone, ScrollText, Siren,
  Copy, RefreshCw, Pause, Play, Eye, Trash2, KeyRound, Search,
} from "lucide-react";
import {
  Alert, Button, Checkbox, ConfirmDialog, EmptyState, Field, PageHeader,
  SearchInput, SectionTitle, Spinner, StatCard, Table, TextArea, useToast,
} from "../ui";
import {
  apiFetch, downloadApiFile,
  type AdminLogEntry, type AdminModuleInfo, type AdminStats,
  type PlanRecord, type SubscriberDetail, type SubscriberRecord, type UsageRow,
} from "../lib/api";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const QUOTA_FIELDS = [
  { key: "accounts_limit", label: "عدد الحسابات" },
  { key: "gather_daily", label: "تجميع يومي" },
  { key: "add_daily", label: "إضافة يومية" },
  { key: "dm_daily", label: "DM يومي" },
  { key: "group_daily", label: "قروبات يومي" },
  { key: "concurrent_jobs", label: "مهام متزامنة" },
];

const PERIOD_PRESETS = [7, 30, 90, 180, 365];

const STATUS_META: Record<string, { icon: string; label: string; cls: string }> = {
  active:        { icon: "🟢", label: "نشط",          cls: "border-brand-300 bg-brand-50 text-brand-700" },
  expiring_soon: { icon: "⏳", label: "ينتهي قريباً",  cls: "border-amber-300 bg-amber-50 text-amber-700" },
  expired:       { icon: "🔴", label: "منتهي",        cls: "border-danger-300 bg-danger-50 text-danger-700" },
  suspended:     { icon: "⏸️", label: "موقوف",        cls: "border-surface-400 bg-surface-100 text-surface-600" },
};

function StatusPill({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? STATUS_META.active;
  return <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-xs font-bold ${meta.cls}`}>{meta.icon} {meta.label}</span>;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ar-u-nu-latn", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.toLocaleDateString("ar-u-nu-latn")} ${d.toLocaleTimeString("ar-u-nu-latn", { hour: "2-digit", minute: "2-digit" })}`;
}

function randomPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 10; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// ---------------------------------------------------------------------------
// Shared form pieces
// ---------------------------------------------------------------------------

function ModuleMatrix({ all, selected, onToggle }: {
  all: AdminModuleInfo[];
  selected: string[];
  onToggle: (id: string, value: boolean) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {all.map((m) => {
        const checked = selected.includes(m.id);
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onToggle(m.id, !checked)}
            className={`rounded-xl border px-3 py-2.5 text-right text-sm font-bold transition ${
              checked ? "border-brand-400 bg-brand-50 text-brand-700" : "border-surface-200 bg-white text-surface-500 hover:border-surface-300"
            }`}
          >
            {checked ? "✅ " : "⬜ "}{m.label}
          </button>
        );
      })}
    </div>
  );
}

function QuotaFields({ values, onChange }: {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {QUOTA_FIELDS.map((f) => (
        <Field
          key={f.key}
          label={f.label}
          type="number"
          value={values[f.key] ?? ""}
          onChange={(v) => onChange(f.key, v)}
          placeholder="افتراضي النظام"
        />
      ))}
    </div>
  );
}

function quotasFromStrings(values: Record<string, string>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of QUOTA_FIELDS) {
    const raw = (values[f.key] ?? "").trim();
    if (raw === "") continue;
    const n = Math.max(0, Math.floor(Number(raw)));
    if (Number.isFinite(n)) out[f.key] = n;
  }
  return out;
}

function quotasToStrings(values: Record<string, number>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of QUOTA_FIELDS) out[f.key] = values[f.key] ? String(values[f.key]) : "";
  return out;
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export function AdminScreen({ sub, param }: { sub?: string; param?: string }) {
  const [tab, setTab] = useState(sub && sub !== "subscribers" ? sub : "subscribers");
  const [selectedId, setSelectedId] = useState<number | null>(param ? Number(param) : null);
  const [modules, setModules] = useState<AdminModuleInfo[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    apiFetch<AdminModuleInfo[]>("/admin/modules").then(setModules).catch(() => undefined);
    apiFetch<AdminStats>("/admin/stats").then(setStats).catch(() => undefined);
  }, []);

  const openCard = (id: number) => {
    setSelectedId(id);
    setTab("card");
  };

  const tabs = [
    { id: "subscribers", label: "👥 المشتركين" },
    { id: "create", label: "➕ إنشاء مشترك" },
    ...(selectedId != null ? [{ id: "card", label: "👤 بطاقة المشترك" }] : []),
    { id: "plans", label: "💎 الباقات" },
    { id: "usage", label: "📊 مراقبة الاستخدام" },
    { id: "api", label: "🔑 إعدادات API" },
    { id: "broadcast", label: "📢 بثّ إشعار" },
    { id: "logs", label: "🧾 سجل العمليات" },
    { id: "emergency", label: "🚨 طوارئ" },
  ];

  return (
    <div className="animate-fade">
      <PageHeader title="لوحة الإدارة 👑" subtitle="إدارة المشتركين والباقات والحدود والاشتراكات" icon={<Crown className="h-6 w-6 text-amber-500" />} />

      {stats && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <button onClick={() => setTab("subscribers")} className="text-right"><StatCard label="إجمالي" value={stats.total} icon={<Users className="h-4 w-4" />} tone="accent" /></button>
          <StatCard label="🟢 نشط" value={stats.active} tone="brand" />
          <StatCard label="⏳ ينتهي قريباً" value={stats.expiring_soon} tone="warn" />
          <StatCard label="🔴 منتهي" value={stats.expired} tone="danger" />
          <StatCard label="⏸️ موقوف" value={stats.suspended} tone="accent" />
        </div>
      )}

      <div className="mb-5 flex flex-wrap gap-1.5 rounded-xl border border-surface-200 bg-surface-100 p-1.5">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
              tab === t.id ? "border border-surface-200 bg-white text-amber-600 shadow-soft" : "text-surface-500 hover:bg-surface-200 hover:text-surface-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "subscribers" && <SubscribersTab onOpenCard={openCard} onStatsChange={setStats} />}
      {tab === "create" && <CreateTab modules={modules} onCreated={(id) => openCard(id)} />}
      {tab === "card" && selectedId != null && (
        <SubscriberCardTab
          key={selectedId}
          id={selectedId}
          modules={modules}
          onDeleted={() => { setSelectedId(null); setTab("subscribers"); }}
          onStatsChange={setStats}
        />
      )}
      {tab === "plans" && <PlansTab modules={modules} />}
      {tab === "usage" && <UsageTab />}
      {tab === "api" && <ApiTab />}
      {tab === "broadcast" && <BroadcastTab />}
      {tab === "logs" && <LogsTab />}
      {tab === "emergency" && <EmergencyTab />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1) Subscribers list
// ---------------------------------------------------------------------------

function SubscribersTab({ onOpenCard, onStatsChange }: {
  onOpenCard: (id: number) => void;
  onStatsChange: (s: AdminStats) => void;
}) {
  const toast = useToast();
  const [rows, setRows] = useState<SubscriberRecord[] | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const load = useCallback(() => {
    apiFetch<SubscriberRecord[]>("/admin/subscribers").then(setRows).catch((e) => toast.show(e.message || "تعذر التحميل", "danger"));
    apiFetch<AdminStats>("/admin/stats").then(onStatsChange).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => load(), [load]);

  const filtered = useMemo(() => {
    let out = rows ?? [];
    if (filter !== "all") out = out.filter((r) => r.status === filter);
    const q = search.trim().toLowerCase();
    if (q) out = out.filter((r) => r.email.toLowerCase().includes(q) || (r.plan_name ?? "").includes(q));
    return out;
  }, [rows, filter, search]);

  const quick = async (id: number, action: "suspend" | "resume" | "extend30") => {
    try {
      if (action === "extend30") {
        await apiFetch(`/admin/subscribers/${id}/extend`, { method: "POST", body: JSON.stringify({ days: 30 }) });
        toast.show("تمت إضافة 30 يوم ✅");
      } else {
        await apiFetch(`/admin/subscribers/${id}/${action}`, { method: "POST" });
        toast.show(action === "suspend" ? "تم إيقاف المشترك ⏸️" : "تم تفعيل المشترك ▶️");
      }
      load();
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "فشل الإجراء", "danger");
    }
  };

  if (!rows) return <Spinner label="جاري تحميل المشتركين..." />;

  return (
    <div className="space-y-4">
      <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="flex-1"><SearchInput value={search} onChange={setSearch} placeholder="البحث عبر البريد أو الباقة..." /></div>
        <div className="flex flex-wrap gap-1.5">
          {[
            ["all", "الكل"],
            ["active", "🟢 نشط"],
            ["expiring_soon", "⏳ ينتهي قريباً"],
            ["expired", "🔴 منتهي"],
            ["suspended", "⏸️ موقوف"],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${filter === id ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-500 hover:bg-surface-200"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 && (
        <EmptyState icon={<Search className="h-8 w-8" />} title="لا يوجد مشتركين" desc="أنشئ أول مشترك من تبويب «إنشاء مشترك»" />
      )}

      {filtered.length > 0 && (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>البريد</th>
                  <th>الحالة</th>
                  <th>المتبقي</th>
                  <th>الباقة</th>
                  <th>الحدود</th>
                  <th>آخر دخول</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="cursor-pointer" onClick={() => onOpenCard(r.id)}>
                    <td>
                      <div className="font-bold text-surface-800" dir="ltr">{r.email}</div>
                      <div className="text-xs text-surface-400">{r.accounts_count} حساب • مسجّل {formatDate(r.created_at)}</div>
                    </td>
                    <td><StatusPill status={r.status} /></td>
                    <td className="text-xs font-bold text-surface-600">{r.remaining_label ?? "بدون انتهاء"}</td>
                    <td className="text-xs text-surface-600">{r.plan_name ?? "مخصصة"}</td>
                    <td className="text-xs text-surface-400">
                      {Object.entries(r.quotas).filter(([, v]) => v > 0).map(([k, v]) => `${QUOTA_FIELDS.find((f) => f.key === k)?.label ?? k}: ${v}`).join(" • ") || "افتراضية"}
                    </td>
                    <td className="text-xs text-surface-400">{r.last_login ? formatDateTime(r.last_login) : "لم يدخل"}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        {r.suspended ? (
                          <button title="تفعيل" onClick={() => quick(r.id, "resume")} className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-600 transition hover:bg-brand-100"><Play className="h-4 w-4" /></button>
                        ) : (
                          <button title="إيقاف" onClick={() => quick(r.id, "suspend")} className="grid h-8 w-8 place-items-center rounded-lg bg-amber-50 text-amber-600 transition hover:bg-amber-100"><Pause className="h-4 w-4" /></button>
                        )}
                        <button title="+30 يوم" onClick={() => quick(r.id, "extend30")} className="rounded-lg bg-accent-50 px-2 py-1.5 text-xs font-bold text-accent-600 transition hover:bg-accent-100">+30 يوم</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {toast.node}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2) Create subscriber
// ---------------------------------------------------------------------------

function CreateTab({ modules, onCreated }: { modules: AdminModuleInfo[]; onCreated: (id: number) => void }) {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(randomPassword());
  const [days, setDays] = useState("30");
  const [customDays, setCustomDays] = useState("");
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [quotaValues, setQuotaValues] = useState<Record<string, string>>({});
  const [planName, setPlanName] = useState<string | null>(null);
  const [plans, setPlans] = useState<PlanRecord[]>([]);
  const [saving, setSaving] = useState(false);
  const [credentials, setCredentials] = useState<{ email: string; password: string; days: number } | null>(null);

  useEffect(() => {
    apiFetch<PlanRecord[]>("/admin/plans").then(setPlans).catch(() => undefined);
  }, []);

  const effectiveDays = customDays.trim() !== "" ? Number(customDays) : Number(days);
  const expiresPreview = useMemo(() => {
    if (!Number.isFinite(effectiveDays) || effectiveDays <= 0) return "—";
    const d = new Date(Date.now() + effectiveDays * 86400_000);
    return d.toLocaleDateString("ar-u-nu-latn", { year: "numeric", month: "2-digit", day: "2-digit" });
  }, [effectiveDays]);

  const applyPlan = (plan: PlanRecord) => {
    setPlanName(plan.name);
    setSelectedModules(plan.modules);
    setQuotaValues(quotasToStrings(plan.quotas));
    toast.show(`تم تطبيق باقة ${plan.name}`);
  };

  const toggleModule = (id: string, value: boolean) => {
    setPlanName(null);
    setSelectedModules((prev) => (value ? [...new Set([...prev, id])] : prev.filter((m) => m !== id)));
  };

  const copyCredentials = () => {
    const text = credentials
      ? `بيانات دخولك إلى Axogram Pro:\nالبريد: ${credentials.email}\nكلمة المرور: ${credentials.password}\nمدة الاشتراك: ${credentials.days} يوم`
      : "";
    void navigator.clipboard?.writeText(text).then(() => toast.show("تم نسخ بيانات الدخول ✅")).catch(() => toast.show("انسخها يدوياً", "info"));
  };

  const submit = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.includes("@") || !cleanEmail.includes(".")) {
      toast.show("أدخل بريداً إلكترونياً صالحاً", "danger");
      return;
    }
    if (password.length < 4) {
      toast.show("كلمة المرور قصيرة (4+ أحرف)", "danger");
      return;
    }
    if (!Number.isFinite(effectiveDays) || effectiveDays < 1) {
      toast.show("أدخل مدة اشتراك صحيحة بالأيام", "danger");
      return;
    }
    setSaving(true);
    try {
      const created = await apiFetch<SubscriberRecord>("/admin/subscribers", {
        method: "POST",
        body: JSON.stringify({
          email: cleanEmail,
          password,
          period_days: effectiveDays,
          modules: selectedModules,
          quotas: quotasFromStrings(quotaValues),
          plan_name: planName,
        }),
      });
      setCredentials({ email: cleanEmail, password, days: effectiveDays });
      toast.show("تم إنشاء المشترك ✅");
      setTimeout(() => { if (!document.hidden) onCreated(created.id); }, 6500);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "فشل الإنشاء", "danger");
    } finally {
      setSaving(false);
    }
  };

  const credentialsText = credentials
    ? `بيانات دخولك إلى Axogram Pro:\nالبريد: ${credentials.email}\nكلمة المرور: ${credentials.password}\nمدة الاشتراك: ${credentials.days} يوم`
    : null;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <div className="card space-y-4 p-5">
          <SectionTitle icon={<UserPlus className="h-4 w-4" />}>بيانات الدخول (تحددها الإدارة فقط)</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="البريد الإلكتروني" type="email" value={email} onChange={setEmail} placeholder="client@email.com" />
            <div>
              <Field label="كلمة المرور" value={password} onChange={setPassword} />
              <div className="mt-1.5 flex gap-1.5">
                <button onClick={() => setPassword(randomPassword())} className="rounded-lg bg-surface-100 px-2.5 py-1 text-xs font-bold text-surface-600 transition hover:bg-surface-200">
                  🎲 توليد
                </button>
                <button
                  onClick={() => void navigator.clipboard?.writeText(password).then(() => toast.show("نُسخت ✅")).catch(() => undefined)}
                  className="rounded-lg bg-surface-100 px-2.5 py-1 text-xs font-bold text-surface-600 transition hover:bg-surface-200"
                >
                  <Copy className="inline h-3.5 w-3.5" /> نسخ
                </button>
              </div>
            </div>
          </div>
          <p className="text-xs text-surface-400">العميل لا يستطيع تغيير بريده أو كلمة مروره — أنت من يحددهما وتستطيع إعادة تعيينها من بطاقة المشترك.</p>
        </div>

        <div className="card space-y-3 p-5">
          <SectionTitle>⏱️ فترة الاشتراك (قيمة مخصصة من الإدارة)</SectionTitle>
          <div className="flex flex-wrap items-center gap-2">
            {PERIOD_PRESETS.map((d) => (
              <button
                key={d}
                onClick={() => { setDays(String(d)); setCustomDays(""); }}
                className={`rounded-xl border px-4 py-2 text-sm font-bold transition ${
                  customDays === "" && days === String(d) ? "border-brand-400 bg-brand-50 text-brand-700" : "border-surface-200 text-surface-500 hover:border-surface-300"
                }`}
              >
                {d} يوم
              </button>
            ))}
            <div className="w-32">
              <Field placeholder="أيام مخصصة" type="number" value={customDays} onChange={setCustomDays} />
            </div>
          </div>
          <div className="rounded-xl border border-surface-200 bg-surface-50 px-4 py-2.5 text-sm text-surface-600">
            ينتهي في: <span className="font-bold text-surface-800">{expiresPreview}</span> ({effectiveDays || 0} يوم)
          </div>
        </div>

        <div className="card space-y-3 p-5">
          <SectionTitle>🧩 الوحدات المسموحة</SectionTitle>
          {plans.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-surface-400">تعبئة سريعة بباقة:</span>
              {plans.map((p) => (
                <button
                  key={p.id}
                  onClick={() => applyPlan(p)}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                    planName === p.name ? "border-amber-400 bg-amber-50 text-amber-700" : "border-surface-200 text-surface-600 hover:border-surface-300"
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
          <ModuleMatrix all={modules} selected={selectedModules} onToggle={toggleModule} />
        </div>

        <div className="card space-y-3 p-5">
          <SectionTitle>⚖️ الحدود المخصصة</SectionTitle>
          <QuotaFields values={quotaValues} onChange={(k, v) => setQuotaValues((prev) => ({ ...prev, [k]: v }))} />
          <p className="text-xs text-surface-400">الحقل الفارغ يعني اتباع افتراضي النظام (بلا حد مخصص).</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="card space-y-3 p-5">
          <SectionTitle>🧾 الملخص</SectionTitle>
          <div className="space-y-1.5 text-sm text-surface-600">
            <div>البريد: <span className="font-bold text-surface-800" dir="ltr">{email || "—"}</span></div>
            <div>المدة: <span className="font-bold text-surface-800">{effectiveDays || 0} يوم</span></div>
            <div>الباقة: <span className="font-bold text-surface-800">{planName ?? "مخصصة"}</span></div>
            <div>الوحدات: <span className="font-bold text-surface-800">{selectedModules.length} من {modules.length}</span></div>
            <div>حدود مخصصة: <span className="font-bold text-surface-800">{Object.values(quotaValues).filter((v) => v.trim() !== "").length || "لا يوجد"}</span></div>
          </div>
          <Button variant="primary" className="w-full" disabled={saving} onClick={submit}>
            {saving ? "جاري الإنشاء..." : "💾 حفظ وإنشاء المشترك"}
          </Button>
        </div>

        {credentialsText && (
          <div className="card space-y-3 border-brand-300 bg-brand-50/50 p-5">
            <SectionTitle>✅ بيانات الدخول (تُعطى للعميل)</SectionTitle>
            <pre className="whitespace-pre-wrap rounded-xl border border-surface-200 bg-white p-3 text-xs leading-relaxed text-surface-700">{credentialsText}</pre>
            <Button variant="ghost" className="w-full" icon={<Copy className="h-4 w-4" />} onClick={copyCredentials}>نسخ بيانات الدخول</Button>
            <p className="text-xs text-surface-400">سيُفتح بطاقة المشترك خلال ثوانٍ — أو انسخ البيانات الآن.</p>
          </div>
        )}
      </div>
      {toast.node}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3) Subscriber card
// ---------------------------------------------------------------------------

function SubscriberCardTab({ id, modules, onDeleted, onStatsChange }: {
  id: number;
  modules: AdminModuleInfo[];
  onDeleted: () => void;
  onStatsChange: (s: AdminStats) => void;
}) {
  const toast = useToast();
  const [detail, setDetail] = useState<SubscriberDetail | null>(null);
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [quotaValues, setQuotaValues] = useState<Record<string, string>>({});
  const [extendDays, setExtendDays] = useState("");
  const [confirmAction, setConfirmAction] = useState<null | "suspend" | "resume">(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [viewAs, setViewAs] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [transferAccounts, setTransferAccounts] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    apiFetch<SubscriberDetail>(`/admin/subscribers/${id}`)
      .then((d) => {
        setDetail(d);
        setSelectedModules(d.modules);
        setQuotaValues(quotasToStrings(d.quotas));
      })
      .catch((e) => toast.show(e.message || "تعذر التحميل", "danger"));
    apiFetch<AdminStats>("/admin/stats").then(onStatsChange).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => load(), [load]);

  const act = async (fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(true);
    try {
      await fn();
      toast.show(okMsg);
      load();
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "فشل الإجراء", "danger");
    } finally {
      setBusy(false);
    }
  };

  if (!detail) return <Spinner label="جاري تحميل بطاقة المشترك..." />;

  const progress = (() => {
    if (detail.remaining_seconds == null) return null;
    if (detail.remaining_seconds <= 0) return 0;
    // Percent of a 365-day reference window for the bar.
    return Math.min(100, Math.max(3, Math.round((detail.remaining_seconds / (365 * 86400)) * 100)));
  })();

  const usageEntries = ["gather", "add", "dm", "group"].map((key) => {
    const limit = detail.quotas[`${key}_daily`] || 0;
    const used = detail.usage_today[key] || 0;
    return { key, label: { gather: "تجميع", add: "إضافة", dm: "DM", group: "قروبات" }[key]!, used, limit };
  });

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-extrabold text-surface-800" dir="ltr">{detail.email}</h2>
              <StatusPill status={detail.status} />
            </div>
            <div className="mt-1 text-xs text-surface-400">
              باقة: {detail.plan_name ?? "مخصصة"} • {detail.accounts_count} حساب • مسجّل {formatDate(detail.created_at)} • آخر دخول: {detail.last_login ? formatDateTime(detail.last_login) : "لم يدخل"}
            </div>
          </div>
          <div className="min-w-48 flex-1 sm:max-w-64">
            <div className="mb-1 flex items-center justify-between text-xs font-bold text-surface-500">
              <span>⏳ المتبقي من الاشتراك</span>
              <span className="text-surface-800">{detail.remaining_label ?? "بدون انتهاء"}</span>
            </div>
            {progress != null && (
              <div className="h-2.5 overflow-hidden rounded-full bg-surface-200">
                <div className={`h-full rounded-full ${detail.status === "expired" ? "bg-danger-500" : detail.status === "expiring_soon" ? "bg-amber-500" : "bg-brand-500"}`} style={{ width: `${progress}%` }} />
              </div>
            )}
            <div className="mt-1 text-xs text-surface-400">ينتهي في: {formatDate(detail.expires_at)} {detail.suspended && "• العداد يستمر أثناء الإيقاف"}</div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {detail.suspended ? (
            <Button variant="primary" icon={<Play className="h-4 w-4" />} disabled={busy} onClick={() => setConfirmAction("resume")}>▶️ تفعيل</Button>
          ) : (
            <Button variant="warn" icon={<Pause className="h-4 w-4" />} disabled={busy} onClick={() => setConfirmAction("suspend")}>⏸️ إيقاف مؤقت</Button>
          )}
          <Button
            variant="ghost"
            icon={<KeyRound className="h-4 w-4" />}
            disabled={busy}
            onClick={() => act(async () => {
              const res = await apiFetch<{ email: string; password: string }>(`/admin/subscribers/${id}/reset-password`, { method: "POST" });
              setTempPassword(res.password);
            }, "تمت إعادة تعيين كلمة المرور 🔑")}
          >
            🔑 إعادة تعيين كلمة المرور
          </Button>
          <Button variant="ghost" icon={<Eye className="h-4 w-4" />} onClick={() => setViewAs(true)}>👁️ عرض كما يشاهده</Button>
          <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDeleteMode(true)}>🗑️ حذف المشترك</Button>
        </div>

        {tempPassword && (
          <div className="mt-3 rounded-xl border border-brand-300 bg-brand-50 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-bold text-brand-700">كلمة المرور المؤقتة (تظهر مرة واحدة): <span className="rounded-lg bg-white px-2 py-1 font-mono text-surface-800" dir="ltr">{tempPassword}</span></div>
              <button
                onClick={() => void navigator.clipboard?.writeText(`بيانات دخولك الجديدة:\nالبريد: ${detail.email}\nكلمة المرور: ${tempPassword}`).then(() => toast.show("نُسخت ✅")).catch(() => undefined)}
                className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-brand-700"
              >
                <Copy className="inline h-3.5 w-3.5" /> نسخ للعميل
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Usage today */}
        <div className="card p-5">
          <SectionTitle icon={<Activity className="h-4 w-4" />}>استخدام اليوم</SectionTitle>
          <div className="mt-3 space-y-2.5">
            {usageEntries.map((u) => (
              <div key={u.key} className="flex items-center justify-between rounded-xl border border-surface-200 bg-surface-50 px-3 py-2 text-sm">
                <span className="font-bold text-surface-600">{u.label}</span>
                <span className="text-surface-800">
                  <span className="font-bold">{u.used.toLocaleString()}</span>
                  <span className="text-xs text-surface-400"> / {u.limit ? u.limit.toLocaleString() : "بلا حد"}</span>
                </span>
              </div>
            ))}
            <div className="rounded-xl border border-surface-200 bg-surface-50 px-3 py-2 text-sm text-surface-500">
              مهام نشطة الآن: <span className="font-bold text-surface-800">{detail.active_jobs}</span>
            </div>
          </div>
        </div>

        {/* Extend */}
        <div className="card space-y-3 p-5">
          <SectionTitle>⏱️ تمديد الفترة</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {[7, 30, 90, 180, 365].map((d) => (
              <button
                key={d}
                disabled={busy}
                onClick={() => act(() => apiFetch(`/admin/subscribers/${id}/extend`, { method: "POST", body: JSON.stringify({ days: d }) }), `تم إضافة ${d} يوم ✅`)}
                className="rounded-xl border border-brand-300 bg-brand-50 px-3.5 py-2 text-sm font-bold text-brand-700 transition hover:bg-brand-100 disabled:opacity-40"
              >
                +{d} يوم
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <div className="w-36"><Field placeholder="أيام مخصصة" type="number" value={extendDays} onChange={setExtendDays} /></div>
            <Button
              variant="primary"
              disabled={busy || !Number(extendDays)}
              onClick={() => act(async () => {
                await apiFetch(`/admin/subscribers/${id}/extend`, { method: "POST", body: JSON.stringify({ days: Number(extendDays) }) });
                setExtendDays("");
              }, `تم إضافة ${extendDays} يوم ✅`)}
            >
              إضافة
            </Button>
          </div>
          <p className="text-xs text-surface-400">
            الاشتراك الفعّال: تُضاف الأيام على نهاية الفترة الحالية. الاشتراك المنتهي: تبدأ الفترة الجديدة من الآن ويعاد تفعيله.
          </p>
        </div>
      </div>

      {/* Modules edit */}
      <div className="card space-y-3 p-5">
        <SectionTitle>🧩 الوحدات المسموحة</SectionTitle>
        <ModuleMatrix
          all={modules}
          selected={selectedModules}
          onToggle={(m, v) => setSelectedModules((prev) => (v ? [...new Set([...prev, m])] : prev.filter((x) => x !== m)))}
        />
        <Button
          variant="primary"
          disabled={busy}
          onClick={() => act(() => apiFetch(`/admin/subscribers/${id}/modules`, { method: "PUT", body: JSON.stringify({ modules: selectedModules }) }), "تم حفظ الوحدات ✅")}
        >
          💾 حفظ الوحدات
        </Button>
      </div>

      {/* Quotas edit */}
      <div className="card space-y-3 p-5">
        <SectionTitle>⚖️ الحدود المخصصة</SectionTitle>
        <QuotaFields values={quotaValues} onChange={(k, v) => setQuotaValues((prev) => ({ ...prev, [k]: v }))} />
        <Button
          variant="primary"
          disabled={busy}
          onClick={() => act(() => apiFetch(`/admin/subscribers/${id}/quotas`, { method: "PUT", body: JSON.stringify({ quotas: quotasFromStrings(quotaValues) }) }), "تم حفظ الحدود ✅")}
        >
          💾 حفظ الحدود
        </Button>
      </div>

      {/* Suspend/resume confirm */}
      <ConfirmDialog
        open={confirmAction != null}
        danger={confirmAction === "suspend"}
        title={confirmAction === "suspend" ? "إيقاف المشترك مؤقتاً؟" : "إعادة تفعيل المشترك؟"}
        message={confirmAction === "suspend"
          ? "سيُمنع المشترك فوراً من استخدام النظام (مهامه تتوقف)، وعداد اشتراكه يستمر بالعدّ. يمكنك إعادة تفعيله بأي وقت."
          : "سيعود المشترك للعمل فوراً بنفس صلاحياته وحدوده."}
        confirmLabel={confirmAction === "suspend" ? "إيقاف" : "تفعيل"}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => {
          const action = confirmAction!;
          setConfirmAction(null);
          void act(() => apiFetch(`/admin/subscribers/${id}/${action}`, { method: "POST" }), action === "suspend" ? "تم الإيقاف ⏸️" : "تم التفعيل ▶️");
        }}
      />

      {/* View-as modal */}
      {viewAs && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/20 p-4 backdrop-blur-[2px]" onClick={() => setViewAs(false)}>
          <div className="card w-full max-w-lg animate-fade p-6 shadow-pop" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 text-base font-bold text-surface-800">👁️ معاينة صلاحيات {detail.email}</h3>
            <p className="mb-4 text-xs text-surface-400">هذه هي الوحدات التي يراها المشترك في لوحته (معاينة للقراءة فقط):</p>
            <div className="grid grid-cols-2 gap-2">
              {modules.map((m) => {
                const allowed = detail.modules.includes(m.id);
                return (
                  <div key={m.id} className={`rounded-xl border px-3 py-2.5 text-sm font-bold ${allowed ? "border-brand-300 bg-brand-50 text-brand-700" : "border-surface-200 bg-surface-50 text-surface-300 line-through"}`}>
                    {allowed ? "✅" : "🔒"} {m.label}
                  </div>
                );
              })}
            </div>
            <Button variant="primary" className="mt-4 w-full" onClick={() => setViewAs(false)}>إغلاق</Button>
          </div>
        </div>
      )}

      {/* Delete modal */}
      {deleteMode && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/20 p-4 backdrop-blur-[2px]" onClick={() => setDeleteMode(false)}>
          <div className="card w-full max-w-md animate-fade p-6 shadow-pop" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-2 text-base font-bold text-danger-600">🗑️ حذف المشترك نهائياً</h3>
            <Alert tone="danger" title="إجراء لا يمكن التراجع عنه">
              اكتب بريد المشترك <span className="font-bold" dir="ltr">{detail.email}</span> للتأكيد.
            </Alert>
            <div className="mt-3 space-y-3">
              <Field placeholder="اكتب البريد للتأكيد" value={deleteConfirm} onChange={setDeleteConfirm} />
              <Checkbox
                label={`نقل حسابات المشترك (${detail.accounts_count}) إلى حساب الإدارة بدل حذفها`}
                checked={transferAccounts}
                onChange={setTransferAccounts}
              />
              <div className="flex gap-2">
                <Button
                  variant="danger"
                  className="flex-1"
                  disabled={busy || deleteConfirm.trim().toLowerCase() !== detail.email.toLowerCase()}
                  onClick={() => {
                    void act(async () => {
                      await apiFetch(`/admin/subscribers/${id}`, {
                        method: "DELETE",
                        body: JSON.stringify({ confirm_email: deleteConfirm.trim(), transfer_accounts_to_admin: transferAccounts }),
                      });
                      setDeleteMode(false);
                      onDeleted();
                    }, "تم حذف المشترك 🗑️");
                  }}
                >
                  حذف نهائي
                </Button>
                <Button variant="ghost" className="flex-1" onClick={() => setDeleteMode(false)}>إلغاء</Button>
              </div>
            </div>
          </div>
        </div>
      )}
      {toast.node}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4) Plans
// ---------------------------------------------------------------------------

function PlansTab({ modules }: { modules: AdminModuleInfo[] }) {
  const toast = useToast();
  const [plans, setPlans] = useState<PlanRecord[] | null>(null);
  const [editing, setEditing] = useState<PlanRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<PlanRecord | null>(null);

  const load = useCallback(() => {
    apiFetch<PlanRecord[]>("/admin/plans").then(setPlans).catch((e) => toast.show(e.message || "تعذر التحميل", "danger"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => load(), [load]);

  if (!plans) return <Spinner label="جاري تحميل الباقات..." />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-surface-500">الباقات قوالب جاهزة تسرّع إنشاء المشتركين — ويمكن تطبيق تعديلها على المشتركين الحاليين.</p>
        <Button variant="primary" icon={<Gem className="h-4 w-4" />} onClick={() => setCreating(true)}>➕ باقة جديدة</Button>
      </div>

      {plans.length === 0 && <EmptyState icon={<Gem className="h-8 w-8" />} title="لا توجد باقات" desc="أنشئ أول باقة لتعبئة صلاحيات المشتركين بسرعة" />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((p) => (
          <div key={p.id} className="card flex flex-col p-5">
            <div className="flex items-start justify-between">
              <h3 className="text-base font-extrabold text-surface-800">{p.name}</h3>
              {p.price_label && <span className="rounded-lg bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-600">{p.price_label}</span>}
            </div>
            <div className="mt-1 text-xs text-surface-400">{p.subscribers_count} مشترك على هذه الباقة</div>
            <ul className="mt-3 flex-1 space-y-1 text-sm text-surface-600">
              {p.points.map((point) => <li key={point}>• {point}</li>)}
              {p.points.length === 0 && <li className="text-surface-400">لا توجد مزايا مسجلة</li>}
            </ul>
            <div className="mt-3 text-xs text-surface-400">{p.modules.length} وحدة • {Object.values(p.quotas).filter((v) => v > 0).length || "بلا"} حدود مخصصة</div>
            <div className="mt-4 flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setEditing(p)}>✏️ تعديل</Button>
              <Button variant="danger" className="flex-1" onClick={() => setToDelete(p)}>🗑️ حذف</Button>
            </div>
          </div>
        ))}
      </div>

      {(creating || editing) && (
        <PlanEditor
          modules={modules}
          plan={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); load(); }}
        />
      )}

      <ConfirmDialog
        open={toDelete != null}
        danger
        title={`حذف باقة ${toDelete?.name ?? ""}؟`}
        message="المشتركون الحاليون على هذه الباقة يحتفظون بصلاحياتهم الحالية، لكن اسم الباقة سيُزال من بطاقاتهم. الباقة نفسها تُحذف نهائياً."
        confirmLabel="حذف الباقة"
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          const plan = toDelete!;
          setToDelete(null);
          try {
            await apiFetch(`/admin/plans/${plan.id}`, { method: "DELETE" });
            toast.show("تم حذف الباقة");
            load();
          } catch (e) {
            toast.show(e instanceof Error ? e.message : "فشل الحذف", "danger");
          }
        }}
      />
      {toast.node}
    </div>
  );
}

function PlanEditor({ modules, plan, onClose, onSaved }: {
  modules: AdminModuleInfo[];
  plan: PlanRecord | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(plan?.name ?? "");
  const [priceLabel, setPriceLabel] = useState(plan?.price_label ?? "");
  const [points, setPoints] = useState((plan?.points ?? []).join("\n"));
  const [selectedModules, setSelectedModules] = useState<string[]>(plan?.modules ?? []);
  const [quotaValues, setQuotaValues] = useState<Record<string, string>>(plan ? quotasToStrings(plan.quotas) : {});
  const [applyExisting, setApplyExisting] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      toast.show("اسم الباقة مطلوب", "danger");
      return;
    }
    const body = {
      name: name.trim(),
      price_label: priceLabel.trim() || null,
      points: points.split("\n").map((p) => p.trim()).filter(Boolean),
      modules: selectedModules,
      quotas: quotasFromStrings(quotaValues),
      ...(plan ? { apply_to_existing: applyExisting } : {}),
    };
    setBusy(true);
    try {
      if (plan) {
        await apiFetch(`/admin/plans/${plan.id}`, { method: "PUT", body: JSON.stringify(body) });
        toast.show("تم تحديث الباقة ✅");
      } else {
        await apiFetch("/admin/plans", { method: "POST", body: JSON.stringify(body) });
        toast.show("تم إنشاء الباقة ✅");
      }
      onSaved();
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "فشل الحفظ", "danger");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/20 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div className="card w-full max-w-2xl animate-fade space-y-4 p-6 shadow-pop" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-bold text-surface-800">{plan ? `✏️ تعديل ${plan.name}` : "➕ باقة جديدة"}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="اسم الباقة" value={name} onChange={setName} placeholder="🟩 مُسوِّق" />
          <Field label="وصف السعر (نص حر)" value={priceLabel} onChange={setPriceLabel} placeholder="احترافية / 50$ شهرياً..." />
        </div>
        <TextArea label="مزايا الباقة (سطر لكل ميزة)" value={points} onChange={setPoints} rows={3} placeholder={"تجميع + إضافة\nرسائل DM\n10 حسابات"} />
        <div>
          <label className="label">الوحدات المشمولة</label>
          <ModuleMatrix
            all={modules}
            selected={selectedModules}
            onToggle={(m, v) => setSelectedModules((prev) => (v ? [...new Set([...prev, m])] : prev.filter((x) => x !== m)))}
          />
        </div>
        <div>
          <label className="label">حدود الباقة (اختياري)</label>
          <QuotaFields values={quotaValues} onChange={(k, v) => setQuotaValues((prev) => ({ ...prev, [k]: v }))} />
        </div>
        {plan && (
          <Checkbox label="تطبيق التعديل على المشتركين الحاليين على هذه الباقة (وحدات + حدود)" checked={applyExisting} onChange={setApplyExisting} />
        )}
        <div className="flex gap-2">
          <Button variant="primary" className="flex-1" disabled={busy} onClick={submit}>{busy ? "جاري الحفظ..." : "💾 حفظ الباقة"}</Button>
          <Button variant="ghost" className="flex-1" onClick={onClose}>إلغاء</Button>
        </div>
        {toast.node}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 5) Usage monitor
// ---------------------------------------------------------------------------

function UsageTab() {
  const toast = useToast();
  const [rows, setRows] = useState<UsageRow[] | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    apiFetch<UsageRow[]>("/admin/usage").then(setRows).catch((e) => toast.show(e.message || "تعذر التحميل", "danger"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const quotaPercent = (used: number, limit: number): ReactNode => {
    if (!limit) return <span className="text-xs text-surface-300">بلا حد</span>;
    const pct = Math.min(100, Math.round((used / limit) * 100));
    const color = pct >= 90 ? "bg-danger-500" : pct >= 60 ? "bg-amber-500" : "bg-brand-500";
    const text = pct >= 90 ? "text-danger-600" : pct >= 60 ? "text-amber-600" : "text-brand-700";
    return (
      <div className="w-24">
        <div className="mb-0.5 flex justify-between text-[10px] font-bold"><span className={text}>{used}/{limit}</span><span className="text-surface-400">{pct}%</span></div>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-200"><div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} /></div>
      </div>
    );
  };

  if (!rows) return <Spinner label="جاري تحميل الاستخدام..." />;
  const q = search.trim().toLowerCase();
  const filtered = q ? rows.filter((r) => r.email.toLowerCase().includes(q)) : rows;

  return (
    <div className="space-y-4">
      <div className="card p-4"><SearchInput value={search} onChange={setSearch} placeholder="تصفية حسب بريد المشترك..." /></div>
      {filtered.length === 0 && <EmptyState icon={<Activity className="h-8 w-8" />} title="لا يوجد استخدام" desc="ما إن يبدأ المشتركون بالعمل تظهر أرقامهم هنا" />}
      {filtered.length > 0 && (
        <Table
          columns={["المشترك", "الحالة", "حسابات", "تجميع اليوم", "إضافة اليوم", "DM اليوم", "قروبات اليوم", "مهام نشطة"]}
          rows={filtered.map((r) => [
            <span key="e" className="font-bold text-surface-800" dir="ltr">{r.email}</span>,
            <StatusPill key="s" status={r.status} />,
            <span key="a">{r.accounts}{r.quotas.accounts_limit ? `/${r.quotas.accounts_limit}` : ""}</span>,
            quotaPercent(r.gather_today, r.quotas.gather_daily || 0),
            quotaPercent(r.add_today, r.quotas.add_daily || 0),
            quotaPercent(r.dm_today, r.quotas.dm_daily || 0),
            quotaPercent(r.group_today, r.quotas.group_daily || 0),
            <span key="j">{r.active_jobs}{r.quotas.concurrent_jobs ? `/${r.quotas.concurrent_jobs}` : ""}</span>,
          ])}
        />
      )}
      {toast.node}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 6) Global Telegram API Settings
// ---------------------------------------------------------------------------

function ApiTab() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiId, setApiId] = useState("");
  const [apiHash, setApiHash] = useState("");
  const [configured, setConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    apiFetch<{ api_id: string; api_hash: string; configured: boolean }>("/admin/settings/telegram")
      .then((data) => {
        setApiId(data.api_id || "");
        setApiHash(data.api_hash || "");
        setConfigured(Boolean(data.configured));
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "تعذر تحميل إعدادات API";
        setError(msg);
        toast.show(msg, "danger");
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    if (!apiId.trim() || !apiHash.trim()) {
      toast.show("يجب إدخال معرف API ID وتجزئة API Hash", "danger");
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch<{ message: string }>("/admin/settings/telegram", {
        method: "PUT",
        body: JSON.stringify({ api_id: apiId.trim(), api_hash: apiHash.trim() }),
      });
      toast.show(res.message);
      load();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "تعذر حفظ الإعدادات", "danger");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Alert tone="info" title="إعدادات API تيليجرام العامة للنظام">
        إعدادات Telegram API ID و API Hash تُضبط هنا من قِبل مالك الموقع (الإدارة) مرة واحدة وتُطبق على جميع المشتركين والحسابات في النظام بالكامل، بحيث لو أُخفي قسم الإعدادات عن المستخدم فلن يحتاج لإدخالها بنفسه لتسجيل الحسابات.
      </Alert>
      {loading ? (
        <Spinner label="جاري تحميل إعدادات API..." />
      ) : error ? (
        <div className="card space-y-3 p-6">
          <Alert tone="danger" title="تعذر تحميل إعدادات API">{error}</Alert>
          <Button variant="primary" className="w-full" onClick={load}>🔄 إعادة المحاولة</Button>
        </div>
      ) : (
        <div className="card space-y-4 p-6">
          <SectionTitle icon={<KeyRound className="h-4 w-4" />}>
            بيانات اتصال تيليجرام (Apid and hash) {configured ? "🟢 مضبوطة" : "⚠️ غير مضبوطة"}
          </SectionTitle>
          <Field
            label="معرف API (API ID)"
            value={apiId}
            onChange={setApiId}
            placeholder="مثال: 12345678"
            hint="يمكنك الحصول عليه من my.telegram.org → API Development Tools"
          />
          <Field
            label="تجزئة API (API Hash)"
            value={apiHash}
            onChange={setApiHash}
            placeholder="مثال: a1b2c3d4e5f6"
          />
          <div className="pt-2">
            <Button
              variant="primary"
              className="w-full py-3 font-bold"
              disabled={saving || !apiId.trim() || !apiHash.trim()}
              onClick={() => void handleSave()}
            >
              {saving ? "جاري الحفظ والتطبيق..." : "💾 حفظ وتطبيق على النظام كامل"}
            </Button>
          </div>
        </div>
      )}
      {toast.node}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 7) Broadcast
// ---------------------------------------------------------------------------

function BroadcastTab() {
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState("all");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!message.trim()) {
      toast.show("اكتب نص الإشعار", "danger");
      return;
    }
    setBusy(true);
    try {
      await apiFetch("/admin/broadcast", {
        method: "POST",
        body: JSON.stringify({ title: title.trim() || "تنبيه من الإدارة", message: message.trim(), audience }),
      });
      toast.show("تم إرسال البثّ — سيظهر شريطاً لدى المشتركين 📢");
      setTitle("");
      setMessage("");
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "فشل الإرسال", "danger");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      <div className="card space-y-4 p-5">
        <SectionTitle icon={<Megaphone className="h-4 w-4" />}>إشعار عام للمشتركين</SectionTitle>
        <Field label="العنوان" value={title} onChange={setTitle} placeholder="تنبيه من الإدارة" />
        <TextArea label="نص الإشعار" value={message} onChange={setMessage} rows={4} placeholder="مثال: صيانة مجدولة الليلة من 12 حتى 2 فجراً — الخدمة تعود تلقائياً بعدها" />
        <div>
          <label className="label">الجمهور المستهدف</label>
          <div className="flex flex-wrap gap-2">
            {[
              ["all", "الكل"],
              ["active", "النشطون فقط"],
              ["expiring_soon", "المنتهون قريباً"],
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setAudience(id)}
                className={`rounded-xl border px-4 py-2 text-sm font-bold transition ${audience === id ? "border-brand-400 bg-brand-50 text-brand-700" : "border-surface-200 text-surface-500"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <Button variant="primary" className="w-full" disabled={busy} onClick={submit}>{busy ? "جاري الإرسال..." : "📢 إرسال البثّ"}</Button>
        <p className="text-xs text-surface-400">يظهر كشريط أزرق أعلى لوحة المشترك فور فتحها، ويختفي بإغلاقه، ويُسجَّل في سجل الإشعارات.</p>
      </div>
      {toast.node}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 8) Admin logs
// ---------------------------------------------------------------------------

function LogsTab() {
  const toast = useToast();
  const [rows, setRows] = useState<AdminLogEntry[] | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    apiFetch<AdminLogEntry[]>("/admin/logs?limit=300").then(setRows).catch((e) => toast.show(e.message || "تعذر التحميل", "danger"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => load(), [load]);

  if (!rows) return <Spinner label="جاري تحميل السجل..." />;
  const q = search.trim().toLowerCase();
  const filtered = q ? rows.filter((r) => r.message.includes(q) || r.action.includes(q)) : rows;

  const ACTION_LABELS: Record<string, string> = {
    "admin.subscribers.create": "➕ إنشاء مشترك",
    "admin.subscribers.extend": "⏱️ تمديد",
    "admin.subscribers.suspend": "⏸️ إيقاف",
    "admin.subscribers.resume": "▶️ تفعيل",
    "admin.subscribers.reset_password": "🔑 كلمة مرور",
    "admin.subscribers.delete": "🗑️ حذف",
    "admin.subscribers.purged": "🧹 إزالة تلقائية",
    "admin.subscribers.modules": "🧩 وحدات",
    "admin.subscribers.quotas": "⚖️ حدود",
    "admin.plans.create": "💎 باقة جديدة",
    "admin.plans.update": "💎 تعديل باقة",
    "admin.plans.delete": "💎 حذف باقة",
    "admin.broadcast": "📢 بثّ",
    "admin.logs.export": "⬇️ تصدير السجل",
    "admin.system.lock_clients": "🔒 قفل العملاء",
    "admin.system.unlock_clients": "🔓 فتح العملاء",
  };

  return (
    <div className="space-y-4">
      <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="flex-1"><SearchInput value={search} onChange={setSearch} placeholder="البحث في سجل عمليات الإدارة..." /></div>
        <div className="flex gap-2">
          <Button variant="ghost" icon={<RefreshCw className="h-4 w-4" />} onClick={load}>تحديث</Button>
          <Button
            variant="primary"
            onClick={() => downloadApiFile("/admin/logs/export", "admin-logs.csv").catch((e) => toast.show(e.message || "فشل التصدير", "danger"))}
          >
            ⬇️ تصدير CSV
          </Button>
        </div>
      </div>
      <Alert tone="info">هذا السجل خاص بعمليات الإدارة فقط ولا يمكن حذفه أو التعديل عليه — يوثّق كل إجراء يتم على المشتركين والباقات.</Alert>
      {filtered.length === 0 && <EmptyState icon={<ScrollText className="h-8 w-8" />} title="السجل فارغ" desc="كل عمليات الإدارة القادمة ستُسجَّل هنا تلقائياً" />}
      {filtered.length > 0 && (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>الوقت</th><th>العملية</th><th>التفاصيل</th><th>المستوى</th></tr></thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td className="text-xs text-surface-400">{formatDateTime(r.created_at)}</td>
                    <td className="text-sm font-bold text-surface-700">{ACTION_LABELS[r.action] ?? r.action}</td>
                    <td className="text-sm text-surface-600">{r.message}</td>
                    <td>
                      <span className={`rounded-lg px-2 py-0.5 text-xs font-bold ${r.level === "warn" ? "bg-amber-50 text-amber-600" : r.level === "error" ? "bg-danger-50 text-danger-600" : "bg-surface-100 text-surface-500"}`}>
                        {r.level}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {toast.node}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 9) Emergency
// ---------------------------------------------------------------------------

function EmergencyTab() {
  const toast = useToast();
  const [action, setAction] = useState<null | "stop_all" | "lock" | "unlock">(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    const what = action!;
    setAction(null);
    setBusy(true);
    try {
      if (what === "stop_all") {
        const res = await apiFetch<{ message: string }>("/security/emergency", { method: "POST", body: JSON.stringify({ action: "stop_all" }) });
        toast.show(res.message);
      } else {
        const res = await apiFetch<{ message: string }>(`/admin/system/${what === "lock" ? "lock" : "unlock"}-clients`, { method: "POST" });
        toast.show(res.message);
      }
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "فشل الإجراء", "danger");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Alert tone="danger" title="منطقة حساسة">
        إجراءات الطوارئ تؤثر على النظام كله فوراً — استخدمها فقط عند الحاجة الفعلية، وكل إجراء يُوثَّق في سجل عمليات الإدارة.
      </Alert>
      <div className="card space-y-3 p-5">
        <SectionTitle icon={<Siren className="h-4 w-4 text-danger-500" />}>إجراءات فورية</SectionTitle>
        <button
          disabled={busy}
          onClick={() => setAction("stop_all")}
          className="w-full rounded-xl border border-danger-300 bg-danger-50 px-4 py-3.5 text-right transition hover:bg-danger-100 disabled:opacity-40"
        >
          <div className="font-extrabold text-danger-700">⛔ إيقاف جميع العمليات الجارية</div>
          <div className="mt-0.5 text-xs text-danger-500">يلغي كل المهام النشطة لكل المستخدمين مع حفظ التقدم الحالي</div>
        </button>
        <button
          disabled={busy}
          onClick={() => setAction("lock")}
          className="w-full rounded-xl border border-amber-300 bg-amber-50 px-4 py-3.5 text-right transition hover:bg-amber-100 disabled:opacity-40"
        >
          <div className="font-extrabold text-amber-700">🔒 قفل لوحة العملاء</div>
          <div className="mt-0.5 text-xs text-amber-600">يمنع كل المشتركين من استخدام النظام (صيانة مؤقتة) — أنت وحدك تبقى بالداخل</div>
        </button>
        <button
          disabled={busy}
          onClick={() => setAction("unlock")}
          className="w-full rounded-xl border border-brand-300 bg-brand-50 px-4 py-3.5 text-right transition hover:bg-brand-100 disabled:opacity-40"
        >
          <div className="font-extrabold text-brand-700">🔓 فتح لوحة العملاء مجدداً</div>
          <div className="mt-0.5 text-xs text-brand-600">يعيد النظام للعمل الطبيعي لكل المشتركين بصلاحياتهم السابقة</div>
        </button>
      </div>

      <ConfirmDialog
        open={action != null}
        danger={action !== "unlock"}
        title={
          action === "stop_all" ? "إيقاف جميع العمليات؟" :
          action === "lock" ? "قفل لوحة العملاء؟" : "فتح لوحة العملاء؟"
        }
        message={
          action === "stop_all" ? "ستُلغى كل المهام الجارية لكل المستخدمين فوراً (يُحفظ تقدمها). هل أنت متأكد؟" :
          action === "lock" ? "سيُمنع كل المشتركين من استخدام النظام فوراً ويرون رسالة صيانة، وتبقى أنت وحدك بالداخل. متابعة؟" :
          "سيعود كل المشتركين للعمل الطبيعي. متابعة؟"
        }
        confirmLabel={action === "unlock" ? "فتح" : "تنفيذ"}
        onCancel={() => setAction(null)}
        onConfirm={() => void run()}
      />
      {toast.node}
    </div>
  );
}
