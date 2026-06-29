import { useState } from "react";
import {
  Download,
  Globe,
  Link2,
  MessageSquare,
  Eye,
  Layers,
  FolderOpen,
  GitMerge,
  Filter,
  Users,
  Play,
  Pause,
  Square,
  FileText,
  ArrowRight,
} from "lucide-react";
import { useNav } from "../nav";
import { PageHeader, Button, Field, Checkbox, OptionButton, Progress, Table, SectionTitle, Alert, useToast, EmptyState, Tabs } from "../ui";
import { exportedFiles } from "../data";

export function GatherModule() {
  const { push } = useNav();
  const items = [
    { id: "public", label: "من مجموعة/قناة عامة", desc: "رابط أو @username", icon: Globe },
    { id: "private", label: "من رابط دعوة خاص", desc: "t.me/+ أو joinchat", icon: Link2 },
    { id: "chat", label: "تجميع المشاركين في الدردشة", desc: "من رسائل المجموعة", icon: MessageSquare },
    { id: "visible", label: "من مجموعة ذات أعضاء ظاهرين", desc: "أعضاء ظاهرون", icon: Eye },
    { id: "bulk", label: "استخراج جماعي (متعدد)", desc: "عدة مجموعات", icon: Layers },
    { id: "files", label: "عرض الملفات المصدرة", desc: "قائمة ملفات CSV", icon: FolderOpen },
    { id: "merge", label: "دمج + إزالة مكرر", desc: "دمج ملفات", icon: GitMerge },
  ];
  return (
    <div className="animate-fade">
      <PageHeader title="تجميع الأعضاء" subtitle="استخراج الأعضاء من المجموعات" icon={<Download className="h-5 w-5" />} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <button key={it.id} onClick={() => push(["gather", it.id])} className="card flex items-center gap-3 p-4 text-right hover:border-brand-500/40 hover:shadow-glow">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent-500/10 text-accent-400 ring-1 ring-accent-500/30">
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

export function GatherScreen({ sub }: { sub: string }) {
  switch (sub) {
    case "public": return <PublicGather />;
    case "private": return <PrivateGather />;
    case "chat": return <ChatGather />;
    case "visible": return <VisibleGather />;
    case "bulk": return <BulkGather />;
    case "files": return <FilesView />;
    case "merge": return <MergeFiles />;
    default: return null;
  }
}

function PublicGather() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [step, setStep] = useState(0);
  const [link, setLink] = useState("");
  const [type, setType] = useState<"all" | "active" | "online" | "range">("all");
  const [limit, setLimit] = useState<"all" | "1000" | "custom">("all");
  const [fields, setFields] = useState({ id: true, name: true, username: false, phone: false, last: false, bio: false });
  const [account, setAccount] = useState<"single" | "rotate">("rotate");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const start = () => {
    setRunning(true); setProgress(0); setPaused(false);
    const t = setInterval(() => { setProgress((p) => { if (p >= 100) { clearInterval(t); setRunning(false); return 100; } return p + 4; }); }, 100);
  };
  return (
    <div className="animate-fade">
      <PageHeader title="من مجموعة/قناة عامة" icon={<Globe className="h-5 w-5" />} steps={step > 0 ? { label: "تجميع الأعضاء", n: step + 1, total: 5 } : undefined} />
      <div className="mx-auto max-w-2xl">
        {step === 0 && (
          <div className="card p-6 space-y-4">
            <SectionTitle icon={<Globe className="h-4 w-4" />}>رابط أو @username</SectionTitle>
            <Field placeholder="@group_username أو t.me/group" value={link} onChange={setLink} />
            <Alert tone="info" title="معلومات المجموعة">
              <div className="mt-1 flex gap-3 text-xs">
                <span>الاسم: @market_sa</span>
                <span>النوع: عام</span>
                <span>الأعضاء: 15,340</span>
              </div>
            </Alert>
            <Button variant="primary" className="w-full" onClick={() => setStep(1)}>التالي — نوع التجميع</Button>
          </div>
        )}
        {step === 1 && (
          <div className="card p-6 space-y-3">
            <SectionTitle>نوع التجميع</SectionTitle>
            <OptionButton label="جميع الأعضاء" selected={type === "all"} onClick={() => setType("all")} />
            <OptionButton label="النشطون (أرسلوا رسائل)" selected={type === "active"} onClick={() => setType("active")} />
            <OptionButton label="المتواجدون حالياً" selected={type === "online"} onClick={() => setType("online")} />
            <OptionButton label="نطاق زمني محدد" selected={type === "range"} onClick={() => setType("range")} />
            <div className="flex gap-2 pt-2">
              <Button variant="primary" className="flex-1" onClick={() => setStep(2)}>التالي</Button>
              <Button onClick={() => setStep(0)}>رجوع</Button>
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="card p-6 space-y-4">
            <SectionTitle>فلاتر الحسابات</SectionTitle>
            <div className="grid gap-2 sm:grid-cols-2">
              <Checkbox label="استبعاد البوتات" checked={true} onChange={() => {}} />
              <Checkbox label="استبعاد المحذوفة" checked={true} onChange={() => {}} />
              <Checkbox label="استبعاد بدون username" checked={false} onChange={() => {}} />
              <Checkbox label="صورة شخصية فقط" checked={false} onChange={() => {}} />
              <Checkbox label="حسابات عربية فقط" checked={false} onChange={() => {}} />
            </div>
            <SectionTitle><span className="mt-3 block">حد التجميع</span></SectionTitle>
            <div className="space-y-2">
              <OptionButton label="جميع الأعضاء المتاحين" selected={limit === "all"} onClick={() => setLimit("all")} />
              <OptionButton label="أول 1000 فقط" selected={limit === "1000"} onClick={() => setLimit("1000")} />
              <OptionButton label="عدد مخصص" selected={limit === "custom"} onClick={() => setLimit("custom")} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="primary" className="flex-1" onClick={() => setStep(3)}>التالي</Button>
              <Button onClick={() => setStep(1)}>رجوع</Button>
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="card p-6 space-y-4">
            <SectionTitle>البيانات المطلوبة</SectionTitle>
            <div className="grid gap-2 sm:grid-cols-2">
              <Checkbox label="معرف المستخدم" checked={fields.id} onChange={(v) => setFields({ ...fields, id: v })} />
              <Checkbox label="الاسم الأول + العائلة" checked={fields.name} onChange={(v) => setFields({ ...fields, name: v })} />
              <Checkbox label="اسم المستخدم" checked={fields.username} onChange={(v) => setFields({ ...fields, username: v })} />
              <Checkbox label="رقم الهاتف" checked={fields.phone} onChange={(v) => setFields({ ...fields, phone: v })} />
              <Checkbox label="آخر ظهور" checked={fields.last} onChange={(v) => setFields({ ...fields, last: v })} />
              <Checkbox label="السيرة الذاتية" checked={fields.bio} onChange={(v) => setFields({ ...fields, bio: v })} />
            </div>
            <SectionTitle><span className="mt-3 block">الحساب المستخدم</span></SectionTitle>
            <OptionButton label="حساب واحد" selected={account === "single"} onClick={() => setAccount("single")} />
            <OptionButton label="تدوير بين عدة حسابات" selected={account === "rotate"} onClick={() => setAccount("rotate")} />
            <div className="flex gap-2 pt-2">
              <Button variant="primary" className="flex-1" onClick={() => setStep(4)}>التالي</Button>
              <Button onClick={() => setStep(2)}>رجوع</Button>
            </div>
          </div>
        )}
        {step === 4 && (
          <div className="card p-6">
            <SectionTitle>ملخص</SectionTitle>
            <div className="mb-4 grid gap-2 text-sm sm:grid-cols-2">
              <SummaryRow label="المجموعة" value={link || "@market_sa"} />
              <SummaryRow label="النوع" value="جميع الأعضاء" />
              <SummaryRow label="الحد" value="جميع المتاحين" />
              <SummaryRow label="الحساب" value="تدوير" />
            </div>
            {!running && progress === 0 && (
              <Button variant="primary" className="w-full" icon={<Play className="h-4 w-4" />} onClick={start}>بدء التجميع</Button>
            )}
            {(running || progress > 0) && progress < 100 && (
              <div>
                <Progress value={progress} label="جاري التجميع..." sub={`${progress}% [${Math.floor(progress * 153)} / 15340]`} tone="accent" />
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs text-slate-400">
                  <div>الحساب: +966501234567</div>
                  <div>السرعة: 12/ث</div>
                  <div>متبقي: ~4د</div>
                </div>
                <div className="mt-4 flex gap-2">
                  {!paused ? (
                    <Button variant="warn" className="flex-1" icon={<Pause className="h-4 w-4" />} onClick={() => setPaused(true)}>إيقاف مؤقت</Button>
                  ) : (
                    <Button variant="primary" className="flex-1" icon={<Play className="h-4 w-4" />} onClick={() => setPaused(false)}>استئناف</Button>
                  )}
                  <Button variant="danger" icon={<Square className="h-4 w-4" />} onClick={() => { setRunning(false); setProgress(0); }}>إيقاف وحفظ</Button>
                </div>
              </div>
            )}
            {progress === 100 && (
              <div className="space-y-3">
                <Alert tone="success" title="اكتمل! المستخرج: 15,340 | المتخطى: 0 | الوقت: 4د" />
                <div className="grid grid-cols-2 gap-2">
                  <Button icon={<FileText className="h-4 w-4" />} onClick={() => show("تم إرسال CSV")}>فتح الملف</Button>
                  <Button variant="primary" icon={<ArrowRight className="h-4 w-4" />} onClick={() => push(["add"])}>الانتقال لأداة الإضافة</Button>
                  <Button icon={<GitMerge className="h-4 w-4" />} onClick={() => push(["gather", "merge"])}>دمج مع ملف آخر</Button>
                  <Button onClick={() => push(["gather"])}>رجوع</Button>
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

function PrivateGather() {
  const { push } = useNav();
  return (
    <div className="animate-fade">
      <PageHeader title="من رابط دعوة خاص" icon={<Link2 className="h-5 w-5" />} />
      <div className="mx-auto max-w-lg card p-6 space-y-4">
        <Field label="رابط الدعوة" placeholder="t.me/+abc أو joinchat" />
        <SectionTitle>الحسابات للانضمام</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          <OptionButton label="حساب واحد" onClick={() => {}} />
          <OptionButton label="عدة حسابات" selected={true} onClick={() => {}} />
        </div>
        <Alert tone="info" title="جاري الانضمام... ثم نفس خيارات التجميع العام" />
        <Button variant="primary" className="w-full" onClick={() => push(["gather", "public"])}>متابعة للتجميع</Button>
      </div>
    </div>
  );
}

function ChatGather() {
  const { push } = useNav();
  const [range, setRange] = useState("100");
  return (
    <div className="animate-fade">
      <PageHeader title="تجميع المشاركين في الدردشة" icon={<MessageSquare className="h-5 w-5" />} />
      <div className="mx-auto max-w-lg card p-6 space-y-4">
        <Field label="رابط المجموعة" placeholder="@group" />
        <SectionTitle>نطاق الرسائل</SectionTitle>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[["100", "آخر 100"], ["500", "آخر 500"], ["1000", "آخر 1000"], ["5000", "آخر 5000"], ["all", "جميع الرسائل"], ["custom", "نطاق مخصص"]].map(([id, label]) => (
            <OptionButton key={id} label={label} selected={range === id} onClick={() => setRange(id)} />
          ))}
        </div>
        <SectionTitle><span className="mt-3 block">فلاتر</span></SectionTitle>
        <div className="grid gap-2 sm:grid-cols-2">
          <Checkbox label="رسائل نصية فقط" checked={false} onChange={() => {}} />
          <Checkbox label="مرسلو الوسائط فقط" checked={false} onChange={() => {}} />
          <Checkbox label="مستخدمو التفاعلات فقط" checked={true} onChange={() => {}} />
          <Checkbox label="إزالة المكرر" checked={true} onChange={() => {}} />
          <Checkbox label="ترتيب حسب النشاط" checked={false} onChange={() => {}} />
        </div>
        <Button variant="primary" className="w-full" onClick={() => push(["gather", "public"])}>بدء التجميع</Button>
      </div>
    </div>
  );
}

function VisibleGather() {
  const { push } = useNav();
  return (
    <div className="animate-fade">
      <PageHeader title="من مجموعة ذات أعضاء ظاهرين" icon={<Eye className="h-5 w-5" />} />
      <div className="mx-auto max-w-lg card p-6 space-y-4">
        <Field label="رابط المجموعة" placeholder="@group" />
        <Alert tone="info" title="نفس خيارات التجميع العام متاحة" />
        <Button variant="primary" className="w-full" onClick={() => push(["gather", "public"])}>متابعة</Button>
      </div>
    </div>
  );
}

function BulkGather() {
  const { push } = useNav();
  const [mode, setMode] = useState<"manual" | "file">("manual");
  return (
    <div className="animate-fade">
      <PageHeader title="استخراج جماعي (متعدد)" icon={<Layers className="h-5 w-5" />} />
      <div className="mx-auto max-w-lg card p-6 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <OptionButton label="إدخال يدوي" selected={mode === "manual"} onClick={() => setMode("manual")} />
          <OptionButton label="استيراد من ملف نصي" selected={mode === "file"} onClick={() => setMode("file")} />
        </div>
        {mode === "manual" ? (
          <Field label="روابط (واحد per سطر)" placeholder={"@group1\n@group2"} />
        ) : (
          <Field label="مسار الملف" placeholder="/path/to/links.txt" />
        )}
        <div className="grid gap-2 sm:grid-cols-3">
          <Checkbox label="دمج النتائج في ملف واحد" checked={true} onChange={() => {}} />
          <Checkbox label="إزالة المكرر عبر المجموعات" checked={true} onChange={() => {}} />
          <Checkbox label="حفظ كل مجموعة منفصلة" checked={false} onChange={() => {}} />
        </div>
        <Alert tone="info" title="ملخص: 3 عام | 1 خاص" />
        <Button variant="primary" className="w-full" onClick={() => push(["gather"])}>بدء التجميع الجماعي</Button>
      </div>
    </div>
  );
}

function FilesView() {
  const { push } = useNav();
  const { show, node } = useToast();
  return (
    <div className="animate-fade">
      <PageHeader title="الملفات المصدرة" icon={<FolderOpen className="h-5 w-5" />} />
      {exportedFiles.length === 0 ? (
        <EmptyState icon={<FolderOpen className="h-8 w-8" />} title="لا توجد ملفات" />
      ) : (
        <Table columns={["اسم", "الأعضاء", "التاريخ", ""]} rows={exportedFiles.map((f) => [
          f.name, f.members.toLocaleString(), f.date,
          <div className="flex gap-1.5">
            <Button onClick={() => show("تم إرسال CSV")}>إرسال</Button>
            <Button onClick={() => push(["add"])}>استخدام</Button>
            <Button variant="danger" onClick={() => show("تم الحذف", "danger")}>حذف</Button>
          </div>,
        ])} />
      )}
      <div className="mt-4"><Button onClick={() => push(["gather"])}>رجوع</Button></div>
      {node}
    </div>
  );
}

function MergeFiles() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [selected, setSelected] = useState<number[]>([]);
  const [merging, setMerging] = useState(false);
  const [done, setDone] = useState(false);
  const toggle = (id: number) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  return (
    <div className="animate-fade">
      <PageHeader title="دمج + إزالة مكرر" icon={<GitMerge className="h-5 w-5" />} />
      <div className="card p-5">
        <SectionTitle>الملفات المتاحة</SectionTitle>
        <div className="space-y-2">
          {exportedFiles.map((f) => (
            <Checkbox key={f.id} label={`${f.name} (${f.members.toLocaleString()} عضو)`} checked={selected.includes(f.id)} onChange={() => toggle(f.id)} />
          ))}
        </div>
        <div className="mt-4"><Checkbox label="إزالة المكرر بعد الدمج" checked={true} onChange={() => {}} /></div>
        <div className="mt-4">
          {!merging && !done && <Button variant="primary" className="w-full" disabled={selected.length < 2} onClick={() => { setMerging(true); setTimeout(() => { setMerging(false); setDone(true); }, 1500); }}>بدء الدمج</Button>}
          {merging && <Progress value={75} label="جاري الدمج..." sub="75%" tone="accent" />}
          {done && <Alert tone="success" title="اكتمل | إجمالي: 29,521 | مكرر أُزيل: 1,200">تم إرسال الملف المدمج كمرفق.</Alert>}
          {done && <Button onClick={() => push(["gather"])}>رجوع</Button>}
        </div>
      </div>
      {node}
    </div>
  );
}
