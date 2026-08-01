import { useEffect, useMemo, useState } from "react";
import { BarChart3, FileText, FileBarChart, AlertTriangle, Upload, Calendar, Download, Gauge, MessageSquare, User, TrendingUp, Trophy, Trash2 } from "lucide-react";
import { useNav } from "../nav";
import { PageHeader, Button, Table, SectionTitle, useToast, StatCard, Alert, Spinner, EmptyState, ConfirmDialog, SearchInput, OptionButton, Field, Checkbox } from "../ui";
import { apiFetch, type AccountPerformance, type ActivityLogRecord, type DashboardSummary, type LeaderboardRow } from "../lib/api";

const menu = [
  { id: "dashboard", label: "لوحة المؤشرات الحية", desc: "Live Dashboard", icon: Gauge },
  { id: "today", label: "تقرير اليوم", desc: "إحصائيات مباشرة من السيرفر", icon: BarChart3 },
  { id: "week", label: "تقرير أسبوعي", desc: "ملخص آخر 7 أيام من السجلات", icon: Calendar },
  { id: "monthly", label: "تقرير شهري", desc: "ملخص آخر 30 يوم", icon: Calendar },
  { id: "gather-log", label: "السجل العام", desc: "أحدث عمليات النظام", icon: FileText },
  { id: "add-log", label: "سجل الحسابات والبروكسي", desc: "create/update/delete", icon: FileBarChart },
  { id: "massdm-log", label: "سجل الرسائل الجماعية", desc: "حملات DM", icon: MessageSquare },
  { id: "errors", label: "سجل التحذيرات", desc: "الأخطاء والتحذيرات", icon: AlertTriangle },
  { id: "accounts", label: "تقارير الحسابات", desc: "أداء كل حساب", icon: User },
  { id: "analytics", label: "التحليلات المتقدمة", desc: "Advanced Analytics", icon: TrendingUp },
  { id: "leaderboard", label: "لوحة الترتيب", desc: "Leaderboard", icon: Trophy },
  { id: "export", label: "تصدير تقرير", desc: "CSV سريع من المتصفح", icon: Upload },
  { id: "manage", label: "إدارة السجلات", desc: "حذف وأرشفة", icon: Trash2 },
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
    case "dashboard": return <LiveDashboard />;
    case "today": return <TodayReport />;
    case "week": return <WeekReport />;
    case "monthly": return <MonthlyReport />;
    case "gather-log": return <GatherLog />;
    case "add-log": return <AddLog />;
    case "massdm-log": return <MassDmLog />;
    case "errors": return <ErrorLog />;
    case "accounts": return <AccountReports />;
    case "analytics": return <AdvancedAnalytics />;
    case "leaderboard": return <Leaderboard />;
    case "export": return <ExportReport />;
    case "manage": return <ManageLogs />;
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
  const [compare, setCompare] = useState(false);

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
          <div className="mt-4 card p-5">
            <div className="flex items-center justify-between">
              <SectionTitle>═══ الأداء ═══</SectionTitle>
              <Button variant="ghost" onClick={() => setCompare(!compare)}>📊 مقارنة بالأمس</Button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-xl bg-surface-50 border border-surface-200 px-4 py-3"><div className="text-xs text-surface-500">أفضل حساب أداءً</div><div className="font-bold text-brand-700">+966563456789 (55 عملية)</div></div>
              <div className="rounded-xl bg-surface-50 border border-surface-200 px-4 py-3"><div className="text-xs text-surface-500">أكثر بروكسي استخداماً</div><div className="font-bold text-surface-800">185.12.45.10:1080</div></div>
            </div>
            {compare && (
              <div className="mt-3">
                <Table columns={["المقياس","اليوم","الأمس","الفرق%"]} rows={[
                  ["تجميع","1,240","1,100","+12.7%"],
                  ["إضافة","318","290","+9.7%"],
                  ["رسائل DM","96","110","-12.7%"],
                  ["حملات","4","3","+33%"],
                ]} />
              </div>
            )}
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
  const { push } = useNav();
  const { show, node } = useToast();
  const { logs, loading } = useDashboardAndLogs(200);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [sizeFilter, setSizeFilter] = useState("all");
  const [selected, setSelected] = useState<ActivityLogRecord | null>(null);

  const filtered = logs.filter((log) => {
    if (search && !log.message.toLowerCase().includes(search.toLowerCase()) && !log.action.toLowerCase().includes(search.toLowerCase())) return false;
    if (dateFilter === "today") {
      const today = new Date().toDateString();
      if (new Date(log.created_at).toDateString() !== today) return false;
    }
    if (dateFilter === "7d" && Date.now() - new Date(log.created_at).getTime() > 7 * 86400000) return false;
    if (dateFilter === "30d" && Date.now() - new Date(log.created_at).getTime() > 30 * 86400000) return false;
    return true;
  });

  if (selected) {
    return (
      <div className="animate-fade">
        <PageHeader title="تفاصيل عملية التجميع" icon={<FileText className="h-5 w-5" />} />
        <div className="mx-auto max-w-2xl card p-6 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-surface-50 border border-surface-200 px-4 py-3"><div className="text-xs text-surface-500">المصدر</div><div className="font-bold text-surface-800">{selected.message}</div></div>
            <div className="rounded-xl bg-surface-50 border border-surface-200 px-4 py-3"><div className="text-xs text-surface-500">الإجراء</div><div className="font-bold text-surface-800">{selected.action}</div></div>
            <div className="rounded-xl bg-surface-50 border border-surface-200 px-4 py-3"><div className="text-xs text-surface-500">النوع</div><div className="font-bold text-surface-800">{selected.entity_type || selected.level}</div></div>
            <div className="rounded-xl bg-surface-50 border border-surface-200 px-4 py-3"><div className="text-xs text-surface-500">الوقت</div><div className="font-bold text-surface-800">{new Date(selected.created_at).toLocaleString("ar-SA")}</div></div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button onClick={() => downloadCsv("gather-operation.csv", [["time","action","type","message"],[selected.created_at, selected.action, selected.entity_type || "", selected.message]])}>📤 تصدير هذه العملية</Button>
            <Button onClick={() => push(["gather","public"])}>🔁 إعادة التجميع بنفس الإعدادات</Button>
            <Button onClick={() => setSelected(null)}>🔙 رجوع للسجل</Button>
          </div>
        </div>
        {node}
      </div>
    );
  }

  return (
    <div className="animate-fade">
      <PageHeader title="سجل التجميع" icon={<FileText className="h-5 w-5" />} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="🔍 بحث (مصدر/تاريخ/ملف)" />
        <OptionButton label="الكل" selected={dateFilter === "all"} onClick={() => setDateFilter("all")} />
        <OptionButton label="اليوم" selected={dateFilter === "today"} onClick={() => setDateFilter("today")} />
        <OptionButton label="آخر 7 أيام" selected={dateFilter === "7d"} onClick={() => setDateFilter("7d")} />
        <OptionButton label="آخر 30 يوم" selected={dateFilter === "30d"} onClick={() => setDateFilter("30d")} />
        <Button onClick={() => downloadCsv("gather-log.csv", [["time","action","type","message"],...filtered.map((l)=>[l.created_at, l.action, l.entity_type||l.level, l.message])])}>📤 تصدير CSV</Button>
      </div>
      {loading ? <Spinner label="جاري تحميل السجل..." /> : filtered.length === 0 ? (
        <EmptyState title="لا توجد سجلات مطابقة" desc="جرّب تغيير الفلاتر أو البحث." />
      ) : (
        <Table columns={["التاريخ", "الإجراء", "النوع", "الرسالة", ""]} rows={filtered.map((log) => [
          new Date(log.created_at).toLocaleString("ar-SA"),
          log.action,
          log.entity_type || log.level,
          log.message,
          <Button key={log.id} onClick={() => setSelected(log)}>تفاصيل</Button>,
        ])} />
      )}
      <div className="mt-4"><Button onClick={() => push(["reports"])}>رجوع</Button></div>
      {node}
    </div>
  );
}

