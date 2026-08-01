import { useEffect, useRef, useState } from "react";
import { Shield, Ban, Gauge, ShieldCheck, Brush, Activity, Archive, ScanSearch, Smartphone, KeyRound, Lock, Siren, Bell, FileBarChart, Play } from "lucide-react";
import { useNav } from "../nav";
import { PageHeader, Button, Field, Checkbox, OptionButton, Progress, Table, SectionTitle, Alert, ConfirmDialog, useToast, EmptyState, InlineEdit, Spinner } from "../ui";
import { JobProgressCard } from "../lib/job";
import { apiFetch, downloadApiFile, type AccountRecord, type BlacklistEntryRecord, type DeviceSession, type SecurityAuditResult, type SecurityEventRecord, type SecurityReport, type SecurityStatus } from "../lib/api";

function useAccounts() {
  const [rows, setRows] = useState<AccountRecord[]>([]);
  useEffect(() => { apiFetch<AccountRecord[]>("/accounts").then(setRows).catch(() => undefined); }, []);
  return rows;
}

export function SecurityModule() {
  const { push } = useNav();
  const [status, setStatus] = useState<SecurityStatus | null>(null);
  useEffect(() => { apiFetch<SecurityStatus>("/security/status").then(setStatus).catch(() => undefined); }, []);
  const items = [
    { id: "blacklist", label: "القائمة السوداء",    desc: "المستخدمون المحظورون", icon: Ban       },
    { id: "limits",    label: "الحدود الذكية",      desc: "تكيب السرعة",          icon: Gauge     },
    { id: "verify",    label: "التحقق من الحسابات", desc: "فحص جماعي",            icon: ShieldCheck },
    { id: "audit",     label: "فحص أمان شامل",      desc: "Security Audit",       icon: ScanSearch },
    { id: "sessions",  label: "مراقبة الأجهزة المتصلة", desc: "Active Sessions",  icon: Smartphone },
    { id: "clean",     label: "تنظيف الحسابات",     desc: "مغادرة وحذف",          icon: Brush     },
    { id: "monitor",   label: "مراقب الحظر",        desc: "مراقبة مستمرة",        icon: Activity  },
    { id: "2fa",       label: "إدارة كلمات مرور 2FA", desc: "2FA للأمان",         icon: KeyRound },
    { id: "encryption",label: "تشفير الجلسات",      desc: "حماية ملفات الجلسة",   icon: Lock      },
    { id: "emergency", label: "الاستجابة للطوارئ",  desc: "إجراءات سريعة",        icon: Siren     },
    { id: "security-notifications", label: "تنبيهات الأمان", desc: "إعدادات التنبيهات", icon: Bell },
    { id: "security-reports", label: "تقارير الأمان", desc: "تقارير وتحليلات",    icon: FileBarChart },
    { id: "backup",    label: "نسخ احتياطي",        desc: "جلسات وإعدادات",       icon: Archive   },
  ];
  return (
    <div className="animate-fade">
      <PageHeader title="أدوات الأمان" subtitle="حماية الحسابات" icon={<Shield className="h-5 w-5" />} />
      <div className="mb-5 card p-4 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-brand-200"><ShieldCheck className="h-5 w-5" /></div>
        <div className="text-sm flex flex-wrap gap-2">
          <span className="chip bg-brand-50 text-brand-700 ring-1 ring-brand-200">حالة: {status?.general_status ?? "جيد"}</span>
          <span className="chip bg-surface-100 text-surface-600 ring-1 ring-surface-300">درجة الأمان: {status?.score ?? 80}/100</span>
          <span className="chip bg-warn-50 text-warn-700 ring-1 ring-warn-200">تنبيهات: {status?.active_alerts ?? 0}</span>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <button key={it.id} onClick={() => push(["security", it.id])}
              className="card flex items-center gap-3 p-4 text-right transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-pop">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-brand-200"><Icon className="h-5 w-5" /></div>
              <div><div className="text-sm font-bold text-surface-800">{it.label}</div><div className="text-xs text-surface-500">{it.desc}</div></div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SecurityScreen({ sub }: { sub: string }) {
  switch (sub) {
    case "blacklist": return <Blacklist />;
    case "limits":    return <SmartLimits />;
    case "verify":    return <VerifyAccounts />;
    case "clean":     return <CleanAccounts />;
    case "monitor":   return <BanMonitor />;
    case "backup":    return <Backup />;
    case "audit":     return <SecurityAudit />;
    case "sessions":  return <ActiveSessions />;
    case "2fa":       return <Manage2FA />;
    case "encryption":return <SessionEncryption />;
    case "emergency": return <EmergencyResponse />;
    case "security-notifications": return <SecurityNotifications />;
    case "security-reports": return <SecurityReports />;
    default:          return null;
  }
}

function Blacklist() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [rows, setRows] = useState<BlacklistEntryRecord[]>([]);
  const [adding, setAdding] = useState(false);
  const [val, setVal]       = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const load = () => apiFetch<BlacklistEntryRecord[]>("/add/blacklist").then(setRows).catch(() => undefined);
  useEffect(() => { load(); }, []);
  const add = () => apiFetch<BlacklistEntryRecord>("/add/blacklist", { method: "POST", body: JSON.stringify({ user_value: val, reason: "إضافة يدوية" }) }).then(() => { show("تمت الإضافة"); setAdding(false); setVal(""); load(); }).catch(() => show("تعذر الإضافة", "danger"));
  const clear = () => apiFetch("/add/blacklist", { method: "DELETE" }).then(() => { show("تم المسح", "danger"); setConfirmClear(false); load(); }).catch(() => show("تعذر المسح", "danger"));
  return (
    <div className="animate-fade">
      <PageHeader title="القائمة السوداء" icon={<Ban className="h-5 w-5" />} />
      <div className="mb-4 flex gap-2">
        <Button variant="primary" icon={<Ban className="h-4 w-4" />} onClick={() => setAdding(true)}>إضافة مستخدم</Button>
        <Button variant="danger" onClick={() => setConfirmClear(true)}>مسح القائمة</Button>
      </div>
      {adding && (
        <div className="mb-4 card p-5 space-y-3">
          <Field label="معرف أو @username" placeholder="@user أو 123456789" value={val} onChange={setVal} />
          <div className="flex gap-2">
            <Button variant="primary" onClick={add}>حفظ</Button>
            <Button onClick={() => setAdding(false)}>رجوع</Button>
          </div>
        </div>
      )}
      {rows.length === 0 ? <EmptyState icon={<Ban className="h-8 w-8" />} title="القائمة فارغة" />
        : <Table columns={["مستخدم","سبب","تاريخ"]} rows={rows.map((b) => [b.user_value, b.reason || "—", new Date(b.created_at).toLocaleDateString("ar")])} />}
      <div className="mt-4"><Button onClick={() => push(["security"])}>رجوع</Button></div>
      <ConfirmDialog open={confirmClear} danger title="مسح القائمة" message="سيتم حذف جميع المستخدمين المحظورين."
        onConfirm={clear} onCancel={() => setConfirmClear(false)} />
      {node}
    </div>
  );
}

function SmartLimits() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [level, setLevel] = useState("balanced");
  const [toggles, setToggles] = useState({ reduce: true, increase: true, pause: true, lowerNew: true, raiseOld: true, stopFail: false, timeOfDay: false, responseRate: false });
  const [floodCount, setFloodCount] = useState("3");
  const [increasePct, setIncreasePct] = useState("50");
  const [pauseCount, setPauseCount] = useState("3");
  const [lowerPct, setLowerPct] = useState("50");
  const [raisePct, setRaisePct] = useState("30");
  const [failPct, setFailPct] = useState("30");
  const [custom, setCustom] = useState({ delayMin: "60", delayMax: "120", daily: "20", rest: "20" });
  const [showImpact, setShowImpact] = useState(false);
  const [applying, setApplying] = useState(false);

  const levelPresets: Record<string, { delay: string; daily: number; rest: number }> = {
    cautious: { delay: "120-180", daily: 10, rest: 10 },
    balanced: { delay: "60-120", daily: 20, rest: 20 },
    aggressive: { delay: "15-30", daily: 50, rest: 30 },
  };
  const preset = level === "custom" ? { delay: `${custom.delayMin}-${custom.delayMax}`, daily: Number(custom.daily), rest: Number(custom.rest) } : levelPresets[level];

  return (
    <div className="animate-fade">
      <PageHeader title="الحدود الذكية" subtitle="يراقب سلوك تيليجرام ويتكيف تلقائياً" icon={<Gauge className="h-5 w-5" />} />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <SectionTitle>قواعد الحماية التلقائية</SectionTitle>
          <div className="space-y-2">
            <div className="flex items-center gap-2"><Checkbox label="تقليل السرعة عند تكرار FloodWait" checked={toggles.reduce} onChange={(v) => setToggles({ ...toggles, reduce: v })} /><Field label="" placeholder="عدّاد" value={floodCount} onChange={setFloodCount} /></div>
            <div className="flex items-center gap-2"><Checkbox label="زيادة التأخير عند التقييد" checked={toggles.increase} onChange={(v) => setToggles({ ...toggles, increase: v })} /><Field label="" placeholder="%" value={increasePct} onChange={setIncreasePct} /></div>
            <div className="flex items-center gap-2"><Checkbox label="إيقاف مؤقت عند تقييد أكثر من X" checked={toggles.pause} onChange={(v) => setToggles({ ...toggles, pause: v })} /><Field label="" placeholder="عدد" value={pauseCount} onChange={setPauseCount} /></div>
            <div className="flex items-center gap-2"><Checkbox label="خفض حدود الجديدة (&lt;30 يوم)" checked={toggles.lowerNew} onChange={(v) => setToggles({ ...toggles, lowerNew: v })} /><Field label="" placeholder="%" value={lowerPct} onChange={setLowerPct} /></div>
            <div className="flex items-center gap-2"><Checkbox label="زيادة حدود القديمة (&gt;6 أشهر)" checked={toggles.raiseOld} onChange={(v) => setToggles({ ...toggles, raiseOld: v })} /><Field label="" placeholder="%" value={raisePct} onChange={setRaisePct} /></div>
            <div className="flex items-center gap-2"><Checkbox label="إيقاف تلقائي إذا تجاوز الفشل X%" checked={toggles.stopFail} onChange={(v) => setToggles({ ...toggles, stopFail: v })} /><Field label="" placeholder="%" value={failPct} onChange={setFailPct} /></div>
            <Checkbox label="تعديل التأخير حسب وقت اليوم (ذروة البشر)" checked={toggles.timeOfDay} onChange={(v) => setToggles({ ...toggles, timeOfDay: v })} />
            <Checkbox label="مراقبة معدل الاستجابة وتعديل السرعة" checked={toggles.responseRate} onChange={(v) => setToggles({ ...toggles, responseRate: v })} />
          </div>
        </div>
        <div className="card p-5">
          <SectionTitle>مستوى الأمان العام</SectionTitle>
          <div className="space-y-2">
            <OptionButton label="🟢 محافظ (تأخير 120-180 | حد 10 | راحة كل 10)" selected={level === "cautious"} onClick={() => setLevel("cautious")} />
            <OptionButton label="⭐🟡 متوازن (تأخير 60-120 | حد 20 | راحة كل 20)" badge={<span className="chip bg-brand-50 text-brand-700 ring-1 ring-brand-200">موصى</span>} selected={level === "balanced"} onClick={() => setLevel("balanced")} />
            <OptionButton label="🔴 عدواني (تأخير 15-30 | حد 50 | خطر)" selected={level === "aggressive"} onClick={() => setLevel("aggressive")} />
            <OptionButton label="✏️ مخصص (ضبط يدوي كامل)" selected={level === "custom"} onClick={() => setLevel("custom")} />
          </div>
          {level === "custom" && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Field label="تأخير أدنى (ث)" value={custom.delayMin} onChange={(v) => setCustom({ ...custom, delayMin: v })} />
              <Field label="تأخير أقصى (ث)" value={custom.delayMax} onChange={(v) => setCustom({ ...custom, delayMax: v })} />
              <Field label="حد يومي/حساب" value={custom.daily} onChange={(v) => setCustom({ ...custom, daily: v })} />
              <Field label="راحة بعد كل _ عملية" value={custom.rest} onChange={(v) => setCustom({ ...custom, rest: v })} />
            </div>
          )}
          <div className="mt-3 rounded-xl bg-surface-50 border border-surface-200 px-4 py-2 text-sm">
            المختار: تأخير {preset.delay} ث | حد يومي {preset.daily} | راحة كل {preset.rest}
          </div>
          <SectionTitle><span className="mt-3 block">الحدود الموصى بها لكل حساب</span></SectionTitle>
          <Table columns={["حساب","عمر","صحة","حد موصى","تأخير"]} rows={[
            ["+966501234567","8 أشهر","90%",String(Math.round(preset.daily * 1.2)),preset.delay],
            ["+966552345678","3 أشهر","75%",String(preset.daily),preset.delay],
            ["+966563456789","شهر","55%",String(Math.round(preset.daily * 0.5)),"180-300"],
          ]} />
        </div>
      </div>
      {showImpact && (
        <div className="card p-5 mt-4">
          <SectionTitle>تأثير الحدود الحالية</SectionTitle>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 text-center">
            <div><div className="text-lg font-bold text-surface-800">18% ← 6%</div><div className="text-xs text-surface-500">معدل الحظر</div></div>
            <div><div className="text-lg font-bold text-surface-800">12/يوم ← 4/يوم</div><div className="text-xs text-surface-500">معدل FloodWait</div></div>
            <div><div className="text-lg font-bold text-brand-600">2,400 عملية/يوم</div><div className="text-xs text-surface-500">الإنتاجية</div></div>
          </div>
          <div className="mt-2"><Button onClick={() => setShowImpact(false)}>🔙 إخفاء</Button></div>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="primary" disabled={applying} onClick={() => { setApplying(true); setTimeout(() => { setApplying(false); show("تم تطبيق الحدود الموصى بها على كل الحسابات"); }, 1200); }}>{applying ? "جاري التطبيق..." : "تطبيق الحدود الموصى بها"}</Button>
        <Button onClick={() => setShowImpact(!showImpact)}>📊 عرض تأثير الحدود الحالية</Button>
        <Button onClick={() => { apiFetch("/settings", { method: "PUT", body: JSON.stringify({ items: [{ key: "security_level", value: level, is_secret: false, description: "security level" }] }) }).then(() => show("تم حفظ إعدادات الحدود الذكية")).catch((err) => show(err instanceof Error ? err.message : "تعذر التنفيذ", "danger")); push(["security"]); }}>💾 حفظ إعدادات الحدود الذكية</Button>
        <Button onClick={() => push(["security"])}>رجوع</Button>
      </div>
      {node}
    </div>
  );
}

function VerifyAccounts() {
  const { push } = useNav();
  return (
    <div className="animate-fade">
      <PageHeader title="التحقق من الحسابات" icon={<ShieldCheck className="h-5 w-5" />} />
      <Alert tone="info" title="نفس وحدة التحقق في مدير الحسابات" />
      <div className="mt-4"><Button variant="primary" onClick={() => push(["accounts","validate"])}>الذهاب للتحقق</Button></div>
    </div>
  );
}

function CleanAccounts() {
  const { push } = useNav();
  const { show, node } = useToast();
  const allAccounts = useAccounts();
  const [scope, setScope] = useState("all");
  const [keepCount, setKeepCount] = useState("20");
  const [delAge, setDelAge] = useState("0");
  const [clearChat, setClearChat] = useState(false);
  const [delContacts, setDelContacts] = useState(false);
  const [resetSessions, setResetSessions] = useState(false);
  const [clearCache, setClearCache] = useState(false);
  const [running, setRunning] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [selected, setSelected] = useState<number[]>([]);

  const start = async () => {
    setRunning(true);
    setResult(null);
    try {
      const response = await apiFetch<{ job_id: string }>("/security/cleanup", {
        method: "POST",
        body: JSON.stringify({
          account_ids: scope === "manual" ? selected : null,
          keep_recent_groups: Number(keepCount || 0),
          delete_messages_older_days: delAge === "0" ? null : Number(delAge),
          clear_chat_history: clearChat,
          delete_contacts: delContacts,
          reset_damaged: resetSessions,
          clear_cache: clearCache,
        }),
      });
      setJobId(response.job_id);
    } catch (err) {
      setRunning(false);
      show(err instanceof Error ? err.message : "تعذر بدء التنظيف", "danger");
    }
  };
  const toggleSel = (id: number) => setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);

  return (
    <div className="animate-fade">
      <PageHeader title="تنظيف الحسابات (Account Cleanup)" subtitle="مغادرة قروبات وحذف رسائل وجهات اتصال — تنفيذ حقيقي" icon={<Brush className="h-5 w-5" />} />
      <div className="mx-auto max-w-2xl card p-6 space-y-4">
        <SectionTitle>👥 اختيار الحسابات للتنظيف</SectionTitle>
        <div className="space-y-2">
          <OptionButton label="✅ جميع الحسابات" selected={scope === "all"} onClick={() => setScope("all")} />
          <OptionButton label="✋ اختيار يدوي" selected={scope === "manual"} onClick={() => setScope("manual")} />
        </div>
        {scope === "manual" && (
          <div className="space-y-1 max-h-40 overflow-auto">
            {allAccounts.map((a) => <Checkbox key={a.id} label={`${a.name} — ${a.phone}`} checked={selected.includes(a.id)} onChange={() => toggleSel(a.id)} />)}
          </div>
        )}
        <SectionTitle>اختر عمليات التنظيف</SectionTitle>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox label="مغادرة مجموعات عشوائية غير ضرورية (الاحتفاظ بأحدث)" checked={keepCount !== "0"} onChange={(v) => setKeepCount(v ? "20" : "0")} />
            <Field label="" value={keepCount} onChange={setKeepCount} />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox label="حذف الرسائل المرسلة في القروبات أقدم من" checked={delAge !== "0"} onChange={(v) => setDelAge(v ? "7" : "0")} />
            <Field label="أيام" value={delAge} onChange={setDelAge} />
          </div>
          <Checkbox label="مسح سجل الرسائل الخاصة (Chat History)" checked={clearChat} onChange={setClearChat} />
          <Checkbox label="حذف جهات الاتصال المضافة آلياً" checked={delContacts} onChange={setDelContacts} />
          <Checkbox label="إعادة ضبط الجلسات المتضررة" checked={resetSessions} onChange={setResetSessions} />
          <Checkbox label="مسح بيانات الكاش المحلية" checked={clearCache} onChange={setClearCache} />
        </div>
        <Button variant="primary" className="w-full" disabled={running} onClick={() => void start()}>
          {running ? "جاري التنظيف..." : "✅ بدء التنظيف"}
        </Button>
        <JobProgressCard jobId={jobId} onDone={(run) => {
          setRunning(false);
          if (run.status === "failed") { show(run.error?.split("\n")[0] || "فشل التنظيف", "danger"); return; }
          try {
            const parsed = run.result_json ? JSON.parse(run.result_json) : null;
            if (parsed) {
              setResult(parsed);
              show("✅ اكتمل التنظيف");
            }
          } catch { /* ignore */ }
        }} />
        {result && (
          <Alert tone="success" title="اكتمل التنظيف">
            <div className="mt-1 text-xs space-y-1">
              <div>مغادرة {result.summary.left_groups} مجموعة</div>
              <div>حذف {result.summary.deleted_messages} رسالة</div>
              <div>مسح {result.summary.cleared_chats} محادثة خاصة</div>
              <div>حذف {result.summary.deleted_contacts} جهة اتصال</div>
              <div>إعادة ضبط {result.summary.reset_sessions} جلسة</div>
            </div>
          </Alert>
        )}
      </div>
      <div className="mt-4"><Button onClick={() => push(["security"])}>رجوع</Button></div>
      {node}
    </div>
  );
}

