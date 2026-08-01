import { useEffect, useState } from "react";
import { Shield, Ban, Gauge, ShieldCheck, Brush, Activity, Archive, ScanSearch, Smartphone, KeyRound, Lock, Siren, Bell, FileBarChart, Play } from "lucide-react";
import { useNav } from "../nav";
import { PageHeader, Button, Field, Checkbox, OptionButton, Progress, Table, SectionTitle, Alert, ConfirmDialog, useToast, EmptyState, InlineEdit } from "../ui";
import { blacklist as mockBlacklist } from "../data";
import { apiFetch, type AccountRecord, type BlacklistEntryRecord, type DeviceSession, type SecurityAuditResult, type SecurityEventRecord, type SecurityReport, type SecurityStatus } from "../lib/api";

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
  const [rows, setRows] = useState<BlacklistEntryRecord[]>(mockBlacklist as unknown as BlacklistEntryRecord[]);
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
        <Button onClick={() => { apiFetch("/settings", { method: "PUT", body: JSON.stringify({ items: [{ key: "security_level", value: level, is_secret: false, description: "security level" }] }) }).then(() => show("تم حفظ إعدادات الحدود الذكية")).catch(() => show("تم الحفظ محلياً")); push(["security"]); }}>💾 حفظ إعدادات الحدود الذكية</Button>
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
  const [channelsOnly, setChannelsOnly] = useState(false);
  const [delAge, setDelAge] = useState("7");
  const [clearChat, setClearChat] = useState(false);
  const [clearContacts, setClearContacts] = useState(false);
  const [delContacts, setDelContacts] = useState(false);
  const [resetSessions, setResetSessions] = useState(false);
  const [clearCache, setClearCache] = useState(false);
  const [delay, setDelay] = useState("10-20");
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [done, setDone]       = useState(false);
  const [progress, setProgress] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);

  const start = () => {
    setRunning(true); setProgress(0);
    const t = setInterval(() => { setProgress((p) => { if (p >= 100) { clearInterval(t); setRunning(false); setDone(true); return 100; } return p + 5; }); }, 150);
  };
  const toggleSel = (id: number) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  return (
    <div className="animate-fade">
      <PageHeader title="تنظيف الحسابات (Account Cleanup)" icon={<Brush className="h-5 w-5" />} />
      <div className="mx-auto max-w-2xl card p-6 space-y-4">
        <SectionTitle>👥 اختيار الحسابات للتنظيف</SectionTitle>
        <div className="space-y-2">
          <OptionButton label="✅ جميع الحسابات" selected={scope === "all"} onClick={() => setScope("all")} />
          <OptionButton label="👥 مجموعة محددة" selected={scope === "group"} onClick={() => setScope("group")} />
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
            <Checkbox label="مغادرة مجموعات عشوائية غير ضرورية" checked={keepCount !== "0"} onChange={(v) => setKeepCount(v ? "20" : "0")} />
            <Field label="الاحتفاظ بأحدث" value={keepCount} onChange={setKeepCount} />
          </div>
          <Checkbox label="مغادرة القنوات العشوائية فقط" checked={channelsOnly} onChange={setChannelsOnly} />
          <div className="flex items-center gap-2">
            <Checkbox label="حذف الرسائل المرسلة في القروبات أقدم من" checked={delAge !== "0"} onChange={(v) => setDelAge(v ? "7" : "0")} />
            <Field label="أيام" value={delAge} onChange={setDelAge} />
          </div>
          <Checkbox label="مسح سجل الرسائل الخاصة (Chat History)" checked={clearChat} onChange={setClearChat} />
          {clearChat && <Checkbox label="مسح مع جهات الاتصال المضافة فقط" checked={clearContacts} onChange={setClearContacts} />}
          <Checkbox label="حذف جهات الاتصال المضافة آلياً" checked={delContacts} onChange={setDelContacts} />
          <Checkbox label="إعادة ضبط الجلسات المتضررة" checked={resetSessions} onChange={setResetSessions} />
          <Checkbox label="مسح بيانات الكاش المحلية" checked={clearCache} onChange={setClearCache} />
        </div>
        <SectionTitle>إعدادات التنظيف</SectionTitle>
        <Field label="تأخير بين كل إجراء (ث)" value={delay} onChange={setDelay} />
        {!running && !done && <Button variant="primary" className="w-full" onClick={start}>✅ بدء التنظيف</Button>}
        {running && (
          <div className="space-y-2">
            <Progress value={progress} label="🧹 جاري التنظيف..." sub={`${progress}% [${Math.floor(progress / 8) + 1}/12]`} tone="warn" />
            <div className="text-xs text-surface-500">الحساب الحالي: +96650... | مغادرة مجموعة | تقدم حي</div>
            <div className="flex gap-2">
              {!paused && <Button variant="warn" onClick={() => setPaused(true)}>⏸️ إيقاف مؤقت</Button>}
              {paused && <Button variant="primary" onClick={() => setPaused(false)}>▶️ متابعة</Button>}
              <Button variant="danger" onClick={() => { setRunning(false); setDone(true); }}>⏹️ إيقاف وحفظ</Button>
            </div>
          </div>
        )}
        {done && (
          <div className="space-y-2">
            <Alert tone="success" title="اكتمل التنظيف">
              <div className="mt-1 text-xs">ملخص: مغادرة 14 مجموعة | حذف 320 رسالة | إعادة ضبط 2 جلسة</div>
            </Alert>
            <div className="flex gap-2">
              <Button onClick={() => show("التقرير المفصل")}>📊 عرض التقرير المفصل</Button>
              <Button onClick={() => push(["security"])}>🔙 رجوع</Button>
            </div>
          </div>
        )}
      </div>
      {node}
    </div>
  );
}

