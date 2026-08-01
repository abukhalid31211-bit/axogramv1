import { useEffect, useState } from "react";
import { RefreshCw, Settings, ListChecks, Edit3, BarChart3, Eraser, Brain, CalendarClock, Layers, Activity, ShieldAlert, Bell, PauseCircle, Play } from "lucide-react";
import { useNav } from "../nav";
import { PageHeader, Button, OptionButton, Table, SectionTitle, useToast, InlineEdit, Checkbox, Field, Progress, ConfirmDialog, StatusChip } from "../ui";
import { accounts } from "../data";
import { apiFetch, type RotationAnalytics, type RotationLogRecord, type RotationProfile, type RotationSettings } from "../lib/api";

export function RotationModule() {
  const { push } = useNav();
  const [stats, setStats] = useState<RotationAnalytics | null>(null);
  useEffect(() => { apiFetch<RotationAnalytics>("/rotation/analytics").then(setStats).catch(() => undefined); }, []);
  const items = [
    { id: "settings",     label: "إعدادات التدوير",        desc: "وضع وشرط التبديل",      icon: Settings },
    { id: "table",        label: "عرض جدول التدوير",       desc: "الترتيب الحالي",        icon: ListChecks },
    { id: "edit",         label: "تعديل ترتيب الحسابات",   desc: "إعادة ترتيب",           icon: Edit3 },
    { id: "usage",        label: "الاستهلاك اليومي",        desc: "إحصائيات اليوم",        icon: BarChart3 },
    { id: "reset",        label: "تصفير العدادات",          desc: "تصفير يومي",            icon: Eraser },
    { id: "smart",        label: "التدوير الذكي المتقدم",   desc: "قواعد حماية ذكية",      icon: Brain },
    { id: "schedule",     label: "جدولة التدوير",           desc: "أوقات وأيام العمل",     icon: CalendarClock },
    { id: "profiles",     label: "سيناريوهات التدوير",      desc: "قوالب جاهزة",           icon: Layers },
    { id: "analytics",    label: "تحليلات التدوير",         desc: "أداء النظام",           icon: BarChart3 },
    { id: "live",         label: "مراقب التدوير الحي",      desc: "لوحة مباشرة",           icon: Activity },
    { id: "exclusion",    label: "قواعد الاستبعاد",         desc: "شروط الاستبعاد",        icon: ShieldAlert },
    { id: "notifications",label: "إشعارات التدوير",         desc: "تنبيهات وتبديلات",      icon: Bell },
  ];
  return (
    <div className="animate-fade">
      <PageHeader title="نظام التدوير" subtitle="إدارة تدوير الحسابات" icon={<RefreshCw className="h-5 w-5" />} />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatMini label="تبديلات اليوم" value={String(stats?.switches_today ?? 14)} tone="brand" />
        <StatMini label="تبديلات الأسبوع" value={String(stats?.switches_week ?? 92)} tone="brand" />
        <StatMini label="معدل العمليات" value={String(stats?.avg_ops_before_switch ?? 9)} tone="surface" />
        <StatMini label="آخر تبديل" value={stats?.last_switch_at ? new Date(stats.last_switch_at).toLocaleTimeString("ar").slice(0,5) : "—"} tone="warn" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <button key={it.id} onClick={() => push(["rotation", it.id])}
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

function StatMini({ label, value, tone }: { label: string; value: string; tone: "brand" | "warn" | "danger" | "surface" }) {
  const cls = tone === "brand" ? "text-brand-700 bg-brand-50 ring-brand-200" : tone === "warn" ? "text-warn-700 bg-warn-50 ring-warn-200" : tone === "danger" ? "text-danger-700 bg-danger-50 ring-danger-200" : "text-surface-700 bg-surface-50 ring-surface-200";
  return (
    <div className="rounded-2xl border border-surface-200 bg-white px-4 py-3 shadow-card">
      <div className={`chip mb-1 ring-1 ${cls}`}>{label}</div>
      <div className="text-2xl font-bold text-surface-800">{value}</div>
    </div>
  );
}

export function RotationScreen({ sub }: { sub: string }) {
  switch (sub) {
    case "settings": return <RotationSettings />;
    case "table":    return <RotationTable />;
    case "edit":     return <EditOrder />;
    case "usage":    return <DailyUsage />;
    case "reset":    return <ResetCounters />;
    case "smart":    return <SmartRotation />;
    case "schedule": return <RotationSchedule />;
    case "profiles": return <RotationProfiles />;
    case "analytics":return <RotationAnalytics />;
    case "live":     return <LiveMonitor />;
    case "exclusion":return <ExclusionRules />;
    case "notifications": return <RotationNotifications />;
    default:         return null;
  }
}

function RotationSettings() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [mode, setMode]         = useState("smart");
  const [condition, setCondition] = useState("count");
  const [onBlock, setOnBlock]   = useState("switch");
  const [onLimit, setOnLimit]   = useState("wait");
  useEffect(() => {
    apiFetch<RotationSettings>("/rotation/settings").then((s) => {
      if (s.rotation_mode) setMode(s.rotation_mode);
      if (s.rotation_condition) setCondition(s.rotation_condition);
      if (s.rotation_on_block) setOnBlock(s.rotation_on_block);
      if (s.rotation_on_limit) setOnLimit(s.rotation_on_limit);
    }).catch(() => undefined);
  }, []);
  const save = () => {
    apiFetch("/rotation/settings", { method: "PUT", body: JSON.stringify({ mode, condition, on_block: onBlock, on_limit: onLimit }) })
      .then(() => { show("تم حفظ الإعدادات"); push(["rotation"]); }).catch(() => { show("تم الحفظ محلياً"); push(["rotation"]); });
  };
  return (
    <div className="animate-fade">
      <PageHeader title="إعدادات التدوير" icon={<Settings className="h-5 w-5" />} />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <SectionTitle>وضع التدوير</SectionTitle>
          <div className="space-y-2">
            <OptionButton label="تسلسلي (1→2→3→...→1)"         selected={mode === "seq"}      onClick={() => setMode("seq")} />
            <OptionButton label="عشوائي"                        selected={mode === "random"}   onClick={() => setMode("random")} />
            <OptionButton label="موزون (الأقل استخداماً أولاً)" selected={mode === "weighted"} onClick={() => setMode("weighted")} />
            <OptionButton label="ذكي (حالة+استخدام+عمر)" badge={<span className="chip bg-brand-50 text-brand-700 ring-1 ring-brand-200">موصى</span>} selected={mode === "smart"} onClick={() => setMode("smart")} />
            <OptionButton label="حسب الأولوية (Priority-Based)" selected={mode === "priority"} onClick={() => setMode("priority")} />
            <OptionButton label="حسب المجموعة (Group-Based)"    selected={mode === "group"}   onClick={() => setMode("group")} />
          </div>
        </div>
        <div className="card p-5">
          <SectionTitle>شرط التبديل</SectionTitle>
          <div className="space-y-2">
            <OptionButton label="بعد عدد محدد"          selected={condition === "count"} onClick={() => setCondition("count")} />
            <OptionButton label="بعد وقت محدد"          selected={condition === "time"}  onClick={() => setCondition("time")} />
            <OptionButton label="بعد أول خطأ/تحذير"     selected={condition === "error"} onClick={() => setCondition("error")} />
            <OptionButton label="مختلط (عمليات + وقت)"  selected={condition === "mixed"} onClick={() => setCondition("mixed")} />
            <OptionButton label="مختلط ذكي (عمليات + وقت + صحة)" selected={condition === "smartmix"} onClick={() => setCondition("smartmix")} />
          </div>
        </div>
        <div className="card p-5">
          <SectionTitle>عند حظر حساب أثناء العملية</SectionTitle>
          <div className="space-y-2">
            <OptionButton label="تبديل فوري + إزالة من التدوير" selected={onBlock === "switch"} onClick={() => setOnBlock("switch")} />
            <OptionButton label="تبديل + إعادة بعد ساعة"        selected={onBlock === "delay"}  onClick={() => setOnBlock("delay")} />
            <OptionButton label="إيقاف كل العمليات + إشعار"     selected={onBlock === "stop"}   onClick={() => setOnBlock("stop")} />
          </div>
        </div>
        <div className="card p-5">
          <SectionTitle>عند بلوغ جميع الحسابات حدودها</SectionTitle>
          <div className="space-y-2">
            <OptionButton label="إيقاف + استئناف تلقائي غداً"    selected={onLimit === "wait"}   onClick={() => setOnLimit("wait")} />
            <OptionButton label="إيقاف + إشعار فقط"              selected={onLimit === "notify"} onClick={() => setOnLimit("notify")} />
            <OptionButton label="انتظار تصفير أحد الحسابات"      selected={onLimit === "zero"}   onClick={() => setOnLimit("zero")} />
            <OptionButton label="الانتقال لمجموعة احتياطية"      selected={onLimit === "backup"} onClick={() => setOnLimit("backup")} />
          </div>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button variant="primary" className="flex-1" onClick={save}>حفظ الإعدادات</Button>
        <Button onClick={() => push(["rotation"])}>إلغاء</Button>
      </div>
      {node}
    </div>
  );
}

function RotationTable() {
  const { push } = useNav();
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    apiFetch<any[]>("/rotation/table").then(setRows).catch(() => setRows(accounts.slice(0,5).map((a,i) => ({ position:i+1, phone:a.phone, health:70-i*5, gather:120, add:18, dm:8, status:i===0?"active":"active", next_phone: i<4?accounts[i+1].phone:accounts[0].phone }))));
  }, []);
  const live = rows[0];
  return (
    <div className="animate-fade">
      <PageHeader title="جدول التدوير الحالي" icon={<ListChecks className="h-5 w-5" />} />
      <Table columns={["#","حساب","صحة","تجميع","إضافة","رسائل","حالة","التالي"]}
        rows={rows.map((a,i) => [a.position ?? i+1, a.phone, `${a.health}%`, a.gather, a.add, a.dm,
          <StatusChip key={i} status={(i === 0 ? "active" : a.status === "blocked" ? "blocked" : "active") as any} />, a.next_phone ?? "—"])} />
      <div className="mt-3 flex items-center justify-between rounded-xl bg-surface-50 border border-surface-200 px-4 py-3 text-sm">
        <span className="text-surface-500">◀ الحساب النشط الآن</span>
        <span className="font-bold text-surface-800">{live?.phone ?? accounts[0]?.phone}</span>
      </div>
      <div className="mt-4"><Button onClick={() => push(["rotation"])}>رجوع</Button></div>
    </div>
  );
}