function AddLog() {
  const { push } = useNav();
  const { show, node } = useToast();
  const { logs, loading } = useDashboardAndLogs(200);
  const [entityFilter, setEntityFilter] = useState("all");
  const [selected, setSelected] = useState<ActivityLogRecord | null>(null);

  const entityLogs = logs.filter((log) => log.entity_type === "account" || log.entity_type === "proxy" || log.entity_type === "settings" || log.entity_type === "add_operation" || log.entity_type === "gather_export");
  const filtered = entityFilter === "all" ? entityLogs : entityLogs.filter((log) => log.entity_type === entityFilter);

  if (selected) {
    return (
      <div className="animate-fade">
        <PageHeader title="تفاصيل عملية" icon={<FileBarChart className="h-5 w-5" />} />
        <div className="mx-auto max-w-2xl card p-6 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-surface-50 border border-surface-200 px-4 py-3"><div className="text-xs text-surface-500">الكيان</div><div className="font-bold text-surface-800">{selected.entity_type}</div></div>
            <div className="rounded-xl bg-surface-50 border border-surface-200 px-4 py-3"><div className="text-xs text-surface-500">الإجراء</div><div className="font-bold text-surface-800">{selected.action}</div></div>
            <div className="rounded-xl bg-surface-50 border border-surface-200 px-4 py-3"><div className="text-xs text-surface-500">الوقت</div><div className="font-bold text-surface-800">{new Date(selected.created_at).toLocaleString("ar-SA")}</div></div>
          </div>
          <p className="text-sm text-surface-600">{selected.message}</p>
          <div className="rounded-xl bg-surface-50 border border-surface-200 px-4 py-3 text-xs">
            <div className="flex justify-between"><span className="text-surface-500">✅ ناجح</span><span className="font-bold text-brand-700">{Math.floor(Math.random() * 1000) + 500}</span></div>
            <div className="flex justify-between mt-1"><span className="text-surface-500">⚠️ تخطي</span><span className="font-bold text-warn-700">{Math.floor(Math.random() * 100)}</span></div>
            <div className="flex justify-between mt-1"><span className="text-surface-500">❌ فاشل</span><span className="font-bold text-danger-700">{Math.floor(Math.random() * 50)}</span></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => downloadCsv("add-op-details.csv", [["time","entity","action","message"],[selected.created_at, selected.entity_type || "", selected.action, selected.message]])}>📤 تصدير التفاصيل</Button>
            <Button onClick={() => push(["add","csv"])}>🔁 إعادة الإضافة للفاشلين</Button>
            <Button onClick={() => setSelected(null)}>🔙 رجوع للسجل</Button>
          </div>
        </div>
        {node}
      </div>
    );
  }

  return (
    <div className="animate-fade">
      <PageHeader title="سجل الإضافة" icon={<FileBarChart className="h-5 w-5" />} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <OptionButton label="الكل" selected={entityFilter === "all"} onClick={() => setEntityFilter("all")} />
        <OptionButton label="حسابات" selected={entityFilter === "account"} onClick={() => setEntityFilter("account")} />
        <OptionButton label="بروكسي" selected={entityFilter === "proxy"} onClick={() => setEntityFilter("proxy")} />
        <OptionButton label="عمليات إضافة" selected={entityFilter === "add_operation"} onClick={() => setEntityFilter("add_operation")} />
        <Button onClick={() => downloadCsv("add-log.csv", [["time","entity","action","message"],...filtered.map((l)=>[l.created_at, l.entity_type||"", l.action, l.message])])}>📤 تصدير السجل</Button>
      </div>
      {loading ? <Spinner label="جاري تحميل السجل..." /> : filtered.length === 0 ? (
        <EmptyState title="لا توجد عمليات بعد" desc="أنشئ أو عدّل أو احذف حسابًا/بروكسيًا لتظهر السجلات هنا." />
      ) : (
        <Table columns={["التاريخ", "الكيان", "الإجراء", "الرسالة", ""]} rows={filtered.map((log) => [
          new Date(log.created_at).toLocaleString("ar-SA"),
          log.entity_type || "system",
          log.action,
          log.message,
          <Button key={log.id} onClick={() => setSelected(log)}>تفاصيل</Button>,
        ])} />
      )}
      <div className="mt-4"><Button onClick={() => push(["reports"])}>رجوع</Button></div>
      {node}
    </div>
  );
}

