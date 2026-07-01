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

export function AddModule() {
  const { push } = useNav();
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
  const todayAdded = 1842;
  const successRate = 94;
  return (
    <div className="animate-fade">
      <PageHeader title="إضافة الأعضاء" subtitle="إضافة جماعية للقروبات" icon={<UserPlus className="h-5 w-5" />} />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="مضاف اليوم"   value={todayAdded.toLocaleString()} tone="brand"  />
        <StatCard label="الأسبوع"       value="9,840"                       tone="accent" />
        <StatCard label="معدل النجاح"   value={`${successRate}%`}           tone="brand"  />
        <StatCard label="آخر عملية"     value="منذ 2س"                      tone="accent" />
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
  const [started, setStarted]       = useState(false);

  if (started) return <AddRunning summary={{}} onBack={() => { setStarted(false); push(["add"]); }} />;

  return (
    <div className="animate-fade">
      <PageHeader title="إضافة من ملف CSV" icon={<FileText className="h-5 w-5" />}
        steps={step>0?{label:"إضافة الأعضاء",n:step+1,total:3}:undefined} />
      <div className="mx-auto max-w-2xl">
        {step===0 && (
          <div className="card p-6 space-y-4">
            <SectionTitle>اختر ملف</SectionTitle>
            <div className="space-y-2">
              {exportedFiles.map((f) => (
                <OptionButton key={f.id} label={f.name} desc={`${f.members.toLocaleString()} عضو — ${f.date}`} selected={file===f.id} onClick={() => setFile(f.id)} />
              ))}
              <OptionButton label="📁 تصفح مسار آخر" desc="ملف CSV مخصص" onClick={() => show("تصفح الملفات")} />
            </div>
            {file && (
              <Alert tone="info" title="🔍 تحليل الملف...">
                <div className="mt-1 text-xs flex flex-wrap gap-3">
                  <span>إجمالي: {exportedFiles.find(f2=>f2.id===file)?.members.toLocaleString()}</span>
                  <span>بـ@username: 72%</span>
                  <span>بـID: 28%</span>
                  <span className="text-warn-600">⚠️ بدون username: 28% (سيُتخطى)</span>
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
                {method==="link" && <Alert tone="info" title="🔗 سيتم إنشاء رابط دعوة: https://t.me/+XXXXX" />}
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
            {accs==="smart" && (
              <Alert tone="info" title="🧠 يختار تلقائياً: الأعضاء في المجموعة + الأعلى صحة + الأقل استخداماً + الأقدم عمراً" />
            )}
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
              <SRow label="ملف"         value={file?exportedFiles.find(f=>f.id===file)?.name??"":""} />
              <SRow label="هدف"         value={target} />
              <SRow label="طريقة"       value={{direct:"مباشرة",invite:"دعوة رسالة",link:"رابط دعوة"}[method]} />
              <SRow label="حسابات"      value={{single:"واحد",rotate:"تدوير",group:"مجموعة",selected:"محدد",smart:"ذكي"}[accs]} />
              <SRow label="تأخير"       value={smartDelay?"ذكي تلقائي":`${delay} ث`} />
              <SRow label="حد يومي"     value={smartLimit?"ذكي تلقائي":`${dailyLimit}/يوم`} />
              <SRow label="حد التبديل"  value={`${addLimit} إضافة`} />
              <SRow label="بين الحسابات" value={`${switchDelay} دقيقة`} />
            </div>
            <Alert tone="info" title="📊 تقدير: 60 إضافة/يوم | ~235 يوم للاكتمال" />
            <Button variant="primary" className="w-full" icon={<Play className="h-4 w-4" />} onClick={() => setStarted(true)}>✅ بدء الإضافة الآن</Button>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => setStep(1)}>✏️ تعديل الإعدادات</Button>
              <Button variant="danger" onClick={() => { setStep(0); setFile(null); }}>❌ إلغاء</Button>
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
  const [users, setUsers]   = useState("");
  const [target, setTarget] = useState("@my_group");
  const [checking, setChecking] = useState(false);
  const [checked, setChecked]   = useState(false);

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
              <span className="chip bg-brand-50 text-brand-700 ring-1 ring-brand-200">✅صالح: 4</span>
              <span className="chip bg-danger-50 text-danger-700 ring-1 ring-danger-200">❌غير موجود: 1</span>
              <span className="chip bg-warn-50 text-warn-700 ring-1 ring-warn-200">⚠️خصوصية: 1</span>
            </div>
          </Alert>
        )}
        <InlineEdit label="رابط المجموعة المستهدفة" value={target} onSave={setTarget} placeholder="@my_group" />
        <Alert tone="info" title="نفس إعدادات الإضافة من CSV متاحة في الخطوة التالية" />
        <Button variant="primary" className="w-full" onClick={() => push(["add","csv"])}>متابعة للإعدادات التفصيلية</Button>
      </div>
      {node}
    </div>
  );
}

/* ── SmartAdd ── */
function SmartAdd() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [sourceLink, setSourceLink] = useState("");
  const [targetLink, setTargetLink] = useState("");
  const [analyzed, setAnalyzed]     = useState(false);
  const [analyzing, setAnalyzing]   = useState(false);
  const [filters, setFilters] = useState({ activeOnly:false, onlineOnly:false, hasUser:true, skipExisting:true, skipBlacklist:true });

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
            <Alert tone="info" title="📊 المصدر: 15,340 عضو | الهدف: 1,200 عضو">
              <div className="text-xs mt-0.5">🎯 مرشح للإضافة: 14,140 (بعد استبعاد الموجودين)</div>
            </Alert>
            <SectionTitle>فلاتر الاستهداف</SectionTitle>
            <Checkbox label="النشطون فقط (أرسلوا رسائل)"  checked={filters.activeOnly}    onChange={(v)=>setFilters({...filters,activeOnly:v})} />
            <Checkbox label="المتواجدون حالياً فقط"         checked={filters.onlineOnly}    onChange={(v)=>setFilters({...filters,onlineOnly:v})} />
            <Checkbox label="لديهم @username"               checked={filters.hasUser}       onChange={(v)=>setFilters({...filters,hasUser:v})} />
            <Checkbox label="استبعاد الموجودين في الهدف"   checked={filters.skipExisting}  onChange={(v)=>setFilters({...filters,skipExisting:v})} />
            <Checkbox label="استبعاد القائمة السوداء"       checked={filters.skipBlacklist} onChange={(v)=>setFilters({...filters,skipBlacklist:v})} />
            <Button variant="primary" className="w-full" onClick={() => push(["add","csv"])}>✅ بدء الإضافة الذكية — إعدادات التفصيلية</Button>
          </div>
        )}
      </div>
      {node}
    </div>
  );
}