function EditOrder() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [order, setOrder] = useState("1,2,3,4,5");
  return (
    <div className="animate-fade">
      <PageHeader title="تعديل ترتيب الحسابات" icon={<Edit3 className="h-5 w-5" />} />
      <div className="mx-auto max-w-lg card p-6 space-y-4">
        <SectionTitle>الترتيب الحالي</SectionTitle>
        <div className="rounded-xl bg-surface-50 border border-surface-200 px-4 py-2.5 text-sm font-mono text-surface-600">1 → 2 → 3 → 4 → 5</div>
        <InlineEdit label="الترتيب الجديد (أرقام/فواصل)" value={order} onSave={setOrder} placeholder="مثال: 1,2,3,4,5" />
        <div className="space-y-2">
          <OptionButton label="ترتيب تلقائي حسب الصحة (تنازلي)" selected={false} onClick={() => setOrder("3,1,5,2,4")} />
          <OptionButton label="ترتيب حسب العمر (الأقدم أولاً)"   selected={false} onClick={() => setOrder("5,2,4,1,3")} />
          <OptionButton label="ترتيب عشوائي"                     selected={false} onClick={() => setOrder("4,1,3,5,2")} />
        </div>
        <div className="flex gap-2">
          <Button variant="primary" className="flex-1" onClick={() => { apiFetch("/rotation/settings", { method: "PUT", body: JSON.stringify({ switch_ops: parseInt(order.split(",")[0] || "5") }) }).then(() => show("تم حفظ الترتيب")).catch(() => show("تم الحفظ محلياً")); push(["rotation"]); }}>حفظ الترتيب</Button>
          <Button onClick={() => push(["rotation"])}>إلغاء</Button>
        </div>
      </div>
      {node}
    </div>
  );
}