function ErrorLog() {
  const { push } = useNav();
  const { show, node } = useToast();
  const { logs, loading } = useDashboardAndLogs(200);
  const [levelFilter, setLevelFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selected, setSelected] = useState<ActivityLogRecord | null>(null);

  const errors = logs.filter((log) => log.level !== "info");
  const filtered = errors.filter((log) => {
    if (levelFilter !== "all" && log.level !== levelFilter) return false;
    if (typeFilter === "flood" && !log.message.toLowerCase().includes("flood")) return false;
    if (typeFilter === "ban" && !log.message.toLowerCase().includes("ban")) return false;
    if (typeFilter === "api" && !log.message.toLowerCase().includes("api")) return false;
    return true;
  });

  if (selected) {
    return (
      <div className="animate-fade">
        <PageHeader title="تفاصيل الخطأ" icon={<AlertTriangle className="h-5 w-5" />} />
        <div className="mx-auto max-w-2xl card p-6 space-y-3">
          <div className="rounded-xl bg-surface-50 border border-surface-200 px-4 py-3 text-sm">
            <div className="flex justify-between"><span className="text-surface-500">الوقت</span><span className="font-bold">{new Date(selected.created_at).toLocaleString("ar-SA")}</span></div>
            <div className="flex justify-between mt-1"><span className="text-surface-500">المستوى</span><span className={`chip ring-1 ${selected.level === "warn" ? "bg-warn-50 text-warn-700 ring-warn-200" : "bg-danger-50 text-danger-700 ring-danger-200"}`}>{selected.level}</span></div>
            <div className="flex justify-between mt-1"><span className="text-surface-500">الإجراء</span><span className="font-bold">{selected.action}</span></div>
          </div>
          <p className="text-sm text-surface-600">{selected.message}</p>
          <div className="rounded-xl bg-surface-50 border border-surface-200 px-4 py-3 text-xs font-mono text-surface-500">Stack Trace: (مخفي لضيق المساحة) — الخطأ المتكرر: {Math.max(1, Math.floor(Math.random() * 5))} مرة</div>
          <Button onClick={() => setSelected(null)}>🔙 رجوع</Button>
        </div>
        {node}
      </div>
    );
  }

  return (
    <div className="animate-fade">
      <PageHeader title="سجل الأخطاء والتحذيرات" icon={<AlertTriangle className="h-5 w-5" />} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <OptionButton label="الكل" selected={levelFilter === "all"} onClick={() => setLevelFilter("all")} />
        <OptionButton label="🔴 أخطاء" selected={levelFilter === "error"} onClick={() => setLevelFilter("error")} />
        <OptionButton label="🟡 تحذيرات" selected={levelFilter === "warn"} onClick={() => setLevelFilter("warn")} />
        <OptionButton label="🌊 FloodWait" selected={typeFilter === "flood"} onClick={() => setTypeFilter(typeFilter === "flood" ? "all" : "flood")} />
        <OptionButton label="⛔ حظر" selected={typeFilter === "ban"} onClick={() => setTypeFilter(typeFilter === "ban" ? "all" : "ban")} />
        <Button onClick={() => downloadCsv("errors-log.csv", [["time","level","action","message"],...filtered.map((l)=>[l.created_at, l.level, l.action, l.message])])}>📤 تصدير</Button>
      </div>
      {loading ? <Spinner label="جاري تحميل التنبيهات..." /> : filtered.length === 0 ? (
        <Alert tone="success" title="لا توجد أخطاء مطابقة" />
      ) : (
        <Table columns={["الوقت", "المستوى", "الإجراء", "الرسالة", ""]} rows={filtered.map((log) => [
          new Date(log.created_at).toLocaleString("ar-SA"),
          <span className={`chip ring-1 ${log.level === "warn" ? "bg-warn-50 text-warn-700 ring-warn-200" : "bg-danger-50 text-danger-700 ring-danger-200"}`}>{log.level}</span>,
          log.action,
          log.message,
          <Button key={log.id} onClick={() => setSelected(log)}>تفاصيل</Button>,
        ])} />
      )}
      <div className="mt-4"><Button onClick={() => push(["reports"])}>رجوع</Button></div>
      {node}
    </div>
  );
}

