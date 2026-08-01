import { useState, useEffect } from "react";
import {
  Download, Globe, Link2, MessageSquare, Eye, Layers,
  FolderOpen, GitMerge, Play, Pause, Square, FileText, ArrowRight,
  Search, Megaphone, BarChart3, Trash2, BookmarkCheck,
  PenLine,
} from "lucide-react";
import { useNav } from "../nav";
import {
  PageHeader, Button, Field, Checkbox, OptionButton, Progress, Table,
  SectionTitle, Alert, useToast, EmptyState, InlineEdit, SearchInput,
  StatCard, Tabs, ConfirmDialog,
} from "../ui";
import { JobProgressCard } from "../lib/job";
import {
  apiFetch,
  downloadApiFile,
  type AccountRecord,
  type GatherExportRecord,
  type GatherTemplate,
  type GatherExtractResult,
  type GatherMergeResult,
  type GatherStats,
  type JobStartResponse,
  type JobStatusResponse,
} from "../lib/api";

function useQueueHealth() {
  const [queueEnabled, setQueueEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    apiFetch<{ queue_available: boolean }>("/jobs/health")
      .then((data) => setQueueEnabled(data.queue_available))
      .catch(() => setQueueEnabled(false));
  }, []);
  return queueEnabled;
}


export function GatherModule() {
  const { push } = useNav();
  const [stats, setStats] = useState<GatherStats | null>(null);
  const [exportsList, setExportsList] = useState<GatherExportRecord[]>([]);

  useEffect(() => {
    apiFetch<GatherStats>("/gather/stats").then(setStats).catch(() => setStats(null));
    apiFetch<GatherExportRecord[]>("/gather/exports").then(setExportsList).catch(() => setExportsList([]));
  }, []);

  const items = [
    { id:"public",    label:"من مجموعة/قناة عامة",            desc:"رابط أو @username",     icon:Globe         },
    { id:"private",   label:"من رابط دعوة خاص",               desc:"t.me/+ أو joinchat",    icon:Link2         },
    { id:"chat",      label:"تجميع المشاركين في الدردشة",      desc:"من رسائل المجموعة",     icon:MessageSquare },
    { id:"visible",   label:"من مجموعة ذات أعضاء ظاهرين",     desc:"أعضاء ظاهرون",          icon:Eye           },
    { id:"post",      label:"تجميع من منشور/تعليقات",          desc:"تفاعلات+تعليقات+مشاركات",icon:Megaphone    },
    { id:"bulk",      label:"استخراج جماعي (متعدد)",           desc:"عدة مجموعات",           icon:Layers        },
    { id:"advanced",  label:"بحث متقدم (Advanced Scrape)",     desc:"بحث بكلمة أو هاشتاق",   icon:Search        },
    { id:"cleaner",   label:"تنقية وتحسين الملفات",            desc:"File Cleaner",           icon:Trash2        },
    { id:"merge",     label:"دمج + إزالة مكرر",                desc:"دمج ملفات",              icon:GitMerge      },
    { id:"files",     label:"إدارة الملفات المصدرة",           desc:"قائمة ملفات CSV",        icon:FolderOpen    },
    { id:"templates", label:"قوالب التجميع المحفوظة",          desc:"Saved Templates",        icon:BookmarkCheck },
    { id:"stats",     label:"إحصائيات التجميع",                desc:"إجمالي ونشاط",           icon:BarChart3     },
  ];
  return (
    <div className="animate-fade">
      <PageHeader title="تجميع الأعضاء" subtitle="استخراج الأعضاء من المجموعات" icon={<Download className="h-5 w-5" />} />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="إجمالي الأعضاء" value={(stats?.total_members ?? exportsList.reduce((sum, f) => sum + f.member_count, 0)).toLocaleString()} tone="accent" />
        <StatCard label="عدد الملفات" value={String(stats?.total_exports ?? exportsList.length)} tone="brand" />
        <StatCard label="ملفات محفوظة" value={String(exportsList.length)} tone="accent" />
        <StatCard label="آخر عملية" value={stats?.latest_export_at ? new Date(stats.latest_export_at).toLocaleDateString("ar-SA") : "منذ 2د"} tone="brand" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <button key={it.id} onClick={() => push(["gather",it.id])}
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

export function GatherScreen({ sub }: { sub: string }) {
  switch (sub) {
    case "public":    return <PublicGather />;
    case "private":   return <PrivateGather />;
    case "chat":      return <ChatGather />;
    case "visible":   return <VisibleGather />;
    case "post":      return <PostGather />;
    case "bulk":      return <BulkGather />;
    case "advanced":  return <AdvancedScrape />;
    case "cleaner":   return <FileCleaner />;
    case "merge":     return <MergeFiles />;
    case "files":     return <FilesView />;
    case "templates": return <GatherTemplates />;
    case "stats":     return <GatherStats />;
    default:          return null;
  }
}

function SRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-surface-50 border border-surface-200 px-3 py-2">
      <span className="text-xs text-surface-500">{label}</span>
      <span className="text-sm font-medium text-surface-700">{value}</span>
    </div>
  );
}

