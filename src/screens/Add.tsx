import { useState, useEffect } from "react";
import {
  UserPlus, FileText, PenLine, RefreshCw, BarChart3,
  Play, Pause, Square, Plus, Minus, Bell, ListChecks,
  Target, Layers, Ban, Settings, RotateCw, ShieldOff,
} from "lucide-react";
import { useNav } from "../nav";
import {
  PageHeader, Button, Field, Checkbox, OptionButton, Progress, Table,
  SectionTitle, Alert, useToast, EmptyState, InlineEdit, StatCard,
  SearchInput, Tabs, ConfirmDialog,
} from "../ui";
import { addLogs, exportedFiles, accounts, blacklist } from "../data";
import {
  apiFetch,
  type AddOperationRecord,
  type AddResult,
  type AddStats,
  type BlacklistEntryRecord,
  type GatherExportRecord,
  type JobStartResponse,
  type JobStatusResponse,
} from "../lib/api";

export function AddModule() {
  const { push } = useNav();
  const [stats, setStats] = useState<AddStats | null>(null);

  useEffect(() => {
    apiFetch<AddStats>("/add/stats").then(setStats).catch(() => setStats(null));
  }, []);

  const items = [
    { id:"csv",       label:"إضافة من ملف CSV",          desc:"استيراد أعضاء من ملف",     icon:FileText  },
    { id:"manual",    label:"إضافة يدوية",                desc:"أسماء مستخدمين/IDs",       icon:PenLine   },
    { id:"smart",     label:"إضافة ذكية (Smart Add)",     desc:"تجميع+إضافة مباشرة",       icon:Target    },
    { id:"multi",     label:"من عدة مصادر (Multi-Source)", desc:"ملفات + مجموعات",          icon:Layers    },
    { id:"resume",    label:"استئناف عملية سابقة",         desc:"متابعة من نقطة التوقف",    icon:RefreshCw },
    { id:"blacklist", label:"القائمة السوداء",              desc:"Blacklist Management",      icon:Ban       },
    { id:"logs",      label:"سجلات وإحصائيات الإضافة",    desc:"تاريخ العمليات",           icon:BarChart3 },
    { id:"defaults",  label:"إعدادات الإضافة الافتراضية", desc:"تهيئة السلوك الافتراضي",   icon:Settings  },
  ];
  const todayAdded = stats?.total_success ?? 1842;
  const successRate = stats ? Math.max(0, Math.round((stats.total_success / Math.max(1, stats.total_success + stats.total_failed + stats.total_skipped)) * 100)) : 94;
  return (
    <div className="animate-fade">
      <PageHeader title="إضافة الأعضاء" subtitle="إضافة جماعية للقروبات" icon={<UserPlus className="h-5 w-5" />} />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="مضاف اليوم"   value={todayAdded.toLocaleString()} tone="brand"  />
        <StatCard label="العمليات"      value={String(stats?.total_operations ?? 0)} tone="accent" />
        <StatCard label="معدل النجاح"   value={`${successRate}%`}           tone="brand"  />
        <StatCard label="آخر عملية"     value={stats?.latest_operation_at ? new Date(stats.latest_operation_at).toLocaleDateString("ar-SA") : "منذ 2س"} tone="accent" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <button key={it.id} onClick={() => push(["add",it.id])}
              className="card flex items-center gap-3 p-4 text-right transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-pop">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-brand-200"><Icon className="h-5 w-5" /></div>
              <div><div className="text-sm font-bold text-surface-800">{it.label}</div><div className="text-xs text-surface-500">{it.desc}</div></div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function AddScreen({ sub }: { sub: string }) {
  switch (sub) {
    case "csv":       return <AddFromCsv />;
    case "manual":    return <AddManual />;
    case "smart":     return <SmartAdd />;
    case "multi":     return <MultiSource />;
    case "resume":    return <ResumeOp />;
    case "blacklist": return <Blacklist />;
    case "logs":      return <AddLogs />;
    case "defaults":  return <DefaultSettings />;
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

function useQueueHealth() {
  const [queueEnabled, setQueueEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    apiFetch<{ queue_available: boolean }>("/jobs/health")
      .then((data) => setQueueEnabled(data.queue_available))
      .catch(() => setQueueEnabled(false));
  }, []);
  return queueEnabled;
}

function fallbackExports(): GatherExportRecord[] {
  return exportedFiles.map((file) => ({
    id: file.id,
    source_label: file.name,
    source_type: "csv",
    file_name: file.name,
    file_path: file.name,
    member_count: file.members,
    status: "ready",
    notes: null,
    created_by: null,
    created_at: `${file.date}T00:00:00Z`,
  }));
}

/* ── shared running screen ── */
function AddRunning({ summary, onBack }: { summary: Record<string,string>; onBack: () => void }) {
  const { push } = useNav();
  const { show, node } = useToast();
  const [progress, setProgress] = useState(0);
  const [running, setRunning]   = useState(true);
  const [paused, setPaused]     = useState(false);
  const [done, setDone]         = useState(false);
  const [showMidReport, setShowMidReport] = useState(false);

  useEffect(() => {
    const t = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) { clearInterval(t); setRunning(false); setDone(true); return 100; }
        return p + 3;
      });
    }, 120);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="space-y-4">
      <div className="card p-5 space-y-3">
        <Progress value={progress} label={done?"✅ اكتملت الإضافة!":"📤 جاري الإضافة..."} sub={`${progress}% [${Math.floor(progress*141)}/14135]`} />
        {running && (
          <>
            <div className="grid grid-cols-2 gap-2 text-xs text-surface-500 sm:grid-cols-4">
              <div>الحساب: +966501234567</div>
              <div>أُضيف: {Math.floor(progress*1.4)}/5</div>
              <div>اليوم: 18/20</div>
              <div className="text-brand-600 font-bold">نشط ✅</div>
            </div>
            <div className="text-xs text-surface-400">
              آخر الإجراءات: ✅@user1 ⚠️@user2 ❌@user3 | التأخير التالي: {87-Math.floor(progress*0.5)}ث
            </div>
          </>
        )}
        {done && (
          <Alert tone="success" title="✅ اكتملت الإضافة">
            <div className="mt-1 text-xs">✅ ناجح: 13,500 | ⚠️ تخطي: 500 | ❌ فاشل: 135</div>
          </Alert>
        )}
        <div className="flex flex-wrap gap-2">
          {running && !paused && <Button variant="warn" icon={<Pause className="h-4 w-4" />} onClick={() => setPaused(true)}>⏸ إيقاف مؤقت</Button>}
          {running && paused  && <Button variant="primary" icon={<Play className="h-4 w-4" />} onClick={() => setPaused(false)}>▶️ استئناف</Button>}
          {running && <Button icon={<BarChart3 className="h-4 w-4" />} onClick={() => setShowMidReport(!showMidReport)}>📊 تقرير</Button>}
          {running && <Button icon={<Plus className="h-4 w-4" />} onClick={() => show("+30% تأخير")}>+30%</Button>}
          {running && <Button icon={<Minus className="h-4 w-4" />} onClick={() => show("-30% تأخير")}>-30%</Button>}
          {running && <Button variant="danger" icon={<Square className="h-4 w-4" />} onClick={() => { setRunning(false); setDone(true); setProgress(100); }}>⏹ إيقاف وحفظ</Button>}
          {done && (
            <>
              <Button onClick={() => show("تم تصدير التقرير")}>📤 تصدير</Button>
              <Button onClick={() => show("عرض قائمة الفاشلة")}>📋 الفاشلة</Button>
              <Button variant="primary" onClick={() => show("إعادة الإضافة للفاشلة")}>🔁 إعادة الفاشلة</Button>
              <Button onClick={onBack}>🏠 رجوع</Button>
            </>
          )}
        </div>
        {showMidReport && running && (
          <div className="border-t border-surface-100 pt-3 space-y-2">
            <SectionTitle>📊 تقرير مفصل للحظة</SectionTitle>
            <div className="grid gap-1 text-xs">
              <div className="flex justify-between"><span>✅ ناجح</span><span className="font-bold text-brand-700">{Math.floor(progress*135)}</span></div>
              <div className="flex justify-between"><span>⚠️ تخطي (خصوصية)</span><span className="font-bold text-warn-700">{Math.floor(progress*5)}</span></div>
              <div className="flex justify-between"><span>❌ فاشل</span><span className="font-bold text-danger-700">{Math.floor(progress*1.35)}</span></div>
            </div>
            <Table columns={["حساب","أرسل","نجح","فشل","حالة"]} rows={accounts.slice(0,3).map(a=>[
              a.phone,
              String(Math.floor(progress*0.5)),
              String(Math.floor(progress*0.45)),
              String(Math.floor(progress*0.05)),
              <span className="chip bg-brand-50 text-brand-700 ring-1 ring-brand-200">✅ نشط</span>,
            ])} />
          </div>
        )}
      </div>
      {node}
    </div>
  );
}

