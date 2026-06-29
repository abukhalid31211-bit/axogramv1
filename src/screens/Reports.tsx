import { useState } from "react";
import { BarChart3, FileText, FileBarChart, AlertTriangle, Upload, Calendar } from "lucide-react";
import { useNav } from "../nav";
import { PageHeader, Button, Table, SectionTitle, Alert, useToast, EmptyState, StatCard } from "../ui";
import { logs, addLogs, errorLogs } from "../data";

export function ReportsModule() {
  const { push } = useNav();
  const { show, node } = useToast();
  const items = [
    { id: "today", label: "تقرير اليوم", desc: "إحصائيات اليوم", icon: BarChart3 },
    { id: "week", label: "تقرير أسبوعي", desc: "7 أيام + رسم بياني", icon: Calendar },
    { id: "gather-log", label: "سجل التجميع", desc: "تاريخ التجميع", icon: FileText },
    { id: "add-log", label: "سجل الإضافة", desc: "تاريخ الإضافة", icon: FileBarChart },
    { id: "errors", label: "سجل الأخطاء", desc: "أخطاء وحلول", icon: AlertTriangle },
    { id: "export", label: "تصدير تقرير", desc: "PDF/TXT/CSV", icon: Upload },
  ];
  return (
    <div className="animate-fade">
      <PageHeader title="التقارير والسجلات" subtitle="تقارير العمليات" icon={<BarChart3 className="h-5 w-5" />} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <button key={it.id} onClick={() => push(["reports", it.id])} className="card flex items-center gap-3 p-4 text-right hover:border-brand-500/40 hover:shadow-glow">
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
      {node}
    </div>
  );
}

export function ReportsScreen({ sub }: { sub: string }) {
  switch (sub) {
    case "today": return <TodayReport />;
    case "week": return <WeekReport />;
    case "gather-log": return <GatherLog />;
    case "add-log": return <AddLog />;
    case "errors": return <ErrorLog />;
    case "export": return <ExportReport />;
    default: return null;
  }
}

function TodayReport() {
  const { push } = useNav();
  const { show, node } = useToast();
  return (
    <div className="animate-fade">
      <PageHeader title="تقرير اليوم" icon={<BarChart3 className="h-5 w-5" />} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="تجميع" value="3 عمليات" tone="accent" />
        <StatCard label="مستخرج" value="29,521" tone="brand" />
        <StatCard label="إضافة" value="13,500" tone="brand" />
        <StatCard label="فشل" value="635" tone="danger" />
      </div>
      <div className="mt-4 card p-5">
        <SectionTitle>الحماية</SectionTitle>
        <div className="grid gap-2 sm:grid-cols-4">
          <StatCard label="FloodWait" value="3" tone="warn" />
          <StatCard label="محظور" value="1" tone="danger" />
          <StatCard label="مقيد" value="2" tone="warn" />
          <StatCard label="تبديلات" value="5" tone="accent" />
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button variant="primary" icon={<Upload className="h-4 w-4" />} onClick={() => show("تم تصدير PDF")}>تصدير</Button>
        <Button onClick={() => push(["reports"])}>رجوع</Button>
      </div>
      {node}
    </div>
  );
}

function WeekReport() {
  const { push } = useNav();
  const { show, node } = useToast();
  const days = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];
  const values = [40, 65, 50, 80, 70, 90, 60];
  return (
    <div className="animate-fade">
      <PageHeader title="تقرير أسبوعي" icon={<Calendar className="h-5 w-5" />} />
      <div className="card p-5">
        <SectionTitle>إحصائيات 7 أيام</SectionTitle>
        <div className="flex h-48 items-end justify-between gap-2">
          {days.map((d, i) => (
            <div key={d} className="flex flex-1 flex-col items-center gap-2">
              <div className="w-full rounded-t-lg bg-gradient-to-t from-brand-600 to-brand-400 transition-all" style={{ height: `${values[i] * 1.6}px` }} />
              <span className="text-xs text-slate-400">{d}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button variant="primary" icon={<Upload className="h-4 w-4" />} onClick={() => show("تم تصدير")}>تصدير</Button>
        <Button onClick={() => push(["reports"])}>رجوع</Button>
      </div>
      {node}
    </div>
  );
}

function GatherLog() {
  const { push } = useNav();
  return (
    <div className="animate-fade">
      <PageHeader title="سجل التجميع" icon={<FileText className="h-5 w-5" />} />
      <Table columns={["تاريخ", "مجموعة", "مستخرج", "ملف"]} rows={logs.map((l) => [l.date, l.group, l.extracted.toLocaleString(), l.file])} />
      <div className="mt-4"><Button onClick={() => push(["reports"])}>رجوع</Button></div>
    </div>
  );
}

function AddLog() {
  const { push } = useNav();
  return (
    <div className="animate-fade">
      <PageHeader title="سجل الإضافة" icon={<FileBarChart className="h-5 w-5" />} />
      <Table columns={["تاريخ", "ملف", "هدف", "ناجح", "فاشل"]} rows={addLogs.map((l) => [l.date, l.file, l.target, <span className="text-brand-300">{l.success.toLocaleString()}</span>, <span className="text-danger-400">{l.fail.toLocaleString()}</span>])} />
      <div className="mt-4"><Button onClick={() => push(["reports"])}>رجوع</Button></div>
    </div>
  );
}

function ErrorLog() {
  const { push } = useNav();
  return (
    <div className="animate-fade">
      <PageHeader title="سجل الأخطاء" icon={<AlertTriangle className="h-5 w-5" />} />
      <Table columns={["وقت", "خطأ", "حساب", "حل"]} rows={errorLogs.map((e) => [e.time, <span className="text-danger-400">{e.error}</span>, e.account, <span className="text-brand-300">{e.fix}</span>])} />
      <div className="mt-4"><Button onClick={() => push(["reports"])}>رجوع</Button></div>
    </div>
  );
}

function ExportReport() {
  const { push } = useNav();
  const { show, node } = useToast();
  return (
    <div className="animate-fade">
      <PageHeader title="تصدير تقرير" icon={<Upload className="h-5 w-5" />} />
      <div className="mx-auto max-w-lg card p-6 space-y-3">
        <Button variant="primary" className="w-full" onClick={() => show("تم تصدير PDF")}>PDF</Button>
        <Button className="w-full" onClick={() => show("تم تصدير TXT")}>TXT</Button>
        <Button className="w-full" onClick={() => show("تم تصدير CSV")}>CSV</Button>
        <Button onClick={() => push(["reports"])}>رجوع</Button>
      </div>
      {node}
    </div>
  );
}