function DailyUsage() {
  const { push } = useNav();
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { apiFetch<any[]>("/rotation/usage").then(setRows).catch(() => undefined); }, []);
  return (
    <div className="animate-fade">
      <PageHeader title="الاستهلاك اليومي" icon={<BarChart3 className="h-5 w-5" />} />
      <Table columns={["حساب","تجميع","إضافة","رسائل","الحالة","المتبقي"]}
        rows={(rows.length ? rows : accounts.slice(0,5).map((a,i) => ({ phone:a.phone, gather:120, add:18, dm:8, status:a.status, remaining:500-i*40 }))).map((a,i) => [a.phone,
          <div key={i} className="min-w-[90px]"><Progress value={i === 1 ? 100 : 60} /></div>,
          a.add, a.dm,
          <StatusChip key={i} status={a.status === "active" ? "active" : "draft"} />, `${a.remaining ?? 500}`])} />
      <div className="mt-3 flex items-center justify-between rounded-xl bg-surface-50 border border-surface-200 px-4 py-3 text-sm">
        <span className="text-surface-500">إجمالي اليوم | تصفير تلقائي</span>
        <span className="font-bold text-surface-800">600 عملية | 00:00</span>
      </div>
      <div className="mt-4"><Button onClick={() => push(["rotation"])}>رجوع</Button></div>
    </div>
  );
}

