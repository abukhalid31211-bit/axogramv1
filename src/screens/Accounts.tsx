import { useState } from "react";
import {
  Users,
  UserPlus,
  FolderInput,
  ListChecks,
  ShieldCheck,
  Trash2,
  Zap,
  Upload,
  Download,
  Flame,
  Phone,
  KeyRound,
  CheckCircle2,
  Globe,
  ArrowRight,
} from "lucide-react";
import { useNav } from "../nav";
import { PageHeader, Button, Field, Checkbox, OptionButton, Progress, StatusChip, Table, SectionTitle, Alert, ConfirmDialog, useToast, EmptyState, Tabs } from "../ui";
import { accounts, type AccountStatus } from "../data";

export function AccountsModule() {
  const { push } = useNav();
  const items = [
    { id: "add", label: "إضافة حساب جديد", desc: "تسجيل دخول برقم الهاتف", icon: UserPlus },
    { id: "import", label: "استيراد الجلسات", desc: "من مجلد أو ملف .session", icon: FolderInput },
    { id: "list", label: "عرض الحسابات", desc: "جدول كل الحسابات وحالاتها", icon: ListChecks },
    { id: "validate", label: "التحقق من الصحة", desc: "فحص جماعي للحسابات", icon: ShieldCheck },
    { id: "remove", label: "إزالة حساب", desc: "حذف حساب محدد", icon: Trash2 },
    { id: "auto-remove", label: "إزالة تلقائية للمحظورة", desc: "كشف وحذف المحظورة", icon: Zap },
    { id: "export", label: "تصدير الجلسات", desc: "تصدير ملفات الجلسات", icon: Upload },
    { id: "warmup", label: "تهيئة الحسابات (تسخين)", desc: "تسخين الحسابات الجديدة", icon: Flame },
  ];
  return (
    <div className="animate-fade">
      <PageHeader title="مدير الحسابات" subtitle="إدارة حسابات تيليجرام" icon={<Users className="h-5 w-5" />} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <button key={it.id} onClick={() => push(["accounts", it.id])} className="card flex items-center gap-3 p-4 text-right hover:border-brand-500/40 hover:shadow-glow">
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

export function AccountsScreen({ sub }: { sub: string }) {
  switch (sub) {
    case "add": return <AddAccount />;
    case "import": return <ImportSessions />;
    case "list": return <ListAccounts />;
    case "validate": return <ValidateAccounts />;
    case "remove": return <RemoveAccount />;
    case "auto-remove": return <AutoRemove />;
    case "export": return <ExportSessions />;
    case "warmup": return <WarmupAccounts />;
    default: return null;
  }
}

function AddAccount() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [step, setStep] = useState(0);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [twoFA, setTwoFA] = useState("");
  const [has2FA, setHas2FA] = useState(false);
  return (
    <div className="animate-fade">
      <PageHeader title="إضافة حساب جديد" subtitle="تسجيل دخول برقم الهاتف" icon={<UserPlus className="h-5 w-5" />} />
      <div className="mx-auto max-w-lg">
        {step === 0 && (
          <div className="card p-6">
            <SectionTitle icon={<Phone className="h-4 w-4" />}>رقم الهاتف</SectionTitle>
            <Field label="رقم الهاتف" placeholder="+9665XXXXXXXX" value={phone} onChange={setPhone} icon={<Phone className="h-4 w-4" />} hint="صيغة دولية مع رمز الدولة" />
            <div className="mt-5 flex gap-2">
              <Button variant="primary" className="flex-1" onClick={() => setStep(1)}>إرسال رمز التحقق</Button>
              <Button onClick={() => push(["accounts"])}>إلغاء</Button>
            </div>
          </div>
        )}
        {step === 1 && (
          <div className="card p-6">
            <Alert tone="info" title="جاري إرسال رمز التحقق...">سيصلك رمز عبر التطبيق أو رسالة SMS.</Alert>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="primary" icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => setStep(2)}>استلمته في التطبيق</Button>
              <Button icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => setStep(2)}>استلمته SMS</Button>
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="card p-6">
            <SectionTitle icon={<KeyRound className="h-4 w-4" />}>رمز التحقق</SectionTitle>
            <Field label="رمز التحقق" placeholder="• • • • •" value={code} onChange={setCode} />
            <div className="mt-5 flex gap-2">
              <Button variant="primary" className="flex-1" onClick={() => { setHas2FA(true); setStep(3); }}>تحقق</Button>
              <Button onClick={() => setStep(0)}>رجوع</Button>
            </div>
          </div>
        )}
        {step === 3 && has2FA && (
          <div className="card p-6">
            <Alert tone="warn" title="فحص 2FA...">الحساب محمي بكلمة مرور ثنائية.</Alert>
            <div className="mt-4"><Field label="كلمة مرور 2FA" type="password" placeholder="••••••••" value={twoFA} onChange={setTwoFA} /></div>
            <div className="mt-5 flex gap-2">
              <Button variant="primary" className="flex-1" onClick={() => setStep(4)}>تأكيد</Button>
              <Button onClick={() => setStep(2)}>رجوع</Button>
            </div>
          </div>
        )}
        {step === 4 && (
          <div className="card p-6 text-center">
            <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-brand-500/15 text-brand-300 ring-1 ring-brand-500/40 animate-pulse-glow">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-bold text-white">تم تسجيل الدخول بنجاح</h3>
            <p className="mt-1 text-sm text-slate-400">الحساب {phone || "+9665XXXXXXXX"} جاهز للاستخدام.</p>
            <div className="mt-5 grid gap-2">
              <Button variant="primary" icon={<Globe className="h-4 w-4" />} onClick={() => push(["proxy"])}>تعيين بروكسي الآن</Button>
              <Button icon={<UserPlus className="h-4 w-4" />} onClick={() => { setStep(0); setPhone(""); setCode(""); setTwoFA(""); setHas2FA(false); }}>إضافة حساب آخر</Button>
              <Button onClick={() => push(["accounts"])}>مدير الحسابات</Button>
            </div>
          </div>
        )}
      </div>
      {node}
    </div>
  );
}

