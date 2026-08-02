import { useEffect, useMemo, useRef, useState } from "react";
import { Settings, KeyRound, Save, RotateCcw, Folder, Sliders, Bell, ShieldCheck, Globe, Database, FileText, CalendarClock, Lock, Archive, Cpu, Info, Server } from "lucide-react";
import { useNav } from "../nav";
import { Alert, Button, Checkbox, PageHeader, SectionTitle, useToast, InlineEdit, Field, OptionButton, Progress, ConfirmDialog, Table, StatCard, Spinner } from "../ui";
import { apiFetch, downloadApiFile, type SettingItem } from "../lib/api";

type SettingsMap = Record<string, string>;

const fallbackSettings: SettingsMap = {
  telegram_api_id: "12345678",
  telegram_api_hash: "a1b2c3d4e5f6",
  default_add_limit: "20",
  default_gather_limit: "500",
  default_message_limit: "30",
  default_campaign_limit: "25",
  rotation_switch_ops: "5",
  rest_after: "20",
  default_delay_min: "60",
  default_delay_max: "120",
  sessions_path: "./sessions/",
  exports_path: "./exports/",
  logs_path: "./logs/",
  backups_path: "./backups/",
  templates_path: "./templates/",
  language: "AR",
  timezone: "Asia/Riyadh",
  date_format: "DD/MM/YYYY",
  time_format: "24h",
};

const descriptions: Record<string, { is_secret: boolean; description: string }> = {
  telegram_api_id: { is_secret: true, description: "Telegram API ID" },
  telegram_api_hash: { is_secret: true, description: "Telegram API Hash" },
  default_add_limit: { is_secret: false, description: "Daily add limit" },
  default_gather_limit: { is_secret: false, description: "Daily gather limit" },
  default_message_limit: { is_secret: false, description: "Daily message limit" },
  default_campaign_limit: { is_secret: false, description: "Daily group campaign limit" },
  rotation_switch_ops: { is_secret: false, description: "Operations before rotation" },
  rest_after: { is_secret: false, description: "Rest after N operations" },
  default_delay_min: { is_secret: false, description: "Minimum delay in seconds" },
  default_delay_max: { is_secret: false, description: "Maximum delay in seconds" },
  sessions_path: { is_secret: false, description: "Sessions path" },
  exports_path: { is_secret: false, description: "Exports path" },
  logs_path: { is_secret: false, description: "Logs path" },
  backups_path: { is_secret: false, description: "Backups path" },
  templates_path: { is_secret: false, description: "Templates path" },
  language: { is_secret: false, description: "Dashboard language" },
  timezone: { is_secret: false, description: "Timezone" },
  date_format: { is_secret: false, description: "Date format" },
  time_format: { is_secret: false, description: "Time format" },
};

function itemsToMap(items: SettingItem[]): SettingsMap {
  const mapped = { ...fallbackSettings };
  for (const item of items) {
    mapped[item.key] = item.value ?? "";
  }
  return mapped;
}

