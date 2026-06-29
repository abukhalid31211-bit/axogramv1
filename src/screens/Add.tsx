import { useState } from "react";
import {
  UserPlus,
  FileText,
  PenLine,
  RefreshCw,
  BarChart3,
  Play,
  Pause,
  Square,
  Plus,
  Minus,
  Bell,
  ListChecks,
} from "lucide-react";
import { useNav } from "../nav";
import { PageHeader, Button, Field, Checkbox, OptionButton, Progress, Table, SectionTitle, Alert, useToast, EmptyState } from "../ui";
import { addLogs, exportedFiles } from "../data";

export function AddModule() {
  const { push } = useNav();
  const items = [
    { id: "csv", label: "من ملف CSV", desc: "استيراد أعضاء من ملف", icon: FileText },
    { id: "manual", label: "إضافة يدوية", desc: "أسماء مستخدمين", icon: PenLine },
    { id: "resume", label: "استئناف عملية سابقة", desc: "متابعة من نقطة التوقف", icon: RefreshCw },
    { id: "logs", label: "سجلات الإضافة السابقة", desc: "تاريخ العمليات", icon: BarChart3 },
  ];
  return (
    <div className="animate-fade">
      <PageHeader title="إضافة الأعضاء" subtitle="إضافة جماعية للقروبات" icon={<UserPlus className="h-5 w-5" />} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <button key={it.id} onClick={() => push(["add", it.id])} className="card flex items-center gap-3 p-4 text-right hover:border-brand-500/40 hover:shadow-glow">
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

export function AddScreen({ sub }: { sub: string }) {
  switch (sub) {
    case "csv": return <AddFromCsv />;
    case "manual": return <AddManual />;
    case "resume": return <ResumeOp />;
    case "logs": return <AddLogs />;
    default: return null;
  }
}

function AddFromCsv() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<number | null>(null);
  const [target, setTarget] = useState("");
  const [method, setMethod] = useState<"direct" | "invite">("direct");
  const [accounts, setAccounts] = useState<"single" | "rotate" | "custom">("rotate");
  const [addLimit, setAddLimit] = useState("5");
  const [delay, setDelay] = useState("60-120");
  const [switchDelay, setSwitchDelay] = useState("5-10");
  const [dailyLimit, setDailyLimit] = useState("20");
  const [protection, setProtection] = useState({ skipExisting: true, skipBlacklist: true, saveProgress: true, floodWait: true, customLimit: false });
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const start = () => {
    setRunning(true); setProgress(0); setPaused(false);
    const t = setInterval(() => { setProgress((p) => { if (p >= 100) { clearInterval(t); setRunning(false); return 100; } return p + 3; }); }, 120);
  };
  return (
    <div className="animate-fade">
      <PageHeader title="إضافة من ملف CSV" icon={<FileText className="h-5 w-5" />} steps={step > 0 ? { label: "إضافة الأعضاء", n: step + 1, total: 3 } : undefined} />
      <div className="mx-auto max-w-2xl">
        {step === 0 && (
          <div className="card p-6 space-y-4">
            <SectionTitle>اختر ملف</SectionTitle>
            <div className="space-y-2">
              {exportedFiles.map((f) => (
                <OptionButton key={f.id} label={f.name} desc={`${f.members.toLocaleString()} عضو`} selected={file === f.id} onClick={() => setFile(f.id)} />
              ))}
            </div>
            <Field label="رابط المجموعة المستهدفة" placeholder="@my_group" value={target} onChange={setTarget} />
            <Alert tone="info" title="الهدف: @my_group (الأعضاء الحاليون: 1,200)" />
            <Button variant="primary" className="w-full" disabled={file === null} onClick={() => setStep(1)}>التالي — الإعدادات</Button>
          </div>
        )}
        {step === 1 && (
          <div className="card p-6 space-y-4">
            <SectionTitle>طريقة الإضافة</SectionTitle>
            <div className="grid grid-cols-2 gap-2">
              <OptionButton label="إضافة مباشرة للمجموعة" selected={method === "direct"} onClick={() => setMethod("direct")} />
              <OptionButton label="دعوة عبر رسالة خاصة" selected={method === "invite"} onClick={() => setMethod("invite")} />
            </div>
            <SectionTitle>الحسابات المستخدمة</SectionTitle>
            <div className="grid grid-cols-3 gap-2">
              <OptionButton label="حساب واحد" selected={accounts === "single"} onClick={() => setAccounts("single")} />
              <OptionButton label="تدوير بين النشطة" selected={accounts === "rotate"} onClick={() => setAccounts("rotate")} />
              <OptionButton label="تحديد حسابات" selected={accounts === "custom"} onClick={() => setAccounts("custom")} />
            </div>
            <SectionTitle>حد الإضافة قبل التبديل</SectionTitle>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <OptionButton label="5 (آمن جداً)" badge={<span className="chip bg-brand-500/15 text-brand-300">موصى</span>} selected={addLimit === "5"} onClick={() => setAddLimit("5")} />
              <OptionButton label="10 (آمن)" selected={addLimit === "10"} onClick={() => setAddLimit("10")} />
              <OptionButton label="20 (متوسط)" selected={addLimit === "20"} onClick={() => setAddLimit("20")} />
              <OptionButton label="مخصص" selected={addLimit === "custom"} onClick={() => setAddLimit("custom")} />
            </div>
            <SectionTitle>التأخير بين كل إضافة</SectionTitle>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <OptionButton label="60-120 ث (آمن جداً)" badge={<span className="chip bg-brand-500/15 text-brand-300">موصى</span>} selected={delay === "60-120"} onClick={() => setDelay("60-120")} />
              <OptionButton label="30-60 ث" selected={delay === "30-60"} onClick={() => setDelay("30-60")} />
              <OptionButton label="15-30 ث" selected={delay === "15-30"} onClick={() => setDelay("15-30")} />
              <OptionButton label="5-15 ث" selected={delay === "5-15"} onClick={() => setDelay("5-15")} />
            </div>
            <SectionTitle>التأخير بين تبديل الحسابات</SectionTitle>
            <div className="grid grid-cols-3 gap-2">
              <OptionButton label="5-10 دقائق" selected={switchDelay === "5-10"} onClick={() => setSwitchDelay("5-10")} />
              <OptionButton label="2-5 دقائق" selected={switchDelay === "2-5"} onClick={() => setSwitchDelay("2-5")} />
              <OptionButton label="10-30 دقيقة" selected={switchDelay === "10-30"} onClick={() => setSwitchDelay("10-30")} />
            </div>
            <SectionTitle>الحد اليومي لكل حساب</SectionTitle>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <OptionButton label="20/يوم (موصى)" selected={dailyLimit === "20"} onClick={() => setDailyLimit("20")} />
              <OptionButton label="30/يوم" selected={dailyLimit === "30"} onClick={() => setDailyLimit("30")} />
              <OptionButton label="40/يوم" selected={dailyLimit === "40"} onClick={() => setDailyLimit("40")} />
              <OptionButton label="50/يوم" selected={dailyLimit === "50"} onClick={() => setDailyLimit("50")} />
            </div>
            <SectionTitle>خيارات الحماية</SectionTitle>
            <div className="grid gap-2 sm:grid-cols-2">
              <Checkbox label="تخطي الموجودين مسبقاً" checked={protection.skipExisting} onChange={(v) => setProtection({ ...protection, skipExisting: v })} />
              <Checkbox label="تخطي القائمة السوداء" checked={protection.skipBlacklist} onChange={(v) => setProtection({ ...protection, skipBlacklist: v })} />
              <Checkbox label="حفظ التقدم (للاستئناف)" checked={protection.saveProgress} onChange={(v) => setProtection({ ...protection, saveProgress: v })} />
              <Checkbox label="إيقاف مؤقت تلقائي عند FloodWait" checked={protection.floodWait} onChange={(v) => setProtection({ ...protection, floodWait: v })} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="primary" className="flex-1" onClick={() => setStep(2)}>عرض الملخص</Button>
              <Button onClick={() => setStep(0)}>رجوع</Button>
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="card p-6">
            <SectionTitle>الملخص</SectionTitle>
            <div className="mb-4 grid gap-2 text-sm sm:grid-cols-2">
              <SummaryRow label="ملف" value={file ? exportedFiles.find((f) => f.id === file)?.name ?? "" : ""} />
              <SummaryRow label="هدف" value={target || "@my_group"} />
              <SummaryRow label="طريقة" value="مباشرة" />
              <SummaryRow label="حسابات" value="تدوير" />
              <SummaryRow label="تأخير" value={`${delay} ث`} />
              <SummaryRow label="حد يومي" value={`${dailyLimit}/يوم`} />
            </div>
            <Alert tone="info" title="تقدير: 60 إضافة/يوم | 235 يوم للاكتمال" />
            {!running && progress === 0 && (
              <Button variant="primary" className="mt-4 w-full" icon={<Play className="h-4 w-4" />} onClick={start}>بدء الإضافة الآن</Button>
            )}
            {(running || progress > 0) && progress < 100 && (
              <div className="mt-4">
                <Progress value={progress} label="جاري الإضافة..." sub={`${progress}% [${Math.floor(progress * 141)} / 14135]`} />
                <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs text-slate-400 sm:grid-cols-4">
                  <div>الحساب: +966501234567</div>
                  <div>أُضيف: {Math.floor(progress * 1.4)}</div>
                  <div>اليوم: 18</div>
                  <div>الحالة: نشط</div>
                </div>
                <div className="mt-2 text-center text-xs text-slate-500">آخر: ✅@user1 ⚠️@user2 ❌@user3</div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {!paused ? (
                    <Button variant="warn" icon={<Pause className="h-4 w-4" />} onClick={() => setPaused(true)}>إيقاف مؤقت</Button>
                  ) : (
                    <Button variant="primary" icon={<Play className="h-4 w-4" />} onClick={() => setPaused(false)}>استئناف</Button>
                  )}
                  <Button variant="danger" icon={<Square className="h-4 w-4" />} onClick={() => { setRunning(false); setProgress(0); }}>إيقاف وحفظ</Button>
                  <Button icon={<BarChart3 className="h-4 w-4" />} onClick={() => show("تقرير مفصل")}>تقرير</Button>
                  <Button icon={<Plus className="h-4 w-4" />} onClick={() => show("زيادة التأخير 30%")}>+30%</Button>
                  <Button icon={<Minus className="h-4 w-4" />} onClick={() => show("تقليل التأخير 30%")}>-30%</Button>
                  <Button icon={<Bell className="h-4 w-4" />} onClick={() => show("كتم الإشعارات")}>كتم</Button>
                </div>
              </div>
            )}
            {progress === 100 && (
              <div className="mt-4 space-y-3">
                <Alert tone="success" title="اكتملت الإضافة — تقرير نهائي">✅ 13,500 ناجح | ⚠️ 500 تخطي | ❌ 135 فاشل</Alert>
                <div className="flex gap-2">
                  <Button onClick={() => show("تم تصدير التقرير")}>تصدير</Button>
                  <Button onClick={() => push(["add"])}>رجوع</Button>
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

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-ink-850/50 px-3 py-2">
      <span className="text-slate-400">{label}</span>
      <span className="font-medium text-slate-100">{value}</span>
    </div>
  );
}

function AddManual() {
  const { push } = useNav();
  return (
    <div className="animate-fade">
      <PageHeader title="إضافة يدوية" icon={<PenLine className="h-5 w-5" />} />
      <div className="mx-auto max-w-lg card p-6 space-y-4">
        <Field label="أسماء مستخدمين (واحد per سطر)" placeholder={"@user1\n@user2"} />
        <Field label="رابط المجموعة المستهدفة" placeholder="@my_group" />
        <Alert tone="info" title="نفس إعدادات الإضافة من CSV متاحة" />
        <Button variant="primary" className="w-full" onClick={() => push(["add", "csv"])}>متابعة للإعدادات</Button>
      </div>
    </div>
  );
}

function ResumeOp() {
  const { push } = useNav();
  return (
    <div className="animate-fade">
      <PageHeader title="استئناف عملية سابقة" icon={<RefreshCw className="h-5 w-5" />} />
      <div className="card p-5">
        <SectionTitle>العمليات المحفوظة</SectionTitle>
        <div className="space-y-2">
          <OptionButton label="إضافة @market_sa → @my_group" desc="تقدم: 45% | 6,400/14,135" onClick={() => push(["add", "csv"])} />
          <OptionButton label="إضافة @crypto_world → @my_group" desc="تقدم: 80% | 3,360/4,210" onClick={() => push(["add", "csv"])} />
        </div>
      </div>
    </div>
  );
}

function AddLogs() {
  const { push } = useNav();
  return (
    <div className="animate-fade">
      <PageHeader title="سجلات الإضافة السابقة" icon={<BarChart3 className="h-5 w-5" />} />
      {addLogs.length === 0 ? (
        <EmptyState icon={<ListChecks className="h-8 w-8" />} title="لا توجد سجلات" />
      ) : (
        <Table columns={["تاريخ", "ملف", "هدف", "ناجح", "فاشل"]} rows={addLogs.map((l) => [l.date, l.file, l.target, <span className="text-brand-300">{l.success.toLocaleString()}</span>, <span className="text-danger-400">{l.fail.toLocaleString()}</span>])} />
      )}
      <div className="mt-4"><Button onClick={() => push(["add"])}>رجوع</Button></div>
    </div>
  );
}