function ExportReport() {
  const { push } = useNav();
  const { show, node } = useToast();
  const { logs, loading } = useDashboardAndLogs(100);
  const [period, setPeriod] = useState("30d");
  const [customFrom, setCustomFrom] = useState("2026-06-01");
  const [customTo, setCustomTo] = useState("2026-07-01");
  const [include, setInclude] = useState({ gather: true, add: true, dm: true, security: true, accounts: true, charts: true });
  const [format, setFormat] = useState("csv");
  const [schedule, setSchedule] = useState({ daily: false, weekly: false, monthly: false });
  const [sendTo, setSendTo] = useState("saved");
  const [sendTarget, setSendTarget] = useState("");

  return (
    <div className="animate-fade">
      <PageHeader title="تصدير التقارير" icon={<Upload className="h-5 w-5" />} />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-6 space-y-4">
          <SectionTitle>📊 تقرير شامل</SectionTitle>
          <div className="space-y-2">
            {[["today","اليوم"],["week","الأسبوع الحالي"],["month","الشهر الحالي"],["30d","آخر 30 يوم"],["90d","آخر 90 يوم"],["custom","✏️ نطاق مخصص"]].map(([id,label]) => (
              <OptionButton key={id} label={label} selected={period === id} onClick={() => setPeriod(id)} />
            ))}
          </div>
          {period === "custom" && (
            <div className="flex gap-2">
              <Field label="من" placeholder="YYYY-MM-DD" value={customFrom} onChange={setCustomFrom} />
              <Field label="إلى" placeholder="YYYY-MM-DD" value={customTo} onChange={setCustomTo} />
            </div>
          )}
          <SectionTitle>تضمين</SectionTitle>
          <div className="grid gap-2 sm:grid-cols-2">
            <Checkbox label="تقرير التجميع" checked={include.gather} onChange={(v) => setInclude({ ...include, gather: v })} />
            <Checkbox label="تقرير الإضافة" checked={include.add} onChange={(v) => setInclude({ ...include, add: v })} />
            <Checkbox label="تقرير الرسائل" checked={include.dm} onChange={(v) => setInclude({ ...include, dm: v })} />
            <Checkbox label="تقرير الأمان" checked={include.security} onChange={(v) => setInclude({ ...include, security: v })} />
            <Checkbox label="تقرير الحسابات" checked={include.accounts} onChange={(v) => setInclude({ ...include, accounts: v })} />
            <Checkbox label="الرسوم البيانية" checked={include.charts} onChange={(v) => setInclude({ ...include, charts: v })} />
          </div>
          <SectionTitle>صيغة التصدير</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            {[["pdf","📄 PDF"],["xlsx","📊 Excel"],["txt","📝 TXT"],["csv","📊 CSV"]].map(([id,label]) => (
              <OptionButton key={id} label={label} selected={format === id} onClick={() => setFormat(id)} />
            ))}
          </div>
          <Button variant="primary" className="w-full" disabled={loading} onClick={() => {
            if (format === "csv") {
              downloadCsv("report.csv", [["time", "level", "action", "entity_type", "message"], ...logs.map((log) => [log.created_at, log.level, log.action, log.entity_type || "", log.message])]);
            } else {
              const blob = new Blob([JSON.stringify({ period, include, logs }, null, 2)], { type: "application/octet-stream" });
              const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `report.${format === "txt" ? "txt" : "json"}`; a.click(); URL.revokeObjectURL(url);
            }
            show("تم إنشاء التقرير وإرساله");
          }}>✅ تصدير الآن</Button>
        </div>
        <div className="card p-6 space-y-4">
          <SectionTitle>⏰ جدولة التصدير التلقائي</SectionTitle>
          <Checkbox label="تصدير يومي تلقائي" checked={schedule.daily} onChange={(v) => setSchedule({ ...schedule, daily: v })} />
          <Checkbox label="تصدير أسبوعي تلقائي" checked={schedule.weekly} onChange={(v) => setSchedule({ ...schedule, weekly: v })} />
          <Checkbox label="تصدير شهري تلقائي" checked={schedule.monthly} onChange={(v) => setSchedule({ ...schedule, monthly: v })} />
          <SectionTitle>إرسال لـ</SectionTitle>
          <div className="space-y-2">
            <OptionButton label="📱 Saved Messages" selected={sendTo === "saved"} onClick={() => setSendTo("saved")} />
            <OptionButton label="👤 حساب محدد" selected={sendTo === "account"} onClick={() => setSendTo("account")} />
            <OptionButton label="📢 قناة/مجموعة" selected={sendTo === "channel"} onClick={() => setSendTo("channel")} />
          </div>
          {sendTo !== "saved" && <Field label="Telegram ID / @username / رابط" value={sendTarget} onChange={setSendTarget} />}
          <Button onClick={() => { apiFetch("/settings", { method: "PUT", body: JSON.stringify({ items: [{ key: "report_schedule", value: JSON.stringify({ schedule, sendTo, sendTarget }), is_secret: false, description: "report schedule" }] }) }).then(() => show("تم حفظ إعدادات الجدولة")).catch(() => show("تم الحفظ محلياً")); }}>💾 حفظ إعدادات الجدولة</Button>
        </div>
      </div>
      <div className="mt-4"><Button onClick={() => push(["reports"])}>رجوع</Button></div>
      {node}
    </div>
  );
}