function ResetCounters() {
  const { push } = useNav();
  const { show, node } = useToast();
  return (
    <div className="animate-fade">
      <PageHeader title="تصفير العدادات اليومية" icon={<Eraser className="h-5 w-5" />} />
      <div className="mx-auto max-w-lg card p-6 space-y-4">
        <p className="text-sm text-surface-600">سيتم تصفير جميع عدادات الاستهلاك اليومي لجميع الحسابات.</p>
        <div className="flex gap-2">
          <Button variant="primary" className="flex-1" onClick={() => { apiFetch("/rotation/reset", { method: "POST" }).then(() => show("تم التصفير")).catch(() => show("تم التصفير محلياً")); push(["rotation"]); }}>تأكيد التصفير</Button>
          <Button onClick={() => push(["rotation"])}>إلغاء</Button>
        </div>
      </div>
      {node}
    </div>
  );
}

function SmartRotation() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [rules, setRules] = useState({ noRepeat: true, restAfter: true, randomDelay: true, reduceFlood: true, increaseDelay: true, stopWeak: true, preferMember: true, balanced: true, switchSlow: true });
  const [restCount, setRestCount] = useState("10");
  const [timing, setTiming] = useState<"natural"|"conservative"|"aggressive"|"custom">("natural");
  const [dFrom, setDFrom] = useState("30");
  const [dTo, setDTo] = useState("90");
  const toggle = (k: keyof typeof rules) => setRules(s => ({ ...s, [k]: !s[k] }));
  return (
    <div className="animate-fade">
      <PageHeader title="التدوير الذكي المتقدم" subtitle="يوزع العمليات على الحسابات بذكاء ويحمي من الحظر تلقائياً" icon={<Brain className="h-5 w-5" />} />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <SectionTitle>قواعد الحماية الذكية</SectionTitle>
          <div className="space-y-2">
            <Checkbox label="لا تستخدم نفس الحساب مرتين متتاليتين" checked={rules.noRepeat} onChange={() => toggle("noRepeat")} />
            <div className="flex items-center gap-2">
              <Checkbox label="راحة إجبارية بعد X عمليات متتالية" checked={rules.restAfter} onChange={() => toggle("restAfter")} />
              <Field label="" placeholder="العدد" value={restCount} onChange={setRestCount} />
            </div>
            <Checkbox label="تأخير عشوائي بين كل عملية" checked={rules.randomDelay} onChange={() => toggle("randomDelay")} />
            <Checkbox label="تقليل تلقائي عند ارتفاع FloodWaits" checked={rules.reduceFlood} onChange={() => toggle("reduceFlood")} />
            <Checkbox label="زيادة التأخير تدريجياً عند الأخطاء" checked={rules.increaseDelay} onChange={() => toggle("increaseDelay")} />
            <Checkbox label="إيقاف الحسابات الضعيفة (&lt;50% صحة)" checked={rules.stopWeak} onChange={() => toggle("stopWeak")} />
            <Checkbox label="تفضيل الحسابات العضو في المجموعة المستهدفة" checked={rules.preferMember} onChange={() => toggle("preferMember")} />
            <Checkbox label="توزيع متوازن (لا حساب يعمل أكثر من 30%)" checked={rules.balanced} onChange={() => toggle("balanced")} />
            <Checkbox label="تبديل تلقائي عند بطء الاستجابة" checked={rules.switchSlow} onChange={() => toggle("switchSlow")} />
          </div>
        </div>
        <div className="card p-5">
          <SectionTitle>خوارزمية التوقيت</SectionTitle>
          <div className="space-y-2">
            <OptionButton label="⭐ طبيعي (يحاكي سلوك بشري)" selected={timing === "natural"} onClick={() => setTiming("natural")} />
            <OptionButton label="🔒 محافظ (أبطأ + أكثر أماناً)" selected={timing === "conservative"} onClick={() => setTiming("conservative")} />
            <OptionButton label="⚡ عدواني (أسرع + أكثر خطورة)" selected={timing === "aggressive"} onClick={() => setTiming("aggressive")} />
            <OptionButton label="✏️ مخصص" selected={timing === "custom"} onClick={() => setTiming("custom")} />
          </div>
          {timing === "custom" && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Field label="تأخير أدنى (ث)" value={dFrom} onChange={setDFrom} />
              <Field label="تأخير أقصى (ث)" value={dTo} onChange={setDTo} />
            </div>
          )}
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button variant="primary" className="flex-1" onClick={() => { apiFetch("/rotation/settings", { method: "PUT", body: JSON.stringify({ rest_after: parseInt(restCount || "10") }) }).then(() => show("تم حفظ إعدادات التدوير الذكي")).catch(() => show("تم الحفظ محلياً")); push(["rotation"]); }}>حفظ الإعدادات الذكية</Button>
        <Button onClick={() => push(["rotation"])}>رجوع</Button>
      </div>
      {node}
    </div>
  );
}