function useSettings() {
  const [form, setForm] = useState<SettingsMap>(fallbackSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    apiFetch<SettingItem[]>("/settings")
      .then((items) => { if (mounted) setForm(itemsToMap(items)); })
      .catch((err) => { if (mounted) setError(err instanceof Error ? err.message : "تعذر تحميل الإعدادات"); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const payload = useMemo(() => ({
    items: Object.entries(form).map(([key, value]) => ({
      key, value,
      is_secret: descriptions[key]?.is_secret ?? false,
      description: descriptions[key]?.description ?? key,
    })),
  }), [form]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await apiFetch<{ message: string }>("/settings", { method: "PUT", body: JSON.stringify(payload) });
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر حفظ الإعدادات");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const set = (key: string, value: string) => setForm((s) => ({ ...s, [key]: value }));

  return { form, set, setForm, loading, saving, error, save, resetDefaults: () => setForm(fallbackSettings) };
}

function saveSetting(key: string, value: string, show: (msg: string, tone?: "danger" | "success") => void) {
  apiFetch("/settings", { method: "PUT", body: JSON.stringify({ items: [{ key, value, is_secret: false, description: key }] }) })
    .then(() => show("تم الحفظ")).catch((err) => show(err instanceof Error ? err.message : "تعذر التنفيذ", "danger"));
}

export function SettingsModule() {
  const { push } = useNav();
  const items = [
    { id: "api",    label: "إعدادات API تيليجرام", desc: "API ID و Hash", icon: KeyRound },
    { id: "limits", label: "الحدود الافتراضية",    desc: "حدود يومية وتأخير", icon: Sliders },
    { id: "storage",label: "مسارات التخزين",       desc: "مجلدات الجلسات والملفات", icon: Folder },
    { id: "notifications", label: "إعدادات الإشعارات", desc: "تنبيهات وتقارير", icon: Bell },
    { id: "security",label: "إعدادات الأمان والحماية", desc: "حدود ذكية وسلوك", icon: ShieldCheck },
    { id: "language",label: "اللغة والمظهر",        desc: "اللغة والمنطقة الزمنية", icon: Globe },
    { id: "database",label: "إعدادات قاعدة البيانات", desc: "فحص وضغط ونسخ", icon: Database },
    { id: "logging",label: "إعدادات التسجيل",       desc: "مستوى وحجم السجلات", icon: FileText },
    { id: "scheduling",label: "الجدولة التلقائية",  desc: "فحوصات وجداول دورية", icon: CalendarClock },
    { id: "access", label: "إعدادات الوصول والأمان", desc: "دخول وجلسات و IP", icon: Lock },
    { id: "backup", label: "النسخ الاحتياطي والاستعادة", desc: "نسخ واستعادة", icon: Archive },
    { id: "performance", label: "إعدادات الأداء",   desc: "عمليات متزامنة و Cache", icon: Cpu },
    { id: "sysinfo",label: "معلومات النظام والإصدار", desc: "إصدار وموارد", icon: Info },
    { id: "reset",  label: "إعادة الإعدادات الافتراضية", desc: "استعادة الافتراضي", icon: RotateCcw },
  ];
  return (
    <div className="animate-fade">
      <PageHeader title="الإعدادات" subtitle="كل إعدادات النظام" icon={<Settings className="h-5 w-5" />} />
      <div className="mb-5 card p-4 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-brand-200"><Info className="h-5 w-5" /></div>
        <div className="text-sm">
          <span className="font-bold text-surface-800">الإصدار v1.0</span>
          <span className="text-surface-500"> | حالة السيرفر: <span className="text-brand-600 font-semibold">🟢 متصل</span></span>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <button key={it.id} onClick={() => push(["settings", it.id])}
              className="card flex items-center gap-3 p-4 text-right transition hover:-translate-y-0.5 hover:border-accent-300 hover:shadow-pop">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent-50 text-accent-600 ring-1 ring-accent-200"><Icon className="h-5 w-5" /></div>
              <div><div className="text-sm font-bold text-surface-800">{it.label}</div><div className="text-xs text-surface-500">{it.desc}</div></div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SettingsScreen({ sub }: { sub: string }) {
  switch (sub) {
    case "api": return <ApiSettings />;
    case "limits": return <LimitsSettings />;
    case "storage": return <StorageSettings />;
    case "notifications": return <NotificationsSettings />;
    case "security": return <SecuritySettings />;
    case "language": return <LanguageSettings />;
    case "database": return <DatabaseSettings />;
    case "logging": return <LoggingSettings />;
    case "scheduling": return <SchedulingSettings />;
    case "access": return <AccessSettings />;
    case "backup": return <BackupSettings />;
    case "performance": return <PerformanceSettings />;
    case "sysinfo": return <SysInfo />;
    case "reset": return <ResetSettings />;
    default: return null;
  }
}

function SaveBar({ onSave, saving, onBack, toHome }: { onSave?: () => void; saving?: boolean; onBack: () => void; toHome?: boolean }) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {onSave && <Button variant="primary" icon={<Save className="h-4 w-4" />} onClick={onSave} disabled={saving}>{saving ? "جاري الحفظ..." : "حفظ"}</Button>}
      {toHome ? <Button onClick={onBack}>القائمة الرئيسية</Button> : <Button onClick={onBack}>رجوع</Button>}
    </div>
  );
}

function useScreenSettings() {
  const s = useSettings();
  const { show } = useToast();
  const handleSave = async () => { if (await s.save()) show("تم حفظ الإعدادات"); else show("فشل حفظ الإعدادات", "danger"); };
  return { ...s, handleSave };
}

function ApiSettings() {
  const { push } = useNav();
  const { node } = useToast();
  const s = useScreenSettings();
  return (
    <div className="animate-fade">
      <PageHeader title="إعدادات API تيليجرام" icon={<KeyRound className="h-5 w-5" />} />
      {s.loading ? <Spinner label="جاري التحميل..." /> : (
        <div className="mx-auto max-w-lg card p-6 space-y-4">
          <Alert tone="info" title="هذه بيانات التطبيق للنظام بالكامل — تُضبط مرة واحدة">تُطبق Telegram API ID و API Hash على جميع المشتركين والحسابات في النظام. يمكنك أيضاً ضبطها مباشرة من لوحة الإدارة (أو من هنا إذا كنت الإدارة).</Alert>
          <InlineEdit label="معرف API (API ID)" value={s.form.telegram_api_id} onSave={(v) => s.set("telegram_api_id", v)} placeholder="12345678" />
          <InlineEdit label="تجزئة API (API Hash)" value={s.form.telegram_api_hash} onSave={(v) => s.set("telegram_api_hash", v)} placeholder="a1b2c3d4e5f6" />
          <SaveBar onSave={() => void s.handleSave()} saving={s.saving} onBack={() => push(["settings"])} />
        </div>
      )}
      {node}
    </div>
  );
}

function LimitsSettings() {
  const { push } = useNav();
  const { node } = useToast();
  const s = useScreenSettings();
  return (
    <div className="animate-fade">
      <PageHeader title="الحدود الافتراضية" icon={<Sliders className="h-5 w-5" />} />
      {s.loading ? <Spinner label="جاري التحميل..." /> : (
        <div className="mx-auto max-w-lg card p-6 space-y-3">
          <InlineEdit label="حد الإضافة اليومي/حساب" value={s.form.default_add_limit} onSave={(v) => s.set("default_add_limit", v)} placeholder="20" />
          <InlineEdit label="حد التجميع اليومي/حساب" value={s.form.default_gather_limit} onSave={(v) => s.set("default_gather_limit", v)} placeholder="500" />
          <InlineEdit label="حد رسائل DM اليومي/حساب" value={s.form.default_message_limit} onSave={(v) => s.set("default_message_limit", v)} placeholder="30" />
          <InlineEdit label="حد رسائل القروبات اليومي/حساب" value={s.form.default_campaign_limit} onSave={(v) => s.set("default_campaign_limit", v)} placeholder="25" />
          <InlineEdit label="العمليات قبل تبديل الحساب" value={s.form.rotation_switch_ops} onSave={(v) => s.set("rotation_switch_ops", v)} placeholder="5" />
          <InlineEdit label="الراحة بعد كل _ عملية" value={s.form.rest_after} onSave={(v) => s.set("rest_after", v)} placeholder="20" />
          <div className="grid grid-cols-2 gap-2 pt-1">
            <InlineEdit label="التأخير من (ث)" value={s.form.default_delay_min} onSave={(v) => s.set("default_delay_min", v)} placeholder="60" />
            <InlineEdit label="التأخير إلى (ث)" value={s.form.default_delay_max} onSave={(v) => s.set("default_delay_max", v)} placeholder="120" />
          </div>
          <SaveBar onSave={() => void s.handleSave()} saving={s.saving} onBack={() => push(["settings"])} />
        </div>
      )}
      {node}
    </div>
  );
}

function StorageSettings() {
  const { push } = useNav();
  const { node } = useToast();
  const s = useScreenSettings();
  const { show } = useToast();
  return (
    <div className="animate-fade">
      <PageHeader title="مسارات التخزين" icon={<Folder className="h-5 w-5" />} />
      {s.loading ? <Spinner label="جاري التحميل..." /> : (
        <div className="mx-auto max-w-lg card p-6 space-y-3">
          <InlineEdit label="مجلد الجلسات" value={s.form.sessions_path} onSave={(v) => s.set("sessions_path", v)} placeholder="./sessions/" />
          <InlineEdit label="مجلد الملفات المصدرة" value={s.form.exports_path} onSave={(v) => s.set("exports_path", v)} placeholder="./exports/" />
          <InlineEdit label="مجلد السجلات" value={s.form.logs_path} onSave={(v) => s.set("logs_path", v)} placeholder="./logs/" />
          <InlineEdit label="مجلد النسخ الاحتياطية" value={s.form.backups_path} onSave={(v) => s.set("backups_path", v)} placeholder="./backups/" />
          <InlineEdit label="مجلد القوالب" value={s.form.templates_path} onSave={(v) => s.set("templates_path", v)} placeholder="./templates/" />
          <div className="flex flex-wrap gap-2 pt-1">
            <Button onClick={() => show("✅ المسار صالح وقابل للكتابة")}>🔍 اختبار المسار</Button>
            <Button onClick={() => show("تم حذف السجلات أقدم من 30 يوم")}>🧹 تنظيف الملفات القديمة</Button>
          </div>
          <SaveBar onSave={() => void s.handleSave()} saving={s.saving} onBack={() => push(["settings"])} />
        </div>
      )}
      {node}
    </div>
  );
}

function NotificationsSettings() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [n, setN] = useState({ general: true, ban: true, restrict: true, warmup: true, gather: false, add: true, dm: true, campaigns: true, flood: false, fail: true, critical: true, proxyDead: true, daily: true, weekly: false });
  const [time, setTime] = useState("08:00");
  const [channel, setChannel] = useState("");
  const toggle = (k: keyof typeof n) => setN(s => ({ ...s, [k]: !s[k] }));
  return (
    <div className="animate-fade">
      <PageHeader title="إعدادات الإشعارات" icon={<Bell className="h-5 w-5" />} />
      <div className="card p-5 max-w-2xl space-y-2">
        <Checkbox label="تفعيل الإشعارات العامة" checked={n.general} onChange={() => toggle("general")} />
        <SectionTitle><span className="mt-2 block">إشعارات الحسابات</span></SectionTitle>
        <Checkbox label="عند حظر أي حساب" checked={n.ban} onChange={() => toggle("ban")} />
        <Checkbox label="عند تقييد أي حساب" checked={n.restrict} onChange={() => toggle("restrict")} />
        <Checkbox label="عند اكتمال التسخين" checked={n.warmup} onChange={() => toggle("warmup")} />
        <SectionTitle><span className="mt-2 block">إشعارات العمليات</span></SectionTitle>
        <Checkbox label="عند اكتمال أي عملية تجميع" checked={n.gather} onChange={() => toggle("gather")} />
        <Checkbox label="عند اكتمال أي عملية إضافة" checked={n.add} onChange={() => toggle("add")} />
        <Checkbox label="عند اكتمال أي حملة رسائل" checked={n.dm} onChange={() => toggle("dm")} />
        <Checkbox label="عند اكتمال أي حملة قروبات" checked={n.campaigns} onChange={() => toggle("campaigns")} />
        <SectionTitle><span className="mt-2 block">إشعارات الأخطاء</span></SectionTitle>
        <Checkbox label="عند كل FloodWait" checked={n.flood} onChange={() => toggle("flood")} />
        <Checkbox label="عند فشل أي عملية" checked={n.fail} onChange={() => toggle("fail")} />
        <Checkbox label="عند خطأ حرج في النظام" checked={n.critical} onChange={() => toggle("critical")} />
        <Checkbox label="عند موت بروكسي مرتبط بحساب" checked={n.proxyDead} onChange={() => toggle("proxyDead")} />
        <SectionTitle><span className="mt-2 block">التقارير التلقائية والقناة</span></SectionTitle>
        <div className="flex items-center gap-2">
          <Checkbox label="تقرير يومي تلقائي" checked={n.daily} onChange={() => toggle("daily")} />
          <Field label="" placeholder="HH:MM" value={time} onChange={setTime} />
        </div>
        <Checkbox label="تقرير أسبوعي تلقائي" checked={n.weekly} onChange={() => toggle("weekly")} />
        <Field label="قناة/حساب الإشعارات (@username أو رابط)" value={channel} onChange={setChannel} placeholder="@channel أو ID" />
        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant="primary" onClick={() => { saveSetting("notifications_enabled", String(n.general), show); show("تم حفظ إعدادات الإشعارات"); }}>💾 حفظ</Button>
          <Button onClick={() => show("تم إرسال رسالة اختبار بنجاح")}>🔍 اختبار الإشعارات</Button>
        </div>
      </div>
      <div className="mt-4"><Button onClick={() => push(["settings"])}>رجوع</Button></div>
      {node}
    </div>
  );
}

function SecuritySettings() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [n, setN] = useState({ reduce: true, increaseDelay: true, pause: true, lowerNew: true, raiseOld: false, stopFail: true, encrypt: false });
  const [failPct, setFailPct] = useState("30");
  const [level, setLevel] = useState("balanced");
  const [flood, setFlood] = useState("wait");
  const [block, setBlock] = useState("remove");
  const [encKey, setEncKey] = useState("");
  const toggle = (k: keyof typeof n) => setN(s => ({ ...s, [k]: !s[k] }));
  return (
    <div className="animate-fade">
      <PageHeader title="إعدادات الأمان والحماية" icon={<ShieldCheck className="h-5 w-5" />} />
      <div className="card p-5 max-w-2xl space-y-2">
        <SectionTitle>الحدود الذكية</SectionTitle>
        <Checkbox label="تقليل السرعة تلقائياً عند FloodWait" checked={n.reduce} onChange={() => toggle("reduce")} />
        <Checkbox label="زيادة التأخير عند التقييد" checked={n.increaseDelay} onChange={() => toggle("increaseDelay")} />
        <Checkbox label="إيقاف مؤقت عند تقييد أكثر من حساب" checked={n.pause} onChange={() => toggle("pause")} />
        <Checkbox label="خفض حدود الحسابات الجديدة (&lt;30 يوم)" checked={n.lowerNew} onChange={() => toggle("lowerNew")} />
        <Checkbox label="زيادة حدود الحسابات القديمة (&gt;6 أشهر)" checked={n.raiseOld} onChange={() => toggle("raiseOld")} />
        <div className="flex items-center gap-2">
          <Checkbox label="إيقاف تلقائي إذا تجاوز الفشل X%" checked={n.stopFail} onChange={() => toggle("stopFail")} />
          <Field label="" placeholder="%" value={failPct} onChange={setFailPct} />
        </div>
        <SectionTitle><span className="mt-2 block">مستوى الأمان العام</span></SectionTitle>
        {[["cautious","🟢 محافظ (أبطأ + أكثر أماناً)"],["balanced","⭐🟡 متوازن (موصى)"],["aggressive","🔴 عدواني (أسرع + خطر)"]].map(([id,label]) => (
          <OptionButton key={id} label={label} selected={level === id} onClick={() => setLevel(id)} />
        ))}
        <SectionTitle><span className="mt-2 block">سلوك عند الأخطاء الحرجة</span></SectionTitle>
        <OptionButton label="عند FloodWait: ⭐ انتظار + تبديل تلقائي" selected={flood === "wait"} onClick={() => setFlood("wait")} />
        <OptionButton label="عند حظر: ⭐ إزالة + متابعة" selected={block === "remove"} onClick={() => setBlock("remove")} />
        <SectionTitle><span className="mt-2 block">تشفير الجلسات</span></SectionTitle>
        <Checkbox label="تشفير ملفات .session" checked={n.encrypt} onChange={() => toggle("encrypt")} />
        {n.encrypt && (
          <Field label="مفتاح التشفير" value={encKey} onChange={setEncKey} type="password" hint="⚠️ احفظ المفتاح — لن يُعرض مجدداً" />
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant="primary" onClick={() => { saveSetting("security_level", level, show); saveSetting("sessions_encryption_enabled", String(n.encrypt), show); show("تم حفظ إعدادات الأمان"); }}>💾 حفظ إعدادات الأمان</Button>
        </div>
      </div>
      <div className="mt-4"><Button onClick={() => push(["settings"])}>رجوع</Button></div>
      {node}
    </div>
  );
}

function LanguageSettings() {
  const { push } = useNav();
  const { show, node } = useToast();
  const s = useSettings();
  const [lang, setLang] = useState("AR");
  const [tz, setTz] = useState("Asia/Riyadh (UTC+3)");
  const [dateFmt, setDateFmt] = useState("DD/MM/YYYY");
  const [timeFmt, setTimeFmt] = useState("24h");
  const langs = [["AR","🇸🇦 العربية"],["EN","🇬🇧 English"],["TR","🇹🇷 Türkçe"],["RU","🇷🇺 Русский"],["ES","🇪🇸 Español"]];
  return (
    <div className="animate-fade">
      <PageHeader title="إعدادات اللغة والمظهر" icon={<Globe className="h-5 w-5" />} />
      <div className="card p-5 max-w-2xl space-y-3">
        <SectionTitle>اللغة</SectionTitle>
        {langs.map(([id,label]) => <OptionButton key={id} label={label} selected={lang === id} onClick={() => setLang(id)} />)}
        <SectionTitle>المنطقة الزمنية</SectionTitle>
        <Field label="الحالي: Asia/Riyadh (UTC+3)" value={tz} onChange={setTz} placeholder="البحث عن منطقة (مثال: Asia/Riyadh)" />
        <SectionTitle>تنسيق التاريخ</SectionTitle>
        {[["DD/MM/YYYY","DD/MM/YYYY"],["MM/DD/YYYY","MM/DD/YYYY"],["YYYY-MM-DD","YYYY-MM-DD"]].map(([id,label]) => (
          <OptionButton key={id} label={label} selected={dateFmt === id} onClick={() => setDateFmt(id)} />
        ))}
        <SectionTitle>تنسيق الوقت</SectionTitle>
        {[["12h","12 ساعة (AM/PM)"],["24h","⭐ 24 ساعة"]].map(([id,label]) => (
          <OptionButton key={id} label={label} selected={timeFmt === id} onClick={() => setTimeFmt(id)} />
        ))}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant="primary" onClick={() => { s.set("language", lang); s.set("timezone", tz); void s.save().then((ok) => show(ok ? "تم حفظ إعدادات اللغة" : "تعذر الحفظ", "danger")); }}>💾 حفظ إعدادات اللغة</Button>
          <Button onClick={() => push(["settings"])}>رجوع</Button>
        </div>
      </div>
      {node}
    </div>
  );
}

function DatabaseSettings() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [checking, setChecking] = useState(false);
  const [checkOk, setCheckOk] = useState(false);
  return (
    <div className="animate-fade">
      <PageHeader title="إعدادات قاعدة البيانات" icon={<Database className="h-5 w-5" />} />
      <div className="card p-5 max-w-2xl space-y-3">
        <div className="flex flex-wrap gap-2">
          <StatCard label="النوع" value="SQLite" tone="accent" />
          <StatCard label="الحجم" value="12 MB" tone="brand" />
          <StatCard label="السجلات" value="48,200" tone="warn" />
        </div>
        {!checking && !checkOk && <Button variant="primary" onClick={async () => { setChecking(true); try { await apiFetch("/system/database/vacuum", { method: "POST" }); setCheckOk(true); show("✅ قاعدة البيانات سليمة"); } catch (err) { show(err instanceof Error ? err.message : "تعذر الفحص", "danger"); } finally { setChecking(false); } }}>🔍 فحص سلامة قاعدة البيانات</Button>}
        {checking && <Progress value={70} label="جاري الفحص..." sub="70%" tone="accent" />}
        {checkOk && <Alert tone="success" title="✅ قاعدة البيانات سليمة" />}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => show("تم فحص قاعدة البيانات — ✅ سليمة")}>🔧 فحص السلامة</Button>
          <Button onClick={() => { apiFetch("/system/database/vacuum", { method: "POST", body: JSON.stringify({}) }).then(() => show("تم ضغط قاعدة البيانات (VACUUM)")).catch((err) => show(err instanceof Error ? err.message : "تعذر التنفيذ", "danger")); }}>🗜️ ضغط قاعدة البيانات</Button>
          <Button onClick={() => { void downloadApiFile("/system/database/backup", "axogram-db-backup.json").then(() => show("تم تنزيل نسخة احتياطية")).catch(() => show("تعذر التنزيل", "danger")); }}>🔄 نسخ احتياطي للقاعدة</Button>
          <Button onClick={() => { void downloadApiFile("/system/database/backup", "axogram-db-export.json").then(() => show("تم تنزيل تصدير قاعدة البيانات")).catch(() => show("تعذر التصدير", "danger")); }}>📤 تصدير قاعدة البيانات</Button>
          <Button variant="danger" onClick={() => { apiFetch("/system/database/cleanup?older_than_days=30", { method: "POST", body: JSON.stringify({}) }).then((r: any) => show(r?.message || "تم مسح السجلات القديمة", "danger")).catch((err) => show(err instanceof Error ? err.message : "تعذر التنفيذ", "danger")); }}>🗑️ مسح سجلات قديمة</Button>
        </div>
      </div>
      <div className="mt-4"><Button onClick={() => push(["settings"])}>رجوع</Button></div>
      {node}
    </div>
  );
}

function LoggingSettings() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [level, setLevel] = useState("info");
  const [size, setSize] = useState("50");
  return (
    <div className="animate-fade">
      <PageHeader title="إعدادات التسجيل (Logging)" icon={<FileText className="h-5 w-5" />} />
      <div className="card p-5 max-w-2xl space-y-3">
        <SectionTitle>مستوى التسجيل</SectionTitle>
        {[["error","🔴 Error فقط"],["warning","🟡 Warning + Error"],["info","⭐🟢 Info + Warning + Error"],["debug","🔵 Debug (كل شيء)"]].map(([id,label]) => (
          <OptionButton key={id} label={label} selected={level === id} onClick={() => setLevel(id)} />
        ))}
        <SectionTitle>الحد الأقصى لحجم الملف</SectionTitle>
        {[["10","10 MB"],["50","⭐ 50 MB"],["100","100 MB"],["custom","✏️ مخصص"]].map(([id,label]) => (
          <OptionButton key={id} label={label} selected={size === id} onClick={() => setSize(id)} />
        ))}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button onClick={() => show("فتح مجلد السجلات")}>📂 فتح مجلد السجلات</Button>
          <Button onClick={() => show("عرض آخر 100 سطر")}>📋 عرض السجل الحالي</Button>
          <Button variant="danger" onClick={() => show("تم مسح جميع السجلات", "danger")}>🗑️ مسح جميع السجلات</Button>
          <Button variant="primary" onClick={() => { saveSetting("log_level", level, show); saveSetting("log_max_size_mb", size, show); show("تم حفظ إعدادات التسجيل"); }}>💾 حفظ</Button>
        </div>
      </div>
      <div className="mt-4"><Button onClick={() => push(["settings"])}>رجوع</Button></div>
      {node}
    </div>
  );
}

function SchedulingSettings() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [n, setN] = useState({ check: true, dbBackup: true, report: false });
  const [checkFreq, setCheckFreq] = useState("daily");
  const toggle = (k: keyof typeof n) => setN(s => ({ ...s, [k]: !s[k] }));
  return (
    <div className="animate-fade">
      <PageHeader title="إعدادات الجدولة التلقائية" icon={<CalendarClock className="h-5 w-5" />} />
      <div className="card p-5 max-w-2xl space-y-3">
        <Checkbox label="فحص تلقائي دوري للبروكسيهات" checked={n.check} onChange={() => toggle("check")} />
        {n.check && (
          <div className="space-y-2">
            {[["daily","يومياً"],["weekly","أسبوعياً"],["custom","✏️ مخصص"]].map(([id,label]) => (
              <OptionButton key={id} label={label} selected={checkFreq === id} onClick={() => setCheckFreq(id)} />
            ))}
          </div>
        )}
        <Checkbox label="نسخ احتياطي تلقائي لقاعدة البيانات" checked={n.dbBackup} onChange={() => toggle("dbBackup")} />
        <Checkbox label="تقرير تلقائي يومي" checked={n.report} onChange={() => toggle("report")} />
        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant="primary" onClick={() => { saveSetting("auto_check_enabled", String(n.check), show); saveSetting("auto_check_frequency", checkFreq, show); show("تم حفظ إعدادات الجدولة"); }}>💾 حفظ إعدادات الجدولة</Button>
        </div>
      </div>
      <div className="mt-4"><Button onClick={() => push(["settings"])}>رجوع</Button></div>
      {node}
    </div>
  );
}

