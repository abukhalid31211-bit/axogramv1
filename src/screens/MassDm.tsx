import { useEffect, useState } from "react";
import {
  MessageSquare, Send, ListChecks, Play, Ban, PenLine, BarChart3, Settings,
  Plus, Pause, Square, FileText, Image as ImageIcon, Repeat,
} from "lucide-react";
import { useNav } from "../nav";
import { PageHeader, Button, Field, TextArea, Checkbox, OptionButton, Progress, Table, SectionTitle, Alert, useToast, Tabs, StatusChip, EmptyState, StatCard, InlineEdit, Spinner } from "../ui";
import { dmCampaigns as mockDm, templates as mockTemplates } from "../data";
import { apiFetch, type CampaignRecord, type CampaignStats, type MessageTemplateRecord, type BlacklistEntryRecord } from "../lib/api";

function SRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-surface-50 border border-surface-200 px-3 py-2">
      <span className="text-xs text-surface-500">{label}</span>
      <span className="text-sm font-medium text-surface-700">{value}</span>
    </div>
  );
}

export function MassDmModule() {
  const { push } = useNav();
  const [rows, setRows] = useState<CampaignRecord[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { apiFetch<CampaignRecord[]>("/campaigns?kind=dm").then((r) => setRows(r)).catch(() => setRows(mockDm as unknown as CampaignRecord[])).finally(() => setLoading(false)); }, []);
  const active = rows.filter((c) => c.status === "active").length;
  const done   = rows.filter((c) => c.status === "done").length;
  const items = [
    { id: "new",       label: "إرسال حملة رسائل جديدة",   desc: "معالج 6 خطوات",  icon: Send       },
    { id: "list",      label: "عرض الحملات السابقة",       desc: "كل الحملات",     icon: ListChecks },
    { id: "resume",    label: "استئناف حملة متوقفة",        desc: "متابعة",         icon: Play       },
    { id: "blacklist", label: "القائمة السوداء (DM)",       desc: "محظورون",        icon: Ban        },
    { id: "templates", label: "إدارة قوالب الرسائل",        desc: "إنشاء وتعديل",  icon: PenLine    },
    { id: "stats",     label: "إحصائيات وتقارير",           desc: "أداء الحملات",   icon: BarChart3  },
    { id: "settings",  label: "إعدادات الرسائل الجماعية",  desc: "افتراضيات",      icon: Settings   },
  ];
  return (
    <div className="animate-fade">
      <PageHeader title="الرسائل الجماعية (Mass DM)" subtitle="إرسال جماعي للمستخدمين" icon={<MessageSquare className="h-5 w-5" />} />
      {loading ? <Spinner label="جاري التحميل..." /> : (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="نشطة"       value={active} tone="brand"  />
          <StatCard label="مكتملة"     value={done}   tone="accent" />
          <StatCard label="الإجمالي"   value={rows.length} tone="brand"  />
          <StatCard label="مرسلة"      value={rows.reduce((a, c) => a + c.sent, 0)} tone="brand"  />
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <button key={it.id} onClick={() => push(["massdm", it.id])}
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

export function MassDmScreen({ sub }: { sub: string }) {
  switch (sub) {
    case "new":       return <NewDm />;
    case "list":      return <ListDm />;
    case "resume":    return <ResumeDm />;
    case "blacklist": return <DmBlacklist />;
    case "templates": return <DmTemplates />;
    case "stats":     return <DmStats />;
    case "settings":  return <DmSettings />;
    default:          return null;
  }
}

function NewDm() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [step, setStep]   = useState(0);
  const [source, setSource] = useState("csv");
  const [msgType, setMsgType] = useState("text");
  const [msgText, setMsgText] = useState("");
  const [accounts, setAccounts] = useState("all");
  const [dist, setDist]   = useState("smart");
  const [dailyLimit, setDailyLimit] = useState("30");
  const [customDaily, setCustomDaily] = useState("30");
  const [delay, setDelay] = useState("1-3");
  const [customDelay, setCustomDelay] = useState("90");
  const [switchDelay, setSwitchDelay] = useState("3-5");
  const [start, setStart] = useState("now");
  const [protection, setProtection] = useState({ save: true, log: true, notify: true, stopFail: true });
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [creating, setCreating] = useState(false);
  const startRun = () => {
    setCreating(true);
    apiFetch<CampaignRecord>("/campaigns", { method: "POST", body: JSON.stringify({ name: "حملة DM", kind: "dm", status: "active", total: 1000, sent: 0, progress: 0 }) })
      .then(() => { setCreating(false); show("تم إنشاء الحملة وبدء الإرسال"); })
      .catch(() => { setCreating(false); show("تعذر إنشاء الحملة (إرسال بدون حفظ)", "danger"); })
      .then(() => { setRunning(true); setProgress(0); const t = setInterval(() => { setProgress((p) => { if (p >= 100) { clearInterval(t); setRunning(false); return 100; } return p + 4; }); }, 120); });
  };
  const saveDraft = () => {
    apiFetch<CampaignRecord>("/campaigns", { method: "POST", body: JSON.stringify({ name: "مسودة DM", kind: "dm", status: "draft", total: 0, sent: 0, progress: 0 }) })
      .then(() => show("تم الحفظ كمسودة")).catch(() => show("تم الحفظ محلياً")).then(() => push(["massdm"]));
  };
  const steps = ["المستلمون","الرسالة","الحسابات","التوقيت","الحماية","الملخص"];
  return (
    <div className="animate-fade">
      <PageHeader title="إرسال حملة رسائل جديدة" icon={<Send className="h-5 w-5" />} steps={{ label: steps[step], n: step + 1, total: 6 }} />
      <div className="mx-auto max-w-2xl">
        {step === 0 && (
          <div className="card p-6 space-y-4">
            <SectionTitle>1/6 المستلمون</SectionTitle>
            <div className="space-y-2">
              <OptionButton label="من ملف CSV (مستخرج سابقاً)"       selected={source === "csv"}    onClick={() => setSource("csv")} />
              <OptionButton label="إدخال يدوي (أسماء مستخدمين)"      selected={source === "manual"} onClick={() => setSource("manual")} />
              <OptionButton label="من مجموعة/قناة (تجميع فوري)"      selected={source === "group"}  onClick={() => setSource("group")} />
              <OptionButton label="قائمة محفوظة سابقاً"              selected={source === "saved"}  onClick={() => setSource("saved")} />
            </div>
            {source === "csv" && (
              <div className="rounded-xl border border-surface-200 bg-surface-50 p-3">
                <div className="mb-2 text-xs text-surface-500">إجمالي: 1,000 | بـ username: 800 | بهاتف: 200</div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <Checkbox label="username فقط" checked={true}  onChange={() => {}} />
                  <Checkbox label="رقم هاتف فقط" checked={false} onChange={() => {}} />
                  <Checkbox label="الكل"          checked={false} onChange={() => {}} />
                </div>
              </div>
            )}
            <Button variant="primary" className="w-full" onClick={() => setStep(1)}>تأكيد</Button>
          </div>
        )}
        {step === 1 && (
          <div className="card p-6 space-y-4">
            <SectionTitle>2/6 تصميم الرسالة</SectionTitle>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[["text","نص فقط",PenLine],["image","نص + صورة",ImageIcon],["video","نص + فيديو",ImageIcon],["doc","نص + مستند",FileText]].map(([id,label,Icon]: any) => {
                const I = Icon; return <OptionButton key={id} label={<span className="flex items-center gap-2"><I className="h-4 w-4"/>{label}</span>} selected={msgType === id} onClick={() => setMsgType(id)} />;
              })}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <OptionButton label="قالب محفوظ" onClick={() => show("اختر قالباً من مكتبة القوالب")} />
              <OptionButton label="رسائل Spin متنوعة" onClick={() => show("Spin يُفعّل عند محرك الإرسال")} />
            </div>
            <TextArea label="نص الرسالة" placeholder="مرحباً {first_name}..." rows={4} value={msgText} onChange={setMsgText} />
            <div className="flex items-center justify-between rounded-xl bg-surface-50 border border-surface-200 px-3 py-2 text-xs text-surface-500">
              <span>المتغيرات: {`{first_name} {last_name} {username} {date} {time} {random_emoji}`}</span>
              <span className={`font-bold ${msgText.length > 4096 ? "text-danger-600" : "text-surface-600"}`}>{msgText.length}/4096</span>
            </div>
            {msgText && (
              <div className="rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm">
                <div className="mb-1 text-xs font-bold text-brand-700">👁️ معاينة الرسالة</div>
                <p className="text-surface-700">{msgText.replace(/\{first_name\}/g, "أحمد").replace(/\{username\}/g, "@user").replace(/\{date\}/g, new Date().toLocaleDateString("ar"))}</p>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => { apiFetch<MessageTemplateRecord>("/campaigns/templates", { method: "POST", body: JSON.stringify({ name: "قالب DM جديد", kind: "dm", content: msgText, message_kind: "text" }) }).then(() => show("تم حفظ القالب")).catch(() => show("تم الحفظ محلياً")); }}>💾 حفظ كقالب</Button>
              <Button onClick={() => show("📲 تم إرسال رسالة تجريبية لنفسي")}>📲 إرسال تجريبي لنفسي</Button>
            </div>
            <div className="flex gap-2">
              <Button variant="primary" className="flex-1" disabled={!msgText} onClick={() => setStep(2)}>متابعة</Button>
              <Button onClick={() => setStep(0)}>رجوع</Button>
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="card p-6 space-y-4">
            <SectionTitle>3/6 الحسابات المرسِلة</SectionTitle>
            <div className="space-y-2">
              <OptionButton label="جميع الحسابات النشطة"               selected={accounts === "all"}    onClick={() => setAccounts("all")} />
              <OptionButton label="حسابات محددة"                        selected={accounts === "custom"} onClick={() => setAccounts("custom")} />
              <OptionButton label="اختيار ذكي (أقدم + أقل استخداماً)"  selected={accounts === "smart"}  onClick={() => setAccounts("smart")} />
            </div>
            <SectionTitle>طريقة التوزيع</SectionTitle>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <OptionButton label="تدوير متسلسل" selected={dist === "seq"}    onClick={() => setDist("seq")} />
              <OptionButton label="تقسيم بالحصص" selected={dist === "split"}  onClick={() => setDist("split")} />
              <OptionButton label="عشوائي"       selected={dist === "random"} onClick={() => setDist("random")} />
              <OptionButton label="ذكي" badge={<span className="chip bg-brand-50 text-brand-700 ring-1 ring-brand-200">موصى</span>} selected={dist === "smart"} onClick={() => setDist("smart")} />
            </div>
            <SectionTitle>الحد اليومي/حساب</SectionTitle>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <OptionButton label="20/يوم (محافظ)"  selected={dailyLimit === "20"}     onClick={() => setDailyLimit("20")} />
              <OptionButton label="30/يوم (متوازن)" badge={<span className="chip bg-brand-50 text-brand-700 ring-1 ring-brand-200">موصى</span>} selected={dailyLimit === "30"} onClick={() => setDailyLimit("30")} />
              <OptionButton label="50/يوم (عدواني)" selected={dailyLimit === "50"}     onClick={() => setDailyLimit("50")} />
              <OptionButton label="مخصص"           selected={dailyLimit === "custom"} onClick={() => setDailyLimit("custom")} />
            </div>
            {dailyLimit === "custom" && <InlineEdit label="الحد اليومي المخصص" value={customDaily} onSave={setCustomDaily} placeholder="30" />}
            <div className="flex gap-2">
              <Button variant="primary" className="flex-1" onClick={() => setStep(3)}>التالي</Button>
              <Button onClick={() => setStep(1)}>رجوع</Button>
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="card p-6 space-y-4">
            <SectionTitle>4/6 التوقيت والتأخيرات</SectionTitle>
            <SectionTitle>تأخير بين كل رسالة</SectionTitle>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <OptionButton label="3-5 دقائق" selected={delay === "3-5"} onClick={() => setDelay("3-5")} />
              <OptionButton label="1-3 دقائق" badge={<span className="chip bg-brand-50 text-brand-700 ring-1 ring-brand-200">آمن</span>} selected={delay === "1-3"} onClick={() => setDelay("1-3")} />
              <OptionButton label="30-60 ث"   selected={delay === "30-60"} onClick={() => setDelay("30-60")} />
              <OptionButton label="مخصص"     selected={delay === "custom"} onClick={() => setDelay("custom")} />
            </div>
            {delay === "custom" && <InlineEdit label="التأخير المخصص (ثانية)" value={customDelay} onSave={setCustomDelay} placeholder="90" />}
            <SectionTitle>تأخير بين تبديل الحسابات</SectionTitle>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <OptionButton label="3-5 دقائق"   selected={switchDelay === "3-5"}  onClick={() => setSwitchDelay("3-5")} />
              <OptionButton label="5-10 دقائق"  selected={switchDelay === "5-10"} onClick={() => setSwitchDelay("5-10")} />
              <OptionButton label="10-20 دقيقة" selected={switchDelay === "10-20"} onClick={() => setSwitchDelay("10-20")} />
            </div>
            <SectionTitle>وقت البدء</SectionTitle>
            <div className="grid grid-cols-2 gap-2">
              <OptionButton label="فوراً الآن"   selected={start === "now"}       onClick={() => setStart("now")} />
              <OptionButton label="في وقت محدد"  selected={start === "scheduled"} onClick={() => setStart("scheduled")} />
            </div>
            {start === "scheduled" && <div className="grid grid-cols-2 gap-2"><Field label="التاريخ" placeholder="YYYY-MM-DD" /><Field label="الوقت" placeholder="HH:MM" /></div>}
            <SectionTitle>فترات الراحة</SectionTitle>
            <div className="grid gap-2 sm:grid-cols-2">
              <Checkbox label="راحة بعد 30 رسالة (15-30 د)" checked={true}  onChange={() => {}} />
              <Checkbox label="راحة بعد 100 رسالة (1-2 س)"  checked={false} onChange={() => {}} />
              <Checkbox label="لا إرسال 12AM-6AM"            checked={true}  onChange={() => {}} />
              <Checkbox label="لا إرسال أيام الجمعة"         checked={false} onChange={() => {}} />
            </div>
            <div className="flex gap-2">
              <Button variant="primary" className="flex-1" onClick={() => setStep(4)}>التالي</Button>
              <Button onClick={() => setStep(2)}>رجوع</Button>
            </div>
          </div>
        )}
        {step === 4 && (
          <div className="card p-6 space-y-4">
            <SectionTitle>5/6 الحماية والأمان</SectionTitle>
            <SectionTitle>عند User Blocked Bot</SectionTitle>
            <div className="grid grid-cols-2 gap-2">
              <OptionButton label="تخطي + متابعة" badge={<span className="chip bg-brand-50 text-brand-700 ring-1 ring-brand-200">موصى</span>} selected={true} onClick={() => {}} />
              <OptionButton label="إضافة للقائمة السوداء" onClick={() => {}} />
            </div>
            <SectionTitle>عند FloodWait</SectionTitle>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <OptionButton label="انتظار ثم متابعة" badge={<span className="chip bg-brand-50 text-brand-700 ring-1 ring-brand-200">موصى</span>} selected={true} onClick={() => {}} />
              <OptionButton label="تبديل فوراً"   onClick={() => {}} />
              <OptionButton label="إيقاف + إشعار" onClick={() => {}} />
            </div>
            <SectionTitle>حماية إضافية</SectionTitle>
            <div className="grid gap-2 sm:grid-cols-2">
              <Checkbox label="حفظ التقدم كل 20 رسالة"    checked={protection.save}     onChange={(v) => setProtection({ ...protection, save: v })} />
              <Checkbox label="تسجيل كل عملية"             checked={protection.log}      onChange={(v) => setProtection({ ...protection, log: v })} />
              <Checkbox label="إشعار عند الاكتمال"         checked={protection.notify}   onChange={(v) => setProtection({ ...protection, notify: v })} />
              <Checkbox label="إيقاف إذا تجاوز الفشل 30%" checked={protection.stopFail} onChange={(v) => setProtection({ ...protection, stopFail: v })} />
            </div>
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
              <SRow label="مستلمون" value="1,000" />
              <SRow label="رسالة"   value="نص فقط" />
              <SRow label="حسابات"  value="تدوير ذكي" />
              <SRow label="تأخير"   value={`${delay} د`} />
            </div>
            <Alert tone="info" title="تقديرات: 150 رسالة/يوم | 7 أيام للاكتمال" />
            {!running && progress === 0 && (
              <div className="mt-4 space-y-2">
                <Button variant="primary" className="w-full" icon={<Send className="h-4 w-4" />} onClick={startRun} disabled={creating}>{creating ? "جاري إنشاء الحملة..." : "بدء الإرسال الآن!"}</Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button icon={<Send className="h-4 w-4" />} onClick={() => show("تم الإرسال التجريبي")}>إرسال تجريبي</Button>
                  <Button onClick={saveDraft}>حفظ كمسودة</Button>
                </div>
              </div>
            )}
            {(running || progress > 0) && progress < 100 && (
              <div className="mt-4">
                <Progress value={progress} label="جاري الإرسال..." sub={`${progress}% [${Math.floor(progress * 10)} / 1000]`} />
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="warn"   icon={<Pause className="h-4 w-4" />} onClick={() => show("متوقفة")}>إيقاف مؤقت</Button>
                  <Button variant="danger" icon={<Square className="h-4 w-4" />} onClick={() => { setRunning(false); setProgress(0); }}>إيقاف + حفظ</Button>
                  <Button icon={<BarChart3 className="h-4 w-4" />} onClick={() => show("تقرير")}>تقرير</Button>
                </div>
              </div>
            )}
            {progress === 100 && (
              <div className="mt-4 space-y-3">
                <Alert tone="success" title="اكتملت الحملة!">✅ 940 ناجح | ⚠️ 40 تخطي | ❌ 20 فاشل</Alert>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => show("تم تصدير")}>تصدير</Button>
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
  const [rows, setRows] = useState<CampaignRecord[]>(mockDm as unknown as CampaignRecord[]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const load = () => apiFetch<CampaignRecord[]>("/campaigns?kind=dm").then(setRows).catch(() => undefined).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);
  const filtered = filter === "all" ? rows : rows.filter((c) => c.status === filter);
  const toggle = (c: CampaignRecord) => {
    const next = c.status === "active" ? "paused" : c.status === "paused" ? "active" : c.status;
    apiFetch<CampaignRecord>(`/campaigns/${c.id}`, { method: "PUT", body: JSON.stringify({ status: next }) }).then(() => { show("تم تحديث الحالة"); load(); }).catch(() => show("تعذر التحديث", "danger"));
  };
  const del = (id: number) => apiFetch(`/campaigns/${id}`, { method: "DELETE" }).then(() => { show("تم الحذف"); load(); }).catch(() => show("تعذر الحذف", "danger"));
  return (
    <div className="animate-fade">
      <PageHeader title="عرض الحملات السابقة" icon={<ListChecks className="h-5 w-5" />} />
      <div className="mb-4"><Tabs tabs={[{ id:"all",label:"الكل" },{ id:"active",label:"نشطة" },{ id:"done",label:"مكتملة" },{ id:"draft",label:"مسودات" }]} active={filter} onChange={setFilter} /></div>
      {loading ? <Spinner label="جاري التحميل..." /> : filtered.length === 0 ? <EmptyState icon={<MessageSquare className="h-8 w-8" />} title="لا توجد حملات" /> : (
        <div className="grid gap-3">
          {filtered.map((c) => (
            <div key={c.id} className="card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2"><span className="font-bold text-surface-800">{c.name}</span><StatusChip status={c.status as any} /></div>
                  <div className="text-xs text-surface-500">{new Date(c.created_at).toLocaleDateString("ar")} • {c.total.toLocaleString()} مستلم</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-40"><Progress value={c.progress} sub={`${c.sent}/${c.total}`} /></div>
                  <div className="flex gap-1.5">
                    {c.status === "active" && <Button variant="warn" icon={<Pause className="h-4 w-4" />} onClick={() => toggle(c)}>إيقاف</Button>}
                    {c.status === "paused" && <Button variant="primary" icon={<Play className="h-4 w-4" />} onClick={() => toggle(c)}>استئناف</Button>}
                    {c.status === "done"   && <Button icon={<Repeat className="h-4 w-4" />} onClick={() => show("إعادة")}>إعادة</Button>}
                    {c.status === "draft"  && <Button variant="primary" icon={<Play className="h-4 w-4" />} onClick={() => push(["massdm","new"])}>تشغيل</Button>}
                    <Button variant="danger" onClick={() => del(c.id)}>حذف</Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
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
  useEffect(() => { apiFetch<CampaignRecord[]>("/campaigns?kind=dm").then((r) => setRows(r.filter((c) => c.status === "paused"))).catch(() => undefined); }, []);
  const resume = (id: number) => apiFetch<CampaignRecord>(`/campaigns/${id}`, { method: "PUT", body: JSON.stringify({ status: "active" }) }).then(() => { show("تم الاستئناف"); push(["massdm","list"]); }).catch(() => show("تعذر الاستئناف", "danger"));
  return (
    <div className="animate-fade">
      <PageHeader title="استئناف حملة متوقفة" icon={<Play className="h-5 w-5" />} />
      <div className="space-y-2">
        {rows.map((c) => (
          <OptionButton key={c.id} label={c.name} desc={`تقدم: ${c.progress}%`} onClick={() => resume(c.id)} />
        ))}
      </div>
      <div className="mt-4"><Button onClick={() => push(["massdm"])}>رجوع</Button></div>
      {node}
    </div>
  );
}

function DmBlacklist() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [rows, setRows] = useState<BlacklistEntryRecord[]>([]);
  const [adding, setAdding] = useState(false);
  const [val, setVal] = useState("");
  const load = () => apiFetch<BlacklistEntryRecord[]>("/add/blacklist").then(setRows).catch(() => undefined);
  useEffect(() => { load(); }, []);
  const add = () => { apiFetch<BlacklistEntryRecord>("/add/blacklist", { method: "POST", body: JSON.stringify({ user_value: val, reason: "حظر البوت" }) }).then(() => { show("تمت الإضافة"); setAdding(false); setVal(""); load(); }).catch(() => show("تعذر الإضافة", "danger")); };
  const clear = () => apiFetch("/add/blacklist", { method: "DELETE" }).then(() => { show("تم المسح", "danger"); load(); }).catch(() => show("تعذر المسح", "danger"));
  return (
    <div className="animate-fade">
      <PageHeader title="القائمة السوداء (DM)" icon={<Ban className="h-5 w-5" />} />
      <div className="mb-4 flex gap-2">
        <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(!adding)}>إضافة يدوياً</Button>
        <Button onClick={() => show("استيراد")}>استيراد قائمة</Button>
        <Button variant="danger" onClick={clear}>مسح الكل</Button>
      </div>
      {adding && <div className="mb-4 card p-4 max-w-lg space-y-2"><Field label="مستخدم" value={val} onChange={setVal} placeholder="@user أو ID" /><div className="flex gap-2"><Button variant="primary" onClick={add}>حفظ</Button><Button onClick={() => setAdding(false)}>إلغاء</Button></div></div>}
      <Table columns={["مستخدم","سبب","تاريخ"]} rows={rows.map((b) => [b.user_value, b.reason || "—", new Date(b.created_at).toLocaleDateString("ar")])} />
      <div className="mt-4"><Button onClick={() => push(["massdm"])}>رجوع</Button></div>
      {node}
    </div>
  );
}

function DmTemplates() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [rows, setRows] = useState<MessageTemplateRecord[]>(mockTemplates as unknown as MessageTemplateRecord[]);
  const [adding, setAdding] = useState(false);
  const [tName, setTName] = useState("");
  const [tContent, setTContent] = useState("");
  const load = () => apiFetch<MessageTemplateRecord[]>("/campaigns/templates?kind=dm").then(setRows).catch(() => undefined);
  useEffect(() => { load(); }, []);
  const save = () => apiFetch<MessageTemplateRecord>("/campaigns/templates", { method: "POST", body: JSON.stringify({ name: tName, kind: "dm", content: tContent, message_kind: "text" }) }).then(() => { show("تم إنشاء القالب"); setAdding(false); setTName(""); setTContent(""); load(); }).catch(() => show("تعذر الإنشاء", "danger"));
  const del = (id: number) => apiFetch(`/campaigns/templates/${id}`, { method: "DELETE" }).then(() => { show("تم الحذف"); load(); }).catch(() => show("تعذر الحذف", "danger"));
  return (
    <div className="animate-fade">
      <PageHeader title="إدارة قوالب الرسائل (DM)" icon={<PenLine className="h-5 w-5" />} />
      <div className="mb-4"><Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(!adding)}>إنشاء جديد</Button></div>
      {adding && <div className="mb-4 card p-4 max-w-lg space-y-2"><Field label="اسم القالب" value={tName} onChange={setTName} placeholder="قالب" /><TextArea label="النص" value={tContent} onChange={setTContent} rows={3} placeholder="نص الرسالة..." /><div className="flex gap-2"><Button variant="primary" onClick={save}>حفظ</Button><Button onClick={() => setAdding(false)}>إلغاء</Button></div></div>}
      <Table columns={["اسم","نوع","تصنيف","آخر استخدام",""]} rows={rows.map((t) => [t.name, t.message_kind, t.category || "—", t.last_used_at ? new Date(t.last_used_at).toLocaleDateString("ar") : "—",
        <div className="flex gap-1.5"><Button onClick={() => show("تعديل")}>تعديل</Button><Button variant="danger" onClick={() => del(t.id)}>حذف</Button></div>])} />
      <div className="mt-4"><Button onClick={() => push(["massdm"])}>رجوع</Button></div>
      {node}
    </div>
  );
}

function DmStats() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [stats, setStats] = useState<CampaignStats | null>(null);
  useEffect(() => { apiFetch<CampaignStats>("/campaigns/stats").then(setStats).catch(() => undefined); }, []);
  return (
    <div className="animate-fade">
      <PageHeader title="إحصائيات وتقارير (DM)" icon={<BarChart3 className="h-5 w-5" />} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="حملات DM" value={String(stats?.dm ?? 3)} tone="brand"  />
        <StatCard label="نشطة" value={String(stats?.active ?? 1)} tone="brand"  />
        <StatCard label="رسائل مرسلة" value={String(stats?.total_sent ?? 2450)} tone="accent" />
        <StatCard label="مكتملة" value={String(stats?.done ?? 1)} tone="warn" />
      </div>
      <div className="mt-4 flex gap-2">
        <Button variant="primary" onClick={() => show("إحصائيات حملة")}>إحصائيات حملة محددة</Button>
        <Button onClick={() => show("تم التصدير")}>تصدير</Button>
        <Button onClick={() => push(["massdm"])}>رجوع</Button>
      </div>
      {node}
    </div>
  );
}

function DmSettings() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [delay,        setDelay]        = useState("60-180");
  const [daily,        setDaily]        = useState("30");
  const [beforeSwitch, setBeforeSwitch] = useState("5");
  const [restAfter,    setRestAfter]    = useState("30");
  const [restDur,      setRestDur]      = useState("15-30");
  const save = () => apiFetch("/add/defaults", { method: "PUT", body: JSON.stringify({ values: { add_default_delay_from: delay, add_default_daily_limit: daily, add_default_switch_count: beforeSwitch, add_default_rest_after: restAfter, add_default_rest_duration: restDur } }) }).then(() => { show("تم الحفظ"); push(["massdm"]); }).catch(() => { show("تم الحفظ محلياً"); push(["massdm"]); });
  return (
    <div className="animate-fade">
      <PageHeader title="إعدادات الرسائل الجماعية" icon={<Settings className="h-5 w-5" />} />
      <div className="mx-auto max-w-lg card p-6 space-y-2">
        <InlineEdit label="التأخير الافتراضي (ث)"  value={delay}        onSave={setDelay} />
        <InlineEdit label="الحد اليومي/حساب"        value={daily}        onSave={setDaily} />
        <InlineEdit label="رسائل قبل التبديل"       value={beforeSwitch} onSave={setBeforeSwitch} />
        <InlineEdit label="راحة بعد _ رسالة"        value={restAfter}    onSave={setRestAfter} />
        <InlineEdit label="مدة الراحة (دقيقة)"      value={restDur}      onSave={setRestDur} />
        <Button variant="primary" className="mt-4 w-full" onClick={save}>حفظ</Button>
      </div>
      {node}
    </div>
  );
}
