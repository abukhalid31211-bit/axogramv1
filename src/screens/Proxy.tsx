import { useState } from "react";
import { Globe, Plus, FileText, ListChecks, ShieldCheck, Link2, Zap, Trash2 } from "lucide-react";
import { useNav } from "../nav";
import { PageHeader, Button, Field, OptionButton, Progress, Table, SectionTitle, Alert, ConfirmDialog, useToast, StatusChip } from "../ui";
import { proxies } from "../data";

export function ProxyModule() {
  const { push } = useNav();
  const items = [
    { id: "add", label: "إضافة بروكسي جديد", desc: "SOCKS5/4/HTTP/MTProto", icon: Plus },
    { id: "import", label: "استيراد قائمة من .txt", desc: "تحليل ملف", icon: FileText },
    { id: "list", label: "عرض جميع البروكسيهات", desc: "جدول كامل", icon: ListChecks },
    { id: "validate", label: "التحقق من الصحة", desc: "فحص تلقائي", icon: ShieldCheck },
    { id: "assign-manual", label: "تعيين يدوي لحساب", desc: "ربط بروكسي بحساب", icon: Link2 },
    { id: "assign-auto", label: "تعيين تلقائي", desc: "نسبة مخصصة", icon: Zap },
    { id: "remove-dead", label: "إزالة البروكسيهات الميتة", desc: "كشف وحذف", icon: Trash2 },
  ];
  return (
    <div className="animate-fade">
      <PageHeader title="مدير البروكسي" subtitle="إدارة البروكسيهات" icon={<Globe className="h-5 w-5" />} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <button key={it.id} onClick={() => push(["proxy", it.id])} className="card flex items-center gap-3 p-4 text-right hover:border-brand-500/40 hover:shadow-glow">
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

export function ProxyScreen({ sub }: { sub: string }) {
  switch (sub) {
    case "add": return <AddProxy />;
    case "import": return <ImportProxy />;
    case "list": return <ListProxy />;
    case "validate": return <ValidateProxy />;
    case "assign-manual": return <AssignManual />;
    case "assign-auto": return <AssignAuto />;
    case "remove-dead": return <RemoveDead />;
    default: return null;
  }
}

function AddProxy() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [type, setType] = useState("SOCKS5");
  const [addr, setAddr] = useState("");
  const [checking, setChecking] = useState(false);
  const [valid, setValid] = useState<boolean | null>(null);
  return (
    <div className="animate-fade">
      <PageHeader title="إضافة بروكسي جديد" icon={<Plus className="h-5 w-5" />} />
      <div className="mx-auto max-w-lg card p-6 space-y-4">
        <SectionTitle>النوع</SectionTitle>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {["SOCKS5", "SOCKS4", "HTTP/HTTPS", "MTProto"].map((t) => (
            <OptionButton key={t} label={t} selected={type === t} onClick={() => setType(t)} />
          ))}
        </div>
        <Field label="IP:PORT:USER:PASS" placeholder="185.12.45.10:1080:user:pass" value={addr} onChange={setAddr} />
        {checking && <Progress value={60} label="جاري التحقق..." sub="60%" tone="accent" />}
        {valid === true && <Alert tone="success" title="بروكسي صالح" />}
        {valid === false && <Alert tone="danger" title="بروكسي غير صالح" />}
        <div className="flex gap-2">
          <Button variant="primary" className="flex-1" disabled={!addr || checking} onClick={() => { setChecking(true); setTimeout(() => { setChecking(false); setValid(true); }, 1200); }}>تحقق</Button>
          <Button disabled={valid !== true} onClick={() => { show("تم حفظ البروكسي"); push(["proxy"]); }}>حفظ</Button>
          <Button onClick={() => push(["proxy"])}>إلغاء</Button>
        </div>
      </div>
      {node}
    </div>
  );
}

function ImportProxy() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [path, setPath] = useState("");
  const [parsing, setParsing] = useState(false);
  const [done, setDone] = useState(false);
  return (
    <div className="animate-fade">
      <PageHeader title="استيراد قائمة من .txt" icon={<FileText className="h-5 w-5" />} />
      <div className="mx-auto max-w-lg card p-6 space-y-4">
        <Field label="مسار الملف" placeholder="/path/to/proxies.txt" value={path} onChange={setPath} />
        {!parsing && !done && <Button variant="primary" className="w-full" disabled={!path} onClick={() => { setParsing(true); setTimeout(() => { setParsing(false); setDone(true); }, 1400); }}>بدء التحليل</Button>}
        {parsing && <Progress value={70} label="جاري التحليل..." sub="70%" tone="accent" />}
        {done && (
          <div className="space-y-3">
            <Alert tone="success" title="نتائج: 8 صالح | 2 منتهي | 1 مشوه" />
            <div className="flex gap-2">
              <Button variant="primary" className="flex-1" onClick={() => { show("تم استيراد 8 بروكسي"); push(["proxy"]); }}>استيراد الصالحة</Button>
              <Button onClick={() => push(["proxy"])}>إلغاء</Button>
            </div>
          </div>
        )}
      </div>
      {node}
    </div>
  );
}