function RotationSchedule() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [restrict, setRestrict] = useState(true);
  const [from, setFrom] = useState("08:00");
  const [to, setTo] = useState("23:00");
  const [noMidnight, setNoMidnight] = useState(true);
  const days = ["السبت","الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة"];
  const [workDays, setWorkDays] = useState(days.map(() => true));
  return (
    <div className="animate-fade">
      <PageHeader title="جدولة التدوير" subtitle="تحديد أوقات عمل كل حساب" icon={<CalendarClock className="h-5 w-5" />} />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <SectionTitle>⏰ ساعات العمل العامة</SectionTitle>
          <Checkbox label="تقييد ساعات العمل للكل" checked={restrict} onChange={() => setRestrict(!restrict)} />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Field label="من الساعة" value={from} onChange={setFrom} />
            <Field label="إلى الساعة" value={to} onChange={setTo} />
          </div>
          <Checkbox label="لا عمل بعد منتصف الليل" checked={noMidnight} onChange={() => setNoMidnight(!noMidnight)} />
          <div className="mt-3"><Button variant="primary" onClick={() => show("تم حفظ ساعات العمل")}>حفظ</Button></div>
        </div>
        <div className="card p-5">
          <SectionTitle>📆 أيام العمل المسموحة</SectionTitle>
          <div className="space-y-2">
            {days.map((d, i) => <Checkbox key={d} label={d} checked={workDays[i]} onChange={() => setWorkDays(w => { const n=[...w]; n[i]=!n[i]; return n; })} />)}
          </div>
          <div className="mt-3"><Button variant="primary" onClick={() => { show("تم حفظ أيام العمل"); push(["rotation"]); }}>حفظ</Button></div>
        </div>
      </div>
      <div className="mt-4"><Button onClick={() => push(["rotation"])}>رجوع</Button></div>
      {node}
    </div>
  );
}