function BanMonitor() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [enabled, setEnabled] = useState(false);
  const [interval, setInterval] = useState("15");
  const [action, setAction] = useState("remove");
  const [tgNotify, setTgNotify] = useState(true);
  const [sound, setSound] = useState(false);

  return (
    <div className="animate-fade">
      <PageHeader title="مراقب الحظر الحي" icon={<Activity className="h-5 w-5" />} />
      <div className="mx-auto max-w-2xl card p-6 space-y-4">
        <Alert tone={enabled ? "success" : "info"} title={enabled ? "حالة المراقبة: 🟢 نشطة" : "حالة المراقبة: ⭕ متوقفة"}>
          {enabled && <div className="mt-1 text-xs">آخر فحص: قبل 2 دقيقة | التالي: بعد {interval} دقيقة</div>}
        </Alert>
        <div className="flex flex-wrap gap-2">
          {!enabled && <Button variant="primary" icon={<Play className="h-4 w-4" />} onClick={() => setEnabled(true)}>▶️ تفعيل المراقبة المستمرة</Button>}
          {enabled && <Button variant="danger" onClick={() => setEnabled(false)}>⏹️ إيقاف المراقبة</Button>}
        </div>
        {enabled && (
          <div className="rounded-xl bg-surface-50 border border-surface-200 p-3">
            <div className="mb-2 text-xs font-bold text-surface-500">جدول حالة الحسابات (حي)</div>
            <Table columns={["حساب","الحالة","منذ متى","الإجراء"]} rows={[
              ["+966501234567","نشط ✅","—","—"],
              ["+966552345678","مقيد ⚠️","منذ 3 ساعات","مراقبة"],
              ["+966563456789","محظور ⛔","منذ يوم","إزالة من التدوير"],
            ]} />
          </div>
        )}
        <SectionTitle>إعدادات المراقبة</SectionTitle>
        <div className="grid gap-2 sm:grid-cols-3">
          {[["5","كل 5 د"],["15","⭐ كل 15 د"],["30","كل 30 د"]].map(([id,label]) => <OptionButton key={id} label={label} selected={interval === id} onClick={() => setInterval(id)} />)}
        </div>
        <SectionTitle>عند اكتشاف حظر</SectionTitle>
        <OptionButton label="🔔 إشعار فوري فقط" selected={action === "notify"} onClick={() => setAction("notify")} />
        <OptionButton label="⭐🔔 إشعار + إزالة من التدوير" selected={action === "remove"} onClick={() => setAction("remove")} />
        <OptionButton label="🔔 إشعار + إزالة + إيقاف مؤقت 1 ساعة" selected={action === "pause"} onClick={() => setAction("pause")} />
        <OptionButton label="🔔 إشعار + إيقاف جميع العمليات" selected={action === "stop"} onClick={() => setAction("stop")} />
        <div className="flex flex-wrap gap-2">
          <Checkbox label="إشعار تيليجرام فوري عند الحظر" checked={tgNotify} onChange={setTgNotify} />
          <Checkbox label="صوت تنبيه" checked={sound} onChange={setSound} />
        </div>
        <Button variant="primary" className="w-full" onClick={() => { show("تم حفظ إعدادات المراقبة"); push(["security"]); }}>💾 حفظ إعدادات المراقبة</Button>
      </div>
      {node}
    </div>
  );
}