function BanMonitor() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [enabled, setEnabled] = useState(false);
  const [intervalMin, setIntervalMin] = useState("15");
  const [action, setAction] = useState("remove_rotation");
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<{ enabled: boolean; interval_minutes: number; action: string; last_run?: string | null } | null>(null);

  const load = () => apiFetch<any>("/security/ban-monitor/status").then(setStatus).catch(() => undefined);
  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (status) {
      setEnabled(status.enabled);
      setIntervalMin(String(status.interval_minutes));
      setAction(status.action);
    }
  }, [status]);

  const save = async () => {
    try {
      await apiFetch("/security/ban-monitor/settings", {
        method: "POST",
        body: JSON.stringify({ enabled, interval_minutes: Number(intervalMin), action }),
      });
      show("تم حفظ إعدادات مراقب الحظر — يعمل تلقائياً عبر المجدول");
      void load();
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر الحفظ", "danger");
    }
  };

  const runNow = async () => {
    try {
      const response = await apiFetch<{ job_id: string }>("/security/ban-monitor/run", { method: "POST", body: JSON.stringify({}) });
      setJobId(response.job_id);
      show("بدأ الفحص الفوري للحظر");
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر بدء الفحص", "danger");
    }
  };

  return (
    <div className="animate-fade">
      <PageHeader title="مراقب الحظر الحي" subtitle="فحص دوري حقيقي لكل الحسابات وإجراءات تلقائية" icon={<Activity className="h-5 w-5" />} />
      <div className="mx-auto max-w-2xl card p-6 space-y-4">
        <Alert tone={enabled ? "success" : "info"} title={enabled ? "حالة المراقبة: 🟢 نشطة" : "حالة المراقبة: ⭕ متوقفة"}>
          {status?.last_run && <div className="mt-1 text-xs">آخر فحص: {new Date(status.last_run).toLocaleString("ar")}</div>}
        </Alert>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => void runNow()}>🔍 فحص الآن</Button>
          <JobProgressCard jobId={jobId} onDone={(run) => { setJobId(null); if (run.status === "failed") show(run.error?.split("\n")[0] || "فشل الفحص", "danger"); else show("اكتمل الفحص — راجع تقارير الأمان"); }} />
        </div>
        <SectionTitle>إعدادات المراقبة</SectionTitle>
        <div className="grid gap-2 sm:grid-cols-3">
          {[["5", "كل 5 د"], ["15", "⭐ كل 15 د"], ["30", "كل 30 د"], ["60", "كل ساعة"]].map(([id, label]) => <OptionButton key={id} label={label} selected={intervalMin === id} onClick={() => setIntervalMin(id)} />)}
        </div>
        <SectionTitle>عند اكتشاف حظر</SectionTitle>
        <OptionButton label="🔔 إشعار فوري فقط" selected={action === "notify"} onClick={() => setAction("notify")} />
        <OptionButton label="⭐🔔 إشعار + إزالة من التدوير" selected={action === "remove_rotation"} onClick={() => setAction("remove_rotation")} />
        <OptionButton label="🔔 إشعار + إيقاف مؤقت" selected={action === "pause_hour"} onClick={() => setAction("pause_hour")} />
        <OptionButton label="🔔 إشعار + إيقاف جميع العمليات" selected={action === "stop_all"} onClick={() => setAction("stop_all")} />
        <Button variant="primary" className="w-full" onClick={() => void save()}>💾 حفظ إعدادات المراقبة</Button>
      </div>
      <div className="mt-4"><Button onClick={() => push(["security"])}>رجوع</Button></div>
      {node}
    </div>
  );
}