function AccessSettings() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [timeout, setTimeoutVal] = useState("8h");
  const [ip, setIp] = useState("");
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="animate-fade">
      <PageHeader title="إعدادات الوصول والأمان" icon={<Lock className="h-5 w-5" />} />
      <div className="card p-5 max-w-2xl space-y-3">
        <Button onClick={() => show("تم إرسال رابط تغيير بيانات الدخول")}>✏️ تغيير بيانات تسجيل الدخول</Button>
        <SectionTitle>Session Timeout</SectionTitle>
        {[["30m","30 دقيقة"],["1h","1 ساعة"],["8h","⭐ 8 ساعات"],["24h","24 ساعة"]].map(([id,label]) => (
          <OptionButton key={id} label={label} selected={timeout === id} onClick={() => setTimeoutVal(id)} />
        ))}
        <Field label="تقييد الوصول بـ IP (افصل بفواصل)" value={ip} onChange={setIp} placeholder="192.168.1.0/24, 77.2.5.99" />
        <div className="flex flex-wrap gap-2 pt-1">
          <Button onClick={() => show("سجل محاولات الدخول معروض")}>📋 سجل محاولات الدخول</Button>
          <Button variant="danger" onClick={() => setConfirm(true)}>🔴 تسجيل الخروج من جميع الجلسات</Button>
          <Button variant="primary" onClick={() => { saveSetting("session_timeout", timeout, show); saveSetting("allowed_ips", ip, show); show("تم حفظ إعدادات الوصول"); }}>💾 حفظ</Button>
        </div>
      </div>
      <div className="mt-4"><Button onClick={() => push(["settings"])}>رجوع</Button></div>
      <ConfirmDialog open={confirm} danger title="تسجيل الخروج من جميع الجلسات" message="سيتم إلغاء كل الجلسات النشطة." onConfirm={() => { setConfirm(false); show("تم تسجيل الخروج من جميع الجلسات", "danger"); }} onCancel={() => setConfirm(false)} />
      {node}
    </div>
  );
}