function ImportSessions() {
  const { show, node } = useToast();
  const [mode, setMode] = useState<"menu" | "folder" | "file" | "txt">("menu");
  const [path, setPath] = useState("");
  const [scanning, setScanning] = useState(false);
  const [done, setDone] = useState(false);
  const startScan = () => { setScanning(true); setDone(false); setTimeout(() => { setScanning(false); setDone(true); }, 1800); };
  if (mode === "menu") {
    return (
      <div className="animate-fade">
        <PageHeader title="استيراد الجلسات" subtitle="من ملفات .session" icon={<FolderInput className="h-5 w-5" />} />
        <div className="mx-auto max-w-lg space-y-3">
          <OptionButton label="من مجلد (جميع ملفات .session)" desc="فحص مجلد كامل" onClick={() => setMode("folder")} />
          <OptionButton label="ملف واحد" desc="استيراد ملف .session واحد" onClick={() => setMode("file")} />
          <OptionButton label="من ملف نصي (أرقام + جلسات)" desc="قائمة أرقام ومسارات" onClick={() => setMode("txt")} />
        </div>
      </div>
    );
  }
  return (
    <div className="animate-fade">
      <PageHeader title={mode === "folder" ? "استيراد من مجلد" : mode === "file" ? "استيراد ملف واحد" : "استيراد من ملف نصي"} icon={<FolderInput className="h-5 w-5" />} />
      <div className="mx-auto max-w-lg">
        <div className="card p-6">
          <Field label="المسار" placeholder={mode === "folder" ? "./sessions/" : "/path/to/file.session"} value={path} onChange={setPath} />
          {!scanning && !done && (
            <div className="mt-5 flex gap-2">
              <Button variant="primary" className="flex-1" onClick={startScan}>بدء الفحص</Button>
              <Button onClick={() => setMode("menu")}>رجوع</Button>
            </div>
          )}
          {scanning && <div className="mt-5"><Progress value={60} label="جاري الفحص..." sub="60%" tone="accent" /></div>}
          {done && (
            <div className="mt-5 space-y-3">
              <Alert tone="success" title="نتائج الفحص">
                <div className="mt-1 flex gap-3">
                  <span className="chip bg-brand-500/15 text-brand-300">صالحة: 4</span>
                  <span className="chip bg-danger-500/15 text-danger-400">تالفة: 1</span>
                  <span className="chip bg-warn-500/15 text-warn-400">مكررة: 2</span>
                </div>
              </Alert>
              <div className="flex gap-2">
                <Button variant="primary" className="flex-1" onClick={() => { show("تم استيراد 4 جلسات"); setMode("menu"); }}>استيراد الصالحة فقط</Button>
                <Button onClick={() => setMode("menu")}>إلغاء</Button>
              </div>
            </div>
          )}
        </div>
      </div>
      {node}
    </div>
  );
}