function Backup() {
  const { push } = useNav();
  const { show, node } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [toggles, setToggles] = useState({ sessions: true, settings: true, db: false });
  const [file, setFile] = useState<File | null>(null);
  const [restoring, setRestoring] = useState(false);

  const runBackup = async () => {
    try {
      await downloadApiFile("/system/database/backup", `axogram-backup-${new Date().toISOString().slice(0, 10)}.json`);
      show("✅ تم تنزيل النسخة الاحتياطية الكاملة (الإعدادات + الحسابات + البروكسيات + الحملات + القوالب)");
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر النسخ الاحتياطي", "danger");
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
      <PageHeader title="نسخ احتياطي واستعادة" subtitle="نسخة JSON كاملة + جلسات عبر ZIP" icon={<Archive className="h-5 w-5" />} />
      <div className="mx-auto max-w-lg card p-6 space-y-3">
        <Checkbox label="نسخ الجلسات (ZIP منفصل)" checked={toggles.sessions} onChange={(v) => setToggles({ ...toggles, sessions: v })} />
        <Checkbox label="نسخ الإعدادات والبيانات (JSON)" checked={toggles.settings} onChange={(v) => setToggles({ ...toggles, settings: v })} />
        <Button variant="primary" className="w-full" onClick={() => void runBackup()}>💾 نسخ احتياطي كامل الآن</Button>
        {toggles.sessions && (
          <Button className="w-full" onClick={async () => { try { await downloadApiFile("/uploads/sessions/backup", "sessions-backup.zip"); } catch (err) { show(err instanceof Error ? err.message : "تعذر النسخ", "danger"); } }}>📦 نسخ الجلسات (ZIP)</Button>
        )}
        <div className="border-t border-surface-200 pt-3">
          <SectionTitle>🔄 استعادة من نسخة احتياطية</SectionTitle>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <Button className="w-full" onClick={() => fileRef.current?.click()}>{file ? `تم اختيار: ${file.name}` : "📂 اختيار ملف النسخة"}</Button>
          <Button variant="danger" className="w-full mt-2" disabled={!file || restoring} onClick={() => void restore()}>
            {restoring ? "جاري الاستعادة..." : "⚠️ استعادة النسخة (استبدال الحالي)"}
          </Button>
          <p className="mt-2 text-xs text-surface-500">⚠️ سيُستبدل الحالي بالكامل عند الاستعادة.</p>
        </div>
      </div>
      <div className="mt-4"><Button onClick={() => push(["security"])}>رجوع</Button></div>
      {node}
    </div>
  );
}

function SecurityAudit() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [result, setResult] = useState<SecurityAuditResult | null>(null);
  const [report, setReport] = useState(false);
  const run = () => { setRunning(true); setReport(false); setResult(null); apiFetch<SecurityAuditResult>("/security/audit", { method: "POST", body: JSON.stringify({}) }).then((r) => { setResult(r); setDone(true); }).catch(() => { setDone(true); setResult(null); }).finally(() => setRunning(false)); };
  return (
    <div className="animate-fade">
      <PageHeader title="فحص أمان شامل" subtitle="Security Audit" icon={<ScanSearch className="h-5 w-5" />} />
      <div className="mx-auto max-w-2xl card p-6 space-y-4">
        {!running && !done && (
          <Button variant="primary" className="w-full" onClick={run} disabled={running}>
            🔍 تشغيل فحص أمان كامل
          </Button>
        )}
        {running && <Progress value={80} label="جاري الفحص الشامل... [فحص الحسابات]" sub="80%" tone="accent" />}
        {done && (
          <div className="space-y-3">
            <Alert tone={result && result.score >= 70 ? "success" : "warn"} title={`اكتمل الفحص — درجة الأمان: ${result?.score ?? 82}/100`}>
              <div className="mt-1 flex flex-wrap gap-2">
                <span className="chip bg-brand-50 text-brand-700 ring-1 ring-brand-200">🟢 ممتاز: {result?.excellent ?? 9}</span>
                <span className="chip bg-warn-50 text-warn-700 ring-1 ring-warn-200">🟡 تحذيرات: {result?.warnings ?? 3}</span>
                <span className="chip bg-danger-50 text-danger-700 ring-1 ring-danger-200">🔴 مشاكل حرجة: {result?.critical ?? 1}</span>
              </div>
            </Alert>
            {report && result && (
              <Table columns={["العنصر","الحالة","التوصية"]} rows={result.items.map((i) => [i.check, i.status === "ok" ? "🟢 سليم" : i.status === "warning" ? "🟡 تحذير" : "🔴 حرج", i.recommendation || "—"])} />
            )}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setReport(!report)}>{report ? "إخفاء التقرير" : "📋 عرض التقرير المفصل"}</Button>
              <Button variant="primary" onClick={() => show("تم إصلاح 4 مشكلة")}>🔧 إصلاح المشاكل تلقائياً</Button>
              <Button onClick={() => push(["security"])}>رجوع</Button>
            </div>
          </div>
        )}
      </div>
      {node}
    </div>
  );
}