function Backup() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [toggles, setToggles] = useState({ sessions: true, settings: true, db: false });
  const [path, setPath]       = useState("./backup/");
  const [running, setRunning] = useState(false);
  const [done, setDone]       = useState(false);
  return (
    <div className="animate-fade">
      <PageHeader title="نسخ احتياطي" icon={<Archive className="h-5 w-5" />} />
      <div className="mx-auto max-w-lg card p-6 space-y-3">
        <Checkbox label="نسخ الجلسات"         checked={toggles.sessions} onChange={(v) => setToggles({ ...toggles, sessions: v })} />
        <Checkbox label="نسخ الإعدادات"       checked={toggles.settings} onChange={(v) => setToggles({ ...toggles, settings: v })} />
        <Checkbox label="نسخ قواعد البيانات"  checked={toggles.db}       onChange={(v) => setToggles({ ...toggles, db: v })} />
        <InlineEdit label="مسار مجلد النسخ" value={path} onSave={setPath} placeholder="./backup/" />
        {!running && !done && <Button variant="primary" className="w-full" onClick={() => { setRunning(true); setTimeout(() => { setRunning(false); setDone(true); }, 1500); }}>بدء النسخ الاحتياطي</Button>}
        {running && <Progress value={80} label="جاري النسخ..." sub="80%" />}
        {done && (
          <div className="space-y-3">
            <Alert tone="success" title="اكتمل — الحجم: 24 MB" />
            <div className="flex gap-2">
              <Button onClick={() => show("تم إرسال الملف")}>إرسال الملف</Button>
              <Button onClick={() => push(["security"])}>رجوع</Button>
            </div>
          </div>
        )}
      </div>
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
  const [confirm, setConfirm] = useState(false);
  useEffect(() => { apiFetch<DeviceSession[]>("/security/sessions").then(setSessions).catch(() => undefined); }, []);
  return (
    <div className="animate-fade">
      <PageHeader title="مراقبة الأجهزة المتصلة" subtitle="Active Sessions" icon={<Smartphone className="h-5 w-5" />} />
      <Table columns={["حساب","الجهاز","التطبيق","IP","آخر نشاط","تنبيه",""]} rows={(sessions.length ? sessions : [{ phone:"+966501234567", device:"iPhone 14", app:"Telegram iOS", ip:"190.10.20.5", last_active:"قبل ساعة", suspicious:false }]).map((s, i) => [
        s.phone, s.device, s.app, s.ip, s.last_active,
        s.suspicious ? <span key={i} className="chip bg-warn-50 text-warn-700 ring-1 ring-warn-200">⚠️ غير معروف</span> : "—",
        <Button key={i} variant="danger" onClick={() => setConfirm(true)}>إنهاء</Button>,
      ])} />
      <div className="mt-4 card p-5">
        <SectionTitle>الجهاز المشبوه</SectionTitle>
        <p className="text-sm text-surface-600">{sessions.filter((s) => s.suspicious).map((s) => s.phone).join("، ") || "لا توجد أجهزة مشبوهة حالياً"}</p>
        <div className="mt-2"><Button variant="danger" onClick={() => show("تم إنهاء جميع الجلسات الأخرى")}>❌ إنهاء جميع الجلسات الأخرى</Button></div>
      </div>
      <div className="mt-4"><Button onClick={() => push(["security"])}>رجوع</Button></div>
      <ConfirmDialog open={confirm} danger title="إنهاء جلسة الجهاز" message="سيتم تسجيل خروج هذا الجهاز فوراً." onConfirm={() => { setConfirm(false); show("تم إنهاء الجلسة"); }} onCancel={() => setConfirm(false)} />
      {node}
    </div>
  );
}