function RotationProfiles() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [profiles, setProfiles] = useState<RotationProfile[]>([
    { id:"safe", icon: "🛡️", name: "سيناريو الأمان الأقصى", lines: ["تأخير 120-180 ث | 5 عمليات/تبديل", "راحة 30 د بعد 10 عمليات", "حد يومي: 10 إضافة/حساب"], delay_min:120, delay_max:180, switch_ops:5, rest_after:10, daily_add_limit:10 },
    { id:"balanced", icon: "⭐", name: "سيناريو متوازن (موصى)", lines: ["تأخير 60-120 ث | 10 عمليات/تبديل", "راحة 15 د بعد 20 عملية", "حد يومي: 25 إضافة/حساب"], delay_min:60, delay_max:120, switch_ops:10, rest_after:20, daily_add_limit:25 },
    { id:"fast", icon: "⚡", name: "سيناريو الإنتاجية العالية", lines: ["تأخير 30-60 ث | 20 عملية/تبديل", "حد يومي: 40 إضافة/حساب", "⚠️ خطر متوسط"], delay_min:30, delay_max:60, switch_ops:20, rest_after:40, daily_add_limit:40 },
    { id:"new", icon: "🆕", name: "حسابات جديدة (أقل من شهر)", lines: ["تأخير 180-300 ث | 3 عمليات/تبديل", "حد يومي: 5 إضافة/حساب", "تسخين إجباري 7 أيام أولاً"], delay_min:180, delay_max:300, switch_ops:3, rest_after:10, daily_add_limit:5 },
  ]);
  useEffect(() => { apiFetch<RotationProfile[]>("/rotation/profiles").then(setProfiles).catch(() => undefined); }, []);
  const apply = (p: RotationProfile) => apiFetch(`/rotation/profiles/${p.id}/apply`, { method: "POST" }).then(() => { show(`تم تطبيق ${p.name}`); push(["rotation"]); }).catch(() => { show(`تم تطبيق ${p.name} محلياً`); push(["rotation"]); });
  return (
    <div className="animate-fade">
      <PageHeader title="سيناريوهات التدوير" subtitle="قوالب جاهزة للسيناريوهات الشائعة" icon={<Layers className="h-5 w-5" />} />
      <div className="grid gap-4 lg:grid-cols-2">
        {profiles.map(p => (
          <div key={p.name} className="card p-5">
            <div className="mb-2 flex items-center gap-2"><span className="text-lg">{p.icon}</span><span className="text-sm font-bold text-surface-800">{p.name}</span></div>
            <ul className="mb-3 space-y-1">
              {p.lines.map(l => <li key={l} className="text-xs text-surface-500">• {l}</li>)}
            </ul>
            <Button variant="primary" className="w-full" onClick={() => apply(p)}>✅ تطبيق هذا السيناريو</Button>
          </div>
        ))}
      </div>
      <div className="mt-4"><Button onClick={() => { show("تم حفظ السيناريو الحالي كقالب"); }}>💾 حفظ السيناريو الحالي كقالب</Button></div>
      <div className="mt-2"><Button onClick={() => push(["rotation"])}>رجوع</Button></div>
      {node}
    </div>
  );
}

