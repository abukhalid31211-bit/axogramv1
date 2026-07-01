import { useState, useEffect } from "react";
import {
  Download, Globe, Link2, MessageSquare, Eye, Layers,
  FolderOpen, GitMerge, Play, Pause, Square, FileText, ArrowRight,
  Search, Megaphone, BarChart3, Trash2, BookmarkCheck,
} from "lucide-react";
import { useNav } from "../nav";
import {
  PageHeader, Button, Field, Checkbox, OptionButton, Progress, Table,
  SectionTitle, Alert, useToast, EmptyState, InlineEdit, SearchInput,
  StatCard, Tabs, ConfirmDialog,
} from "../ui";
import { exportedFiles } from "../data";

export function GatherModule() {
  const { push } = useNav();
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
        <StatCard label="مُجمَّع اليوم"   value="15,340" tone="accent" />
        <StatCard label="الأسبوع"         value="48,200" tone="brand"  />
        <StatCard label="ملفات محفوظة"   value={String(exportedFiles.length)} tone="accent" />
        <StatCard label="آخر عملية"       value="منذ 2د"  tone="brand"  />
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

/* shared running screen */
function GatherRunning({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const { push } = useNav();
  const { show, node } = useToast();
  const [progress, setProgress] = useState(0);
  const [running, setRunning]   = useState(true);
  const [paused, setPaused]     = useState(false);
  const [done, setDone]         = useState(false);

  useEffect(() => {
    const t = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) { clearInterval(t); setRunning(false); setDone(true); return 100; }
        return p + 4;
      });
    }, 100);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="space-y-4">
      {(running || done) && (
        <div className="card p-5 space-y-3">
          <Progress value={progress} label={done ? "✅ اكتمل التجميع!" : "📥 جاري التجميع..."} sub={`${progress}% [${Math.floor(progress*153)}/15340]`} tone="accent" />
          {running && (
            <div className="grid grid-cols-3 gap-2 text-center text-xs text-surface-500">
              <div>+966501234567</div><div>السرعة: 12/ث</div><div>متبقي: ~4د</div>
            </div>
          )}
          {running && (
            <div className="text-xs text-surface-400">
              آخر مُستخرج: أحمد @ahmed | متخطى: 12 (بوت)
            </div>
          )}
          {done && (
            <Alert tone="success" title="✅ اكتمل! مستخرج: 15,340 | متخطى: 210 | وقت: 4د">
              <div className="mt-1 text-xs">تفاصيل المتخطى: بوت:180 | محذوف:20 | فلتر:10</div>
            </Alert>
          )}
          <div className="flex flex-wrap gap-2">
            {running && !paused && <Button variant="warn" className="flex-1" icon={<Pause className="h-4 w-4" />} onClick={() => setPaused(true)}>⏸️ إيقاف مؤقت</Button>}
            {running && paused  && <Button variant="primary" className="flex-1" icon={<Play className="h-4 w-4" />} onClick={() => setPaused(false)}>▶️ استئناف</Button>}
            {running && <Button variant="danger" icon={<Square className="h-4 w-4" />} onClick={() => { setRunning(false); setDone(true); setProgress(100); }}>⏹️ إيقاف وحفظ</Button>}
            {done && (
              <>
                <Button icon={<FileText className="h-4 w-4" />} onClick={() => show("تم إرسال CSV")}>📂 فتح الملف</Button>
                <Button variant="primary" icon={<ArrowRight className="h-4 w-4" />} onClick={() => push(["add"])}>📤 أداة الإضافة</Button>
                <Button icon={<GitMerge className="h-4 w-4" />} onClick={() => push(["gather","merge"])}>🔀 دمج مع ملف</Button>
                <Button icon={<Trash2 className="h-4 w-4" />} onClick={() => push(["gather","cleaner"])}>🧹 تنقية الملف</Button>
                <Button icon={<BarChart3 className="h-4 w-4" />} onClick={() => show("إحصائيات")}>📊 إحصائيات</Button>
                <Button onClick={onBack}>🔙 رجوع</Button>
              </>
            )}
          </div>
        </div>
      )}
      {node}
    </div>
  );
}

