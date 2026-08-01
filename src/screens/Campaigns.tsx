import { useEffect, useState } from "react";
import {
  Megaphone, Plus, ListChecks, Play, Pause, Square, FolderOpen, PenLine,
  CalendarClock, BarChart3, Settings, Send, Image as ImageIcon, Video,
  FileText, Repeat, Plus as PlusIcon, Minus, Bell,
} from "lucide-react";
import { useNav } from "../nav";
import { PageHeader, Button, Field, TextArea, Checkbox, OptionButton, Progress, Table, SectionTitle, Alert, useToast, Tabs, StatusChip, EmptyState, StatCard, InlineEdit, Spinner } from "../ui";
import { campaigns as mockCampaigns, groups as mockGroups, templates as mockTemplates, schedules as mockSchedules } from "../data";
import { apiFetch, type CampaignRecord, type CampaignStats, type CampaignScheduleRecord, type MessageTemplateRecord } from "../lib/api";

function SRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-surface-50 border border-surface-200 px-3 py-2">
      <span className="text-xs text-surface-500">{label}</span>
      <span className="text-sm font-medium text-surface-700">{value}</span>
    </div>
  );
}

export function CampaignsModule() {
  const { push } = useNav();
  const [rows, setRows] = useState<CampaignRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<CampaignRecord[]>("/campaigns").then(setRows).catch(() => setRows(mockCampaigns as unknown as CampaignRecord[])).finally(() => setLoading(false));
  }, []);

  const active = rows.filter((c) => c.status === "active").length;
  const paused = rows.filter((c) => c.status === "paused").length;
  const done   = rows.filter((c) => c.status === "done").length;
  const items = [
    { id: "new",       label: "إنشاء حملة جديدة",        desc: "معالج 7 خطوات",      icon: Plus         },
    { id: "list",      label: "عرض الحملات",              desc: "كل الحملات",          icon: ListChecks   },
    { id: "resume",    label: "استئناف حملة متوقفة",       desc: "متابعة",              icon: Play         },
    { id: "groups",    label: "إدارة القروبات المستهدفة",  desc: "انضمام وتصنيف",      icon: FolderOpen   },
    { id: "templates", label: "إدارة قوالب الرسائل",       desc: "إنشاء وتعديل",       icon: PenLine      },
    { id: "schedule",  label: "جدولة الحملات",             desc: "تكرار وأوقات",       icon: CalendarClock },
    { id: "stats",     label: "إحصائيات وتقارير",          desc: "أداء الحملات",        icon: BarChart3    },
    { id: "settings",  label: "إعدادات حملات القروبات",    desc: "افتراضيات",           icon: Settings     },
  ];
  return (
    <div className="animate-fade">
      <PageHeader title="حملات رسائل القروبات" subtitle="إنشاء وإدارة الحملات" icon={<Megaphone className="h-5 w-5" />} />
      {loading ? <Spinner label="جاري تحميل الحملات..." /> : (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="نشطة"        value={active} tone="brand"  />
          <StatCard label="متوقفة"      value={paused} tone="warn"   />
          <StatCard label="مكتملة"      value={done}   tone="accent" />
          <StatCard label="الإجمالي"    value={rows.length} tone="brand"  />
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
    case "new":       return <NewCampaign />;
    case "list":      return <ListCampaigns />;
    case "resume":    return <ResumeCampaign />;
    case "groups":    return <ManageGroups />;
    case "templates": return <ManageTemplates />;
    case "schedule":  return <ScheduleCampaigns />;
    case "stats":     return <CampaignStats />;
    case "settings":  return <CampaignSettings />;
    default:          return null;
  }
}

function NewCampaign() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [step, setStep]   = useState(0);
  const [name, setName]   = useState("");
  const [groupSource, setGroupSource] = useState("joined");
  const [msgType, setMsgType] = useState("text");
  const [msgText, setMsgText] = useState("");
  const [accountChoice, setAccountChoice] = useState("all");
  const [dist, setDist]   = useState("smart");
  const [dailyLimit, setDailyLimit] = useState("25");
  const [customDaily, setCustomDaily] = useState("25");
  const [delay, setDelay] = useState("1-3");
  const [customDelay, setCustomDelay] = useState("90");
  const [switchDelay, setSwitchDelay] = useState("3-5");
  const [start, setStart] = useState("now");
  const [protection, setProtection] = useState({ save: true, log: true, notify: true, stopFail: true });
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [creating, setCreating] = useState(false);
  const [groupsList, setGroupsList] = useState(mockGroups);

  useEffect(() => { apiFetch<CampaignRecord[]>("/campaigns").catch(() => undefined); }, []);

  const startRun = () => {
    setCreating(true);
    apiFetch<CampaignRecord>("/campaigns", {
      method: "POST",
      body: JSON.stringify({ name: name || "حملة", kind: "group", status: "active", total: 87, sent: 0, progress: 0 }),
    }).then((c) => {
      setCreating(false); setRunning(true); setProgress(0);
      const t = setInterval(() => { setProgress((p) => { if (p >= 100) { clearInterval(t); setRunning(false); return 100; } return p + 4; }); }, 120);
      show("تم إنشاء الحملة وبدء التشغيل");
    }).catch(() => {
      setCreating(false);
      show("تعذر إنشاء الحملة (سيعمل بدون حفظ)", "danger");
      setRunning(true); setProgress(0);
      const t = setInterval(() => { setProgress((p) => { if (p >= 100) { clearInterval(t); setRunning(false); return 100; } return p + 4; }); }, 120);
    });
  };

  const saveDraft = () => {
    apiFetch<CampaignRecord>("/campaigns", {
      method: "POST",
      body: JSON.stringify({ name: name || "حملة", kind: "group", status: "draft", total: 0, sent: 0, progress: 0 }),
    }).then(() => show("تم الحفظ كمسودة")).catch(() => show("تم الحفظ كمسودة محلياً")).then(() => push(["campaigns"]));
  };

  const steps = ["اسم الحملة","القروبات","الرسالة","الحسابات","التوقيت","الحماية","الملخص"];
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
              <OptionButton label="من القروبات المنضم لها"       selected={groupSource === "joined"} onClick={() => setGroupSource("joined")} />
              <OptionButton label="روابط جديدة (انضمام تلقائي)"  selected={groupSource === "new"}    onClick={() => setGroupSource("new")} />
              <OptionButton label="استيراد من ملف"                selected={groupSource === "file"}   onClick={() => setGroupSource("file")} />
              <OptionButton label="مزيج (موجودة + جديدة)"         selected={groupSource === "mix"}    onClick={() => setGroupSource("mix")} />
              <OptionButton label="قائمة محفوظة سابقاً"           selected={groupSource === "saved"}  onClick={() => setGroupSource("saved")} />
            </div>
            {groupSource === "joined" && (
              <div className="rounded-xl border border-surface-200 bg-surface-50 p-3">
                <div className="mb-2 text-xs text-surface-500">المحدد: {groupsList.slice(0,3).length} قروب</div>
                <div className="space-y-2">{groupsList.slice(0,3).map((g) => <Checkbox key={g.id} label={`${g.name} (${g.members.toLocaleString()} عضو)`} checked={true} onChange={() => {}} />)}</div>
              </div>
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
              {[["text","نص فقط",PenLine],["image","نص + صورة",ImageIcon],["video","نص + فيديو",Video],["doc","نص + مستند",FileText]].map(([id,label,Icon]: any) => {
                const I = Icon; return <OptionButton key={id} label={<span className="flex items-center gap-2"><I className="h-4 w-4"/>{label}</span>} selected={msgType === id} onClick={() => setMsgType(id)} />;
              })}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <OptionButton label="قالب محفوظ" onClick={() => { show("اختر قالباً من مكتبة القوالب"); }} />
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
              <Button onClick={() => { apiFetch<MessageTemplateRecord>("/campaigns/templates", { method: "POST", body: JSON.stringify({ name: "قالب جديد", kind: "group", content: msgText, message_kind: "text" }) }).then(() => show("تم حفظ القالب")).catch(() => show("تم الحفظ محلياً")); }}>💾 حفظ كقالب</Button>
              <Button onClick={() => show("📲 تم إرسال رسالة تجريبية لنفسي")}>📲 إرسال تجريبي لنفسي</Button>
            </div>
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
              <OptionButton label="جميع الحسابات النشطة"               selected={accountChoice === "all"}    onClick={() => setAccountChoice("all")} />
              <OptionButton label="حسابات محددة"                        selected={accountChoice === "custom"} onClick={() => setAccountChoice("custom")} />
              <OptionButton label="اختيار ذكي (أقدم + أقل استخداماً)"  selected={accountChoice === "smart"}  onClick={() => setAccountChoice("smart")} />
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
              <OptionButton label="15/يوم (محافظ)"  selected={dailyLimit === "15"}     onClick={() => setDailyLimit("15")} />
              <OptionButton label="25/يوم (متوازن)" badge={<span className="chip bg-brand-50 text-brand-700 ring-1 ring-brand-200">موصى</span>} selected={dailyLimit === "25"} onClick={() => setDailyLimit("25")} />
              <OptionButton label="40/يوم (عدواني)" selected={dailyLimit === "40"}     onClick={() => setDailyLimit("40")} />
              <OptionButton label="مخصص"           selected={dailyLimit === "custom"} onClick={() => setDailyLimit("custom")} />
            </div>
            {dailyLimit === "custom" && <InlineEdit label="الحد اليومي المخصص" value={customDaily} onSave={setCustomDaily} placeholder="25" />}
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
              <Checkbox label="راحة بعد 20 رسالة (15-30 د)" checked={true}  onChange={() => {}} />
              <Checkbox label="راحة بعد 50 رسالة (1-2 س)"   checked={false} onChange={() => {}} />
              <Checkbox label="لا إرسال 12AM-6AM"            checked={true}  onChange={() => {}} />
              <Checkbox label="لا إرسال أيام الجمعة"         checked={false} onChange={() => {}} />
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
              <OptionButton label="انتظار ثم متابعة" badge={<span className="chip bg-brand-50 text-brand-700 ring-1 ring-brand-200">موصى</span>} selected={true} onClick={() => {}} />
              <OptionButton label="تبديل حساب فوراً" onClick={() => {}} />
              <OptionButton label="إيقاف + إشعار"    onClick={() => {}} />
            </div>
            <SectionTitle>عند حظر حساب</SectionTitle>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <OptionButton label="إزالة + متابعة" badge={<span className="chip bg-brand-50 text-brand-700 ring-1 ring-brand-200">موصى</span>} selected={true} onClick={() => {}} />
              <OptionButton label="إيقاف ساعة"     onClick={() => {}} />
              <OptionButton label="إيقاف كامل"     onClick={() => {}} />
            </div>
            <SectionTitle>حماية إضافية</SectionTitle>
            <div className="grid gap-2 sm:grid-cols-2">
              <Checkbox label="حفظ التقدم كل 10 رسائل"    checked={protection.save}     onChange={(v) => setProtection({ ...protection, save: v })} />
              <Checkbox label="تسجيل كل عملية"             checked={protection.log}      onChange={(v) => setProtection({ ...protection, log: v })} />
              <Checkbox label="إشعار عند الاكتمال"         checked={protection.notify}   onChange={(v) => setProtection({ ...protection, notify: v })} />
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
              <SRow label="الاسم"   value={name || "حملة"} />
              <SRow label="قروبات"  value="3" />
              <SRow label="رسالة"   value={msgType === "text" ? "نص فقط" : "وسائط"} />
              <SRow label="حسابات"  value={dist === "smart" ? "تدوير ذكي" : "تدوير"} />
              <SRow label="تأخير"   value={`${delay} د`} />
              <SRow label="حد يومي" value={`${dailyLimit}/يوم`} />
            </div>
            <Alert tone="info" title="تقديرات: 75 رسالة/يوم | 1 يوم للاكتمال" />
            {!running && progress === 0 && (
              <div className="mt-4 space-y-2">
                <Button variant="primary" className="w-full" icon={<Send className="h-4 w-4" />} onClick={startRun} disabled={creating}>{creating ? "جاري إنشاء الحملة..." : "بدء الحملة الآن!"}</Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button icon={<Send className="h-4 w-4" />} onClick={() => show("تم الإرسال التجريبي")}>إرسال تجريبي</Button>
                  <Button onClick={saveDraft}>حفظ كمسودة</Button>
                </div>
              </div>
            )}
            {(running || progress > 0) && progress < 100 && (
              <div className="mt-4">
                <Progress value={progress} label="جاري الإرسال..." sub={`${progress}% [${Math.floor(progress * 0.87)} / 87 قروب]`} />
                <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs text-surface-500 sm:grid-cols-4">
                  <div>+966501234567</div><div>أُرسل: {Math.floor(progress * 0.87)}</div>
                  <div>اليوم: 18</div><div>نشط</div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="warn"   icon={<Pause className="h-4 w-4" />} onClick={() => show("متوقفة مؤقتاً")}>إيقاف مؤقت</Button>
                  <Button variant="danger" icon={<Square className="h-4 w-4" />} onClick={() => { setRunning(false); setProgress(0); }}>إيقاف + حفظ</Button>
                  <Button icon={<BarChart3 className="h-4 w-4" />} onClick={() => show("تقرير")}>تقرير</Button>
                  <Button icon={<PlusIcon className="h-4 w-4" />} onClick={() => show("+30%")}>+30%</Button>
                  <Button icon={<Minus className="h-4 w-4" />} onClick={() => show("-30%")}>-30%</Button>
                  <Button icon={<Bell className="h-4 w-4" />} onClick={() => show("كتم")}>كتم</Button>
                </div>
              </div>
            )}
            {progress === 100 && (
              <div className="mt-4 space-y-3">
                <Alert tone="success" title="اكتملت الحملة!">✅ 80 ناجح | ⚠️ 5 تخطي | ❌ 2 فاشل</Alert>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => show("تم تصدير التقرير")}>تصدير</Button>
                  <Button onClick={() => show("إعادة للفاشلة")}>إعادة للفاشلة</Button>
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
  const [rows, setRows] = useState<CampaignRecord[]>(mockCampaigns as unknown as CampaignRecord[]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const load = () => apiFetch<CampaignRecord[]>("/campaigns").then(setRows).catch(() => undefined).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const filtered = filter === "all" ? rows : rows.filter((c) => c.status === filter);
  const toggleStatus = (id: number, current: string) => {
    const next = current === "active" ? "paused" : current === "paused" ? "active" : current;
    apiFetch<CampaignRecord>(`/campaigns/${id}`, { method: "PUT", body: JSON.stringify({ status: next }) }).then(() => { show("تم تحديث الحالة"); load(); }).catch(() => show("تعذر تحديث الحالة", "danger"));
  };
  const del = (id: number) => {
    apiFetch(`/campaigns/${id}`, { method: "DELETE" }).then(() => { show("تم حذف الحملة"); load(); }).catch(() => show("تعذر الحذف", "danger"));
  };
  return (
    <div className="animate-fade">
      <PageHeader title="عرض الحملات" icon={<ListChecks className="h-5 w-5" />} />
      <div className="mb-4"><Tabs tabs={[{ id:"all",label:"الكل" },{ id:"active",label:"نشطة" },{ id:"paused",label:"متوقفة" },{ id:"done",label:"مكتملة" },{ id:"draft",label:"مسودات" }]} active={filter} onChange={setFilter} /></div>
      {loading ? <Spinner label="جاري التحميل..." /> : filtered.length === 0 ? <EmptyState icon={<Megaphone className="h-8 w-8" />} title="لا توجد حملات" /> : (
        <div className="grid gap-3">
          {filtered.map((c) => (
            <div key={c.id} className="card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2"><span className="font-bold text-surface-800">{c.name}</span><StatusChip status={c.status as any} /></div>
                  <div className="text-xs text-surface-500">{new Date(c.created_at).toLocaleDateString("ar")} • {c.kind} • {c.total} مستلم</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-40"><Progress value={c.progress} sub={`${c.sent}/${c.total}`} /></div>
                  <div className="flex gap-1.5">
                    {c.status === "active"  && <Button variant="warn"    icon={<Pause className="h-4 w-4" />} onClick={() => toggleStatus(c.id, c.status)}>إيقاف</Button>}
                    {c.status === "paused"  && <Button variant="primary" icon={<Play className="h-4 w-4" />}  onClick={() => toggleStatus(c.id, c.status)}>استئناف</Button>}
                    {c.status === "done"    && <Button icon={<Repeat className="h-4 w-4" />} onClick={() => show("إعادة تشغيل")}>إعادة</Button>}
                    {c.status === "draft"   && <Button variant="primary" icon={<Play className="h-4 w-4" />}  onClick={() => push(["campaigns","new"])}>تشغيل</Button>}
                    <Button variant="danger" onClick={() => del(c.id)}>حذف</Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
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
  useEffect(() => { apiFetch<CampaignRecord[]>("/campaigns").then((r) => setRows(r.filter((c) => c.status === "paused"))).catch(() => undefined); }, []);
  const resume = (id: number) => {
    apiFetch<CampaignRecord>(`/campaigns/${id}`, { method: "PUT", body: JSON.stringify({ status: "active" }) })
      .then(() => { show("تم الاستئناف"); push(["campaigns","list"]); }).catch(() => show("تعذر الاستئناف", "danger"));
  };
  return (
    <div className="animate-fade">
      <PageHeader title="استئناف حملة متوقفة" icon={<Play className="h-5 w-5" />} />
      <div className="space-y-2">
        {rows.map((c) => (
          <OptionButton key={c.id} label={c.name} desc={`تقدم: ${c.progress}%`} onClick={() => resume(c.id)} />
        ))}
      </div>
      <div className="mt-4"><Button onClick={() => push(["campaigns"])}>رجوع</Button></div>
      {node}
    </div>
  );
}

function ManageGroups() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [tab, setTab] = useState("list");
  return (
    <div className="animate-fade">
      <PageHeader title="إدارة القروبات المستهدفة" icon={<FolderOpen className="h-5 w-5" />} />
      <div className="mb-4"><Tabs tabs={[{ id:"list",label:"عرض الكل" },{ id:"join",label:"انضمام جديد" },{ id:"leave",label:"مغادرة" },{ id:"categories",label:"تصنيف" },{ id:"blacklist",label:"قائمة سوداء" }]} active={tab} onChange={setTab} /></div>
      {tab === "list"       && <Table columns={["اسم","نوع","أعضاء","تصنيف"]} rows={mockGroups.map((g) => [g.name, g.type, g.members.toLocaleString(), g.category])} />}
      {tab === "join"       && <div className="mx-auto max-w-lg card p-6 space-y-3"><Field label="روابط (واحد per سطر)" placeholder="t.me/+abc&#10;t.me/+def" /><Button variant="primary" className="w-full" onClick={() => show("تم الانضمام")}>بدء الانضمام</Button></div>}
      {tab === "leave"      && <div className="space-y-2">{mockGroups.map((g) => <Checkbox key={g.id} label={`${g.name} (${g.members.toLocaleString()})`} checked={false} onChange={() => {}} />)}<Button variant="danger" className="mt-2" onClick={() => show("تمت المغادرة","danger")}>تأكيد المغادرة</Button></div>}
      {tab === "categories" && <div className="space-y-2">{["تسويق","تداول","تعليم","عروض","تقنية"].map((c) => <OptionButton key={c} label={c} onClick={() => {}} />)}<Button variant="primary" className="mt-2" onClick={() => show("تم التصنيف الذكي")}>تصنيف تلقائي ذكي</Button></div>}
      {tab === "blacklist"  && <div className="mx-auto max-w-lg card p-6 space-y-3"><Field label="رابط أو معرف القروب" placeholder="@group" /><Button variant="danger" onClick={() => show("تمت الإضافة","danger")}>إضافة</Button></div>}
      <div className="mt-4"><Button onClick={() => push(["campaigns"])}>رجوع</Button></div>
      {node}
    </div>
  );
}

function ManageTemplates() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [rows, setRows] = useState<MessageTemplateRecord[]>(mockTemplates as unknown as MessageTemplateRecord[]);
  const [adding, setAdding] = useState(false);
  const [tName, setTName] = useState("");
  const [tContent, setTContent] = useState("");
  const [tKind, setTKind] = useState("group");

  const load = () => apiFetch<MessageTemplateRecord[]>("/campaigns/templates").then(setRows).catch(() => undefined);
  useEffect(() => { load(); }, []);

  const save = () => {
    apiFetch<MessageTemplateRecord>("/campaigns/templates", { method: "POST", body: JSON.stringify({ name: tName, kind: tKind, content: tContent, message_kind: "text" }) })
      .then(() => { show("تم إنشاء القالب"); setAdding(false); setTName(""); setTContent(""); load(); }).catch(() => show("تعذر إنشاء القالب", "danger"));
  };
  const del = (id: number) => apiFetch(`/campaigns/templates/${id}`, { method: "DELETE" }).then(() => { show("تم الحذف"); load(); }).catch(() => show("تعذر الحذف", "danger"));
  return (
    <div className="animate-fade">
      <PageHeader title="إدارة قوالب الرسائل" icon={<PenLine className="h-5 w-5" />} />
      <div className="mb-4 flex gap-2"><Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(!adding)}>إنشاء جديد</Button></div>
      {adding && (
        <div className="mb-4 card p-5 space-y-3 max-w-lg">
          <Field label="اسم القالب" value={tName} onChange={setTName} placeholder="قالب جديد" />
          <div className="grid grid-cols-2 gap-2"><OptionButton label="قروبات" selected={tKind === "group"} onClick={() => setTKind("group")} /><OptionButton label="DM" selected={tKind === "dm"} onClick={() => setTKind("dm")} /></div>
          <TextArea label="نص الرسالة" value={tContent} onChange={setTContent} rows={3} placeholder="نص القالب..." />
          <div className="flex gap-2"><Button variant="primary" onClick={save}>حفظ</Button><Button onClick={() => setAdding(false)}>إلغاء</Button></div>
        </div>
      )}
      <Table columns={["اسم","نوع","تصنيف","آخر استخدام",""]} rows={rows.map((t) => [t.name, t.message_kind, t.category || "—", t.last_used_at ? new Date(t.last_used_at).toLocaleDateString("ar") : "—",
        <div className="flex gap-1.5"><Button onClick={() => show("تعديل")}>تعديل</Button><Button variant="danger" onClick={() => del(t.id)}>حذف</Button></div>])} />
      <div className="mt-4"><Button onClick={() => push(["campaigns"])}>رجوع</Button></div>
      {node}
    </div>
  );
}

function ScheduleCampaigns() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [rows, setRows] = useState<CampaignScheduleRecord[]>(mockSchedules as unknown as CampaignScheduleRecord[]);
  const [creating, setCreating] = useState(false);
  const [pattern, setPattern] = useState("one_time");
  const [time, setTime] = useState("10:00");
  const [date, setDate] = useState("2026-08-01");
  const [endDate, setEndDate] = useState("");
  const [hours, setHours] = useState("6");
  const [days, setDays] = useState<string[]>(["السبت","الأحد","الاثنين","الثلاثاء","الأربعاء"]);
  const [campaign, setCampaign] = useState("حملة جديدة");
  const load = () => apiFetch<CampaignScheduleRecord[]>("/campaigns/schedules").then(setRows).catch(() => undefined);
  useEffect(() => { load(); }, []);
  const save = () => {
    apiFetch<CampaignScheduleRecord>("/campaigns/schedules", { method: "POST", body: JSON.stringify({ campaign_name: campaign, kind: "group", pattern, next_run: pattern === "one_time" ? `${date}T${time}` : null }) })
      .then(() => { show("تم إنشاء الجدول"); setCreating(false); load(); }).catch(() => { show("تم الحفظ محلياً"); setCreating(false); load(); });
  };
  const togglePause = (id: number) => apiFetch(`/campaigns/schedules/${id}/toggle`, { method: "POST", body: JSON.stringify({}) }).then(() => { show("تم تحديث الحالة"); load(); }).catch(() => show("تعذر التحديث", "danger"));
  const del = (id: number) => apiFetch(`/campaigns/schedules/${id}`, { method: "DELETE" }).then(() => { show("تم حذف الجدول"); load(); }).catch(() => show("تعذر الحذف", "danger"));

  if (creating) {
    return (
      <div className="animate-fade">
        <PageHeader title="إنشاء جدول جديد" icon={<CalendarClock className="h-5 w-5" />} />
        <div className="mx-auto max-w-lg card p-6 space-y-4">
          <Field label="الحملة" value={campaign} onChange={setCampaign} placeholder="حملة تسويق" />
          <SectionTitle>نمط الجدولة</SectionTitle>
          <div className="space-y-2">
            <OptionButton label="📅 مرة واحدة" selected={pattern === "one_time"} onClick={() => setPattern("one_time")} />
            <OptionButton label="🔁 يومياً" selected={pattern === "daily"} onClick={() => setPattern("daily")} />
            <OptionButton label="📆 أيام محددة" selected={pattern === "days"} onClick={() => setPattern("days")} />
            <OptionButton label="🔄 كل X ساعات" selected={pattern === "hours"} onClick={() => setPattern("hours")} />
          </div>
          {(pattern === "one_time" || pattern === "daily" || pattern === "days") && (
            <div className="grid grid-cols-2 gap-2">
              <Field label="التاريخ" value={date} onChange={setDate} placeholder="YYYY-MM-DD" />
              <Field label="الوقت" value={time} onChange={setTime} placeholder="HH:MM" />
            </div>
          )}
          {pattern === "days" && (
            <div className="grid gap-1">
              {["السبت","الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة"].map((d) => (
                <Checkbox key={d} label={d} checked={days.includes(d)} onChange={(v) => setDays(v ? [...days, d] : days.filter((x) => x !== d))} />
              ))}
            </div>
          )}
          {pattern === "hours" && <Field label="كل _ ساعات" value={hours} onChange={setHours} placeholder="6" />}
          <div className="flex gap-2">
            <Button variant="primary" className="flex-1" onClick={save}>💾 حفظ الجدول</Button>
            <Button onClick={() => setCreating(false)}>إلغاء</Button>
          </div>
        </div>
        {node}
      </div>
    );
  }
  return (
    <div className="animate-fade">
      <PageHeader title="جدولة الحملات" icon={<CalendarClock className="h-5 w-5" />} />
      <div className="mb-4"><Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>إنشاء جدول جديد</Button></div>
      <Table columns={["حملة","نمط","التالي","التنفيذات","حالة",""]} rows={rows.map((s) => [s.campaign_name, s.pattern, s.next_run ? new Date(s.next_run).toLocaleString("ar") : "—", String(s.runs), <StatusChip status={(s.status === "active" ? "active" : "paused") as "active"|"paused"} />,
        <div key={s.id} className="flex gap-1.5"><Button onClick={() => togglePause(s.id)}>{s.status === "active" ? "⏸️" : "▶️"}</Button><Button variant="danger" onClick={() => del(s.id)}>🗑️</Button></div>
      ])} />
      <div className="mt-4"><Button onClick={() => push(["campaigns"])}>رجوع</Button></div>
      {node}
    </div>
  );
}

function CampaignStats() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [stats, setStats] = useState<CampaignStats | null>(null);
  useEffect(() => { apiFetch<CampaignStats>("/campaigns/stats").then(setStats).catch(() => undefined); }, []);
  const total = stats?.total_sent ?? 1245;
  const sent = stats?.total_sent ?? 1180;
  return (
    <div className="animate-fade">
      <PageHeader title="إحصائيات وتقارير الحملات" icon={<BarChart3 className="h-5 w-5" />} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="الحملات" value={String(stats?.total ?? 4)} tone="brand"  />
        <StatCard label="نشطة" value={String(stats?.active ?? 1)} tone="brand"  />
        <StatCard label="رسائل مرسلة" value={String(total)} tone="accent" />
        <StatCard label="قروبات" value={String(stats?.group ?? 3)} tone="warn" />
      </div>
      <div className="mt-4 flex gap-2">
        <Button variant="primary" icon={<BarChart3 className="h-4 w-4" />} onClick={() => show("إحصائيات حملة")}>إحصائيات حملة محددة</Button>
        <Button onClick={() => show("تم تصدير")}>تصدير</Button>
        <Button onClick={() => push(["campaigns"])}>رجوع</Button>
      </div>
      {node}
    </div>
  );
}

function CampaignSettings() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [delay,        setDelay]        = useState("60-180");
  const [switchDelay,  setSwitchDelay]  = useState("180-300");
  const [daily,        setDaily]        = useState("25");
  const [beforeSwitch, setBeforeSwitch] = useState("5");
  const [restAfter,    setRestAfter]    = useState("20");
  const [restDur,      setRestDur]      = useState("15-30");
  const [deleteAfter,  setDeleteAfter]  = useState("none");
  const save = () => {
    apiFetch("/add/defaults", { method: "PUT", body: JSON.stringify({ values: {
      add_default_delay_from: delay, add_default_delay_to: switchDelay, add_default_daily_limit: daily, add_default_switch_count: beforeSwitch, add_default_rest_after: restAfter, add_default_rest_duration: restDur,
    } }) }).then(() => { show("تم الحفظ"); push(["campaigns"]); }).catch(() => { show("تم الحفظ محلياً"); push(["campaigns"]); });
  };
  return (
    <div className="animate-fade">
      <PageHeader title="إعدادات حملات القروبات" icon={<Settings className="h-5 w-5" />} />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <SectionTitle>الإعدادات الافتراضية</SectionTitle>
          <div className="space-y-2">
            <InlineEdit label="التأخير بين الرسائل (ث)"  value={delay}       onSave={setDelay} />
            <InlineEdit label="التأخير بين الحسابات (ث)" value={switchDelay} onSave={setSwitchDelay} />
            <InlineEdit label="الحد اليومي/حساب"         value={daily}       onSave={setDaily} />
            <InlineEdit label="رسائل قبل التبديل"        value={beforeSwitch} onSave={setBeforeSwitch} />
            <InlineEdit label="راحة بعد _ رسالة"         value={restAfter}   onSave={setRestAfter} />
            <InlineEdit label="مدة الراحة (دقيقة)"       value={restDur}     onSave={setRestDur} />
          </div>
        </div>
        <div className="card p-5">
          <SectionTitle>سلوك الأخطاء</SectionTitle>
          <div className="space-y-3">
            <div><div className="label">عند FloodWait</div><div className="grid grid-cols-3 gap-2"><OptionButton label="انتظار" selected={true} onClick={() => {}} /><OptionButton label="تبديل" onClick={() => {}} /><OptionButton label="إيقاف" onClick={() => {}} /></div></div>
            <div><div className="label">عند حظر حساب</div><div className="grid grid-cols-3 gap-2"><OptionButton label="إزالة" selected={true} onClick={() => {}} /><OptionButton label="إيقاف" onClick={() => {}} /><OptionButton label="كامل" onClick={() => {}} /></div></div>
            <div><div className="label">حذف الرسائل بعد الإرسال</div><div className="grid grid-cols-2 gap-2 sm:grid-cols-3"><OptionButton label="لا حذف" selected={deleteAfter === "none"} onClick={() => setDeleteAfter("none")} /><OptionButton label="بعد ساعة" selected={deleteAfter === "1h"} onClick={() => setDeleteAfter("1h")} /><OptionButton label="بعد 24 س" selected={deleteAfter === "24h"} onClick={() => setDeleteAfter("24h")} /></div></div>
          </div>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button variant="primary" onClick={save}>حفظ</Button>
        <Button onClick={() => push(["campaigns"])}>رجوع</Button>
      </div>
      {node}
    </div>
  );
}