function ListProxy() {
  const { push } = useNav();
  return (
    <div className="animate-fade">
      <PageHeader title="عرض جميع البروكسيهات" icon={<ListChecks className="h-5 w-5" />} />
      <Table columns={["#", "IP:PORT", "نوع", "حالة", "سرعة", "مرتبط بـ"]} rows={proxies.map((p, i) => [i + 1, p.addr, p.type, <StatusChip status={p.status as "active" | "dead" | "slow"} />, p.speed, p.linked])} />
      <div className="mt-4"><Button onClick={() => push(["proxy"])}>رجوع</Button></div>
    </div>
  );
}

function ValidateProxy() {
  const { push } = useNav();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  return (
    <div className="animate-fade">
      <PageHeader title="التحقق من الصحة" icon={<ShieldCheck className="h-5 w-5" />} />
      <div className="mx-auto max-w-lg card p-6">
        {!running && !done && <Button variant="primary" className="w-full" onClick={() => { setRunning(true); setProgress(0); const t = setInterval(() => { setProgress((p) => { if (p >= 100) { clearInterval(t); setRunning(false); setDone(true); return 100; } return p + 10; }); }, 120); }}>بدء الفحص</Button>}
        {running && <Progress value={progress} label="فحص تلقائي..." sub={`${progress}%`} tone="accent" />}
        {done && (
          <div className="space-y-3">
            <div className="flex gap-3">
              <span className="chip bg-brand-500/15 text-brand-300">نشط: 3</span>
              <span className="chip bg-danger-500/15 text-danger-400">ميت: 1</span>
              <span className="chip bg-warn-500/15 text-warn-400">بطيء: 1</span>
            </div>
            <Table columns={["IP:PORT", "نوع", "سرعة", "حالة"]} rows={proxies.map((p) => [p.addr, p.type, p.speed, <StatusChip status={p.status as "active" | "dead" | "slow"} />])} />
            <div className="flex gap-2">
              <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => push(["proxy", "remove-dead"])}>إزالة الميتة</Button>
              <Button onClick={() => push(["proxy"])}>رجوع</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AssignManual() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [acc, setAcc] = useState<number | null>(null);
  const [proxy, setProxy] = useState<number | null>(null);
  return (
    <div className="animate-fade">
      <PageHeader title="تعيين يدوي لحساب" icon={<Link2 className="h-5 w-5" />} />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <SectionTitle>قائمة الحسابات</SectionTitle>
          <div className="space-y-2">
            {[["1", "+966501234567"], ["2", "+966552345678"], ["3", "+966563456789"]].map(([id, label]) => (
              <OptionButton key={id} label={label} selected={acc === Number(id)} onClick={() => setAcc(Number(id))} />
            ))}
          </div>
        </div>
        <div className="card p-5">
          <SectionTitle>البروكسيهات النشطة</SectionTitle>
          <div className="space-y-2">
            {proxies.filter((p) => p.status === "active").map((p) => (
              <OptionButton key={p.id} label={p.addr} desc={p.type} selected={proxy === p.id} onClick={() => setProxy(p.id)} />
            ))}
          </div>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button variant="primary" className="flex-1" disabled={acc === null || proxy === null} onClick={() => { show("تم التعيين"); push(["proxy"]); }}>تأكيد التعيين</Button>
        <Button onClick={() => push(["proxy"])}>إلغاء</Button>
      </div>
      {node}
    </div>
  );
}

function AssignAuto() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [ratio, setRatio] = useState("1:1");
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  return (
    <div className="animate-fade">
      <PageHeader title="تعيين تلقائي للبروكسيهات" icon={<Zap className="h-5 w-5" />} />
      <div className="mx-auto max-w-lg card p-6 space-y-4">
        <Alert tone="info" title="متاح: 3 حساب بدون بروكسي | 3 بروكسي" />
        <SectionTitle>النسبة</SectionTitle>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <OptionButton label="1:1" selected={ratio === "1:1"} onClick={() => setRatio("1:1")} />
          <OptionButton label="1:3" selected={ratio === "1:3"} onClick={() => setRatio("1:3")} />
          <OptionButton label="1:5" selected={ratio === "1:5"} onClick={() => setRatio("1:5")} />
          <OptionButton label="مخصص" selected={ratio === "custom"} onClick={() => setRatio("custom")} />
        </div>
        {!running && !done && <Button variant="primary" className="w-full" onClick={() => { setRunning(true); setTimeout(() => { setRunning(false); setDone(true); }, 1400); }}>بدء التعيين التلقائي</Button>}
        {running && <Progress value={80} label="جاري التعيين..." sub="80%" />}
        {done && <Alert tone="success" title="تم تعيين 3 بروكسي"><Button className="mt-2" onClick={() => push(["proxy"])}>رجوع</Button></Alert>}
      </div>
      {node}
    </div>
  );
}

function RemoveDead() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="animate-fade">
      <PageHeader title="إزالة البروكسيهات الميتة" icon={<Trash2 className="h-5 w-5" />} />
      <div className="mx-auto max-w-lg card p-6 space-y-4">
        <Alert tone="warn" title="وُجد: 1 بروكسي ميت" />
        <div className="flex gap-2">
          <Button variant="danger" className="flex-1" onClick={() => setConfirm(true)}>تأكيد الإزالة</Button>
          <Button onClick={() => push(["proxy"])}>إلغاء</Button>
        </div>
      </div>
      <ConfirmDialog open={confirm} danger title="إزالة البروكسي الميت" message="سيتم حذف 1 بروكسي." onConfirm={() => { setConfirm(false); show("تمت الإزالة"); push(["proxy"]); }} onCancel={() => setConfirm(false)} />
      {node}
    </div>
  );
}