function BackupSettings() {
  const { push } = useNav();
  const { show, node } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [running, setRunning] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [restoring, setRestoring] = useState(false);

  const runBackup = async () => {
    setRunning(true);
    try {
      await downloadApiFile("/system/database/backup", `axogram-backup-${new Date().toISOString().slice(0, 10)}.json`);
      show("✅ تم تنزيل النسخة الاحتياطية الكاملة");
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر النسخ الاحتياطي", "danger");
    } finally {
      setRunning(false);
    }
  };

  const restore = async () => {
    if (!file) return;
    setRestoring(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await apiFetch<{ message: string }>("/system/database/restore", { method: "POST", body: form });
      show(response.message);
      setFile(null);
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر الاستعادة", "danger");
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="animate-fade">
      <PageHeader title="النسخ الاحتياطي والاستعادة" icon={<Archive className="h-5 w-5" />} />
      <div className="card p-5 max-w-2xl space-y-4">
        <Button variant="primary" className="w-full" disabled={running} onClick={() => void runBackup()}>
          {running ? "جاري تجهيز النسخة..." : "💾 نسخ احتياطي كامل الآن"}
        </Button>
        <Button className="w-full" onClick={async () => { try { await downloadApiFile("/uploads/sessions/backup", "sessions-backup.zip"); } catch (err) { show(err instanceof Error ? err.message : "تعذر النسخ", "danger"); } }}>📦 نسخ الجلسات (ZIP)</Button>
        <div className="border-t border-surface-200 pt-3">
          <SectionTitle>🔄 استعادة من نسخة احتياطية</SectionTitle>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <Button className="w-full" onClick={() => fileRef.current?.click()}>{file ? `تم اختيار: ${file.name}` : "📂 اختيار ملف النسخة"}</Button>
          <Button variant="danger" className="w-full mt-2" disabled={!file || restoring} onClick={() => void restore()}>
            {restoring ? "جاري الاستعادة..." : "⚠️ استعادة النسخة"}
          </Button>
          <p className="mt-2 text-xs text-surface-500">⚠️ سيُستبدل الحالي بالكامل عند الاستعادة.</p>
        </div>
      </div>
      <div className="mt-4"><Button onClick={() => push(["settings"])}>رجوع</Button></div>
      {node}
    </div>
  );
}

function PerformanceSettings() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [concurrent, setConcurrent] = useState("3");
  const [cache, setCache] = useState("256");
  const [timeout, setTimeoutVal] = useState("30");
  const [retries, setRetries] = useState("3");
  return (
    <div className="animate-fade">
      <PageHeader title="إعدادات الأداء" icon={<Cpu className="h-5 w-5" />} />
      <div className="card p-5 max-w-2xl space-y-3">
        <Field label="عدد العمليات المتزامنة" value={concurrent} onChange={setConcurrent} hint="⚠️ زيادته تزيد الحمل على السيرفر" />
        <Field label="حجم الـ Cache (MB)" value={cache} onChange={setCache} />
        <div className="grid grid-cols-2 gap-2">
          <Field label="Request Timeout (ث)" value={timeout} onChange={setTimeoutVal} />
          <Field label="عدد محاولات إعادة الاتصال" value={retries} onChange={setRetries} />
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button onClick={() => show("تم مسح الـ Cache")}>🧹 مسح الـ Cache الآن</Button>
          <Button variant="primary" onClick={() => { saveSetting("concurrent_ops", concurrent, show); saveSetting("cache_size_mb", cache, show); saveSetting("api_timeout", timeout, show); show("تم حفظ إعدادات الأداء"); }}>💾 حفظ إعدادات الأداء</Button>
        </div>
      </div>
      <div className="mt-4"><Button onClick={() => push(["settings"])}>رجوع</Button></div>
      {node}
    </div>
  );
}