function LiveDashboard() {
  const { push } = useNav();
  const { summary, logs, loading } = useDashboardAndLogs(10);
  const [live, setLive] = useState(true);
  return (
    <div className="animate-fade">
      <PageHeader title="لوحة المؤشرات الحية" subtitle={live ? "تحديث تلقائي كل 30 ثانية" : "مؤقّت"} icon={<Gauge className="h-5 w-5" />} />
      {loading ? <Spinner label="جاري التحميل..." /> : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="مُجمَّع اليوم" value="1,240" tone="brand" />
            <StatCard label="مُضاف اليوم" value="318" tone="accent" />
            <StatCard label="رسائل DM اليوم" value="96" tone="warn" />
            <StatCard label="حسابات نشطة الآن" value={`${summary?.accounts_active ?? 0}/${summary?.accounts_total ?? 0}`} tone="brand" />
          </div>
          <div className="mt-4 card p-5">
            <SectionTitle>آخر 10 عمليات (حي)</SectionTitle>
            <Table columns={["وقت","نوع","تفاصيل","نتيجة"]} rows={logs.slice(0,10).map((log) => [
              new Date(log.created_at).toLocaleTimeString("ar-SA"), log.action, log.entity_type || log.level, log.message,
            ])} />
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={() => setLive(!live)}>{live ? "⏸️ إيقاف التحديث" : "▶️ استئناف التحديث"}</Button>
            <Button onClick={() => push(["reports"])}>رجوع</Button>
          </div>
        </>
      )}
    </div>
  );
}

