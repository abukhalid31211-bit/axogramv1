import { useEffect, useState } from "react";
import {
  Megaphone, Plus, ListChecks, Play, Pause, Square, FolderOpen, PenLine,
  CalendarClock, BarChart3, Settings, Send, Image as ImageIcon, Video,
  FileText, Plus as PlusIcon, Minus, Bell, RefreshCw, Trash2, Download,
} from "lucide-react";
import { useNav } from "../nav";
import { PageHeader, Button, Field, TextArea, Checkbox, OptionButton, Progress, Table, SectionTitle, Alert, useToast, Tabs, StatusChip, EmptyState, StatCard, Spinner, ConfirmDialog } from "../ui";
import { JobProgressCard } from "../lib/job";
import { apiFetch, downloadApiFile, type CampaignRecord, type CampaignStats, type CampaignScheduleRecord, type CampaignProgress, type CampaignReport, type MessageTemplateRecord, type GroupRecord, type GroupCategory, type GroupBlacklistEntry, type GroupStats, type JobStartResponse } from "../lib/api";

export function CampaignsModule() {
  const { push } = useNav();
  const [rows, setRows] = useState<CampaignRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<CampaignRecord[]>("/campaigns").then(setRows).catch(() => undefined).finally(() => setLoading(false));
  }, []);

  const active = rows.filter((c) => c.status === "active").length;
  const paused = rows.filter((c) => c.status === "paused").length;
  const done = rows.filter((c) => c.status === "done").length;
  const items = [
    { id: "new", label: "إنشاء حملة جديدة", desc: "معالج 7 خطوات", icon: Plus },
    { id: "list", label: "عرض الحملات", desc: "كل الحملات", icon: ListChecks },
    { id: "resume", label: "استئناف حملة متوقفة", desc: "متابعة", icon: Play },
    { id: "groups", label: "إدارة القروبات المستهدفة", desc: "انضمام وتصنيف", icon: FolderOpen },
    { id: "templates", label: "إدارة قوالب الرسائل", desc: "إنشاء وتعديل", icon: PenLine },
    { id: "schedule", label: "جدولة الحملات", desc: "تكرار وأوقات", icon: CalendarClock },
    { id: "stats", label: "إحصائيات وتقارير", desc: "أداء الحملات", icon: BarChart3 },
    { id: "settings", label: "إعدادات حملات القروبات", desc: "افتراضيات", icon: Settings },
  ];
  return (
    <div className="animate-fade">
      <PageHeader title="حملات رسائل القروبات" subtitle="إنشاء وإدارة الحملات مع تنفيذ حقيقي" icon={<Megaphone className="h-5 w-5" />} />
      {loading ? <Spinner label="جاري تحميل الحملات..." /> : (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="نشطة" value={active} tone="brand" />
          <StatCard label="متوقفة" value={paused} tone="warn" />
          <StatCard label="مكتملة" value={done} tone="accent" />
          <StatCard label="الإجمالي" value={rows.length} tone="brand" />
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <button key={it.id} onClick={() => push(["campaigns", it.id])}
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

export function CampaignsScreen({ sub }: { sub: string }) {
  switch (sub) {
    case "new": return <NewCampaign />;
    case "list": return <ListCampaigns />;
    case "resume": return <ResumeCampaign />;
    case "groups": return <ManageGroups />;
    case "templates": return <ManageTemplates />;
    case "schedule": return <ScheduleCampaigns />;
    case "stats": return <CampaignStats />;
    case "settings": return <CampaignSettings />;
    default: return null;
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

function NewCampaign() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [groupSource, setGroupSource] = useState("joined");
  const [groupsList, setGroupsList] = useState<GroupRecord[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<number[]>([]);
  const [msgType, setMsgType] = useState("text");
  const [msgText, setMsgText] = useState("");
  const [accountChoice, setAccountChoice] = useState("all");
  const [delay, setDelay] = useState("1-3");
  const [switchDelay, setSwitchDelay] = useState("3-5");
  const [start, setStart] = useState("now");
  const [dailyLimit, setDailyLimit] = useState("25");
  const [protection, setProtection] = useState({ save: true, log: true, notify: true, stopFail: true });
  const [creating, setCreating] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [campaignId, setCampaignId] = useState<number | null>(null);
  const [progress, setProgress] = useState<CampaignProgress | null>(null);
  const [report, setReport] = useState<CampaignReport | null>(null);

  useEffect(() => {
    apiFetch<GroupRecord[]>("/groups").then(setGroupsList).catch(() => undefined);
  }, []);

  const steps = ["اسم الحملة", "القروبات", "الرسالة", "الحسابات", "التوقيت", "الحماية", "الملخص"];

  const pollProgress = (id: number) => {
    const timer = window.setInterval(async () => {
      try {
        const data = await apiFetch<CampaignProgress>(`/campaigns/${id}/progress`);
        setProgress(data);
        if (data.status === "done") {
          window.clearInterval(timer);
          try { setReport(await apiFetch<CampaignReport>(`/campaigns/${id}/report`)); } catch { /* no report yet */ }
        }
        if (data.status === "paused" || data.status === "draft") {
          window.clearInterval(timer);
        }
      } catch {
        window.clearInterval(timer);
      }
    }, 2000);
  };

  const startRun = async () => {
    setCreating(true);
    try {
      const settingsJson = JSON.stringify({
        delay_min: delay === "custom" ? 60 : delay === "3-5" ? 180 : 90,
        delay_max: delay === "custom" ? 90 : delay === "3-5" ? 300 : 150,
        switch_count: switchDelay === "3-5" ? 10 : switchDelay === "5-10" ? 15 : 30,
        flood_action: "wait",
        ban_action: "remove",
        privacy_action: "skip",
        daily_limit: dailyLimit === "custom" ? 25 : Number(dailyLimit),
        save_progress: protection.save,
        notify_on_done: protection.notify,
        stop_fail_percent: protection.stopFail ? 30 : null,
      });
      const campaign = await apiFetch<CampaignRecord>("/campaigns", {
        method: "POST",
        body: JSON.stringify({
          name: name || "حملة",
          kind: "group",
          status: "draft",
          message_text: msgText,
          message_kind: msgType,
          groups_json: JSON.stringify(selectedGroups),
          settings_json: settingsJson,
          account_ids_json: accountChoice === "all" ? null : JSON.stringify([]),
          delete_after_hours: null,
          auto_leave_new_groups: false,
        }),
      });
      setCampaignId(campaign.id);
      const response = await apiFetch<JobStartResponse>(`/campaigns/${campaign.id}/start`, { method: "POST", body: JSON.stringify({}) });
      setJobId(response.job_id || null);
      pollProgress(campaign.id);
      show("🚀 بدأت الحملة فعلياً عبر محرك الإرسال");
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر إنشاء الحملة", "danger");
      setCreating(false);
    }
  };

  const saveDraft = async () => {
    try {
      await apiFetch<CampaignRecord>("/campaigns", {
        method: "POST",
        body: JSON.stringify({ name: name || "حملة", kind: "group", status: "draft", message_text: msgText, message_kind: msgType, groups_json: JSON.stringify(selectedGroups) }),
      });
      show("تم الحفظ كمسودة");
      push(["campaigns"]);
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر الحفظ", "danger");
    }
  };

  const controlCampaign = async (action: "pause" | "resume" | "stop") => {
    if (!campaignId) return;
    try {
      await apiFetch(`/campaigns/${campaignId}/${action}`, { method: "POST", body: JSON.stringify({}) });
      show(action === "pause" ? "⏸️ أُوقفت مؤقتاً" : action === "resume" ? "▶️ استُئنفت" : "⏹️ أُوقفت وحُفظ التقدم", action === "stop" ? "danger" : undefined);
      if (action === "resume" && campaignId) pollProgress(campaignId);
      if (action === "stop") setProgress(null);
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر التنفيذ", "danger");
    }
  };

  const exportPdf = async () => {
    if (!campaignId) return;
    try {
      await downloadApiFile(`/campaigns/${campaignId}/report.pdf`, `campaign-${campaignId}-report.pdf`);
      show("تم تنزيل تقرير PDF");
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر التصدير", "danger");
    }
  };

  const retryFailed = async () => {
    if (!campaignId || !report) return;
    try {
      const failedItems = report.failed_items.map((f) => typeof f === "string" ? f : String((f as any).user_id || (f as any).username || ""));
      const response = await apiFetch<JobStartResponse>(`/campaigns/${campaignId}/retry-failed`, { method: "POST", body: JSON.stringify({ failed_items: failedItems }) });
      setReport(null);
      setJobId(response.job_id || null);
      pollProgress(campaignId);
      show("جاري إعادة إرسال العناصر الفاشلة");
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر إعادة الإرسال", "danger");
    }
  };

  const running = progress?.status === "active" || jobId !== null && progress === null;

  return (
    <div className="animate-fade">
      <PageHeader title="إنشاء حملة جديدة" icon={<Plus className="h-5 w-5" />} steps={{ label: steps[step], n: step + 1, total: 7 }} />
      <div className="mx-auto max-w-2xl">
        {step === 0 && (
          <div className="card p-6 space-y-4">
            <SectionTitle>1/7 اسم الحملة</SectionTitle>
            <Field label="اسم الحملة" placeholder="حملة تسويق منتج" value={name} onChange={setName} />
            <Button variant="primary" className="w-full" disabled={!name} onClick={() => setStep(1)}>التالي</Button>
          </div>
        )}
        {step === 1 && (
          <div className="card p-6 space-y-4">
            <SectionTitle>2/7 القروبات المستهدفة</SectionTitle>
            <div className="space-y-2">
              <OptionButton label="من القروبات المنضم لها (المسجلة)" selected={groupSource === "joined"} onClick={() => setGroupSource("joined")} />
              <OptionButton label="روابط جديدة (ستُضاف يدوياً في إدارة القروبات)" selected={groupSource === "new"} onClick={() => setGroupSource("new")} />
            </div>
            {groupSource === "joined" && (
              <div className="rounded-xl border border-surface-200 bg-surface-50 p-3">
                <div className="mb-2 text-xs text-surface-500">المحدد: {selectedGroups.length} قروب</div>
                <div className="max-h-64 space-y-2 overflow-auto">
                  {groupsList.length === 0 && <p className="text-xs text-surface-500">لا توجد قروبات مسجلة — أضفها من «إدارة القروبات» أولاً أو أدرج روابط مباشرة.</p>}
                  {groupsList.map((g) => (
                    <Checkbox key={g.id} label={`${g.name} (${(g.members_count || 0).toLocaleString()} عضو)`} checked={selectedGroups.includes(g.id)}
                      onChange={(v) => setSelectedGroups((s) => v ? [...s, g.id] : s.filter((x) => x !== g.id))} />
                  ))}
                </div>
              </div>
            )}
            {groupSource === "new" && (
              <Field label="روابط القروبات (واحد per سطر)" placeholder={"t.me/group1\nt.me/group2"} />
            )}
            <div className="flex gap-2">
              <Button variant="primary" className="flex-1" onClick={() => setStep(2)}>تأكيد</Button>
              <Button onClick={() => setStep(0)}>رجوع</Button>
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="card p-6 space-y-4">
            <SectionTitle>3/7 تصميم الرسالة</SectionTitle>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[["text", "نص فقط", PenLine], ["image", "نص + صورة", ImageIcon], ["video", "نص + فيديو", Video], ["doc", "نص + مستند", FileText]].map(([id, label, Icon]: any) => {
                const I = Icon; return <OptionButton key={id} label={<span className="flex items-center gap-2"><I className="h-4 w-4" />{label}</span>} selected={msgType === id} onClick={() => setMsgType(id)} />;
              })}
            </div>
            <TextArea label="نص الرسالة" placeholder="مرحباً {first_name}... {spin:عرض خاص|خصم مميز}" rows={4} value={msgText} onChange={setMsgText} />
            <div className="flex items-center justify-between rounded-xl bg-surface-50 border border-surface-200 px-3 py-2 text-xs text-surface-500">
              <span>المتغيرات: {`{first_name} {username} {group_name} {group_link} {date} {time} {random_emoji}`} — سبين: {`{spin:خيار1|خيار2}`}</span>
              <span className={`font-bold ${msgText.length > 4096 ? "text-danger-600" : "text-surface-600"}`}>{msgText.length}/4096</span>
            </div>
            {msgText && (
              <div className="rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm">
                <div className="mb-1 text-xs font-bold text-brand-700">👁️ معاينة الرسالة</div>
                <p className="text-surface-700">{msgText.replace(/\{first_name\}/g, "أحمد").replace(/\{username\}/g, "@user").replace(/\{date\}/g, new Date().toLocaleDateString("ar")).replace(/\{spin:[^}]*\}/g, "نسخة عشوائية")}</p>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="primary" className="flex-1" disabled={!msgText} onClick={() => setStep(3)}>متابعة</Button>
              <Button onClick={() => setStep(1)}>رجوع</Button>
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="card p-6 space-y-4">
            <SectionTitle>4/7 الحسابات والتدوير</SectionTitle>
            <div className="space-y-2">
              <OptionButton label="جميع الحسابات النشطة (تدوير ذكي)" selected={accountChoice === "all"} onClick={() => setAccountChoice("all")} />
              <OptionButton label="اختيار ذكي (الأقدم استخداماً أولاً)" selected={accountChoice === "smart"} onClick={() => setAccountChoice("smart")} />
            </div>
            <SectionTitle>الحد اليومي/حساب</SectionTitle>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <OptionButton label="15/يوم (محافظ)" selected={dailyLimit === "15"} onClick={() => setDailyLimit("15")} />
              <OptionButton label="25/يوم (متوازن)" badge={<span className="chip bg-brand-50 text-brand-700 ring-1 ring-brand-200">موصى</span>} selected={dailyLimit === "25"} onClick={() => setDailyLimit("25")} />
              <OptionButton label="40/يوم (عدواني)" selected={dailyLimit === "40"} onClick={() => setDailyLimit("40")} />
              <OptionButton label="مخصص" selected={dailyLimit === "custom"} onClick={() => setDailyLimit("custom")} />
            </div>
            <div className="flex gap-2">
              <Button variant="primary" className="flex-1" onClick={() => setStep(4)}>التالي</Button>
              <Button onClick={() => setStep(2)}>رجوع</Button>
            </div>
          </div>
        )}
        {step === 4 && (
          <div className="card p-6 space-y-4">
            <SectionTitle>5/7 التوقيت والتأخيرات</SectionTitle>
            <SectionTitle>تأخير بين الرسائل</SectionTitle>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <OptionButton label="3-5 دقائق" selected={delay === "3-5"} onClick={() => setDelay("3-5")} />
              <OptionButton label="1-3 دقائق" badge={<span className="chip bg-brand-50 text-brand-700 ring-1 ring-brand-200">آمن</span>} selected={delay === "1-3"} onClick={() => setDelay("1-3")} />
              <OptionButton label="30-60 ث" selected={delay === "30-60"} onClick={() => setDelay("30-60")} />
            </div>
            <SectionTitle>تأخير بين تبديل الحسابات</SectionTitle>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <OptionButton label="3-5 دقائق" selected={switchDelay === "3-5"} onClick={() => setSwitchDelay("3-5")} />
              <OptionButton label="5-10 دقائق" selected={switchDelay === "5-10"} onClick={() => setSwitchDelay("5-10")} />
              <OptionButton label="10-20 دقيقة" selected={switchDelay === "10-20"} onClick={() => setSwitchDelay("10-20")} />
            </div>
            <SectionTitle>وقت البدء</SectionTitle>
            <div className="grid grid-cols-2 gap-2">
              <OptionButton label="فوراً الآن" selected={start === "now"} onClick={() => setStart("now")} />
              <OptionButton label="في وقت محدد (عبر الجدولة)" selected={start === "scheduled"} onClick={() => setStart("scheduled")} />
            </div>
            <div className="flex gap-2">
              <Button variant="primary" className="flex-1" onClick={() => setStep(5)}>التالي</Button>
              <Button onClick={() => setStep(3)}>رجوع</Button>
            </div>
          </div>
        )}
        {step === 5 && (
          <div className="card p-6 space-y-4">
            <SectionTitle>6/7 الحماية والأمان</SectionTitle>
            <SectionTitle>عند FloodWait</SectionTitle>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <OptionButton label="انتظار ثم متابعة" badge={<span className="chip bg-brand-50 text-brand-700 ring-1 ring-brand-200">موصى</span>} selected={true} onClick={() => { }} />
              <OptionButton label="تبديل حساب فوراً" onClick={() => show("اختر سياسة من الإعدادات")} />
              <OptionButton label="إيقاف + إشعار" onClick={() => show("اختر سياسة من الإعدادات")} />
            </div>
            <SectionTitle>حماية إضافية</SectionTitle>
            <div className="grid gap-2 sm:grid-cols-2">
              <Checkbox label="حفظ التقدم كل رسالة" checked={protection.save} onChange={(v) => setProtection({ ...protection, save: v })} />
              <Checkbox label="تسجيل كل عملية" checked={protection.log} onChange={(v) => setProtection({ ...protection, log: v })} />
              <Checkbox label="إشعار عند الاكتمال" checked={protection.notify} onChange={(v) => setProtection({ ...protection, notify: v })} />
              <Checkbox label="إيقاف إذا تجاوز الفشل 30%" checked={protection.stopFail} onChange={(v) => setProtection({ ...protection, stopFail: v })} />
            </div>
            <div className="flex gap-2">
              <Button variant="primary" className="flex-1" onClick={() => setStep(6)}>التالي</Button>
              <Button onClick={() => setStep(4)}>رجوع</Button>
            </div>
          </div>
        )}
        {step === 6 && (
          <div className="card p-6">
            <SectionTitle>7/7 الملخص والتأكيد</SectionTitle>
            <div className="mb-4 grid gap-2 text-sm sm:grid-cols-2">
              <SRow label="الاسم" value={name || "حملة"} />
              <SRow label="قروبات" value={String(selectedGroups.length)} />
              <SRow label="رسالة" value={msgType === "text" ? "نص فقط" : "وسائط"} />
              <SRow label="حسابات" value={accountChoice === "all" ? "تدوير ذكي" : "محددة"} />
              <SRow label="تأخير" value={delay} />
              <SRow label="حد يومي" value={`${dailyLimit}/يوم`} />
            </div>
            {!running && !progress && !report && (
              <div className="mt-4 space-y-2">
                <Button variant="primary" className="w-full" icon={<Send className="h-4 w-4" />} onClick={() => void startRun()} disabled={creating}>
                  {creating ? "جاري إنشاء الحملة..." : "بدء الحملة الآن!"}
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={() => void saveDraft()}>حفظ كمسودة</Button>
                  <Button onClick={() => setStep(0)}>تعديل</Button>
                </div>
              </div>
            )}
            {jobId && <JobProgressCard jobId={jobId} onDone={() => { if (campaignId) pollProgress(campaignId); }} />}
            {progress && progress.status === "active" && (
              <div className="mt-4">
                <Progress value={progress.progress} label={progress.job_current_step || "جاري الإرسال..."} sub={`${progress.progress}% [${progress.sent} / ${progress.total}]`} />
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="warn" icon={<Pause className="h-4 w-4" />} onClick={() => void controlCampaign("pause")}>⏸️ إيقاف مؤقت</Button>
                  <Button variant="danger" icon={<Square className="h-4 w-4" />} onClick={() => void controlCampaign("stop")}>⏹️ إيقاف + حفظ</Button>
                </div>
              </div>
            )}
            {progress && progress.status === "paused" && (
              <div className="mt-4">
                <Alert tone="warn" title="الحملة متوقفة مؤقتاً">التقدم محفوظ: {progress.sent}/{progress.total} ({progress.progress}%)</Alert>
                <Button variant="primary" className="mt-2" onClick={() => void controlCampaign("resume")}>▶️ استئناف</Button>
              </div>
            )}
            {report && (
              <div className="mt-4 space-y-3">
                <Alert tone="success" title="اكتملت الحملة!">
                  ✅ {report.success} ناجح | ⚠️ {report.skipped} تخطي | ❌ {report.failed} فاشل — المدة: {report.duration_minutes} دقيقة
                </Alert>
                {Object.keys(report.failure_reasons || {}).length > 0 && (
                  <Table columns={["السبب", "العدد"]} rows={Object.entries(report.failure_reasons).map(([k, v]) => [k, String(v)])} />
                )}
                <div className="flex flex-wrap gap-2">
                  <Button icon={<Download className="h-4 w-4" />} onClick={() => void exportPdf()}>📄 تصدير PDF</Button>
                  <Button disabled={report.failed === 0} onClick={() => void retryFailed()}>🔁 إعادة للفاشلة ({report.failed})</Button>
                  <Button onClick={() => push(["campaigns"])}>القائمة الرئيسية</Button>
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

function ListCampaigns() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [rows, setRows] = useState<CampaignRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const load = () => apiFetch<CampaignRecord[]>("/campaigns").then(setRows).catch(() => undefined).finally(() => setLoading(false));
  useEffect(() => { void load(); }, []);

  const filtered = filter === "all" ? rows : rows.filter((c) => c.status === filter);
  const toggleStatus = async (id: number, current: string) => {
    const next = current === "active" ? "paused" : current === "paused" ? "active" : current;
    try {
      await apiFetch(`/campaigns/${id}`, { method: "PUT", body: JSON.stringify({ status: next }) });
      show(next === "paused" ? "أُوقفت الحملة" : "فُعّلت الحملة");
      await load();
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر التحديث", "danger");
    }
  };
  const remove = async (id: number) => {
    try {
      await apiFetch(`/campaigns/${id}`, { method: "DELETE" });
      show("تم حذف الحملة", "danger");
      await load();
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر الحذف", "danger");
    }
  };
  const start = async (id: number) => {
    try {
      const response = await apiFetch<JobStartResponse>(`/campaigns/${id}/start`, { method: "POST", body: JSON.stringify({}) });
      show(response.message);
      await load();
      push(["campaigns", "new"]);
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر التشغيل", "danger");
    }
  };

  return (
    <div className="animate-fade">
      <PageHeader title="عرض الحملات" icon={<ListChecks className="h-5 w-5" />} />
      <div className="mb-4"><Tabs tabs={[{ id: "all", label: "الكل" }, { id: "active", label: "🟢 نشطة" }, { id: "paused", label: "⏸️ متوقفة" }, { id: "done", label: "✅ مكتملة" }, { id: "draft", label: "📝 مسودات" }]} active={filter} onChange={setFilter} /></div>
      {loading ? <Spinner label="جاري التحميل..." /> : filtered.length === 0 ? <EmptyState title="لا توجد حملات" desc="أنشئ حملة جديدة للبدء." /> : (
        <Table columns={["الاسم", "التصنيف", "القروبات/المستلمون", "تقدم", "أُرسل", "الحالة", "إجراءات"]} rows={filtered.map((c) => [
          c.name,
          c.kind === "dm" ? "رسائل مباشرة" : "قروبات",
          String(c.total),
          <Progress key={c.id} value={c.progress} label="" sub={`${c.progress}%`} />,
          String(c.sent),
          <StatusChip key={`s${c.id}`} status={c.status as any} />,
          <div key={`a${c.id}`} className="flex gap-1">
            {c.status === "draft" && <Button onClick={() => void start(c.id)}>▶️ تشغيل</Button>}
            {c.status === "active" && <Button variant="warn" onClick={() => void toggleStatus(c.id, c.status)}>⏸️</Button>}
            {c.status === "paused" && <Button variant="primary" onClick={() => void toggleStatus(c.id, c.status)}>▶️</Button>}
            <Button variant="danger" onClick={() => void remove(c.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>,
        ])} />
      )}
      <div className="mt-4"><Button onClick={() => push(["campaigns"])}>رجوع</Button></div>
      {node}
    </div>
  );
}

function ResumeCampaign() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [rows, setRows] = useState<CampaignRecord[]>([]);
  useEffect(() => {
    apiFetch<CampaignRecord[]>("/campaigns").then((r) => setRows(r.filter((c) => c.status === "paused"))).catch(() => undefined);
  }, []);
  const resume = async (id: number) => {
    try {
      const response = await apiFetch<JobStartResponse>(`/campaigns/${id}/resume`, { method: "POST", body: JSON.stringify({}) });
      show(response.message);
      push(["campaigns"]);
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر الاستئناف", "danger");
    }
  };
  return (
    <div className="animate-fade">
      <PageHeader title="استئناف حملة متوقفة" icon={<Play className="h-5 w-5" />} />
      {rows.length === 0 ? <EmptyState title="لا توجد حملات متوقفة" /> : (
        <Table columns={["الاسم", "تقدم", "أُرسل/الإجمالي", ""]} rows={rows.map((c) => [
          c.name, `${c.progress}%`, `${c.sent}/${c.total}`,
          <Button key={c.id} variant="primary" onClick={() => void resume(c.id)}>▶️ استئناف</Button>,
        ])} />
      )}
      <div className="mt-4"><Button onClick={() => push(["campaigns"])}>رجوع</Button></div>
      {node}
    </div>
  );
}

function ManageGroups() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [tab, setTab] = useState("list");
  const [groups, setGroups] = useState<GroupRecord[]>([]);
  const [categories, setCategories] = useState<GroupCategory[]>([]);
  const [blacklist, setBlacklist] = useState<GroupBlacklistEntry[]>([]);
  const [stats, setStats] = useState<GroupStats | null>(null);
  const [links, setLinks] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [blackValue, setBlackValue] = useState("");
  const [blackReason, setBlackReason] = useState("تم الطرد");

  const load = async () => {
    try {
      const [g, c, b, s] = await Promise.all([
        apiFetch<GroupRecord[]>("/groups"),
        apiFetch<GroupCategory[]>("/groups/categories"),
        apiFetch<GroupBlacklistEntry[]>("/groups/blacklist"),
        apiFetch<GroupStats>("/groups/stats"),
      ]);
      setGroups(g); setCategories(c); setBlacklist(b); setStats(s);
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر تحميل القروبات", "danger");
    }
  };
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const join = async () => {
    const lines = links.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) { show("أدخل روابط أولاً", "danger"); return; }
    try {
      const response = await apiFetch<JobStartResponse>("/groups/join", { method: "POST", body: JSON.stringify({ links: lines }) });
      setJobId(response.job_id || null);
      setLinks("");
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر بدء الانضمام", "danger");
    }
  };
  const leave = async () => {
    if (!selected.length) { show("اختر قروبات للمغادرة", "danger"); return; }
    try {
      const response = await apiFetch<JobStartResponse>("/groups/leave", { method: "POST", body: JSON.stringify({ group_ids: selected }) });
      setJobId(response.job_id || null);
      setSelected([]);
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر بدء المغادرة", "danger");
    }
  };
  const refresh = async () => {
    try {
      const response = await apiFetch<JobStartResponse>("/groups/refresh", { method: "POST", body: JSON.stringify({}) });
      setJobId(response.job_id || null);
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر التحديث", "danger");
    }
  };
  const categorize = async () => {
    try {
      const response = await apiFetch<{ categorized: number }>("/groups/categorize", { method: "POST", body: JSON.stringify({}) });
      show(`✅ تم تصنيف ${response.categorized} قروب تلقائياً`);
      await load();
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر التصنيف", "danger");
    }
  };
  const addCategory = async () => {
    if (!newCategory.trim()) return;
    try {
      await apiFetch("/groups/categories", { method: "POST", body: JSON.stringify({ name: newCategory }) });
      setNewCategory("");
      await load();
      show("تم إنشاء التصنيف");
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر الإنشاء", "danger");
    }
  };
  const addBlack = async () => {
    if (!blackValue.trim()) return;
    try {
      await apiFetch("/groups/blacklist", { method: "POST", body: JSON.stringify({ group_value: blackValue, reason: blackReason }) });
      setBlackValue("");
      await load();
      show("أُضيف للقائمة السوداء");
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر الإضافة", "danger");
    }
  };
  const removeBlack = async (id: number) => {
    try {
      await apiFetch(`/groups/blacklist/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر الإزالة", "danger");
    }
  };
  const exportGroups = () => {
    void downloadApiFile("/groups/export?format_value=csv", "groups.csv");
  };

  return (
    <div className="animate-fade">
      <PageHeader title="إدارة القروبات المستهدفة" subtitle="بيانات حقيقية من قاعدة البيانات" icon={<FolderOpen className="h-5 w-5" />} />
      <div className="mb-4"><Tabs tabs={[{ id: "list", label: "عرض الكل" }, { id: "join", label: "انضمام جديد" }, { id: "leave", label: "مغادرة" }, { id: "categories", label: "تصنيف" }, { id: "blacklist", label: "قائمة سوداء" }, { id: "stats", label: "إحصائيات" }]} active={tab} onChange={setTab} /></div>

      {tab === "list" && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void refresh()} icon={<RefreshCw className="h-4 w-4" />}>🔄 تحديث معلومات القروبات</Button>
            <Button onClick={exportGroups}>📤 تصدير CSV</Button>
          </div>
          <JobProgressCard jobId={jobId} onDone={(run) => {
            setJobId(null);
            if (run.status === "failed") show(run.error?.split("\n")[0] || "فشلت المهمة", "danger");
            else { show("اكتملت المهمة بنجاح"); void load(); }
          }} />
          <Table columns={["#", "اسم", "نوع", "أعضاء", "تصنيف", "حساب", "حالة"]} rows={groups.map((g, i) => [
            String(i + 1), g.name, g.group_type === "public" ? "عام" : "خاص", (g.members_count || 0).toLocaleString(), g.category_name || "غير مصنف", g.account_phone || "—",
            <StatusChip key={g.id} status={g.status as any} />,
          ])} />
        </div>
      )}
      {tab === "join" && (
        <div className="mx-auto max-w-lg card p-6 space-y-3">
          <TextArea label="روابط (واحد per سطر)" placeholder={"t.me/+abc\nt.me/+def"} rows={4} value={links} onChange={setLinks} />
          <Button variant="primary" className="w-full" onClick={() => void join()}>بدء الانضمام</Button>
          <JobProgressCard jobId={jobId} onDone={(run) => { setJobId(null); if (run.status === "failed") show(run.error?.split("\n")[0] || "فشل الانضمام", "danger"); else { show("اكتمل الانضمام"); void load(); } }} />
        </div>
      )}
      {tab === "leave" && (
        <div className="space-y-2">
          <div className="max-h-80 space-y-2 overflow-auto">
            {groups.filter((g) => g.status !== "left").map((g) => (
              <Checkbox key={g.id} label={`${g.name} (${(g.members_count || 0).toLocaleString()})`} checked={selected.includes(g.id)}
                onChange={(v) => setSelected((s) => v ? [...s, g.id] : s.filter((x) => x !== g.id))} />
            ))}
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setSelected(groups.map((g) => g.id))}>☑️ تحديد الكل</Button>
            <Button variant="danger" disabled={!selected.length} onClick={() => void leave()}>تأكيد المغادرة</Button>
          </div>
          <JobProgressCard jobId={jobId} onDone={(run) => { setJobId(null); if (run.status === "failed") show(run.error?.split("\n")[0] || "فشلت المغادرة", "danger"); else { show("اكتملت المغادرة"); void load(); } }} />
        </div>
      )}
      {tab === "categories" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card p-4 space-y-2">
            <SectionTitle>التصنيفات الحالية</SectionTitle>
            <Table columns={["اسم", "عدد القروبات", ""]} rows={categories.map((c) => [
              c.name, String(c.groups_count),
              <Button key={c.id} variant="danger" onClick={async () => { try { await apiFetch(`/groups/categories/${c.id}`, { method: "DELETE" }); await load(); } catch (err) { show(err instanceof Error ? err.message : "تعذر الحذف", "danger"); } }}>حذف</Button>,
            ])} />
            <div className="flex gap-2 pt-2">
              <Field label="اسم تصنيف جديد" value={newCategory} onChange={setNewCategory} />
              <Button variant="primary" onClick={() => void addCategory()}>➕</Button>
            </div>
          </div>
          <div className="card p-4 space-y-2">
            <SectionTitle>🤖 التصنيف التلقائي الذكي</SectionTitle>
            <p className="text-xs text-surface-500">يصنف القروبات حسب كلمات مفتاحية في أسمائها (تسويق/تداول/عروض/تعليم/تقنية).</p>
            <Button variant="primary" onClick={() => void categorize()}>تصنيف تلقائي الآن</Button>
          </div>
        </div>
      )}
      {tab === "blacklist" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card p-4 space-y-2">
            <SectionTitle>القائمة السوداء للقروبات</SectionTitle>
            <Table columns={["قروب", "سبب", "تاريخ", ""]} rows={blacklist.map((b) => [
              b.group_value, b.reason || "—", new Date(b.created_at).toLocaleDateString("ar"),
              <Button key={b.id} variant="danger" onClick={() => void removeBlack(b.id)}>إزالة</Button>,
            ])} />
          </div>
          <div className="card p-4 space-y-2">
            <SectionTitle>➕ إضافة يدوياً</SectionTitle>
            <Field label="رابط أو معرف القروب" value={blackValue} onChange={setBlackValue} placeholder="@group" />
            <Field label="السبب" value={blackReason} onChange={setBlackReason} />
            <Button variant="danger" className="w-full" onClick={() => void addBlack()}>إضافة للقائمة السوداء</Button>
          </div>
        </div>
      )}
      {tab === "stats" && stats && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card p-4 space-y-2">
            <StatCard label="إجمالي القروبات" value={stats.total_groups} tone="brand" />
            <StatCard label="إجمالي الأعضاء" value={stats.total_members.toLocaleString()} tone="accent" />
            <StatCard label="منضم حديثاً (24 ساعة)" value={stats.joined_today} tone="warn" />
          </div>
          <div className="card p-4 space-y-2">
            <SectionTitle>التوزيع</SectionTitle>
            <Table columns={["النوع", "العدد"]} rows={Object.entries(stats.by_type).map(([k, v]) => [k, String(v)])} />
            <Table columns={["الحالة", "العدد"]} rows={Object.entries(stats.by_status).map(([k, v]) => [k, String(v)])} />
          </div>
          <div className="card p-4 space-y-2 lg:col-span-2">
            <SectionTitle>أكبر 10 قروبات</SectionTitle>
            <Table columns={["القروب", "الأعضاء"]} rows={stats.largest.map((g) => [g.name, g.members.toLocaleString()])} />
          </div>
        </div>
      )}
      <div className="mt-4"><Button onClick={() => push(["campaigns"])}>رجوع</Button></div>
      {node}
    </div>
  );
}

function ManageTemplates() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [rows, setRows] = useState<MessageTemplateRecord[]>([]);
  const [adding, setAdding] = useState(false);
  const [tName, setTName] = useState("");
  const [tKind, setTKind] = useState("group");
  const [tCategory, setTCategory] = useState("تسويق");
  const [tContent, setTContent] = useState("");

  const load = () => apiFetch<MessageTemplateRecord[]>("/campaigns/templates").then(setRows).catch(() => undefined);
  useEffect(() => { void load(); }, []);

  const save = async () => {
    if (!tName.trim() || !tContent.trim()) { show("أدخل الاسم والمحتوى", "danger"); return; }
    try {
      await apiFetch<MessageTemplateRecord>("/campaigns/templates", { method: "POST", body: JSON.stringify({ name: tName, kind: tKind, content: tContent, message_kind: "text", category: tCategory }) });
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
      <PageHeader title="إدارة قوالب الرسائل" subtitle="قوالب حقيقية تُستخدم في الحملات" icon={<PenLine className="h-5 w-5" />} />
      <div className="mb-3">
        <Button variant="primary" onClick={() => setAdding(!adding)}>{adding ? "❌ إلغاء" : "➕ إنشاء قالب جديد"}</Button>
      </div>
      {adding && (
        <div className="card p-5 space-y-3 mb-4">
          <Field label="اسم القالب" value={tName} onChange={setTName} />
          <div className="grid grid-cols-2 gap-2">
            <OptionButton label="📢 قروبات" selected={tKind === "group"} onClick={() => setTKind("group")} />
            <OptionButton label="💬 رسائل مباشرة" selected={tKind === "dm"} onClick={() => setTKind("dm")} />
          </div>
          <Field label="التصنيف" value={tCategory} onChange={setTCategory} />
          <TextArea label="نص القالب (يدعم المتغيرات و {spin:أ|ب})" rows={4} value={tContent} onChange={setTContent} />
          <Button variant="primary" className="w-full" onClick={() => void save()}>💾 حفظ القالب</Button>
        </div>
      )}
      <Table columns={["اسم", "نوع", "تصنيف", "آخر استخدام", ""]} rows={rows.map((t) => [
        t.name, t.kind === "dm" ? "رسائل مباشرة" : "قروبات", t.category || "—", t.last_used_at ? new Date(t.last_used_at).toLocaleString("ar") : "—",
        <Button key={t.id} variant="danger" onClick={() => void del(t.id)}>حذف</Button>,
      ])} />
      <div className="mt-4"><Button onClick={() => push(["campaigns"])}>رجوع</Button></div>
      {node}
    </div>
  );
}

function ScheduleCampaigns() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [rows, setRows] = useState<CampaignScheduleRecord[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [campaign, setCampaign] = useState("");
  const [pattern, setPattern] = useState("one_time");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [everyHours, setEveryHours] = useState("6");
  const [days, setDays] = useState<string[]>([]);

  const load = async () => {
    try {
      const [s, c] = await Promise.all([apiFetch<CampaignScheduleRecord[]>("/campaigns/schedules"), apiFetch<CampaignRecord[]>("/campaigns")]);
      setRows(s); setCampaigns(c);
    } catch { /* ignore */ }
  };
  useEffect(() => { void load(); }, []);

  const save = async () => {
    if (!campaign) { show("اختر حملة", "danger"); return; }
    try {
      let nextRun: string | null = null;
      if (pattern === "one_time" && date && time) nextRun = `${date}T${time}:00`;
      if (pattern === "daily" && time) nextRun = `${new Date().toISOString().slice(0, 10)}T${time}:00`;
      if (pattern === "days" && days.length && time) nextRun = `${new Date().toISOString().slice(0, 10)}T${time}:00`;
      const patternValue = pattern === "every_x_hours" ? `every_${everyHours}` : pattern === "days" ? `days:${days.join(",")}` : pattern;
      await apiFetch<CampaignScheduleRecord>("/campaigns/schedules", {
        method: "POST",
        body: JSON.stringify({ campaign_name: campaign, kind: "group", pattern: patternValue, next_run: nextRun }),
      });
      show("تم حفظ الجدول — سينفذه المجدول تلقائياً");
      await load();
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر الحفظ", "danger");
    }
  };
  const togglePause = async (id: number) => {
    try {
      await apiFetch(`/campaigns/schedules/${id}/toggle`, { method: "POST", body: JSON.stringify({}) });
      await load();
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر التحديث", "danger");
    }
  };
  const del = async (id: number) => {
    try {
      await apiFetch(`/campaigns/schedules/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر الحذف", "danger");
    }
  };

  return (
    <div className="animate-fade">
      <PageHeader title="جدولة الحملات (Scheduler)" subtitle="المجدول يشغّل الحملات تلقائياً في أوقاتها" icon={<CalendarClock className="h-5 w-5" />} />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5 space-y-3">
          <SectionTitle>➕ إنشاء جدول جديد</SectionTitle>
          <Field label="الحملة" value={campaign} onChange={setCampaign} placeholder="اختر اسم حملة محفوظة أو مسودة" />
          <div className="grid gap-2">
            <OptionButton label="📅 مرة واحدة" selected={pattern === "one_time"} onClick={() => setPattern("one_time")} />
            <OptionButton label="🔁 يومياً" selected={pattern === "daily"} onClick={() => setPattern("daily")} />
            <OptionButton label="📆 أيام محددة" selected={pattern === "days"} onClick={() => setPattern("days")} />
            <OptionButton label="🔄 كل X ساعات" selected={pattern === "every_x_hours"} onClick={() => setPattern("every_x_hours")} />
          </div>
          {(pattern === "one_time" || pattern === "daily" || pattern === "days") && (
            <div className="grid grid-cols-2 gap-2">
              {pattern === "one_time" && <Field label="التاريخ" placeholder="YYYY-MM-DD" value={date} onChange={setDate} />}
              <Field label="الوقت HH:MM" value={time} onChange={setTime} placeholder="10:00" />
            </div>
          )}
          {pattern === "days" && (
            <div className="grid grid-cols-4 gap-1">
              {["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"].map((d, i) => (
                <OptionButton key={d} label={d} selected={days.includes(String(i + 1))} onClick={() => setDays((s) => s.includes(String(i + 1)) ? s.filter((x) => x !== String(i + 1)) : [...s, String(i + 1)])} />
              ))}
            </div>
          )}
          {pattern === "every_x_hours" && <Field label="كل _ ساعات" value={everyHours} onChange={setEveryHours} />}
          <Button variant="primary" className="w-full" onClick={() => void save()}>💾 حفظ الجدول</Button>
        </div>
        <div className="card p-5 space-y-2">
          <SectionTitle>📋 الجداول النشطة</SectionTitle>
          <Table columns={["حملة", "نمط", "التالي", "تنفيذات", "حالة", ""]} rows={rows.map((s) => [
            s.campaign_name, s.pattern, s.next_run ? new Date(s.next_run).toLocaleString("ar") : "—", String(s.runs),
            s.status === "active" ? "🟢" : "⏸️",
            <div key={s.id} className="flex gap-1">
              <Button onClick={() => void togglePause(s.id)}>{s.status === "active" ? "⏸️" : "▶️"}</Button>
              <Button variant="danger" onClick={() => void del(s.id)}>حذف</Button>
            </div>,
          ])} />
        </div>
      </div>
      <div className="mt-4"><Button onClick={() => push(["campaigns"])}>رجوع</Button></div>
      {node}
    </div>
  );
}

function CampaignStats() {
  const { push } = useNav();
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [today, setToday] = useState<any>(null);
  useEffect(() => {
    apiFetch<CampaignStats>("/campaigns/stats").then(setStats).catch(() => undefined);
    apiFetch<any>("/reports/today").then(setToday).catch(() => undefined);
  }, []);
  return (
    <div className="animate-fade">
      <PageHeader title="إحصائيات وتقارير الحملات" icon={<BarChart3 className="h-5 w-5" />} />
      {stats && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="مكتملة" value={stats.done} tone="accent" />
          <StatCard label="نشطة" value={stats.active} tone="brand" />
          <StatCard label="متوقفة" value={stats.paused} tone="warn" />
          <StatCard label="مسودات" value={stats.drafts} tone="brand" />
        </div>
      )}
      {today && (
        <div className="card p-5 space-y-2">
          <SectionTitle>📊 نشاط اليوم (حقيقي)</SectionTitle>
          <Table columns={["المقياس", "القيمة"]} rows={[
            ["رسائل DM اليوم", String(today.dm_today)],
            ["رسائل قروبات اليوم", String(today.group_today)],
            ["مُجمَّع اليوم", String(today.gathered_today)],
            ["مُضاف اليوم", String(today.added_today)],
            ["FloodWaits اليوم", String(today.flood_today)],
          ]} />
        </div>
      )}
      <div className="mt-4"><Button onClick={() => push(["campaigns"])}>رجوع</Button></div>
    </div>
  );
}

function CampaignSettings() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [delay, setDelay] = useState("60-120");
  const [dailyLimit, setDailyLimit] = useState("25");
  const [switchCount, setSwitchCount] = useState("10");
  const [floodAction, setFloodAction] = useState("wait");
  const [failStop, setFailStop] = useState("30");

  const save = async () => {
    try {
      await apiFetch("/add/defaults", {
        method: "PUT",
        body: JSON.stringify({ values: {
          add_default_delay_from: delay.split("-")[0] || "60",
          add_default_delay_to: delay.split("-")[1] || "120",
          add_default_daily_limit: dailyLimit,
          add_default_switch_count: switchCount,
          add_default_flood_action: floodAction,
        } }),
      });
      show("تم حفظ الإعدادات — ستُستخدم افتراضياً في الحملات الجديدة");
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر الحفظ", "danger");
    }
  };

  return (
    <div className="animate-fade">
      <PageHeader title="إعدادات حملات القروبات" icon={<Settings className="h-5 w-5" />} />
      <div className="mx-auto max-w-lg card p-6 space-y-4">
        <Field label="التأخير الافتراضي بين الرسائل (ثانية)" value={delay} onChange={setDelay} placeholder="60-120" />
        <Field label="الحد اليومي الافتراضي/حساب" value={dailyLimit} onChange={setDailyLimit} />
        <Field label="رسائل قبل تبديل الحساب" value={switchCount} onChange={setSwitchCount} />
        <Field label="نسبة الفشل للإيقاف %" value={failStop} onChange={setFailStop} />
        <SectionTitle>سلوك الأخطاء الافتراضي</SectionTitle>
        <div className="grid gap-2">
          <OptionButton label="⭐ انتظار + متابعة" selected={floodAction === "wait"} onClick={() => setFloodAction("wait")} />
          <OptionButton label="تبديل فوري" selected={floodAction === "switch"} onClick={() => setFloodAction("switch")} />
          <OptionButton label="إيقاف + إشعار" selected={floodAction === "stop"} onClick={() => setFloodAction("stop")} />
        </div>
        <Button variant="primary" className="w-full" onClick={() => void save()}>💾 حفظ الإعدادات</Button>
      </div>
      <div className="mt-4"><Button onClick={() => push(["campaigns"])}>رجوع</Button></div>
      {node}
    </div>
  );
}