/* ── PublicGather ── */
function PublicGather() {
  const { push } = useNav();
  const { show, node } = useToast();
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
  const [templateName, setTemplateName] = useState("");
  const [saveTemplate, setSaveTemplate] = useState(false);
  const [started, setStarted] = useState(false);

  if (started) return <GatherRunning onDone={()=>setStarted(false)} onBack={()=>{ setStarted(false); setStep(0); }} />;

  return (
    <div className="animate-fade">
      <PageHeader title="من مجموعة/قناة عامة" icon={<Globe className="h-5 w-5" />}
        steps={step>0?{label:"تجميع الأعضاء",n:step+1,total:5}:undefined} />
      <div className="mx-auto max-w-2xl">
        {step===0 && (
          <div className="card p-6 space-y-4">
            <SectionTitle icon={<Globe className="h-4 w-4" />}>رابط أو @username</SectionTitle>
            <Field placeholder="@group_username أو t.me/group" value={link} onChange={setLink} />
            <Alert tone="info" title="📌 معلومات المجموعة">
              <div className="mt-1 flex flex-wrap gap-3 text-xs">
                <span>الاسم: @market_sa</span><span>النوع: عام</span>
                <span>الأعضاء: 15,340</span><span>الوصف: سوق السعودية</span>
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
              <SRow label="النوع"    value="جميع الأعضاء" />
              <SRow label="الحد"     value={limit==="custom"?customLimit:limit==="all"?"الكل":limit} />
              <SRow label="الحساب"   value={account==="rotate"?"تدوير":"حساب واحد"} />
            </div>
            <div className="space-y-2">
              <Checkbox label="💾 حفظ هذا الإعداد كقالب تجميع" checked={saveTemplate} onChange={setSaveTemplate} />
              {saveTemplate && <Field label="اسم القالب" placeholder="قالب السوق" value={templateName} onChange={setTemplateName} />}
            </div>
            <div className="flex gap-2">
              <Button variant="primary" className="flex-1" icon={<Play className="h-4 w-4" />} onClick={() => setStarted(true)}>✅ بدء التجميع</Button>
              <Button onClick={() => setStep(3)}>رجوع</Button>
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
  const [link, setLink]   = useState("t.me/+abc123");
  const [joining, setJoining] = useState(false);
  const [joined, setJoined]   = useState(false);
  const [autoLeave, setAutoLeave] = useState(true);
  const [multiAcc, setMultiAcc]   = useState(false);

  return (
    <div className="animate-fade">
      <PageHeader title="من رابط دعوة خاص" icon={<Link2 className="h-5 w-5" />} />
      <div className="mx-auto max-w-lg card p-6 space-y-4">
        <InlineEdit label="رابط الدعوة" value={link} onSave={setLink} placeholder="t.me/+abc أو joinchat" />
        {!joining && !joined && (
          <Alert tone="info" title="🔍 التحقق من الرابط...">
            <div className="mt-1 text-xs">✅ رابط صالح — مجموعة خاصة</div>
          </Alert>
        )}
        <SectionTitle>الحساب المستخدم للانضمام</SectionTitle>
        <OptionButton label="👤 حساب واحد"             selected={!multiAcc} onClick={() => setMultiAcc(false)} />
        <OptionButton label="👥 عدة حسابات (لتجميع أعمق)" selected={multiAcc}  onClick={() => setMultiAcc(true)} />
        <Checkbox label="الانضمام تلقائياً قبل التجميع"   checked={true}      onChange={()=>{}} />
        <Checkbox label="المغادرة تلقائياً بعد التجميع"   checked={autoLeave} onChange={setAutoLeave} />
        {!joining && !joined && (
          <Button variant="primary" className="w-full" onClick={() => { setJoining(true); setTimeout(()=>{ setJoining(false); setJoined(true); },1500); }}>
            ⏳ الانضمام ثم التجميع
          </Button>
        )}
        {joining && <Progress value={50} label="⏳ جاري الانضمام..." sub="50%" tone="accent" />}
        {joined && (
          <div className="space-y-3">
            <Alert tone="success" title="✅ تم الانضمام | الأعضاء: 8,240" />
            <Button variant="primary" className="w-full" onClick={() => push(["gather","public"])}>متابعة للتجميع</Button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── ChatGather ── */
function ChatGather() {
  const { push } = useNav();
  const [range, setRange] = useState<"100"|"500"|"1000"|"5000"|"10000"|"all"|"custom">("500");
  const [fromDate, setFromDate] = useState("2026-06-01");
  const [toDate, setToDate]     = useState("2026-07-01");
  const [minMsgs, setMinMsgs]   = useState("1");
  const [filters, setFilters] = useState({ text:true, media:false, files:false, reactions:false, replies:false, dedup:true, sort:false });

  return (
    <div className="animate-fade">
      <PageHeader title="تجميع المشاركين في الدردشة" icon={<MessageSquare className="h-5 w-5" />} />
      <div className="mx-auto max-w-lg card p-6 space-y-4">
        <Field label="رابط المجموعة" placeholder="@group" />
        <Alert tone="info" title="🔍 جلب المعلومات... — @group | 15,340 عضو" />
        <SectionTitle>نطاق فحص الرسائل</SectionTitle>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[["100","آخر 100"],["500","آخر 500"],["1000","آخر 1000"],["5000","آخر 5000"],["10000","آخر 10,000"],["all","جميع الرسائل"],["custom","نطاق مخصص"]] .map(([id,label]) => (
            <OptionButton key={id} label={label} selected={range===id} onClick={() => setRange(id as typeof range)} />
          ))}
        </div>
        {range==="custom" && (
          <div className="flex gap-2">
            <Field label="من" placeholder="YYYY-MM-DD" value={fromDate} onChange={setFromDate} />
            <Field label="إلى" placeholder="YYYY-MM-DD" value={toDate} onChange={setToDate} />
          </div>
        )}
        <SectionTitle>فلاتر المشاركة</SectionTitle>
        <div className="grid gap-2 sm:grid-cols-2">
          <Checkbox label="مرسلو الرسائل النصية"    checked={filters.text}      onChange={(v)=>setFilters({...filters,text:v})} />
          <Checkbox label="مرسلو الصور/الفيديو"     checked={filters.media}     onChange={(v)=>setFilters({...filters,media:v})} />
          <Checkbox label="مرسلو الملفات"            checked={filters.files}     onChange={(v)=>setFilters({...filters,files:v})} />
          <Checkbox label="من تفاعلوا (ريأكشن)"     checked={filters.reactions} onChange={(v)=>setFilters({...filters,reactions:v})} />
          <Checkbox label="من ردوا على رسائل"        checked={filters.replies}   onChange={(v)=>setFilters({...filters,replies:v})} />
          <Checkbox label="إزالة المكرر"             checked={filters.dedup}     onChange={(v)=>setFilters({...filters,dedup:v})} />
          <Checkbox label="ترتيب حسب عدد الرسائل"   checked={filters.sort}      onChange={(v)=>setFilters({...filters,sort:v})} />
        </div>
        <InlineEdit label="حد أدنى لعدد الرسائل لكل مستخدم" value={minMsgs} onSave={setMinMsgs} placeholder="1" />
        <Button variant="primary" className="w-full" onClick={() => push(["gather","public"])}>✅ بدء التجميع</Button>
      </div>
    </div>
  );
}

/* ── VisibleGather ── */
function VisibleGather() {
  const { push } = useNav();
  return (
    <div className="animate-fade">
      <PageHeader title="من مجموعة ذات أعضاء ظاهرين" icon={<Eye className="h-5 w-5" />} />
      <div className="mx-auto max-w-lg card p-6 space-y-4">
        <Field label="رابط المجموعة" placeholder="@group" />
        <Alert tone="info" title="🔍 التحقق من ظهور الأعضاء...">
          <div className="mt-1 text-xs">✅ الأعضاء ظاهرون</div>
        </Alert>
        <Button variant="primary" className="w-full" onClick={() => push(["gather","public"])}>متابعة للتجميع</Button>
      </div>
    </div>
  );
}

/* ── PostGather ── */
function PostGather() {
  const { push } = useNav();
  const [link, setLink]         = useState("");
  const [what, setWhat]         = useState<"reactions"|"comments"|"forwards"|"views">("reactions");
  const [reactionType, setReactionType] = useState<"all"|"like"|"heart"|"fire"|"custom">("all");
  const [customEmoji, setCustomEmoji]   = useState("");
  const [dedup, setDedup]       = useState(true);
  const [merge, setMerge]       = useState(false);

  return (
    <div className="animate-fade">
      <PageHeader title="تجميع من منشور/تعليقات" icon={<Megaphone className="h-5 w-5" />} />
      <div className="mx-auto max-w-lg card p-6 space-y-4">
        <Field label="رابط المنشور أو القناة/المجموعة" placeholder="t.me/channel/123" value={link} onChange={setLink} />
        {link && (
          <Alert tone="info" title="📌 معلومات المنشور">
            <div className="mt-1 text-xs flex flex-wrap gap-3">
              <span>القناة: @tech_news</span><span>التفاعلات: 1,240</span><span>التعليقات: 380</span>
            </div>
          </Alert>
        )}
        <SectionTitle>ماذا تريد تجميع</SectionTitle>
        <OptionButton label="👍 من تفاعلوا (Reactions)" selected={what==="reactions"}  onClick={() => setWhat("reactions")} />
        <OptionButton label="💬 من علّقوا (Comments)"   selected={what==="comments"}   onClick={() => setWhat("comments")} />
        <OptionButton label="🔁 من شاركوا (Forwards)"   selected={what==="forwards"}   onClick={() => setWhat("forwards")} />
        <OptionButton label="👁️ من شاهدوا (Views)"      selected={what==="views"}      onClick={() => setWhat("views")} />
        {what==="reactions" && (
          <div className="grid gap-2 sm:grid-cols-2">
            <OptionButton label="الكل (جميع التفاعلات)" selected={reactionType==="all"}    onClick={() => setReactionType("all")} />
            <OptionButton label="👍 إعجاب فقط"           selected={reactionType==="like"}   onClick={() => setReactionType("like")} />
            <OptionButton label="❤️ قلب فقط"             selected={reactionType==="heart"}  onClick={() => setReactionType("heart")} />
            <OptionButton label="🔥 نار فقط"             selected={reactionType==="fire"}   onClick={() => setReactionType("fire")} />
            <OptionButton label="✏️ تفاعل مخصص"         selected={reactionType==="custom"} onClick={() => setReactionType("custom")} />
            {reactionType==="custom" && <Field placeholder="الإيموجي" value={customEmoji} onChange={setCustomEmoji} />}
          </div>
        )}
        <Checkbox label="دمج جميع المحدد"   checked={merge} onChange={setMerge} />
        <Checkbox label="إزالة المكرر"      checked={dedup} onChange={setDedup} />
        <Button variant="primary" className="w-full" onClick={() => push(["gather","public"])}>✅ بدء التجميع</Button>
      </div>
    </div>
  );
}

/* ── BulkGather ── */
function BulkGather() {
  const { push } = useNav();
  const [mode, setMode]   = useState<"manual"|"file">("manual");
  const [links, setLinks] = useState("");
  const [filePath, setFilePath] = useState("/path/to/links.txt");
  const [sortOrder, setSortOrder] = useState<"seq"|"random"|"size">("seq");
  const [mergeAll, setMergeAll]   = useState(true);
  const [dedup, setDedup]         = useState(true);
  const [saveSep, setSaveSep]     = useState(false);
  const [started, setStarted]     = useState(false);
  const [checked, setChecked]     = useState(false);

  if (started) return <GatherRunning onDone={()=>setStarted(false)} onBack={()=>setStarted(false)} />;

  return (
    <div className="animate-fade">
      <PageHeader title="استخراج جماعي (متعدد)" icon={<Layers className="h-5 w-5" />} />
      <div className="mx-auto max-w-lg card p-6 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <OptionButton label="✍️ إدخال يدوي"        selected={mode==="manual"} onClick={() => setMode("manual")} />
          <OptionButton label="📄 من ملف نصي"         selected={mode==="file"}   onClick={() => setMode("file")} />
        </div>
        {mode==="manual"
          ? <Field label="روابط (واحد per سطر)" placeholder={"@group1\n@group2\nt.me/+abc"} value={links} onChange={setLinks} />
          : <InlineEdit label="مسار الملف" value={filePath} onSave={setFilePath} placeholder="/path/to/links.txt" />}
        {!checked && (
          <Button className="w-full" onClick={() => setChecked(true)}>🔍 التحقق من جميع الروابط</Button>
        )}
        {checked && (
          <Alert tone="info" title="ملخص: 3 عام | 1 خاص | 0 دعوة">
            <div className="mt-1 text-xs">✅صالح: 3 | ❌منتهي: 0 | ⚠️خاص: 1</div>
          </Alert>
        )}
        <SectionTitle>إعدادات التجميع الجماعي</SectionTitle>
        <Checkbox label="دمج النتائج في ملف واحد"         checked={mergeAll} onChange={setMergeAll} />
        <Checkbox label="إزالة المكرر عبر المجموعات"       checked={dedup}    onChange={setDedup} />
        <Checkbox label="حفظ كل مجموعة منفصلة"            checked={saveSep}  onChange={setSaveSep} />
        <SectionTitle>ترتيب التجميع</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          <OptionButton label="🔢 بالترتيب"  selected={sortOrder==="seq"}    onClick={() => setSortOrder("seq")} />
          <OptionButton label="🎲 عشوائي"    selected={sortOrder==="random"} onClick={() => setSortOrder("random")} />
          <OptionButton label="📊 الأكبر أولاً" selected={sortOrder==="size"} onClick={() => setSortOrder("size")} />
        </div>
        <Button variant="primary" className="w-full" icon={<Play className="h-4 w-4" />} onClick={() => setStarted(true)}>✅ بدء التجميع الجماعي</Button>
      </div>
    </div>
  );
}

/* ── AdvancedScrape ── */
function AdvancedScrape() {
  const { push } = useNav();
  const [query, setQuery]   = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults]     = useState(false);
  const [selected, setSelected]   = useState<number[]>([]);

  const mockResults = [
    { name:"@market_sa",    type:"مجموعة عامة", members:"15,340", desc:"سوق السعودية"  },
    { name:"@trade_ksa",    type:"قناة",         members:"28,400", desc:"تداول وأسهم"    },
    { name:"@offers_daily", type:"مجموعة عامة", members:"9,971",  desc:"عروض يومية"     },
  ];

  return (
    <div className="animate-fade">
      <PageHeader title="بحث متقدم (Advanced Scrape)" icon={<Search className="h-5 w-5" />} />
      <div className="mx-auto max-w-lg card p-6 space-y-4">
        <Field label="كلمة بحث أو هاشتاق" placeholder="#سوق أو تجارة" value={query} onChange={setQuery} />
        {!searching && !results && (
          <Button variant="primary" className="w-full" disabled={!query}
            onClick={() => { setSearching(true); setTimeout(()=>{ setSearching(false); setResults(true); },1800); }}>
            🔍 البحث في تيليجرام
          </Button>
        )}
        {searching && <Progress value={60} label="🔍 البحث في تيليجرام..." sub="60%" tone="accent" />}
        {results && (
          <div className="space-y-3">
            <Alert tone="success" title={`${mockResults.length} نتائج — مجموعات وقنوات`} />
            <div className="flex gap-2">
              <Button onClick={() => setSelected(mockResults.map((_,i)=>i))}>☑️ تحديد الكل</Button>
              <Button onClick={() => setSelected([])}>⬜ إلغاء الكل</Button>
            </div>
            <Table columns={["","اسم","نوع","أعضاء","وصف"]} rows={mockResults.map((r,i) => [
              <input type="checkbox" checked={selected.includes(i)} onChange={()=>setSelected(s=>s.includes(i)?s.filter(x=>x!==i):[...s,i])} className="h-4 w-4 accent-brand-600" />,
              r.name, r.type, r.members, r.desc,
            ])} />
            <Button variant="primary" className="w-full" disabled={selected.length===0} onClick={() => push(["gather","bulk"])}>
              ✅ تجميع من المحدد ({selected.length})
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── FileCleaner ── */
function FileCleaner() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [selected, setSelected] = useState<number|null>(null);
  const [ops, setOps] = useState({ dedup:true, noUser:false, noPhone:false, bots:true, deleted:true, old30:false, old90:false, keepTop:false, sort:false });
  const [keepCount, setKeepCount] = useState("1000");
  const [cleaning, setCleaning]   = useState(false);
  const [done, setDone]           = useState(false);

  if (selected === null) {
    return (
      <div className="animate-fade">
        <PageHeader title="تنقية وتحسين الملفات (File Cleaner)" icon={<Trash2 className="h-5 w-5" />} />
        <div className="space-y-2">
          {exportedFiles.map((f) => (
            <OptionButton key={f.id} label={f.name} desc={`${f.members.toLocaleString()} عضو — ${f.date}`} onClick={() => setSelected(f.id)} />
          ))}
        </div>
      </div>
    );
  }

  const file = exportedFiles.find(f=>f.id===selected)!;
  return (
    <div className="animate-fade">
      <PageHeader title={`تنقية: ${file.name}`} icon={<Trash2 className="h-5 w-5" />} />
      <div className="space-y-4">
        <div className="card p-4">
          <Alert tone="info" title={`إحصائيات الملف الحالي: ${file.members.toLocaleString()} عضو`} />
        </div>
        <div className="card p-5 space-y-2">
          <SectionTitle>عمليات التنقية</SectionTitle>
          <Checkbox label="إزالة المكرر"                            checked={ops.dedup}   onChange={(v)=>setOps({...ops,dedup:v})} />
          <Checkbox label="إزالة بدون @username"                   checked={ops.noUser}  onChange={(v)=>setOps({...ops,noUser:v})} />
          <Checkbox label="إزالة بدون رقم هاتف"                    checked={ops.noPhone} onChange={(v)=>setOps({...ops,noPhone:v})} />
          <Checkbox label="إزالة البوتات"                          checked={ops.bots}    onChange={(v)=>setOps({...ops,bots:v})} />
          <Checkbox label="إزالة الحسابات المحذوفة"                checked={ops.deleted} onChange={(v)=>setOps({...ops,deleted:v})} />
          <Checkbox label="إزالة آخر ظهور أكثر من 30 يوم"         checked={ops.old30}   onChange={(v)=>setOps({...ops,old30:v})} />
          <Checkbox label="إزالة آخر ظهور أكثر من 90 يوم"         checked={ops.old90}   onChange={(v)=>setOps({...ops,old90:v})} />
          <Checkbox label="الاحتفاظ بـ X أعلى نشاطاً فقط"         checked={ops.keepTop} onChange={(v)=>setOps({...ops,keepTop:v})} />
          {ops.keepTop && <InlineEdit label="العدد" value={keepCount} onSave={setKeepCount} placeholder="1000" />}
          <Checkbox label="ترتيب حسب النشاط"                       checked={ops.sort}    onChange={(v)=>setOps({...ops,sort:v})} />
        </div>
        {!cleaning && !done && (
          <Button variant="primary" className="w-full" onClick={() => { setCleaning(true); setTimeout(()=>{ setCleaning(false); setDone(true); },1500); }}>✅ تطبيق التنقية</Button>
        )}
        {cleaning && <Progress value={65} label="🧹 جاري التنقية..." sub="65%" tone="accent" />}
        {done && (
          <div className="space-y-3">
            <Alert tone="success" title="تمت التنقية">
              <div className="mt-1 text-xs">قبل: {file.members.toLocaleString()} عضو ── بعد: {Math.floor(file.members*0.8).toLocaleString()} عضو | تم حذف: {Math.floor(file.members*0.2).toLocaleString()}</div>
            </Alert>
            <div className="flex gap-2">
              <Button variant="primary" className="flex-1" onClick={() => show("تم حفظ الملف المنقى")}>💾 حفظ ملف جديد</Button>
              <Button onClick={() => show("تم استبدال الملف")}>💾 استبدال الأصلي</Button>
              <Button onClick={() => { setSelected(null); setDone(false); }}>🔙 رجوع</Button>
            </div>
          </div>
        )}
      </div>
      {node}
    </div>
  );
}

/* ── MergeFiles ── */
function MergeFiles() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [selected, setSelected]     = useState<number[]>([]);
  const [merging, setMerging]       = useState(false);
  const [done, setDone]             = useState(false);
  const [dedup, setDedup]           = useState(true);
  const [applyClean, setApplyClean] = useState(false);
  const [outName, setOutName]       = useState("merged_result.csv");
  const toggle = (id: number) => setSelected((s) => (s.includes(id)?s.filter(x=>x!==id):[...s,id]));
  const total  = exportedFiles.filter(f=>selected.includes(f.id)).reduce((s,f)=>s+f.members,0);

  return (
    <div className="animate-fade">
      <PageHeader title="دمج الملفات + إزالة مكرر" icon={<GitMerge className="h-5 w-5" />} />
      <div className="card p-5 space-y-4">
        <SectionTitle>اختر الملفات للدمج</SectionTitle>
        <div className="space-y-2">
          {exportedFiles.map((f) => (
            <Checkbox key={f.id} label={`${f.name} (${f.members.toLocaleString()} عضو)`} checked={selected.includes(f.id)} onChange={() => toggle(f.id)} />
          ))}
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setSelected(exportedFiles.map(f=>f.id))}>☑️ تحديد الكل</Button>
          <Button onClick={() => setSelected([])}>⬜ إلغاء الكل</Button>
        </div>
        {selected.length>0 && <Alert tone="info" title={`إجمالي المحدد: ${total.toLocaleString()} عضو (قبل إزالة المكرر)`} />}
        <Checkbox label="إزالة المكرر بعد الدمج"          checked={dedup}      onChange={setDedup} />
        <Checkbox label="تطبيق فلاتر التنقية بعد الدمج"   checked={applyClean} onChange={setApplyClean} />
        {!merging && !done && (
          <Button variant="primary" className="w-full" disabled={selected.length<2}
            onClick={() => { setMerging(true); setTimeout(()=>{ setMerging(false); setDone(true); },1500); }}>✅ بدء الدمج</Button>
        )}
        {merging && <Progress value={75} label="🔀 جاري الدمج..." sub="75%" tone="accent" />}
        {done && (
          <div className="space-y-3">
            <Alert tone="success" title="اكتمل الدمج">
              <div className="mt-1 text-xs">إجمالي: {total.toLocaleString()} | مكرر أُزيل: {Math.floor(total*0.04).toLocaleString()} | النتيجة: {Math.floor(total*0.96).toLocaleString()}</div>
            </Alert>
            <InlineEdit label="اسم الملف الجديد" value={outName} onSave={setOutName} placeholder="merged_result.csv" />
            <div className="flex gap-2">
              <Button variant="primary" className="flex-1" onClick={() => show("تم حفظ الملف المدمج")}>💾 حفظ الملف المدمج</Button>
              <Button onClick={() => { setDone(false); setSelected([]); }}>دمج آخر</Button>
            </div>
            <Alert tone="info" title="تم إرسال الملف كمرفق CSV" />
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
  const [selected, setSelected] = useState<number|null>(null);
  const [sortBy, setSortBy]     = useState<"new"|"big"|"alpha">("new");
  const [search, setSearch]     = useState("");
  const [bulkSelected, setBulkSelected] = useState<number[]>([]);
  const [confirmDel, setConfirmDel]     = useState(false);
  const [renaming, setRenaming]         = useState<number|null>(null);
  const [newName, setNewName]           = useState("");

  const toggle = (id:number) => setBulkSelected(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);

  if (selected !== null) {
    const file = exportedFiles.find(f=>f.id===selected)!;
    return (
      <div className="animate-fade">
        <PageHeader title={file.name} icon={<FolderOpen className="h-5 w-5" />} />
        <div className="space-y-4">
          <div className="card p-5">
            <SectionTitle>📊 إحصائيات الملف</SectionTitle>
            <div className="grid gap-2 sm:grid-cols-2">
              <SRow label="عدد الأعضاء"    value={file.members.toLocaleString()} />
              <SRow label="تاريخ التجميع"  value={file.date} />
              <SRow label="بـ @username"   value={`${Math.floor(file.members*0.72).toLocaleString()} (72%)`} />
              <SRow label="بصورة شخصية"   value={`${Math.floor(file.members*0.55).toLocaleString()} (55%)`} />
              <SRow label="آخر ظهور اليوم" value={`${Math.floor(file.members*0.18).toLocaleString()} (18%)`} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Button onClick={() => show("تم إرسال CSV")}>📂 إرسال CSV</Button>
            <Button onClick={() => show("تم إرسال Excel")}>📊 إرسال Excel</Button>
            <Button onClick={() => push(["add"])}>📤 استخدام في الإضافة</Button>
            <Button onClick={() => push(["gather","cleaner"])}>🧹 تنقية هذا الملف</Button>
            <Button onClick={() => { setRenaming(file.id); setNewName(file.name); }}>✏️ إعادة تسمية</Button>
            <Button variant="danger" onClick={() => { show("تم حذف الملف","danger"); setSelected(null); }}>🗑 حذف</Button>
          </div>
          {renaming===file.id && (
            <div className="card p-4">
              <InlineEdit label="الاسم الجديد" value={newName} onSave={(v)=>{ setNewName(v); setRenaming(null); show("تم إعادة التسمية"); }} />
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
          <Button onClick={()=>setBulkSelected(exportedFiles.map(f=>f.id))}>☑️ تحديد الكل</Button>
          <Button variant="danger" disabled={bulkSelected.length===0} onClick={()=>setConfirmDel(true)}>🗑 حذف المحدد</Button>
          <Button disabled={bulkSelected.length<2} onClick={()=>push(["gather","merge"])}>🔀 دمج المحدد</Button>
          <Button disabled={bulkSelected.length===0} onClick={()=>show("تم ضغط الملفات وإرسالها")}>📦 ضغط وإرسال ZIP</Button>
        </div>
        {exportedFiles.length===0
          ? <EmptyState icon={<FolderOpen className="h-8 w-8" />} title="لا توجد ملفات" />
          : <Table columns={["","اسم","الأعضاء","التاريخ",""]} rows={exportedFiles.map((f)=>[
              <input type="checkbox" checked={bulkSelected.includes(f.id)} onChange={()=>toggle(f.id)} className="h-4 w-4 accent-brand-600" />,
              f.name, f.members.toLocaleString(), f.date,
              <div className="flex gap-1.5">
                <Button onClick={() => setSelected(f.id)}>تفاصيل</Button>
                <Button onClick={() => show("تم إرسال CSV")}>إرسال</Button>
                <Button onClick={() => push(["add"])}>استخدام</Button>
              </div>,
            ])} />}
        <ConfirmDialog open={confirmDel} danger title="حذف الملفات المحددة" message={`سيتم حذف ${bulkSelected.length} ملف نهائياً.`}
          onConfirm={()=>{ setConfirmDel(false); setBulkSelected([]); show("تم حذف الملفات"); }}
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
  const [selected, setSelected]   = useState<number|null>(null);
  const [confirmDel, setConfirmDel] = useState(false);

  const templates = [
    { id:1, name:"قالب السوق السعودي",    settings:"عام|جميع|500+فلاتر عربية", last:"2026-06-28" },
    { id:2, name:"قالب النشطين (7 أيام)", settings:"عام|نشطين|بدون بوتات",      last:"2026-06-25" },
    { id:3, name:"قالب التجميع الكامل",   settings:"عام|جميع|بدون فلاتر",       last:"2026-06-20" },
  ];

  if (selected !== null) {
    const tmpl = templates.find(t=>t.id===selected)!;
    return (
      <div className="animate-fade">
        <PageHeader title={`قالب: ${tmpl.name}`} icon={<BookmarkCheck className="h-5 w-5" />} />
        <div className="card p-5 space-y-4">
          <div className="text-xs text-surface-500 space-y-1">
            <div>الإعدادات: {tmpl.settings}</div>
            <div>آخر استخدام: {tmpl.last}</div>
          </div>
          <Field label="رابط المجموعة المستهدفة" placeholder="@group أو t.me/group" />
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="primary" onClick={() => push(["gather","public"])}>▶️ استخدام هذا القالب</Button>
            <Button onClick={() => show("تم نسخ القالب")}>📋 نسخ القالب</Button>
            <Button onClick={() => show("القالب قابل للتعديل")}>✏️ تعديل القالب</Button>
            <Button variant="danger" onClick={() => setConfirmDel(true)}>🗑️ حذف القالب</Button>
          </div>
          <Button onClick={() => setSelected(null)}>🔙 رجوع</Button>
        </div>
        <ConfirmDialog open={confirmDel} danger title="حذف القالب" message={`سيتم حذف "${tmpl.name}" نهائياً.`}
          onConfirm={()=>{ setConfirmDel(false); show("تم حذف القالب","danger"); setSelected(null); }}
          onCancel={()=>setConfirmDel(false)} />
        {node}
      </div>
    );
  }

  return (
    <div className="animate-fade">
      <PageHeader title="قوالب التجميع المحفوظة" icon={<BookmarkCheck className="h-5 w-5" />} />
      <div className="space-y-3">
        <Button onClick={() => push(["gather","public"])}>➕ إنشاء قالب جديد</Button>
        <Table columns={["اسم القالب","الإعدادات","آخر استخدام",""]} rows={templates.map((t) => [
          t.name, t.settings, t.last,
          <Button onClick={() => setSelected(t.id)}>إدارة</Button>,
        ])} />
      </div>
      {node}
    </div>
  );
}

/* ── GatherStats ── */
function GatherStats() {
  const { show, node } = useToast();
  return (
    <div className="animate-fade">
      <PageHeader title="إحصائيات التجميع" icon={<BarChart3 className="h-5 w-5" />} />
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="الكل الوقت"    value="284,200" tone="accent" />
          <StatCard label="اليوم"          value="15,340"  tone="brand"  />
          <StatCard label="الأسبوع"       value="48,200"  tone="accent" />
          <StatCard label="متوسط السرعة"  value="12/ث"    tone="brand"  />
        </div>
        <div className="card p-5">
          <SectionTitle>📈 نشاط التجميع — آخر 7 أيام</SectionTitle>
          <div className="h-24 flex items-end gap-1">
            {[40,70,55,90,65,80,45].map((h,i)=>(
              <div key={i} className="flex-1 bg-accent-400 rounded-t opacity-80" style={{height:`${h}%`}} />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-xs text-surface-400">
            <span>السبت</span><span>الأحد</span><span>الاثنين</span><span>الثلاثاء</span>
            <span>الأربعاء</span><span>الخميس</span><span>الجمعة</span>
          </div>
        </div>
        <div className="card p-5">
          <SectionTitle>أكثر المصادر تجميعاً (Top Sources)</SectionTitle>
          <Table columns={["المجموعة","المجموع","آخر تجميع"]} rows={[
            ["@market_sa",    "45,000", "2026-07-01"],
            ["@crypto_world", "28,400", "2026-06-30"],
            ["@offers_daily", "19,800", "2026-06-28"],
          ]} />
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