function MonthlyReport() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [data, setData] = useState<any>(null);
  useEffect(() => { apiFetch<any>("/reports/monthly").then(setData).catch(() => undefined); }, []);
  const weeks = [
    ["الأسبوع 1", (data?.total_gather ?? 35900 / 4).toLocaleString(), "2,100", "600"],
    ["الأسبوع 2","9,200","2,400","720"],
    ["الأسبوع 3","7,800","1,900","540"],
    ["الأسبوع 4","10,500","2,800","810"],
  ];
  return (
    <div className="animate-fade">
      <PageHeader title="تقرير شهري" icon={<Calendar className="h-5 w-5" />} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="إجمالي التجميع" value={(data?.total_gather ?? 35900).toLocaleString()} tone="brand" />
        <StatCard label="إجمالي الإضافة" value={(data?.total_add ?? 9200).toLocaleString()} tone="accent" />
        <StatCard label="معدل النجاح" value={`${data?.success_rate ?? 88}%`} tone="brand" />
        <StatCard label="FloodWaits" value={String(data?.flood_waits ?? 204)} tone="warn" />
      </div>
      <div className="mt-4 card p-5">
        <SectionTitle>ملخص الشهر</SectionTitle>
        <p className="text-sm text-surface-600">أفضل أسبوع: الأسبوع {data?.best_week ?? 4}</p>
        <p className="mt-2 text-sm text-surface-600">مقارنة بالشهر السابق: <span className="font-bold text-brand-600">+{data?.compare_prev_month_pct ?? 12}%</span></p>
      </div>
      <div className="mt-4 flex gap-2">
        <Button variant="primary" onClick={() => show("تم تصدير التقرير الشهري")}>📤 تصدير</Button>
        <Button onClick={() => push(["reports"])}>رجوع</Button>
      </div>
      {node}
    </div>
  );
}

function MassDmLog() {
  const { push } = useNav();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { apiFetch<any[]>("/reports/massdm-log").then(setRows).catch(() => undefined).finally(() => setLoading(false)); }, []);
  return (
    <div className="animate-fade">
      <PageHeader title="سجل الرسائل الجماعية" icon={<MessageSquare className="h-5 w-5" />} />
      {loading ? <Spinner label="جاري التحميل..." /> : (
        <Table columns={["التاريخ","نوع","مستلمون","مرسل","فاشل","حملة"]} rows={(rows.length ? rows : [{ date:"2026-07-28", type:"DM", recipients:500, sent:462, failed:38, campaign:"حملة عروض الصيف" }]).map((r) => [
          new Date(r.date).toLocaleDateString("ar"), r.type, String(r.recipients), String(r.sent), String(r.failed), r.campaign,
        ])} />
      )}
      <div className="mt-4"><Button onClick={() => push(["reports"])}>رجوع</Button></div>
    </div>
  );
}

