import { useEffect, useMemo, useRef, useState } from "react";
import {
  Users,
  UserPlus,
  FolderInput,
  ListChecks,
  ShieldCheck,
  Trash2,
  Zap,
  Upload,
  Flame,
  Phone,
  Globe,
  LayersIcon,
  Heart,
  Settings2,
  Image,
  Activity,
  Lock,
  Archive,
  Search,
} from "lucide-react";
import { useNav } from "../nav";
import {
  PageHeader,
  Button,
  Field,
  Checkbox,
  OptionButton,
  Progress,
  StatusChip,
  Table,
  SectionTitle,
  Alert,
  ConfirmDialog,
  useToast,
  EmptyState,
  Tabs,
  InlineEdit,
  SearchInput,
  StatCard,
  Spinner,
} from "../ui";
import {
  apiFetch,
  type AccountRecord,
  type ActivityLogRecord,
  type DashboardSummary,
  type ProxyRecord,
  type TelegramAuthSessionRecord,
  type TelegramRequestCodeResponse,
  type TelegramStatus,
  type TelegramVerifyCodeResponse,
  type JobStartResponse,
  type JobStatusResponse,
  type AccountValidationResult,
  type WarmupResult,
} from "../lib/api";
import { accounts } from "../data";

const accountMenu = [
  { id: "add", label: "إضافة حساب جديد", desc: "إضافة وحفظ الحساب في قاعدة البيانات", icon: UserPlus },
  { id: "import", label: "استيراد الجلسات", desc: "رفع ملفات sessions أو strings", icon: FolderInput },
  { id: "list", label: "عرض الحسابات", desc: "جدول حي من السيرفر", icon: ListChecks },
  { id: "validate", label: "التحقق من الصحة", desc: "تقرير من البيانات الحالية", icon: ShieldCheck },
  { id: "pools", label: "مجموعات الحسابات", desc: "قيد التوسعة", icon: LayersIcon },
  { id: "warmup", label: "تهيئة الحسابات", desc: "واجهة تشغيل أولية", icon: Flame },
  { id: "health", label: "درجة الصحة", desc: "حساب تقديري من البيانات", icon: Heart },
  { id: "settings-ind", label: "إعدادات فردية", desc: "قيد التوسعة", icon: Settings2 },
  { id: "profile", label: "الملف الشخصي", desc: "قيد التوسعة", icon: Image },
  { id: "activity", label: "سجل النشاط", desc: "من الـ Audit Log", icon: Activity },
  { id: "security", label: "أمان الحسابات", desc: "قيد التوسعة", icon: Lock },
  { id: "export", label: "تصدير الجلسات", desc: "قيد الربط الخلفي", icon: Archive },
  { id: "auto-remove", label: "إزالة المحظورة", desc: "حذف blocked/restricted", icon: Zap },
  { id: "remove", label: "إزالة حساب", desc: "حذف حساب محدد", icon: Trash2 },
] as const;

function PlaceholderCard({ title, desc }: { title: string; desc: string }) {
  const { push } = useNav();
  return (
    <div className="animate-fade">
      <PageHeader title={title} />
      <div className="mx-auto max-w-2xl card p-6">
        <Alert tone="info" title="هذه الوحدة جاهزة شكلياً وتحتاج ربط تشغيلي إضافي">{desc}</Alert>
        <div className="mt-4 flex gap-2">
          <Button onClick={() => push(["accounts"])}>العودة لمدير الحسابات</Button>
          <Button variant="primary" onClick={() => push(["reports", "errors"])}>عرض السجلات</Button>
        </div>
      </div>
    </div>
  );
}