/* ── MultiSource ── */
function MultiSource() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [csvSelected, setCsvSelected] = useState<number[]>([]);
  const [groupLinks, setGroupLinks]   = useState("");
  const [target, setTarget]           = useState("@my_group");
  const [dedup, setDedup]             = useState(true);

  const toggleCsv = (id:number) => setCsvSelected(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);
  const totalFromCsv = exportedFiles.filter(f=>csvSelected.includes(f.id)).reduce((s,f)=>s+f.members,0);

  return (
    <div className="animate-fade">
      <PageHeader title="إضافة من عدة مصادر (Multi-Source)" icon={<Layers className="h-5 w-5" />} />
      <div className="space-y-4">
        <div className="card p-5 space-y-3">
          <SectionTitle>📂 ملفات CSV</SectionTitle>
          {exportedFiles.map((f) => (
            <Checkbox key={f.id} label={`${f.name} (${f.members.toLocaleString()} عضو)`} checked={csvSelected.includes(f.id)} onChange={() => toggleCsv(f.id)} />
          ))}
        </div>
        <div className="card p-5 space-y-3">
          <SectionTitle>🌐 مجموعات (سيُجمَّع منها أولاً)</SectionTitle>
          <Field label="روابط المجموعات (واحد per سطر)" placeholder={"@group1\n@group2"} value={groupLinks} onChange={setGroupLinks} />
        </div>
        {(csvSelected.length>0||groupLinks) && (
          <Alert tone="info" title={`إجمالي: ${exportedFiles.filter(f=>csvSelected.includes(f.id)).length} ملف | ${groupLinks.split("\n").filter(Boolean).length} مجموعة`}>
            <div className="text-xs mt-0.5">الأعضاء المرشحة من CSV: {totalFromCsv.toLocaleString()}</div>
          </Alert>
        )}
        <div className="card p-5 space-y-3">
          <InlineEdit label="رابط المجموعة الهدف" value={target} onSave={setTarget} placeholder="@my_group" />
          <Checkbox label="إزالة المكرر بين المصادر أولاً" checked={dedup} onChange={setDedup} />
          <Button variant="primary" className="w-full" onClick={() => push(["add","csv"])}>✅ بدء الإضافة — إعدادات التفصيلية</Button>
        </div>
      </div>
      {node}
    </div>
  );
}

