import { useEffect, useMemo, useState } from "react";
import { BarChart3, FileText, FileBarChart, AlertTriangle, Upload, Calendar, Download } from "lucide-react";
import { useNav } from "../nav";
import { PageHeader, Button, Table, SectionTitle, useToast, StatCard, Alert, Spinner, EmptyState } from "../ui";
import { apiFetch, type ActivityLogRecord, type DashboardSummary } from "../lib/api";

const menu = [
  { id: "today", label: "تقرير اليوم", desc: "إحصائيات مباشرة من السيرفر", icon: BarChart3 },
  { id: "week", label: "تقرير أسبوعي", desc: "ملخص آخر 7 أيام من السجلات", icon: Calendar },
  { id: "gather-log", label: "السجل العام", desc: "أحدث عمليات النظام", icon: FileText },
  { id: "add-log", label: "سجل الحسابات والبروكسي", desc: "create/update/delete", icon: FileBarChart },
  { id: "errors", label: "سجل التحذيرات", desc: "الأخطاء والتحذيرات", icon: AlertTriangle },
  { id: "export", label: "تصدير تقرير", desc: "CSV سريع من المتصفح", icon: Upload },
] as const;

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function ReportsModule() {
  const { push } = useNav();
  return (
    <div className="animate-fade">
      <PageHeader title="التقارير والسجلات" subtitle="قراءة مباشرة من الـ API والسجلات" icon={<BarChart3 className="h-5 w-5" />} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {menu.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => push(["reports", item.id])}
              className="card flex items-center gap-3 p-4 text-right transition hover:-translate-y-0.5 hover:border-accent-300 hover:shadow-pop"
            >
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent-50 text-accent-600 ring-1 ring-accent-200"><Icon className="h-5 w-5" /></div>
              <div><div className="text-sm font-bold text-surface-800">{item.label}</div><div className="text-xs text-surface-500">{item.desc}</div></div>
            </button>
          );
        })}
      </div>
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

function useDashboardAndLogs(limit = 100) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [logs, setLogs] = useState<ActivityLogRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      apiFetch<DashboardSummary>("/reports/dashboard"),
      apiFetch<ActivityLogRecord[]>(`/reports/activity?limit=${limit}`),
    ])
      .then(([summaryData, logsData]) => {
        if (!mounted) return;
        setSummary(summaryData);
        setLogs(logsData);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [limit]);

  return { summary, logs, loading };
}

function TodayReport() {
  const { push } = useNav();
  const { show, node } = useToast();
  const { summary, logs, loading } = useDashboardAndLogs(30);

  const infoCount = logs.filter((log) => log.level === "info").length;
  const warnCount = logs.filter((log) => log.level === "warn").length;
  const accountOps = logs.filter((log) => log.entity_type === "account").length;
  const proxyOps = logs.filter((log) => log.entity_type === "proxy").length;

  return (
    <div className="animate-fade">
      <PageHeader title="تقرير اليوم" icon={<BarChart3 className="h-5 w-5" />} />
      {loading || !summary ? <Spinner label="جاري تحميل التقرير..." /> : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="إجمالي الحسابات" value={summary.accounts_total} tone="accent" />
            <StatCard label="الحسابات النشطة" value={summary.accounts_active} tone="brand" />
            <StatCard label="إجمالي البروكسيات" value={summary.proxies_total} tone="brand" />
            <StatCard label="الحملات النشطة" value={summary.campaigns_active} tone="warn" />
          </div>
          <div className="mt-4 card p-5">
            <SectionTitle>الأنشطة المسجلة</SectionTitle>
            <div className="grid gap-2 sm:grid-cols-4">
              <StatCard label="سجلات info" value={infoCount} tone="accent" />
              <StatCard label="تحذيرات" value={warnCount} tone="danger" />
              <StatCard label="عمليات حسابات" value={accountOps} tone="brand" />
              <StatCard label="عمليات بروكسي" value={proxyOps} tone="warn" />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              variant="primary"
              icon={<Download className="h-4 w-4" />}
              onClick={() => {
                downloadCsv("today-report.csv", [
                  ["metric", "value"],
                  ["accounts_total", String(summary.accounts_total)],
                  ["accounts_active", String(summary.accounts_active)],
                  ["proxies_total", String(summary.proxies_total)],
                  ["proxies_active", String(summary.proxies_active)],
                  ["campaigns_total", String(summary.campaigns_total)],
                  ["campaigns_active", String(summary.campaigns_active)],
                ]);
                show("تم تصدير CSV");
              }}
            >
              تصدير
            </Button>
            <Button onClick={() => push(["reports"])}>رجوع</Button>
          </div>
        </>
      )}
      {node}
    </div>
  );
}