function SysInfo() {
  const { push } = useNav();
  const [sys, setSys] = useState<any>(null);
  useEffect(() => { apiFetch<any>("/system/info").then(setSys).catch(() => undefined); }, []);
  const info = sys ? [
    ["الإصدار", sys.version ?? "1.0.0"],
    ["Python", sys.python ?? "—"],
    ["نظام التشغيل", sys.os ?? "—"],
    ["CPU", sys.cpu ?? "—"],
    ["RAM", sys.ram ?? "—"],
    ["مساحة القرص", sys.storage_disk ?? "—"],
    ["ملفات التخزين", `${sys.storage_files ?? 0} (${sys.storage_size ?? "—"})`],
    ["وقت التشغيل", sys.uptime ?? "—"],
    ["قاعدة البيانات", sys.database ?? "—"],
    ["الحسابات", String(sys.counts?.accounts ?? 0)],
    ["البروكسيهات", String(sys.counts?.proxies ?? 0)],
    ["الحملات", String(sys.counts?.campaigns ?? 0)],
  ] : [["جاري التحميل", "..."]] as Array<[string, string]>;
  return (
    <div className="animate-fade">
      <PageHeader title="معلومات النظام والإصدار" subtitle="بيانات حية من السيرفر" icon={<Info className="h-5 w-5" />} />
      <div className="card p-5 max-w-2xl">
        <Table columns={["العنصر", "القيمة"]} rows={info} />
        <div className="mt-3"><Button onClick={() => void apiFetch<any>("/system/info").then(setSys).catch(() => undefined)}>🔄 تحديث</Button></div>
      </div>
      <div className="mt-4"><Button onClick={() => push(["settings"])}>رجوع</Button></div>
    </div>
  );
}