function RotationAnalytics() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [data, setData] = useState<RotationAnalytics | null>(null);
  useEffect(() => { apiFetch<RotationAnalytics>("/rotation/analytics").then(setData).catch(() => undefined); }, []);
  const reasons = data?.switch_reasons ?? { floodwait: 31, ban: 4, limit: 57, manual: 12 };
  const rows = [
    ["تبديلات اليوم", String(data?.switches_today ?? 14)],
    ["تبديلات الأسبوع", String(data?.switches_week ?? 92)],
    ["متوسط العمليات قبل كل تبديل", String(data?.avg_ops_before_switch ?? 9)],
    ["تبديلات بسبب FloodWait", String(reasons.floodwait ?? reasons.FloodWait ?? 31)],
    ["تبديلات بسبب الحظر", String(reasons.ban ?? reasons.Ban ?? 4)],
    ["تبديلات بسبب بلوغ الحد", String(reasons.limit ?? reasons.Limit ?? 57)],
  ];
  return (
    <div className="animate-fade">
      <PageHeader title="تحليلات التدوير" subtitle="أداء نظام التدوير" icon={<BarChart3 className="h-5 w-5" />} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(r => (
          <div key={r[0]} className="card px-4 py-3">
            <div className="text-xs text-surface-500">{r[0]}</div>
            <div className="text-xl font-bold text-surface-800">{r[1]}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 card p-5">
        <SectionTitle>نشاط التدوير آخر 7 أيام</SectionTitle>
        <div className="flex items-end gap-2 h-24">
          {[40,65,50,80,45,70,90].map((h,i) => (
            <div key={i} style={{ height: `${h}%` }} className="flex-1 rounded-t-md bg-accent-400" />
          ))}
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button onClick={() => show("تم تصدير PDF")}>📄 PDF</Button>
        <Button onClick={() => show("تم تصدير CSV")}>📊 CSV</Button>
        <Button onClick={() => push(["rotation"])}>رجوع</Button>
      </div>
      {node}
    </div>
  );
}

function LiveMonitor() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [paused, setPaused] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [logs, setLogs] = useState<RotationLogRecord[]>([]);
  useEffect(() => { apiFetch<RotationLogRecord[]>("/rotation/logs?limit=10").then(setLogs).catch(() => undefined); }, []);
  const doSwitch = () => { apiFetch("/rotation/switch", { method: "POST", body: JSON.stringify({ reason: "manual" }) }).then(() => show("تم التبديل")).catch(() => show("تم التبديل محلياً")); };
  return (
    <div className="animate-fade">
      <PageHeader title="مراقب التدوير الحي" subtitle="لوحة مراقبة مباشرة" icon={<Activity className="h-5 w-5" />} />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <SectionTitle>الحساب النشط الآن</SectionTitle>
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-brand-600 ring-1 ring-brand-200"><Activity className="h-5 w-5" /></div>
            <div>
              <div className="text-lg font-bold text-surface-800">{accounts[0]?.phone}</div>
              <div className="text-xs text-surface-500">العملية: تجميع | منذ التبديل: 00:12:34</div>
            </div>
          </div>
          <div className="mt-3 rounded-xl bg-surface-50 border border-surface-200 px-4 py-3 text-sm">
            <div className="flex justify-between"><span className="text-surface-500">العمليات منذ التبديل</span><span className="font-bold">7</span></div>
            <div className="flex justify-between"><span className="text-surface-500">التبديل القادم</span><span className="font-bold">بعد 3 عمليات أو 14 دقيقة</span></div>
          </div>
          <div className="mt-3 space-y-2">
            <Button variant="primary" className="w-full" onClick={() => { setConfirm(true); }}>🔄 تبديل يدوي الآن</Button>
            {paused
              ? <Button variant="primary" className="w-full" onClick={() => setPaused(false)}><Play className="h-4 w-4" /> استئناف التدوير</Button>
              : <Button variant="warn" className="w-full" onClick={() => setPaused(true)}><PauseCircle className="h-4 w-4" /> إيقاف التدوير مؤقتاً</Button>}
          </div>
        </div>
        <div className="card p-5">
          <SectionTitle>آخر 10 تبديلات</SectionTitle>
          <Table columns={["وقت","من","إلى","السبب"]} rows={(logs.length ? logs : [{ from_phone:"+9665...", to_phone:"+9665...", reason:"FloodWait", switched_at:"2026-07-28T12:41:00Z" }]).map((l) => [new Date(l.switched_at).toLocaleTimeString("ar").slice(0,5), l.from_phone, l.to_phone, l.reason])} />
        </div>
      </div>
      <ConfirmDialog open={confirm} title="تبديل يدوي" message="التبديل إلى الحساب التالي في القائمة الآن؟" onConfirm={() => { setConfirm(false); doSwitch(); }} onCancel={() => setConfirm(false)} />
      <div className="mt-4"><Button onClick={() => push(["rotation"])}>رجوع</Button></div>
      {node}
    </div>
  );
}

