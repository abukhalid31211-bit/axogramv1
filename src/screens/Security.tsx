import { useState } from "react";
import { Shield, Ban, Gauge, ShieldCheck, Brush, Activity, Archive } from "lucide-react";
import { useNav } from "../nav";
import { PageHeader, Button, Field, Checkbox, OptionButton, Progress, Table, SectionTitle, Alert, ConfirmDialog, useToast, EmptyState } from "../ui";
import { blacklist } from "../data";

export function SecurityModule() {
  const { push } = useNav();
  const items = [
    { id: "blacklist", label: "القائمة السوداء", desc: "المستخدمون المحظورون", icon: Ban },
    { id: "limits", label: "الحدود الذكية", desc: "تكيب السرعة", icon: Gauge },
    { id: "verify", label: "التحقق من الحسابات", desc: "فحص جماعي", icon: ShieldCheck },
    { id: "clean", label: "تنظيف الحسابات", desc: "مغادرة وحذف", icon: Brush },
    { id: "monitor", label: "مراقب الحظر", desc: "مراقبة مستمرة", icon: Activity },
    { id: "backup", label: "نسخ احتياطي", desc: "جلسات وإعدادات", icon: Archive },
  ];
  return (
    <div className="animate-fade">
      <PageHeader title="أدوات الأمان" subtitle="حماية الحسابات" icon={<Shield className="h-5 w-5" />} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <button key={it.id} onClick={() => push(["security", it.id])} className="card flex items-center gap-3 p-4 text-right hover:border-brand-500/40 hover:shadow-glow">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand-500/10 text-brand-300 ring-1 ring-brand-500/30">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-white">{it.label}</div>
                <div className="text-xs text-slate-400">{it.desc}</div>
              </div>
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
    case "limits": return <SmartLimits />;
    case "verify": return <VerifyAccounts />;
    case "clean": return <CleanAccounts />;
    case "monitor": return <BanMonitor />;
    case "backup": return <Backup />;
    default: return null;
  }
}

function Blacklist() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [adding, setAdding] = useState(false);
  const [val, setVal] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
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
            <Button variant="primary" onClick={() => { setAdding(false); setVal(""); show("تمت الإضافة"); }}>حفظ</Button>
            <Button onClick={() => setAdding(false)}>رجوع</Button>
          </div>
        </div>
      )}
      {blacklist.length === 0 ? (
        <EmptyState icon={<Ban className="h-8 w-8" />} title="القائمة فارغة" />
      ) : (
        <Table columns={["مستخدم", "سبب", "تاريخ"]} rows={blacklist.map((b) => [b.user, b.reason, b.date])} />
      )}
      <div className="mt-4"><Button onClick={() => push(["security"])}>رجوع</Button></div>
      <ConfirmDialog open={confirmClear} danger title="مسح القائمة" message="سيتم حذف جميع المستخدمين المحظورين." onConfirm={() => { setConfirmClear(false); show("تم المسح", "danger"); }} onCancel={() => setConfirmClear(false)} />
      {node}
    </div>
  );
}