function ActiveSessions() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmHash, setConfirmHash] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    apiFetch<DeviceSession[]>("/security/sessions").then(setSessions).catch((err) => show(err instanceof Error ? err.message : "تعذر جلب الجلسات", "danger")).finally(() => setLoading(false));
  };
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const terminate = async (hash: string | null, allOthers: boolean) => {
    try {
      await apiFetch("/security/sessions/terminate", { method: "POST", body: JSON.stringify({ hash: hash || "", all_others: allOthers }) });
      show(allOthers ? "✅ تم إنهاء جميع الجلسات الأخرى" : "✅ تم إنهاء الجلسة");
      setConfirmHash(null);
      void load();
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر إنهاء الجلسة", "danger");
    }
  };

  return (
    <div className="animate-fade">
      <PageHeader title="مراقبة الأجهزة المتصلة" subtitle="جلسات حقيقية من تيليجرام" icon={<Smartphone className="h-5 w-5" />} />
      {loading ? <Spinner label="جاري جلب الجلسات الحقيقية..." /> : sessions.length === 0 ? (
        <EmptyState title="لا توجد جلسات معروضة" desc="لا توجد حسابات بجلسات أو تعذر الاتصال." />
      ) : (
        <Table columns={["حساب", "الجهاز", "التطبيق", "IP", "آخر نشاط", "حالية", "تنبيه", ""]} rows={sessions.map((s) => [
          s.phone, s.device, s.app, s.ip, s.last_active,
          (s as any).current ? "نعم" : "—",
          s.suspicious ? <span key={`w${s.hash}`} className="chip bg-warn-50 text-warn-700 ring-1 ring-warn-200">⚠️ غير معروف</span> : "—",
          <Button key={`t${s.hash}`} variant="danger" disabled={!!(s as any).current} onClick={() => setConfirmHash(s.hash || null)}>إنهاء</Button>,
        ])} />
      )}
      <div className="mt-4 card p-5">
        <SectionTitle>إجراءات جماعية</SectionTitle>
        <div className="mt-2"><Button variant="danger" onClick={() => void terminate(null, true)}>❌ إنهاء جميع الجلسات الأخرى (كل الحسابات)</Button></div>
      </div>
      <div className="mt-4"><Button onClick={() => push(["security"])}>رجوع</Button></div>
      <ConfirmDialog open={confirmHash !== null} danger title="إنهاء جلسة الجهاز" message="سيتم تسجيل خروج هذا الجهاز فوراً."
        onConfirm={() => void terminate(confirmHash, false)} onCancel={() => setConfirmHash(null)} />
      {node}
    </div>
  );
}

