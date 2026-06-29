import { useState } from "react";
import {
  MessageSquare, Send, ListChecks, Play, Ban, PenLine, BarChart3, Settings,
  Plus, Pause, Square, FileText, Image as ImageIcon, Repeat,
} from "lucide-react";
import { useNav } from "../nav";
import { PageHeader, Button, Field, TextArea, Checkbox, OptionButton, Progress, Table, SectionTitle, Alert, useToast, Tabs, StatusChip, EmptyState, StatCard, InlineEdit } from "../ui";
import { dmCampaigns, templates } from "../data";

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
  const active = dmCampaigns.filter((c) => c.status === "active").length;
  const done   = dmCampaigns.filter((c) => c.status === "done").length;
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
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="نشطة"       value={active} tone="brand"  />
        <StatCard label="مكتملة"     value={done}   tone="accent" />
        <StatCard label="رسائل اليوم" value={450}   tone="brand"  />
        <StatCard label="معدل النجاح" value="94%"   tone="brand"  />
      </div>
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
  const startRun = () => {
    setRunning(true); setProgress(0);
    const t = setInterval(() => { setProgress((p) => { if (p >= 100) { clearInterval(t); setRunning(false); return 100; } return p + 4; }); }, 120);
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
              <OptionButton label="قالب محفوظ" onClick={() => {}} />
              <OptionButton label="رسائل Spin متنوعة" onClick={() => {}} />
            </div>
            <TextArea label="نص الرسالة" placeholder="مرحباً {first_name}..." rows={4} value={msgText} onChange={setMsgText} />
            <div className="rounded-xl bg-surface-50 border border-surface-200 px-3 py-2 text-xs text-surface-500">المتغيرات: {`{first_name} {last_name} {username} {date} {time} {random_emoji}`}</div>
            <div className="flex gap-2">
              <Button variant="primary" className="flex-1" onClick={() => setStep(2)}>متابعة</Button>
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
                <Button variant="primary" className="w-full" icon={<Send className="h-4 w-4" />} onClick={startRun}>بدء الإرسال الآن!</Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button icon={<Send className="h-4 w-4" />} onClick={() => show("تم الإرسال التجريبي")}>إرسال تجريبي</Button>
                  <Button onClick={() => { show("تم الحفظ كمسودة"); push(["massdm"]); }}>حفظ كمسودة</Button>
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
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? dmCampaigns : dmCampaigns.filter((c) => c.status === filter);
  return (
    <div className="animate-fade">
      <PageHeader title="عرض الحملات السابقة" icon={<ListChecks className="h-5 w-5" />} />
      <div className="mb-4"><Tabs tabs={[{ id:"all",label:"الكل" },{ id:"active",label:"نشطة" },{ id:"done",label:"مكتملة" },{ id:"draft",label:"مسودات" }]} active={filter} onChange={setFilter} /></div>
      {filtered.length === 0 ? <EmptyState icon={<MessageSquare className="h-8 w-8" />} title="لا توجد حملات" /> : (
        <div className="grid gap-3">
          {filtered.map((c) => (
            <div key={c.id} className="card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2"><span className="font-bold text-surface-800">{c.name}</span><StatusChip status={c.status} /></div>
                  <div className="text-xs text-surface-500">{c.date} • {c.recipients.toLocaleString()} مستلم</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-40"><Progress value={c.progress} sub={`${c.sent}/${c.total}`} /></div>
                  <div className="flex gap-1.5">
                    {c.status === "active" && <Button variant="warn" icon={<Pause className="h-4 w-4" />} onClick={() => {}}>إيقاف</Button>}
                    {c.status === "done"   && <Button icon={<Repeat className="h-4 w-4" />} onClick={() => {}}>إعادة</Button>}
                    {c.status === "draft"  && <Button variant="primary" icon={<Play className="h-4 w-4" />} onClick={() => push(["massdm","new"])}>تشغيل</Button>}
                    <Button variant="danger" onClick={() => {}}>حذف</Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-4"><Button onClick={() => push(["massdm"])}>رجوع</Button></div>
    </div>
  );
}

function ResumeDm() {
  const { push } = useNav();
  return (
    <div className="animate-fade">
      <PageHeader title="استئناف حملة متوقفة" icon={<Play className="h-5 w-5" />} />
      <div className="space-y-2">
        {dmCampaigns.filter((c) => c.status === "active").map((c) => (
          <OptionButton key={c.id} label={c.name} desc={`تقدم: ${c.progress}%`} onClick={() => push(["massdm","new"])} />
        ))}
      </div>
      <div className="mt-4"><Button onClick={() => push(["massdm"])}>رجوع</Button></div>
    </div>
  );
}

function DmBlacklist() {
  const { push } = useNav();
  const { show, node } = useToast();
  return (
    <div className="animate-fade">
      <PageHeader title="القائمة السوداء (DM)" icon={<Ban className="h-5 w-5" />} />
      <div className="mb-4 flex gap-2">
        <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => show("إضافة")}>إضافة يدوياً</Button>
        <Button onClick={() => show("استيراد")}>استيراد قائمة</Button>
        <Button variant="danger" onClick={() => show("تم المسح","danger")}>مسح الكل</Button>
      </div>
      <Table columns={["مستخدم","سبب","تاريخ"]} rows={[["@spammer","حظر البوت","2026-06-20"],["987654","محظور يدوياً","2026-06-18"]]} />
      <div className="mt-4"><Button onClick={() => push(["massdm"])}>رجوع</Button></div>
      {node}
    </div>
  );
}

function DmTemplates() {
  const { push } = useNav();
  const { show, node } = useToast();
  return (
    <div className="animate-fade">
      <PageHeader title="إدارة قوالب الرسائل (DM)" icon={<PenLine className="h-5 w-5" />} />
      <div className="mb-4"><Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => show("إنشاء قالب")}>إنشاء جديد</Button></div>
      <Table columns={["اسم","نوع","تصنيف","آخر استخدام",""]} rows={templates.map((t) => [t.name, t.type, t.category, t.lastUsed,
        <div className="flex gap-1.5"><Button onClick={() => show("تعديل")}>تعديل</Button><Button variant="danger" onClick={() => show("حذف","danger")}>حذف</Button></div>])} />
      <div className="mt-4"><Button onClick={() => push(["massdm"])}>رجوع</Button></div>
      {node}
    </div>
  );
}

function DmStats() {
  const { push } = useNav();
  const { show, node } = useToast();
  return (
    <div className="animate-fade">
      <PageHeader title="إحصائيات وتقارير (DM)" icon={<BarChart3 className="h-5 w-5" />} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="إجمالي الرسائل" value="2,450" tone="brand"  />
        <StatCard label="ناجحة"           value="2,300" tone="brand"  />
        <StatCard label="فاشلة"           value="150"   tone="danger" />
        <StatCard label="معدل الفتح"      value="62%"   tone="accent" />
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
  return (
    <div className="animate-fade">
      <PageHeader title="إعدادات الرسائل الجماعية" icon={<Settings className="h-5 w-5" />} />
      <div className="mx-auto max-w-lg card p-6 space-y-2">
        <InlineEdit label="التأخير الافتراضي (ث)"  value={delay}        onSave={setDelay} />
        <InlineEdit label="الحد اليومي/حساب"        value={daily}        onSave={setDaily} />
        <InlineEdit label="رسائل قبل التبديل"       value={beforeSwitch} onSave={setBeforeSwitch} />
        <InlineEdit label="راحة بعد _ رسالة"        value={restAfter}    onSave={setRestAfter} />
        <InlineEdit label="مدة الراحة (دقيقة)"      value={restDur}      onSave={setRestDur} />
        <Button variant="primary" className="mt-4 w-full" onClick={() => { show("تم الحفظ"); push(["massdm"]); }}>حفظ</Button>
      </div>
      {node}
    </div>
  );
}