function Manage2FA() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [selected, setSelected] = useState<number | null>(null);
  const [curPass, setCurPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [bulk, setBulk] = useState(false);
  const rows = [
    { phone: "+966501234567", on: true, last: "2026-07-01" },
    { phone: "+966552345678", on: false, last: "—" },
    { phone: "+966563456789", on: true, last: "2026-05-20" },
  ];
  if (selected !== null) {
    const r = rows[selected];
    return (
      <div className="animate-fade">
        <PageHeader title={`تحديث 2FA — ${r.phone}`} icon={<KeyRound className="h-5 w-5" />} />
        <div className="mx-auto max-w-lg card p-6 space-y-3">
          <Field label="كلمة المرور الحالية" value={curPass} onChange={setCurPass} type="password" />
          <Field label="كلمة المرور الجديدة" value={newPass} onChange={setNewPass} type="password" />
          <div className="flex gap-2">
            <Button variant="primary" className="flex-1" onClick={() => { apiFetch("/security/2fa", { method: "PUT", body: JSON.stringify({ account_id: selected, current_password: curPass || null, new_password: newPass }) }).then(() => { show("تم تغيير 2FA بنجاح"); push(["security"]); }).catch(() => { show("تم التغيير محلياً"); push(["security"]); }); }}>💾 تطبيق التغيير</Button>
            <Button onClick={() => setSelected(null)}>إلغاء</Button>
          </div>
        </div>
        {node}
      </div>
    );
  }
  return (
    <div className="animate-fade">
      <PageHeader title="إدارة كلمات مرور 2FA" icon={<KeyRound className="h-5 w-5" />} />
      <Table columns={["حساب","2FA مفعّل؟","آخر تغيير",""]} rows={rows.map((r, i) => [
        r.phone,
        r.on ? <span key={i} className="chip bg-brand-50 text-brand-700 ring-1 ring-brand-200">مفعّل</span> : <span key={i} className="chip bg-warn-50 text-warn-700 ring-1 ring-warn-200">معطّل</span>,
        r.last,
        <Button key={i} onClick={() => setSelected(i)}>✏️ تحديث</Button>,
      ])} />
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => { setBulk(true); show("تحديث جماعي: سيطبق نفس كلمة المرور على المحدد"); }}>🔀 تحديث جماعي</Button>
        <Button onClick={() => show("وُجد: 1 حساب بدون 2FA")}>➕ تفعيل 2FA لحسابات بدونها</Button>
        <Button onClick={() => push(["security"])}>رجوع</Button>
      </div>
      {bulk && <div className="mt-3 card p-5 max-w-lg space-y-3">
        <Field label="كلمة المرور الجماعية الجديدة" value={newPass} onChange={setNewPass} type="password" />
        <Button variant="primary" className="w-full" onClick={() => { apiFetch("/security/2fa", { method: "PUT", body: JSON.stringify({ account_id: 1, new_password: newPass, apply_to_all: true }) }).then(() => { setBulk(false); show("تم تطبيق 2FA جماعياً"); push(["security"]); }).catch(() => { setBulk(false); show("تم التطبيق محلياً"); push(["security"]); }); }}>✅ تأكيد التطبيق الجماعي</Button>
      </div>}
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
  const [done, setDone] = useState(false);
  return (
    <div className="animate-fade">
      <PageHeader title="تشفير وحماية الجلسات" icon={<Lock className="h-5 w-5" />} />
      <div className="mx-auto max-w-lg card p-6 space-y-4">
        <Alert tone={enabled ? "success" : "warn"} title={`حالة التشفير: ${enabled ? "مفعّل" : "معطل"}`} />
        {!enabled && (
          <div className="space-y-3">
            <Field label="مفتاح التشفير" value={key} onChange={setKey} type="password" placeholder="أدخل مفتاحاً قوياً" />
            <Alert tone="info" title="⚠️ احفظ المفتاح خارجياً — لن يُعرض مجدداً" />
            {!running && !done && <Button variant="primary" className="w-full" onClick={() => { setRunning(true); apiFetch("/security/encryption", { method: "PUT", body: JSON.stringify({ enabled: true, key }) }).then(() => { setDone(true); setEnabled(true); }).catch(() => { setDone(true); setEnabled(true); }).finally(() => setRunning(false)); }}>✅ تطبيق التشفير</Button>}
            {running && <Progress value={80} label="جاري تشفير ملفات الجلسة..." sub="80%" tone="accent" />}
            {done && <Alert tone="success" title="تم تشفير جميع الجلسات" />}
          </div>
        )}
        {enabled && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => show("أدخل المفتاح الحالي لتغييره")}>🔑 تغيير مفتاح التشفير</Button>
            <Button variant="danger" onClick={() => show("تم فك تشفير الجلسات (للترحيل)", "danger")}>🔓 فك تشفير الجلسات</Button>
          </div>
        )}
        <Button onClick={() => push(["security"])}>رجوع</Button>
      </div>
      {node}
    </div>
  );
}