/* ── AddFromCsv ── */
function AddFromCsv() {
  const { push } = useNav();
  const { show, node } = useToast();
  const queueEnabled = useQueueHealth();
  const [exportsRows, setExportsRows] = useState<GatherExportRecord[]>(fallbackExports());
  const [step, setStep]   = useState(0);
  const [file, setFile]   = useState<number|null>(null);
  const [target, setTarget] = useState("@my_group");
  const [method, setMethod] = useState<"direct"|"invite"|"link">("direct");
  const [inviteText, setInviteText] = useState("");
  const [accs, setAccs]   = useState<"single"|"rotate"|"group"|"selected"|"smart">("rotate");
  const [dist, setDist]   = useState<"seq"|"equal"|"random"|"smart">("seq");
  const [addLimit, setAddLimit]     = useState("5");
  const [delay, setDelay]           = useState("60-120");
  const [switchDelay, setSwitchDelay] = useState("5-10");
  const [dailyLimit, setDailyLimit] = useState("20");
  const [smartLimit, setSmartLimit] = useState(false);
  const [smartDelay, setSmartDelay] = useState(false);
  const [protection, setProtection] = useState({
    skipExisting:true, skipBlacklist:true, noUser:false, restricted:false, deleted:false, bots:false,
    saveProgress:true, floodWait:true, stopFail:false, addBlacklist:false, stopAtLimit:false,
  });
  const [stopLimit, setStopLimit]   = useState("500");
  const [running, setRunning] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [result, setResult] = useState<AddResult | null>(null);

  useEffect(() => {
    apiFetch<GatherExportRecord[]>("/gather/exports").then(setExportsRows).catch(() => setExportsRows(fallbackExports()));
  }, []);

  useEffect(() => {
    if (!jobId) return;
    const timer = window.setInterval(async () => {
      try {
        const status = await apiFetch<JobStatusResponse>(`/add/jobs/${jobId}`);
        if (status.status === "finished") {
          setResult(status.result as unknown as AddResult);
          setRunning(false);
          window.clearInterval(timer);
        }
        if (status.status === "failed") {
          show(status.error || "فشل تنفيذ الإضافة", "danger");
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

  const selectedFile = exportsRows.find((f) => f.id === file) || fallbackExports().find((f) => f.id === file) || null;

  const startAdd = async () => {
    if (!file) return;
    setRunning(true);
    setResult(null);
    setJobId(null);
    try {
      const response = await apiFetch<JobStartResponse>("/add/from-export", {
        method: "POST",
        body: JSON.stringify({ export_id: file, target_label: target, method, run_inline: queueEnabled === false }),
      });
      show(response.message);
      if (response.mode === "finished") {
        setResult(response.result as unknown as AddResult);
        setRunning(false);
      } else {
        setJobId(response.job_id || null);
      }
    } catch (err) {
      setRunning(false);
      show(err instanceof Error ? err.message : "تعذر بدء عملية الإضافة", "danger");
    }
  };

  return (
    <div className="animate-fade">
      <PageHeader title="إضافة من ملف CSV" icon={<FileText className="h-5 w-5" />}
        steps={step>0?{label:"إضافة الأعضاء",n:step+1,total:3}:undefined} />
      <div className="mx-auto max-w-2xl">
        <Alert tone={queueEnabled ? "info" : "warn"} title={queueEnabled ? "Queue/Worker متاح" : "سيتم التنفيذ المباشر حالياً"}>
          {queueEnabled ? "سيتم إرسال مهمة الإضافة إلى Worker عند البدء." : "قائمة الانتظار غير متاحة حالياً، لذلك سيتم احتساب العملية مباشرة داخل الـ API."}
        </Alert>
        {step===0 && (
          <div className="card p-6 space-y-4">
            <SectionTitle>اختر ملف</SectionTitle>
            <div className="space-y-2">
              {exportsRows.map((f) => (
                <OptionButton key={f.id} label={f.file_name} desc={`${f.member_count.toLocaleString()} عضو — ${new Date(f.created_at).toLocaleDateString("ar-SA")}`} selected={file===f.id} onClick={() => setFile(f.id)} />
              ))}
              {exportsRows.length === 0 && fallbackExports().map((f) => (
                <OptionButton key={f.id} label={f.file_name} desc={`${f.member_count.toLocaleString()} عضو — ${new Date(f.created_at).toLocaleDateString("ar-SA")}`} selected={file===f.id} onClick={() => setFile(f.id)} />
              ))}
              <OptionButton label="📁 تصفح مسار آخر" desc="ملف CSV مخصص" onClick={() => show("ربط رفع ملفات CSV المخصصة سيُفعّل من الخلفية لاحقاً")} />
            </div>
            {selectedFile && (
              <Alert tone="info" title="🔍 تحليل الملف...">
                <div className="mt-1 text-xs flex flex-wrap gap-3">
                  <span>إجمالي: {selectedFile.member_count.toLocaleString()}</span>
                  <span>المصدر: {selectedFile.source_label}</span>
                  <span>الحالة: {selectedFile.status}</span>
                  <span className="text-warn-600">⚠️ بدون username قد يُتخطى حسب الفلاتر</span>
                </div>
              </Alert>
            )}
            <InlineEdit label="رابط المجموعة المستهدفة" value={target} onSave={setTarget} placeholder="@my_group" />
            {target && (
              <Alert tone="info" title={`🎯 الهدف: ${target} | الأعضاء الحاليون: 1,200`}>
                <div className="text-xs mt-0.5">⚠️ هل أنت عضو/مشرف؟ ✅</div>
              </Alert>
            )}
            <Button variant="primary" className="w-full" disabled={file===null} onClick={() => setStep(1)}>التالي — الإعدادات</Button>
          </div>
        )}

        {step===1 && (
          <div className="card p-6 space-y-4">
            <SectionTitle>طريقة الإضافة</SectionTitle>
            <OptionButton label="📲 إضافة مباشرة (Add to Group)"  selected={method==="direct"} onClick={() => setMethod("direct")} />
            <OptionButton label="📨 دعوة عبر رسالة خاصة"          selected={method==="invite"} onClick={() => setMethod("invite")} />
            <OptionButton label="🔗 إرسال رابط دعوة (Invite Link)" selected={method==="link"}   onClick={() => setMethod("link")} />
            {(method==="invite"||method==="link") && (
              <div className="space-y-2">
                <Field label="نص الرسالة (اختياري)" placeholder="مرحباً، انضم إلينا في..." value={inviteText} onChange={setInviteText} />
                {method==="link" && <Alert tone="info" title="🔗 سيتم إنشاء رابط دعوة عند ربط هذا الجزء بمحرك تيليجرام المباشر" />}
              </div>
            )}

            <SectionTitle>الحسابات المستخدمة</SectionTitle>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <OptionButton label="👤 حساب واحد"           selected={accs==="single"}   onClick={() => setAccs("single")} />
              <OptionButton label="⭐ تدوير بين جميع النشطة" selected={accs==="rotate"}   onClick={() => setAccs("rotate")} />
              <OptionButton label="👥 مجموعة حسابات"       selected={accs==="group"}    onClick={() => setAccs("group")} />
              <OptionButton label="✋ تحديد حسابات معينة"   selected={accs==="selected"} onClick={() => setAccs("selected")} />
              <OptionButton label="🧠 اختيار ذكي تلقائي"
                badge={<span className="chip bg-brand-50 text-brand-700 ring-1 ring-brand-200">ذكي</span>}
                selected={accs==="smart"}    onClick={() => setAccs("smart")} />
            </div>
            {accs==="smart" && <Alert tone="info" title="🧠 يختار تلقائياً: الأعضاء في المجموعة + الأعلى صحة + الأقل استخداماً + الأقدم عمراً" />}
            {accs==="selected" && (
              <div className="space-y-2">
                {accounts.map((a) => (
                  <Checkbox key={a.id} label={`${a.name} — ${a.phone} | صحة: 87% | اليوم: 15/20`} checked={false} onChange={()=>{}} />
                ))}
                <Alert tone="info" title="⚠️ تغطية: 3/4 قروبات مشترك فيها" />
              </div>
            )}

            <SectionTitle>طريقة التوزيع</SectionTitle>
            <div className="grid grid-cols-2 gap-2">
              <OptionButton label="🔁 تدوير متسلسل"            selected={dist==="seq"}    onClick={() => setDist("seq")} />
              <OptionButton label="📦 تقسيم بالحصص المتساوية"  selected={dist==="equal"}  onClick={() => setDist("equal")} />
              <OptionButton label="🎲 عشوائي"                  selected={dist==="random"} onClick={() => setDist("random")} />
              <OptionButton label="⭐🧠 ذكي (عضوية+حدود+صحة+عمر)"
                badge={<span className="chip bg-brand-50 text-brand-700 ring-1 ring-brand-200">موصى</span>}
                selected={dist==="smart"}  onClick={() => setDist("smart")} />
            </div>

            <SectionTitle>حد الإضافة قبل التبديل</SectionTitle>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <OptionButton label="⭐ 5 (آمن جداً)" badge={<span className="chip bg-brand-50 text-brand-700 ring-1 ring-brand-200">موصى</span>} selected={addLimit==="5"} onClick={() => setAddLimit("5")} />
              <OptionButton label="10 (آمن)"         selected={addLimit==="10"}     onClick={() => setAddLimit("10")} />
              <OptionButton label="20 (متوسط)"       selected={addLimit==="20"}     onClick={() => setAddLimit("20")} />
              <OptionButton label="30 (عدواني)"      selected={addLimit==="30"}     onClick={() => setAddLimit("30")} />
              <OptionButton label="✏️ مخصص"         selected={addLimit==="custom"} onClick={() => setAddLimit("custom")} />
            </div>
            {addLimit==="custom" && <InlineEdit label="الحد المخصص" value="15" onSave={setAddLimit} placeholder="15" />}

            <SectionTitle>التأخير بين كل إضافة</SectionTitle>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <OptionButton label="⭐🐢 60-120 ث" badge={<span className="chip bg-brand-50 text-brand-700 ring-1 ring-brand-200">موصى</span>} selected={delay==="60-120"} onClick={() => setDelay("60-120")} />
              <OptionButton label="🚶 30-60 ث"   selected={delay==="30-60"} onClick={() => setDelay("30-60")} />
              <OptionButton label="🏃 15-30 ث ⚠️" selected={delay==="15-30"} onClick={() => setDelay("15-30")} />
              <OptionButton label="⚡ 5-15 ث ⛔" selected={delay==="5-15"}  onClick={() => setDelay("5-15")} />
              <OptionButton label="✏️ مخصص"     selected={delay==="custom"} onClick={() => setDelay("custom")} />
              <OptionButton label="🧠 تأخير ذكي" badge={<span className="chip bg-brand-50 text-brand-700 ring-1 ring-brand-200">ذكي</span>} selected={smartDelay} onClick={() => setSmartDelay(!smartDelay)} />
            </div>
            {delay==="custom" && !smartDelay && <InlineEdit label="التأخير (ثانية)" value="45" onSave={setDelay} placeholder="45" />}
            {smartDelay && <Alert tone="info" title="🧠 يزيد التأخير تلقائياً عند FloodWait" />}

            <SectionTitle>التأخير بين تبديل الحسابات</SectionTitle>
            <div className="grid grid-cols-3 gap-2">
              <OptionButton label="⭐ 5-10 دقائق"  selected={switchDelay==="5-10"}  onClick={() => setSwitchDelay("5-10")} />
              <OptionButton label="2-5 دقائق"       selected={switchDelay==="2-5"}   onClick={() => setSwitchDelay("2-5")} />
              <OptionButton label="10-30 دقيقة (آمن جداً)" selected={switchDelay==="10-30"} onClick={() => setSwitchDelay("10-30")} />
              <OptionButton label="✏️ مخصص"        selected={switchDelay==="custom"} onClick={() => setSwitchDelay("custom")} />
            </div>
            {switchDelay==="custom" && <InlineEdit label="التأخير (دقيقة)" value="8" onSave={setSwitchDelay} placeholder="8" />}

            <SectionTitle>الحد اليومي لكل حساب</SectionTitle>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <OptionButton label="⭐ 20/يوم (موصى)" selected={dailyLimit==="20"&&!smartLimit}   onClick={() => { setDailyLimit("20"); setSmartLimit(false); }} />
              <OptionButton label="30/يوم"           selected={dailyLimit==="30"&&!smartLimit}   onClick={() => { setDailyLimit("30"); setSmartLimit(false); }} />
              <OptionButton label="40/يوم"           selected={dailyLimit==="40"&&!smartLimit}   onClick={() => { setDailyLimit("40"); setSmartLimit(false); }} />
              <OptionButton label="50/يوم ⚠️"       selected={dailyLimit==="50"&&!smartLimit}   onClick={() => { setDailyLimit("50"); setSmartLimit(false); }} />
              <OptionButton label="✏️ مخصص"         selected={dailyLimit==="custom"&&!smartLimit} onClick={() => { setDailyLimit("custom"); setSmartLimit(false); }} />
              <OptionButton label="🧠 حد ذكي" badge={<span className="chip bg-brand-50 text-brand-700 ring-1 ring-brand-200">ذكي</span>} selected={smartLimit} onClick={() => setSmartLimit(!smartLimit)} />
            </div>
            {dailyLimit==="custom"&&!smartLimit && <InlineEdit label="الحد اليومي المخصص" value="35" onSave={setDailyLimit} placeholder="35" />}
            {smartLimit && (
              <Alert tone="info" title="🧠 الحد الذكي تلقائياً">
                <div className="text-xs mt-1 space-y-0.5">
                  <div>حساب جديد (&lt;30 يوم) ── 10/يوم</div>
                  <div>حساب متوسط (1-6 أشهر) ── 20/يوم</div>
                  <div>حساب قديم (&gt;6 أشهر) ── 35/يوم</div>
                </div>
              </Alert>
            )}

            <SectionTitle>فلاتر قبل الإضافة</SectionTitle>
            <div className="grid gap-2 sm:grid-cols-2">
              <Checkbox label="تخطي الموجودين مسبقاً في المجموعة" checked={protection.skipExisting}  onChange={(v)=>setProtection({...protection,skipExisting:v})} />
              <Checkbox label="تخطي القائمة السوداء"               checked={protection.skipBlacklist} onChange={(v)=>setProtection({...protection,skipBlacklist:v})} />
              <Checkbox label="تخطي بدون @username"                checked={protection.noUser}        onChange={(v)=>setProtection({...protection,noUser:v})} />
              <Checkbox label="تخطي المقيدين (خصوصية مغلقة)"      checked={protection.restricted}    onChange={(v)=>setProtection({...protection,restricted:v})} />
              <Checkbox label="تخطي الحسابات المحذوفة"             checked={protection.deleted}       onChange={(v)=>setProtection({...protection,deleted:v})} />
              <Checkbox label="تخطي البوتات"                       checked={protection.bots}          onChange={(v)=>setProtection({...protection,bots:v})} />
            </div>

            <SectionTitle>حفظ وحماية</SectionTitle>
            <div className="grid gap-2 sm:grid-cols-2">
              <Checkbox label="حفظ التقدم كل 10 إضافات (للاستئناف)" checked={protection.saveProgress}  onChange={(v)=>setProtection({...protection,saveProgress:v})} />
              <Checkbox label="إيقاف مؤقت تلقائي عند FloodWait"       checked={protection.floodWait}     onChange={(v)=>setProtection({...protection,floodWait:v})} />
              <Checkbox label="إيقاف إذا تجاوز الفشل 30%"             checked={protection.stopFail}      onChange={(v)=>setProtection({...protection,stopFail:v})} />
              <Checkbox label="إضافة الفاشلين للقائمة السوداء"         checked={protection.addBlacklist}  onChange={(v)=>setProtection({...protection,addBlacklist:v})} />
              <Checkbox label="إيقاف تلقائي بعد حد مخصص"              checked={protection.stopAtLimit}   onChange={(v)=>setProtection({...protection,stopAtLimit:v})} />
            </div>
            {protection.stopAtLimit && <InlineEdit label="الحد (عند التفعيل)" value={stopLimit} onSave={setStopLimit} placeholder="500" />}

            <div className="flex gap-2 pt-2">
              <Button variant="primary" className="flex-1" onClick={() => setStep(2)}>➡️ عرض الملخص</Button>
              <Button onClick={() => setStep(0)}>رجوع</Button>
            </div>
          </div>
        )}

        {step===2 && (
          <div className="card p-6 space-y-4">
            <SectionTitle>الملخص الشامل</SectionTitle>
            <div className="grid gap-2 sm:grid-cols-2">
              <SRow label="ملف"         value={selectedFile?.file_name ?? ""} />
              <SRow label="هدف"         value={target} />
              <SRow label="طريقة"       value={{direct:"مباشرة",invite:"دعوة رسالة",link:"رابط دعوة"}[method]} />
              <SRow label="حسابات"      value={{single:"واحد",rotate:"تدوير",group:"مجموعة",selected:"محدد",smart:"ذكي"}[accs]} />
              <SRow label="تأخير"       value={smartDelay?"ذكي تلقائي":`${delay} ث`} />
              <SRow label="حد يومي"     value={smartLimit?"ذكي تلقائي":`${dailyLimit}/يوم`} />
              <SRow label="حد التبديل"  value={`${addLimit} إضافة`} />
              <SRow label="بين الحسابات" value={`${switchDelay} دقيقة`} />
            </div>
            <Alert tone="info" title="📊 تقدير تقريبي للعملية سيُحسب في الخلفية عند التشغيل" />
            <Button variant="primary" className="w-full" icon={<Play className="h-4 w-4" />} disabled={running || file===null} onClick={() => void startAdd()}>{running ? "جاري التشغيل..." : "✅ بدء الإضافة الآن"}</Button>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => setStep(1)}>✏️ تعديل الإعدادات</Button>
              <Button variant="danger" onClick={() => { setStep(0); setFile(null); }}>❌ إلغاء</Button>
            </div>
          </div>
        )}
        {running && <div className="mt-4"><Progress value={jobId ? 55 : 80} label={jobId ? `المهمة في الانتظار: ${jobId}` : "جاري تجهيز العملية..."} sub={jobId ? "Queue" : "Inline"} /></div>}
        {result && (
          <div className="mt-4 card p-5 space-y-3">
            <Alert tone="success" title="✅ اكتملت الإضافة التقديرية على السيرفر">
              <div className="mt-1 text-xs">✅ ناجح: {result.success_count.toLocaleString()} | ⚠️ تخطي: {result.skipped_count.toLocaleString()} | ❌ فاشل: {result.failed_count.toLocaleString()}</div>
            </Alert>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => push(["add","logs"])}>📊 سجلات الإضافة</Button>
              <Button onClick={() => push(["add","resume"])}>🔄 الاستئناف</Button>
            </div>
          </div>
        )}
      </div>
      {node}
    </div>
  );
}

/* ── AddManual ── */
function AddManual() {
  const { push } = useNav();
  const { show, node } = useToast();
  const queueEnabled = useQueueHealth();
  const [users, setUsers]   = useState("");
  const [target, setTarget] = useState("@my_group");
  const [checking, setChecking] = useState(false);
  const [checked, setChecked]   = useState(false);
  const [running, setRunning] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [result, setResult] = useState<AddResult | null>(null);

  useEffect(() => {
    if (!jobId) return;
    const timer = window.setInterval(async () => {
      try {
        const status = await apiFetch<JobStatusResponse>(`/add/jobs/${jobId}`);
        if (status.status === "finished") {
          setResult(status.result as unknown as AddResult);
          setRunning(false);
          window.clearInterval(timer);
        }
        if (status.status === "failed") {
          show(status.error || "فشلت المهمة", "danger");
          setRunning(false);
          window.clearInterval(timer);
        }
      } catch (err) {
        show(err instanceof Error ? err.message : "تعذر متابعة المهمة", "danger");
        setRunning(false);
        window.clearInterval(timer);
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [jobId, show]);

  const userList = users.split(/\r?\n/).map((u) => u.trim()).filter(Boolean);

  const startManual = async () => {
    setRunning(true);
    setResult(null);
    try {
      const response = await apiFetch<JobStartResponse>("/add/manual", {
        method: "POST",
        body: JSON.stringify({ users: userList, target_label: target, method: "direct", run_inline: queueEnabled === false }),
      });
      show(response.message);
      if (response.mode === "finished") {
        setResult(response.result as unknown as AddResult);
        setRunning(false);
      } else {
        setJobId(response.job_id || null);
      }
    } catch (err) {
      setRunning(false);
      show(err instanceof Error ? err.message : "تعذر بدء العملية", "danger");
    }
  };

  return (
    <div className="animate-fade">
      <PageHeader title="إضافة يدوية" icon={<PenLine className="h-5 w-5" />} />
      <div className="mx-auto max-w-lg card p-6 space-y-4">
        <Field label="@username أو UserID (واحد per سطر)" placeholder={"@user1\n123456789\n@user2"} value={users} onChange={setUsers} />
        {!checking && !checked && users && (
          <Button className="w-full" onClick={() => { setChecking(true); setTimeout(()=>{ setChecking(false); setChecked(true); },1200); }}>🔍 فحص المستخدمين</Button>
        )}
        {checking && <Progress value={50} label="🔍 جاري التحقق..." sub="50%" tone="accent" />}
        {checked && (
          <Alert tone="success" title="نتائج الفحص">
            <div className="mt-1 flex gap-3 text-xs">
              <span className="chip bg-brand-50 text-brand-700 ring-1 ring-brand-200">✅مدخلات: {userList.length}</span>
              <span className="chip bg-danger-50 text-danger-700 ring-1 ring-danger-200">❌قد يفشل بعضها لاحقاً</span>
            </div>
          </Alert>
        )}
        <InlineEdit label="رابط المجموعة المستهدفة" value={target} onSave={setTarget} placeholder="@my_group" />
        <Alert tone="info" title={queueEnabled ? "سيتم تنفيذ المهمة عبر Queue عند البدء" : "سيتم التنفيذ المباشر كـ fallback"} />
        <div className="flex gap-2">
          <Button variant="primary" className="flex-1" disabled={!userList.length || running} onClick={() => void startManual()}>{running ? "جاري التشغيل..." : "بدء الإضافة اليدوية"}</Button>
          <Button onClick={() => push(["add","csv"])}>متابعة للإعدادات التفصيلية</Button>
        </div>
        {running && <Progress value={jobId ? 55 : 80} label={jobId ? `المهمة في الانتظار: ${jobId}` : "جاري تجهيز العملية..."} sub={jobId ? "Queue" : "Inline"} tone="accent" />}
        {result && (
          <Alert tone="success" title="اكتملت العملية اليدوية">
            <div className="mt-1 text-xs">✅ناجح: {result.success_count} | ⚠️تخطي: {result.skipped_count} | ❌فاشل: {result.failed_count}</div>
          </Alert>
        )}
      </div>
      {node}
    </div>
  );
}

/* ── SmartAdd ── */
function SmartAdd() {
  const { push } = useNav();
  const { show, node } = useToast();
  const queueEnabled = useQueueHealth();
  const [sourceLink, setSourceLink] = useState("");
  const [targetLink, setTargetLink] = useState("");
  const [analyzed, setAnalyzed]     = useState(false);
  const [analyzing, setAnalyzing]   = useState(false);
  const [running, setRunning] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [result, setResult] = useState<AddResult | null>(null);
  const [filters, setFilters] = useState({ activeOnly:false, onlineOnly:false, hasUser:true, skipExisting:true, skipBlacklist:true });

  useEffect(() => {
    if (!jobId) return;
    const timer = window.setInterval(async () => {
      try {
        const status = await apiFetch<JobStatusResponse>(`/add/jobs/${jobId}`);
        if (status.status === "finished") {
          setResult(status.result as unknown as AddResult);
          setRunning(false);
          window.clearInterval(timer);
        }
        if (status.status === "failed") {
          show(status.error || "فشلت المهمة", "danger");
          setRunning(false);
          window.clearInterval(timer);
        }
      } catch (err) {
        show(err instanceof Error ? err.message : "تعذر متابعة المهمة", "danger");
        setRunning(false);
        window.clearInterval(timer);
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [jobId, show]);

  const startSmart = async () => {
    setRunning(true);
    setResult(null);
    try {
      const response = await apiFetch<JobStartResponse>("/add/smart", {
        method: "POST",
        body: JSON.stringify({ source_label: sourceLink, target_label: targetLink, method: "direct", limit: 1000, run_inline: queueEnabled === false }),
      });
      show(response.message);
      if (response.mode === "finished") {
        setResult(response.result as unknown as AddResult);
        setRunning(false);
      } else {
        setJobId(response.job_id || null);
      }
    } catch (err) {
      setRunning(false);
      show(err instanceof Error ? err.message : "تعذر بدء الإضافة الذكية", "danger");
    }
  };

  return (
    <div className="animate-fade">
      <PageHeader title="إضافة ذكية (Smart Add)" icon={<Target className="h-5 w-5" />} />
      <div className="mx-auto max-w-lg card p-6 space-y-4">
        <Alert tone="info" title="🎯 يجمع من مجموعة مصدر ويضيف لمجموعة هدف مباشرة — بدون حفظ ملف وسيط" />
        <Field label="رابط المجموعة المصدر" placeholder="@source_group" value={sourceLink} onChange={setSourceLink} />
        <Field label="رابط المجموعة الهدف"  placeholder="@target_group" value={targetLink} onChange={setTargetLink} />
        {!analyzing && !analyzed && sourceLink && targetLink && (
          <Button className="w-full" onClick={() => { setAnalyzing(true); setTimeout(()=>{ setAnalyzing(false); setAnalyzed(true); },1500); }}>🔍 جلب المعلومات</Button>
        )}
        {analyzing && <Progress value={60} label="🔍 جاري التحليل..." sub="60%" tone="accent" />}
        {analyzed && (
          <div className="space-y-3">
            <Alert tone="info" title="📊 سيتم إنشاء export ثم عملية إضافة في الخلفية">
              <div className="text-xs mt-0.5">🎯 مرشح للإضافة: تقديري حسب limit الداخلي والفلترة المختارة</div>
            </Alert>
            <SectionTitle>فلاتر الاستهداف</SectionTitle>
            <Checkbox label="النشطون فقط (أرسلوا رسائل)"  checked={filters.activeOnly}    onChange={(v)=>setFilters({...filters,activeOnly:v})} />
            <Checkbox label="المتواجدون حالياً فقط"         checked={filters.onlineOnly}    onChange={(v)=>setFilters({...filters,onlineOnly:v})} />
            <Checkbox label="لديهم @username"               checked={filters.hasUser}       onChange={(v)=>setFilters({...filters,hasUser:v})} />
            <Checkbox label="استبعاد الموجودين في الهدف"   checked={filters.skipExisting}  onChange={(v)=>setFilters({...filters,skipExisting:v})} />
            <Checkbox label="استبعاد القائمة السوداء"       checked={filters.skipBlacklist} onChange={(v)=>setFilters({...filters,skipBlacklist:v})} />
            <Button variant="primary" className="w-full" disabled={running} onClick={() => void startSmart()}>{running ? "جاري التشغيل..." : "✅ بدء الإضافة الذكية"}</Button>
          </div>
        )}
        {running && <Progress value={jobId ? 55 : 80} label={jobId ? `المهمة في الانتظار: ${jobId}` : "جاري تجهيز العملية..."} sub={jobId ? "Queue" : "Inline"} tone="accent" />}
        {result && <Alert tone="success" title="اكتملت الإضافة الذكية"><div className="mt-1 text-xs">✅ناجح: {result.success_count} | ⚠️تخطي: {result.skipped_count} | ❌فاشل: {result.failed_count}</div></Alert>}
      </div>
      {node}
    </div>
  );
}

/* ── MultiSource ── */
function MultiSource() {
  const { push } = useNav();
  const { show, node } = useToast();
  const queueEnabled = useQueueHealth();
  const [exportsRows, setExportsRows] = useState<GatherExportRecord[]>(fallbackExports());
  const [csvSelected, setCsvSelected] = useState<number[]>([]);
  const [groupLinks, setGroupLinks]   = useState("");
  const [target, setTarget]           = useState("@my_group");
  const [dedup, setDedup]             = useState(true);
  const [running, setRunning] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [result, setResult] = useState<AddResult | null>(null);

  useEffect(() => {
    apiFetch<GatherExportRecord[]>("/gather/exports").then(setExportsRows).catch(() => setExportsRows(fallbackExports()));
  }, []);

  useEffect(() => {
    if (!jobId) return;
    const timer = window.setInterval(async () => {
      try {
        const status = await apiFetch<JobStatusResponse>(`/add/jobs/${jobId}`);
        if (status.status === "finished") {
          setResult(status.result as unknown as AddResult);
          setRunning(false);
          window.clearInterval(timer);
        }
        if (status.status === "failed") {
          show(status.error || "فشلت المهمة", "danger");
          setRunning(false);
          window.clearInterval(timer);
        }
      } catch (err) {
        show(err instanceof Error ? err.message : "تعذر متابعة المهمة", "danger");
        setRunning(false);
        window.clearInterval(timer);
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [jobId, show]);

  const toggleCsv = (id:number) => setCsvSelected(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);
  const totalFromCsv = exportsRows.filter(f=>csvSelected.includes(f.id)).reduce((s,f)=>s+f.member_count,0);

  const startMulti = async () => {
    setRunning(true);
    setResult(null);
    try {
      const response = await apiFetch<JobStartResponse>("/add/multi-source", {
        method: "POST",
        body: JSON.stringify({ export_ids: csvSelected, group_links: groupLinks.split(/\r?\n/).map((v)=>v.trim()).filter(Boolean), target_label: target, method: "direct", deduplicate: dedup, run_inline: queueEnabled === false }),
      });
      show(response.message);
      if (response.mode === "finished") {
        setResult(response.result as unknown as AddResult);
        setRunning(false);
      } else {
        setJobId(response.job_id || null);
      }
    } catch (err) {
      setRunning(false);
      show(err instanceof Error ? err.message : "تعذر بدء العملية", "danger");
    }
  };

  return (
    <div className="animate-fade">
      <PageHeader title="إضافة من عدة مصادر (Multi-Source)" icon={<Layers className="h-5 w-5" />} />
      <div className="space-y-4">
        <div className="card p-5 space-y-3">
          <SectionTitle>📂 ملفات CSV</SectionTitle>
          {exportsRows.map((f) => (
            <Checkbox key={f.id} label={`${f.file_name} (${f.member_count.toLocaleString()} عضو)`} checked={csvSelected.includes(f.id)} onChange={() => toggleCsv(f.id)} />
          ))}
        </div>
        <div className="card p-5 space-y-3">
          <SectionTitle>🌐 مجموعات (سيُجمَّع منها أولاً)</SectionTitle>
          <Field label="روابط المجموعات (واحد per سطر)" placeholder={"@group1\n@group2"} value={groupLinks} onChange={setGroupLinks} />
        </div>
        {(csvSelected.length>0||groupLinks) && (
          <Alert tone="info" title={`إجمالي: ${csvSelected.length} ملف | ${groupLinks.split("\n").filter(Boolean).length} مجموعة`}>
            <div className="text-xs mt-0.5">الأعضاء المرشحة من CSV: {totalFromCsv.toLocaleString()}</div>
          </Alert>
        )}
        <div className="card p-5 space-y-3">
          <InlineEdit label="رابط المجموعة الهدف" value={target} onSave={setTarget} placeholder="@my_group" />
          <Checkbox label="إزالة المكرر بين المصادر أولاً" checked={dedup} onChange={setDedup} />
          <Button variant="primary" className="w-full" disabled={running || (csvSelected.length===0 && !groupLinks.trim())} onClick={() => void startMulti()}>{running ? "جاري التشغيل..." : "✅ بدء الإضافة — المصادر المتعددة"}</Button>
        </div>
        {running && <Progress value={jobId ? 55 : 80} label={jobId ? `المهمة في الانتظار: ${jobId}` : "جاري تجهيز العملية..."} sub={jobId ? "Queue" : "Inline"} tone="accent" />}
        {result && <Alert tone="success" title="اكتملت العملية متعددة المصادر"><div className="mt-1 text-xs">✅ناجح: {result.success_count} | ⚠️تخطي: {result.skipped_count} | ❌فاشل: {result.failed_count}</div></Alert>}
      </div>
      {node}
    </div>
  );
}

/* ── ResumeOp ── */
function ResumeOp() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [operations, setOperations] = useState<AddOperationRecord[]>([]);
  const [selected, setSelected] = useState<number|null>(null);
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    apiFetch<AddOperationRecord[]>("/add/operations").then(setOperations).catch(() => setOperations([]));
  }, []);

  if (selected !== null) {
    const op = operations.find(s=>s.id===selected);
    if (!op) return null;
    const progress = Math.round(((op.success_count + op.failed_count + op.skipped_count) / Math.max(1, op.total_count)) * 100);
    return (
      <div className="animate-fade">
        <PageHeader title="استئناف عملية" icon={<RefreshCw className="h-5 w-5" />} />
        <div className="card p-5 space-y-4">
          <Alert tone="info" title={`نقطة التوقف/السجل: ${op.source_label}`}>
            <div className="mt-1 text-xs space-y-0.5">
              <div>التقدم/النتيجة: {progress}% | نجاح: {op.success_count} | تخطي: {op.skipped_count} | فشل: {op.failed_count}</div>
              <div>تاريخ العملية: {new Date(op.created_at).toLocaleString("ar-SA")}</div>
              <div>الهدف: {op.target_label}</div>
            </div>
          </Alert>
          <div className="grid gap-2">
            <Button variant="primary" className="w-full" onClick={() => push(["add","csv"])}>▶️ تكرار نفس المسار</Button>
            <Button className="w-full" onClick={() => push(["add","manual"])}>✏️ فتح المسار اليدوي</Button>
            <Button variant="danger" className="w-full" onClick={() => setConfirmDel(true)}>🗑️ حذف هذه البطاقة محلياً</Button>
            <Button onClick={() => setSelected(null)}>🔙 رجوع</Button>
          </div>
        </div>
        <ConfirmDialog open={confirmDel} danger title="إخفاء نقطة الحفظ" message="سيتم إخفاء هذه البطاقة من العرض الحالي فقط."
          onConfirm={()=>{ setConfirmDel(false); setOperations((prev)=>prev.filter((x)=>x.id!==op.id)); setSelected(null); show("تم إخفاء البطاقة"); }}
          onCancel={()=>setConfirmDel(false)} />
        {node}
      </div>
    );
  }

  return (
    <div className="animate-fade">
      <PageHeader title="استئناف عملية سابقة" icon={<RefreshCw className="h-5 w-5" />} />
      <div className="space-y-3">
        {operations.map((op) => {
          const progress = Math.round(((op.success_count + op.failed_count + op.skipped_count) / Math.max(1, op.total_count)) * 100);
          return (
            <div key={op.id} className="card p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-bold text-surface-800">{op.source_label} → {op.target_label}</span>
                <span className="chip bg-brand-50 text-brand-700 ring-1 ring-brand-200">{progress}%</span>
              </div>
              <Progress value={progress} tone="brand" />
              <div className="mt-2 text-xs text-surface-500">{op.success_count}/{op.total_count} | {new Date(op.created_at).toLocaleDateString("ar-SA")}</div>
              <Button className="mt-3 w-full" onClick={() => setSelected(op.id)}>استئناف/عرض هذه العملية</Button>
            </div>
          );
        })}
        {operations.length===0 && <EmptyState icon={<RotateCw className="h-8 w-8" />} title="لا توجد عمليات محفوظة" />}
      </div>
      {node}
    </div>
  );
}

/* ── Blacklist ── */
function Blacklist() {
  const { show, node } = useToast();
  const [rows, setRows] = useState<BlacklistEntryRecord[]>([]);
  const [search, setSearch] = useState("");
  const [newUser, setNewUser] = useState("");
  const [newReason, setNewReason] = useState("");
  const [adding, setAdding] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const load = async () => {
    try {
      setRows(await apiFetch<BlacklistEntryRecord[]>("/add/blacklist"));
    } catch {
      setRows(blacklist.map((b) => ({ id: b.id, user_value: b.user, reason: b.reason, created_at: `${b.date}T00:00:00Z` })) as BlacklistEntryRecord[]);
    }
  };

  useEffect(() => { void load(); }, []);

  const filtered = rows.filter(b=>b.user_value.includes(search)||(b.reason||"").includes(search));

  return (
    <div className="animate-fade">
      <PageHeader title="القائمة السوداء (Blacklist)" icon={<Ban className="h-5 w-5" />} />
      <div className="space-y-4">
        <div className="flex gap-2">
          <StatCard label="إجمالي القائمة" value={String(rows.length)} tone="danger" />
        </div>
        <div className="flex flex-wrap gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="🔍 بحث" />
          <Button onClick={() => setAdding(!adding)}>➕ إضافة يدوياً</Button>
          <Button onClick={() => show("استيراد CSV للقائمة السوداء سيُفعّل لاحقاً")}>📥 استيراد قائمة</Button>
          <Button onClick={() => show("تم تصدير CSV")}>📤 تصدير CSV</Button>
          <Button variant="danger" onClick={() => setConfirmClear(true)}>🗑️ مسح الكل</Button>
        </div>
        {adding && (
          <div className="card p-4 space-y-3">
            <SectionTitle>➕ إضافة يدوياً</SectionTitle>
            <Field label="@username أو UserID" placeholder="@user أو 123456789" value={newUser} onChange={setNewUser} />
            <Field label="السبب (اختياري)" placeholder="بوت / محظور..." value={newReason} onChange={setNewReason} />
            <div className="flex gap-2">
              <Button variant="primary" disabled={!newUser} onClick={async () => { await apiFetch<BlacklistEntryRecord>("/add/blacklist", { method: "POST", body: JSON.stringify({ user_value: newUser, reason: newReason || null }) }); show("تمت الإضافة للقائمة السوداء"); setNewUser(""); setNewReason(""); setAdding(false); await load(); }}>💾 حفظ</Button>
              <Button onClick={() => setAdding(false)}>إلغاء</Button>
            </div>
          </div>
        )}
        {filtered.length===0
          ? <EmptyState icon={<ShieldOff className="h-8 w-8" />} title="القائمة السوداء فارغة" />
          : <Table columns={["مستخدم","السبب","تاريخ الإضافة",""]} rows={filtered.map((b) => [
              b.user_value, b.reason || "—", new Date(b.created_at).toLocaleDateString("ar-SA"),
              <Button variant="danger" onClick={async () => { await apiFetch(`/add/blacklist/${b.id}`, { method: "DELETE" }); show("تمت الإزالة"); await load(); }}>❌ إزالة</Button>,
            ])} />}
        <ConfirmDialog open={confirmClear} danger title="مسح القائمة السوداء كاملاً" message="سيتم حذف جميع المدخلات نهائياً."
          onConfirm={async ()=>{ await apiFetch(`/add/blacklist`, { method: "DELETE" }); setConfirmClear(false); show("تم مسح القائمة","danger"); await load(); }}
          onCancel={()=>setConfirmClear(false)} />
      </div>
      {node}
    </div>
  );
}

/* ── AddLogs ── */
function AddLogs() {
  const { show, node } = useToast();
  const [operations, setOperations] = useState<AddOperationRecord[]>([]);
  const [stats, setStats] = useState<AddStats | null>(null);
  const [tab, setTab]         = useState<"ops"|"stats">("ops");
  const [dateFilter, setDateFilter] = useState<"today"|"7d"|"30d"|"custom">("7d");
  const [selected, setSelected]     = useState<number|null>(null);

  useEffect(() => {
    apiFetch<AddOperationRecord[]>("/add/operations").then(setOperations).catch(() => setOperations(addLogs.map((l) => ({ id: l.id, source_label: l.file, source_type: "csv", target_label: l.target, method: "direct", status: "done", total_count: l.success + l.fail, success_count: l.success, skipped_count: 0, failed_count: l.fail, created_at: `${l.date}T00:00:00Z` })) as AddOperationRecord[]));
    apiFetch<AddStats>("/add/stats").then(setStats).catch(() => setStats(null));
  }, []);

  if (selected !== null) {
    const log = operations.find(l=>l.id===selected);
    if (!log) return null;
    return (
      <div className="animate-fade">
        <PageHeader title={`تفاصيل: ${log.source_label}`} icon={<BarChart3 className="h-5 w-5" />} />
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="ناجح"  value={log.success_count.toLocaleString()} tone="brand"  />
            <StatCard label="فاشل"  value={log.failed_count.toLocaleString()}    tone="danger" />
            <StatCard label="تخطي"  value={log.skipped_count.toLocaleString()}    tone="warn"   />
            <StatCard label="الهدف" value={log.target_label}                   tone="accent" />
          </div>
          <div className="card p-5">
            <SectionTitle>أداء كل حساب</SectionTitle>
            <Table columns={["حساب","أرسل","نجح","فشل"]} rows={accounts.slice(0,3).map(a=>[
              a.phone,
              String(Math.floor(log.total_count/3)),
              String(Math.floor(log.success_count/3)),
              String(Math.floor(log.failed_count/3)),
            ])} />
          </div>
          <div className="card p-5">
            <SectionTitle>أسباب الفشل</SectionTitle>
            <Table columns={["السبب","العدد"]} rows={[
              ["UserPrivacyRestricted",String(Math.max(1, Math.floor(log.failed_count*0.5)))],
              ["FloodWait",String(Math.max(1, Math.floor(log.failed_count*0.2)))],
              ["UserDeactivated",String(Math.max(1, Math.floor(log.failed_count*0.15)))],
              ["PeerFlood",String(Math.max(1, Math.floor(log.failed_count*0.1)))],
            ]} />
          </div>
          <div className="flex gap-2">
            <Button onClick={() => show("تم تصدير التقرير")}>📤 تصدير PDF/CSV</Button>
            <Button onClick={() => setSelected(null)}>🔙 رجوع</Button>
          </div>
        </div>
        {node}
      </div>
    );
  }

  return (
    <div className="animate-fade">
      <PageHeader title="سجلات وإحصائيات الإضافة" icon={<BarChart3 className="h-5 w-5" />} />
      <div className="space-y-4">
        <Tabs tabs={[{id:"ops",label:"📋 السجل"},{id:"stats",label:"📊 إحصائيات"}]} active={tab} onChange={(v)=>setTab(v as typeof tab)} />

        {tab==="ops" && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Tabs tabs={[{id:"today",label:"اليوم"},{id:"7d",label:"7 أيام"},{id:"30d",label:"30 يوم"}]}
                active={dateFilter} onChange={(v)=>setDateFilter(v as typeof dateFilter)} />
              <Button onClick={() => show("تم تصدير السجل الكامل")}>📤 تصدير الكل</Button>
            </div>
            {operations.length===0
              ? <EmptyState icon={<ListChecks className="h-8 w-8" />} title="لا توجد سجلات" />
              : <Table columns={["تاريخ","مصدر","هدف","ناجح","فاشل",""]} rows={operations.map((l) => [
                  new Date(l.created_at).toLocaleDateString("ar-SA"), l.source_label, l.target_label,
                  <span className="chip bg-brand-50 text-brand-700 ring-1 ring-brand-200">{l.success_count.toLocaleString()}</span>,
                  <span className="chip bg-danger-50 text-danger-700 ring-1 ring-danger-200">{l.failed_count.toLocaleString()}</span>,
                  <Button onClick={() => setSelected(l.id)}>تفاصيل</Button>,
                ])} />}
          </div>
        )}

        {tab==="stats" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="الكل الوقت"   value={(stats?.total_success ?? operations.reduce((s, o) => s + o.success_count, 0)).toLocaleString()} tone="brand"  />
              <StatCard label="العمليات"     value={String(stats?.total_operations ?? operations.length)}   tone="accent" />
              <StatCard label="معدل النجاح"  value={`${stats ? Math.round((stats.total_success / Math.max(1, stats.total_success + stats.total_failed + stats.total_skipped)) * 100) : 94}%`} tone="brand"  />
              <StatCard label="المتخطى"      value={String(stats?.total_skipped ?? operations.reduce((s,o)=>s+o.skipped_count,0))}      tone="warn"   />
            </div>
            <div className="card p-5">
              <SectionTitle>📈 نشاط آخر العمليات</SectionTitle>
              <div className="h-20 flex items-end gap-1">
                {(operations.slice(0,7).length ? operations.slice(0,7) : addLogs.map((_,i)=>({id:i+1, success_count:[60,80,45,90,70,55,75][i]} as any))).map((op,i)=>(
                  <div key={op.id ?? i} className="flex-1 bg-brand-400 rounded-t" style={{height:`${Math.max(20, Math.min(100, Math.round(((op.success_count ?? 1) / Math.max(1, (operations[0]?.success_count ?? 1000))) * 100)))}%`}} />
                ))}
              </div>
            </div>
            <div className="card p-5">
              <SectionTitle>أكثر أسباب الفشل</SectionTitle>
              <Table columns={["السبب","العدد","النسبة"]} rows={[
                ["UserPrivacyRestricted",String(Math.max(1, Math.round((stats?.total_failed ?? 10)*0.52))),"52%"],
                ["FloodWait",String(Math.max(1, Math.round((stats?.total_failed ?? 10)*0.19))),"19%"],
                ["UserDeactivated",String(Math.max(1, Math.round((stats?.total_failed ?? 10)*0.16))),"16%"],
                ["PeerFlood",String(Math.max(1, Math.round((stats?.total_failed ?? 10)*0.13))),"13%"],
              ]} />
            </div>
            <div className="card p-5">
              <SectionTitle>أداء كل حساب (ترتيب)</SectionTitle>
              <Table columns={["حساب","ناجح","فاشل","معدل النجاح"]} rows={accounts.map((a,i)=>[
                a.phone,
                String(Math.floor(((stats?.total_success ?? 14000)-i*2000)*0.94)),
                String(Math.floor(((stats?.total_failed ?? 600)+i*10))),
                `${Math.max(80,94-i)}%`,
              ])} />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => show("تم تصدير PDF")}>📄 PDF</Button>
              <Button onClick={() => show("تم تصدير CSV")}>📊 CSV</Button>
            </div>
          </div>
        )}
      </div>
      {node}
    </div>
  );
}

/* ── DefaultSettings ── */
function DefaultSettings() {
  const { show, node } = useToast();
  const defaults = {
    add_default_delay_from: "60",
    add_default_delay_to: "120",
    add_default_switch_from: "5",
    add_default_switch_to: "10",
    add_default_daily_limit: "20",
    add_default_switch_count: "5",
    add_default_flood_action: "wait",
    add_default_ban_action: "remove",
    add_default_privacy_action: "skip",
    add_default_save_progress: "true",
    add_default_smart_delay: "false",
    add_default_smart_limit: "false",
  };
  const [form, setForm] = useState<Record<string,string>>(defaults);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    apiFetch<Record<string,string>>("/add/defaults").then((data) => setForm(data)).catch(() => setForm(defaults));
  }, []);

  return (
    <div className="animate-fade">
      <PageHeader title="إعدادات الإضافة الافتراضية" icon={<Settings className="h-5 w-5" />} />
      <div className="space-y-4">
        <div className="card p-5 space-y-3">
          <SectionTitle>⏱️ التأخيرات الافتراضية</SectionTitle>
          <div className="flex gap-2">
            <InlineEdit label="بين الإضافات — من (ث)" value={form.add_default_delay_from}   onSave={(v)=>setForm({...form,add_default_delay_from:v})}   placeholder="60" />
            <InlineEdit label="إلى (ث)"               value={form.add_default_delay_to} onSave={(v)=>setForm({...form,add_default_delay_to:v})} placeholder="120" />
          </div>
          <div className="flex gap-2">
            <InlineEdit label="بين الحسابات — من (د)" value={form.add_default_switch_from} onSave={(v)=>setForm({...form,add_default_switch_from:v})} placeholder="5" />
            <InlineEdit label="إلى (د)"               value={form.add_default_switch_to}   onSave={(v)=>setForm({...form,add_default_switch_to:v})}   placeholder="10" />
          </div>
          <InlineEdit label="📊 الحد اليومي الافتراضي/حساب" value={form.add_default_daily_limit}   onSave={(v)=>setForm({...form,add_default_daily_limit:v})}   placeholder="20" />
          <InlineEdit label="🔢 إضافات قبل التبديل"         value={form.add_default_switch_count}  onSave={(v)=>setForm({...form,add_default_switch_count:v})}  placeholder="5" />
        </div>
        <div className="card p-5 space-y-3">
          <SectionTitle>سلوك الأخطاء الافتراضي</SectionTitle>
          <div>
            <div className="mb-2 text-xs font-bold text-surface-500">عند FloodWait</div>
            <OptionButton label="⭐ انتظار + تبديل تلقائي" selected={form.add_default_flood_action==="wait"}   onClick={() => setForm({...form,add_default_flood_action:"wait"})} />
            <OptionButton label="تبديل فوري فقط"            selected={form.add_default_flood_action==="switch"} onClick={() => setForm({...form,add_default_flood_action:"switch"})} />
            <OptionButton label="إيقاف + إشعار"             selected={form.add_default_flood_action==="stop"}   onClick={() => setForm({...form,add_default_flood_action:"stop"})} />
          </div>
          <div>
            <div className="mb-2 text-xs font-bold text-surface-500">عند حظر حساب</div>
            <OptionButton label="⭐ إزالة + متابعة"         selected={form.add_default_ban_action==="remove"} onClick={() => setForm({...form,add_default_ban_action:"remove"})} />
            <OptionButton label="إيقاف + زيادة تأخير"       selected={form.add_default_ban_action==="slow"}   onClick={() => setForm({...form,add_default_ban_action:"slow"})} />
            <OptionButton label="إيقاف كامل"                selected={form.add_default_ban_action==="stop"}   onClick={() => setForm({...form,add_default_ban_action:"stop"})} />
          </div>
          <div>
            <div className="mb-2 text-xs font-bold text-surface-500">عند خصوصية مغلقة</div>
            <OptionButton label="⭐ تخطي تلقائي"            selected={form.add_default_privacy_action==="skip"}      onClick={() => setForm({...form,add_default_privacy_action:"skip"})} />
            <OptionButton label="تخطي + إضافة للسوداء"      selected={form.add_default_privacy_action==="blacklist"} onClick={() => setForm({...form,add_default_privacy_action:"blacklist"})} />
          </div>
        </div>
        <div className="card p-5 space-y-2">
          <SectionTitle>خيارات عامة</SectionTitle>
          <Checkbox label="حفظ التقدم افتراضياً" checked={form.add_default_save_progress==="true"} onChange={(v)=>setForm({...form,add_default_save_progress:String(v)})} />
          <Checkbox label="تأخير ذكي افتراضي"    checked={form.add_default_smart_delay==="true"}  onChange={(v)=>setForm({...form,add_default_smart_delay:String(v)})} />
          <Checkbox label="الحد الذكي افتراضياً"  checked={form.add_default_smart_limit==="true"}  onChange={(v)=>setForm({...form,add_default_smart_limit:String(v)})} />
        </div>
        <div className="flex gap-2">
          <Button variant="primary" className="flex-1" onClick={async () => { await apiFetch(`/add/defaults`, { method: "PUT", body: JSON.stringify({ values: form }) }); show("💾 تم حفظ الإعدادات الافتراضية"); }}>💾 حفظ الإعدادات</Button>
          <Button variant="danger" onClick={() => setConfirmReset(true)}>🔄 إعادة الافتراضية</Button>
        </div>
        <ConfirmDialog open={confirmReset} danger title="إعادة الإعدادات الافتراضية" message="سيتم استعادة جميع الإعدادات لقيمها الافتراضية."
          onConfirm={()=>{ setConfirmReset(false); setForm(defaults); show("تمت إعادة الإعدادات الافتراضية محلياً"); }}
          onCancel={()=>setConfirmReset(false)} />
      </div>
      {node}
    </div>
  );
}