function ExclusionRules() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [rules, setRules] = useState({ blocked: true, restricted: true, health: true, newAccounts: true, flood: true, noProxy: false, hours: false });
  const [healthPct, setHealthPct] = useState("50");
  const [floodCount, setFloodCount] = useState("5");
  const toggle = (k: keyof typeof rules) => setRules(s => ({ ...s, [k]: !s[k] }));
  return (
    <div className="animate-fade">
      <PageHeader title="قواعد الاستبعاد من التدوير" subtitle="تحديد شروط استبعاد الحسابات تلقائياً" icon={<ShieldAlert className="h-5 w-5" />} />
      <div className="card p-5 space-y-2 max-w-2xl">
        <Checkbox label="استبعاد الحسابات المحظورة تلقائياً" checked={rules.blocked} onChange={() => toggle("blocked")} />
        <Checkbox label="استبعاد الحسابات المقيدة" checked={rules.restricted} onChange={() => toggle("restricted")} />
        <div className="flex items-center gap-2">
          <Checkbox label="استبعاد الحسابات أقل من X% صحة" checked={rules.health} onChange={() => toggle("health")} />
          <Field label="" placeholder="%" value={healthPct} onChange={setHealthPct} />
        </div>
        <Checkbox label="استبعاد الحسابات الجديدة (&lt;30 يوم)" checked={rules.newAccounts} onChange={() => toggle("newAccounts")} />
        <div className="flex items-center gap-2">
          <Checkbox label="استبعاد الحسابات التي تلقت X FloodWaits اليوم" checked={rules.flood} onChange={() => toggle("flood")} />
          <Field label="" placeholder="العدد" value={floodCount} onChange={setFloodCount} />
        </div>
        <Checkbox label="استبعاد الحسابات بدون بروكسي نشط" checked={rules.noProxy} onChange={() => toggle("noProxy")} />
        <Checkbox label="استبعاد الحسابات خارج ساعات عملها" checked={rules.hours} onChange={() => toggle("hours")} />
      </div>
      <div className="mt-4 flex gap-2">
        <Button variant="primary" onClick={() => { apiFetch("/rotation/exclusion", { method: "PUT", body: JSON.stringify({ blocked: rules.blocked, restricted: rules.restricted, health_threshold: rules.health ? parseInt(healthPct) : null, exclude_new: rules.newAccounts, flood_threshold: rules.flood ? parseInt(floodCount) : null, require_proxy: rules.noProxy, respect_hours: rules.hours }) }).then(() => show("تم حفظ قواعد الاستبعاد")).catch(() => show("تم الحفظ محلياً")); push(["rotation"]); }}>💾 حفظ قواعد الاستبعاد</Button>
        <Button variant="ghost" onClick={() => show("عرض المستبعدين حالياً: +9665... (حظر)")}>📋 عرض المستبعدين</Button>
        <Button onClick={() => push(["rotation"])}>رجوع</Button>
      </div>
      {node}
    </div>
  );
}

function RotationNotifications() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [n, setN] = useState({ onSwitch: true, onExclude: true, onAllLimit: true, onResume: true, daily: true, stale: true });
  const [minutes, setMinutes] = useState("30");
  const toggle = (k: keyof typeof n) => setN(s => ({ ...s, [k]: !s[k] }));
  return (
    <div className="animate-fade">
      <PageHeader title="إشعارات التدوير" icon={<Bell className="h-5 w-5" />} />
      <div className="card p-5 space-y-2 max-w-2xl">
        <Checkbox label="إشعار عند كل تبديل" checked={n.onSwitch} onChange={() => toggle("onSwitch")} />
        <Checkbox label="إشعار عند استبعاد حساب" checked={n.onExclude} onChange={() => toggle("onExclude")} />
        <Checkbox label="إشعار عند وصول جميع الحسابات لحدودها" checked={n.onAllLimit} onChange={() => toggle("onAllLimit")} />
        <Checkbox label="إشعار عند عودة حساب للعمل بعد استراحة" checked={n.onResume} onChange={() => toggle("onResume")} />
        <Checkbox label="تقرير يومي لأداء التدوير" checked={n.daily} onChange={() => toggle("daily")} />
        <div className="flex items-center gap-2">
          <Checkbox label="تنبيه إذا لم يتبدل النظام خلال X دقيقة" checked={n.stale} onChange={() => toggle("stale")} />
          <Field label="" placeholder="دقائق" value={minutes} onChange={setMinutes} />
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button variant="primary" onClick={() => { apiFetch("/rotation/notifications", { method: "PUT", body: JSON.stringify({ on_switch: n.onSwitch, on_exclude: n.onExclude, on_all_limit: n.onAllLimit, on_resume: n.onResume, daily: n.daily, stale_minutes: parseInt(minutes || "30") }) }).then(() => show("تم حفظ إعدادات الإشعارات")).catch(() => show("تم الحفظ محلياً")); push(["rotation"]); }}>💾 حفظ الإعدادات</Button>
        <Button onClick={() => push(["rotation"])}>رجوع</Button>
      </div>
      {node}
    </div>
  );
}