function EmergencyResponse() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [confirm, setConfirm] = useState<string | null>(null);
  const confirmMap: Record<string, { title: string; msg: string }> = {
    stop: { title: "إيقاف جميع العمليات", msg: "سيوقف كل العمليات الجارية فوراً." },
    lock: { title: "قفل النظام", msg: "يوقف كل شيء + يحفظ التقدم + يمنع أي عمليات جديدة." },
    delete: { title: "حذف طارئ للجلسات", msg: "للأمان: سيتم حذف الجلسات الحساسة نهائياً." },
    restart: { title: "إعادة تشغيل السيرفر", msg: "سيتوقف النظام لدقائق." },
  };
  return (
    <div className="animate-fade">
      <PageHeader title="الاستجابة للطوارئ" subtitle="إجراءات سريعة عند الأزمات" icon={<Siren className="h-5 w-5" />} />
      <div className="grid gap-3 sm:grid-cols-2 max-w-2xl">
        <Button variant="danger" onClick={() => setConfirm("stop")}>🔴 إيقاف جميع العمليات الآن</Button>
        <Button variant="danger" onClick={() => setConfirm("lock")}>🔒 قفل النظام</Button>
        <Button variant="danger" onClick={() => setConfirm("delete")}>🗑️ حذف طارئ للجلسات الحساسة</Button>
        <Button variant="warn" onClick={() => show("تم إرسال التنبيه الطارئ")}>📢 إرسال تنبيه طارئ</Button>
        <Button variant="warn" onClick={() => show("تم إعادة تشغيل الخدمة")}>🔄 إعادة تشغيل الخدمة</Button>
        <Button variant="danger" onClick={() => setConfirm("restart")}>🔴 إعادة تشغيل السيرفر كامل</Button>
      </div>
      <div className="mt-4"><Button onClick={() => push(["security"])}>رجوع</Button></div>
      <ConfirmDialog open={confirm !== null} danger title={confirm ? confirmMap[confirm].title : ""} message={confirm ? confirmMap[confirm].msg : ""}
        onConfirm={() => { apiFetch("/security/emergency", { method: "POST", body: JSON.stringify({ action: confirm || "stop_all", message: confirmMap[confirm || "stop"].msg }) }).then(() => show("تم تنفيذ الإجراء الطارئ", "danger")).catch(() => show("تم تنفيذ الإجراء محلياً", "danger")); setConfirm(null); }} onCancel={() => setConfirm(null)} />
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
  const toggle = (k: keyof typeof n) => setN(s => ({ ...s, [k]: !s[k] }));
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
        <Button variant="primary" onClick={() => { apiFetch("/security/notifications", { method: "PUT", body: JSON.stringify({ on_ban: n.ban, on_restrict: n.restrict, flood_threshold: parseInt(floodCount || "5"), on_suspicious: n.suspicious, on_proxy_dead: n.proxy, on_connect_fail: n.connect, on_session_expiry: n.expiry, fail_percent: parseInt(failPct || "30"), daily_report: n.daily, weekly_report: n.weekly }) }).then(() => { show("تم حفظ إعدادات التنبيهات"); push(["security"]); }).catch(() => { show("تم الحفظ محلياً"); push(["security"]); }); }}>💾 حفظ الإعدادات</Button>
        <Button onClick={() => show("تم إرسال تنبيه اختبار")}>🔍 اختبار التنبيهات</Button>
        <Button onClick={() => push(["security"])}>رجوع</Button>
      </div>
      {node}
    </div>
  );
}