function SmartLimits() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [level, setLevel] = useState("balanced");
  const [toggles, setToggles] = useState({ reduce: true, increase: true, pause: true, lowerNew: true, raiseOld: false });
  return (
    <div className="animate-fade">
      <PageHeader title="الحدود الذكية" icon={<Gauge className="h-5 w-5" />} />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <SectionTitle>خيارات</SectionTitle>
          <div className="space-y-2">
            <Checkbox label="تقليل السرعة عند تكرار FloodWait" checked={toggles.reduce} onChange={(v) => setToggles({ ...toggles, reduce: v })} />
            <Checkbox label="زيادة التأخير عند التقييد" checked={toggles.increase} onChange={(v) => setToggles({ ...toggles, increase: v })} />
            <Checkbox label="إيقاف مؤقت عند تقييد أكثر من حساب" checked={toggles.pause} onChange={(v) => setToggles({ ...toggles, pause: v })} />
            <Checkbox label="خفض حدود الجديدة (<30 يوم)" checked={toggles.lowerNew} onChange={(v) => setToggles({ ...toggles, lowerNew: v })} />
            <Checkbox label="زيادة حدود القديمة (>6 أشهر)" checked={toggles.raiseOld} onChange={(v) => setToggles({ ...toggles, raiseOld: v })} />
          </div>
        </div>
        <div className="card p-5">
          <SectionTitle>مستوى الأمان</SectionTitle>
          <div className="space-y-2">
            <OptionButton label="محافظ (أبطأ + أكثر أماناً)" selected={level === "cautious"} onClick={() => setLevel("cautious")} />
            <OptionButton label="متوازن (موصى)" badge={<span className="chip bg-brand-500/15 text-brand-300">موصى</span>} selected={level === "balanced"} onClick={() => setLevel("balanced")} />
            <OptionButton label="هجومي (أسرع + خطر)" selected={level === "aggressive"} onClick={() => setLevel("aggressive")} />
          </div>
          <SectionTitle><span className="mt-4 block">الحدود الموصى بها</span></SectionTitle>
          <Table columns={["حساب", "عمر", "حد", "تأخير"]} rows={[["+966501234567", "8 أشهر", "30", "60-120"], ["+966552345678", "3 أشهر", "20", "60-120"]]} />
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button variant="primary" onClick={() => { show("تم تطبيق الحدود"); push(["security"]); }}>تطبيق الحدود الموصى بها</Button>
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
      <div className="mt-4"><Button variant="primary" onClick={() => push(["accounts", "validate"])}>الذهاب للتحقق</Button></div>
    </div>
  );
}

function CleanAccounts() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [toggles, setToggles] = useState({ leave: true, delete: false, reset: true });
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  return (
    <div className="animate-fade">
      <PageHeader title="تنظيف الحسابات" icon={<Brush className="h-5 w-5" />} />
      <div className="mx-auto max-w-lg card p-6 space-y-3">
        <Checkbox label="مغادرة مجموعات غير ضرورية" checked={toggles.leave} onChange={(v) => setToggles({ ...toggles, leave: v })} />
        <Checkbox label="حذف رسائل قديمة" checked={toggles.delete} onChange={(v) => setToggles({ ...toggles, delete: v })} />
        <Checkbox label="إعادة ضبط جلسات متضررة" checked={toggles.reset} onChange={(v) => setToggles({ ...toggles, reset: v })} />
        {!running && !done && <Button variant="primary" className="w-full" onClick={() => { setRunning(true); setTimeout(() => { setRunning(false); setDone(true); }, 1500); }}>بدء التنظيف</Button>}
        {running && <Progress value={80} label="جاري التنظيف..." sub="80%" tone="warn" />}
        {done && <Alert tone="success" title="اكتمل التنظيف"><Button className="mt-2" onClick={() => push(["security"])}>رجوع</Button></Alert>}
      </div>
      {node}
    </div>
  );
}

function BanMonitor() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [enabled, setEnabled] = useState(false);
  return (
    <div className="animate-fade">
      <PageHeader title="مراقب الحظر" icon={<Activity className="h-5 w-5" />} />
      <div className="mx-auto max-w-lg card p-6 space-y-4">
        <Checkbox label="تفعيل المراقبة المستمرة" checked={enabled} onChange={setEnabled} />
        {enabled && <Alert tone="danger" title="تنبيه فوري عند أي حظر" />}
        <Button variant="primary" className="w-full" onClick={() => { show("تم الحفظ"); push(["security"]); }}>حفظ</Button>
      </div>
      {node}
    </div>
  );
}

function Backup() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [toggles, setToggles] = useState({ sessions: true, settings: true, db: false });
  const [path, setPath] = useState("./backup/");
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  return (
    <div className="animate-fade">
      <PageHeader title="نسخ احتياطي" icon={<Archive className="h-5 w-5" />} />
      <div className="mx-auto max-w-lg card p-6 space-y-3">
        <Checkbox label="نسخ الجلسات" checked={toggles.sessions} onChange={(v) => setToggles({ ...toggles, sessions: v })} />
        <Checkbox label="نسخ الإعدادات" checked={toggles.settings} onChange={(v) => setToggles({ ...toggles, settings: v })} />
        <Checkbox label="نسخ قواعد البيانات" checked={toggles.db} onChange={(v) => setToggles({ ...toggles, db: v })} />
        <Field label="مسار مجلد النسخ" value={path} onChange={setPath} />
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