function ListAccounts() {
  const { push } = useNav();
  const [filter, setFilter] = useState<"all" | AccountStatus>("all");
  const [selected, setSelected] = useState<number[]>([]);
  const [confirmDel, setConfirmDel] = useState(false);
  const { show, node } = useToast();
  const filtered = accounts.filter((a) => filter === "all" || a.status === filter);
  const toggle = (id: number) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  return (
    <div className="animate-fade">
      <PageHeader title="عرض الحسابات" subtitle={`${accounts.length} حساب`} icon={<ListChecks className="h-5 w-5" />} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Tabs tabs={[{ id: "all", label: "الكل" }, { id: "active", label: "نشط" }, { id: "blocked", label: "محظور" }, { id: "restricted", label: "مقيد" }]} active={filter} onChange={(v) => setFilter(v as typeof filter)} />
        <div className="flex gap-2">
          <Button onClick={() => setSelected(filtered.map((a) => a.id))}>تحديد الكل</Button>
          <Button onClick={() => setSelected([])}>إلغاء التحديد</Button>
          <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} disabled={selected.length === 0} onClick={() => setConfirmDel(true)}>حذف المحدد ({selected.length})</Button>
        </div>
      </div>
      <Table columns={["", "رقم", "اسم", "حالة", "بروكسي", "آخر استخدام", ""]} rows={filtered.map((a) => [
        <input type="checkbox" checked={selected.includes(a.id)} onChange={() => toggle(a.id)} className="h-4 w-4 accent-brand-500" />,
        a.phone, a.name, <StatusChip status={a.status} />, a.proxy, a.lastUsed,
        <Button onClick={() => push(["accounts", "detail", String(a.id)])}>تفاصيل</Button>,
      ])} />
      <ConfirmDialog open={confirmDel} danger title="حذف الحسابات المحددة" message={`سيتم حذف ${selected.length} حساب نهائياً.`} confirmLabel="تأكيد الحذف" onConfirm={() => { setConfirmDel(false); setSelected([]); show("تم حذف الحسابات", "success"); }} onCancel={() => setConfirmDel(false)} />
      {node}
    </div>
  );
}

function AccountDetail({ id }: { id: string }) {
  const { push } = useNav();
  const acc = accounts.find((a) => a.id === Number(id)) ?? accounts[0];
  const [confirmDel, setConfirmDel] = useState(false);
  const { show, node } = useToast();
  return (
    <div className="animate-fade">
      <PageHeader title={`حساب: ${acc.name}`} subtitle={acc.phone} icon={<Users className="h-5 w-5" />} />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-5">
          <SectionTitle>بطاقة الحساب</SectionTitle>
          <div className="space-y-2 text-sm">
            <Row label="الاسم" value={acc.name} />
            <Row label="@username" value={acc.username} />
            <Row label="الهاتف" value={acc.phone} />
            <Row label="العمر" value={acc.age} />
            <Row label="الحالة" value={<StatusChip status={acc.status} />} />
            <Row label="البروكسي" value={acc.proxy} />
            <Row label="آخر استخدام" value={acc.lastUsed} />
            <Row label="عدد القروبات" value={String(acc.groups)} />
          </div>
        </div>
        <div className="card p-5">
          <SectionTitle>إجراءات</SectionTitle>
          <div className="grid gap-2">
            <Button variant="primary" icon={<Globe className="h-4 w-4" />} onClick={() => push(["proxy"])}>تغيير البروكسي</Button>
            <Button icon={<Flame className="h-4 w-4" />} onClick={() => push(["accounts", "warmup"])}>تهيئة هذا الحساب</Button>
            <Button icon={<ShieldCheck className="h-4 w-4" />} onClick={() => show("الحساب نشط", "success")}>التحقق من هذا الحساب</Button>
            <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirmDel(true)}>إزالة هذا الحساب</Button>
            <Button onClick={() => push(["accounts", "list"])}>رجوع للقائمة</Button>
          </div>
        </div>
      </div>
      <ConfirmDialog open={confirmDel} danger title="إزالة الحساب" message={`سيتم حذف ${acc.phone} نهائياً.`} onConfirm={() => { setConfirmDel(false); show("تم حذف الحساب"); push(["accounts", "list"]); }} onCancel={() => setConfirmDel(false)} />
      {node}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-ink-700/40 py-2">
      <span className="text-slate-400">{label}</span>
      <span className="font-medium text-slate-100">{value}</span>
    </div>
  );
}