/* ── ResumeOp ── */
function ResumeOp() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [selected, setSelected] = useState<number|null>(null);
  const [confirmDel, setConfirmDel] = useState(false);

  const saved = [
    { id:1, name:"إضافة @market_sa → @my_group",    progress:45, saved:"6,400/14,135", date:"2026-06-30 14:22", accs:3 },
    { id:2, name:"إضافة @crypto_world → @my_group", progress:80, saved:"3,360/4,210",  date:"2026-06-29 09:15", accs:2 },
  ];

  if (selected !== null) {
    const op = saved.find(s=>s.id===selected)!;
    return (
      <div className="animate-fade">
        <PageHeader title="استئناف عملية" icon={<RefreshCw className="h-5 w-5" />} />
        <div className="card p-5 space-y-4">
          <Alert tone="info" title={`نقطة التوقف: ${op.name}`}>
            <div className="mt-1 text-xs space-y-0.5">
              <div>التقدم: {op.progress}% | حُفظ: {op.saved}</div>
              <div>تاريخ التوقف: {op.date}</div>
              <div>الحسابات: {op.accs} حساب</div>
            </div>
          </Alert>
          <div className="grid gap-2">
            <Button variant="primary" className="w-full" onClick={() => push(["add","csv"])}>▶️ استئناف بنفس الإعدادات</Button>
            <Button className="w-full" onClick={() => push(["add","csv"])}>✏️ استئناف بإعدادات معدّلة</Button>
            <Button variant="danger" className="w-full" onClick={() => setConfirmDel(true)}>🗑️ حذف نقطة الحفظ</Button>
            <Button onClick={() => setSelected(null)}>🔙 رجوع</Button>
          </div>
        </div>
        <ConfirmDialog open={confirmDel} danger title="حذف نقطة الحفظ" message="سيتم حذف التقدم المحفوظ نهائياً."
          onConfirm={()=>{ setConfirmDel(false); show("تم حذف نقطة الحفظ"); setSelected(null); }}
          onCancel={()=>setConfirmDel(false)} />
        {node}
      </div>
    );
  }

  return (
    <div className="animate-fade">
      <PageHeader title="استئناف عملية سابقة" icon={<RefreshCw className="h-5 w-5" />} />
      <div className="space-y-3">
        {saved.map((op) => (
          <div key={op.id} className="card p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-bold text-surface-800">{op.name}</span>
              <span className="chip bg-brand-50 text-brand-700 ring-1 ring-brand-200">{op.progress}%</span>
            </div>
            <Progress value={op.progress} tone="brand" />
            <div className="mt-2 text-xs text-surface-500">{op.saved} | {op.date}</div>
            <Button className="mt-3 w-full" onClick={() => setSelected(op.id)}>استئناف هذه العملية</Button>
          </div>
        ))}
        {saved.length===0 && <EmptyState icon={<RotateCw className="h-8 w-8" />} title="لا توجد عمليات محفوظة" />}
      </div>
      {node}
    </div>
  );
}