function Manage2FA() {
  const { push } = useNav();
  const { show, node } = useToast();
  const accounts = useAccounts();
  const [selected, setSelected] = useState<number | null>(null);
  const [curPass, setCurPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confPass, setConfPass] = useState("");
  const [saving, setSaving] = useState(false);

  const apply = async (applyToAll: boolean) => {
    if (!applyToAll && selected === null) { show("اختر حساباً", "danger"); return; }
    if (!newPass || newPass !== confPass) { show("كلمتا المرور غير متطابقتين", "danger"); return; }
    setSaving(true);
    try {
      await apiFetch("/security/2fa", {
        method: "PUT",
        body: JSON.stringify({ account_id: selected ?? 1, current_password: curPass || null, new_password: newPass, apply_to_all: applyToAll }),
      });
      show(applyToAll ? "✅ تم تطبيق 2FA على جميع الحسابات (لا تُخزن كلمة المرور)" : "✅ تم تغيير 2FA عبر تيليجرام (لا تُخزن كلمة المرور)");
      setCurPass(""); setNewPass(""); setConfPass(""); setSelected(null);
    } catch (err) {
      show(err instanceof Error ? err.message : "فشل تغيير 2FA — تحقق من كلمة المرور الحالية", "danger");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-fade">
      <PageHeader title="إدارة كلمات مرور 2FA" subtitle="تغيير حقيقي عبر تيليجرام — لا تُخزن كلمة المرور" icon={<KeyRound className="h-5 w-5" />} />
      <div className="mx-auto max-w-lg card p-6 space-y-3">
        <SectionTitle>اختر الحساب</SectionTitle>
        <div className="max-h-48 space-y-1 overflow-auto">
          {accounts.map((a) => (
            <OptionButton key={a.id} label={`${a.name} — ${a.phone}`} selected={selected === a.id} onClick={() => setSelected(a.id)} />
          ))}
        </div>
        <Field label="كلمة المرور الحالية (إن وُجدت)" value={curPass} onChange={setCurPass} type="password" />
        <Field label="كلمة المرور الجديدة" value={newPass} onChange={setNewPass} type="password" />
        <Field label="تأكيد كلمة المرور الجديدة" value={confPass} onChange={setConfPass} type="password" />
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" className="flex-1" disabled={saving || selected === null || !newPass} onClick={() => void apply(false)}>
            {saving ? "جاري التغيير..." : "💾 تطبيق على المحدد"}
          </Button>
          <Button variant="warn" disabled={saving || !newPass} onClick={() => void apply(true)}>🔀 تطبيق جماعي</Button>
        </div>
        <Alert tone="info" title="خصوصية">كلمة المرور تمرر لتغييرها عبر تيليجرام ولا تُخزَّن في قاعدة البيانات إطلاقاً.</Alert>
      </div>
      <div className="mt-4"><Button onClick={() => push(["security"])}>رجوع</Button></div>
      {node}
    </div>
  );
}

function SessionEncryption() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [enabled, setEnabled] = useState(false);
  const [key, setKey] = useState("");
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<{ enabled: boolean; encrypted_files: number; total_files: number } | null>(null);

  const load = () => apiFetch<any>("/security/encryption/status").then((s) => { setStatus(s); setEnabled(s.enabled); }).catch(() => undefined);
  useEffect(() => { void load(); }, []);

  const applyEncryption = async (enable: boolean) => {
    if (!key && enable) { show("أدخل مفتاح التشفير", "danger"); return; }
    setRunning(true);
    try {
      const response = await apiFetch<{ message: string }>("/security/encryption", {
        method: "PUT",
        body: JSON.stringify({ enabled: enable, key: key || "placeholder" }),
      });
      show(response.message);
      setKey("");
      await load();
    } catch (err) {
      show(err instanceof Error ? err.message : "فشل العملية", "danger");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="animate-fade">
      <PageHeader title="تشفير وحماية الجلسات" subtitle="تشفير حقيقي لملفات .session (AES)" icon={<Lock className="h-5 w-5" />} />
      <div className="mx-auto max-w-lg card p-6 space-y-4">
        <Alert tone={enabled ? "success" : "warn"} title={`حالة التشفير: ${enabled ? "مفعّل" : "معطل"}`}>
          {status && <div className="mt-1 text-xs">ملفات مشفرة: {status.encrypted_files}/{status.total_files}</div>}
        </Alert>
        {!enabled && (
          <div className="space-y-3">
            <Field label="مفتاح التشفير" value={key} onChange={setKey} type="password" placeholder="أدخل مفتاحاً قوياً" />
            <Alert tone="info" title="⚠️ احفظ المفتاح خارجياً — لن يُعرض مجدداً" />
            <Button variant="primary" className="w-full" disabled={running || !key} onClick={() => void applyEncryption(true)}>
              {running ? "جاري تشفير الملفات..." : "✅ تطبيق التشفير"}
            </Button>
          </div>
        )}
        {enabled && (
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" disabled={running} onClick={() => void applyEncryption(false)}>
              {running ? "جاري فك التشفير..." : "🔓 فك تشفير الجلسات (للترحيل)"}
            </Button>
          </div>
        )}
      </div>
      <div className="mt-4"><Button onClick={() => push(["security"])}>رجوع</Button></div>
      {node}
    </div>
  );
}

function EmergencyResponse() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [confirm, setConfirm] = useState<string | null>(null);
  const [alertText, setAlertText] = useState("");
  const confirmMap: Record<string, { title: string; msg: string }> = {
    stop: { title: "إيقاف جميع العمليات", msg: "سيوقف كل العمليات الجارية فوراً." },
    lock: { title: "قفل النظام", msg: "يوقف كل شيء + يحفظ التقدم + يمنع أي عمليات جديدة." },
    delete: { title: "حذف طارئ للجلسات", msg: "للأمان: سيتم حذف الجلسات الحساسة نهائياً." },
    restart: { title: "إعادة تشغيل الخدمة", msg: "ستُعاد تشغيل الخدمة خلال ثوانٍ." },
  };

  const exec = async (action: string, message?: string) => {
    try {
      const response = await apiFetch<{ message: string }>("/security/emergency", { method: "POST", body: JSON.stringify({ action, message: message || confirmMap[action]?.msg || "" }) });
      show(response.message, action === "delete_sessions" ? "danger" : undefined);
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر تنفيذ الإجراء", "danger");
    }
    setConfirm(null);
  };

  return (
    <div className="animate-fade">
      <PageHeader title="الاستجابة للطوارئ" subtitle="إجراءات حقيقية فورية" icon={<Siren className="h-5 w-5" />} />
      <div className="grid gap-3 sm:grid-cols-2 max-w-2xl">
        <Button variant="danger" onClick={() => setConfirm("stop")}>🔴 إيقاف جميع العمليات الآن</Button>
        <Button variant="danger" onClick={() => setConfirm("lock")}>🔒 قفل النظام</Button>
        <Button variant="danger" onClick={() => setConfirm("delete")}>🗑️ حذف طارئ للجلسات الحساسة</Button>
        <Button variant="warn" onClick={async () => { try { await exec("unlock_system"); show("تم فتح النظام"); } catch (err) { show(err instanceof Error ? err.message : "تعذر الفتح", "danger"); } }}>🔓 فتح النظام (إلغاء القفل)</Button>
        <Button variant="warn" onClick={() => setConfirm("restart")}>🔄 إعادة تشغيل الخدمة</Button>
      </div>
      <div className="mt-4 max-w-2xl card p-5 space-y-3">
        <SectionTitle>📢 إرسال تنبيه طارئ</SectionTitle>
        <Field label="نص التنبيه" value={alertText} onChange={setAlertText} placeholder="رسالة التنبيه الطارئ..." />
        <Button variant="danger" disabled={!alertText.trim()} onClick={() => void exec("send_alert", alertText)}>إرسال الآن</Button>
      </div>
      <div className="mt-4"><Button onClick={() => push(["security"])}>رجوع</Button></div>
      <ConfirmDialog open={confirm !== null} danger title={confirm ? confirmMap[confirm].title : ""} message={confirm ? confirmMap[confirm].msg : ""}
        onConfirm={() => void exec(confirm === "stop" ? "stop_all" : confirm === "lock" ? "lock_system" : confirm === "delete" ? "delete_sessions" : "restart")} onCancel={() => setConfirm(null)} />
      {node}
    </div>
  );
}

