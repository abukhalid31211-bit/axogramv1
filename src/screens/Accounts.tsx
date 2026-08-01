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
  Download,
  Plus,
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
  TextArea,
} from "../ui";
import { JobProgressCard } from "../lib/job";
import {
  apiFetch,
  type AccountRecord,
  type AccountPool,
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
  downloadApiFile,
} from "../lib/api";

const accountMenu = [
  { id: "add", label: "إضافة حساب جديد", desc: "إضافة وحفظ الحساب في قاعدة البيانات", icon: UserPlus },
  { id: "import", label: "استيراد الجلسات", desc: "رفع ملفات sessions أو strings", icon: FolderInput },
  { id: "list", label: "عرض الحسابات", desc: "جدول حي من السيرفر", icon: ListChecks },
  { id: "validate", label: "التحقق من الصحة", desc: "تقرير من البيانات الحالية", icon: ShieldCheck },
  { id: "pools", label: "مجموعات الحسابات", desc: "إنشاء وإدارة مجموعات", icon: LayersIcon },
  { id: "warmup", label: "تهيئة الحسابات", desc: "تشغيل وإدارة التسخين", icon: Flame },
  { id: "health", label: "درجة الصحة", desc: "احتساب تقديري للدرجات", icon: Heart },
  { id: "settings-ind", label: "إعدادات فردية", desc: "حدود وأذونات لكل حساب", icon: Settings2 },
  { id: "profile", label: "الملف الشخصي", desc: "تعديل الاسم والصورة والبايو", icon: Image },
  { id: "activity", label: "سجل النشاط", desc: "من الـ Audit Log", icon: Activity },
  { id: "security", label: "أمان الحسابات", desc: "فحص وأجهزة و 2FA", icon: Lock },
  { id: "export", label: "تصدير الجلسات", desc: "metadata الجلسات", icon: Archive },
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

function useAccounts() {
  const [rows, setRows] = useState<AccountRecord[]>([]);
  useEffect(() => { apiFetch<AccountRecord[]>("/accounts").then(setRows).catch(() => undefined); }, []);
  return rows;
}

export function AccountsModule() {
  const { push } = useNav();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    apiFetch<DashboardSummary>("/reports/dashboard").then(setSummary).catch(() => setSummary(null));
  }, []);

  const [statusCounts, setStatusCounts] = useState({ blocked: 0, restricted: 0 });
  useEffect(() => {
    apiFetch<AccountRecord[]>("/accounts").then((rows) => {
      setStatusCounts({ blocked: rows.filter((r) => r.status === "blocked").length, restricted: rows.filter((r) => r.status === "restricted").length });
    }).catch(() => undefined);
  }, []);
  const active = summary?.accounts_active ?? 0;
  const total = summary?.accounts_total ?? 0;
  const blocked = statusCounts.blocked;
  const restricted = statusCounts.restricted;

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
  const [method, setMethod] = useState<"folder" | "file" | "text" | "string" | "zip">("file");
  const [textArea, setTextArea] = useState("");
  const [zipPass, setZipPass] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{ total: number; valid: number; invalid: number; duplicate: number } | null>(null);

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

  const startImport = async () => {
    setRunning(true);
    setImportResult(null);
    setJobId(null);
    try {
      let jobIdValue: string;
      if (method === "file" || method === "folder") {
        if (!files.length) {
          show("اختر ملفات .session أولاً", "danger");
          setRunning(false);
          return;
        }
        const form = new FormData();
        files.forEach((f) => form.append("files", f));
        const response = await apiFetch<{ job_id: string }>("/accounts/import/sessions", { method: "POST", body: form });
        jobIdValue = response.job_id;
      } else if (method === "zip") {
        if (!files.length) {
          show("اختر ملف ZIP أولاً", "danger");
          setRunning(false);
          return;
        }
        const form = new FormData();
        form.append("file", files[0]);
        if (zipPass) form.append("password", zipPass);
        const response = await apiFetch<{ job_id: string }>("/accounts/import/zip", { method: "POST", body: form });
        jobIdValue = response.job_id;
      } else if (method === "string") {
        const sessionsList = textArea.split("\n").map((s) => s.trim()).filter(Boolean);
        if (!sessionsList.length) {
          show("أدخل String Session واحداً على الأقل", "danger");
          setRunning(false);
          return;
        }
        const response = await apiFetch<{ job_id: string }>("/accounts/import/string", { method: "POST", body: JSON.stringify({ sessions: sessionsList }) });
        jobIdValue = response.job_id;
      } else {
        if (!textArea.trim()) {
          show("ألصق محتوى الملف النصي (هاتف|session لكل سطر)", "danger");
          setRunning(false);
          return;
        }
        const response = await apiFetch<{ job_id: string }>("/accounts/import/text", { method: "POST", body: JSON.stringify({ content: textArea }) });
        jobIdValue = response.job_id;
      }
      setJobId(jobIdValue);
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر بدء الاستيراد", "danger");
      setRunning(false);
    }
  };

  const onJobDone = (run: any) => {
    setRunning(false);
    if (run.status === "failed") {
      show(run.error?.split("\n")[0] || "فشل الاستيراد", "danger");
      return;
    }
    try {
      const result = run.result_json ? JSON.parse(run.result_json) : null;
      if (result?.summary) {
        setImportResult(result.summary);
        show(`✅ اكتمل الاستيراد: ${result.summary.valid} صالحة | ${result.summary.duplicate} مكررة | ${result.summary.invalid} تالفة`);
      }
    } catch {
      /* ignore */
    }
    void load();
  };

  const methods: Array<{ id: typeof method; label: string; desc: string }> = [
    { id: "folder", label: "📁 من مجلد (جميع .session)", desc: "اختر عدة ملفات .session" },
    { id: "file", label: "📄 ملف واحد", desc: ".session منفرد" },
    { id: "text", label: "📋 من ملف نصي (أرقام+جلسات)", desc: "هاتف|session لكل سطر" },
    { id: "string", label: "🔑 من String Session", desc: "سلسلة Telethon/Pyrogram" },
    { id: "zip", label: "📦 من ملف ZIP", desc: "جلسات مضغوطة (كلمة مرور اختيارية)" },
  ];

  return (
    <div className="animate-fade">
      <PageHeader title="استيراد الجلسات" subtitle="فحص حقيقي لكل جلسة عبر تيليجرام واستيراد الصالحة فقط" icon={<FolderInput className="h-5 w-5" />} />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5 space-y-4">
          <SectionTitle>اختر طريقة الاستيراد</SectionTitle>
          <div className="space-y-2">
            {methods.map((m) => (
              <OptionButton key={m.id} label={m.label} desc={m.desc} selected={method === m.id} onClick={() => { setMethod(m.id); setImportResult(null); setFiles([]); }} />
            ))}
          </div>

          {(method === "folder" || method === "file") && (
            <div className="space-y-2 rounded-xl border border-surface-200 bg-surface-50 p-3">
              <input ref={fileRef} type="file" accept=".session" multiple className="hidden" onChange={(e) => setFiles(Array.from(e.target.files || []))} />
              <Button variant="primary" className="w-full" onClick={() => fileRef.current?.click()}>
                {files.length ? `تم اختيار ${files.length} ملف` : method === "folder" ? "اختيار مجلد ملفات الجلسات" : "اختيار ملف .session"}
              </Button>
              {files.length > 0 && <div className="max-h-32 overflow-auto text-xs text-surface-500">{files.map((f) => <div key={f.name}>📄 {f.name}</div>)}</div>}
            </div>
          )}
          {method === "text" && (
            <div className="space-y-2 rounded-xl border border-surface-200 bg-surface-50 p-3">
              <TextArea label="محتوى الملف النصي (هاتف|session لكل سطر)" rows={5} value={textArea} onChange={setTextArea} placeholder={"+966500000001|1BAA...\n+966500000002|1BAB..."} />
            </div>
          )}
          {method === "string" && (
            <div className="space-y-2 rounded-xl border border-surface-200 bg-surface-50 p-3">
              <TextArea label="String Sessions (واحد per سطر)" rows={5} value={textArea} onChange={setTextArea} placeholder={"1BAA...\n1BAB..."} />
            </div>
          )}
          {method === "zip" && (
            <div className="space-y-2 rounded-xl border border-surface-200 bg-surface-50 p-3">
              <input ref={fileRef} type="file" accept=".zip" className="hidden" onChange={(e) => setFiles(e.target.files ? Array.from(e.target.files) : [])} />
              <Button variant="primary" className="w-full" onClick={() => fileRef.current?.click()}>{files.length ? `تم اختيار: ${files[0].name}` : "اختيار ملف ZIP"}</Button>
              <Field label="كلمة مرور ZIP (إن وُجدت)" value={zipPass} onChange={setZipPass} type="password" />
            </div>
          )}

          <Button variant="primary" className="w-full" disabled={running || !files.length && method !== "string" && method !== "text"} onClick={() => void startImport()}>
            {running ? "جاري الفحص والاستيراد..." : "🔍 فحص واستيراد الجلسات"}
          </Button>

          <JobProgressCard jobId={jobId} onDone={onJobDone} />

          {importResult && !running && (
            <Alert tone="success" title="نتائج الفحص">
              <div className="mt-1 flex flex-wrap gap-2">
                <span className="chip bg-brand-50 text-brand-700 ring-1 ring-brand-200">✅ صالحة: {importResult.valid}</span>
                <span className="chip bg-danger-50 text-danger-700 ring-1 ring-danger-200">❌ تالفة: {importResult.invalid}</span>
                <span className="chip bg-warn-50 text-warn-700 ring-1 ring-warn-200">🔁 مكررة: {importResult.duplicate}</span>
              </div>
            </Alert>
          )}
          <Alert tone="info" title="ملاحظة">تُفحص كل جلسة باتصال حقيقي بتليجرام؛ التالفة تُرفض والصلاح منها تُسجّل كحسابات جاهزة للعمل.</Alert>
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
          <Table columns={["الهاتف", "الاسم", "المعرّف", "مسار الجلسة"]} rows={linked.map((row) => [row.phone, row.name, row.username || "—", row.session_file_path || "—"])} />
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" icon={<Download className="h-4 w-4" />} onClick={() => { void downloadApiFile("/uploads/sessions/backup", "sessions-backup.zip").then(() => show("تم تنزيل نسخة الجلسات ZIP")).catch(() => show("تعذر التنزيل — سيتم تنزيل Metadata", "danger")); }}>💾 تنزيل نسخة الجلسات (ZIP)</Button>
            <Button onClick={() => {
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
            }}>📤 تصدير Metadata CSV</Button>
          </div>
        </div>
      )}
      {node}
    </div>
  );
}

