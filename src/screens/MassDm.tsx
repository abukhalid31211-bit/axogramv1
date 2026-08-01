import { useEffect, useState } from "react";
import { Send, Plus, ListChecks, Play, Pause, Square, PenLine, Ban, BarChart3, Settings, Download, Trash2 } from "lucide-react";
import { useNav } from "../nav";
import { PageHeader, Button, Field, TextArea, Checkbox, OptionButton, Progress, Table, SectionTitle, Alert, useToast, Tabs, StatusChip, EmptyState, StatCard, Spinner } from "../ui";
import { JobProgressCard } from "../lib/job";
import { apiFetch, downloadApiFile, type CampaignRecord, type CampaignStats, type CampaignScheduleRecord, type CampaignProgress, type CampaignReport, type MessageTemplateRecord, type BlacklistEntryRecord, type GatherExportRecord, type JobStartResponse } from "../lib/api";

export function MassDmModule() {
  const { push } = useNav();
  const [rows, setRows] = useState<CampaignRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<CampaignRecord[]>("/campaigns?kind=dm").then(setRows).catch(() => undefined).finally(() => setLoading(false));
  }, []);

  const items = [
    { id: "new", label: "إنشاء حملة رسائل جديدة", desc: "معالج 6 خطوات", icon: Plus },
    { id: "list", label: "عرض حملات DM", desc: "كل الحملات", icon: ListChecks },
    { id: "resume", label: "استئناف حملة متوقفة", desc: "متابعة", icon: Play },
    { id: "templates", label: "قوالب رسائل DM", desc: "إنشاء وتعديل", icon: PenLine },
    { id: "blacklist", label: "القائمة السوداء", desc: "حظر مستخدمين", icon: Ban },
    { id: "stats", label: "إحصائيات", desc: "أداء الرسائل", icon: BarChart3 },
    { id: "settings", label: "إعدادات DM", desc: "افتراضيات", icon: Settings },
  ];
  return (
    <div className="animate-fade">
      <PageHeader title="الرسائل الجماعية (Mass DM)" subtitle="إرسال رسائل مباشرة حقيقية عبر تيليجرام" icon={<Send className="h-5 w-5" />} />
      {loading ? <Spinner label="جاري التحميل..." /> : (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="نشطة" value={rows.filter((r) => r.status === "active").length} tone="brand" />
          <StatCard label="متوقفة" value={rows.filter((r) => r.status === "paused").length} tone="warn" />
          <StatCard label="مكتملة" value={rows.filter((r) => r.status === "done").length} tone="accent" />
          <StatCard label="الإجمالي" value={rows.length} tone="brand" />
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <button key={it.id} onClick={() => push(["massdm", it.id])} className="card flex items-center gap-3 p-4 text-right transition hover:-translate-y-0.5 hover:border-accent-300 hover:shadow-pop">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-brand-200"><Icon className="h-5 w-5" /></div>
              <div><div className="text-sm font-bold text-surface-800">{it.label}</div><div className="text-xs text-surface-500">{it.desc}</div></div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function MassDmScreen({ sub }: { sub: string }) {
  switch (sub) {
    case "new": return <NewDm />;
    case "list": return <ListDm />;
    case "resume": return <ResumeDm />;
    case "blacklist": return <DmBlacklist />;
    case "templates": return <DmTemplates />;
    case "stats": return <DmStats />;
    case "settings": return <DmSettings />;
    default: return null;
  }
}

function NewDm() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [step, setStep] = useState(0);
  const [sourceType, setSourceType] = useState<"export" | "manual">("export");
  const [exports, setExports] = useState<GatherExportRecord[]>([]);
  const [selectedExport, setSelectedExport] = useState<number | null>(null);
  const [manualUsers, setManualUsers] = useState("");
  const [msgText, setMsgText] = useState("");
  const [delay, setDelay] = useState("60-120");
  const [switchCount, setSwitchCount] = useState("10");
  const [dailyLimit, setDailyLimit] = useState("30");
  const [startNow, setStartNow] = useState(true);
  const [creating, setCreating] = useState(false);
  const [campaignId, setCampaignId] = useState<number | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<CampaignProgress | null>(null);
  const [report, setReport] = useState<CampaignReport | null>(null);

  useEffect(() => {
    apiFetch<GatherExportRecord[]>("/gather/exports").then(setExports).catch(() => undefined);
  }, []);

  const steps = ["المستلمون", "الرسالة", "الحسابات", "التوقيت", "الحماية", "الملخص"];

  const pollProgress = (id: number) => {
    const timer = window.setInterval(async () => {
      try {
        const data = await apiFetch<CampaignProgress>(`/campaigns/${id}/progress`);
        setProgress(data);
        if (data.status === "done") {
          window.clearInterval(timer);
          try { setReport(await apiFetch<CampaignReport>(`/campaigns/${id}/report`)); } catch { /* ignore */ }
        }
        if (data.status === "paused") window.clearInterval(timer);
      } catch {
        window.clearInterval(timer);
      }
    }, 2000);
  };

  const startRun = async () => {
    setCreating(true);
    try {
      const recipientsJson = sourceType === "export"
        ? JSON.stringify({ source_type: "export", export_id: selectedExport })
        : JSON.stringify({ source_type: "manual", users: manualUsers.split("\n").map((u) => u.trim()).filter(Boolean) });
      const campaign = await apiFetch<CampaignRecord>("/campaigns", {
        method: "POST",
        body: JSON.stringify({
          name: `DM ${new Date().toLocaleDateString("ar")}`,
          kind: "dm",
          status: "draft",
          message_text: msgText,
          message_kind: "text",
          recipients_json: recipientsJson,
          settings_json: JSON.stringify({ delay_min: Number(delay.split("-")[0] || 60), delay_max: Number(delay.split("-")[1] || 120), switch_count: Number(switchCount), daily_limit: Number(dailyLimit), flood_action: "wait", ban_action: "remove", privacy_action: "skip" }),
        }),
      });
      setCampaignId(campaign.id);
      const response = await apiFetch<JobStartResponse>(`/campaigns/${campaign.id}/start`, { method: "POST", body: JSON.stringify({}) });
      setJobId(response.job_id || null);
      pollProgress(campaign.id);
      show("🚀 بدأت حملة DM الفعلية");
    } catch (err) {
      setCreating(false);
      show(err instanceof Error ? err.message : "تعذر إنشاء الحملة", "danger");
    }
  };

  const control = async (action: "pause" | "stop") => {
    if (!campaignId) return;
    try {
      await apiFetch(`/campaigns/${campaignId}/${action}`, { method: "POST", body: JSON.stringify({}) });
      show(action === "pause" ? "⏸️ أُوقفت مؤقتاً" : "⏹️ أُوقفت وحُفظ التقدم", action === "stop" ? "danger" : undefined);
      if (action === "stop") setProgress(null);
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر التنفيذ", "danger");
    }
  };

  const running = progress?.status === "active";

  return (
    <div className="animate-fade">
      <PageHeader title="إنشاء حملة رسائل جديدة" icon={<Plus className="h-5 w-5" />} steps={{ label: steps[step], n: step + 1, total: 6 }} />
      <div className="mx-auto max-w-2xl">
        {step === 0 && (
          <div className="card p-6 space-y-4">
            <SectionTitle>1/6 المستلمون</SectionTitle>
            <div className="space-y-2">
              <OptionButton label="📂 من ملف CSV (مستخرج سابقاً)" selected={sourceType === "export"} onClick={() => setSourceType("export")} />
              <OptionButton label="✍️ إدخال يدوي" selected={sourceType === "manual"} onClick={() => setSourceType("manual")} />
            </div>
            {sourceType === "export" && (
              <div className="rounded-xl border border-surface-200 bg-surface-50 p-3">
                <div className="max-h-56 space-y-2 overflow-auto">
                  {exports.map((e) => (
                    <OptionButton key={e.id} label={`${e.file_name} (${e.member_count.toLocaleString()} عضو)`} selected={selectedExport === e.id} onClick={() => setSelectedExport(e.id)} />
                  ))}
                  {exports.length === 0 && <p className="text-xs text-surface-500">لا توجد ملفات — جمّع أعضاء أولاً من قسم التجميع.</p>}
                </div>
              </div>
            )}
            {sourceType === "manual" && (
              <TextArea label="@username أو UserID (واحد per سطر)" rows={5} value={manualUsers} onChange={setManualUsers} placeholder={"@user1\n@user2"} />
            )}
            <Button variant="primary" className="w-full" disabled={sourceType === "export" ? selectedExport === null : !manualUsers.trim()} onClick={() => setStep(1)}>التالي</Button>
          </div>
        )}
        {step === 1 && (
          <div className="card p-6 space-y-4">
            <SectionTitle>2/6 تصميم الرسالة</SectionTitle>
            <TextArea label="نص الرسالة" rows={5} value={msgText} onChange={setMsgText} placeholder={"مرحباً {first_name}...\n{spin:عرض خاص اليوم|خصم لفترة محدودة}"} />
            <div className="rounded-xl bg-surface-50 border border-surface-200 px-3 py-2 text-xs text-surface-500">
              المتغيرات: {`{first_name} {username} {date} {time} {random_emoji}`} — سبين: {`{spin:خيار1|خيار2}`}
            </div>
            {msgText && (
              <div className="rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm">
                <div className="mb-1 text-xs font-bold text-brand-700">👁️ معاينة</div>
                <p className="text-surface-700">{msgText.replace(/\{first_name\}/g, "أحمد").replace(/\{spin:[^}]*\}/g, "نسخة عشوائية")}</p>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="primary" className="flex-1" disabled={!msgText} onClick={() => setStep(2)}>متابعة</Button>
              <Button onClick={() => setStep(0)}>رجوع</Button>
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="card p-6 space-y-4">
            <SectionTitle>3/6 الحسابات والتدوير</SectionTitle>
            <Field label="رسائل قبل تبديل الحساب" value={switchCount} onChange={setSwitchCount} />
            <Field label="الحد اليومي/حساب" value={dailyLimit} onChange={setDailyLimit} />
            <Alert tone="info" title="التدوير الذكي">سيختار المحرك الحسابات الأقل استخداماً تلقائياً مع احترام الحدود اليومية وقواعد الاستبعاد.</Alert>
            <div className="flex gap-2">
              <Button variant="primary" className="flex-1" onClick={() => setStep(3)}>التالي</Button>
              <Button onClick={() => setStep(1)}>رجوع</Button>
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="card p-6 space-y-4">
            <SectionTitle>4/6 التوقيت</SectionTitle>
            <Field label="التأخير بين الرسائل (ثانية)" value={delay} onChange={setDelay} placeholder="60-120" />
            <div className="grid grid-cols-2 gap-2">
              <OptionButton label="فوراً الآن" selected={startNow} onClick={() => setStartNow(true)} />
              <OptionButton label="في وقت محدد (عبر الجدولة)" selected={!startNow} onClick={() => setStartNow(false)} />
            </div>
            <div className="flex gap-2">
              <Button variant="primary" className="flex-1" onClick={() => setStep(4)}>التالي</Button>
              <Button onClick={() => setStep(2)}>رجوع</Button>
            </div>
          </div>
        )}
        {step === 4 && (
          <div className="card p-6 space-y-4">
            <SectionTitle>5/6 الحماية</SectionTitle>
            <Alert tone="info" title="سياسات تلقائية">
              ✅ القائمة السوداء تُستبعد تلقائياً — ✅ FloodWait يُدار (انتظار/تبديل) — ✅ خصوصية مغلقة تُتخطى — ✅ الجلسة التالفة تُعلَّم محظورة.
            </Alert>
            <div className="flex gap-2">
              <Button variant="primary" className="flex-1" onClick={() => setStep(5)}>التالي</Button>
              <Button onClick={() => setStep(3)}>رجوع</Button>
            </div>
          </div>
        )}
        {step === 5 && (
          <div className="card p-6">
            <SectionTitle>6/6 الملخص والتأكيد</SectionTitle>
            <div className="mb-4 grid gap-2 text-sm sm:grid-cols-2">
              <div className="rounded-lg bg-surface-50 border border-surface-200 px-3 py-2"><span className="text-xs text-surface-500">المستلمون: </span>{sourceType === "export" ? exports.find((e) => e.id === selectedExport)?.file_name : `${manualUsers.split("\n").filter(Boolean).length} مستخدم`}</div>
              <div className="rounded-lg bg-surface-50 border border-surface-200 px-3 py-2"><span className="text-xs text-surface-500">التأخير: </span>{delay} ث</div>
            </div>
            {!running && !progress && !report && (
              <Button variant="primary" className="w-full" icon={<Send className="h-4 w-4" />} onClick={() => void startRun()} disabled={creating}>
                {creating ? "جاري إنشاء الحملة..." : "بدء الحملة الآن!"}
              </Button>
            )}
            {jobId && <div className="mt-3"><JobProgressCard jobId={jobId} onDone={() => { if (campaignId) pollProgress(campaignId); }} /></div>}
            {progress && progress.status === "active" && (
              <div className="mt-3">
                <Progress value={progress.progress} label={progress.job_current_step || "جاري الإرسال..."} sub={`${progress.progress}% [${progress.sent} / ${progress.total}]`} />
                <div className="mt-3 flex gap-2">
                  <Button variant="warn" icon={<Pause className="h-4 w-4" />} onClick={() => void control("pause")}>⏸️ إيقاف مؤقت</Button>
                  <Button variant="danger" icon={<Square className="h-4 w-4" />} onClick={() => void control("stop")}>⏹️ إيقاف + حفظ</Button>
                </div>
              </div>
            )}
            {progress && progress.status === "paused" && (
              <div className="mt-3">
                <Alert tone="warn" title="متوقفة مؤقتاً">التقدم: {progress.sent}/{progress.total}</Alert>
                <Button variant="primary" className="mt-2" onClick={async () => { try { await apiFetch(`/campaigns/${campaignId}/resume`, { method: "POST", body: JSON.stringify({}) }); if (campaignId) pollProgress(campaignId); } catch (err) { show(err instanceof Error ? err.message : "تعذر الاستئناف", "danger"); } }}>▶️ استئناف</Button>
              </div>
            )}
            {report && (
              <div className="mt-3 space-y-3">
                <Alert tone="success" title="اكتملت الحملة!">
                  ✅ {report.success} | ⚠️ {report.skipped} | ❌ {report.failed} — {report.duration_minutes} دقيقة
                </Alert>
                {Object.keys(report.failure_reasons || {}).length > 0 && (
                  <Table columns={["السبب", "العدد"]} rows={Object.entries(report.failure_reasons).map(([k, v]) => [k, String(v)])} />
                )}
                <div className="flex flex-wrap gap-2">
                  <Button icon={<Download className="h-4 w-4" />} onClick={async () => { try { await downloadApiFile(`/campaigns/${campaignId}/report.pdf`, `dm-${campaignId}-report.pdf`); } catch (err) { show(err instanceof Error ? err.message : "تعذر التصدير", "danger"); } }}>📄 تصدير PDF</Button>
                  <Button onClick={() => push(["massdm"])}>القائمة الرئيسية</Button>
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

function ListDm() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [rows, setRows] = useState<CampaignRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => apiFetch<CampaignRecord[]>("/campaigns?kind=dm").then(setRows).catch(() => undefined).finally(() => setLoading(false));
  useEffect(() => { void load(); }, []);

  const toggleStatus = async (id: number, current: string) => {
    const next = current === "active" ? "paused" : current === "paused" ? "active" : current;
    try {
      await apiFetch(`/campaigns/${id}`, { method: "PUT", body: JSON.stringify({ status: next }) });
      await load();
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر التحديث", "danger");
    }
  };
  const del = async (id: number) => {
    try {
      await apiFetch(`/campaigns/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر الحذف", "danger");
    }
  };
  const start = async (id: number) => {
    try {
      const response = await apiFetch<JobStartResponse>(`/campaigns/${id}/start`, { method: "POST", body: JSON.stringify({}) });
      show(response.message);
      push(["massdm", "new"]);
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر التشغيل", "danger");
    }
  };

  return (
    <div className="animate-fade">
      <PageHeader title="عرض حملات DM" icon={<ListChecks className="h-5 w-5" />} />
      {loading ? <Spinner label="جاري التحميل..." /> : rows.length === 0 ? <EmptyState title="لا توجد حملات DM" /> : (
        <Table columns={["الاسم", "المستلمون", "أُرسل", "تقدم", "الحالة", ""]} rows={rows.map((c) => [
          c.name, String(c.total), String(c.sent),
          <Progress key={c.id} value={c.progress} label="" sub={`${c.progress}%`} />,
          <StatusChip key={`s${c.id}`} status={c.status as any} />,
          <div key={`a${c.id}`} className="flex gap-1">
            {c.status === "draft" && <Button onClick={() => void start(c.id)}>▶️ تشغيل</Button>}
            {c.status === "active" && <Button variant="warn" onClick={() => void toggleStatus(c.id, c.status)}>⏸️</Button>}
            {c.status === "paused" && <Button variant="primary" onClick={() => void toggleStatus(c.id, c.status)}>▶️</Button>}
            <Button variant="danger" onClick={() => void del(c.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>,
        ])} />
      )}
      <div className="mt-4"><Button onClick={() => push(["massdm"])}>رجوع</Button></div>
      {node}
    </div>
  );
}

function ResumeDm() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [rows, setRows] = useState<CampaignRecord[]>([]);
  useEffect(() => {
    apiFetch<CampaignRecord[]>("/campaigns?kind=dm").then((r) => setRows(r.filter((c) => c.status === "paused"))).catch(() => undefined);
  }, []);
  const resume = async (id: number) => {
    try {
      const response = await apiFetch<JobStartResponse>(`/campaigns/${id}/resume`, { method: "POST", body: JSON.stringify({}) });
      show(response.message);
      push(["massdm"]);
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر الاستئناف", "danger");
    }
  };
  return (
    <div className="animate-fade">
      <PageHeader title="استئناف حملة متوقفة" icon={<Play className="h-5 w-5" />} />
      {rows.length === 0 ? <EmptyState title="لا توجد حملات متوقفة" /> : (
        <Table columns={["الاسم", "تقدم", "أُرسل/الإجمالي", ""]} rows={rows.map((c) => [c.name, `${c.progress}%`, `${c.sent}/${c.total}`, <Button key={c.id} variant="primary" onClick={() => void resume(c.id)}>▶️ استئناف</Button>])} />
      )}
      <div className="mt-4"><Button onClick={() => push(["massdm"])}>رجوع</Button></div>
      {node}
    </div>
  );
}

function DmBlacklist() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [rows, setRows] = useState<BlacklistEntryRecord[]>([]);
  const [val, setVal] = useState("");
  const [reason, setReason] = useState("حظر البوت");
  const [adding, setAdding] = useState(false);

  const load = () => apiFetch<BlacklistEntryRecord[]>("/add/blacklist").then(setRows).catch(() => undefined);
  useEffect(() => { void load(); }, []);

  const add = async () => {
    if (!val.trim()) return;
    try {
      await apiFetch<BlacklistEntryRecord>("/add/blacklist", { method: "POST", body: JSON.stringify({ user_value: val, reason }) });
      setVal("");
      setAdding(false);
      await load();
      show("أُضيف للقائمة السوداء");
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر الإضافة", "danger");
    }
  };
  const remove = async (id: number) => {
    try {
      await apiFetch(`/add/blacklist/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر الإزالة", "danger");
    }
  };

  return (
    <div className="animate-fade">
      <PageHeader title="القائمة السوداء" subtitle="تُستبعد تلقائياً من كل الإرسال والإضافة" icon={<Ban className="h-5 w-5" />} />
      <Button variant="primary" className="mb-3" onClick={() => setAdding(!adding)}>{adding ? "❌ إلغاء" : "➕ إضافة"}</Button>
      {adding && (
        <div className="card p-4 space-y-2 mb-4">
          <Field label="@username أو User ID" value={val} onChange={setVal} />
          <Field label="السبب" value={reason} onChange={setReason} />
          <Button variant="danger" disabled={!val.trim()} onClick={() => void add()}>حفظ</Button>
        </div>
      )}
      <Table columns={["المستخدم", "السبب", "التاريخ", ""]} rows={rows.map((b) => [
        b.user_value, b.reason || "—", new Date(b.created_at).toLocaleDateString("ar"),
        <Button key={b.id} variant="danger" onClick={() => void remove(b.id)}>إزالة</Button>,
      ])} />
      <div className="mt-4"><Button onClick={() => push(["massdm"])}>رجوع</Button></div>
      {node}
    </div>
  );
}

function DmTemplates() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [rows, setRows] = useState<MessageTemplateRecord[]>([]);
  const [adding, setAdding] = useState(false);
  const [tName, setTName] = useState("");
  const [tContent, setTContent] = useState("");

  const load = () => apiFetch<MessageTemplateRecord[]>("/campaigns/templates?kind=dm").then(setRows).catch(() => undefined);
  useEffect(() => { void load(); }, []);

  const save = async () => {
    if (!tName.trim() || !tContent.trim()) { show("أدخل الاسم والمحتوى", "danger"); return; }
    try {
      await apiFetch<MessageTemplateRecord>("/campaigns/templates", { method: "POST", body: JSON.stringify({ name: tName, kind: "dm", content: tContent, message_kind: "text" }) });
      show("تم إنشاء القالب");
      setAdding(false); setTName(""); setTContent("");
      await load();
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر الإنشاء", "danger");
    }
  };
  const del = async (id: number) => {
    try {
      await apiFetch(`/campaigns/templates/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر الحذف", "danger");
    }
  };

  return (
    <div className="animate-fade">
      <PageHeader title="قوالب رسائل DM" icon={<PenLine className="h-5 w-5" />} />
      <Button variant="primary" className="mb-3" onClick={() => setAdding(!adding)}>{adding ? "❌ إلغاء" : "➕ قالب جديد"}</Button>
      {adding && (
        <div className="card p-4 space-y-2 mb-4">
          <Field label="اسم القالب" value={tName} onChange={setTName} />
          <TextArea label="النص (يدعم المتغيرات و {spin:أ|ب})" rows={4} value={tContent} onChange={setTContent} />
          <Button variant="primary" onClick={() => void save()}>💾 حفظ</Button>
        </div>
      )}
      <Table columns={["اسم", "تصنيف", "آخر استخدام", ""]} rows={rows.map((t) => [
        t.name, t.category || "—", t.last_used_at ? new Date(t.last_used_at).toLocaleString("ar") : "—",
        <Button key={t.id} variant="danger" onClick={() => void del(t.id)}>حذف</Button>,
      ])} />
      <div className="mt-4"><Button onClick={() => push(["massdm"])}>رجوع</Button></div>
      {node}
    </div>
  );
}

function DmStats() {
  const { push } = useNav();
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [today, setToday] = useState<any>(null);
  useEffect(() => {
    apiFetch<CampaignStats>("/campaigns/stats").then(setStats).catch(() => undefined);
    apiFetch<any>("/reports/today").then(setToday).catch(() => undefined);
  }, []);
  return (
    <div className="animate-fade">
      <PageHeader title="إحصائيات DM" icon={<BarChart3 className="h-5 w-5" />} />
      {stats && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="إجمالي حملات DM" value={stats.dm} tone="brand" />
          <StatCard label="رسائل أُرسلت" value={stats.total_sent} tone="accent" />
          <StatCard label="نشطة" value={stats.active} tone="brand" />
          <StatCard label="مكتملة" value={stats.done} tone="warn" />
        </div>
      )}
      {today && (
        <div className="card p-5">
          <SectionTitle>اليوم (حقيقي)</SectionTitle>
          <Table columns={["المقياس", "القيمة"]} rows={[
            ["رسائل DM اليوم", String(today.dm_today)],
            ["مُجمَّع اليوم", String(today.gathered_today)],
            ["FloodWaits", String(today.flood_today)],
          ]} />
        </div>
      )}
      <div className="mt-4"><Button onClick={() => push(["massdm"])}>رجوع</Button></div>
    </div>
  );
}

function DmSettings() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [delay, setDelay] = useState("60-120");
  const [daily, setDaily] = useState("30");
  const [beforeSwitch, setBeforeSwitch] = useState("10");
  const [restAfter, setRestAfter] = useState("20");
  const [restDur, setRestDur] = useState("15");

  const save = async () => {
    try {
      await apiFetch("/add/defaults", {
        method: "PUT",
        body: JSON.stringify({ values: {
          add_default_delay_from: delay.split("-")[0] || "60",
          add_default_delay_to: delay.split("-")[1] || "120",
          add_default_daily_limit: daily,
          add_default_switch_count: beforeSwitch,
          add_default_rest_after: restAfter,
          add_default_rest_duration: restDur,
        } }),
      });
      show("تم حفظ الإعدادات الافتراضية لرسائل DM");
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر الحفظ", "danger");
    }
  };

  return (
    <div className="animate-fade">
      <PageHeader title="إعدادات DM" icon={<Settings className="h-5 w-5" />} />
      <div className="mx-auto max-w-lg card p-6 space-y-4">
        <Field label="التأخير بين الرسائل (ثانية)" value={delay} onChange={setDelay} />
        <Field label="الحد اليومي/حساب" value={daily} onChange={setDaily} />
        <Field label="رسائل قبل التبديل" value={beforeSwitch} onChange={setBeforeSwitch} />
        <Field label="راحة بعد _ رسالة" value={restAfter} onChange={setRestAfter} />
        <Field label="مدة الراحة (دقيقة)" value={restDur} onChange={setRestDur} />
        <Button variant="primary" className="w-full" onClick={() => void save()}>💾 حفظ الإعدادات</Button>
      </div>
      <div className="mt-4"><Button onClick={() => push(["massdm"])}>رجوع</Button></div>
      {node}
    </div>
  );
}