function ValidateAccounts() {
  const { push } = useNav();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const start = () => {
    setRunning(true); setProgress(0); setDone(false);
    const t = setInterval(() => { setProgress((p) => { if (p >= 100) { clearInterval(t); setRunning(false); setDone(true); return 100; } return p + 8; }); }, 120);
  };
  return (
    <div className="animate-fade">
      <PageHeader title="التحقق من الصحة" subtitle="فحص جماعي للحسابات" icon={<ShieldCheck className="h-5 w-5" />} />
      <div className="mx-auto max-w-lg">
        <div className="card p-6">
          {!running && !done && <Button variant="primary" className="w-full" onClick={start}>بدء التحقق</Button>}
          {running && (
            <div>
              <Progress value={progress} label={`جاري التحقق... [${Math.floor(progress / 8)}/12]`} sub={`${progress}%`} tone="accent" />
              <div className="mt-4 flex gap-2"><Button variant="warn" className="flex-1" onClick={() => { setRunning(false); setProgress(0); }}>إيقاف</Button></div>
            </div>
          )}
          {done && (
            <div className="space-y-4">
              <Alert tone="success" title="اكتمل التحقق">
                <div className="mt-2 flex gap-3">
                  <span className="chip bg-brand-500/15 text-brand-300">نشط: 9</span>
                  <span className="chip bg-danger-500/15 text-danger-400">محظور: 2</span>
                  <span className="chip bg-warn-500/15 text-warn-400">مقيد: 1</span>
                </div>
              </Alert>
              <Table columns={["حساب", "حالة", "السبب", "التوصية"]} rows={[
                ["+966501234567", <StatusChip status="active" />, "—", "متابعة"],
                ["+966574567890", <StatusChip status="blocked" />, "حظر دائم", "إزالة"],
                ["+966563456789", <StatusChip status="restricted" />, "تقييد مؤقت", "راحة 24س"],
              ]} />
              <div className="flex gap-2">
                <Button variant="danger" className="flex-1" onClick={() => push(["accounts", "auto-remove"])}>إزالة المحظورة تلقائياً</Button>
                <Button onClick={() => push(["reports"])}>تقرير مفصل</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RemoveAccount() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [val, setVal] = useState("");
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="animate-fade">
      <PageHeader title="إزالة حساب" icon={<Trash2 className="h-5 w-5" />} />
      <div className="mx-auto max-w-lg">
        <div className="card p-6">
          <Field label="رقم الحساب أو الهاتف" placeholder="+9665XXXXXXXX" value={val} onChange={setVal} />
          <div className="mt-5 flex gap-2">
            <Button variant="danger" className="flex-1" disabled={!val} onClick={() => setConfirm(true)}>تأكيد الحذف</Button>
            <Button onClick={() => push(["accounts"])}>إلغاء</Button>
          </div>
        </div>
      </div>
      <ConfirmDialog open={confirm} danger title="تأكيد حذف الحساب" message={`سيتم حذف ${val} نهائياً.`} onConfirm={() => { setConfirm(false); show("تم حذف الحساب"); push(["accounts", "list"]); }} onCancel={() => setConfirm(false)} />
      {node}
    </div>
  );
}

function AutoRemove() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [scanning, setScanning] = useState(false);
  const [found, setFound] = useState<number | null>(null);
  return (
    <div className="animate-fade">
      <PageHeader title="إزالة تلقائية للمحظورة" icon={<Zap className="h-5 w-5" />} />
      <div className="mx-auto max-w-lg">
        <div className="card p-6">
          {!scanning && found === null && <Button variant="primary" className="w-full" onClick={() => { setScanning(true); setTimeout(() => { setScanning(false); setFound(2); }, 1500); }}>بدء الكشف</Button>}
          {scanning && <Progress value={70} label="جاري الكشف..." sub="70%" tone="accent" />}
          {found !== null && (
            <div className="space-y-4">
              <Alert tone="warn" title={`وُجد: ${found} حساب محظور/مقيد`} />
              <div className="flex gap-2">
                <Button variant="danger" className="flex-1" onClick={() => { show("تمت الإزالة"); push(["accounts"]); }}>تأكيد الإزالة</Button>
                <Button onClick={() => push(["accounts"])}>إلغاء</Button>
              </div>
            </div>
          )}
        </div>
      </div>
      {node}
    </div>
  );
}

function ExportSessions() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [path, setPath] = useState("./exports/");
  const [exporting, setExporting] = useState(false);
  const [done, setDone] = useState(false);
  return (
    <div className="animate-fade">
      <PageHeader title="تصدير الجلسات" icon={<Upload className="h-5 w-5" />} />
      <div className="mx-auto max-w-lg">
        <div className="card p-6 space-y-3">
          <OptionButton label="تصدير جميع الجلسات" onClick={() => {}} />
          <OptionButton label="تحديد جلسات معينة" desc="أرقام الحسابات" onClick={() => {}} />
          <Field label="مسار مجلد التصدير" value={path} onChange={setPath} />
          {!exporting && !done && <Button variant="primary" className="w-full" onClick={() => { setExporting(true); setTimeout(() => { setExporting(false); setDone(true); }, 1600); }}>بدء التصدير</Button>}
          {exporting && <Progress value={80} label="جاري التصدير..." sub="80%" />}
          {done && <Alert tone="success" title="تم التصدير">تم إرسال الملف كمرفق.</Alert>}
          {done && <Button onClick={() => push(["accounts"])}>رجوع</Button>}
        </div>
      </div>
      {node}
    </div>
  );
}