/* ── Blacklist ── */
function Blacklist() {
  const { show, node } = useToast();
  const [search, setSearch] = useState("");
  const [newUser, setNewUser] = useState("");
  const [newReason, setNewReason] = useState("");
  const [adding, setAdding] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [importPath, setImportPath] = useState("/blacklist.csv");

  const filtered = blacklist.filter(b=>b.user.includes(search)||b.reason.includes(search));

  return (
    <div className="animate-fade">
      <PageHeader title="القائمة السوداء (Blacklist)" icon={<Ban className="h-5 w-5" />} />
      <div className="space-y-4">
        <div className="flex gap-2">
          <StatCard label="إجمالي القائمة" value={String(blacklist.length)} tone="danger" />
        </div>
        <div className="flex flex-wrap gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="🔍 بحث" />
          <Button onClick={() => setAdding(!adding)}>➕ إضافة يدوياً</Button>
          <Button onClick={() => show("تم استيراد القائمة")}>📥 استيراد قائمة</Button>
          <Button onClick={() => show("تم تصدير CSV")}>📤 تصدير CSV</Button>
          <Button variant="danger" onClick={() => setConfirmClear(true)}>🗑️ مسح الكل</Button>
        </div>
        {adding && (
          <div className="card p-4 space-y-3">
            <SectionTitle>➕ إضافة يدوياً</SectionTitle>
            <Field label="@username أو UserID" placeholder="@user أو 123456789" value={newUser} onChange={setNewUser} />
            <Field label="السبب (اختياري)" placeholder="بوت / محظور..." value={newReason} onChange={setNewReason} />
            <div className="flex gap-2">
              <Button variant="primary" disabled={!newUser} onClick={() => { show("تمت الإضافة للقائمة السوداء"); setNewUser(""); setNewReason(""); setAdding(false); }}>💾 حفظ</Button>
              <Button onClick={() => setAdding(false)}>إلغاء</Button>
            </div>
          </div>
        )}
        {filtered.length===0
          ? <EmptyState icon={<ShieldOff className="h-8 w-8" />} title="القائمة السوداء فارغة" />
          : <Table columns={["مستخدم","السبب","تاريخ الإضافة",""]} rows={filtered.map((b) => [
              b.user, b.reason, b.date,
              <Button variant="danger" onClick={() => show("تمت الإزالة")}>❌ إزالة</Button>,
            ])} />}
        <ConfirmDialog open={confirmClear} danger title="مسح القائمة السوداء كاملاً" message="سيتم حذف جميع المدخلات نهائياً."
          onConfirm={()=>{ setConfirmClear(false); show("تم مسح القائمة","danger"); }}
          onCancel={()=>setConfirmClear(false)} />
      </div>
      {node}
    </div>
  );
}