function WeekReport() {
  const { push } = useNav();
  const { show, node } = useToast();
  const { logs, loading } = useDashboardAndLogs(200);

  const days = useMemo(() => {
    const labels = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
    const counts = new Array(7).fill(0);
    logs.forEach((log) => {
      counts[new Date(log.created_at).getDay()] += 1;
    });
    return labels.map((label, index) => ({ label, value: counts[index] }));
  }, [logs]);

  return (
    <div className="animate-fade">
      <PageHeader title="تقرير أسبوعي" icon={<Calendar className="h-5 w-5" />} />
      {loading ? <Spinner label="جاري تجهيز الرسم..." /> : (
        <>
          <div className="card p-5">
            <SectionTitle>توزيع السجلات على أيام الأسبوع</SectionTitle>
            <div className="flex h-48 items-end justify-between gap-2">
              {days.map((day) => (
                <div key={day.label} className="flex flex-1 flex-col items-center gap-2">
                  <div className="w-full rounded-t-lg bg-gradient-to-t from-brand-600 to-brand-400 transition-all" style={{ height: `${Math.max(day.value * 14, 18)}px` }} />
                  <span className="text-xs text-surface-500">{day.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button variant="primary" icon={<Upload className="h-4 w-4" />} onClick={() => show("تم تجهيز التقرير الأسبوعي")}>تصدير</Button>
            <Button onClick={() => push(["reports"])}>رجوع</Button>
          </div>
        </>
      )}
      {node}
    </div>
  );
}

function GatherLog() {
  const { logs, loading } = useDashboardAndLogs(50);
  return (
    <div className="animate-fade">
      <PageHeader title="السجل العام" icon={<FileText className="h-5 w-5" />} />
      {loading ? <Spinner label="جاري تحميل السجل..." /> : logs.length === 0 ? (
        <EmptyState title="لا توجد سجلات" desc="ستظهر سجلات النظام هنا بعد أول عملية." />
      ) : (
        <Table columns={["التاريخ", "الإجراء", "النوع", "الرسالة"]} rows={logs.map((log) => [
          new Date(log.created_at).toLocaleString("ar-SA"),
          log.action,
          log.entity_type || log.level,
          log.message,
        ])} />
      )}
    </div>
  );
}

function AddLog() {
  const { logs, loading } = useDashboardAndLogs(100);
  const entityLogs = logs.filter((log) => log.entity_type === "account" || log.entity_type === "proxy" || log.entity_type === "settings");
  return (
    <div className="animate-fade">
      <PageHeader title="سجل الحسابات والبروكسي" icon={<FileBarChart className="h-5 w-5" />} />
      {loading ? <Spinner label="جاري تحميل السجل..." /> : entityLogs.length === 0 ? (
        <EmptyState title="لا توجد عمليات بعد" desc="أنشئ أو عدّل أو احذف حسابًا/بروكسيًا لتظهر السجلات هنا." />
      ) : (
        <Table columns={["التاريخ", "الكيان", "الإجراء", "الرسالة"]} rows={entityLogs.map((log) => [
          new Date(log.created_at).toLocaleString("ar-SA"),
          log.entity_type || "system",
          log.action,
          log.message,
        ])} />
      )}
    </div>
  );
}

function ErrorLog() {
  const { logs, loading } = useDashboardAndLogs(100);
  const errors = logs.filter((log) => log.level !== "info");
  return (
    <div className="animate-fade">
      <PageHeader title="سجل الأخطاء والتحذيرات" icon={<AlertTriangle className="h-5 w-5" />} />
      {loading ? <Spinner label="جاري تحميل التنبيهات..." /> : errors.length === 0 ? (
        <Alert tone="success" title="لا توجد أخطاء أو تحذيرات حالياً" />
      ) : (
        <Table columns={["الوقت", "المستوى", "الإجراء", "الرسالة"]} rows={errors.map((log) => [
          new Date(log.created_at).toLocaleString("ar-SA"),
          <span className={`chip ring-1 ${log.level === "warn" ? "bg-warn-50 text-warn-700 ring-warn-200" : "bg-danger-50 text-danger-700 ring-danger-200"}`}>{log.level}</span>,
          log.action,
          log.message,
        ])} />
      )}
    </div>
  );
}

function ExportReport() {
  const { show, node } = useToast();
  const { logs, loading } = useDashboardAndLogs(100);

  return (
    <div className="animate-fade">
      <PageHeader title="تصدير تقرير" icon={<Upload className="h-5 w-5" />} />
      <div className="mx-auto max-w-lg card p-6 space-y-3">
        {loading ? <Spinner label="جاري تجهيز البيانات..." /> : (
          <>
            <Button variant="primary" className="w-full" onClick={() => {
              downloadCsv("system-logs.csv", [["time", "level", "action", "entity_type", "message"], ...logs.map((log) => [log.created_at, log.level, log.action, log.entity_type || "", log.message])]);
              show("تم تصدير CSV");
            }}>CSV</Button>
            <Button className="w-full" onClick={() => {
              const blob = new Blob([JSON.stringify(logs, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = "system-logs.json";
              link.click();
              URL.revokeObjectURL(url);
              show("تم تصدير JSON");
            }}>JSON</Button>
            <Button className="w-full" onClick={() => show("تصدير PDF يتطلب محرك PDF لاحقاً من السيرفر أو المتصفح")}>PDF (لاحقاً)</Button>
          </>
        )}
      </div>
      {node}
    </div>
  );
}