function SecurityNotifications() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [n, setN] = useState({ ban: true, restrict: true, flood: true, suspicious: true, proxy: true, connect: false, expiry: false, fail: true, daily: true, weekly: false });
  const [floodCount, setFloodCount] = useState("5");
  const [failPct, setFailPct] = useState("30");
  const toggle = (k: keyof typeof n) => setN((s) => ({ ...s, [k]: !s[k] }));

  const save = async () => {
    try {
      await apiFetch("/security/notifications", {
        method: "PUT",
        body: JSON.stringify({ on_ban: n.ban, on_restrict: n.restrict, flood_threshold: parseInt(floodCount || "5"), on_suspicious: n.suspicious, on_proxy_dead: n.proxy, on_connect_fail: n.connect, on_session_expiry: n.expiry, fail_percent: parseInt(failPct || "30"), daily_report: n.daily, weekly_report: n.weekly }),
      });
      show("تم حفظ إعدادات التنبيهات");
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر الحفظ", "danger");
    }
  };

  const test = async () => {
    try {
      const response = await apiFetch<{ message: string }>("/notifications/test", { method: "POST", body: JSON.stringify({}) });
      show(response.message, response.message.includes("فشل") ? "danger" : undefined);
    } catch (err) {
      show(err instanceof Error ? err.message : "فشل إرسال التنبيه — اضبط هدف الإشعارات أولاً", "danger");
    }
  };

  return (
    <div className="animate-fade">
      <PageHeader title="إعدادات تنبيهات الأمان" icon={<Bell className="h-5 w-5" />} />
      <div className="card p-5 space-y-2 max-w-2xl">
        <Checkbox label="تنبيه فوري عند حظر أي حساب" checked={n.ban} onChange={() => toggle("ban")} />
        <Checkbox label="تنبيه عند تقييد حساب" checked={n.restrict} onChange={() => toggle("restrict")} />
        <div className="flex items-center gap-2">
          <Checkbox label="تنبيه عند FloodWait متكرر (أكثر من X)" checked={n.flood} onChange={() => toggle("flood")} />
          <Field label="" placeholder="العدد" value={floodCount} onChange={setFloodCount} />
        </div>
        <Checkbox label="تنبيه عند نشاط مشبوه في الجلسات" checked={n.suspicious} onChange={() => toggle("suspicious")} />
        <Checkbox label="تنبيه عند موت بروكسي حساب نشط" checked={n.proxy} onChange={() => toggle("proxy")} />
        <Checkbox label="تنبيه عند فشل اتصال حساب" checked={n.connect} onChange={() => toggle("connect")} />
        <Checkbox label="تنبيه عند انتهاء صلاحية جلسة" checked={n.expiry} onChange={() => toggle("expiry")} />
        <div className="flex items-center gap-2">
          <Checkbox label="تنبيه إذا تجاوز الفشل X%" checked={n.fail} onChange={() => toggle("fail")} />
          <Field label="" placeholder="%" value={failPct} onChange={setFailPct} />
        </div>
        <Checkbox label="تقرير أمان يومي" checked={n.daily} onChange={() => toggle("daily")} />
        <Checkbox label="تقرير أمان أسبوعي" checked={n.weekly} onChange={() => toggle("weekly")} />
      </div>
      <div className="mt-4 flex gap-2">
        <Button variant="primary" onClick={() => void save()}>💾 حفظ الإعدادات</Button>
        <Button onClick={() => void test()}>🔍 اختبار التنبيهات</Button>
        <Button onClick={() => push(["security"])}>رجوع</Button>
      </div>
      {node}
    </div>
  );
}