/* ── AddLogs ── */
function AddLogs() {
  const { show, node } = useToast();
  const [tab, setTab]         = useState<"ops"|"stats">("ops");
  const [dateFilter, setDateFilter] = useState<"today"|"7d"|"30d"|"custom">("7d");
  const [selected, setSelected]     = useState<number|null>(null);

  if (selected !== null) {
    const log = addLogs.find(l=>l.id===selected)!;
    return (
      <div className="animate-fade">
        <PageHeader title={`تفاصيل: ${log.file}`} icon={<BarChart3 className="h-5 w-5" />} />
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="ناجح"  value={log.success.toLocaleString()} tone="brand"  />
            <StatCard label="فاشل"  value={log.fail.toLocaleString()}    tone="danger" />
            <StatCard label="تخطي"  value="500"                           tone="warn"   />
            <StatCard label="الهدف" value={log.target}                   tone="accent" />
          </div>
          <div className="card p-5">
            <SectionTitle>أداء كل حساب</SectionTitle>
            <Table columns={["حساب","أرسل","نجح","فشل"]} rows={accounts.slice(0,3).map(a=>[
              a.phone,
              String(Math.floor(log.success/3+log.fail/3)),
              String(Math.floor(log.success/3)),
              String(Math.floor(log.fail/3)),
            ])} />
          </div>
          <div className="card p-5">
            <SectionTitle>أسباب الفشل</SectionTitle>
            <Table columns={["السبب","العدد"]} rows={[
              ["UserPrivacyRestricted","210"],
              ["FloodWait","45"],
              ["UserDeactivated","30"],
              ["PeerFlood","12"],
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
            {addLogs.length===0
              ? <EmptyState icon={<ListChecks className="h-8 w-8" />} title="لا توجد سجلات" />
              : <Table columns={["تاريخ","ملف","هدف","ناجح","فاشل",""]} rows={addLogs.map((l) => [
                  l.date, l.file, l.target,
                  <span className="chip bg-brand-50 text-brand-700 ring-1 ring-brand-200">{l.success.toLocaleString()}</span>,
                  <span className="chip bg-danger-50 text-danger-700 ring-1 ring-danger-200">{l.fail.toLocaleString()}</span>,
                  <Button onClick={() => setSelected(l.id)}>تفاصيل</Button>,
                ])} />}
          </div>
        )}

        {tab==="stats" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="الكل الوقت"   value="284,200" tone="brand"  />
              <StatCard label="اليوم"         value="1,842"   tone="accent" />
              <StatCard label="معدل النجاح"  value="94%"     tone="brand"  />
              <StatCard label="FloodWaits"    value="45"      tone="warn"   />
            </div>
            <div className="card p-5">
              <SectionTitle>📈 نشاط آخر 7 أيام</SectionTitle>
              <div className="h-20 flex items-end gap-1">
                {[60,80,45,90,70,55,75].map((h,i)=>(
                  <div key={i} className="flex-1 bg-brand-400 rounded-t" style={{height:`${h}%`}} />
                ))}
              </div>
            </div>
            <div className="card p-5">
              <SectionTitle>أكثر أسباب الفشل</SectionTitle>
              <Table columns={["السبب","العدد","النسبة"]} rows={[
                ["UserPrivacyRestricted","1,240","52%"],
                ["FloodWait","450","19%"],
                ["UserDeactivated","380","16%"],
                ["PeerFlood","310","13%"],
              ]} />
            </div>
            <div className="card p-5">
              <SectionTitle>أداء كل حساب (ترتيب)</SectionTitle>
              <Table columns={["حساب","ناجح","فاشل","معدل النجاح"]} rows={accounts.map((a,i)=>[
                a.phone,
                String(Math.floor((14000-i*2000)*0.94)),
                String(Math.floor((14000-i*2000)*0.06)),
                `${94-i}%`,
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
  const [delay, setDelay]           = useState("60");
  const [delayTo, setDelayTo]       = useState("120");
  const [switchFrom, setSwitchFrom] = useState("5");
  const [switchTo, setSwitchTo]     = useState("10");
  const [dailyLimit, setDailyLimit] = useState("20");
  const [switchCount, setSwitchCount] = useState("5");
  const [floodAction, setFloodAction] = useState<"wait"|"switch"|"stop">("wait");
  const [banAction, setBanAction]   = useState<"remove"|"slow"|"stop">("remove");
  const [privacyAction, setPrivacyAction] = useState<"skip"|"blacklist">("skip");
  const [saveProgress, setSaveProgress] = useState(true);
  const [smartDelay, setSmartDelay] = useState(false);
  const [smartLimit, setSmartLimit] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div className="animate-fade">
      <PageHeader title="إعدادات الإضافة الافتراضية" icon={<Settings className="h-5 w-5" />} />
      <div className="space-y-4">
        <div className="card p-5 space-y-3">
          <SectionTitle>⏱️ التأخيرات الافتراضية</SectionTitle>
          <div className="flex gap-2">
            <InlineEdit label="بين الإضافات — من (ث)" value={delay}   onSave={setDelay}   placeholder="60" />
            <InlineEdit label="إلى (ث)"               value={delayTo} onSave={setDelayTo} placeholder="120" />
          </div>
          <div className="flex gap-2">
            <InlineEdit label="بين الحسابات — من (د)" value={switchFrom} onSave={setSwitchFrom} placeholder="5" />
            <InlineEdit label="إلى (د)"               value={switchTo}   onSave={setSwitchTo}   placeholder="10" />
          </div>
          <InlineEdit label="📊 الحد اليومي الافتراضي/حساب" value={dailyLimit}   onSave={setDailyLimit}   placeholder="20" />
          <InlineEdit label="🔢 إضافات قبل التبديل"         value={switchCount}  onSave={setSwitchCount}  placeholder="5" />
        </div>
        <div className="card p-5 space-y-3">
          <SectionTitle>سلوك الأخطاء الافتراضي</SectionTitle>
          <div>
            <div className="mb-2 text-xs font-bold text-surface-500">عند FloodWait</div>
            <OptionButton label="⭐ انتظار + تبديل تلقائي" selected={floodAction==="wait"}   onClick={() => setFloodAction("wait")} />
            <OptionButton label="تبديل فوري فقط"            selected={floodAction==="switch"} onClick={() => setFloodAction("switch")} />
            <OptionButton label="إيقاف + إشعار"             selected={floodAction==="stop"}   onClick={() => setFloodAction("stop")} />
          </div>
          <div>
            <div className="mb-2 text-xs font-bold text-surface-500">عند حظر حساب</div>
            <OptionButton label="⭐ إزالة + متابعة"         selected={banAction==="remove"} onClick={() => setBanAction("remove")} />
            <OptionButton label="إيقاف + زيادة تأخير"       selected={banAction==="slow"}   onClick={() => setBanAction("slow")} />
            <OptionButton label="إيقاف كامل"                selected={banAction==="stop"}   onClick={() => setBanAction("stop")} />
          </div>
          <div>
            <div className="mb-2 text-xs font-bold text-surface-500">عند خصوصية مغلقة</div>
            <OptionButton label="⭐ تخطي تلقائي"            selected={privacyAction==="skip"}      onClick={() => setPrivacyAction("skip")} />
            <OptionButton label="تخطي + إضافة للسوداء"      selected={privacyAction==="blacklist"} onClick={() => setPrivacyAction("blacklist")} />
          </div>
        </div>
        <div className="card p-5 space-y-2">
          <SectionTitle>خيارات عامة</SectionTitle>
          <Checkbox label="حفظ التقدم افتراضياً" checked={saveProgress} onChange={setSaveProgress} />
          <Checkbox label="تأخير ذكي افتراضي"    checked={smartDelay}  onChange={setSmartDelay} />
          <Checkbox label="الحد الذكي افتراضياً"  checked={smartLimit}  onChange={setSmartLimit} />
        </div>
        <div className="flex gap-2">
          <Button variant="primary" className="flex-1" onClick={() => show("💾 تم حفظ الإعدادات الافتراضية")}>💾 حفظ الإعدادات</Button>
          <Button variant="danger" onClick={() => setConfirmReset(true)}>🔄 إعادة الافتراضية</Button>
        </div>
        <ConfirmDialog open={confirmReset} danger title="إعادة الإعدادات الافتراضية" message="سيتم استعادة جميع الإعدادات لقيمها الافتراضية."
          onConfirm={()=>{ setConfirmReset(false); show("تمت إعادة الإعدادات الافتراضية"); }}
          onCancel={()=>setConfirmReset(false)} />
      </div>
      {node}
    </div>
  );
}