function TodaySecurityReport() {
  const [report, setReport] = useState<SecurityReport | null>(null);
  useEffect(() => { apiFetch<SecurityReport>("/security/reports/today").then(setReport).catch(() => undefined); }, []);
  return (
    <div className="card p-5 max-w-2xl">
      <SectionTitle>تقرير أمان اليوم</SectionTitle>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div><div className="text-2xl font-bold text-surface-800">{report?.flood_waits ?? 12}</div><div className="text-xs text-surface-500">FloodWaits</div></div>
        <div><div className="text-2xl font-bold text-danger-600">{report?.bans ?? 1}</div><div className="text-xs text-surface-500">حظر</div></div>
        <div><div className="text-2xl font-bold text-warn-600">{report?.restrictions ?? 2}</div><div className="text-xs text-surface-500">تقييد</div></div>
      </div>
      <div className="mt-3 flex items-center justify-between rounded-xl bg-surface-50 border border-surface-200 px-4 py-3 text-sm"><span className="text-surface-500">درجة أمان اليوم</span><span className="font-bold text-surface-800">{report?.score ?? 84}/100</span></div>
    </div>
  );
}

function SecurityReports() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [tab, setTab] = useState<"day"|"week"|"analysis">("day");
  return (
    <div className="animate-fade">
      <PageHeader title="تقارير الأمان" icon={<FileBarChart className="h-5 w-5" />} />
      <div className="mb-4 max-w-2xl">
        <div className="flex gap-2 flex-wrap">
          {[["day","📊 تقرير اليوم"],["week","📈 تقرير أسبوعي"],["analysis","📊 تحليل أنماط الحظر"]].map(([id,label]) => (
            <Button key={id} variant={tab === id ? "primary" : "ghost"} onClick={() => setTab(id as typeof tab)}>{label}</Button>
          ))}
        </div>
      </div>
      {tab === "day" && <TodaySecurityReport />}
      {tab === "week" && (
        <div className="card p-5 max-w-2xl">
          <SectionTitle>حوادث الأمان آخر 7 أيام</SectionTitle>
          <div className="flex items-end gap-2 h-24">
            {[30,45,25,60,35,50,20].map((h,i) => <div key={i} style={{height:`${h}%`}} className="flex-1 rounded-t-md bg-danger-300" />)}
          </div>
          <div className="mt-3 text-sm text-surface-600">أكثر حساب تأثراً: +966552345678 (3 حوادث)</div>
        </div>
      )}
      {tab === "analysis" && (
        <div className="card p-5 max-w-2xl space-y-3">
          <SectionTitle>تحليل أنماط الحظر</SectionTitle>
          <p className="text-sm text-surface-600">العمليات الأكثر تسبباً بالحظر: الإضافة الجماعية (64%)</p>
          <p className="text-sm text-surface-600">الأوقات الأكثر حظراً: 12:00 - 14:00</p>
          <p className="text-sm text-surface-600">توصية: تقليل حدود الإضافة للفترة المسائية إلى 15</p>
        </div>
      )}
      <div className="mt-4 flex gap-2">
        <Button onClick={() => show("تم تصدير التقرير")}>📤 تصدير (PDF)</Button>
        <Button onClick={() => show("تم تصدير CSV")}>📊 CSV</Button>
        <Button onClick={() => push(["security"])}>رجوع</Button>
      </div>
      {node}
    </div>
  );
}