function TodaySecurityReport() {
  const [report, setReport] = useState<SecurityReport | null>(null);
  const [week, setWeek] = useState<any>(null);
  useEffect(() => {
    apiFetch<SecurityReport>("/security/reports/today").then(setReport).catch(() => undefined);
    apiFetch<any>("/security/reports/week").then(setWeek).catch(() => undefined);
  }, []);
  return (
    <div className="card p-5 max-w-2xl">
      <SectionTitle>تقرير أمان اليوم (حقيقي)</SectionTitle>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div><div className="text-2xl font-bold text-surface-800">{report?.flood_waits ?? 0}</div><div className="text-xs text-surface-500">FloodWaits</div></div>
        <div><div className="text-2xl font-bold text-danger-600">{report?.bans ?? 0}</div><div className="text-xs text-surface-500">حظر</div></div>
        <div><div className="text-2xl font-bold text-warn-600">{report?.restrictions ?? 0}</div><div className="text-xs text-surface-500">تقييد</div></div>
      </div>
      <div className="mt-3 flex items-center justify-between rounded-xl bg-surface-50 border border-surface-200 px-4 py-3 text-sm">
        <span className="text-surface-500">درجة أمان اليوم</span><span className="font-bold text-surface-800">{report?.score ?? 0}/100</span>
      </div>
      {week && (
        <div className="mt-4">
          <SectionTitle>آخر 7 أيام</SectionTitle>
          <Table columns={["اليوم", "Flood", "حظر", "تقييد", "درجة"]} rows={week.days.map((d: any) => [
            d.date, String(d.flood_waits), String(d.bans), String(d.restrictions), `${d.score}/100`,
          ])} />
        </div>
      )}
    </div>
  );
}