function WarmupAccounts() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [actions, setActions] = useState({ channels: true, messages: true, views: false, profile: true, contacts: false });
  const [intensity, setIntensity] = useState<"light" | "medium" | "intensive">("intensive");
  const [target, setTarget] = useState<"all" | "manual">("all");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const start = () => {
    setRunning(true); setProgress(0);
    const t = setInterval(() => { setProgress((p) => { if (p >= 100) { clearInterval(t); setRunning(false); show("اكتملت التهيئة"); return 100; } return p + 5; }); }, 120);
  };
  return (
    <div className="animate-fade">
      <PageHeader title="تهيئة الحسابات (تسخين)" icon={<Flame className="h-5 w-5" />} />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <SectionTitle>اختر إجراءات التهيئة</SectionTitle>
          <div className="space-y-2">
            <Checkbox label="الانضمام لقنوات مشهورة عشوائية" checked={actions.channels} onChange={(v) => setActions({ ...actions, channels: v })} />
            <Checkbox label="إرسال رسائل عشوائية بين الحسابات" checked={actions.messages} onChange={(v) => setActions({ ...actions, messages: v })} />
            <Checkbox label="مشاهدة الرسائل في المجموعات" checked={actions.views} onChange={(v) => setActions({ ...actions, views: v })} />
            <Checkbox label="تغيير الصورة والسيرة الذاتية" checked={actions.profile} onChange={(v) => setActions({ ...actions, profile: v })} />
            <Checkbox label="إضافة جهات اتصال عشوائية" checked={actions.contacts} onChange={(v) => setActions({ ...actions, contacts: v })} />
          </div>
        </div>
        <div className="card p-5">
          <SectionTitle>الشدة</SectionTitle>
          <div className="space-y-2">
            <OptionButton label="خفيفة — يوم واحد" selected={intensity === "light"} onClick={() => setIntensity("light")} />
            <OptionButton label="متوسطة — 3 أيام" selected={intensity === "medium"} onClick={() => setIntensity("medium")} />
            <OptionButton label="مكثفة — 7 أيام (موصى)" badge={<span className="chip bg-brand-500/15 text-brand-300">موصى</span>} selected={intensity === "intensive"} onClick={() => setIntensity("intensive")} />
          </div>
          <SectionTitle><span className="mt-4 block">الحسابات المستهدفة</span></SectionTitle>
          <div className="space-y-2">
            <OptionButton label="جميع الحسابات الجديدة" selected={target === "all"} onClick={() => setTarget("all")} />
            <OptionButton label="تحديد يدوي" selected={target === "manual"} onClick={() => setTarget("manual")} />
          </div>
        </div>
      </div>
      <div className="mt-4 card p-5">
        {running ? (
          <div>
            <Progress value={progress} label="جاري التسخين..." sub={`${progress}%`} tone="warn" />
            <div className="mt-4 flex gap-2">
              <Button variant="warn" onClick={() => { setRunning(false); setProgress(0); }}>إيقاف مؤقت</Button>
              <Button variant="danger" onClick={() => { setRunning(false); setProgress(0); }}>إيقاف وحفظ</Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button variant="primary" className="flex-1" icon={<Flame className="h-4 w-4" />} onClick={start}>بدء التهيئة</Button>
            <Button onClick={() => push(["accounts"])}>إلغاء</Button>
          </div>
        )}
      </div>
      {node}
    </div>
  );
}

export { AccountDetail };