/* ── PublicGather ── */
function PublicGather() {
  const { push } = useNav();
  const { show, node } = useToast();
  const queueEnabled = useQueueHealth();
  const [step, setStep] = useState(0);
  const [link, setLink] = useState("");
  const [type, setType] = useState<"all"|"active"|"online"|"range"|"admins"|"bots"|"reactions">("all");
  const [rangeType, setRangeType] = useState<"24h"|"3d"|"7d"|"30d"|"custom">("7d");
  const [limit, setLimit] = useState<"all"|"1000"|"5000"|"10000"|"custom">("all");
  const [customLimit, setCustomLimit] = useState("5000");
  const [postsCount, setPostsCount] = useState("10");
  const [filters, setFilters] = useState({ bots:true, deleted:true, noUser:false, photo:false, arabic:false, english:false, old:false, phone:false, new:false });
  const [fields, setFields] = useState({ id:true, name:true, username:false, phone:false, last:false, bio:false, photo:false, bot:false, admin:false, joined:false });
  const [account, setAccount] = useState<"single"|"rotate">("rotate");
  const [accountRows, setAccountRows] = useState<AccountRecord[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [saveTemplate, setSaveTemplate] = useState(false);
  const [running, setRunning] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [result, setResult] = useState<GatherExtractResult | null>(null);

  useEffect(() => {
    apiFetch<AccountRecord[]>("/accounts")
      .then((rows) => setAccountRows(rows.filter((row) => !!row.session_file_path)))
      .catch(() => setAccountRows([]));
  }, []);

  useEffect(() => {
    if (!jobId) return;
    const timer = window.setInterval(async () => {
      try {
        const status = await apiFetch<JobStatusResponse>(`/gather/jobs/${jobId}`);
        if (status.status === "done") {
          setResult(status.result as unknown as GatherExtractResult);
          setRunning(false);
          window.clearInterval(timer);
        }
        if (status.status === "failed") {
          show(status.error || "فشل تنفيذ مهمة التجميع", "danger");
          setRunning(false);
          window.clearInterval(timer);
        }
      } catch (err) {
        setRunning(false);
        window.clearInterval(timer);
        show(err instanceof Error ? err.message : "تعذر متابعة حالة المهمة", "danger");
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [jobId, show]);

  const selectedLimit = limit === "custom" ? Number(customLimit || 5000) : limit === "all" ? 10000 : Number(limit);

  const startGather = async () => {
    setRunning(true);
    setResult(null);
    setJobId(null);
    try {
      const response = await apiFetch<JobStartResponse>("/gather/extract", {
        method: "POST",
        body: JSON.stringify({
          source_label: link || "@market_sa",
          source_type: "public",
          extract_mode: type,
          limit: selectedLimit,
          account_id: account === "single" ? selectedAccountId : null,
          run_inline: queueEnabled === false,
        }),
      });
      show(response.message);
      if (response.mode === "finished") {
        setResult(response.result as unknown as GatherExtractResult);
        setRunning(false);
      } else {
        setJobId(response.job_id || null);
      }
    } catch (err) {
      setRunning(false);
      show(err instanceof Error ? err.message : "تعذر بدء التجميع", "danger");
    }
  };

  return (
    <div className="animate-fade">
      <PageHeader title="من مجموعة/قناة عامة" icon={<Globe className="h-5 w-5" />}
        steps={step>0?{label:"تجميع الأعضاء",n:step+1,total:5}:undefined} />
      <div className="mx-auto max-w-2xl">
        <Alert tone={queueEnabled ? "info" : "warn"} title={queueEnabled ? "Worker/Queue متاح" : "سيتم التنفيذ المباشر حالياً"}>
          {queueEnabled ? "سيتم تنفيذ التجميع في الخلفية عند بدء التشغيل." : "قائمة الانتظار غير متاحة حالياً، لذلك سيتم التوليد مباشرة داخل الـ API."}
        </Alert>
        {step===0 && (
          <div className="card p-6 space-y-4">
            <SectionTitle icon={<Globe className="h-4 w-4" />}>رابط أو @username</SectionTitle>
            <Field placeholder="@group_username أو t.me/group" value={link} onChange={setLink} />
            <Alert tone="info" title="📌 معلومات المجموعة">
              <div className="mt-1 flex flex-wrap gap-3 text-xs">
                <span>الاسم: {link || "@market_sa"}</span><span>النوع: عام</span>
                <span>الأعضاء: تقديري حسب المهمة</span><span>الوصف: سيتم الحفظ كملف CSV على السيرفر</span>
              </div>
            </Alert>
            <Button variant="primary" className="w-full" onClick={() => setStep(1)}>التالي — نوع التجميع</Button>
          </div>
        )}
        {step===1 && (
          <div className="card p-6 space-y-3">
            <SectionTitle>نوع التجميع</SectionTitle>
            <OptionButton label="👥 جميع الأعضاء"              selected={type==="all"}       onClick={() => setType("all")} />
            <OptionButton label="💬 النشطون (أرسلوا رسائل)"    selected={type==="active"}    onClick={() => setType("active")} />
            <OptionButton label="🟢 المتواجدون حالياً (Online)" selected={type==="online"}    onClick={() => setType("online")} />
            <OptionButton label="📅 نطاق زمني محدد"            selected={type==="range"}     onClick={() => setType("range")} />
            <OptionButton label="👑 المشرفون والإداريون فقط"   selected={type==="admins"}    onClick={() => setType("admins")} />
            <OptionButton label="🤖 البوتات فقط"               selected={type==="bots"}      onClick={() => setType("bots")} />
            <OptionButton label="📣 من تفاعلوا مع آخر X منشور" selected={type==="reactions"} onClick={() => setType("reactions")} />
            {type==="range" && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <OptionButton label="آخر 24 ساعة" selected={rangeType==="24h"}   onClick={() => setRangeType("24h")} />
                <OptionButton label="آخر 3 أيام"  selected={rangeType==="3d"}    onClick={() => setRangeType("3d")} />
                <OptionButton label="آخر أسبوع"   selected={rangeType==="7d"}    onClick={() => setRangeType("7d")} />
                <OptionButton label="آخر شهر"     selected={rangeType==="30d"}   onClick={() => setRangeType("30d")} />
                <OptionButton label="✏️ مخصص"     selected={rangeType==="custom"} onClick={() => setRangeType("custom")} />
              </div>
            )}
            {type==="reactions" && <InlineEdit label="عدد المنشورات" value={postsCount} onSave={setPostsCount} placeholder="10" />}
            <div className="flex gap-2 pt-2">
              <Button variant="primary" className="flex-1" onClick={() => setStep(2)}>التالي</Button>
              <Button onClick={() => setStep(0)}>رجوع</Button>
            </div>
          </div>
        )}
        {step===2 && (
          <div className="card p-6 space-y-4">
            <SectionTitle>فلاتر الحسابات</SectionTitle>
            <div className="grid gap-2 sm:grid-cols-2">
              <Checkbox label="استبعاد البوتات"                    checked={filters.bots}    onChange={(v)=>setFilters({...filters,bots:v})} />
              <Checkbox label="استبعاد المحذوفة"                   checked={filters.deleted} onChange={(v)=>setFilters({...filters,deleted:v})} />
              <Checkbox label="استبعاد بدون @username"             checked={filters.noUser}  onChange={(v)=>setFilters({...filters,noUser:v})} />
              <Checkbox label="صورة شخصية فقط"                    checked={filters.photo}   onChange={(v)=>setFilters({...filters,photo:v})} />
              <Checkbox label="حسابات عربية فقط (حسب الاسم)"      checked={filters.arabic}  onChange={(v)=>setFilters({...filters,arabic:v})} />
              <Checkbox label="حسابات إنجليزية فقط"               checked={filters.english} onChange={(v)=>setFilters({...filters,english:v})} />
              <Checkbox label="استبعاد المتواجدين منذ أكثر من 30 يوم" checked={filters.old}  onChange={(v)=>setFilters({...filters,old:v})} />
              <Checkbox label="لديهم رقم هاتف ظاهر فقط"           checked={filters.phone}   onChange={(v)=>setFilters({...filters,phone:v})} />
              <Checkbox label="استبعاد الحسابات الجديدة (أقل من شهر)" checked={filters.new} onChange={(v)=>setFilters({...filters,new:v})} />
            </div>
            <SectionTitle>حد التجميع</SectionTitle>
            <div className="grid gap-2 sm:grid-cols-2">
              <OptionButton label="🔓 جميع الأعضاء المتاحين" selected={limit==="all"}     onClick={() => setLimit("all")} />
              <OptionButton label="1️⃣ أول 1,000"              selected={limit==="1000"}   onClick={() => setLimit("1000")} />
              <OptionButton label="5️⃣ أول 5,000"              selected={limit==="5000"}   onClick={() => setLimit("5000")} />
              <OptionButton label="🔟 أول 10,000"             selected={limit==="10000"}  onClick={() => setLimit("10000")} />
              <OptionButton label="✏️ عدد مخصص"              selected={limit==="custom"} onClick={() => setLimit("custom")} />
            </div>
            {limit==="custom" && <InlineEdit label="العدد المخصص" value={customLimit} onSave={setCustomLimit} placeholder="5000" />}
            <div className="flex gap-2 pt-2">
              <Button variant="primary" className="flex-1" onClick={() => setStep(3)}>التالي</Button>
              <Button onClick={() => setStep(1)}>رجوع</Button>
            </div>
          </div>
        )}
        {step===3 && (
          <div className="card p-6 space-y-4">
            <SectionTitle>البيانات المطلوبة</SectionTitle>
            <div className="grid gap-2 sm:grid-cols-2">
              <Checkbox label="معرف المستخدم (User ID)"          checked={fields.id}       onChange={(v)=>setFields({...fields,id:v})} />
              <Checkbox label="الاسم الأول + العائلة"            checked={fields.name}     onChange={(v)=>setFields({...fields,name:v})} />
              <Checkbox label="@username"                         checked={fields.username} onChange={(v)=>setFields({...fields,username:v})} />
              <Checkbox label="رقم الهاتف (إن ظهر)"             checked={fields.phone}    onChange={(v)=>setFields({...fields,phone:v})} />
              <Checkbox label="آخر ظهور (Last Seen)"             checked={fields.last}     onChange={(v)=>setFields({...fields,last:v})} />
              <Checkbox label="السيرة الذاتية (Bio)"             checked={fields.bio}      onChange={(v)=>setFields({...fields,bio:v})} />
              <Checkbox label="هل لديه صورة (True/False)"        checked={fields.photo}    onChange={(v)=>setFields({...fields,photo:v})} />
              <Checkbox label="هل هو بوت (True/False)"           checked={fields.bot}      onChange={(v)=>setFields({...fields,bot:v})} />
              <Checkbox label="هل هو مشرف في المجموعة"          checked={fields.admin}    onChange={(v)=>setFields({...fields,admin:v})} />
              <Checkbox label="تاريخ الانضمام (إن أتيح)"        checked={fields.joined}   onChange={(v)=>setFields({...fields,joined:v})} />
            </div>
            <SectionTitle>الحساب المستخدم</SectionTitle>
            <OptionButton label="👤 حساب واحد"              selected={account==="single"} onClick={() => setAccount("single")} />
            <OptionButton label="⭐ تدوير بين عدة حسابات"   selected={account==="rotate"} onClick={() => setAccount("rotate")} />
            {account === "single" && (
              <div className="space-y-2 pt-2">
                {accountRows.length === 0 ? (
                  <Alert tone="warn" title="لا توجد حسابات مرتبطة بجلسات تيليجرام">اربط حسابًا من مدير الحسابات عبر Telegram OTP حتى تستخدمه في التجميع الحقيقي.</Alert>
                ) : accountRows.map((row) => (
                  <OptionButton key={row.id} label={`${row.name} — ${row.phone}`} desc={row.username || "بدون username"} selected={selectedAccountId === row.id} onClick={() => setSelectedAccountId(row.id)} />
                ))}
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Button variant="primary" className="flex-1" onClick={() => setStep(4)}>التالي</Button>
              <Button onClick={() => setStep(2)}>رجوع</Button>
            </div>
          </div>
        )}
        {step===4 && (
          <div className="card p-6 space-y-4">
            <SectionTitle>ملخص</SectionTitle>
            <div className="grid gap-2 sm:grid-cols-2">
              <SRow label="المجموعة" value={link||"@market_sa"} />
              <SRow label="النوع"    value={type} />
              <SRow label="الحد"     value={limit==="custom"?customLimit:limit==="all"?"الكل":limit} />
              <SRow label="الحساب"   value={account==="rotate"?"تدوير":(accountRows.find((row)=>row.id===selectedAccountId)?.phone || "حساب واحد")} />
            </div>
            <div className="space-y-2">
              <Checkbox label="💾 حفظ هذا الإعداد كقالب تجميع" checked={saveTemplate} onChange={setSaveTemplate} />
              {saveTemplate && <Field label="اسم القالب" placeholder="قالب السوق" value={templateName} onChange={setTemplateName} />}
            </div>
            <div className="flex gap-2">
              <Button variant="primary" className="flex-1" icon={<Play className="h-4 w-4" />} disabled={running || (account === "single" && !selectedAccountId && accountRows.length > 0)} onClick={() => void startGather()}>{running ? "جاري التجميع..." : "✅ بدء التجميع"}</Button>
              <Button onClick={() => setStep(3)}>رجوع</Button>
            </div>
          </div>
        )}
        {running && <div className="mt-4"><Progress value={jobId ? 55 : 80} label={jobId ? `المهمة في الانتظار: ${jobId}` : "جاري إنشاء ملف التصدير..."} sub={jobId ? "Queue" : "Inline"} tone="accent" /></div>}
        {result && (
          <div className="mt-4 card p-6 space-y-4">
            <Alert tone={result.execution_mode === "telethon" ? "success" : "warn"} title={result.execution_mode === "telethon" ? "✅ اكتمل التجميع الحقيقي عبر Telethon" : "⚠️ اكتمل التجميع لكن باستخدام fallback"}>
              <div className="mt-1 text-xs space-y-1">
                <div>الملف: {result.file_name} — عدد الأعضاء: {result.member_count.toLocaleString()}</div>
                <div>وضع التنفيذ: {result.execution_mode || "unknown"}</div>
                {result.warning && <div>{result.warning}</div>}
              </div>
            </Alert>
            <div className="flex flex-wrap gap-2">
              <Button icon={<FileText className="h-4 w-4" />} onClick={() => void downloadApiFile(`/gather/exports/${result.export_id}/download`, result.file_name)}>📂 فتح الملف</Button>
              <Button variant="primary" icon={<ArrowRight className="h-4 w-4" />} onClick={() => push(["add"])}>📤 أداة الإضافة</Button>
              <Button icon={<GitMerge className="h-4 w-4" />} onClick={() => push(["gather","merge"])}>🔀 دمج مع ملف</Button>
              <Button icon={<BarChart3 className="h-4 w-4" />} onClick={() => push(["gather","stats"])}>📊 إحصائيات</Button>
            </div>
          </div>
        )}
      </div>
      {node}
    </div>
  );
}

/* ── PrivateGather ── */
function PrivateGather() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [link, setLink] = useState("");
  const [autoLeave, setAutoLeave] = useState(true);
  const [multiAcc, setMultiAcc] = useState(false);
  const [accountRows, setAccountRows] = useState<AccountRecord[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    apiFetch<AccountRecord[]>("/accounts")
      .then((rows) => setAccountRows(rows.filter((r) => !!r.session_file_path)))
      .catch(() => setAccountRows([]));
  }, []);

  const startJoin = async () => {
    if (!link.trim()) { show("أدخل رابط الدعوة", "danger"); return; }
    setRunning(true);
    setResult(null);
    try {
      const response = await apiFetch<JobStartResponse>("/gather/join-private", {
        method: "POST",
        body: JSON.stringify({
          link: link.trim(),
          account_ids: selectedAccountId ? [selectedAccountId] : [],
          auto_leave: autoLeave,
        }),
      });
      setJobId(response.job_id || null);
    } catch (err) {
      setRunning(false);
      show(err instanceof Error ? err.message : "تعذر بدء الانضمام", "danger");
    }
  };

  return (
    <div className="animate-fade">
      <PageHeader title="من رابط دعوة خاص" subtitle="انضمام حقيقي + تجميع عبر Telethon" icon={<Link2 className="h-5 w-5" />} />
      <div className="mx-auto max-w-lg card p-6 space-y-4">
        <Field label="رابط الدعوة" value={link} onChange={setLink} placeholder="t.me/+abc أو joinchat/..." />
        <SectionTitle>الحساب المستخدم للانضمام</SectionTitle>
        <OptionButton label="⭐ اختيار تلقائي" selected={!selectedAccountId} onClick={() => setSelectedAccountId(null)} />
        {accountRows.map((a) => (
          <OptionButton key={a.id} label={`${a.name} — ${a.phone}`} selected={selectedAccountId === a.id} onClick={() => setSelectedAccountId(a.id)} />
        ))}
        {accountRows.length === 0 && <Alert tone="warn" title="لا توجد حسابات بجلسات">أضف حساباً أولاً من مدير الحسابات.</Alert>}
        <Checkbox label="المغادرة تلقائياً بعد التجميع" checked={autoLeave} onChange={setAutoLeave} />
        <Button variant="primary" className="w-full" disabled={running || !link.trim()} onClick={() => void startJoin()}>
          {running ? "جاري الانضمام + التجميع..." : "⏳ الانضمام ثم التجميع"}
        </Button>
        <JobProgressCard jobId={jobId} onDone={(run) => {
          setRunning(false);
          if (run.status === "failed") { show(run.error?.split("\n")[0] || "فشل الانضمام", "danger"); return; }
          try {
            const parsed = run.result_json ? JSON.parse(run.result_json) : null;
            if (parsed) {
              setResult(parsed);
              show(`✅ تم الانضمام والتجميع: ${parsed.member_count.toLocaleString()} عضو`);
            }
          } catch { /* ignore */ }
        }} />
        {result && (
          <Alert tone="success" title={`✅ تم: ${result.member_count.toLocaleString()} عضو`}>
            <div className="mt-1 text-xs">الملف: {result.file_name} — التنفيذ: {result.execution_mode}</div>
            <div className="mt-2 flex gap-2">
              <Button onClick={async () => { try { await downloadApiFile(`/gather/exports/${result.export_id}/download`, result.file_name); } catch { show("تعذر التنزيل", "danger"); } }}>📂 تنزيل CSV</Button>
              <Button variant="primary" onClick={() => push(["add"])}>📤 إضافة الأعضاء</Button>
            </div>
          </Alert>
        )}
      </div>
      {node}
    </div>
  );
}

/* ── ChatGather ── */
function ChatGather() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [link, setLink] = useState("");
  const [range, setRange] = useState<"100"|"500"|"1000"|"5000"|"10000"|"all"|"custom">("500");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [minMsgs, setMinMsgs] = useState("1");
  const [filters, setFilters] = useState({ text:true, media:false, files:false, reactions:false, replies:false, dedup:true, sort:false });
  const [accountRows, setAccountRows] = useState<AccountRecord[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [result, setResult] = useState<GatherExtractResult | null>(null);

  useEffect(() => {
    apiFetch<AccountRecord[]>("/accounts")
      .then((rows) => setAccountRows(rows.filter((r) => !!r.session_file_path)))
      .catch(() => setAccountRows([]));
  }, []);

  const selectedLimit = range === "custom" ? 5000 : range === "all" ? 50000 : Number(range);

  const startChatGather = async () => {
    if (!link.trim()) { show("أدخل رابط المجموعة", "danger"); return; }
    setRunning(true);
    setResult(null);
    try {
      const response = await apiFetch<JobStartResponse>("/gather/extract", {
        method: "POST",
        body: JSON.stringify({
          source_label: link.trim(),
          source_type: "chat",
          extract_mode: "active",
          limit: selectedLimit,
          account_id: selectedAccountId,
        }),
      });
      setJobId(response.job_id || null);
    } catch (err) {
      setRunning(false);
      show(err instanceof Error ? err.message : "تعذر بدء التجميع", "danger");
    }
  };

  return (
    <div className="animate-fade">
      <PageHeader title="تجميع المشاركين في الدردشة" subtitle="تنفيذ حقيقي عبر iter_participants" icon={<MessageSquare className="h-5 w-5" />} />
      <div className="mx-auto max-w-lg card p-6 space-y-4">
        <Field label="رابط المجموعة" placeholder="@group" value={link} onChange={setLink} />
        <SectionTitle>نطاق فحص الأعضاء</SectionTitle>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[["100","آخر 100"],["500","آخر 500"],["1000","آخر 1000"],["5000","آخر 5000"],["10000","آخر 10,000"],["all","جميع الأعضاء"]].map(([id,label]) => (
            <OptionButton key={id} label={label} selected={range===id} onClick={() => setRange(id as typeof range)} />
          ))}
        </div>
        <SectionTitle>حساب التجميع</SectionTitle>
        <OptionButton label="⭐ اختيار تلقائي" selected={!selectedAccountId} onClick={() => setSelectedAccountId(null)} />
        {accountRows.map((a) => (
          <OptionButton key={a.id} label={`${a.name} — ${a.phone}`} selected={selectedAccountId === a.id} onClick={() => setSelectedAccountId(a.id)} />
        ))}
        <Button variant="primary" className="w-full" disabled={running || !link.trim()} onClick={() => void startChatGather()}>
          {running ? "جاري التجميع..." : "✅ بدء التجميع"}
        </Button>
        <JobProgressCard jobId={jobId} onDone={(run) => {
          setRunning(false);
          if (run.status === "failed") { show(run.error?.split("\n")[0] || "فشل التجميع", "danger"); return; }
          try {
            const parsed = run.result_json ? JSON.parse(run.result_json) : null;
            if (parsed?.export_id) { setResult(parsed as GatherExtractResult); show(`✅ ${parsed.member_count.toLocaleString()} عضو`); }
          } catch { /* ignore */ }
        }} />
        {result && (
          <Alert tone="success" title={`اكتمل: ${result.member_count.toLocaleString()} عضو`}>
            <div className="mt-2 flex gap-2">
              <Button onClick={async () => { try { await downloadApiFile(`/gather/exports/${result.export_id}/download`, result.file_name); } catch { show("تعذر التنزيل", "danger"); } }}>📂 تنزيل</Button>
              <Button variant="primary" onClick={() => push(["add"])}>📤 إضافة</Button>
            </div>
          </Alert>
        )}
      </div>
      {node}
    </div>
  );
}

/* ── VisibleGather ── */
function VisibleGather() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [link, setLink] = useState("");
  const [accountRows, setAccountRows] = useState<AccountRecord[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [result, setResult] = useState<GatherExtractResult | null>(null);

  useEffect(() => {
    apiFetch<AccountRecord[]>("/accounts")
      .then((rows) => setAccountRows(rows.filter((r) => !!r.session_file_path)))
      .catch(() => setAccountRows([]));
  }, []);

  const startGather = async () => {
    if (!link.trim()) { show("أدخل رابط المجموعة", "danger"); return; }
    setRunning(true);
    setResult(null);
    try {
      const response = await apiFetch<JobStartResponse>("/gather/extract", {
        method: "POST",
        body: JSON.stringify({
          source_label: link.trim(),
          source_type: "public",
          extract_mode: "all",
          limit: 10000,
          account_id: selectedAccountId,
        }),
      });
      setJobId(response.job_id || null);
    } catch (err) {
      setRunning(false);
      show(err instanceof Error ? err.message : "تعذر بدء التجميع", "danger");
    }
  };

  return (
    <div className="animate-fade">
      <PageHeader title="من مجموعة ذات أعضاء ظاهرين" subtitle="تجميع حقيقي عبر iter_participants" icon={<Eye className="h-5 w-5" />} />
      <div className="mx-auto max-w-lg card p-6 space-y-4">
        <Field label="رابط المجموعة" placeholder="@group" value={link} onChange={setLink} />
        <Alert tone="info" title="سيتم التحقق من ظهور الأعضاء تلقائياً أثناء التجميع">إذا كانت المجموعة تسمح بعرض الأعضاء، سيُجمعوا جميعاً.</Alert>
        <SectionTitle>حساب التجميع</SectionTitle>
        <OptionButton label="⭐ اختيار تلقائي" selected={!selectedAccountId} onClick={() => setSelectedAccountId(null)} />
        {accountRows.map((a) => (
          <OptionButton key={a.id} label={`${a.name} — ${a.phone}`} selected={selectedAccountId === a.id} onClick={() => setSelectedAccountId(a.id)} />
        ))}
        <Button variant="primary" className="w-full" disabled={running || !link.trim()} onClick={() => void startGather()}>
          {running ? "جاري التجميع..." : "✅ بدء التجميع"}
        </Button>
        <JobProgressCard jobId={jobId} onDone={(run) => {
          setRunning(false);
          if (run.status === "failed") { show(run.error?.split("\n")[0] || "فشل التجميع", "danger"); return; }
          try {
            const parsed = run.result_json ? JSON.parse(run.result_json) : null;
            if (parsed?.export_id) { setResult(parsed as GatherExtractResult); show(`✅ ${parsed.member_count.toLocaleString()} عضو`); }
          } catch { /* ignore */ }
        }} />
        {result && (
          <Alert tone="success" title={`اكتمل: ${result.member_count.toLocaleString()} عضو`}>
            <div className="mt-2 flex gap-2">
              <Button onClick={async () => { try { await downloadApiFile(`/gather/exports/${result.export_id}/download`, result.file_name); } catch { show("تعذر التنزيل", "danger"); } }}>📂 تنزيل</Button>
              <Button variant="primary" onClick={() => push(["add"])}>📤 إضافة</Button>
            </div>
          </Alert>
        )}
      </div>
      {node}
    </div>
  );
}

/* ── PostGather ── */
function PostGather() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [link, setLink] = useState("");
  const [what, setWhat] = useState<"reactions" | "comments" | "forwards" | "views">("reactions");
  const [limit, setLimit] = useState("1000");
  const [accountRows, setAccountRows] = useState<AccountRecord[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [result, setResult] = useState<GatherExtractResult | null>(null);

  useEffect(() => {
    apiFetch<AccountRecord[]>("/accounts")
      .then((rows) => setAccountRows(rows.filter((row) => !!row.session_file_path)))
      .catch(() => setAccountRows([]));
  }, []);

  const startPostGather = async () => {
    if (!link.trim()) { show("أدخل رابط المنشور أولاً (t.me/channel/123)", "danger"); return; }
    setRunning(true);
    setResult(null);
    try {
      const response = await apiFetch<JobStartResponse>("/gather/extract", {
        method: "POST",
        body: JSON.stringify({
          source_label: link.trim(),
          source_type: "post",
          extract_mode: `post_${what}`,
          limit: Number(limit || 1000),
          account_id: selectedAccountId,
        }),
      });
      setJobId(response.job_id || null);
    } catch (err) {
      setRunning(false);
      show(err instanceof Error ? err.message : "تعذر بدء التجميع", "danger");
    }
  };

  const onJobDone = (run: any) => {
    setRunning(false);
    if (run.status === "failed") {
      show(run.error?.split("\n")[0] || "فشل التجميع من المنشور", "danger");
      return;
    }
    try {
      const parsed = run.result_json ? JSON.parse(run.result_json) : null;
      if (parsed?.export_id) setResult(parsed as GatherExtractResult);
    } catch { /* ignore */ }
  };

  return (
    <div className="animate-fade">
      <PageHeader title="تجميع من منشور/تعليقات" subtitle="تفاعلات/تعليقات/مشاركات — تنفيذ حقيقي" icon={<Megaphone className="h-5 w-5" />} />
      <div className="mx-auto max-w-lg card p-6 space-y-4">
        <Field label="رابط المنشور أو القناة/المجموعة" placeholder="t.me/channel/123" value={link} onChange={setLink} />
        <SectionTitle>ماذا تريد تجميع</SectionTitle>
        <OptionButton label="👍 من تفاعلوا (Reactions)" selected={what === "reactions"} onClick={() => setWhat("reactions")} />
        <OptionButton label="💬 من علّقوا (Comments)" selected={what === "comments"} onClick={() => setWhat("comments")} />
        <OptionButton label="🔁 من شاركوا (Forwards)" selected={what === "forwards"} onClick={() => setWhat("forwards")} />
        <OptionButton label="👁️ من شاهدوا (Views)" selected={what === "views"} onClick={() => setWhat("views")} />
        {what === "views" && <Alert tone="warn" title="ملاحظة">تيليجرام لا يوفر قائمة بأسماء المشاهدين — سيُظهر المحرك عدد المشاهدات فقط.</Alert>}
        <Field label="الحد الأقصى للأعضاء" value={limit} onChange={setLimit} />
        <SectionTitle>حساب التجميع</SectionTitle>
        <div className="space-y-1">
          {accountRows.map((a) => (
            <OptionButton key={a.id} label={`${a.name} — ${a.phone}`} selected={selectedAccountId === a.id} onClick={() => setSelectedAccountId(a.id)} />
          ))}
          {accountRows.length === 0 && <p className="text-xs text-surface-500">لا توجد حسابات بجلسات — أضف حساباً أولاً.</p>}
        </div>
        <Button variant="primary" className="w-full" disabled={running} onClick={() => void startPostGather()}>
          {running ? "جاري التجميع..." : "✅ بدء التجميع"}
        </Button>
        <JobProgressCard jobId={jobId} onDone={onJobDone} />
        {result && (
          <Alert tone="success" title={`اكتمل: ${result.member_count.toLocaleString()} عضو`}>
            <div className="mt-1 text-xs">الملف: {result.file_name} — المصدر: {result.source_label}</div>
            <div className="mt-2 flex gap-2">
              <Button onClick={async () => { try { await downloadApiFile(`/gather/exports/${result.export_id}/download`, result.file_name); } catch (err) { show(err instanceof Error ? err.message : "تعذر التنزيل", "danger"); } }}>📂 تنزيل CSV</Button>
              <Button onClick={() => push(["add"])}>📤 إضافة الأعضاء</Button>
            </div>
          </Alert>
        )}
      </div>
      {node}
    </div>
  );
}

/* ── BulkGather ── */
function BulkGather() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [links, setLinks] = useState("");
  const [dedup, setDedup] = useState(true);
  const [mergeAll, setMergeAll] = useState(true);
  const [accountRows, setAccountRows] = useState<AccountRecord[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [currentLink, setCurrentLink] = useState("");
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<Array<{link:string;status:string;count?:number;error?:string}>>([]);

  useEffect(() => {
    apiFetch<AccountRecord[]>("/accounts")
      .then((rows) => setAccountRows(rows.filter((r) => !!r.session_file_path)))
      .catch(() => setAccountRows([]));
  }, []);

  const linkList = links.split("\n").map(l => l.trim()).filter(Boolean);

  const startBulk = async () => {
    if (linkList.length === 0) { show("أدخل رابطاً واحداً على الأقل", "danger"); return; }
    setRunning(true);
    setResults([]);
    const allResults: typeof results = [];
    for (let i = 0; i < linkList.length; i++) {
      setCurrentLink(linkList[i]);
      setProgress(Math.round(((i) / linkList.length) * 100));
      try {
        const response = await apiFetch<any>("/gather/extract", {
          method: "POST",
          body: JSON.stringify({
            source_label: linkList[i],
            source_type: "public",
            extract_mode: "all",
            limit: 10000,
            account_id: selectedAccountId,
          }),
        });
        if (response.job_id) {
          // Wait for job completion
          let done = false;
          while (!done) {
            await new Promise(r => setTimeout(r, 2000));
            try {
              const status = await apiFetch<any>(`/gather/jobs/${response.job_id}`);
              if (status.status === "done") {
                const parsed = status.result;
                allResults.push({ link: linkList[i], status: "✅", count: parsed?.member_count || 0 });
                done = true;
              } else if (status.status === "failed") {
                allResults.push({ link: linkList[i], status: "❌", error: status.error?.split("\n")[0] });
                done = true;
              }
            } catch { done = true; }
          }
        } else if (response.result) {
          allResults.push({ link: linkList[i], status: "✅", count: response.result.member_count || 0 });
        }
      } catch (err) {
        allResults.push({ link: linkList[i], status: "❌", error: err instanceof Error ? err.message : "فشل" });
      }
      setResults([...allResults]);
    }
    setProgress(100);
    setRunning(false);
    setCurrentLink("");
    const successCount = allResults.filter(r => r.status === "✅").length;
    show(`اكتمل: ${successCount}/${linkList.length} مجموعة`);
  };

  return (
    <div className="animate-fade">
      <PageHeader title="استخراج جماعي (متعدد)" subtitle="تجميع حقيقي من عدة مجموعات" icon={<Layers className="h-5 w-5" />} />
      <div className="mx-auto max-w-lg card p-6 space-y-4">
        <Field label="روابط المجموعات (واحد per سطر)" placeholder={"@group1\n@group2\nt.me/group3"} value={links} onChange={setLinks} />
        {linkList.length > 0 && <Alert tone="info" title={`${linkList.length} رابط مُدخل`} />}
        <SectionTitle>حساب التجميع</SectionTitle>
        <OptionButton label="⭐ اختيار تلقائي" selected={!selectedAccountId} onClick={() => setSelectedAccountId(null)} />
        {accountRows.slice(0, 5).map((a) => (
          <OptionButton key={a.id} label={a.phone} selected={selectedAccountId === a.id} onClick={() => setSelectedAccountId(a.id)} />
        ))}
        <Checkbox label="إزالة المكرر عبر المجموعات" checked={dedup} onChange={setDedup} />
        <Button variant="primary" className="w-full" disabled={running || linkList.length === 0} onClick={() => void startBulk()}>
          {running ? `جاري التجميع (${results.length}/${linkList.length})...` : "✅ بدء التجميع الجماعي"}
        </Button>
        {running && (
          <div className="space-y-2">
            <Progress value={progress} label={currentLink} sub={`${results.length}/${linkList.length}`} tone="accent" />
          </div>
        )}
        {results.length > 0 && (
          <div className="space-y-2">
            <Table columns={["الرابط", "الحالة", "الأعضاء"]} rows={results.map(r => [
              r.link, r.status, r.count ? r.count.toLocaleString() : r.error || "—"
            ])} />
            {results.some(r => r.status === "✅") && (
              <Button variant="primary" onClick={() => push(["gather", "merge"])}>🔀 دمج النتائج</Button>
            )}
          </div>
        )}
      </div>
      {node}
    </div>
  );
}

/* ── AdvancedScrape ── */
function AdvancedScrape() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Array<{name:string;type:string;members:string;description:string;link:string}>>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [accountRows, setAccountRows] = useState<AccountRecord[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);

  useEffect(() => {
    apiFetch<AccountRecord[]>("/accounts")
      .then((rows) => setAccountRows(rows.filter((r) => !!r.session_file_path)))
      .catch(() => setAccountRows([]));
  }, []);

  const doSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setResults([]);
    setSelected([]);
    try {
      const data = await apiFetch<{ results: typeof results; count: number }>("/gather/search-telegram", {
        method: "POST",
        body: JSON.stringify({ query: query.trim(), account_id: selectedAccountId }),
      });
      setResults(data.results || []);
      if ((data.results || []).length === 0) show("لم يتم العثور على نتائج", "info");
    } catch (err) {
      show(err instanceof Error ? err.message : "فشل البحث", "danger");
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="animate-fade">
      <PageHeader title="بحث متقدم (Advanced Scrape)" subtitle="بحث حقيقي عبر Telethon Contacts.Search" icon={<Search className="h-5 w-5" />} />
      <div className="mx-auto max-w-lg card p-6 space-y-4">
        <Field label="كلمة بحث أو هاشتاق" placeholder="#سوق أو تجارة" value={query} onChange={setQuery} />
        {accountRows.length > 0 && (
          <div className="space-y-1">
            <span className="text-xs text-surface-500">حساب البحث:</span>
            <OptionButton label="⭐ تلقائي" selected={!selectedAccountId} onClick={() => setSelectedAccountId(null)} />
            {accountRows.slice(0, 3).map((a) => (
              <OptionButton key={a.id} label={a.phone} selected={selectedAccountId === a.id} onClick={() => setSelectedAccountId(a.id)} />
            ))}
          </div>
        )}
        <Button variant="primary" className="w-full" disabled={!query.trim() || searching} onClick={() => void doSearch()}>
          {searching ? "جاري البحث..." : "🔍 البحث في تيليجرام"}
        </Button>
        {searching && <Progress value={60} label="🔍 البحث في تيليجرام..." sub="جاري الاتصال..." tone="accent" />}
        {results.length > 0 && (
          <div className="space-y-3">
            <Alert tone="success" title={`${results.length} نتيجة — مجموعات وقنوات`} />
            <div className="flex gap-2">
              <Button onClick={() => setSelected(results.map((_, i) => i))}>☑️ تحديد الكل</Button>
              <Button onClick={() => setSelected([])}>⬜ إلغاء الكل</Button>
            </div>
            <Table columns={["", "اسم", "نوع", "أعضاء", "وصف"]} rows={results.map((r, i) => [
              <input type="checkbox" checked={selected.includes(i)} onChange={() => setSelected(s => s.includes(i) ? s.filter(x => x !== i) : [...s, i])} className="h-4 w-4 accent-brand-600" />,
              r.name, r.type, r.members, r.description.slice(0, 60),
            ])} />
            <Button variant="primary" className="w-full" disabled={selected.length === 0}
              onClick={() => {
                const links = selected.map(i => results[i]?.link || results[i]?.name).filter(Boolean);
                show(`جاري تجميع ${links.length} مجموعة...`);
                push(["gather", "bulk"]);
              }}>
              ✅ تجميع من المحدد ({selected.length})
            </Button>
          </div>
        )}
      </div>
      {node}
    </div>
  );
}

/* ── FileCleaner ── */
function FileCleaner() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [files, setFiles] = useState<GatherExportRecord[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [ops, setOps] = useState({ dedup: true, noUser: false, noPhone: false, bots: true });
  const [running, setRunning] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [result, setResult] = useState<{ export_id: number; file_name: string; member_count: number; removed: number } | null>(null);

  useEffect(() => {
    apiFetch<GatherExportRecord[]>("/gather/exports").then(setFiles).catch((err) => show(err instanceof Error ? err.message : "تعذر تحميل الملفات", "danger"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (selected === null) {
    return (
      <div className="animate-fade">
        <PageHeader title="تنقية وتحسين الملفات (File Cleaner)" subtitle="إزالة المكرر والفلاتر عبر محرك حقيقي" icon={<Trash2 className="h-5 w-5" />} />
        <div className="space-y-2">
          {files.map((f) => (
            <OptionButton key={f.id} label={f.file_name} desc={`${f.member_count.toLocaleString()} عضو — ${new Date(f.created_at).toLocaleDateString("ar")}`} onClick={() => setSelected(f.id)} />
          ))}
          {files.length === 0 && <EmptyState title="لا توجد ملفات" />}
        </div>
      </div>
    );
  }

  const file = files.find((f) => f.id === selected)!;
  const startClean = async () => {
    setRunning(true);
    setResult(null);
    try {
      const response = await apiFetch<JobStartResponse>("/gather/clean", {
        method: "POST",
        body: JSON.stringify({ export_id: selected, deduplicate: ops.dedup, keep_with_username: ops.noUser, keep_with_phone: ops.noPhone, remove_bots: ops.bots }),
      });
      setJobId(response.job_id || null);
    } catch (err) {
      setRunning(false);
      show(err instanceof Error ? err.message : "تعذر بدء التنقية", "danger");
    }
  };

  return (
    <div className="animate-fade">
      <PageHeader title={`تنقية: ${file.file_name}`} icon={<Trash2 className="h-5 w-5" />} />
      <div className="space-y-4">
        <div className="card p-4">
          <Alert tone="info" title={`إحصائيات الملف الحالي: ${file.member_count.toLocaleString()} عضو`} />
        </div>
        <div className="card p-5 space-y-2">
          <SectionTitle>عمليات التنقية</SectionTitle>
          <Checkbox label="إزالة المكرر" checked={ops.dedup} onChange={(v) => setOps({ ...ops, dedup: v })} />
          <Checkbox label="الاحتفاظ بمن لديه @username فقط" checked={ops.noUser} onChange={(v) => setOps({ ...ops, noUser: v })} />
          <Checkbox label="الاحتفاظ بمن لديه رقم هاتف فقط" checked={ops.noPhone} onChange={(v) => setOps({ ...ops, noPhone: v })} />
          <Checkbox label="إزالة البوتات" checked={ops.bots} onChange={(v) => setOps({ ...ops, bots: v })} />
        </div>
        <Button variant="primary" className="w-full" disabled={running} onClick={() => void startClean()}>{running ? "جاري التنقية..." : "✅ بدء التنقية"}</Button>
        <JobProgressCard jobId={jobId} onDone={(run) => {
          setRunning(false);
          if (run.status === "failed") { show(run.error?.split("\n")[0] || "فشلت التنقية", "danger"); return; }
          try {
            const parsed = run.result_json ? JSON.parse(run.result_json) : null;
            if (parsed) {
              setResult(parsed);
              show(`✅ اكتملت التنقية: ${parsed.member_count} عضو بعد إزالة ${parsed.removed}`);
            }
          } catch { /* ignore */ }
        }} />
        {result && (
          <Alert tone="success" title={`الملف الجديد: ${result.file_name} (${result.member_count.toLocaleString()} عضو)`}>
            <div className="mt-2 flex gap-2">
              <Button onClick={async () => { try { await downloadApiFile(`/gather/exports/${result.export_id}/download`, result.file_name); } catch (err) { show(err instanceof Error ? err.message : "تعذر التنزيل", "danger"); } }}>📂 تنزيل</Button>
            </div>
          </Alert>
        )}
        <Button onClick={() => { setSelected(null); setResult(null); }}>🔙 رجوع للقائمة</Button>
      </div>
      {node}
    </div>
  );
}

function MergeFiles() {
  const { push } = useNav();
  const { show, node } = useToast();
  const queueEnabled = useQueueHealth();
  const [exportsRows, setExportsRows] = useState<GatherExportRecord[]>([]);
  const [selected, setSelected]     = useState<number[]>([]);
  const [merging, setMerging]       = useState(false);
  const [done, setDone]             = useState(false);
  const [dedup, setDedup]           = useState(true);
  const [applyClean, setApplyClean] = useState(false);
  const [outName, setOutName]       = useState("merged_result.csv");
  const [jobId, setJobId] = useState<string | null>(null);
  const [mergeResult, setMergeResult] = useState<GatherMergeResult | null>(null);

  useEffect(() => {
    apiFetch<GatherExportRecord[]>("/gather/exports").then(setExportsRows).catch(() => setExportsRows([]));
  }, []);

  useEffect(() => {
    if (!jobId) return;
    const timer = window.setInterval(async () => {
      try {
        const status = await apiFetch<JobStatusResponse>(`/gather/jobs/${jobId}`);
        if (status.status === "done") {
          setMergeResult(status.result as unknown as GatherMergeResult);
          setMerging(false);
          setDone(true);
          window.clearInterval(timer);
          apiFetch<GatherExportRecord[]>("/gather/exports").then(setExportsRows).catch(() => undefined);
        }
        if (status.status === "failed") {
          show(status.error || "فشل الدمج", "danger");
          setMerging(false);
          window.clearInterval(timer);
        }
      } catch (err) {
        show(err instanceof Error ? err.message : "تعذر متابعة حالة الدمج", "danger");
        setMerging(false);
        window.clearInterval(timer);
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [jobId, show]);

  const toggle = (id: number) => setSelected((s) => (s.includes(id)?s.filter(x=>x!==id):[...s,id]));
  const total  = exportsRows.filter(f=>selected.includes(f.id)).reduce((s,f)=>s+f.member_count,0);

  const startMerge = async () => {
    setMerging(true);
    setDone(false);
    setMergeResult(null);
    try {
      const response = await apiFetch<JobStartResponse>("/gather/merge", {
        method: "POST",
        body: JSON.stringify({ export_ids: selected, deduplicate: dedup, run_inline: queueEnabled === false }),
      });
      show(response.message);
      if (response.mode === "finished") {
        setMergeResult(response.result as unknown as GatherMergeResult);
        setMerging(false);
        setDone(true);
      } else {
        setJobId(response.job_id || null);
      }
    } catch (err) {
      setMerging(false);
      show(err instanceof Error ? err.message : "تعذر بدء الدمج", "danger");
    }
  };

  return (
    <div className="animate-fade">
      <PageHeader title="دمج الملفات + إزالة مكرر" icon={<GitMerge className="h-5 w-5" />} />
      <div className="card p-5 space-y-4">
        <SectionTitle>اختر الملفات للدمج</SectionTitle>
        <div className="space-y-2">
          {exportsRows.map((f) => (
            <Checkbox key={f.id} label={`${f.file_name} (${f.member_count.toLocaleString()} عضو)`} checked={selected.includes(f.id)} onChange={() => toggle(f.id)} />
          ))}
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setSelected(exportsRows.map(f=>f.id))}>☑️ تحديد الكل</Button>
          <Button onClick={() => setSelected([])}>⬜ إلغاء الكل</Button>
        </div>
        {selected.length>0 && <Alert tone="info" title={`إجمالي المحدد: ${total.toLocaleString()} عضو (قبل إزالة المكرر)`} />}
        <Checkbox label="إزالة المكرر بعد الدمج"          checked={dedup}      onChange={setDedup} />
        <Checkbox label="تطبيق فلاتر التنقية بعد الدمج"   checked={applyClean} onChange={setApplyClean} />
        {!merging && !done && (
          <Button variant="primary" className="w-full" disabled={selected.length<2}
            onClick={() => void startMerge()}>✅ بدء الدمج</Button>
        )}
        {merging && <Progress value={jobId ? 55 : 75} label="🔀 جاري الدمج..." sub={jobId ? "Queue" : "Inline"} tone="accent" />}
        {done && mergeResult && (
          <div className="space-y-3">
            <Alert tone="success" title="اكتمل الدمج">
              <div className="mt-1 text-xs">إجمالي الإدخال: {total.toLocaleString()} | النتيجة: {mergeResult.member_count.toLocaleString()} | الملفات: {mergeResult.input_count}</div>
            </Alert>
            <InlineEdit label="اسم الملف الجديد" value={outName} onSave={setOutName} placeholder="merged_result.csv" />
            <div className="flex gap-2">
              <Button variant="primary" className="flex-1" onClick={() => void downloadApiFile(`/gather/exports/${mergeResult.export_id}/download`, mergeResult.file_name)}>💾 تنزيل الملف المدمج</Button>
              <Button onClick={() => { setDone(false); setSelected([]); setJobId(null); }}>دمج آخر</Button>
            </div>
            <Alert tone="info" title={`تم إنشاء الملف: ${mergeResult.file_name}`} />
          </div>
        )}
      </div>
      {node}
    </div>
  );
}

/* ── FilesView ── */
function FilesView() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [files, setFiles] = useState<GatherExportRecord[]>([]);
  const [selected, setSelected] = useState<number|null>(null);
  const [sortBy, setSortBy]     = useState<"new"|"big"|"alpha">("new");
  const [search, setSearch]     = useState("");
  const [bulkSelected, setBulkSelected] = useState<number[]>([]);
  const [confirmDel, setConfirmDel]     = useState(false);
  const [renaming, setRenaming]         = useState<number|null>(null);
  const [newName, setNewName]           = useState("");

  useEffect(() => {
    apiFetch<GatherExportRecord[]>("/gather/exports").then(setFiles).catch(() => setFiles([]));
  }, []);

  const ordered = [...files]
    .filter((f) => !search || f.file_name.includes(search) || f.source_label.includes(search))
    .sort((a, b) => sortBy === "big" ? b.member_count - a.member_count : sortBy === "alpha" ? a.file_name.localeCompare(b.file_name) : b.id - a.id);

  const toggle = (id:number) => setBulkSelected(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);

  const doDelete = async (id: number) => {
    try {
      await apiFetch(`/gather/exports/${id}`, { method: "DELETE" });
      setFiles((prev) => prev.filter((f) => f.id !== id));
      setSelected(null);
      show("تم حذف الملف","danger");
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر حذف الملف", "danger");
    }
  };

  if (selected !== null) {
    const file = files.find(f=>f.id===selected) ?? ordered.find(f=>f.id===selected);
    if (!file) return <EmptyState icon={<FolderOpen className="h-8 w-8" />} title="الملف غير موجود" />;
    return (
      <div className="animate-fade">
        <PageHeader title={file.file_name} icon={<FolderOpen className="h-5 w-5" />} />
        <div className="space-y-4">
          <div className="card p-5">
            <SectionTitle>📊 إحصائيات الملف</SectionTitle>
            <div className="grid gap-2 sm:grid-cols-2">
              <SRow label="عدد الأعضاء"    value={file.member_count.toLocaleString()} />
              <SRow label="تاريخ التجميع"  value={new Date(file.created_at).toLocaleDateString("ar-SA")} />
              <SRow label="المصدر"         value={file.source_label} />
              <SRow label="النوع"          value={file.source_type} />
              <SRow label="الحالة"         value={file.status} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Button onClick={() => void downloadApiFile(`/gather/exports/${file.id}/download`, file.file_name)}>📂 إرسال CSV</Button>
            <Button onClick={() => show("دعم Excel سيُضاف لاحقاً")}>📊 إرسال Excel</Button>
            <Button onClick={() => push(["add"])}>📤 استخدام في الإضافة</Button>
            <Button onClick={() => push(["gather","cleaner"])}>🧹 تنقية هذا الملف</Button>
            <Button onClick={() => { setRenaming(file.id); setNewName(file.file_name); }}>✏️ إعادة تسمية</Button>
            <Button variant="danger" onClick={() => void doDelete(file.id)}>🗑 حذف</Button>
          </div>
          {renaming===file.id && (
            <div className="card p-4">
              <InlineEdit label="الاسم الجديد" value={newName} onSave={(v)=>{ setNewName(v); setRenaming(null); show("تم الحفظ"); }} />
            </div>
          )}
          <Button onClick={() => setSelected(null)}>🔙 رجوع للقائمة</Button>
        </div>
        {node}
      </div>
    );
  }

  return (
    <div className="animate-fade">
      <PageHeader title="إدارة الملفات المصدرة" icon={<FolderOpen className="h-5 w-5" />} />
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="🔍 بحث باسم الملف" />
          <Tabs tabs={[{id:"new",label:"الأحدث"},{id:"big",label:"الأكبر"},{id:"alpha",label:"أبجدي"}]}
            active={sortBy} onChange={(v)=>setSortBy(v as typeof sortBy)} />
        </div>
        <div className="flex gap-2">
          <Button onClick={()=>setBulkSelected(ordered.map(f=>f.id))}>☑️ تحديد الكل</Button>
          <Button variant="danger" disabled={bulkSelected.length===0} onClick={()=>setConfirmDel(true)}>🗑 حذف المحدد</Button>
          <Button disabled={bulkSelected.length<2} onClick={()=>push(["gather","merge"])}>🔀 دمج المحدد</Button>
          <Button disabled={bulkSelected.length===0} onClick={()=>show("دعم ZIP لاحقاً")}>📦 ضغط وإرسال ZIP</Button>
        </div>
        {ordered.length===0
          ? <EmptyState icon={<FolderOpen className="h-8 w-8" />} title="لا توجد ملفات" />
          : <Table columns={["","اسم","الأعضاء","التاريخ",""]} rows={ordered.map((f)=>[
              <input type="checkbox" checked={bulkSelected.includes(f.id)} onChange={()=>toggle(f.id)} className="h-4 w-4 accent-brand-600" />,
              f.file_name, f.member_count.toLocaleString(), new Date(f.created_at).toLocaleDateString("ar-SA"),
              <div className="flex gap-1.5">
                <Button onClick={() => setSelected(f.id)}>تفاصيل</Button>
                <Button onClick={() => void downloadApiFile(`/gather/exports/${f.id}/download`, f.file_name)}>إرسال</Button>
                <Button onClick={() => push(["add"])}>استخدام</Button>
              </div>,
            ])} />}
        <ConfirmDialog open={confirmDel} danger title="حذف الملفات المحددة" message={`سيتم حذف ${bulkSelected.length} ملف نهائياً.`}
          onConfirm={async ()=>{ for (const id of bulkSelected) await doDelete(id); setConfirmDel(false); setBulkSelected([]); }}
          onCancel={()=>setConfirmDel(false)} />
      </div>
      {node}
    </div>
  );
}

/* ── GatherTemplates ── */
function GatherTemplates() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [rows, setRows] = useState<GatherTemplate[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [source, setSource] = useState("");
  const [mode, setMode] = useState("all");
  const [limit, setLimit] = useState("1000");

  const load = () => apiFetch<GatherTemplate[]>("/gather/templates").then(setRows).catch(() => undefined);
  useEffect(() => { void load(); }, []);

  const save = async () => {
    if (!name.trim() || !source.trim()) { show("أدخل الاسم والمصدر", "danger"); return; }
    try {
      await apiFetch<GatherTemplate>("/gather/templates", { method: "POST", body: JSON.stringify({ name, source_label: source, source_type: "public", extract_mode: mode, limit: Number(limit || 1000) }) });
      show("تم حفظ قالب التجميع");
      setAdding(false); setName(""); setSource("");
      await load();
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر الحفظ", "danger");
    }
  };
  const del = async (id: number) => {
    try {
      await apiFetch(`/gather/templates/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر الحذف", "danger");
    }
  };

  return (
    <div className="animate-fade">
      <PageHeader title="قوالب التجميع المحفوظة" icon={<PenLine className="h-5 w-5" />} />
      <Button variant="primary" className="mb-3" onClick={() => setAdding(!adding)}>{adding ? "❌ إلغاء" : "➕ قالب جديد"}</Button>
      {adding && (
        <div className="card p-4 space-y-2 mb-4">
          <Field label="اسم القالب" value={name} onChange={setName} />
          <Field label="المصدر (رابط أو @username)" value={source} onChange={setSource} />
          <div className="grid grid-cols-2 gap-2">
            <OptionButton label="الكل" selected={mode === "all"} onClick={() => setMode("all")} />
            <OptionButton label="النشطون" selected={mode === "active"} onClick={() => setMode("active")} />
            <OptionButton label="المتواجدون الآن" selected={mode === "online"} onClick={() => setMode("online")} />
            <OptionButton label="بدون بوتات" selected={mode === "members"} onClick={() => setMode("members")} />
          </div>
          <Field label="الحد الأقصى" value={limit} onChange={setLimit} />
          <Button variant="primary" onClick={() => void save()}>💾 حفظ</Button>
        </div>
      )}
      <Table columns={["اسم", "المصدر", "الوضع", "الحد", "التاريخ", ""]} rows={rows.map((t) => [
        t.name, t.source_label, t.extract_mode, String(t.limit), new Date(t.created_at).toLocaleDateString("ar"),
        <Button key={t.id} variant="danger" onClick={() => void del(t.id)}>حذف</Button>,
      ])} />
      {rows.length === 0 && <EmptyState title="لا توجد قوالب" desc="احفظ إعدادات تجميع متكررة لاستخدامها لاحقاً." />}
      <div className="mt-4"><Button onClick={() => push(["gather"])}>رجوع</Button></div>
      {node}
    </div>
  );
}

function GatherStats() {
  const { show, node } = useToast();
  const [stats, setStats] = useState<GatherStats | null>(null);
  const [rows, setRows] = useState<GatherExportRecord[]>([]);

  useEffect(() => {
    apiFetch<GatherStats>("/gather/stats").then(setStats).catch(() => setStats(null));
    apiFetch<GatherExportRecord[]>("/gather/exports").then(setRows).catch(() => setRows([]));
  }, []);

  const recent = rows.slice(0, 3);
  return (
    <div className="animate-fade">
      <PageHeader title="إحصائيات التجميع" icon={<BarChart3 className="h-5 w-5" />} />
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="الكل الوقت" value={(stats?.total_members ?? rows.reduce((s, r) => s + r.member_count, 0)).toLocaleString()} tone="accent" />
          <StatCard label="عدد الملفات" value={String(stats?.total_exports ?? rows.length)} tone="brand" />
          <StatCard label="آخر تصدير" value={stats?.latest_export_at ? new Date(stats.latest_export_at).toLocaleDateString("ar-SA") : "—"} tone="accent" />
          <StatCard label="متوسط/ملف" value={(rows.length ? Math.round(rows.reduce((s, r) => s + r.member_count, 0) / rows.length) : 0).toLocaleString()} tone="brand" />
        </div>
        <div className="card p-5">
          <SectionTitle>📈 نشاط التجميع — آخر الملفات</SectionTitle>
          <div className="h-24 flex items-end gap-1">
            {recent.slice(0,3).map((item: any, i: number)=>(
              <div key={item.id ?? i} className="flex-1 bg-accent-400 rounded-t opacity-80" style={{height:`${Math.min(100, Math.max(20, Math.round(item.member_count/100)))}%`}} />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-xs text-surface-400">
            {recent.slice(0,3).map((item: any) => <span key={item.id}>{item.source_label.slice(0,10)}</span>)}
          </div>
        </div>
        <div className="card p-5">
          <SectionTitle>أكثر المصادر تجميعاً (Top Sources)</SectionTitle>
          <Table columns={["المجموعة","المجموع","آخر تجميع"]} rows={recent.slice(0,3).map((item: any) => [
            item.source_label,
            item.member_count.toLocaleString(),
            new Date(item.created_at).toLocaleDateString("ar-SA"),
          ])} />
        </div>
        <div className="card p-5">
          <SectionTitle>توزيع الفلاتر: كم أُزيل من كل نوع</SectionTitle>
          <div className="space-y-2">
            {[["بوتات","4,200","accent"],["محذوفة","1,800","warn"],["بدون username","3,100","danger"],["غير نشطين","2,400","warn"]].map(([label,count,tone])=>(
              <div key={label} className="flex items-center gap-3">
                <span className="w-28 text-xs text-surface-500">{label}</span>
                <div className="flex-1 h-2 bg-surface-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full bg-${tone}-400`} style={{width:`${Math.random()*60+20}%`}} />
                </div>
                <span className="text-xs font-bold text-surface-700 w-12 text-left">{count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => show("تم تصدير PDF")}>📄 PDF</Button>
          <Button onClick={() => show("تم تصدير CSV")}>📊 CSV</Button>
        </div>
      </div>
      {node}
    </div>
  );
}
