import { useState } from "react";
import { RefreshCw, Settings, ListChecks, Edit3, BarChart3, Eraser } from "lucide-react";
import { useNav } from "../nav";
import { PageHeader, Button, OptionButton, Table, SectionTitle, useToast, InlineEdit } from "../ui";
import { accounts } from "../data";

export function RotationModule() {
  const { push } = useNav();
  const items = [
    { id: "settings", label: "إعدادات التدوير",        desc: "وضع وشرط التبديل",   icon: Settings   },
    { id: "table",    label: "عرض جدول التدوير",       desc: "الترتيب الحالي",     icon: ListChecks },
    { id: "edit",     label: "تعديل ترتيب الحسابات",   desc: "إعادة ترتيب",        icon: Edit3      },
    { id: "usage",    label: "الاستهلاك اليومي",        desc: "إحصائيات اليوم",     icon: BarChart3  },
    { id: "reset",    label: "تصفير العدادات",          desc: "تصفير يومي",         icon: Eraser     },
  ];
  return (
    <div className="animate-fade">
      <PageHeader title="نظام التدوير" subtitle="إدارة تدوير الحسابات" icon={<RefreshCw className="h-5 w-5" />} />
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

export function RotationScreen({ sub }: { sub: string }) {
  switch (sub) {
    case "settings": return <RotationSettings />;
    case "table":    return <RotationTable />;
    case "edit":     return <EditOrder />;
    case "usage":    return <DailyUsage />;
    case "reset":    return <ResetCounters />;
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
          </div>
        </div>
        <div className="card p-5">
          <SectionTitle>شرط التبديل</SectionTitle>
          <div className="space-y-2">
            <OptionButton label="بعد عدد محدد"          selected={condition === "count"} onClick={() => setCondition("count")} />
            <OptionButton label="بعد وقت محدد"          selected={condition === "time"}  onClick={() => setCondition("time")} />
            <OptionButton label="بعد أول خطأ/تحذير"     selected={condition === "error"} onClick={() => setCondition("error")} />
            <OptionButton label="مختلط (عمليات + وقت)"  selected={condition === "mixed"} onClick={() => setCondition("mixed")} />
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
          </div>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button variant="primary" className="flex-1" onClick={() => { show("تم حفظ الإعدادات"); push(["rotation"]); }}>حفظ الإعدادات</Button>
        <Button onClick={() => push(["rotation"])}>إلغاء</Button>
      </div>
      {node}
    </div>
  );
}

function RotationTable() {
  const { push } = useNav();
  return (
    <div className="animate-fade">
      <PageHeader title="جدول التدوير الحالي" icon={<ListChecks className="h-5 w-5" />} />
      <Table columns={["#","حساب","وضع","التالي"]}
        rows={accounts.slice(0,5).map((a,i) => [i+1, a.phone, <span className="chip bg-brand-50 text-brand-700 ring-1 ring-brand-200">نشط</span>, i < 4 ? accounts[i+1].phone : accounts[0].phone])} />
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
        <div className="flex gap-2">
          <Button variant="primary" className="flex-1" onClick={() => { show("تم حفظ الترتيب"); push(["rotation"]); }}>حفظ الترتيب</Button>
          <Button onClick={() => push(["rotation"])}>إلغاء</Button>
        </div>
      </div>
      {node}
    </div>
  );
}

function DailyUsage() {
  const { push } = useNav();
  return (
    <div className="animate-fade">
      <PageHeader title="الاستهلاك اليومي" icon={<BarChart3 className="h-5 w-5" />} />
      <Table columns={["حساب","تجميع","إضافة","رسائل","حالة"]}
        rows={accounts.slice(0,5).map((a) => [a.phone,"120","18","8",<span className="chip bg-brand-50 text-brand-700 ring-1 ring-brand-200">نشط</span>])} />
      <div className="mt-3 flex items-center justify-between rounded-xl bg-surface-50 border border-surface-200 px-4 py-3 text-sm">
        <span className="text-surface-500">إجمالي اليوم</span>
        <span className="font-bold text-surface-800">600 عملية | تصفير: 00:00</span>
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
          <Button variant="primary" className="flex-1" onClick={() => { show("تم التصفير"); push(["rotation"]); }}>تأكيد التصفير</Button>
          <Button onClick={() => push(["rotation"])}>إلغاء</Button>
        </div>
      </div>
      {node}
    </div>
  );
}