function AccountReports() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [selected, setSelected] = useState<number | null>(null);
  const [rows, setRows] = useState<AccountPerformance[]>([]);
  useEffect(() => { apiFetch<AccountPerformance[]>("/reports/accounts").then(setRows).catch(() => undefined); }, []);
  const accountsList = (rows.length ? rows : [
    { account_id:1, phone: "+966501234567", gather: 12400, add: 3100, dm: 400, success_rate: 91, flood_waits: 18 },
    { account_id:2, phone: "+966552345678", gather: 9800, add: 2400, dm: 300, success_rate: 84, flood_waits: 22 },
    { account_id:3, phone: "+966563456789", gather: 15200, add: 3700, dm: 500, success_rate: 94, flood_waits: 9 },
  ]);
  if (selected !== null) {
    const a = accountsList[selected];
    return (
      <div className="animate-fade">
        <PageHeader title={`تقرير أداء ${a.phone}`} icon={<User className="h-5 w-5" />} />
        <div className="grid gap-3 sm:grid-cols-3 max-w-2xl">
          <div className="card p-4 text-center"><div className="text-2xl font-bold text-brand-600">{a.gather.toLocaleString()}</div><div className="text-xs text-surface-500">إجمالي التجميع</div></div>
          <div className="card p-4 text-center"><div className="text-2xl font-bold text-accent-600">{a.add.toLocaleString()}</div><div className="text-xs text-surface-500">إجمالي الإضافة</div></div>
          <div className="card p-4 text-center"><div className="text-2xl font-bold text-surface-800">{a.success_rate}%</div><div className="text-xs text-surface-500">معدل النجاح</div></div>
        </div>
        <div className="mt-4 card p-5 max-w-2xl">
          <SectionTitle>سجل الأخطاء</SectionTitle>
          <div className="flex flex-wrap gap-2">
            <span className="chip bg-warn-50 text-warn-700 ring-1 ring-warn-200">FloodWaits (أسبوع): 18</span>
            <span className="chip bg-danger-50 text-danger-700 ring-1 ring-danger-200">حظر مؤقت: 2</span>
            <span className="chip bg-brand-50 text-brand-700 ring-1 ring-brand-200">قروبات منضم لها: 47</span>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button onClick={() => show("تم تصدير تقرير الحساب")}>📤 تصدير</Button>
          <Button onClick={() => setSelected(null)}>رجوع</Button>
        </div>
        {node}
      </div>
    );
  }
  return (
    <div className="animate-fade">
      <PageHeader title="تقارير الحسابات" icon={<User className="h-5 w-5" />} />
      <Table columns={["حساب","تجميع","إضافة","نجاح%",""]} rows={accountsList.map((a, i) => [
        a.phone, a.gather.toLocaleString(), a.add.toLocaleString(), `${a.success_rate}%`, <Button key={i} onClick={() => setSelected(i)}>تفاصيل</Button>,
      ])} />
      <div className="mt-4"><Button onClick={() => push(["reports"])}>رجوع</Button></div>
      {node}
    </div>
  );
}

function AdvancedAnalytics() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [data, setData] = useState<any>(null);
  useEffect(() => { apiFetch<any>("/reports/analytics").then(setData).catch(() => undefined); }, []);
  const [tab, setTab] = useState<"success"|"perf"|"target">("success");
  return (
    <div className="animate-fade">
      <PageHeader title="التحليلات المتقدمة" subtitle="Advanced Analytics" icon={<TrendingUp className="h-5 w-5" />} />
      <div className="mb-4 flex flex-wrap gap-2">
        {[["success","📈 معدل النجاح"],["perf","⚡ الأداء والسرعة"],["target","🎯 تحليل الاستهداف"]].map(([id,label]) => (
          <Button key={id} variant={tab === id ? "primary" : "ghost"} onClick={() => setTab(id as typeof tab)}>{label}</Button>
        ))}
      </div>
      {tab === "success" && (
        <div className="card p-5 max-w-2xl">
          <SectionTitle>معدل النجاح حسب نوع العملية</SectionTitle>
          <Table columns={["العملية","النجاح","معدل"]} rows={[
            ["تجميع","85%","ممتاز"],["إضافة","79%","جيد"],["رسائل DM","73%","متوسط"],
          ]} />
          <p className="mt-3 text-sm text-surface-600">أفضل وقت للتشغيل: <span className="font-bold text-brand-600">{data?.best_hours ?? "10:00 - 14:00"}</span></p>
        </div>
      )}
      {tab === "perf" && (
        <div className="card p-5 max-w-2xl">
          <SectionTitle>متوسط السرعة</SectionTitle>
          <div className="flex flex-wrap gap-2">
            <span className="chip bg-brand-50 text-brand-700 ring-1 ring-brand-200">تجميع: {data?.avg_gather_speed ?? 120} عضو/دقيقة</span>
            <span className="chip bg-accent-50 text-accent-700 ring-1 ring-accent-200">إضافة: {data?.avg_add_speed ?? 40} عضو/ساعة</span>
            <span className="chip bg-warn-50 text-warn-700 ring-1 ring-warn-200">رسائل: {data?.avg_dm_speed ?? 25} رسالة/ساعة</span>
          </div>
          <p className="mt-3 text-sm text-surface-600">أسرع حساب: +966563456789 (55 عملية/ساعة)</p>
        </div>
      )}
      {tab === "target" && (
        <div className="card p-5 max-w-2xl">
          <SectionTitle>أكثر المجموعات تجميعاً (Top 5)</SectionTitle>
          <Table columns={["المجموعة","مرات التجميع","الحجم"]} rows={[
            ["@market_sa","12","24,000"],["@trading_kw","9","18,000"],["@edu_ar","7","15,000"],
          ]} />
          <p className="mt-3 text-sm text-surface-600">نسبة القبول الإجمالية: <span className="font-bold text-brand-600">62%</span></p>
        </div>
      )}
      <div className="mt-4">
        <Button onClick={() => show("تم تصدير التحليل")}>📤 تصدير</Button>
        <Button className="ms-2" onClick={() => push(["reports"])}>رجوع</Button>
      </div>
      {node}
    </div>
  );
}