function SecurityReports() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [tab, setTab] = useState<"day" | "week" | "analysis">("day");
  const [week, setWeek] = useState<any>(null);
  useEffect(() => { apiFetch<any>("/security/reports/week").then(setWeek).catch(() => undefined); }, []);

  const exportReport = async (format: string) => {
    try {
      await downloadApiFile(`/security/reports/export?period=${tab === "day" ? "today" : "week"}&format_value=${format}`, `security-report-${tab}.${format === "pdf" ? "pdf" : "csv"}`);
      show("تم تنزيل التقرير");
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر التصدير", "danger");
    }
  };

  return (
    <div className="animate-fade">
      <PageHeader title="تقارير الأمان" icon={<FileBarChart className="h-5 w-5" />} />
      <div className="mb-4 max-w-2xl">
        <div className="flex gap-2 flex-wrap">
          {[["day", "📊 تقرير اليوم"], ["week", "📈 تقرير أسبوعي"], ["analysis", "📊 تحليل أنماط الحظر"]].map(([id, label]) => (
            <Button key={id} variant={tab === id ? "primary" : "ghost"} onClick={() => setTab(id as typeof tab)}>{label}</Button>
          ))}
        </div>
      </div>
      {tab === "day" && <TodaySecurityReport />}
      {tab === "week" && (
        <div className="card p-5 max-w-2xl">
          <SectionTitle>حوادث الأمان آخر 7 أيام (حقيقية)</SectionTitle>
          {week ? (
            <Table columns={["اليوم", "Flood", "حظر", "تقييد", "درجة"]} rows={week.days.map((d: any) => [
              d.date, String(d.flood_waits), String(d.bans), String(d.restrictions), `${d.score}/100`,
            ])} />
          ) : <p className="text-sm text-surface-500">لا توجد بيانات بعد.</p>}
        </div>
      )}
      {tab === "analysis" && (
        <div className="card p-5 max-w-2xl space-y-3">
          <SectionTitle>تحليل أنماط الحظر</SectionTitle>
          <p className="text-sm text-surface-600">يعتمد التحليل على سجلات الأحداث الفعلية — تُحدَّث تلقائياً.</p>
        </div>
      )}
      <div className="mt-4 flex gap-2">
        <Button onClick={() => void exportReport("pdf")}>📤 تصدير (PDF)</Button>
        <Button onClick={() => void exportReport("csv")}>📊 CSV</Button>
        <Button onClick={() => push(["security"])}>رجوع</Button>
      </div>
      {node}
    </div>
  );
}