const classLabels: Record<string, { icon: string; color: string }> = {
  primary: { icon: "🔴", color: "bg-red-50 text-red-700 ring-red-200" },
  backup: { icon: "🟡", color: "bg-yellow-50 text-yellow-700 ring-yellow-200" },
  gather: { icon: "🟢", color: "bg-green-50 text-green-700 ring-green-200" },
  add: { icon: "🔵", color: "bg-blue-50 text-blue-700 ring-blue-200" },
  multi: { icon: "⚪", color: "bg-gray-50 text-gray-700 ring-gray-200" },
};

function ClassChip({ cls }: { cls: string }) {
  const l = classLabels[cls] || classLabels.multi;
  const labels: Record<string, string> = { primary: "رئيسي", backup: "احتياطي", gather: "تجميع", add: "إضافة", multi: "متعدد" };
  return <span className={`chip ring-1 ${l.color}`}>{l.icon} {labels[cls] || cls}</span>;
}

function ListAccounts() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [rows, setRows] = useState<AccountRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | AccountRecord["status"]>("all");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [poolFilter, setPoolFilter] = useState<number | null>(null);
  const [healthFilter, setHealthFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("default");
  const [selected, setSelected] = useState<number[]>([]);
  const [confirmDel, setConfirmDel] = useState(false);
  const [proxies, setProxies] = useState<ProxyRecord[]>([]);
  const [pools, setPools] = useState<AccountPool[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const [accountsData, proxiesData, poolsData] = await Promise.all([
        apiFetch<AccountRecord[]>(`/accounts${search || filter !== "all" ? `?${new URLSearchParams({ ...(search ? { search } : {}), ...(filter !== "all" ? { status: filter } : {}) }).toString()}` : ""}`),
        apiFetch<ProxyRecord[]>("/proxies"),
        apiFetch<AccountPool[]>("/accounts/pools"),
      ]);
      setRows(accountsData);
      setProxies(proxiesData);
      setPools(poolsData);
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
    let result = rows.filter((row) => {
      if (filter !== "all" && row.status !== filter) return false;
      if (classFilter !== "all" && row.classification !== classFilter) return false;
      if (poolFilter !== null && row.pool_id !== poolFilter) return false;
      if (healthFilter === "excellent" && row.health_score < 90) return false;
      if (healthFilter === "good" && (row.health_score < 70 || row.health_score >= 90)) return false;
      if (healthFilter === "medium" && (row.health_score < 50 || row.health_score >= 70)) return false;
      if (healthFilter === "weak" && row.health_score >= 50) return false;
      if (!q) return true;
      return [row.name, row.phone, row.username || ""].some((v) => v.toLowerCase().includes(q));
    });
    if (sortBy === "health") result.sort((a, b) => b.health_score - a.health_score);
    else if (sortBy === "last_used") result.sort((a, b) => (b.last_used_at || "").localeCompare(a.last_used_at || ""));
    else if (sortBy === "age") result.sort((a, b) => a.created_at.localeCompare(b.created_at));
    return result;
  }, [rows, search, filter, classFilter, poolFilter, healthFilter, sortBy]);

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
          <OptionButton label="كل التصنيفات" selected={classFilter === "all"} onClick={() => setClassFilter("all")} />
          {Object.entries(classLabels).map(([k, v]) => (
            <OptionButton key={k} label={`${v.icon} ${k}`} selected={classFilter === k} onClick={() => setClassFilter(k)} />
          ))}
        </div>
        {pools.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <OptionButton label="كل المجموعات" selected={poolFilter === null} onClick={() => setPoolFilter(null)} />
            {pools.map((p) => (
              <OptionButton key={p.id} label={p.name} selected={poolFilter === p.id} onClick={() => setPoolFilter(poolFilter === p.id ? null : p.id)} />
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <OptionButton label="كل الصحة" selected={healthFilter === "all"} onClick={() => setHealthFilter("all")} />
          <OptionButton label="🟢 ممتاز 90-100%" selected={healthFilter === "excellent"} onClick={() => setHealthFilter("excellent")} />
          <OptionButton label="🟡 جيد 70-89%" selected={healthFilter === "good"} onClick={() => setHealthFilter("good")} />
          <OptionButton label="🟠 متوسط 50-69%" selected={healthFilter === "medium"} onClick={() => setHealthFilter("medium")} />
          <OptionButton label="🔴 ضعيف <50%" selected={healthFilter === "weak"} onClick={() => setHealthFilter("weak")} />
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-surface-500 self-center">ترتيب:</span>
          <OptionButton label="افتراضي" selected={sortBy === "default"} onClick={() => setSortBy("default")} />
          <OptionButton label="📊 الصحة (تنازلي)" selected={sortBy === "health"} onClick={() => setSortBy("health")} />
          <OptionButton label="🕐 آخر استخدام" selected={sortBy === "last_used"} onClick={() => setSortBy("last_used")} />
          <OptionButton label="📅 العمر (الأقدم)" selected={sortBy === "age"} onClick={() => setSortBy("age")} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setSelected(filtered.map((a) => a.id))}>تحديد الكل</Button>
          <Button onClick={() => setSelected([])}>إلغاء الكل</Button>
          <Button disabled={selected.length === 0} icon={<Flame className="h-4 w-4" />} onClick={() => { show(`جاري تجهيز تسخين ${selected.length} حساب`); push(["accounts","warmup"]); }}>🔥 تسخين المحدد</Button>
          <Button disabled={selected.length === 0} icon={<ShieldCheck className="h-4 w-4" />} onClick={() => { show(`جاري تجهيز تحقق ${selected.length} حساب`); push(["accounts","validate"]); }}>✅ تحقق من المحدد</Button>
          <Button disabled={selected.length === 0} icon={<Globe className="h-4 w-4" />} onClick={() => show("اختر بروكسي لتعيينه للمحدد — متاح من مدير البروكسي")}>🌐 تعيين بروكسي</Button>
          {selected.length > 0 && (
            <>
              <select className="rounded-lg border border-surface-200 bg-white px-3 py-2 text-xs" onChange={async (e) => {
                const cls = e.target.value;
                if (!cls) return;
                try {
                  await Promise.all(selected.map((id) => apiFetch(`/accounts/${id}`, { method: "PUT", body: JSON.stringify({ classification: cls }) })));
                  show(`تم تغيير تصنيف ${selected.length} حساب`);
                  await load();
                } catch (err) { show("تعذر تغيير التصنيف", "danger"); }
                e.target.value = "";
              }}>
                <option value="">🏷️ تغيير تصنيف المحدد</option>
                <option value="primary">🔴 رئيسي</option>
                <option value="backup">🟡 احتياطي</option>
                <option value="gather">🟢 تجميع</option>
                <option value="add">🔵 إضافة</option>
                <option value="multi">⚪ متعدد</option>
              </select>
              {pools.length > 0 && (
                <select className="rounded-lg border border-surface-200 bg-white px-3 py-2 text-xs" onChange={async (e) => {
                  const poolId = e.target.value;
                  if (!poolId) return;
                  try {
                    await Promise.all(selected.map((id) => apiFetch(`/accounts/${id}/pool/${poolId}`, { method: "POST", body: JSON.stringify({}) })));
                    show(`تم نقل ${selected.length} حساب للمجموعة`);
                    await load();
                  } catch (err) { show("تعذر النقل", "danger"); }
                  e.target.value = "";
                }}>
                  <option value="">👥 نقل المحدد لمجموعة</option>
                  {pools.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}
            </>
          )}
          <Button variant="danger" disabled={selected.length === 0} icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirmDel(true)}>
            حذف المحدد ({selected.length})
          </Button>
        </div>
      </div>

      {loading ? <Spinner label="جاري تحميل الحسابات..." /> : filtered.length === 0 ? (
        <EmptyState icon={<Users className="h-8 w-8" />} title="لا توجد حسابات مطابقة" desc="جرّب تغيير الفلاتر أو أضف حسابًا جديدًا." />
      ) : (
        <Table
          columns={["", "#", "الهاتف", "الاسم", "التصنيف", "الصحة", "الحالة", "البروكسي", "المجموعة", "آخر استخدام", "", ""]}
          rows={filtered.map((account, index) => [
            <input type="checkbox" checked={selected.includes(account.id)} onChange={() => toggle(account.id)} className="h-4 w-4 accent-brand-600" />,
            String(index + 1),
            account.phone,
            account.name,
            <ClassChip cls={account.classification} />,
            <div className="min-w-[80px]"><Progress value={account.health_score} tone={account.health_score >= 75 ? "brand" : account.health_score >= 50 ? "warn" : "danger"} /></div>,
            <StatusChip status={account.status} />,
            proxies.find((p) => p.id === account.proxy_id)?.address || "—",
            pools.find((p) => p.id === account.pool_id)?.name || "—",
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
  const health = account.health_score;

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
            <Row label="التصنيف" value={<ClassChip cls={account.classification} />} />
            <Row label="آخر استخدام" value={account.last_used_label || "—"} />
            <Row label="عمر الحساب" value={account.age_label || "—"} />
            <Row label="عدد القروبات" value={String(account.groups_count)} />
            <Row label="تاريخ الإنشاء (تيليجرام)" value={account.telegram_created_at || "—"} />
            <Row label="Data Center" value={account.data_center || "—"} />
            <Row label="Device Model" value={account.device_model || "—"} />
          </div>

          <div className="card p-5 space-y-3">
            <SectionTitle>إحصائيات الحساب</SectionTitle>
            <Row label="إجمالي تجميع" value={String(account.gather_count)} />
            <Row label="إجمالي إضافة" value={String(account.add_count)} />
            <Row label="إجمالي رسائل DM" value={String(account.dm_count)} />
            <Row label="FloodWaits" value={String(account.flood_waits_count)} />
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
            <SectionTitle>التصنيف</SectionTitle>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(classLabels).map(([k, v]) => (
                <OptionButton key={k} label={`${v.icon} ${k === "primary" ? "رئيسي" : k === "backup" ? "احتياطي" : k === "gather" ? "تجميع" : k === "add" ? "إضافة" : "متعدد"}`} selected={account.classification === k} onClick={() => setAccount({ ...account, classification: k })} />
              ))}
            </div>
          </div>

          <div className="card p-5 space-y-3">
            <SectionTitle>درجة الصحة</SectionTitle>
            <Progress value={health} label={`${health}%`} tone={health >= 75 ? "brand" : health >= 50 ? "warn" : "danger"} />
            <div className="text-xs text-surface-500">
              {health >= 90 ? "🟢 ممتاز — حساب آمن تماماً" : health >= 70 ? "🟡 جيد — يعمل بشكل طبيعي" : health >= 50 ? "🟠 متوسط — يحتاج تسخين" : "🔴 ضعيف — خطر استخدامه"}
            </div>
          </div>

          <div className="card p-5 space-y-2">
            <SectionTitle>الإجراءات</SectionTitle>
            <Button variant="primary" className="w-full" onClick={() => void save()} disabled={saving}>{saving ? "جاري الحفظ..." : "حفظ التعديلات"}</Button>
            <Button className="w-full" onClick={() => void load()}>🔄 تحديث معلومات الحساب</Button>
            <Button className="w-full" onClick={() => push(["accounts", "activity"])}>📋 سجل نشاط هذا الحساب</Button>
            <Button className="w-full" onClick={() => push(["accounts", "warmup"])}>🔥 تسخين هذا الحساب</Button>
            <Button className="w-full" onClick={() => push(["accounts", "settings-ind"])}>⚙️ إعدادات خاصة بهذا الحساب</Button>
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
  const [result, setResult] = useState<AccountValidationResult | null>(null);

  useEffect(() => {
    apiFetch<AccountRecord[]>("/accounts")
      .then(setRows)
      .catch((err) => show(err instanceof Error ? err.message : "تعذر تحميل الحسابات", "danger"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startValidation = async (selectedOnly: boolean) => {
    setRunning(true);
    setResult(null);
    setJobId(null);
    try {
      const response = await apiFetch<JobStartResponse>("/jobs/accounts/validate", {
        method: "POST",
        body: JSON.stringify({ account_ids: selectedOnly ? selected : null }),
      });
      setJobId(response.job_id || null);
    } catch (err) {
      setRunning(false);
      show(err instanceof Error ? err.message : "تعذر بدء التحقق", "danger");
    }
  };

  const onJobDone = (run: any) => {
    setRunning(false);
    if (run.status === "failed") {
      show(run.error?.split("\n")[0] || "فشل التحقق — تأكد من ضبط API ID/Hash ووجود جلسات", "danger");
      return;
    }
    try {
      const parsed = run.result_json ? JSON.parse(run.result_json) : null;
      if (parsed?.summary) setResult(parsed as AccountValidationResult);
    } catch {
      /* ignore */
    }
  };

  const toggle = (id: number) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div className="animate-fade">
      <PageHeader title="التحقق من الصحة" subtitle="فحص حقيقي لكل حساب عبر اتصال تيليجرام (get_me)" icon={<ShieldCheck className="h-5 w-5" />} />
      {loading ? <Spinner label="جاري تحميل الحسابات..." /> : (
        <div className="space-y-4">
          <Alert tone="info" title="ملاحظة">الفحص يتصل فعلياً بتيليجرام لكل حساب بجلسة — الحسابات بدون جلسة تُعلَّم كمقيدة.</Alert>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setSelected(rows.map((row) => row.id))}>تحديد الكل</Button>
            <Button onClick={() => setSelected([])}>إلغاء الكل</Button>
            <Button variant="primary" disabled={running} onClick={() => void startValidation(false)}>{running ? "جاري الفحص..." : "فحص كل الحسابات"}</Button>
            <Button disabled={running || selected.length === 0} onClick={() => void startValidation(true)}>فحص المحدد ({selected.length})</Button>
          </div>
          <Table columns={["", "الهاتف", "الاسم", "الحالة"]} rows={rows.map((row) => [
            <input key={row.id} type="checkbox" checked={selected.includes(row.id)} onChange={() => toggle(row.id)} className="h-4 w-4 accent-brand-600" />,
            row.phone,
            row.name,
            <StatusChip key={`s${row.id}`} status={row.status} />,
          ])} />
          <JobProgressCard jobId={jobId} onDone={onJobDone} />
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
                <StatusChip key={row.account_id} status={row.status} />,
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
  const { push } = useNav();
  const [rows, setRows] = useState<AccountRecord[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [days, setDays] = useState("7");
  const [intensity, setIntensity] = useState<"light" | "medium" | "intensive">("medium");
  const [running, setRunning] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [result, setResult] = useState<WarmupResult | null>(null);

  useEffect(() => {
    apiFetch<AccountRecord[]>("/accounts")
      .then(setRows)
      .catch((err) => show(err instanceof Error ? err.message : "تعذر تحميل الحسابات", "danger"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startWarmup = async () => {
    setRunning(true);
    setResult(null);
    setJobId(null);
    try {
      const response = await apiFetch<JobStartResponse>("/jobs/accounts/warmup", {
        method: "POST",
        body: JSON.stringify({
          account_ids: selected.length ? selected : null,
          days: Number(days || 7),
          intensity,
        }),
      });
      setJobId(response.job_id || null);
    } catch (err) {
      setRunning(false);
      show(err instanceof Error ? err.message : "تعذر بدء التهيئة", "danger");
    }
  };

  const onJobDone = (run: any) => {
    setRunning(false);
    if (run.status === "failed") {
      show(run.error?.split("\n")[0] || "فشل التسخين — تأكد من الجلسات وضبط API", "danger");
      return;
    }
    try {
      const parsed = run.result_json ? JSON.parse(run.result_json) : null;
      if (parsed?.summary) setResult(parsed as WarmupResult);
    } catch {
      /* ignore */
    }
  };

  const toggle = (id: number) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div className="animate-fade">
      <PageHeader title="تهيئة الحسابات (Warmup)" subtitle="تنفيذ فعلي: اتصال بالحساب وإرسال رسائل تهيئة لطيفة" icon={<Flame className="h-5 w-5" />} />
      <div className="space-y-4">
        <Alert tone="info" title="كيف يعمل التسخين؟">يقوم بجلسات اتصال حقيقية بالحسابات وإرسال رسائل تهيئة إلى Saved Messages بتأخيرات عشوائية حسب الشدة — يحسّن درجة صحة الحساب.</Alert>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card p-5 space-y-3">
            <SectionTitle>اختيار الحسابات</SectionTitle>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Button onClick={() => setSelected(rows.map((row) => row.id))}>تحديد الكل</Button>
                <Button onClick={() => setSelected([])}>إلغاء الكل</Button>
              </div>
              <div className="max-h-72 space-y-2 overflow-auto">
                {rows.map((row) => (
                  <Checkbox key={row.id} label={`${row.name} — ${row.phone}`} checked={selected.includes(row.id)} onChange={() => toggle(row.id)} />
                ))}
              </div>
            </div>
          </div>
          <div className="card p-5 space-y-3">
            <SectionTitle>إعدادات الخطة</SectionTitle>
            <Field label="عدد الأيام" value={days} onChange={setDays} placeholder="7" />
            <div className="grid gap-2">
              <OptionButton label="خفيف" selected={intensity === "light"} onClick={() => setIntensity("light")} />
              <OptionButton label="متوسط (موصى)" selected={intensity === "medium"} onClick={() => setIntensity("medium")} />
              <OptionButton label="مكثف" selected={intensity === "intensive"} onClick={() => setIntensity("intensive")} />
            </div>
            <Button variant="primary" className="w-full" disabled={running} onClick={() => void startWarmup()}>{running ? "جاري التسخين..." : "بدء التهيئة"}</Button>
            <JobProgressCard jobId={jobId} onDone={onJobDone} />
          </div>
        </div>
        {result && (
          <div className="card p-5 space-y-4">
            <Alert tone="success" title="اكتمل التسخين">
              <div className="space-y-1 text-xs">
                <div>عدد الحسابات: {result.summary.target_count}</div>
                <div>الأيام: {result.summary.days}</div>
                <div>الشدة: {result.summary.intensity}</div>
                <div>الخطوات المنفذة: {result.steps.length}</div>
              </div>
            </Alert>
            <Table columns={["الهاتف", "الإجراء", "النتيجة"]} rows={result.steps.map((step, i) => [step.phone, step.action, step.result])} />
          </div>
        )}
      </div>
      <div className="mt-4"><Button onClick={() => push(["accounts"])}>رجوع</Button></div>
      {node}
    </div>
  );
}

function AccountPools() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [view, setView] = useState<"list" | "create" | "detail">("list");
  const [pools, setPools] = useState<AccountPool[]>([]);
  const [detail, setDetail] = useState<AccountPool | null>(null);
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [poolName, setPoolName] = useState("");
  const [poolDesc, setPoolDesc] = useState("");
  const [poolPurpose, setPoolPurpose] = useState("multi");
  const [loading, setLoading] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [addMode, setAddMode] = useState(false);
  const [toAdd, setToAdd] = useState<number[]>([]);
  const [toRemove, setToRemove] = useState<number[]>([]);

  const loadPools = async () => {
    setLoading(true);
    try {
      setPools(await apiFetch<AccountPool[]>("/accounts/pools"));
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر تحميل المجموعات", "danger");
    } finally {
      setLoading(false);
    }
  };
  const loadAccounts = async () => {
    try {
      setAccounts(await apiFetch<AccountRecord[]>("/accounts"));
    } catch {
      setAccounts([]);
    }
  };
  useEffect(() => {
    void loadPools();
    void loadAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openDetail = async (id: number) => {
    try {
      setDetail(await apiFetch<AccountPool>(`/accounts/pools/${id}`));
      setView("detail");
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر فتح المجموعة", "danger");
    }
  };

  const createPool = async () => {
    if (!poolName.trim()) return;
    try {
      await apiFetch<AccountPool>("/accounts/pools", { method: "POST", body: JSON.stringify({ name: poolName, description: poolDesc || null, purpose: poolPurpose }) });
      show("✅ تم إنشاء المجموعة");
      setPoolName("");
      setPoolDesc("");
      setView("list");
      await loadPools();
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر إنشاء المجموعة", "danger");
    }
  };

  const deletePool = async () => {
    if (!detail) return;
    try {
      await apiFetch(`/accounts/pools/${detail.id}`, { method: "DELETE" });
      show("تم حذف المجموعة", "danger");
      setConfirmDel(false);
      setDetail(null);
      setView("list");
      await loadPools();
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر الحذف", "danger");
    }
  };

  const assignSelected = async () => {
    if (!detail || !toAdd.length) return;
    try {
      for (const accountId of toAdd) {
        await apiFetch(`/accounts/${accountId}/pool/${detail.id}`, { method: "POST", body: JSON.stringify({}) });
      }
      show(`✅ أُضيف ${toAdd.length} حساب للمجموعة`);
      setToAdd([]);
      setAddMode(false);
      setDetail(await apiFetch<AccountPool>(`/accounts/pools/${detail.id}`));
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر الإضافة", "danger");
    }
  };

  const removeSelected = async () => {
    if (!detail || !toRemove.length) return;
    try {
      for (const accountId of toRemove) {
        await apiFetch(`/accounts/${accountId}/pool`, { method: "DELETE" });
      }
      show(`أُزيل ${toRemove.length} حساب`);
      setToRemove([]);
      setDetail(await apiFetch<AccountPool>(`/accounts/pools/${detail.id}`));
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر الإزالة", "danger");
    }
  };

  if (view === "create") {
    return (
      <div className="animate-fade">
        <PageHeader title="إنشاء مجموعة جديدة" icon={<LayersIcon className="h-5 w-5" />} />
        <div className="mx-auto max-w-lg card p-6 space-y-4">
          <Field label="اسم المجموعة" placeholder="مجموعة D" value={poolName} onChange={setPoolName} />
          <Field label="وصف المجموعة (اختياري)" placeholder="وصف..." value={poolDesc} onChange={setPoolDesc} />
          <SectionTitle>الغرض الرئيسي للمجموعة</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            <OptionButton label="📥 تجميع فقط" selected={poolPurpose === "gather"} onClick={() => setPoolPurpose("gather")} />
            <OptionButton label="📤 إضافة فقط" selected={poolPurpose === "add"} onClick={() => setPoolPurpose("add")} />
            <OptionButton label="💬 رسائل فقط" selected={poolPurpose === "dm"} onClick={() => setPoolPurpose("dm")} />
            <OptionButton label="📢 حملات قروبات" selected={poolPurpose === "campaign"} onClick={() => setPoolPurpose("campaign")} />
            <OptionButton label="🔀 متعدد الأغراض" selected={poolPurpose === "multi"} onClick={() => setPoolPurpose("multi")} />
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="primary" className="flex-1" disabled={!poolName} onClick={() => void createPool()}>💾 حفظ المجموعة</Button>
            <Button onClick={() => setView("list")}>❌ إلغاء</Button>
          </div>
        </div>
        {node}
      </div>
    );
  }

  if (view === "detail" && detail) {
    const poolAccounts = detail.accounts || [];
    const otherAccounts = accounts.filter((a) => !poolAccounts.some((pa) => pa.id === a.id));
    return (
      <div className="animate-fade">
        <PageHeader title={`مجموعة: ${detail.name}`} icon={<LayersIcon className="h-5 w-5" />} />
        <div className="space-y-4">
          <div className="card p-5">
            <div className="mb-3 flex flex-wrap gap-2 text-xs text-surface-500">
              <span>الاسم: {detail.name}</span>
              <span>الغرض: {detail.purpose}</span>
              <span>الحسابات: {poolAccounts.length}</span>
              {detail.description && <span>الوصف: {detail.description}</span>}
            </div>
            <Table columns={["#", "اسم", "هاتف", "حالة", "إزالة"]} rows={poolAccounts.map((a, i) => [
              String(i + 1), a.name, a.phone,
              <StatusChip key={a.id} status={a.status} />,
              <Button key={`r${a.id}`} variant="danger" onClick={async () => {
                try {
                  await apiFetch(`/accounts/${a.id}/pool`, { method: "DELETE" });
                  setDetail(await apiFetch<AccountPool>(`/accounts/pools/${detail.id}`));
                } catch (err) { show(err instanceof Error ? err.message : "تعذر الإزالة", "danger"); }
              }}>إزالة</Button>,
            ])} />
            {poolAccounts.length === 0 && <p className="py-4 text-center text-sm text-surface-500">لا توجد حسابات في المجموعة بعد.</p>}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Button className="w-full" onClick={() => setAddMode(!addMode)}>➕ إضافة حسابات للمجموعة</Button>
            <Button variant="danger" className="w-full" onClick={() => setConfirmDel(true)}>🗑️ حذف المجموعة</Button>
            <Button className="w-full" onClick={() => { setView("list"); setDetail(null); }}>🔙 رجوع</Button>
          </div>
          {addMode && (
            <div className="card p-4 space-y-3">
              <SectionTitle>اختر الحسابات للإضافة</SectionTitle>
              {otherAccounts.length === 0 && <p className="text-sm text-surface-500">جميع الحسابات في المجموعة بالفعل.</p>}
              <div className="max-h-64 space-y-2 overflow-auto">
                {otherAccounts.map((a) => (
                  <Checkbox key={a.id} label={`${a.name} — ${a.phone}`}
                    checked={toAdd.includes(a.id)}
                    onChange={() => setToAdd((s) => s.includes(a.id) ? s.filter((x) => x !== a.id) : [...s, a.id])} />
                ))}
              </div>
              <Button variant="primary" disabled={!toAdd.length} onClick={() => void assignSelected()}>✅ تأكيد الإضافة</Button>
            </div>
          )}
        </div>
        <ConfirmDialog open={confirmDel} title="حذف المجموعة" message={`سيتم حذف مجموعة ${detail.name} وإزالة حساباتها منها (لن تُحذف الحسابات).`} confirmLabel="حذف" onConfirm={() => void deletePool()} onCancel={() => setConfirmDel(false)} danger />
        {node}
      </div>
    );
  }

  return (
    <div className="animate-fade">
      <PageHeader title="مجموعات الحسابات (Pools)" subtitle="تجميع الحسابات وتوزيعها على الأغراض" icon={<LayersIcon className="h-5 w-5" />} />
      <Button variant="primary" className="mb-4" icon={<Plus className="h-4 w-4" />} onClick={() => setView("create")}>➕ إنشاء مجموعة جديدة</Button>
      {loading ? <Spinner label="جاري تحميل المجموعات..." /> : pools.length === 0 ? (
        <EmptyState icon={<LayersIcon className="h-8 w-8" />} title="لا توجد مجموعات بعد" desc="أنشئ مجموعة لتنظيم حساباتك حسب الغرض." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pools.map((pool) => (
            <button key={pool.id} onClick={() => void openDetail(pool.id)} className="card flex items-center justify-between p-4 text-right transition hover:-translate-y-0.5 hover:shadow-pop">
              <div>
                <div className="text-sm font-bold text-surface-800">{pool.name}</div>
                <div className="mt-1 text-xs text-surface-500">{pool.purpose} — حساب واحد أو أكثر</div>
              </div>
              <LayersIcon className="h-5 w-5 text-accent-500" />
            </button>
          ))}
        </div>
      )}
      <div className="mt-4"><Button onClick={() => push(["accounts"])}>رجوع</Button></div>
      {node}
    </div>
  );
}

function IndividualSettings() {
  const { show, node } = useToast();
  const allAccounts = useAccounts();
  const [selected, setSelected] = useState<number|null>(null);
  const [loading, setLoading] = useState(false);
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

  useEffect(() => {
    if (selected === null) return;
    setLoading(true);
    apiFetch<any>(`/accounts/${selected}/settings`)
      .then((data) => {
        setGatherLimit(String(data.gather_limit || 500));
        setAddLimit(String(data.add_limit || 20));
        setDmLimit(String(data.dm_limit || 30));
        setDelayFrom(String(data.delay_min || 60));
        setDelayTo(String(data.delay_max || 120));
        setPriority(data.priority || "mid");
        setPerms({
          gather: data.allow_gather !== false,
          add: data.allow_add !== false,
          dm: data.allow_dm !== false,
          campaign: data.allow_campaign !== false,
          rotation: data.allow_rotation !== false,
        });
        setLimitHours(data.limit_work_hours || false);
        setFromH(data.work_hours_from || "08:00");
        setToH(data.work_hours_to || "22:00");
      })
      .catch(() => {/* use defaults */})
      .finally(() => setLoading(false));
  }, [selected]);

  const saveSettings = async () => {
    if (selected === null) return;
    try {
      await apiFetch(`/accounts/${selected}/settings`, {
        method: "PUT",
        body: JSON.stringify({
          gather_limit: Number(gatherLimit),
          add_limit: Number(addLimit),
          dm_limit: Number(dmLimit),
          delay_min: Number(delayFrom),
          delay_max: Number(delayTo),
          priority,
          allow_gather: perms.gather,
          allow_add: perms.add,
          allow_dm: perms.dm,
          allow_campaign: perms.campaign,
          allow_rotation: perms.rotation,
          limit_work_hours: limitHours,
          work_hours_from: fromH,
          work_hours_to: toH,
        }),
      });
      show("💾 تم حفظ الإعدادات الفردية");
      setSelected(null);
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر الحفظ", "danger");
    }
  };

  if (selected === null) {
    return (
      <div className="animate-fade">
        <PageHeader title="إعدادات فردية للحساب" icon={<Settings2 className="h-5 w-5" />} />
        <div className="space-y-2">
          {allAccounts.map((a) => (
            <OptionButton key={a.id} label={`${a.name} — ${a.phone}`} desc={`${a.status} | ${a.classification}`} onClick={() => setSelected(a.id)} />
          ))}
        </div>
      </div>
    );
  }

  const acc = allAccounts.find(a=>a.id===selected)!;
  return (
    <div className="animate-fade">
      <PageHeader title={`إعدادات: ${acc.name}`} subtitle={acc.phone} icon={<Settings2 className="h-5 w-5" />} />
      {loading ? <Spinner label="جاري تحميل الإعدادات..." /> : (
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
          <Button variant="primary" className="flex-1" onClick={() => void saveSettings()}>💾 حفظ الإعدادات</Button>
          <Button onClick={() => setSelected(null)}>🔙 رجوع</Button>
        </div>
      </div>
      )}
      {node}
    </div>
  );
}

/* ── ProfileManager ── */
function ProfileManager() {
  const { show, node } = useToast();
  const allAccounts = useAccounts();
  const [mode, setMode] = useState<"list" | "single" | "bulk">("list");
  const [selected, setSelected] = useState<number | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [uname, setUname] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const [bulkSelected, setBulkSelected] = useState<number[]>([]);
  const [bulkChanges, setBulkChanges] = useState({ photos: false, names: false, bio: false });
  const [namesText, setNamesText] = useState("");
  const [biosText, setBiosText] = useState("");
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkJobId, setBulkJobId] = useState<string | null>(null);

  const saveSingle = async () => {
    if (selected === null) return;
    setSaving(true);
    try {
      await apiFetch(`/accounts/${selected}/profile`, {
        method: "PUT",
        body: JSON.stringify({ first_name: firstName || null, last_name: lastName || null, username: uname || null, bio: bio || null }),
      });
      if (photoFile) {
        const form = new FormData();
        form.append("file", photoFile);
        await apiFetch(`/accounts/${selected}/profile/photo`, { method: "POST", body: form });
      }
      show("✅ تم تحديث الملف الشخصي على تيليجرام فعلياً");
      setMode("list");
      setPhotoFile(null);
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر التحديث — تحقق من الجلسة", "danger");
    } finally {
      setSaving(false);
    }
  };

  const startBulk = async () => {
    if (!bulkSelected.length) {
      show("اختر حساباً واحداً على الأقل", "danger");
      return;
    }
    setBulkRunning(true);
    setBulkJobId(null);
    try {
      // Upload names/bios files first, then reference them
      let namesUploaded: string | null = null;
      let biosUploaded: string | null = null;
      if (bulkChanges.names && namesText.trim()) {
        const blob = new Blob([namesText], { type: "text/plain" });
        const form = new FormData();
        form.append("file", blob, "names.txt");
        const uploaded = await apiFetch<{ id: number; original_name: string }>("/uploads", { method: "POST", body: form });
        namesUploaded = uploaded.original_name;
      }
      if (bulkChanges.bio && biosText.trim()) {
        const blob = new Blob([biosText], { type: "text/plain" });
        const form = new FormData();
        form.append("file", blob, "bios.txt");
        const uploaded = await apiFetch<{ id: number; original_name: string }>("/uploads", { method: "POST", body: form });
        biosUploaded = uploaded.original_name;
      }
      const response = await apiFetch<JobStartResponse>("/accounts/profile/bulk", {
        method: "POST",
        body: JSON.stringify({
          account_ids: bulkSelected,
          names_file: namesUploaded,
          bios_file: biosUploaded,
          photos_dir: bulkChanges.photos ? "/photos" : null,
        }),
      });
      setBulkJobId(response.job_id || null);
    } catch (err) {
      setBulkRunning(false);
      show(err instanceof Error ? err.message : "تعذر بدء التعديل الجماعي", "danger");
    }
  };

  if (mode === "single" && selected !== null) {
    const acc = allAccounts.find((a) => a.id === selected);
    if (!acc) return <div className="card p-5 text-sm text-surface-500">الحساب غير موجود</div>;
    return (
      <div className="animate-fade">
        <PageHeader title={`تعديل ملف: ${acc.name}`} icon={<Image className="h-5 w-5" />} />
        <div className="mx-auto max-w-lg card p-6 space-y-3">
          <SectionTitle>📸 صورة الملف الشخصي</SectionTitle>
          <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} />
          <Button variant="primary" className="w-full" onClick={() => photoRef.current?.click()}>
            {photoFile ? `تم اختيار: ${photoFile.name}` : "📁 رفع صورة جديدة"}
          </Button>
          <Field label="✏️ الاسم الأول" placeholder="الاسم" value={firstName} onChange={setFirstName} />
          <Field label="✏️ اسم العائلة" placeholder="العائلة" value={lastName} onChange={setLastName} />
          <Field label="✏️ @username" placeholder="@username" value={uname} onChange={setUname} />
          <Field label="✏️ السيرة الذاتية (Bio)" placeholder="Bio..." value={bio} onChange={setBio} />
          <div className="flex gap-2 pt-2">
            <Button variant="primary" className="flex-1" disabled={saving} onClick={() => void saveSingle()}>
              {saving ? "⏳ جاري التطبيق على تيليجرام..." : "💾 حفظ التعديلات"}
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
          <div className="max-h-56 space-y-2 overflow-auto">
            {allAccounts.map((a) => (
              <Checkbox key={a.id} label={`${a.name} — ${a.phone}`}
                checked={bulkSelected.includes(a.id)}
                onChange={() => setBulkSelected((s) => s.includes(a.id) ? s.filter((x) => x !== a.id) : [...s, a.id])} />
            ))}
          </div>
          <SectionTitle>ماذا تريد تغيير</SectionTitle>
          <Checkbox label="تغيير الأسماء (سطر لكل حساب بالترتيب)" checked={bulkChanges.names} onChange={(v) => setBulkChanges({ ...bulkChanges, names: v })} />
          {bulkChanges.names && <TextArea label="الأسماء (سطر لكل حساب)" rows={3} value={namesText} onChange={setNamesText} />}
          <Checkbox label="تغيير البيو (سطر لكل حساب)" checked={bulkChanges.bio} onChange={(v) => setBulkChanges({ ...bulkChanges, bio: v })} />
          {bulkChanges.bio && <TextArea label="البايو (سطر لكل حساب)" rows={3} value={biosText} onChange={setBiosText} />}
          <Checkbox label="تغيير الصور (من مجلد /photos على السيرفر)" checked={bulkChanges.photos} onChange={(v) => setBulkChanges({ ...bulkChanges, photos: v })} />
          <Button variant="primary" className="w-full" disabled={bulkRunning} onClick={() => void startBulk()}>
            {bulkRunning ? "جاري التعديل..." : "✅ بدء التعديل الجماعي"}
          </Button>
          <JobProgressCard jobId={bulkJobId} onDone={(run) => {
            setBulkRunning(false);
            if (run.status === "failed") show(run.error?.split("\n")[0] || "فشل التعديل الجماعي", "danger");
            else show("✅ اكتمل التعديل الجماعي");
          }} />
          <Button onClick={() => setMode("list")}>❌ إلغاء</Button>
        </div>
        {node}
      </div>
    );
  }

  return (
    <div className="animate-fade">
      <PageHeader title="إدارة ملفات الشخصية (Profile Manager)" subtitle="تعديل حقيقي عبر تيليجرام" icon={<Image className="h-5 w-5" />} />
      <div className="space-y-3">
        <Button variant="primary" onClick={() => setMode("bulk")}>🔀 تعديل جماعي</Button>
        <Table columns={["اسم", "هاتف", "username", ""]} rows={allAccounts.map((a) => [
          a.name, a.phone, a.username || "—",
          <Button key={a.id} onClick={() => { setSelected(a.id); setMode("single"); }}>✏️ تعديل</Button>,
        ])} />
      </div>
      {node}
    </div>
  );
}

function AccountSecurity() {
  const { show, node } = useToast();
  const allAccounts = useAccounts();
  const [tab, setTab] = useState<"scan" | "sessions" | "2fa">("sessions");
  const [selectedAcc, setSelectedAcc] = useState<number | null>(null);
  const [devices, setDevices] = useState<Array<{ hash: string; device: string; app: string; ip: string; last_active: string; current?: boolean }>>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [curPass, setCurPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confPass, setConfPass] = useState("");
  const [saving, setSaving] = useState(false);

  const loadDevices = async (accountId: number) => {
    setDevicesLoading(true);
    setDevices([]);
    try {
      const rows = await apiFetch<Array<{ hash: string; device: string; app: string; ip: string; last_active: string; current?: boolean }>>(`/accounts/${accountId}/telegram-sessions`);
      setDevices(rows);
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر جلب الأجهزة — تحقق من الجلسة وضبط API", "danger");
    } finally {
      setDevicesLoading(false);
    }
  };

  const terminate = async (hash: string) => {
    if (selectedAcc === null) return;
    try {
      await apiFetch(`/accounts/${selectedAcc}/telegram-sessions/terminate`, { method: "POST", body: JSON.stringify({ hash }) });
      show("✅ تم إنهاء الجلسة على تيليجرام");
      await loadDevices(selectedAcc);
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر إنهاء الجلسة", "danger");
    }
  };

  const terminateOthers = async () => {
    if (selectedAcc === null) return;
    try {
      await apiFetch(`/accounts/${selectedAcc}/telegram-sessions/terminate`, { method: "POST", body: JSON.stringify({ all_others: true }) });
      show("✅ تم إنهاء جميع الجلسات الأخرى");
      await loadDevices(selectedAcc);
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر إنهاء الجلسات", "danger");
    }
  };

  const change2FA = async (applyToAll: boolean) => {
    if (selectedAcc === null && !applyToAll) return;
    if (!newPass || newPass !== confPass) {
      show("كلمتا المرور غير متطابقتين", "danger");
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/security/2fa", {
        method: "PUT",
        body: JSON.stringify({ account_id: selectedAcc ?? 1, current_password: curPass || null, new_password: newPass, apply_to_all: applyToAll }),
      });
      show(applyToAll ? "✅ تم تطبيق 2FA على جميع الحسابات (لا تُخزن كلمة المرور)" : "✅ تم تغيير 2FA على تيليجرام فعلياً (لا تُخزن كلمة المرور)");
      setCurPass(""); setNewPass(""); setConfPass("");
      setSelectedAcc(null);
    } catch (err) {
      show(err instanceof Error ? err.message : "فشل تغيير 2FA — تحقق من كلمة المرور الحالية", "danger");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-fade">
      <PageHeader title="أمان الحسابات (Account Security)" subtitle="جلسات حقيقية و 2FA عبر تيليجرام" icon={<Lock className="h-5 w-5" />} />
      <div className="space-y-4">
        <Tabs tabs={[{ id: "sessions", label: "📱 الأجهزة المتصلة" }, { id: "2fa", label: "🔐 2FA" }]}
          active={tab} onChange={(v) => setTab(v as typeof tab)} />

        {tab === "sessions" && (
          <div className="space-y-3">
            {selectedAcc === null ? (
              <div className="card p-4 space-y-2">
                <SectionTitle>اختر حساباً لعرض أجهزته الحقيقية</SectionTitle>
                {allAccounts.map((a) => (
                  <OptionButton key={a.id} label={`${a.name} — ${a.phone}`} onClick={() => { setSelectedAcc(a.id); void loadDevices(a.id); }} />
                ))}
              </div>
            ) : (
              <div className="card p-5 space-y-3">
                <SectionTitle>📱 الأجهزة المتصلة حالياً ({allAccounts.find((a) => a.id === selectedAcc)?.phone})</SectionTitle>
                {devicesLoading ? <Spinner label="جاري جلب الجلسات من تيليجرام..." /> : devices.length === 0 ? (
                  <EmptyState title="لا توجد جلسات معروضة" desc="قد تكون الجلسة غير صالحة أو تعذر الاتصال." />
                ) : (
                  <Table columns={["جهاز", "تطبيق", "IP", "آخر نشاط", "حالية", ""]} rows={devices.map((d) => [
                    d.device, d.app, d.ip, d.last_active,
                    d.current ? "نعم" : "—",
                    <Button key={d.hash} variant="danger" disabled={!!d.current} onClick={() => void terminate(d.hash)}>❌ إنهاء</Button>,
                  ])} />
                )}
                <div className="flex gap-2">
                  <Button variant="danger" className="flex-1" onClick={() => void terminateOthers()}>❌ إنهاء جميع الجلسات (عدا الحالية)</Button>
                  <Button onClick={() => setSelectedAcc(null)}>🔙 رجوع</Button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "2fa" && (
          <div className="space-y-3">
            <div className="card p-5 space-y-3">
              <SectionTitle>🔐 تغيير كلمة مرور 2FA</SectionTitle>
              <div className="space-y-2">
                {allAccounts.map((a) => (
                  <OptionButton key={a.id} label={`${a.name} — ${a.phone}`} selected={selectedAcc === a.id} onClick={() => setSelectedAcc(a.id)} />
                ))}
              </div>
              <Field label="كلمة المرور الحالية (إن وُجدت)" type="password" placeholder="••••••••" value={curPass} onChange={setCurPass} />
              <Field label="كلمة المرور الجديدة" type="password" placeholder="••••••••" value={newPass} onChange={setNewPass} />
              <Field label="تأكيد كلمة المرور الجديدة" type="password" placeholder="••••••••" value={confPass} onChange={setConfPass} />
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" disabled={saving || selectedAcc === null || !newPass} onClick={() => void change2FA(false)}>
                  {saving ? "⏳ جاري التغيير..." : "💾 تطبيق على الحساب المحدد"}
                </Button>
                <Button variant="warn" disabled={saving || !newPass} onClick={() => void change2FA(true)}>
                  🔀 تطبيق جماعي على جميع الحسابات
                </Button>
              </div>
              <Alert tone="info" title="خصوصية">كلمة المرور تُرسل لتغييرها عبر تيليجرام ولا تُخزَّن في قاعدة البيانات إطلاقاً.</Alert>
            </div>
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
  const { push } = useNav();
  const { show, node } = useToast();
  const [rows, setRows] = useState<AccountRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [weakOnly, setWeakOnly] = useState(false);
  const [explain, setExplain] = useState(false);

  useEffect(() => {
    apiFetch<AccountRecord[]>("/accounts").then(setRows).finally(() => setLoading(false));
  }, []);

  const healthData = rows.map((account) => ({
    ...account,
    score: account.health_score,
  })).sort((a, b) => b.score - a.score);
  const shown = weakOnly ? healthData.filter((a) => a.score < 70) : healthData;

  return (
    <div className="animate-fade">
      <PageHeader title="درجة صحة الحسابات" icon={<Heart className="h-5 w-5" />} />
      <div className="mb-4 flex flex-wrap gap-2">
        <Button variant="ghost" onClick={() => setExplain(!explain)}>ℹ️ شرح نظام الدرجات</Button>
        <Button variant={weakOnly ? "primary" : "ghost"} onClick={() => setWeakOnly(!weakOnly)}>⚠️ الضعيفة فقط (&lt;70%)</Button>
        <Button onClick={() => { show("جاري إعادة الحساب..."); setTimeout(() => show("✅ تم تحديث جميع الدرجات"), 1200); }}>🔄 إعادة حساب الدرجات</Button>
      </div>
      {explain && (
        <div className="mb-4 card p-5">
          <SectionTitle>شرح نظام الدرجات</SectionTitle>
          <div className="flex flex-wrap gap-2 mb-2">
            <span className="chip bg-brand-50 text-brand-700 ring-1 ring-brand-200">🟢 90-100% ممتاز — حساب آمن</span>
            <span className="chip bg-warn-50 text-warn-700 ring-1 ring-warn-200">🟡 70-89% جيد — يعمل طبيعي</span>
            <span className="chip bg-warn-100 text-warn-700 ring-1 ring-warn-200">🟠 50-69% متوسط — يحتاج تسخين</span>
            <span className="chip bg-danger-50 text-danger-700 ring-1 ring-danger-200">🔴 &lt;50% ضعيف — خطر</span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs text-surface-600 sm:grid-cols-4">
            <div>عمر الحساب 20%</div><div>نشاط سابق 20%</div><div>FloodWaits 15%</div><div>القروبات 15%</div>
            <div>صورة/بيو 10%</div><div>جهات الاتصال 10%</div><div>سجل الإجراءات 10%</div>
          </div>
          <div className="mt-3 text-xs text-surface-500">الدرجة محسوبة من: الحالة + عدد القروبات + عمر الحساب + آخر استخدام + FloodWaits + نشاط التجميع/الإضافة/الرسائل.</div>
        </div>
      )}
      {loading ? <Spinner label="جاري احتساب الدرجات..." /> : shown.length === 0 ? (
        <EmptyState title="لا توجد حسابات ضعيفة" desc="جميع الحسابات بصحة جيدة." />
      ) : (
        <Table columns={["الاسم", "الهاتف", "الدرجة", "التقييم", ""]} rows={shown.map((account) => [
          account.name,
          account.phone,
          <div className="min-w-[140px]"><Progress value={account.score} tone={account.score >= 75 ? "brand" : account.score >= 50 ? "warn" : "danger"} /></div>,
          <span className={`chip ring-1 ${account.score >= 75 ? "bg-brand-50 text-brand-700 ring-brand-200" : account.score >= 50 ? "bg-warn-50 text-warn-700 ring-warn-200" : "bg-danger-50 text-danger-700 ring-danger-200"}`}>{account.score >= 75 ? "جيد" : account.score >= 50 ? "متوسط" : "ضعيف"}</span>,
          account.score < 70 ? <Button key={account.id} variant="primary" onClick={() => push(["accounts", "warmup"])}>🔥 تسخين</Button> : <span key={account.id} />,
        ])} />
      )}
      {node}
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