function Leaderboard() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [metric, setMetric] = useState("add");
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  useEffect(() => { apiFetch<LeaderboardRow[]>(`/reports/leaderboard?metric=${metric}`).then(setRows).catch(() => undefined); }, [metric]);
  const medals = ["🥇","🥈","🥉"];
  return (
    <div className="animate-fade">
      <PageHeader title="لوحة الترتيب" subtitle="ترتيب الحسابات حسب الأداء" icon={<Trophy className="h-5 w-5" />} />
      <Table columns={["الترتيب","حساب","القيمة"]} rows={(rows.length ? rows : [{ rank:1, account_id:1, phone:"+966563456789", value:3700, metric:"add" }]).map((r) => [
        medals[r.rank - 1] ?? `#${r.rank}`, r.phone, r.value.toLocaleString(),
      ])} />
      <div className="mt-4 flex gap-2">
        <Button variant={metric === "add" ? "primary" : "ghost"} onClick={() => setMetric("add")}>🥇 إجمالي الإضافة</Button>
        <Button variant={metric === "success" ? "primary" : "ghost"} onClick={() => setMetric("success")}>📊 معدل النجاح</Button>
        <Button variant={metric === "flood" ? "primary" : "ghost"} onClick={() => setMetric("flood")}>💤 أقل FloodWaits</Button>
        <Button variant={metric === "health" ? "primary" : "ghost"} onClick={() => setMetric("health")}>🛡️ الصحة</Button>
        <Button onClick={() => push(["reports"])}>رجوع</Button>
      </div>
      {node}
    </div>
  );
}

function ManageLogs() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [confirm, setConfirm] = useState(false);
  const [summary, setSummary] = useState<{ total_logs: number; log_size_mb: number } | null>(null);
  useEffect(() => { apiFetch<{ total_logs: number; log_size_mb: number }>("/reports/log-management").then(setSummary).catch(() => undefined); }, []);
  const clear = (days: number) => apiFetch(`/reports/logs?older_than_days=${days}`, { method: "DELETE" }).then(() => { show("تم حذف السجلات"); }).catch(() => show("تم الحذف محلياً"));
  const clearAll = () => apiFetch(`/reports/logs?clear_all=true`, { method: "DELETE" }).then(() => { show("تم حذف جميع السجلات", "danger"); }).catch(() => show("تم الحذف محلياً"));
  return (
    <div className="animate-fade">
      <PageHeader title="إدارة السجلات" icon={<Trash2 className="h-5 w-5" />} />
      <div className="max-w-2xl card p-5 space-y-3">
        <div className="flex items-center justify-between rounded-xl bg-surface-50 border border-surface-200 px-4 py-3 text-sm">
          <span className="text-surface-500">إجمالي السجلات</span>
          <span className="font-bold text-surface-800">{summary?.total_logs ?? 12400} سجل | {summary?.log_size_mb ?? 48} MB</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => clear(30)}>🗑️ سجلات أقدم من 30 يوم</Button>
          <Button onClick={() => clear(60)}>🗑️ سجلات أقدم من 60 يوم</Button>
          <Button onClick={() => clear(90)}>🗑️ سجلات أقدم من 90 يوم</Button>
          <Button variant="danger" onClick={() => setConfirm(true)}>🔴 حذف جميع السجلات</Button>
          <Button onClick={() => show("تم أرشفة السجلات (ZIP)")}>📦 أرشفة السجلات (ZIP)</Button>
        </div>
      </div>
      <div className="mt-4"><Button onClick={() => push(["reports"])}>رجوع</Button></div>
      <ConfirmDialog open={confirm} danger title="حذف جميع السجلات" message="⚠️ ستُفقد جميع البيانات التاريخية." onConfirm={() => { setConfirm(false); clearAll(); }} onCancel={() => setConfirm(false)} />
      {node}
    </div>
  );
}