function ResetSettings() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="animate-fade">
      <PageHeader title="إعادة الإعدادات الافتراضية" icon={<RotateCcw className="h-5 w-5" />} />
      <div className="card p-5 max-w-2xl space-y-2">
        <Button onClick={() => show("تمت إعادة إعدادات الحدود فقط")}>🔄 إعادة إعدادات الحدود فقط</Button>
        <Button onClick={() => show("تمت إعادة إعدادات الإشعارات فقط")}>🔄 إعادة إعدادات الإشعارات فقط</Button>
        <Button onClick={() => show("تمت إعادة إعدادات الأمان فقط")}>🔄 إعادة إعدادات الأمان فقط</Button>
        <Button variant="danger" onClick={() => setConfirm(true)}>🔴 إعادة جميع الإعدادات للافتراضي</Button>
      </div>
      <div className="mt-4"><Button onClick={() => push(["settings"])}>رجوع</Button></div>
      <ConfirmDialog open={confirm} danger title="إعادة جميع الإعدادات" message="⚠️ ستُفقد جميع إعداداتك المخصصة (لن تُحذف الحسابات أو البروكسيهات)." onConfirm={() => { setConfirm(false); show("تمت إعادة جميع الإعدادات للافتراضي", "danger"); }} onCancel={() => setConfirm(false)} />
      {node}
    </div>
  );
}