export function AccountsModule() {
  const { push } = useNav();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    apiFetch<DashboardSummary>("/reports/dashboard").then(setSummary).catch(() => setSummary(null));
  }, []);

  const active = summary?.accounts_active ?? 0;
  const total = summary?.accounts_total ?? 0;
  const blocked = Math.max(0, total - active);
  const restricted = Math.max(0, blocked > 0 ? Math.floor(blocked / 2) : 0);

  return (
    <div className="animate-fade">
      <PageHeader title="مدير الحسابات" subtitle="إدارة حسابات تيليجرام من قاعدة البيانات" icon={<Users className="h-5 w-5" />} />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="نشط" value={active} tone="brand" />
        <StatCard label="متابعة/محظور" value={blocked} tone="danger" />
        <StatCard label="مقيد تقديري" value={restricted} tone="warn" />
        <StatCard label="الإجمالي" value={total} tone="accent" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {accountMenu.map((it) => {
          const Icon = it.icon;
          return (
            <button
              key={it.id}
              onClick={() => push(["accounts", it.id])}
              className="card flex items-center gap-3 p-4 text-right transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-pop"
            >
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-brand-200"><Icon className="h-5 w-5" /></div>
              <div>
                <div className="text-sm font-bold text-surface-800">{it.label}</div>
                <div className="text-xs text-surface-500">{it.desc}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function AccountsScreen({ sub }: { sub: string }) {
  switch (sub) {
    case "add": return <AddAccount />;
    case "list": return <ListAccounts />;
    case "validate": return <ValidateAccounts />;
    case "remove": return <RemoveAccount />;
    case "auto-remove": return <AutoRemove />;
    case "health": return <HealthScore />;
    case "activity": return <ActivityLog />;
    case "import": return <ImportSessions />;
    case "export": return <ExportSessions />;
    case "warmup": return <WarmupAccounts />;
    case "pools": return <AccountPools />;
    case "settings-ind": return <IndividualSettings />;
    case "profile": return <ProfileManager />;
    case "security": return <AccountSecurity />;
    default: return null;
  }
}

function AddAccount() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [mode, setMode] = useState<"telegram" | "manual">("telegram");
  const [proxies, setProxies] = useState<ProxyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [telegramStatus, setTelegramStatus] = useState<TelegramStatus | null>(null);

  const [manualStep, setManualStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState<AccountRecord["status"]>("active");
  const [proxyId, setProxyId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");

  const [otpPhone, setOtpPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpPassword, setOtpPassword] = useState("");
  const [otpStep, setOtpStep] = useState<1 | 2 | 3>(1);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpNeedsPassword, setOtpNeedsPassword] = useState(false);
  const [createdAccount, setCreatedAccount] = useState<AccountRecord | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<ProxyRecord[]>("/proxies").catch(() => []),
      apiFetch<TelegramStatus>("/telegram/status").catch(() => null),
    ])
      .then(([proxyRows, telegramState]) => {
        setProxies(proxyRows);
        setTelegramStatus(telegramState);
      })
      .finally(() => setLoading(false));
  }, []);

  const submitManual = async () => {
    setSaving(true);
    try {
      await apiFetch<AccountRecord>("/accounts", {
        method: "POST",
        body: JSON.stringify({
          phone,
          name,
          username: username || null,
          status,
          proxy_id: proxyId,
          groups_count: 0,
          age_label: "جديد",
          last_used_label: "الآن",
          notes: notes || null,
        }),
      });
      show("تم حفظ الحساب في قاعدة البيانات");
      push(["accounts", "list"]);
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر إضافة الحساب", "danger");
    } finally {
      setSaving(false);
    }
  };

  const requestCode = async () => {
    setOtpLoading(true);
    try {
      const response = await apiFetch<TelegramRequestCodeResponse>("/telegram/auth/request-code", {
        method: "POST",
        body: JSON.stringify({ phone: otpPhone }),
      });
      show(response.message);
      setOtpStep(2);
      setOtpNeedsPassword(false);
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر إرسال الرمز", "danger");
    } finally {
      setOtpLoading(false);
    }
  };

  const verifyCode = async () => {
    setOtpLoading(true);
    try {
      const response = await apiFetch<TelegramVerifyCodeResponse>("/telegram/auth/verify-code", {
        method: "POST",
        body: JSON.stringify({
          phone: otpPhone,
          code: otpCode || undefined,
          password: otpPassword || undefined,
        }),
      });
      if (response.needs_password) {
        setOtpNeedsPassword(true);
        setOtpStep(3);
        show(response.message, "info");
        return;
      }
      show(response.message);
      setCreatedAccount(response.account ?? null);
      setOtpStep(3);
      setOtpNeedsPassword(false);
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر التحقق", "danger");
    } finally {
      setOtpLoading(false);
    }
  };

  return (
    <div className="animate-fade">
      <PageHeader title="إضافة حساب جديد" subtitle="إما ربط حساب تيليجرام فعلي أو إنشاء سجل يدوي" icon={<UserPlus className="h-5 w-5" />} />
      <div className="mx-auto max-w-2xl space-y-4">
        <Tabs tabs={[{ id: "telegram", label: "ربط عبر Telegram OTP" }, { id: "manual", label: "إضافة يدوية" }]} active={mode} onChange={(value) => setMode(value as typeof mode)} />

        {mode === "telegram" && (
          <>
            {!telegramStatus?.configured && (
              <Alert tone="warn" title="إعدادات تيليجرام غير مكتملة">اذهب إلى الإعدادات وضع Telegram API ID و API Hash أولاً قبل الربط الفعلي.</Alert>
            )}
            {otpStep === 1 && (
              <div className="card p-6 space-y-4">
                <SectionTitle icon={<Phone className="h-4 w-4" />}>الخطوة 1 — طلب رمز التحقق</SectionTitle>
                <Field label="رقم الهاتف" value={otpPhone} onChange={setOtpPhone} placeholder="+9665XXXXXXXX" />
                <div className="text-xs text-surface-500">سيتم إرسال OTP عبر Telethon من السيرفر وتخزين الجلسة داخل مجلد sessions.</div>
                <div className="flex gap-2">
                  <Button variant="primary" className="flex-1" disabled={!otpPhone || otpLoading || !telegramStatus?.configured} onClick={() => void requestCode()}>{otpLoading ? "جاري الإرسال..." : "إرسال OTP"}</Button>
                  <Button onClick={() => push(["accounts"])}>إلغاء</Button>
                </div>
              </div>
            )}

            {otpStep === 2 && (
              <div className="card p-6 space-y-4">
                <SectionTitle>الخطوة 2 — أدخل الرمز</SectionTitle>
                <Field label="رمز التحقق" value={otpCode} onChange={setOtpCode} placeholder="12345" />
                <div className="flex gap-2">
                  <Button variant="primary" className="flex-1" disabled={!otpCode || otpLoading} onClick={() => void verifyCode()}>{otpLoading ? "جاري التحقق..." : "تحقق"}</Button>
                  <Button onClick={() => setOtpStep(1)}>رجوع</Button>
                </div>
              </div>
            )}

            {otpStep === 3 && otpNeedsPassword && (
              <div className="card p-6 space-y-4">
                <Alert tone="warn" title="الحساب يتطلب كلمة مرور 2FA">أدخل كلمة المرور لإكمال الربط وحفظ الجلسة.</Alert>
                <Field label="كلمة مرور 2FA" value={otpPassword} onChange={setOtpPassword} placeholder="••••••••" type="password" />
                <div className="flex gap-2">
                  <Button variant="primary" className="flex-1" disabled={!otpPassword || otpLoading} onClick={() => void verifyCode()}>{otpLoading ? "جاري التحقق..." : "إكمال الربط"}</Button>
                  <Button onClick={() => setOtpStep(2)}>رجوع</Button>
                </div>
              </div>
            )}

            {otpStep === 3 && !otpNeedsPassword && createdAccount && (
              <div className="card p-6 space-y-4">
                <Alert tone="success" title="تم ربط الحساب وحفظ الجلسة بنجاح">
                  <div className="space-y-1 text-xs">
                    <div>الهاتف: {createdAccount.phone}</div>
                    <div>الاسم: {createdAccount.name}</div>
                    <div>المعرف: {createdAccount.username || "—"}</div>
                    <div>حالة السجل: {createdAccount.status}</div>
                  </div>
                </Alert>
                <div className="flex gap-2">
                  <Button variant="primary" className="flex-1" onClick={() => push(["accounts", "detail", String(createdAccount.id)])}>فتح بطاقة الحساب</Button>
                  <Button onClick={() => push(["accounts", "list"])}>عرض الحسابات</Button>
                </div>
              </div>
            )}
          </>
        )}

        {mode === "manual" && (
          <>
            {manualStep === 1 && (
              <div className="card p-6 space-y-4">
                <SectionTitle icon={<Phone className="h-4 w-4" />}>البيانات الأساسية</SectionTitle>
                <Field label="رقم الهاتف" value={phone} onChange={setPhone} placeholder="+9665XXXXXXXX" />
                <Field label="الاسم" value={name} onChange={setName} placeholder="اسم الحساب" />
                <Field label="@username" value={username} onChange={setUsername} placeholder="@username" />
                <InlineEdit label="ملاحظات" value={notes} onSave={setNotes} placeholder="أي ملاحظة إضافية" />
                <div className="flex gap-2">
                  <Button variant="primary" className="flex-1" disabled={!phone || !name} onClick={() => setManualStep(2)}>التالي</Button>
                  <Button onClick={() => push(["accounts"])}>إلغاء</Button>
                </div>
              </div>
            )}

            {manualStep === 2 && (
              <div className="card p-6 space-y-4">
                <SectionTitle>الحالة والبروكسي</SectionTitle>
                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    { id: "active", label: "نشط" },
                    { id: "restricted", label: "مقيد" },
                    { id: "blocked", label: "محظور" },
                  ].map((item) => (
                    <OptionButton key={item.id} label={item.label} selected={status === item.id} onClick={() => setStatus(item.id as AccountRecord["status"])} />
                  ))}
                </div>
                <SectionTitle icon={<Globe className="h-4 w-4" />}>اختيار بروكسي (اختياري)</SectionTitle>
                {loading ? <Spinner label="جاري تحميل البروكسيات..." /> : (
                  <div className="grid gap-2">
                    <OptionButton label="بدون بروكسي" selected={proxyId === null} onClick={() => setProxyId(null)} />
                    {proxies.filter((p) => p.status === "active").map((proxy) => (
                      <OptionButton key={proxy.id} label={proxy.address} desc={proxy.proxy_type} selected={proxyId === proxy.id} onClick={() => setProxyId(proxy.id)} />
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Button variant="primary" className="flex-1" onClick={() => setManualStep(3)}>التالي</Button>
                  <Button onClick={() => setManualStep(1)}>رجوع</Button>
                </div>
              </div>
            )}

            {manualStep === 3 && (
              <div className="card p-6 space-y-4">
                <Alert tone="success" title="مراجعة قبل الحفظ">
                  <div className="space-y-1 text-xs">
                    <div>الهاتف: {phone}</div>
                    <div>الاسم: {name}</div>
                    <div>المعرف: {username || "—"}</div>
                    <div>الحالة: {status}</div>
                    <div>البروكسي: {proxies.find((p) => p.id === proxyId)?.address || "بدون بروكسي"}</div>
                  </div>
                </Alert>
                <div className="flex gap-2">
                  <Button variant="primary" className="flex-1" disabled={saving} onClick={() => void submitManual()}>{saving ? "جاري الحفظ..." : "حفظ الحساب"}</Button>
                  <Button onClick={() => setManualStep(2)}>رجوع</Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      {node}
    </div>
  );
}

function ImportSessions() {
  const { show, node } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [sessions, setSessions] = useState<TelegramAuthSessionRecord[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<"sessions" | "zip" | "txt">("sessions");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setSessions(await apiFetch<TelegramAuthSessionRecord[]>("/telegram/auth-sessions"));
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر تحميل الجلسات", "danger");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const upload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("category", category);
      await apiFetch("/uploads", { method: "POST", body: form });
      show("تم رفع الملف إلى السيرفر");
      setFile(null);
      await load();
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر رفع الملف", "danger");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="animate-fade">
      <PageHeader title="استيراد الجلسات" subtitle="إدارة ملفات الجلسات ومتابعة جلسات OTP" icon={<FolderInput className="h-5 w-5" />} />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5 space-y-4">
          <SectionTitle icon={<Upload className="h-4 w-4" />}>رفع ملفات جلسات</SectionTitle>
          <input ref={fileRef} type="file" accept=".session,.zip,.txt" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <div className="grid gap-2 sm:grid-cols-3">
            <OptionButton label="Session" selected={category === "sessions"} onClick={() => setCategory("sessions")} />
            <OptionButton label="ZIP" selected={category === "zip"} onClick={() => setCategory("zip")} />
            <OptionButton label="TXT / String" selected={category === "txt"} onClick={() => setCategory("txt")} />
          </div>
          <Button variant="primary" className="w-full" onClick={() => fileRef.current?.click()}>{file ? `تم اختيار: ${file.name}` : "اختيار ملف"}</Button>
          <Button className="w-full" disabled={!file || uploading} onClick={() => void upload()}>{uploading ? "جاري الرفع..." : "رفع إلى السيرفر"}</Button>
          <Alert tone="info" title="ملاحظة">الرفع جاهز الآن، ويبقى ربط parsing التلقائي للملفات وتحويلها إلى حسابات مرتبطة في مرحلة لاحقة.</Alert>
        </div>
        <div className="card p-5 space-y-4">
          <SectionTitle>جلسات OTP / الربط الحالية</SectionTitle>
          {loading ? <Spinner label="جاري تحميل الجلسات..." /> : sessions.length === 0 ? (
            <EmptyState title="لا توجد جلسات تحقق حتى الآن" desc="ابدأ من تبويب ربط الحساب عبر Telegram OTP." />
          ) : (
            <Table columns={["الهاتف", "الحالة", "2FA", "المسار"]} rows={sessions.map((session) => [
              session.phone,
              session.status,
              session.needs_password ? "نعم" : "لا",
              session.session_file_path || "—",
            ])} />
          )}
        </div>
      </div>
      {node}
    </div>
  );
}

function ExportSessions() {
  const [rows, setRows] = useState<AccountRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const { show, node } = useToast();

  useEffect(() => {
    apiFetch<AccountRecord[]>("/accounts").then(setRows).finally(() => setLoading(false));
  }, []);

  const linked = rows.filter((row) => row.session_file_path);

  return (
    <div className="animate-fade">
      <PageHeader title="تصدير الجلسات" subtitle="عرض الحسابات المرتبطة التي لديها session file" icon={<Archive className="h-5 w-5" />} />
      {loading ? <Spinner label="جاري تحميل الجلسات..." /> : linked.length === 0 ? (
        <EmptyState title="لا توجد جلسات مرتبطة بعد" desc="اربط حسابًا عبر Telegram OTP أولاً ليظهر هنا ملف الجلسة المخزن على السيرفر." />
      ) : (
        <div className="space-y-4">
          <Alert tone="info" title="التصدير الفعلي للملفات لم يُفعّل بعد">تم تجهيز بيانات الجلسات ومساراتها، والخطوة التالية الآمنة هي إنشاء endpoint مخصص لتنزيل نسخة backup مضغوطة للمشرف فقط.</Alert>
          <Table columns={["الهاتف", "الاسم", "المعرّف", "مسار الجلسة"]} rows={linked.map((row) => [row.phone, row.name, row.username || "—", row.session_file_path || "—"])} />
          <Button variant="primary" onClick={() => {
            const csvRows = [["phone", "name", "username", "session_file_path"], ...linked.map((row) => [row.phone, row.name, row.username || "", row.session_file_path || ""] )];
            const csv = csvRows.map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
            const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "session-metadata.csv";
            link.click();
            URL.revokeObjectURL(url);
            show("تم تصدير ملف metadata");
          }}>تصدير Metadata CSV</Button>
        </div>
      )}
      {node}
    </div>
  );
}

function ListAccounts() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [rows, setRows] = useState<AccountRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | AccountRecord["status"]>("all");
  const [selected, setSelected] = useState<number[]>([]);
  const [confirmDel, setConfirmDel] = useState(false);
  const [proxies, setProxies] = useState<ProxyRecord[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const [accountsData, proxiesData] = await Promise.all([
        apiFetch<AccountRecord[]>(`/accounts${search || filter !== "all" ? `?${new URLSearchParams({ ...(search ? { search } : {}), ...(filter !== "all" ? { status: filter } : {}) }).toString()}` : ""}`),
        apiFetch<ProxyRecord[]>("/proxies"),
      ]);
      setRows(accountsData);
      setProxies(proxiesData);
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر جلب الحسابات", "danger");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter !== "all" && row.status !== filter) return false;
      if (!q) return true;
      return [row.name, row.phone, row.username || ""].some((v) => v.toLowerCase().includes(q));
    });
  }, [rows, search, filter]);

  const toggle = (id: number) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const deleteSelected = async () => {
    try {
      await Promise.all(selected.map((id) => apiFetch(`/accounts/${id}`, { method: "DELETE" })));
      show(`تم حذف ${selected.length} حساب`);
      setSelected([]);
      setConfirmDel(false);
      await load();
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر حذف الحسابات", "danger");
    }
  };

  return (
    <div className="animate-fade">
      <PageHeader title="عرض الحسابات" subtitle={`${rows.length} حساب من السيرفر`} icon={<ListChecks className="h-5 w-5" />} />
      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="بحث بالاسم أو الهاتف أو username" />
          <Button icon={<Search className="h-4 w-4" />} onClick={() => void load()}>تحديث</Button>
        </div>
        <Tabs
          tabs={[
            { id: "all", label: "الكل" },
            { id: "active", label: "نشط" },
            { id: "restricted", label: "مقيد" },
            { id: "blocked", label: "محظور" },
          ]}
          active={filter}
          onChange={(value) => setFilter(value as typeof filter)}
        />
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setSelected(filtered.map((a) => a.id))}>تحديد الكل</Button>
          <Button onClick={() => setSelected([])}>إلغاء الكل</Button>
          <Button variant="danger" disabled={selected.length === 0} icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirmDel(true)}>
            حذف المحدد ({selected.length})
          </Button>
        </div>
      </div>

      {loading ? <Spinner label="جاري تحميل الحسابات..." /> : filtered.length === 0 ? (
        <EmptyState icon={<Users className="h-8 w-8" />} title="لا توجد حسابات مطابقة" desc="جرّب تغيير الفلاتر أو أضف حسابًا جديدًا." />
      ) : (
        <Table
          columns={["", "#", "الهاتف", "الاسم", "الحالة", "البروكسي", "آخر استخدام", "", ""]}
          rows={filtered.map((account, index) => [
            <input type="checkbox" checked={selected.includes(account.id)} onChange={() => toggle(account.id)} className="h-4 w-4 accent-brand-600" />,
            String(index + 1),
            account.phone,
            account.name,
            <StatusChip status={account.status} />,
            proxies.find((p) => p.id === account.proxy_id)?.address || "—",
            account.last_used_label || "—",
            <Button onClick={() => push(["accounts", "detail", String(account.id)])}>تفاصيل</Button>,
            <Button variant="ghost" onClick={() => push(["accounts", "remove"])}>إزالة</Button>,
          ])}
        />
      )}

      <ConfirmDialog
        open={confirmDel}
        danger
        title="حذف الحسابات المحددة"
        message={`سيتم حذف ${selected.length} حساب نهائياً من قاعدة البيانات.`}
        confirmLabel="تأكيد الحذف"
        onConfirm={() => void deleteSelected()}
        onCancel={() => setConfirmDel(false)}
      />
      {node}
    </div>
  );
}

export function AccountDetail({ id }: { id: string }) {
  const { push } = useNav();
  const { show, node } = useToast();
  const [account, setAccount] = useState<AccountRecord | null>(null);
  const [proxies, setProxies] = useState<ProxyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [acc, proxyRows] = await Promise.all([
        apiFetch<AccountRecord>(`/accounts/${id}`),
        apiFetch<ProxyRecord[]>("/proxies"),
      ]);
      setAccount(acc);
      setProxies(proxyRows);
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر جلب تفاصيل الحساب", "danger");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const save = async () => {
    if (!account) return;
    setSaving(true);
    try {
      const updated = await apiFetch<AccountRecord>(`/accounts/${account.id}`, {
        method: "PUT",
        body: JSON.stringify({
          phone: account.phone,
          name: account.name,
          username: account.username || null,
          status: account.status,
          proxy_id: account.proxy_id,
          groups_count: account.groups_count,
          age_label: account.age_label || null,
          last_used_label: account.last_used_label || null,
          notes: account.notes || null,
        }),
      });
      setAccount(updated);
      show("تم حفظ التعديلات");
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر حفظ التعديلات", "danger");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!account) return;
    try {
      await apiFetch(`/accounts/${account.id}`, { method: "DELETE" });
      show("تم حذف الحساب");
      push(["accounts", "list"]);
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر حذف الحساب", "danger");
    }
  };

  if (loading) return <Spinner label="جاري تحميل بطاقة الحساب..." />;
  if (!account) return <EmptyState title="الحساب غير موجود" desc="ربما تم حذفه أو تغيّر المعرّف." />;

  const currentProxy = proxies.find((p) => p.id === account.proxy_id);
  const health = Math.max(35, Math.min(96, 60 + (account.groups_count || 0)));

  return (
    <div className="animate-fade">
      <PageHeader title={`بطاقة تفاصيل: ${account.name}`} subtitle={account.phone} icon={<Users className="h-5 w-5" />} />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-4">
          <div className="card p-5 space-y-3">
            <SectionTitle>المعلومات الأساسية</SectionTitle>
            <InlineEdit label="الاسم" value={account.name} onSave={(value) => setAccount({ ...account, name: value })} />
            <InlineEdit label="@username" value={account.username || ""} onSave={(value) => setAccount({ ...account, username: value })} placeholder="@username" />
            <InlineEdit label="ملاحظات" value={account.notes || ""} onSave={(value) => setAccount({ ...account, notes: value })} placeholder="لا توجد ملاحظات" />
            <Row label="الهاتف" value={account.phone} />
            <Row label="الحالة" value={<StatusChip status={account.status} />} />
            <Row label="آخر استخدام" value={account.last_used_label || "—"} />
            <Row label="عمر الحساب" value={account.age_label || "—"} />
            <Row label="عدد القروبات" value={String(account.groups_count)} />
          </div>

          <div className="card p-5 space-y-3">
            <SectionTitle icon={<Globe className="h-4 w-4" />}>البروكسي المرتبط</SectionTitle>
            <Alert tone="info" title={currentProxy ? currentProxy.address : "بدون بروكسي"}>{currentProxy ? `${currentProxy.proxy_type} — ${currentProxy.speed_ms ?? "—"}ms` : "اختر بروكسيًا نشطًا أو احفظ الحساب بدون بروكسي."}</Alert>
            <div className="grid gap-2">
              <OptionButton label="بدون بروكسي" selected={account.proxy_id === null} onClick={() => setAccount({ ...account, proxy_id: null })} />
              {proxies.filter((p) => p.status === "active").map((proxy) => (
                <OptionButton key={proxy.id} label={proxy.address} desc={`${proxy.proxy_type} — ${proxy.speed_ms ?? "—"}ms`} selected={account.proxy_id === proxy.id} onClick={() => setAccount({ ...account, proxy_id: proxy.id })} />
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-5 space-y-3">
            <SectionTitle>درجة الصحة التقديرية</SectionTitle>
            <Progress value={health} label={`${health}%`} tone={health >= 75 ? "brand" : health >= 50 ? "warn" : "danger"} />
            <div className="text-xs text-surface-500">
              يتم حسابها حالياً بناءً على الحالة الحالية وعدد القروبات وآخر استخدام، إلى حين ربط محرك Telethon الكامل.
            </div>
          </div>

          <div className="card p-5 space-y-2">
            <SectionTitle>الإجراءات</SectionTitle>
            <Button variant="primary" className="w-full" onClick={() => void save()} disabled={saving}>{saving ? "جاري الحفظ..." : "حفظ التعديلات"}</Button>
            <Button className="w-full" onClick={() => void load()}>تحديث من السيرفر</Button>
            <Button className="w-full" onClick={() => push(["accounts", "activity"])}>عرض السجلات</Button>
            <Button variant="danger" className="w-full" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirmDel(true)}>حذف هذا الحساب</Button>
            <Button className="w-full" onClick={() => push(["accounts", "list"])}>رجوع للقائمة</Button>
          </div>
        </div>
      </div>

      <ConfirmDialog open={confirmDel} danger title="حذف الحساب" message={`سيتم حذف ${account.phone} نهائياً.`} onConfirm={() => void remove()} onCancel={() => setConfirmDel(false)} />
      {node}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-surface-100 py-2">
      <span className="text-xs font-semibold text-surface-500">{label}</span>
      <span className="text-sm font-medium text-surface-700">{value}</span>
    </div>
  );
}

function ValidateAccounts() {
  const { show, node } = useToast();
  const [rows, setRows] = useState<AccountRecord[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [queueEnabled, setQueueEnabled] = useState<boolean | null>(null);
  const [result, setResult] = useState<AccountValidationResult | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<AccountRecord[]>("/accounts"),
      apiFetch<{ queue_available: boolean }>("/jobs/health").catch(() => ({ queue_available: false })),
    ])
      .then(([accountRows, jobHealth]) => {
        setRows(accountRows);
        setQueueEnabled(jobHealth.queue_available);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!jobId) return;
    const timer = window.setInterval(async () => {
      try {
        const status = await apiFetch<JobStatusResponse>(`/jobs/${jobId}`);
        if (status.status === "finished") {
          setResult(status.result as unknown as AccountValidationResult);
          setRunning(false);
          window.clearInterval(timer);
        }
        if (status.status === "failed") {
          show(status.error || "فشل تنفيذ المهمة", "danger");
          setRunning(false);
          window.clearInterval(timer);
        }
      } catch (err) {
        setRunning(false);
        window.clearInterval(timer);
        show(err instanceof Error ? err.message : "تعذر متابعة حالة المهمة", "danger");
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [jobId, show]);

  const startValidation = async (selectedOnly: boolean) => {
    setRunning(true);
    setResult(null);
    setJobId(null);
    try {
      const response = await apiFetch<JobStartResponse>("/jobs/accounts/validate", {
        method: "POST",
        body: JSON.stringify({
          account_ids: selectedOnly ? selected : null,
          run_inline: queueEnabled === false,
        }),
      });
      show(response.message);
      if (response.mode === "finished") {
        setResult(response.result as unknown as AccountValidationResult);
        setRunning(false);
      } else {
        setJobId(response.job_id || null);
      }
    } catch (err) {
      setRunning(false);
      show(err instanceof Error ? err.message : "تعذر بدء التحقق", "danger");
    }
  };

  const toggle = (id: number) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div className="animate-fade">
      <PageHeader title="التحقق من الصحة" subtitle="يدعم Worker/Queue مع fallback للتنفيذ المباشر" icon={<ShieldCheck className="h-5 w-5" />} />
      {loading ? <Spinner label="جاري تحميل الحسابات..." /> : (
        <div className="space-y-4">
          <Alert tone={queueEnabled ? "info" : "warn"} title={queueEnabled ? "قائمة الانتظار متاحة" : "قائمة الانتظار غير متاحة — سيتم التنفيذ المباشر"}>
            {queueEnabled ? "سيتم إرسال المهمة إلى Worker عند توفر Redis/Worker." : "النتيجة ستُنفذ مباشرة داخل الـ API إلى أن يتوفر Redis/Worker."}
          </Alert>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setSelected(rows.map((row) => row.id))}>تحديد الكل</Button>
            <Button onClick={() => setSelected([])}>إلغاء الكل</Button>
            <Button variant="primary" disabled={running} onClick={() => void startValidation(false)}>{running ? "جاري الفحص..." : "فحص كل الحسابات"}</Button>
            <Button disabled={running || selected.length === 0} onClick={() => void startValidation(true)}>فحص المحدد ({selected.length})</Button>
          </div>
          <Table columns={["", "الهاتف", "الاسم", "الحالة"]} rows={rows.map((row) => [
            <input type="checkbox" checked={selected.includes(row.id)} onChange={() => toggle(row.id)} className="h-4 w-4 accent-brand-600" />,
            row.phone,
            row.name,
            <StatusChip status={row.status} />,
          ])} />
          {running && <Progress value={jobId ? 55 : 80} label={jobId ? `المهمة في الانتظار: ${jobId}` : "جاري تنفيذ الفحص..."} sub={jobId ? "Queue" : "Inline"} tone="accent" />}
          {result && (
            <div className="space-y-4">
              <Alert tone="success" title="اكتمل التحقق">
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="chip bg-brand-50 text-brand-700 ring-1 ring-brand-200">نشط: {result.summary.active}</span>
                  <span className="chip bg-danger-50 text-danger-700 ring-1 ring-danger-200">محظور: {result.summary.blocked}</span>
                  <span className="chip bg-warn-50 text-warn-700 ring-1 ring-warn-200">مقيد: {result.summary.restricted}</span>
                  <span className="chip bg-surface-100 text-surface-600 ring-1 ring-surface-300">الإجمالي: {result.summary.total}</span>
                </div>
              </Alert>
              <Table columns={["الهاتف", "الاسم", "الحالة", "السبب", "آخر فحص"]} rows={result.rows.map((row) => [
                row.phone,
                row.name,
                <StatusChip status={row.status} />,
                row.reason,
                new Date(row.last_checked).toLocaleString("ar-SA"),
              ])} />
            </div>
          )}
        </div>
      )}
      {node}
    </div>
  );
}

function WarmupAccounts() {
  const { show, node } = useToast();
  const [rows, setRows] = useState<AccountRecord[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [days, setDays] = useState("7");
  const [intensity, setIntensity] = useState<"light" | "medium" | "intensive">("medium");
  const [queueEnabled, setQueueEnabled] = useState<boolean | null>(null);
  const [running, setRunning] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [result, setResult] = useState<WarmupResult | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<AccountRecord[]>("/accounts"),
      apiFetch<{ queue_available: boolean }>("/jobs/health").catch(() => ({ queue_available: false })),
    ]).then(([accountRows, jobHealth]) => {
      setRows(accountRows);
      setQueueEnabled(jobHealth.queue_available);
    });
  }, []);

  useEffect(() => {
    if (!jobId) return;
    const timer = window.setInterval(async () => {
      try {
        const status = await apiFetch<JobStatusResponse>(`/jobs/${jobId}`);
        if (status.status === "finished") {
          setResult(status.result as unknown as WarmupResult);
          setRunning(false);
          window.clearInterval(timer);
        }
        if (status.status === "failed") {
          show(status.error || "فشل تنفيذ التهيئة", "danger");
          setRunning(false);
          window.clearInterval(timer);
        }
      } catch (err) {
        setRunning(false);
        window.clearInterval(timer);
        show(err instanceof Error ? err.message : "تعذر متابعة حالة المهمة", "danger");
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [jobId, show]);

  const startWarmup = async () => {
    setRunning(true);
    setResult(null);
    try {
      const response = await apiFetch<JobStartResponse>("/jobs/accounts/warmup", {
        method: "POST",
        body: JSON.stringify({
          account_ids: selected.length ? selected : null,
          days: Number(days || 7),
          intensity,
          run_inline: queueEnabled === false,
        }),
      });
      show(response.message);
      if (response.mode === "finished") {
        setResult(response.result as unknown as WarmupResult);
        setRunning(false);
      } else {
        setJobId(response.job_id || null);
      }
    } catch (err) {
      setRunning(false);
      show(err instanceof Error ? err.message : "تعذر بدء التهيئة", "danger");
    }
  };

  const toggle = (id: number) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div className="animate-fade">
      <PageHeader title="تهيئة الحسابات" subtitle="خطة Warmup عبر Worker أو تنفيذ مباشر" icon={<Flame className="h-5 w-5" />} />
      <div className="space-y-4">
        <Alert tone={queueEnabled ? "info" : "warn"} title={queueEnabled ? "سيتم إرسال المهمة للـ Worker عند الحاجة" : "سيتم تجهيز الخطة مباشرة داخل الـ API"} />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card p-5 space-y-3">
            <SectionTitle>اختيار الحسابات</SectionTitle>
            <Button onClick={() => setSelected(rows.map((row) => row.id))}>تحديد الكل</Button>
            <div className="space-y-2">
              {rows.map((row) => (
                <Checkbox key={row.id} label={`${row.name} — ${row.phone}`} checked={selected.includes(row.id)} onChange={() => toggle(row.id)} />
              ))}
            </div>
          </div>
          <div className="card p-5 space-y-3">
            <SectionTitle>إعدادات الخطة</SectionTitle>
            <Field label="عدد الأيام" value={days} onChange={setDays} placeholder="7" />
            <div className="grid gap-2">
              <OptionButton label="خفيف" selected={intensity === "light"} onClick={() => setIntensity("light")} />
              <OptionButton label="متوسط" selected={intensity === "medium"} onClick={() => setIntensity("medium")} />
              <OptionButton label="مكثف" selected={intensity === "intensive"} onClick={() => setIntensity("intensive")} />
            </div>
            <Button variant="primary" className="w-full" disabled={running} onClick={() => void startWarmup()}>{running ? "جاري تجهيز الخطة..." : "بدء التهيئة"}</Button>
            {running && <Progress value={jobId ? 55 : 80} label={jobId ? `المهمة في الانتظار: ${jobId}` : "جاري تجهيز الخطة..."} sub={jobId ? "Queue" : "Inline"} tone="warn" />}
          </div>
        </div>
        {result && (
          <div className="card p-5 space-y-4">
            <Alert tone="success" title="تم تجهيز خطة التهيئة">
              <div className="space-y-1 text-xs">
                <div>عدد الحسابات: {result.summary.target_count}</div>
                <div>الأيام: {result.summary.days}</div>
                <div>الشدة: {result.summary.intensity}</div>
              </div>
            </Alert>
            <Table columns={["الهاتف", "الإجراء", "النتيجة"]} rows={result.steps.map((step) => [step.phone, step.action, step.result])} />
          </div>
        )}
      </div>
      {node}
    </div>
  );
}



function AccountPools() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [view, setView] = useState<"list"|"create"|"detail">("list");
  const [selectedPool, setSelectedPool] = useState<string|null>(null);
  const [poolName, setPoolName] = useState("");
  const [poolDesc, setPoolDesc] = useState("");
  const [poolPurpose, setPoolPurpose] = useState<"gather"|"add"|"dm"|"campaign"|"multi">("multi");
  const [confirmDel, setConfirmDel] = useState(false);

  const mockPools = [
    { name:"مجموعة A", count:4, active:3, purpose:"تجميع+إضافة" },
    { name:"مجموعة B", count:2, active:2, purpose:"تجميع فقط"   },
    { name:"مجموعة C", count:3, active:1, purpose:"متعدد الأغراض"},
  ];

  if (view === "create") {
    return (
      <div className="animate-fade">
        <PageHeader title="إنشاء مجموعة جديدة" icon={<LayersIcon className="h-5 w-5" />} />
        <div className="mx-auto max-w-lg card p-6 space-y-4">
          <Field label="اسم المجموعة" placeholder="مجموعة D" value={poolName} onChange={setPoolName} />
          <Field label="وصف المجموعة (اختياري)" placeholder="وصف..." value={poolDesc} onChange={setPoolDesc} />
          <SectionTitle>الغرض الرئيسي للمجموعة</SectionTitle>
          <OptionButton label="📥 تجميع فقط"              selected={poolPurpose==="gather"}   onClick={() => setPoolPurpose("gather")} />
          <OptionButton label="📤 إضافة فقط"              selected={poolPurpose==="add"}      onClick={() => setPoolPurpose("add")} />
          <OptionButton label="💬 رسائل فقط"              selected={poolPurpose==="dm"}       onClick={() => setPoolPurpose("dm")} />
          <OptionButton label="📢 حملات قروبات فقط"      selected={poolPurpose==="campaign"} onClick={() => setPoolPurpose("campaign")} />
          <OptionButton label="🔀 متعدد الأغراض"          selected={poolPurpose==="multi"}    onClick={() => setPoolPurpose("multi")} />
          <div className="flex gap-2 pt-2">
            <Button variant="primary" className="flex-1" disabled={!poolName} onClick={() => { show("تم إنشاء المجموعة"); setView("list"); setPoolName(""); }}>💾 حفظ المجموعة</Button>
            <Button onClick={() => setView("list")}>❌ إلغاء</Button>
          </div>
        </div>
        {node}
      </div>
    );
  }

  if (view === "detail" && selectedPool) {
    const pool = mockPools.find(p=>p.name===selectedPool)!;
    const poolAccounts = accounts.slice(0,pool.count);
    const [addMode, setAddMode] = useState(false);
    const [toAdd, setToAdd]     = useState<number[]>([]);
    const [toRemove, setToRemove] = useState<number[]>([]);
    return (
      <div className="animate-fade">
        <PageHeader title={`مجموعة: ${pool.name}`} icon={<LayersIcon className="h-5 w-5" />} />
        <div className="space-y-4">
          <div className="card p-5">
            <div className="mb-3 flex flex-wrap gap-2 text-xs text-surface-500">
              <span>الاسم: {pool.name}</span>
              <span>الغرض: {pool.purpose}</span>
              <span>الحسابات: {pool.count}</span>
            </div>
            <Table columns={["#","اسم","هاتف","حالة"]} rows={poolAccounts.map((a,i)=>[
              String(i+1), a.name, a.phone, <StatusChip status={a.status} />
            ])} />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Button className="w-full" onClick={() => setAddMode(!addMode)}>➕ إضافة حسابات للمجموعة</Button>
            <Button className="w-full" onClick={() => show("تم تعديل المجموعة")}>✏️ تعديل الاسم/الغرض</Button>
            <Button variant="danger" className="w-full" onClick={() => setConfirmDel(true)}>🗑️ حذف المجموعة</Button>
          </div>
          {addMode && (
            <div className="card p-4 space-y-2">
              <SectionTitle>اختر الحسابات للإضافة</SectionTitle>
              {accounts.slice(pool.count).map((a) => (
                <Checkbox key={a.id} label={`${a.name} — ${a.phone}`}
                  checked={toAdd.includes(a.id)}
                  onChange={() => setToAdd((s)=>s.includes(a.id)?s.filter(x=>x!==a.id):[...s,a.id])} />
              ))}
              <Button variant="primary" disabled={toAdd.length===0} onClick={() => { show(`تم إضافة ${toAdd.length} حساب`); setAddMode(false); setToAdd([]); }}>✅ إضافة المحدد</Button>
            </div>
          )}
          <Button onClick={() => setView("list")}>🔙 رجوع</Button>
        </div>
        <ConfirmDialog open={confirmDel} danger title="حذف المجموعة" message={`سيتم حذف مجموعة "${pool.name}" نهائياً.`}
          onConfirm={() => { setConfirmDel(false); show("تم حذف المجموعة"); setView("list"); }}
          onCancel={() => setConfirmDel(false)} />
        {node}
      </div>
    );
  }

  return (
    <div className="animate-fade">
      <PageHeader title="مجموعات الحسابات (Account Pools)" icon={<LayersIcon className="h-5 w-5" />} />
      <div className="space-y-4">
        <Button variant="primary" onClick={() => setView("create")}>➕ إنشاء مجموعة جديدة</Button>
        <Table columns={["اسم","عدد","نشط","الغرض",""]} rows={mockPools.map((p) => [
          p.name, String(p.count), String(p.active), p.purpose,
          <Button onClick={() => { setSelectedPool(p.name); setView("detail"); }}>إدارة</Button>,
        ])} />
      </div>
      {node}
    </div>
  );
}

/* ── HealthScore ── */

function IndividualSettings() {
  const { show, node } = useToast();
  const [selected, setSelected] = useState<number|null>(null);
  const [gatherLimit, setGatherLimit] = useState("500");
  const [addLimit, setAddLimit]       = useState("20");
  const [dmLimit, setDmLimit]         = useState("30");
  const [delayFrom, setDelayFrom]     = useState("60");
  const [delayTo, setDelayTo]         = useState("120");
  const [priority, setPriority]       = useState<"high"|"mid"|"low">("mid");
  const [perms, setPerms] = useState({ gather:true, add:true, dm:true, campaign:true, rotation:true });
  const [limitHours, setLimitHours]   = useState(false);
  const [fromH, setFromH]             = useState("08:00");
  const [toH, setToH]                 = useState("22:00");

  if (selected === null) {
    return (
      <div className="animate-fade">
        <PageHeader title="إعدادات فردية للحساب" icon={<Settings2 className="h-5 w-5" />} />
        <div className="space-y-2">
          {accounts.map((a) => (
            <OptionButton key={a.id} label={`${a.name} — ${a.phone}`} desc={a.status} onClick={() => setSelected(a.id)} />
          ))}
        </div>
      </div>
    );
  }

  const acc = accounts.find(a=>a.id===selected)!;
  return (
    <div className="animate-fade">
      <PageHeader title={`إعدادات: ${acc.name}`} subtitle={acc.phone} icon={<Settings2 className="h-5 w-5" />} />
      <div className="space-y-4">
        <div className="card p-5 space-y-3">
          <SectionTitle>الحدود اليومية الخاصة</SectionTitle>
          <InlineEdit label={`📥 حد التجميع اليومي [افتراضي: 500]`} value={gatherLimit} onSave={setGatherLimit} placeholder="500" />
          <InlineEdit label={`📤 حد الإضافة اليومي [افتراضي: 20]`}  value={addLimit}    onSave={setAddLimit}    placeholder="20" />
          <InlineEdit label={`💬 حد الرسائل اليومي [افتراضي: 30]`}  value={dmLimit}     onSave={setDmLimit}     placeholder="30" />
          <div className="flex gap-2">
            <InlineEdit label="⏱️ التأخير من (ث)" value={delayFrom} onSave={setDelayFrom} placeholder="60" />
            <InlineEdit label="إلى (ث)"           value={delayTo}   onSave={setDelayTo}   placeholder="120" />
          </div>
        </div>
        <div className="card p-5 space-y-3">
          <SectionTitle>الأولوية في التدوير</SectionTitle>
          <OptionButton label="🔴 عالية (يُستخدم أولاً)"   selected={priority==="high"} onClick={() => setPriority("high")} />
          <OptionButton label="🟡 متوسطة (افتراضي)"        selected={priority==="mid"}  onClick={() => setPriority("mid")} />
          <OptionButton label="🟢 منخفضة (احتياطي)"        selected={priority==="low"}  onClick={() => setPriority("low")} />
        </div>
        <div className="card p-5 space-y-3">
          <SectionTitle>القيود الخاصة</SectionTitle>
          <Checkbox label="استخدامه في التجميع"         checked={perms.gather}   onChange={(v)=>setPerms({...perms,gather:v})} />
          <Checkbox label="استخدامه في الإضافة"         checked={perms.add}      onChange={(v)=>setPerms({...perms,add:v})} />
          <Checkbox label="استخدامه في الرسائل الجماعية" checked={perms.dm}       onChange={(v)=>setPerms({...perms,dm:v})} />
          <Checkbox label="استخدامه في حملات القروبات"  checked={perms.campaign} onChange={(v)=>setPerms({...perms,campaign:v})} />
          <Checkbox label="تفعيله في نظام التدوير"      checked={perms.rotation} onChange={(v)=>setPerms({...perms,rotation:v})} />
        </div>
        <div className="card p-5 space-y-3">
          <SectionTitle>ساعات العمل المسموحة</SectionTitle>
          <Checkbox label="تقييد ساعات العمل" checked={limitHours} onChange={setLimitHours} />
          {limitHours && (
            <div className="flex gap-2">
              <InlineEdit label="من الساعة" value={fromH} onSave={setFromH} placeholder="08:00" />
              <InlineEdit label="إلى الساعة" value={toH}  onSave={setToH}   placeholder="22:00" />
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="primary" className="flex-1" onClick={() => { show("💾 تم حفظ الإعدادات"); setSelected(null); }}>💾 حفظ الإعدادات</Button>
          <Button onClick={() => setSelected(null)}>🔙 رجوع</Button>
        </div>
      </div>
      {node}
    </div>
  );
}

/* ── ProfileManager ── */
function ProfileManager() {
  const { show, node } = useToast();
  const [mode, setMode] = useState<"list"|"single"|"bulk">("list");
  const [selected, setSelected] = useState<number|null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [uname, setUname]         = useState("");
  const [bio, setBio]             = useState("");
  const [saving, setSaving]       = useState(false);
  const [bulkSelected, setBulkSelected] = useState<number[]>([]);
  const [bulkChanges, setBulkChanges] = useState({ photos:false, names:false, bio:false });
  const [photoDir, setPhotoDir]   = useState("/photos/");
  const [namesFile, setNamesFile] = useState("/names.txt");
  const [bioFile, setBioFile]     = useState("/bios.txt");
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);

  if (mode === "single" && selected !== null) {
    const acc = accounts.find(a=>a.id===selected)!;
    return (
      <div className="animate-fade">
        <PageHeader title={`تعديل ملف: ${acc.name}`} icon={<Image className="h-5 w-5" />} />
        <div className="mx-auto max-w-lg card p-6 space-y-3">
          <SectionTitle>📸 صورة الملف الشخصي</SectionTitle>
          <div className="grid grid-cols-3 gap-2">
            <Button onClick={() => show("رفع صورة")}>📁 رفع صورة</Button>
            <Button onClick={() => show("مجلد صور")}>📂 من مجلد</Button>
            <Button variant="danger" onClick={() => show("تم حذف الصورة")}>❌ حذف الصورة</Button>
          </div>
          <Field label="✏️ الاسم الأول"    placeholder="الاسم"     value={firstName} onChange={setFirstName} />
          <Field label="✏️ اسم العائلة"   placeholder="العائلة"   value={lastName}  onChange={setLastName} />
          <Field label="✏️ @username"      placeholder="@username" value={uname}     onChange={setUname} />
          <Field label="✏️ السيرة الذاتية (Bio)" placeholder="Bio..." value={bio}  onChange={setBio} />
          <div className="flex gap-2 pt-2">
            <Button variant="primary" className="flex-1" disabled={saving}
              onClick={() => { setSaving(true); setTimeout(()=>{ setSaving(false); show("✅ تم التعديل بنجاح"); setMode("list"); },1500); }}>
              {saving ? "⏳ جاري التطبيق..." : "💾 حفظ التعديلات"}
            </Button>
            <Button onClick={() => setMode("list")}>🔙 رجوع</Button>
          </div>
        </div>
        {node}
      </div>
    );
  }

  if (mode === "bulk") {
    return (
      <div className="animate-fade">
        <PageHeader title="تعديل جماعي (Bulk Profile Edit)" icon={<Image className="h-5 w-5" />} />
        <div className="card p-5 space-y-3">
          <SectionTitle>اختر الحسابات</SectionTitle>
          {accounts.map((a) => (
            <Checkbox key={a.id} label={`${a.name} — ${a.phone}`}
              checked={bulkSelected.includes(a.id)}
              onChange={() => setBulkSelected(s=>s.includes(a.id)?s.filter(x=>x!==a.id):[...s,a.id])} />
          ))}
          <SectionTitle>ماذا تريد تغيير</SectionTitle>
          <Checkbox label="تغيير الصور (من مجلد عشوائي)" checked={bulkChanges.photos} onChange={(v)=>setBulkChanges({...bulkChanges,photos:v})} />
          {bulkChanges.photos && <InlineEdit label="مسار مجلد الصور" value={photoDir} onSave={setPhotoDir} placeholder="/photos/" />}
          <Checkbox label="تغيير الأسماء (من قائمة)"       checked={bulkChanges.names}  onChange={(v)=>setBulkChanges({...bulkChanges,names:v})} />
          {bulkChanges.names && <InlineEdit label="مسار ملف الأسماء" value={namesFile} onSave={setNamesFile} placeholder="/names.txt" />}
          <Checkbox label="تغيير البيو (من قائمة)"          checked={bulkChanges.bio}    onChange={(v)=>setBulkChanges({...bulkChanges,bio:v})} />
          {bulkChanges.bio && <InlineEdit label="مسار ملف البيو" value={bioFile} onSave={setBioFile} placeholder="/bios.txt" />}
          {!bulkRunning && bulkProgress===0 && (
            <Button variant="primary" className="w-full" disabled={bulkSelected.length===0}
              onClick={() => { setBulkRunning(true); const t=setInterval(()=>{ setBulkProgress(p=>{ if(p>=100){clearInterval(t);setBulkRunning(false);return 100;}return p+10; }); },150); }}>
              ✅ بدء التعديل الجماعي
            </Button>
          )}
          {bulkRunning && <Progress value={bulkProgress} label="🖼️ جاري التعديل..." sub={`${bulkProgress}%`} tone="accent" />}
          {bulkProgress===100 && <Alert tone="success" title="✅ اكتمل التعديل الجماعي" />}
          {!bulkRunning && <Button onClick={() => setMode("list")}>❌ إلغاء</Button>}
        </div>
        {node}
      </div>
    );
  }

  return (
    <div className="animate-fade">
      <PageHeader title="إدارة ملفات الشخصية (Profile Manager)" icon={<Image className="h-5 w-5" />} />
      <div className="space-y-3">
        <Button variant="primary" onClick={() => setMode("bulk")}>🔀 تعديل جماعي</Button>
        <Table columns={["اسم","هاتف","username",""]} rows={accounts.map((a) => [
          a.name, a.phone, a.username,
          <Button onClick={() => { setSelected(a.id); setMode("single"); }}>✏️ تعديل</Button>,
        ])} />
      </div>
      {node}
    </div>
  );
}

/* ── ActivityLog ── */

function AccountSecurity() {
  const { show, node } = useToast();
  const [tab, setTab]       = useState<"scan"|"sessions"|"2fa">("scan");
  const [scanning, setScanning] = useState(false);
  const [scanDone, setScanDone] = useState(false);
  const [selectedAcc, setSelectedAcc] = useState<number|null>(null);
  const [curPass, setCurPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confPass, setConfPass] = useState("");
  const [saving, setSaving]   = useState(false);

  return (
    <div className="animate-fade">
      <PageHeader title="أمان الحسابات (Account Security)" icon={<Lock className="h-5 w-5" />} />
      <div className="space-y-4">
        <Tabs tabs={[{id:"scan",label:"🛡️ فحص أمان"},{id:"sessions",label:"📱 الأجهزة"},{id:"2fa",label:"🔐 2FA"}]}
          active={tab} onChange={(v)=>setTab(v as typeof tab)} />

        {tab === "scan" && (
          <div className="card p-5 space-y-4">
            {!scanning && !scanDone && (
              <Button variant="primary" className="w-full" onClick={() => { setScanning(true); setTimeout(()=>{ setScanning(false); setScanDone(true); },2000); }}>
                🛡️ بدء فحص أمان شامل
              </Button>
            )}
            {scanning && (
              <div>
                <Progress value={70} label="🔍 جاري الفحص..." sub="70%" tone="accent" />
                <p className="mt-2 text-xs text-surface-500">يفحص: الجلسة | النشاط المشبوه | تسجيلات الدخول</p>
              </div>
            )}
            {scanDone && (
              <div className="space-y-3">
                <Table columns={["حساب","نتيجة","الجلسة","التوصية"]} rows={[
                  ["+966501234567","✅ آمن","سليمة","—"],
                  ["+966552345678","⚠️ مشبوه","نشاط غير معتاد","مراجعة"],
                  ["+966563456789","✅ آمن","سليمة","—"],
                ]} />
                <Button onClick={() => show("تم تصدير التقرير")}>📊 عرض التقرير المفصل</Button>
              </div>
            )}
          </div>
        )}

        {tab === "sessions" && (
          <div className="space-y-3">
            {selectedAcc === null ? (
              <div className="card p-4 space-y-2">
                <SectionTitle>اختر حساباً</SectionTitle>
                {accounts.map((a) => (
                  <OptionButton key={a.id} label={`${a.name} — ${a.phone}`} onClick={() => setSelectedAcc(a.id)} />
                ))}
              </div>
            ) : (
              <div className="card p-5 space-y-3">
                <SectionTitle>📱 الأجهزة المتصلة حالياً</SectionTitle>
                <Table columns={["جهاز","تطبيق","IP","آخر نشاط",""]} rows={[
                  ["iPhone 15","Telegram 10.0","185.12.45.10","الآن",     <Button variant="danger" onClick={()=>show("تم الإنهاء")}>❌ إنهاء</Button>],
                  ["Samsung S23","Telegram 9.8","94.21.10.5", "قبل ساعة", <Button variant="danger" onClick={()=>show("تم الإنهاء")}>❌ إنهاء</Button>],
                ]} />
                <div className="flex gap-2">
                  <Button variant="danger" className="flex-1" onClick={() => show("تم إنهاء جميع الجلسات")}>❌ إنهاء جميع الجلسات (عدا الحالية)</Button>
                  <Button onClick={() => setSelectedAcc(null)}>🔙 رجوع</Button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "2fa" && (
          <div className="space-y-3">
            {selectedAcc === null ? (
              <div className="card p-4 space-y-2">
                <SectionTitle>اختر حساباً</SectionTitle>
                {accounts.map((a) => (
                  <OptionButton key={a.id} label={`${a.name} — ${a.phone}`} onClick={() => setSelectedAcc(a.id)} />
                ))}
              </div>
            ) : (
              <div className="card p-5 space-y-3">
                <SectionTitle>🔐 تحديث كلمة مرور 2FA</SectionTitle>
                <Field label="كلمة المرور الحالية"   type="password" placeholder="••••••••" value={curPass} onChange={setCurPass} />
                <Field label="كلمة المرور الجديدة"   type="password" placeholder="••••••••" value={newPass} onChange={setNewPass} />
                <Field label="تأكيد كلمة المرور الجديدة" type="password" placeholder="••••••••" value={confPass} onChange={setConfPass} />
                <div className="flex gap-2">
                  <Button variant="primary" className="flex-1" disabled={saving||!curPass||!newPass||newPass!==confPass}
                    onClick={() => { setSaving(true); setTimeout(()=>{ setSaving(false); show("✅ تم تغيير كلمة المرور"); setSelectedAcc(null); setCurPass(""); setNewPass(""); setConfPass(""); },1500); }}>
                    {saving ? "⏳ جاري التغيير..." : "💾 تطبيق التغيير"}
                  </Button>
                  <Button onClick={() => setSelectedAcc(null)}>🔙 رجوع</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {node}
    </div>
  );
}

function RemoveAccount() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [rows, setRows] = useState<AccountRecord[]>([]);
  const [value, setValue] = useState("");
  const [match, setMatch] = useState<AccountRecord | null>(null);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    apiFetch<AccountRecord[]>("/accounts").then(setRows).catch(() => setRows([]));
  }, []);

  useEffect(() => {
    const q = value.trim();
    if (!q) return setMatch(null);
    setMatch(rows.find((row) => row.phone === q || String(row.id) === q || row.name === q) || null);
  }, [value, rows]);

  const remove = async () => {
    if (!match) return;
    try {
      await apiFetch(`/accounts/${match.id}`, { method: "DELETE" });
      show("تم حذف الحساب");
      push(["accounts", "list"]);
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر حذف الحساب", "danger");
    }
  };

  return (
    <div className="animate-fade">
      <PageHeader title="إزالة حساب" icon={<Trash2 className="h-5 w-5" />} />
      <div className="mx-auto max-w-lg card p-6 space-y-4">
        <Field label="رقم الحساب أو الهاتف أو الاسم" placeholder="+9665XXXXXXXX" value={value} onChange={setValue} />
        {value && !match && <Alert tone="warn" title="لم يتم العثور على حساب مطابق">تأكد من رقم الهاتف أو معرّف الحساب.</Alert>}
        {match && <Alert tone="info" title={`تم العثور على: ${match.name}`}>{match.phone}</Alert>}
        <div className="flex gap-2">
          <Button variant="danger" className="flex-1" disabled={!match} onClick={() => setConfirm(true)}>حذف هذا الحساب</Button>
          <Button onClick={() => push(["accounts"])}>إلغاء</Button>
        </div>
      </div>
      <ConfirmDialog open={confirm} danger title="تأكيد حذف الحساب" message={`سيتم حذف ${match?.phone ?? "الحساب"} نهائياً.`} onConfirm={() => void remove()} onCancel={() => setConfirm(false)} />
      {node}
    </div>
  );
}

function AutoRemove({ inline }: { inline?: boolean }) {
  const { push } = useNav();
  const { show, node } = useToast();
  const [rows, setRows] = useState<AccountRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<AccountRecord[]>("/accounts");
      setRows(data.filter((row) => row.status === "blocked" || row.status === "restricted"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const removeAll = async () => {
    try {
      await Promise.all(rows.map((row) => apiFetch(`/accounts/${row.id}`, { method: "DELETE" })));
      show("تم حذف الحسابات المحظورة/المقيدة");
      setConfirm(false);
      await load();
      if (!inline) push(["accounts", "list"]);
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر إزالة الحسابات", "danger");
    }
  };

  const content = loading ? <Spinner label="جاري فحص الحسابات..." /> : rows.length === 0 ? (
    <Alert tone="success" title="لا توجد حسابات محظورة أو مقيدة حالياً" />
  ) : (
    <div className="space-y-4">
      <Alert tone="warn" title={`وُجد: ${rows.length} حساب يحتاج إزالة`} />
      <Table columns={["الهاتف", "الاسم", "الحالة"]} rows={rows.map((row) => [row.phone, row.name, <StatusChip status={row.status} />])} />
      <div className="flex gap-2">
        <Button variant="danger" className="flex-1" onClick={() => setConfirm(true)}>تأكيد الإزالة</Button>
        {!inline && <Button onClick={() => push(["accounts"])}>إلغاء</Button>}
      </div>
    </div>
  );

  if (inline) {
    return (
      <>
        {content}
        <ConfirmDialog open={confirm} danger title="إزالة الحسابات المحظورة" message={`سيتم حذف ${rows.length} حساب.`} onConfirm={() => void removeAll()} onCancel={() => setConfirm(false)} />
        {node}
      </>
    );
  }

  return (
    <div className="animate-fade">
      <PageHeader title="إزالة تلقائية للمحظورة" icon={<Zap className="h-5 w-5" />} />
      <div className="mx-auto max-w-3xl card p-6">{content}</div>
      <ConfirmDialog open={confirm} danger title="إزالة الحسابات المحظورة" message={`سيتم حذف ${rows.length} حساب.`} onConfirm={() => void removeAll()} onCancel={() => setConfirm(false)} />
      {node}
    </div>
  );
}

function HealthScore() {
  const [rows, setRows] = useState<AccountRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<AccountRecord[]>("/accounts").then(setRows).finally(() => setLoading(false));
  }, []);

  const healthData = rows.map((account) => ({
    ...account,
    score: Math.max(35, Math.min(96, (account.status === "active" ? 72 : account.status === "restricted" ? 54 : 38) + Math.min(account.groups_count, 20))),
  }));

  return (
    <div className="animate-fade">
      <PageHeader title="درجة صحة الحسابات" icon={<Heart className="h-5 w-5" />} />
      {loading ? <Spinner label="جاري احتساب الدرجات..." /> : (
        <Table columns={["الاسم", "الهاتف", "الدرجة", "التقييم"]} rows={healthData.map((account) => [
          account.name,
          account.phone,
          <div className="min-w-[140px]"><Progress value={account.score} tone={account.score >= 75 ? "brand" : account.score >= 50 ? "warn" : "danger"} /></div>,
          <span className={`chip ring-1 ${account.score >= 75 ? "bg-brand-50 text-brand-700 ring-brand-200" : account.score >= 50 ? "bg-warn-50 text-warn-700 ring-warn-200" : "bg-danger-50 text-danger-700 ring-danger-200"}`}>{account.score >= 75 ? "جيد" : account.score >= 50 ? "متوسط" : "ضعيف"}</span>,
        ])} />
      )}
    </div>
  );
}

function ActivityLog() {
  const [logs, setLogs] = useState<ActivityLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState("20");

  const load = async (nextLimit = limit) => {
    setLoading(true);
    try {
      const data = await apiFetch<ActivityLogRecord[]>(`/reports/activity?limit=${encodeURIComponent(nextLimit)}`);
      setLogs(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="animate-fade">
      <PageHeader title="سجل نشاط الحسابات" subtitle="من الـ Audit Log في السيرفر" icon={<Activity className="h-5 w-5" />} />
      <div className="mb-4 flex flex-wrap gap-2">
        <OptionButton label="آخر 20 سجل" selected={limit === "20"} onClick={() => { setLimit("20"); void load("20"); }} />
        <OptionButton label="آخر 50 سجل" selected={limit === "50"} onClick={() => { setLimit("50"); void load("50"); }} />
        <OptionButton label="آخر 100 سجل" selected={limit === "100"} onClick={() => { setLimit("100"); void load("100"); }} />
      </div>
      {loading ? <Spinner label="جاري تحميل السجلات..." /> : logs.length === 0 ? (
        <EmptyState title="لا توجد سجلات بعد" desc="ستظهر السجلات هنا عند إنشاء/تعديل/حذف الحسابات أو غيرها من العمليات." />
      ) : (
        <Table columns={["الوقت", "الإجراء", "النوع", "الرسالة"]} rows={logs.map((log) => [
          new Date(log.created_at).toLocaleString("ar-SA"),
          log.action,
          log.entity_type || log.level,
          log.message,
        ])} />
      )}
    </div>
  );
}
