import { useState } from "react";
import {
  Users, UserPlus, FolderInput, ListChecks, ShieldCheck,
  Trash2, Zap, Upload, Flame, Phone, KeyRound, CheckCircle2, Globe,
  LayersIcon, Heart, Settings2, UserCog, Image, Activity, Lock,
  Archive, AlertOctagon, BarChart2, Search, Filter, SortAsc,
  Eye, EyeOff, FileKey, FolderZip, FileText, Star, ChevronDown,
} from "lucide-react";
import { useNav } from "../nav";
import {
  PageHeader, Button, Field, Checkbox, OptionButton, Progress,
  StatusChip, Table, SectionTitle, Alert, ConfirmDialog, useToast,
  EmptyState, Tabs, InlineEdit, SearchInput, StatCard,
} from "../ui";
import { accounts, type AccountStatus } from "../data";

export function AccountsModule() {
  const { push } = useNav();
  const active     = accounts.filter((a) => a.status === "active").length;
  const blocked    = accounts.filter((a) => a.status === "blocked").length;
  const restricted = accounts.filter((a) => a.status === "restricted").length;
  const items = [
    { id: "add",          label: "إضافة حساب جديد",           desc: "تسجيل دخول برقم الهاتف",      icon: UserPlus      },
    { id: "import",       label: "استيراد الجلسات",             desc: "من مجلد أو ملف .session",    icon: FolderInput   },
    { id: "list",         label: "عرض الحسابات",               desc: "جدول كل الحسابات وحالاتها",  icon: ListChecks    },
    { id: "validate",     label: "التحقق من الصحة",             desc: "فحص جماعي للحسابات",         icon: ShieldCheck   },
    { id: "pools",        label: "مجموعات الحسابات",            desc: "Account Pools",               icon: LayersIcon    },
    { id: "warmup",       label: "تهيئة الحسابات (تسخين)",      desc: "تسخين الحسابات الجديدة",     icon: Flame         },
    { id: "health",       label: "درجة صحة الحسابات",          desc: "Health Score System",          icon: Heart         },
    { id: "settings-ind", label: "إعدادات فردية للحساب",        desc: "حدود وأولويات خاصة",          icon: Settings2     },
    { id: "profile",      label: "إدارة ملفات الشخصية",        desc: "Profile Manager",              icon: Image         },
    { id: "activity",     label: "سجل نشاط الحسابات",          desc: "Activity Log",                 icon: Activity      },
    { id: "security",     label: "أمان الحسابات",               desc: "فحص أمان وجلسات نشطة",       icon: Lock          },
    { id: "export",       label: "تصدير الجلسات",               desc: "Backup & Restore",             icon: Archive       },
    { id: "auto-remove",  label: "إزالة تلقائية للمحظورة",      desc: "كشف وحذف المحظورة",           icon: Zap           },
    { id: "remove",       label: "إزالة حساب",                  desc: "حذف حساب محدد",               icon: Trash2        },
  ];
  return (
    <div className="animate-fade">
      <PageHeader title="مدير الحسابات" subtitle="إدارة حسابات تيليجرام" icon={<Users className="h-5 w-5" />} />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="نشط"    value={active}              tone="brand"  />
        <StatCard label="محظور"  value={blocked}             tone="danger" />
        <StatCard label="مقيد"   value={restricted}          tone="warn"   />
        <StatCard label="الإجمالي" value={accounts.length}   tone="accent" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <button key={it.id} onClick={() => push(["accounts", it.id])}
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

export function AccountsScreen({ sub }: { sub: string }) {
  switch (sub) {
    case "add":          return <AddAccount />;
    case "import":       return <ImportSessions />;
    case "list":         return <ListAccounts />;
    case "validate":     return <ValidateAccounts />;
    case "remove":       return <RemoveAccount />;
    case "auto-remove":  return <AutoRemove />;
    case "export":       return <ExportSessions />;
    case "warmup":       return <WarmupAccounts />;
    case "pools":        return <AccountPools />;
    case "health":       return <HealthScore />;
    case "settings-ind": return <IndividualSettings />;
    case "profile":      return <ProfileManager />;
    case "activity":     return <ActivityLog />;
    case "security":     return <AccountSecurity />;
    default:             return null;
  }
}

/* ── AddAccount ── */
function AddAccount() {
  const { push } = useNav();
  const { node } = useToast();
  const [step, setStep]   = useState(0);
  const [phone, setPhone] = useState("");
  const [code, setCode]   = useState("");
  const [twoFA, setTwoFA] = useState("");
  const [has2FA, setHas2FA]   = useState(false);
  const [category, setCategory] = useState<"primary"|"backup"|"gather"|"add"|"multi">("primary");
  const [group, setGroup] = useState<string|null>(null);

  const cats = [
    { id:"primary", label:"🔴 رئيسي (Primary)"       },
    { id:"backup",  label:"🟡 احتياطي (Backup)"       },
    { id:"gather",  label:"🟢 تجميع فقط"             },
    { id:"add",     label:"🔵 إضافة فقط"              },
    { id:"multi",   label:"⚪ متعدد الأغراض"          },
  ] as const;
  const mockGroups = ["مجموعة A", "مجموعة B", "مجموعة C"];

  return (
    <div className="animate-fade">
      <PageHeader title="إضافة حساب جديد" subtitle="تسجيل دخول برقم الهاتف" icon={<UserPlus className="h-5 w-5" />} steps={{ label:"إضافة حساب", n: step+1, total:6 }} />
      <div className="mx-auto max-w-lg">
        {step === 0 && (
          <div className="card p-6 space-y-4">
            <SectionTitle icon={<Phone className="h-4 w-4" />}>رقم الهاتف</SectionTitle>
            <Field label="رقم الهاتف" placeholder="+9665XXXXXXXX" value={phone} onChange={setPhone} icon={<Phone className="h-4 w-4" />} hint="صيغة دولية مع رمز الدولة" />
            <div className="flex gap-2">
              <Button variant="primary" className="flex-1" onClick={() => setStep(1)} disabled={!phone}>⏳ إرسال OTP</Button>
              <Button onClick={() => push(["accounts"])}>إلغاء</Button>
            </div>
          </div>
        )}
        {step === 1 && (
          <div className="card p-6 space-y-4">
            <Alert tone="info" title="⏳ جاري إرسال OTP...">سيصلك رمز عبر التطبيق أو رسالة SMS.</Alert>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="primary" icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => setStep(2)}>📱 استلمته في التطبيق</Button>
              <Button icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => setStep(2)}>💬 استلمته SMS</Button>
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="card p-6 space-y-4">
            <SectionTitle icon={<KeyRound className="h-4 w-4" />}>🔢 رمز OTP</SectionTitle>
            <Field label="رمز التحقق" placeholder="• • • • •" value={code} onChange={setCode} />
            <div className="flex gap-2">
              <Button variant="primary" className="flex-1" onClick={() => { setHas2FA(true); setStep(3); }} disabled={!code}>تحقق</Button>
              <Button onClick={() => setStep(0)}>رجوع</Button>
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="card p-6 space-y-4">
            <Alert tone="warn" title="🔐 فحص 2FA...">الحساب محمي بكلمة مرور ثنائية.</Alert>
            <Field label="كلمة مرور 2FA" type="password" placeholder="••••••••" value={twoFA} onChange={setTwoFA} />
            <div className="flex gap-2">
              <Button variant="primary" className="flex-1" onClick={() => setStep(4)}>تأكيد</Button>
              <Button onClick={() => setStep(2)}>رجوع</Button>
            </div>
          </div>
        )}
        {step === 4 && (
          <div className="card p-6 space-y-4">
            <Alert tone="success" title="✅ تم تسجيل الدخول">
              <div className="mt-2 grid gap-1 text-xs">
                <span>الاسم: أحمد محمد</span>
                <span>@username: @ahmed_new</span>
                <span>الهاتف: {phone || "+9665XXXXXXXX"}</span>
                <span>تاريخ الإنشاء: 2024-01-15</span>
              </div>
            </Alert>
            <SectionTitle>📌 تصنيف الحساب</SectionTitle>
            <div className="grid gap-2">
              {cats.map((c) => (
                <OptionButton key={c.id} label={c.label} selected={category === c.id} onClick={() => setCategory(c.id as typeof category)} />
              ))}
            </div>
            <Button variant="primary" className="w-full" onClick={() => setStep(5)}>التالي</Button>
          </div>
        )}
        {step === 5 && (
          <div className="card p-6 space-y-4">
            <SectionTitle>إضافة لمجموعة حسابات</SectionTitle>
            <div className="grid gap-2">
              {mockGroups.map((g) => (
                <OptionButton key={g} label={g} selected={group === g} onClick={() => setGroup(g)} />
              ))}
              <Button onClick={() => {}} className="w-full">➕ إنشاء مجموعة جديدة</Button>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="primary" icon={<Globe className="h-4 w-4" />} onClick={() => push(["proxy"])}>🌐 تعيين بروكسي الآن</Button>
              <Button onClick={() => push(["accounts","warmup"])}>🔥 بدء التسخين فوراً</Button>
            </div>
            <div className="flex gap-2">
              <Button variant="primary" className="flex-1" onClick={() => { setStep(0); setPhone(""); setCode(""); setTwoFA(""); setHas2FA(false); }}>✅ إضافة حساب آخر</Button>
              <Button onClick={() => push(["accounts"])}>🔙 مدير الحسابات</Button>
            </div>
          </div>
        )}
      </div>
      {node}
    </div>
  );
}

/* ── ImportSessions ── */
function ImportSessions() {
  const { show, node } = useToast();
  const [mode, setMode]     = useState<"menu"|"folder"|"file"|"txt"|"string"|"zip">("menu");
  const [path, setPath]     = useState("");
  const [scanning, setScanning] = useState(false);
  const [done, setDone]     = useState(false);
  const [strings, setStrings] = useState("");
  const [zipPass, setZipPass] = useState("");

  const startScan = () => { setScanning(true); setDone(false); setTimeout(() => { setScanning(false); setDone(true); }, 1800); };

  if (mode === "menu") {
    return (
      <div className="animate-fade">
        <PageHeader title="استيراد الجلسات" subtitle="من ملفات .session" icon={<FolderInput className="h-5 w-5" />} />
        <div className="mx-auto max-w-lg space-y-3">
          <OptionButton label="📁 من مجلد (جميع .session)"  desc="فحص مجلد كامل"          onClick={() => setMode("folder")} />
          <OptionButton label="📄 ملف واحد"                 desc="استيراد ملف .session واحد" onClick={() => setMode("file")} />
          <OptionButton label="📋 من ملف نصي (أرقام+جلسات)" desc="قائمة أرقام ومسارات"       onClick={() => setMode("txt")} />
          <OptionButton label="🔑 من ملف String Session"    desc="String Sessions"           onClick={() => setMode("string")} />
          <OptionButton label="📦 من ملف ZIP"               desc="جلسات مضغوطة"              onClick={() => setMode("zip")} />
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade">
      <PageHeader title={
        mode==="folder"?"استيراد من مجلد":mode==="file"?"استيراد ملف واحد":
        mode==="txt"?"استيراد من ملف نصي":mode==="string"?"استيراد String Session":"استيراد من ZIP"
      } icon={<FolderInput className="h-5 w-5" />} />
      <div className="mx-auto max-w-lg card p-6 space-y-4">
        {mode === "string" ? (
          <>
            <SectionTitle>🔑 String Sessions (واحد per سطر)</SectionTitle>
            <textarea rows={5} value={strings} onChange={(e)=>setStrings(e.target.value)}
              placeholder={"1BviBcAm...\n1BviBcBm..."}
              className="field resize-y leading-relaxed" />
            <Alert tone="info" title='أدخل كل String Session في سطر منفصل، ثم اضغط فحص' />
          </>
        ) : mode === "zip" ? (
          <>
            <InlineEdit label="مسار ملف ZIP" value={path || "/path/to/sessions.zip"} onSave={setPath} />
            <Field label="كلمة مرور ZIP (إن وُجدت)" placeholder="اختياري" value={zipPass} onChange={setZipPass} type="password" />
          </>
        ) : (
          <InlineEdit label="المسار" value={path || (mode==="folder"?"./sessions/":"/path/to/file.session")} onSave={setPath} />
        )}
        {!scanning && !done && (
          <div className="flex gap-2">
            <Button variant="primary" className="flex-1" onClick={startScan}>🔍 بدء الفحص</Button>
            <Button onClick={() => setMode("menu")}>رجوع</Button>
          </div>
        )}
        {scanning && <Progress value={60} label="🔍 جاري الفحص..." sub="60%" tone="accent" />}
        {done && (
          <div className="space-y-3">
            <Alert tone="success" title="نتائج الفحص">
              <div className="mt-1 flex gap-3">
                <span className="chip bg-brand-50 text-brand-700 ring-1 ring-brand-200">✅ صالحة: 4</span>
                <span className="chip bg-danger-50 text-danger-700 ring-1 ring-danger-200">❌ تالفة: 1</span>
                <span className="chip bg-warn-50 text-warn-700 ring-1 ring-warn-200">🔁 مكررة: 2</span>
              </div>
            </Alert>
            <div className="flex gap-2">
              <Button variant="primary" className="flex-1" onClick={() => { show("تم استيراد 4 جلسات"); setMode("menu"); setDone(false); }}>✅ استيراد الصالحة</Button>
              <Button onClick={() => { setMode("menu"); setDone(false); }}>إلغاء</Button>
            </div>
          </div>
        )}
      </div>
      {node}
    </div>
  );
}

/* ── ListAccounts ── */
function ListAccounts() {
  const { push } = useNav();
  const [filter, setFilter]     = useState<"all"|AccountStatus>("all");
  const [catFilter, setCatFilter] = useState<"all"|string>("all");
  const [healthFilter, setHealthFilter] = useState<"all"|string>("all");
  const [sortBy, setSortBy]     = useState<"default"|"health"|"last"|"age">("default");
  const [search, setSearch]     = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [confirmDel, setConfirmDel] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const { show, node } = useToast();

  const filtered = accounts.filter((a) => {
    if (filter !== "all" && a.status !== filter) return false;
    if (search && !a.name.includes(search) && !a.username.includes(search) && !a.phone.includes(search)) return false;
    return true;
  });

  const toggle = (id: number) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div className="animate-fade">
      <PageHeader title="عرض الحسابات" subtitle={`${accounts.length} حساب`} icon={<ListChecks className="h-5 w-5" />} />
      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="🔍 بحث (اسم/@username/هاتف)" />
          <Button icon={<Filter className="h-4 w-4" />} onClick={() => setShowFilters(!showFilters)}>فلاتر</Button>
          <Button icon={<SortAsc className="h-4 w-4" />} onClick={() => setSortBy(sortBy==="default"?"health":"default")}>
            {sortBy==="default"?"ترتيب افتراضي":"درجة الصحة"}
          </Button>
        </div>
        {showFilters && (
          <div className="card p-4 space-y-3">
            <SectionTitle>فلتر الحالة</SectionTitle>
            <Tabs tabs={[{id:"all",label:"الكل"},{id:"active",label:"✅ نشط"},{id:"blocked",label:"⛔ محظور"},{id:"restricted",label:"⚠️ مقيد"}]}
              active={filter} onChange={(v)=>setFilter(v as typeof filter)} />
            <SectionTitle>فلتر درجة الصحة</SectionTitle>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <OptionButton label="🟢 90-100% (ممتاز)" selected={healthFilter==="90"} onClick={()=>setHealthFilter("90")} />
              <OptionButton label="🟡 70-89% (جيد)"    selected={healthFilter==="70"} onClick={()=>setHealthFilter("70")} />
              <OptionButton label="🟠 50-69% (متوسط)"  selected={healthFilter==="50"} onClick={()=>setHealthFilter("50")} />
              <OptionButton label="🔴 أقل 50% (ضعيف)"  selected={healthFilter==="0"}  onClick={()=>setHealthFilter("0")}  />
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setSelected(filtered.map((a) => a.id))}>☑️ تحديد الكل</Button>
          <Button onClick={() => setSelected([])}>⬜ إلغاء الكل</Button>
          <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} disabled={selected.length===0} onClick={() => setConfirmDel(true)}>🗑 حذف المحدد ({selected.length})</Button>
          <Button disabled={selected.length===0} onClick={() => push(["accounts","warmup"])}>🔥 تسخين المحدد</Button>
          <Button disabled={selected.length===0} onClick={() => push(["accounts","validate"])}>✅ تحقق من المحدد</Button>
          <Button disabled={selected.length===0} onClick={() => push(["proxy"])}>🌐 تعيين بروكسي</Button>
          <Button disabled={selected.length===0} onClick={() => show("تم تغيير التصنيف")}>🏷️ تغيير تصنيف</Button>
        </div>
      </div>
      <Table
        columns={["","#","هاتف","اسم","حالة","درجة الصحة","بروكسي","آخر استخدام",""]}
        rows={filtered.map((a,i) => [
          <input type="checkbox" checked={selected.includes(a.id)} onChange={() => toggle(a.id)} className="h-4 w-4 accent-brand-600" />,
          String(i+1), a.phone, a.name, <StatusChip status={a.status} />,
          <span className="chip bg-brand-50 text-brand-700 ring-1 ring-brand-200">{85+i*3}%</span>,
          a.proxy, a.lastUsed,
          <Button onClick={() => push(["accounts","detail",String(a.id)])}>تفاصيل</Button>,
        ])}
      />
      <ConfirmDialog open={confirmDel} danger title="حذف الحسابات المحددة" message={`سيتم حذف ${selected.length} حساب نهائياً.`}
        confirmLabel="تأكيد الحذف"
        onConfirm={() => { setConfirmDel(false); setSelected([]); show("تم حذف الحسابات"); }}
        onCancel={() => setConfirmDel(false)} />
      {node}
    </div>
  );
}

/* ── AccountDetail ── */
export function AccountDetail({ id }: { id: string }) {
  const { push } = useNav();
  const acc0 = accounts.find((a) => a.id === Number(id)) ?? accounts[0];
  const [name,     setName]     = useState(acc0.name);
  const [username, setUsername] = useState(acc0.username);
  const [proxy,    setProxy]    = useState(acc0.proxy);
  const [confirmDel, setConfirmDel] = useState(false);
  const [verifying, setVerifying]   = useState(false);
  const [verifyResult, setVerifyResult] = useState<string|null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { show, node } = useToast();

  const doVerify = () => {
    setVerifying(true); setVerifyResult(null);
    setTimeout(() => { setVerifying(false); setVerifyResult("✅ نشط"); }, 1500);
  };
  const doRefresh = () => {
    setRefreshing(true);
    setTimeout(() => { setRefreshing(false); show("تم تحديث المعلومات"); }, 1500);
  };

  return (
    <div className="animate-fade">
      <PageHeader title={`بطاقة تفاصيل: ${name}`} subtitle={acc0.phone} icon={<Users className="h-5 w-5" />} />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-4">
          <div className="card p-5">
            <SectionTitle>المعلومات الأساسية</SectionTitle>
            <div className="space-y-2">
              <InlineEdit label="الاسم"     value={name}     onSave={setName} />
              <InlineEdit label="@username" value={username} onSave={setUsername} />
              <InlineEdit label="البروكسي"  value={proxy}    onSave={setProxy} />
              <Row label="الهاتف"             value={acc0.phone} />
              <Row label="تاريخ إنشاء الحساب" value="2024-01-15" />
              <Row label="تاريخ الإضافة"       value="2026-01-20" />
              <Row label="عمر الحساب"          value={acc0.age} />
              <Row label="الحالة"              value={<StatusChip status={acc0.status} />} />
              <Row label="التصنيف"             value="🔴 رئيسي" />
              <Row label="المجموعة"            value="مجموعة A" />
              <Row label="آخر استخدام"         value={acc0.lastUsed} />
              <Row label="عدد القروبات"        value={String(acc0.groups)} />
            </div>
          </div>
          <div className="card p-5">
            <SectionTitle>📊 درجة الصحة</SectionTitle>
            <Progress value={87} label="87%" tone="brand" />
            <div className="mt-3 space-y-1 text-xs text-surface-500">
              <div className="flex justify-between"><span>إجمالي تجميع</span><span className="font-bold text-surface-700">15,340</span></div>
              <div className="flex justify-between"><span>إجمالي إضافة</span><span className="font-bold text-surface-700">4,200</span></div>
              <div className="flex justify-between"><span>FloodWaits هذا الأسبوع</span><span className="font-bold text-surface-700">3 مرات</span></div>
            </div>
          </div>
          <div className="card p-5">
            <SectionTitle>معلومات الجهاز</SectionTitle>
            <div className="space-y-1 text-xs">
              <Row label="Device Model" value="Samsung Galaxy S23" />
              <Row label="OS"           value="Android 14" />
              <Row label="App Version"  value="10.2.1" />
              <Row label="Data Center"  value="DC2" />
            </div>
          </div>
        </div>
        <div className="card p-5 space-y-2">
          <SectionTitle>أزرار الإجراءات</SectionTitle>
          <Button className="w-full" onClick={() => push(["proxy"])}>🌐 تغيير البروكسي</Button>
          <Button className="w-full" onClick={() => push(["accounts","warmup"])}>🔥 تسخين هذا الحساب</Button>
          <Button variant="primary" className="w-full" onClick={doVerify} disabled={verifying}>
            {verifying ? "🔍 جاري التحقق..." : "✅ التحقق من الحساب"}
          </Button>
          {verifyResult && <Alert tone="success" title={`نتيجة: ${verifyResult}`} />}
          <Button className="w-full" onClick={() => push(["accounts","activity"])}>📋 سجل نشاط هذا الحساب</Button>
          <Button className="w-full" onClick={() => show("تم تصدير ملف .session")}>💾 تصدير .session</Button>
          <Button className="w-full" onClick={() => show("تم تصدير String Session")}>🔑 تصدير String Session</Button>
          <Button className="w-full" onClick={doRefresh} disabled={refreshing}>
            {refreshing ? "🔄 جاري جلب المعلومات من تيليجرام..." : "🔄 تحديث معلومات الحساب"}
          </Button>
          <Button className="w-full" onClick={() => push(["accounts","settings-ind"])}>⚙️ إعدادات خاصة بهذا الحساب</Button>
          <Button variant="danger" className="w-full" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirmDel(true)}>❌ حذف هذا الحساب</Button>
          <Button className="w-full" onClick={() => push(["accounts","list"])}>🔙 رجوع للقائمة</Button>
        </div>
      </div>
      <ConfirmDialog open={confirmDel} danger title="حذف الحساب" message={`سيتم حذف ${acc0.phone} نهائياً.`}
        onConfirm={() => { setConfirmDel(false); show("تم حذف الحساب"); push(["accounts","list"]); }}
        onCancel={() => setConfirmDel(false)} />
      {node}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-surface-100 py-2">
      <span className="text-xs font-semibold text-surface-500">{label}</span>
      <span className="text-sm font-medium text-surface-700">{value}</span>
    </div>
  );
}

/* ── ValidateAccounts ── */
function ValidateAccounts() {
  const { push } = useNav();
  const [mode, setMode] = useState<"menu"|"all"|"selected">("menu");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const { show, node } = useToast();

  const start = () => {
    setRunning(true); setProgress(0); setDone(false);
    const t = setInterval(() => { setProgress((p) => { if (p >= 100) { clearInterval(t); setRunning(false); setDone(true); return 100; } return p + 8; }); }, 120);
  };

  if (mode === "menu") {
    return (
      <div className="animate-fade">
        <PageHeader title="التحقق من الصحة" subtitle="فحص الحسابات" icon={<ShieldCheck className="h-5 w-5" />} />
        <div className="mx-auto max-w-lg space-y-3">
          <OptionButton label="✅ فحص جميع الحسابات" desc={`${accounts.length} حساب`} onClick={() => setMode("all")} />
          <OptionButton label="✅ فحص حسابات محددة" desc="اختر الحسابات"            onClick={() => setMode("selected")} />
        </div>
      </div>
    );
  }
  if (mode === "selected" && !running && !done) {
    return (
      <div className="animate-fade">
        <PageHeader title="اختر الحسابات للفحص" icon={<ShieldCheck className="h-5 w-5" />} />
        <div className="card p-5 space-y-2">
          {accounts.map((a) => (
            <Checkbox key={a.id} label={`${a.name} — ${a.phone}`}
              checked={selected.includes(a.id)} onChange={() => setSelected((s) => s.includes(a.id)?s.filter(x=>x!==a.id):[...s,a.id])} />
          ))}
          <div className="flex gap-2 pt-2">
            <Button variant="primary" className="flex-1" disabled={selected.length===0} onClick={start}>✅ بدء الفحص</Button>
            <Button onClick={() => setMode("menu")}>إلغاء</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade">
      <PageHeader title="التحقق من الصحة" icon={<ShieldCheck className="h-5 w-5" />} />
      <div className="mx-auto max-w-lg card p-6 space-y-4">
        {!running && !done && <Button variant="primary" className="w-full" onClick={start}>🔄 بدء التحقق ({mode==="all"?accounts.length:selected.length} حساب)</Button>}
        {running && (
          <div>
            <Progress value={progress} label={`🔄 جاري التحقق... [${Math.floor(progress/8)}/12]`} sub={`${progress}%`} tone="accent" />
            <div className="mt-2 flex gap-2 text-xs text-surface-500">
              <span className="chip bg-brand-50 text-brand-700 ring-1 ring-brand-200">✅نشط: {Math.floor(progress/15)}</span>
              <span className="chip bg-danger-50 text-danger-700 ring-1 ring-danger-200">⛔محظور: 0</span>
              <span className="chip bg-warn-50 text-warn-700 ring-1 ring-warn-200">⚠️مقيد: 0</span>
            </div>
            <div className="mt-4 flex gap-2"><Button variant="warn" className="flex-1" onClick={() => { setRunning(false); setProgress(0); }}>⏹ إيقاف</Button></div>
          </div>
        )}
        {done && (
          <div className="space-y-4">
            <Alert tone="success" title="اكتمل التحقق">
              <div className="mt-2 flex gap-3">
                <span className="chip bg-brand-50 text-brand-700 ring-1 ring-brand-200">✅نشط: 9</span>
                <span className="chip bg-danger-50 text-danger-700 ring-1 ring-danger-200">⛔محظور: 2</span>
                <span className="chip bg-warn-50 text-warn-700 ring-1 ring-warn-200">⚠️مقيد: 1</span>
              </div>
            </Alert>
            <Table columns={["حساب","حالة","السبب","آخر فحص"]} rows={[
              ["+966501234567", <StatusChip status="active" />,     "—",           "الآن"],
              ["+966574567890", <StatusChip status="blocked" />,    "حظر دائم",    "الآن"],
              ["+966563456789", <StatusChip status="restricted" />, "تقييد مؤقت", "الآن"],
            ]} />
            <div className="flex gap-2">
              <Button variant="danger" className="flex-1" onClick={() => push(["accounts","auto-remove"])}>🗑 إزالة المحظورة تلقائياً</Button>
              <Button onClick={() => show("تم تصدير التقرير")}>📊 عرض التقرير</Button>
            </div>
          </div>
        )}
      </div>
      {node}
    </div>
  );
}

/* ── RemoveAccount ── */
function RemoveAccount() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [tab, setTab]     = useState<"inactive"|"old"|"specific">("specific");
  const [val, setVal]     = useState("");
  const [days, setDays]   = useState<"30"|"60"|"90"|"custom">("30");
  const [customDays, setCustomDays] = useState("45");
  const [confirm, setConfirm] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [found, setFound] = useState<number|null>(null);

  return (
    <div className="animate-fade">
      <PageHeader title="إدارة الحسابات غير النشطة" icon={<Trash2 className="h-5 w-5" />} />
      <div className="mx-auto max-w-lg space-y-4">
        <Tabs tabs={[{id:"specific",label:"حذف محدد"},{id:"old",label:"تنظيف القديمة"},{id:"inactive",label:"إزالة المحظورة"}]}
          active={tab} onChange={(v)=>setTab(v as typeof tab)} />
        {tab === "specific" && (
          <div className="card p-6 space-y-4">
            <Field label="رقم الحساب أو الهاتف" placeholder="+9665XXXXXXXX" value={val} onChange={setVal} />
            <div className="flex gap-2">
              <Button variant="danger" className="flex-1" disabled={!val} onClick={() => setConfirm(true)}>❌ حذف هذا الحساب</Button>
              <Button onClick={() => push(["accounts"])}>إلغاء</Button>
            </div>
          </div>
        )}
        {tab === "old" && (
          <div className="card p-6 space-y-4">
            <SectionTitle>🧹 تنظيف الحسابات القديمة</SectionTitle>
            <div className="grid gap-2">
              <OptionButton label="لم يُستخدم منذ أكثر من 30 يوم"  selected={days==="30"}     onClick={() => setDays("30")} />
              <OptionButton label="لم يُستخدم منذ أكثر من 60 يوم"  selected={days==="60"}     onClick={() => setDays("60")} />
              <OptionButton label="لم يُستخدم منذ أكثر من 90 يوم"  selected={days==="90"}     onClick={() => setDays("90")} />
              <OptionButton label="✏️ مخصص"                        selected={days==="custom"} onClick={() => setDays("custom")} />
            </div>
            {days==="custom" && <InlineEdit label="عدد الأيام" value={customDays} onSave={setCustomDays} placeholder="45" />}
            {!scanning && found===null && (
              <Button variant="primary" className="w-full" onClick={() => { setScanning(true); setTimeout(()=>{ setScanning(false); setFound(2); },1500); }}>🔍 بحث عن حسابات قديمة</Button>
            )}
            {scanning && <Progress value={60} label="جاري البحث..." sub="60%" tone="accent" />}
            {found !== null && (
              <div className="space-y-3">
                <Alert tone="warn" title={`وُجد: ${found} حساب غير نشط`} />
                <div className="flex gap-2">
                  <Button variant="danger" className="flex-1" onClick={() => { show("تم الحذف"); setFound(null); }}>✅ تأكيد الحذف</Button>
                  <Button onClick={() => setFound(null)}>❌ إلغاء</Button>
                </div>
              </div>
            )}
          </div>
        )}
        {tab === "inactive" && <AutoRemove inline />}
      </div>
      <ConfirmDialog open={confirm} danger title="تأكيد حذف الحساب" message={`سيتم حذف ${val} نهائياً.`}
        onConfirm={() => { setConfirm(false); show("تم حذف الحساب"); push(["accounts","list"]); }}
        onCancel={() => setConfirm(false)} />
      {node}
    </div>
  );
}

/* ── AutoRemove ── */
function AutoRemove({ inline }: { inline?: boolean }) {
  const { push } = useNav();
  const { show, node } = useToast();
  const [scanning, setScanning] = useState(false);
  const [found, setFound] = useState<number|null>(null);
  const [confirm, setConfirm] = useState(false);

  const content = (
    <div className="space-y-4">
      {!scanning && found === null && <Button variant="primary" className="w-full" onClick={() => { setScanning(true); setTimeout(() => { setScanning(false); setFound(2); }, 1500); }}>🔍 بدء الكشف</Button>}
      {scanning && <Progress value={70} label="🔍 جاري الكشف..." sub="70%" tone="accent" />}
      {found !== null && (
        <div className="space-y-4">
          <Alert tone="warn" title={`وُجد: ${found} حساب محظور/مقيد`} />
          <div className="flex gap-2">
            <Button variant="danger" className="flex-1" onClick={() => setConfirm(true)}>✅ تأكيد الإزالة</Button>
            <Button onClick={() => { setFound(null); if (!inline) push(["accounts"]); }}>إلغاء</Button>
          </div>
        </div>
      )}
      <ConfirmDialog open={confirm} danger title="إزالة المحظورة" message={`سيتم إزالة ${found} حساب نهائياً.`}
        onConfirm={() => { setConfirm(false); setFound(null); show("تمت الإزالة"); }}
        onCancel={() => setConfirm(false)} />
      {node}
    </div>
  );

  if (inline) return content;
  return (
    <div className="animate-fade">
      <PageHeader title="إزالة تلقائية للمحظورة" icon={<Zap className="h-5 w-5" />} />
      <div className="mx-auto max-w-lg card p-6">{content}</div>
    </div>
  );
}

/* ── ExportSessions ── */
function ExportSessions() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [scope, setScope]   = useState<"all"|"selected"|"group">("all");
  const [format, setFormat] = useState<"session"|"string"|"zip">("session");
  const [zipPass, setZipPass]   = useState("");
  const [usePass, setUsePass]   = useState(false);
  const [path, setPath]         = useState("./exports/");
  const [exporting, setExporting] = useState(false);
  const [done, setDone]         = useState(false);

  return (
    <div className="animate-fade">
      <PageHeader title="تصدير واستيراد (Backup & Restore)" icon={<Archive className="h-5 w-5" />} />
      <div className="mx-auto max-w-lg space-y-4">
        <div className="card p-5 space-y-3">
          <SectionTitle>نطاق التصدير</SectionTitle>
          <OptionButton label="📁 تصدير جميع الجلسات"  selected={scope==="all"}      onClick={() => setScope("all")} />
          <OptionButton label="✋ تحديد جلسات معينة"    selected={scope==="selected"} onClick={() => setScope("selected")} />
          <OptionButton label="👥 تصدير مجموعة كاملة"  selected={scope==="group"}    onClick={() => setScope("group")} />
        </div>
        <div className="card p-5 space-y-3">
          <SectionTitle>صيغة التصدير</SectionTitle>
          <OptionButton label="💾 ملفات .session"             selected={format==="session"} onClick={() => setFormat("session")} />
          <OptionButton label="🔑 String Sessions (ملف نصي)" selected={format==="string"}  onClick={() => setFormat("string")} />
          <OptionButton label="📦 ZIP مضغوط"                 selected={format==="zip"}     onClick={() => setFormat("zip")} />
          {format==="zip" && (
            <div className="space-y-2">
              <Checkbox label="تشفير الملف بكلمة مرور" checked={usePass} onChange={setUsePass} />
              {usePass && <Field label="كلمة المرور" type="password" placeholder="••••••••" value={zipPass} onChange={setZipPass} />}
            </div>
          )}
        </div>
        <div className="card p-5 space-y-3">
          <InlineEdit label="مسار مجلد التصدير" value={path} onSave={setPath} placeholder="./exports/" />
          {!exporting && !done && (
            <Button variant="primary" className="w-full" onClick={() => { setExporting(true); setTimeout(() => { setExporting(false); setDone(true); }, 1800); }}>✅ بدء التصدير</Button>
          )}
          {exporting && <Progress value={80} label="📦 جاري التصدير..." sub="80%" />}
          {done && (
            <div className="space-y-3">
              <Alert tone="success" title="✅ تم التصدير — تم إرسال الملف كمرفق" />
              <div className="flex gap-2">
                <Button onClick={() => { setDone(false); }}>تصدير آخر</Button>
                <Button onClick={() => push(["accounts"])}>رجوع</Button>
              </div>
            </div>
          )}
        </div>
        <div className="card p-5">
          <SectionTitle>📊 تصدير بيانات الحسابات (بدون جلسات)</SectionTitle>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => show("تم تصدير CSV")}>📊 CSV</Button>
            <Button className="flex-1" onClick={() => show("تم تصدير PDF")}>📄 PDF</Button>
          </div>
        </div>
      </div>
      {node}
    </div>
  );
}

/* ── WarmupAccounts ── */
function WarmupAccounts() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [target, setTarget] = useState<"new"|"selected"|"group">("new");
  const [selected, setSelected] = useState<number[]>([]);
  const [actions, setActions] = useState({
    channels: true, messages: true, views: false, profile: true,
    contacts: false, likes: false, rename: false, reply: false,
  });
  const [duration, setDuration] = useState<"1"|"3"|"7"|"14"|"custom">("7");
  const [customDays, setCustomDays] = useState("10");
  const [intensity, setIntensity] = useState<"light"|"medium"|"intensive">("medium");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);

  const start = () => {
    setRunning(true); setProgress(0); setPaused(false);
    const t = setInterval(() => { setProgress((p) => { if (p >= 100) { clearInterval(t); setRunning(false); show("✅ اكتملت التهيئة"); return 100; } return p + 4; }); }, 100);
  };

  return (
    <div className="animate-fade">
      <PageHeader title="تهيئة الحسابات (تسخين)" icon={<Flame className="h-5 w-5" />} />
      {!running && progress === 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card p-5 space-y-3">
            <SectionTitle>الحسابات المستهدفة</SectionTitle>
            <OptionButton label="🔥 تسخين جميع الجديدة"    selected={target==="new"}      onClick={() => setTarget("new")} />
            <OptionButton label="✋ تحديد حسابات معينة"     selected={target==="selected"} onClick={() => setTarget("selected")} />
            <OptionButton label="👥 تسخين مجموعة كاملة"    selected={target==="group"}    onClick={() => setTarget("group")} />
            {target==="selected" && (
              <div className="space-y-2 pt-1">
                {accounts.map((a) => (
                  <Checkbox key={a.id} label={`${a.name} — ${a.phone}`}
                    checked={selected.includes(a.id)}
                    onChange={() => setSelected((s) => s.includes(a.id)?s.filter(x=>x!==a.id):[...s,a.id])} />
                ))}
              </div>
            )}
            <SectionTitle>إجراءات التسخين</SectionTitle>
            <Checkbox label="الانضمام لقنوات مشهورة عشوائية"    checked={actions.channels}  onChange={(v) => setActions({...actions,channels:v})} />
            <Checkbox label="إرسال رسائل عشوائية بين الحسابات"  checked={actions.messages}  onChange={(v) => setActions({...actions,messages:v})} />
            <Checkbox label="مشاهدة الرسائل في المجموعات"        checked={actions.views}     onChange={(v) => setActions({...actions,views:v})} />
            <Checkbox label="تغيير الصورة والسيرة الذاتية"        checked={actions.profile}   onChange={(v) => setActions({...actions,profile:v})} />
            <Checkbox label="إضافة جهات اتصال عشوائية"           checked={actions.contacts}  onChange={(v) => setActions({...actions,contacts:v})} />
            <Checkbox label="الإعجاب بالمنشورات عشوائياً"         checked={actions.likes}     onChange={(v) => setActions({...actions,likes:v})} />
            <Checkbox label="تغيير الاسم تدريجياً"                checked={actions.rename}    onChange={(v) => setActions({...actions,rename:v})} />
            <Checkbox label="رد على رسائل عشوائية"                checked={actions.reply}     onChange={(v) => setActions({...actions,reply:v})} />
          </div>
          <div className="card p-5 space-y-3">
            <SectionTitle>مدة التسخين</SectionTitle>
            <OptionButton label="🟢 خفيفة — يوم واحد"             selected={duration==="1"}      onClick={() => setDuration("1")} />
            <OptionButton label="🟡 متوسطة — 3 أيام"              selected={duration==="3"}      onClick={() => setDuration("3")} />
            <OptionButton label="⭐ مكثفة — 7 أيام (موصى)"
              badge={<span className="chip bg-brand-50 text-brand-700 ring-1 ring-brand-200">موصى</span>}
              selected={duration==="7"}      onClick={() => setDuration("7")} />
            <OptionButton label="🔴 احترافية — 14 يوم"            selected={duration==="14"}     onClick={() => setDuration("14")} />
            <OptionButton label="✏️ مدة مخصصة"                   selected={duration==="custom"} onClick={() => setDuration("custom")} />
            {duration==="custom" && <InlineEdit label="عدد الأيام" value={customDays} onSave={setCustomDays} placeholder="10" />}
            <SectionTitle>شدة التسخين (النشاط اليومي)</SectionTitle>
            <OptionButton label="🐢 خفيف (5-10 إجراءات/يوم)"     selected={intensity==="light"}     onClick={() => setIntensity("light")} />
            <OptionButton label="⭐🚶 متوسط (20-30 إجراء/يوم)"   selected={intensity==="medium"}    onClick={() => setIntensity("medium")} />
            <OptionButton label="🏃 مكثف (50-80 إجراء/يوم)"      selected={intensity==="intensive"} onClick={() => setIntensity("intensive")} />
            <div className="pt-3 flex gap-2">
              <Button variant="primary" className="flex-1" icon={<Flame className="h-4 w-4" />} onClick={start}>✅ بدء التسخين</Button>
              <Button onClick={() => push(["accounts"])}>إلغاء</Button>
            </div>
          </div>
        </div>
      )}
      {(running || progress > 0) && (
        <div className="mx-auto max-w-lg card p-6 space-y-4">
          <Progress value={progress} label={running?"🔥 جاري التسخين...":"✅ اكتمل التسخين"} sub={`${progress}%`} tone="warn" />
          {running && (
            <div className="text-xs text-surface-500 space-y-1">
              <div>الحساب الحالي: +966501234567</div>
              <div>الإجراء الحالي: الانضمام لقناة</div>
              <div>درجة الصحة: 65% ──► 73%</div>
            </div>
          )}
          {progress === 100 && (
            <Alert tone="success" title="✅ اكتمل التسخين — درجة الصحة الجديدة: 87%" />
          )}
          <div className="flex gap-2">
            {running && !paused && <Button variant="warn" className="flex-1" onClick={() => setPaused(true)}>⏸️ إيقاف مؤقت</Button>}
            {running && paused   && <Button variant="primary" className="flex-1" onClick={() => setPaused(false)}>▶️ استئناف</Button>}
            {running && <Button variant="danger" onClick={() => { setRunning(false); setProgress(0); }}>⏹️ إيقاف وحفظ</Button>}
            {!running && progress===100 && (
              <div className="flex gap-2 w-full">
                <Button className="flex-1" onClick={() => show("تم تصدير تقرير التسخين")}>📊 عرض تقرير التسخين</Button>
                <Button className="flex-1" onClick={() => { setProgress(0); }}>🔙 رجوع</Button>
              </div>
            )}
          </div>
        </div>
      )}
      {node}
    </div>
  );
}

/* ── AccountPools ── */
function AccountPools() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [view, setView] = useState<"list"|"create"|"detail">("list");
  const [selectedPool, setSelectedPool] = useState<string|null>(null);
  const [poolName, setPoolName] = useState("");
  const [poolDesc, setPoolDesc] = useState("");
  const [poolPurpose, setPoolPurpose] = useState<"gather"|"add"|"dm"|"campaign"|"multi">("multi");
  const [confirmDel, setConfirmDel] = useState(false);

  const mockPools = [
    { name:"مجموعة A", count:4, active:3, purpose:"تجميع+إضافة" },
    { name:"مجموعة B", count:2, active:2, purpose:"تجميع فقط"   },
    { name:"مجموعة C", count:3, active:1, purpose:"متعدد الأغراض"},
  ];

  if (view === "create") {
    return (
      <div className="animate-fade">
        <PageHeader title="إنشاء مجموعة جديدة" icon={<LayersIcon className="h-5 w-5" />} />
        <div className="mx-auto max-w-lg card p-6 space-y-4">
          <Field label="اسم المجموعة" placeholder="مجموعة D" value={poolName} onChange={setPoolName} />
          <Field label="وصف المجموعة (اختياري)" placeholder="وصف..." value={poolDesc} onChange={setPoolDesc} />
          <SectionTitle>الغرض الرئيسي للمجموعة</SectionTitle>
          <OptionButton label="📥 تجميع فقط"              selected={poolPurpose==="gather"}   onClick={() => setPoolPurpose("gather")} />
          <OptionButton label="📤 إضافة فقط"              selected={poolPurpose==="add"}      onClick={() => setPoolPurpose("add")} />
          <OptionButton label="💬 رسائل فقط"              selected={poolPurpose==="dm"}       onClick={() => setPoolPurpose("dm")} />
          <OptionButton label="📢 حملات قروبات فقط"      selected={poolPurpose==="campaign"} onClick={() => setPoolPurpose("campaign")} />
          <OptionButton label="🔀 متعدد الأغراض"          selected={poolPurpose==="multi"}    onClick={() => setPoolPurpose("multi")} />
          <div className="flex gap-2 pt-2">
            <Button variant="primary" className="flex-1" disabled={!poolName} onClick={() => { show("تم إنشاء المجموعة"); setView("list"); setPoolName(""); }}>💾 حفظ المجموعة</Button>
            <Button onClick={() => setView("list")}>❌ إلغاء</Button>
          </div>
        </div>
        {node}
      </div>
    );
  }

  if (view === "detail" && selectedPool) {
    const pool = mockPools.find(p=>p.name===selectedPool)!;
    const poolAccounts = accounts.slice(0,pool.count);
    const [addMode, setAddMode] = useState(false);
    const [toAdd, setToAdd]     = useState<number[]>([]);
    const [toRemove, setToRemove] = useState<number[]>([]);
    return (
      <div className="animate-fade">
        <PageHeader title={`مجموعة: ${pool.name}`} icon={<LayersIcon className="h-5 w-5" />} />
        <div className="space-y-4">
          <div className="card p-5">
            <div className="mb-3 flex flex-wrap gap-2 text-xs text-surface-500">
              <span>الاسم: {pool.name}</span>
              <span>الغرض: {pool.purpose}</span>
              <span>الحسابات: {pool.count}</span>
            </div>
            <Table columns={["#","اسم","هاتف","حالة"]} rows={poolAccounts.map((a,i)=>[
              String(i+1), a.name, a.phone, <StatusChip status={a.status} />
            ])} />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Button className="w-full" onClick={() => setAddMode(!addMode)}>➕ إضافة حسابات للمجموعة</Button>
            <Button className="w-full" onClick={() => show("تم تعديل المجموعة")}>✏️ تعديل الاسم/الغرض</Button>
            <Button variant="danger" className="w-full" onClick={() => setConfirmDel(true)}>🗑️ حذف المجموعة</Button>
          </div>
          {addMode && (
            <div className="card p-4 space-y-2">
              <SectionTitle>اختر الحسابات للإضافة</SectionTitle>
              {accounts.slice(pool.count).map((a) => (
                <Checkbox key={a.id} label={`${a.name} — ${a.phone}`}
                  checked={toAdd.includes(a.id)}
                  onChange={() => setToAdd((s)=>s.includes(a.id)?s.filter(x=>x!==a.id):[...s,a.id])} />
              ))}
              <Button variant="primary" disabled={toAdd.length===0} onClick={() => { show(`تم إضافة ${toAdd.length} حساب`); setAddMode(false); setToAdd([]); }}>✅ إضافة المحدد</Button>
            </div>
          )}
          <Button onClick={() => setView("list")}>🔙 رجوع</Button>
        </div>
        <ConfirmDialog open={confirmDel} danger title="حذف المجموعة" message={`سيتم حذف مجموعة "${pool.name}" نهائياً.`}
          onConfirm={() => { setConfirmDel(false); show("تم حذف المجموعة"); setView("list"); }}
          onCancel={() => setConfirmDel(false)} />
        {node}
      </div>
    );
  }

  return (
    <div className="animate-fade">
      <PageHeader title="مجموعات الحسابات (Account Pools)" icon={<LayersIcon className="h-5 w-5" />} />
      <div className="space-y-4">
        <Button variant="primary" onClick={() => setView("create")}>➕ إنشاء مجموعة جديدة</Button>
        <Table columns={["اسم","عدد","نشط","الغرض",""]} rows={mockPools.map((p) => [
          p.name, String(p.count), String(p.active), p.purpose,
          <Button onClick={() => { setSelectedPool(p.name); setView("detail"); }}>إدارة</Button>,
        ])} />
      </div>
      {node}
    </div>
  );
}

/* ── HealthScore ── */
function HealthScore() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [calculating, setCalculating] = useState(false);
  const [showWeak, setShowWeak]       = useState(false);

  const healthData = accounts.map((a,i) => ({ ...a, score: 87 - i*8 }));
  const weak = healthData.filter(a=>a.score<70);

  return (
    <div className="animate-fade">
      <PageHeader title="درجة صحة الحسابات (Health Score)" icon={<Heart className="h-5 w-5" />} />
      <div className="space-y-4">
        <div className="card p-5">
          <SectionTitle>📊 شرح نظام الدرجات</SectionTitle>
          <div className="grid gap-2 text-sm">
            <div className="flex gap-2"><span className="chip bg-brand-50 text-brand-700 ring-1 ring-brand-200">🟢 90-100%</span><span>ممتاز — حساب آمن تماماً</span></div>
            <div className="flex gap-2"><span className="chip bg-brand-50 text-brand-700 ring-1 ring-brand-200">🟡 70-89%</span><span>جيد — يعمل بشكل طبيعي</span></div>
            <div className="flex gap-2"><span className="chip bg-warn-50 text-warn-700 ring-1 ring-warn-200">🟠 50-69%</span><span>متوسط — يحتاج تسخين</span></div>
            <div className="flex gap-2"><span className="chip bg-danger-50 text-danger-700 ring-1 ring-danger-200">🔴 &lt;50%</span><span>ضعيف — خطر استخدامه</span></div>
          </div>
        </div>
        <div className="card p-5">
          <SectionTitle>عوامل حساب الدرجة</SectionTitle>
          <div className="grid gap-2 sm:grid-cols-2 text-xs text-surface-600">
            <span>✅ عمر الحساب (20%)</span>
            <span>✅ نشاط سابق (20%)</span>
            <span>✅ عدد FloodWaits (15%)</span>
            <span>✅ عدد القروبات المنضم لها (15%)</span>
            <span>✅ هل لديه صورة وبيو (10%)</span>
            <span>✅ عدد جهات الاتصال (10%)</span>
            <span>✅ سجل الإجراءات الأخيرة (10%)</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="primary" className="flex-1" disabled={calculating}
            onClick={() => { setCalculating(true); setTimeout(()=>{ setCalculating(false); show("✅ تم تحديث جميع الدرجات"); },2000); }}>
            {calculating ? "⏳ جاري الحساب..." : "🔄 إعادة حساب الدرجات الآن"}
          </Button>
          <Button onClick={() => setShowWeak(!showWeak)}>⚠️ الحسابات الضعيفة فقط</Button>
        </div>
        {showWeak && weak.length > 0 && (
          <div className="card p-4 space-y-3">
            <Alert tone="warn" title={`${weak.length} حسابات أقل من 70%`} />
            <Table columns={["اسم","هاتف","الدرجة"]} rows={weak.map((a)=>[
              a.name, a.phone,
              <span className="chip bg-warn-50 text-warn-700 ring-1 ring-warn-200">{a.score}%</span>
            ])} />
            <Button variant="primary" className="w-full" onClick={() => push(["accounts","warmup"])}>🔥 تسخين جميع الضعيفة</Button>
          </div>
        )}
        <Table columns={["اسم","هاتف","الدرجة","التقييم"]} rows={healthData.map((a) => [
          a.name, a.phone,
          <div className="min-w-[120px]"><Progress value={a.score} tone={a.score>=90?"brand":a.score>=70?"brand":a.score>=50?"warn":"danger"} /></div>,
          <span className={`chip ring-1 ${a.score>=90?"bg-brand-50 text-brand-700 ring-brand-200":a.score>=70?"bg-brand-50 text-brand-700 ring-brand-200":a.score>=50?"bg-warn-50 text-warn-700 ring-warn-200":"bg-danger-50 text-danger-700 ring-danger-200"}`}>
            {a.score>=90?"ممتاز":a.score>=70?"جيد":a.score>=50?"متوسط":"ضعيف"}
          </span>,
        ])} />
      </div>
      {node}
    </div>
  );
}

/* ── IndividualSettings ── */
function IndividualSettings() {
  const { show, node } = useToast();
  const [selected, setSelected] = useState<number|null>(null);
  const [gatherLimit, setGatherLimit] = useState("500");
  const [addLimit, setAddLimit]       = useState("20");
  const [dmLimit, setDmLimit]         = useState("30");
  const [delayFrom, setDelayFrom]     = useState("60");
  const [delayTo, setDelayTo]         = useState("120");
  const [priority, setPriority]       = useState<"high"|"mid"|"low">("mid");
  const [perms, setPerms] = useState({ gather:true, add:true, dm:true, campaign:true, rotation:true });
  const [limitHours, setLimitHours]   = useState(false);
  const [fromH, setFromH]             = useState("08:00");
  const [toH, setToH]                 = useState("22:00");

  if (selected === null) {
    return (
      <div className="animate-fade">
        <PageHeader title="إعدادات فردية للحساب" icon={<Settings2 className="h-5 w-5" />} />
        <div className="space-y-2">
          {accounts.map((a) => (
            <OptionButton key={a.id} label={`${a.name} — ${a.phone}`} desc={a.status} onClick={() => setSelected(a.id)} />
          ))}
        </div>
      </div>
    );
  }

  const acc = accounts.find(a=>a.id===selected)!;
  return (
    <div className="animate-fade">
      <PageHeader title={`إعدادات: ${acc.name}`} subtitle={acc.phone} icon={<Settings2 className="h-5 w-5" />} />
      <div className="space-y-4">
        <div className="card p-5 space-y-3">
          <SectionTitle>الحدود اليومية الخاصة</SectionTitle>
          <InlineEdit label={`📥 حد التجميع اليومي [افتراضي: 500]`} value={gatherLimit} onSave={setGatherLimit} placeholder="500" />
          <InlineEdit label={`📤 حد الإضافة اليومي [افتراضي: 20]`}  value={addLimit}    onSave={setAddLimit}    placeholder="20" />
          <InlineEdit label={`💬 حد الرسائل اليومي [افتراضي: 30]`}  value={dmLimit}     onSave={setDmLimit}     placeholder="30" />
          <div className="flex gap-2">
            <InlineEdit label="⏱️ التأخير من (ث)" value={delayFrom} onSave={setDelayFrom} placeholder="60" />
            <InlineEdit label="إلى (ث)"           value={delayTo}   onSave={setDelayTo}   placeholder="120" />
          </div>
        </div>
        <div className="card p-5 space-y-3">
          <SectionTitle>الأولوية في التدوير</SectionTitle>
          <OptionButton label="🔴 عالية (يُستخدم أولاً)"   selected={priority==="high"} onClick={() => setPriority("high")} />
          <OptionButton label="🟡 متوسطة (افتراضي)"        selected={priority==="mid"}  onClick={() => setPriority("mid")} />
          <OptionButton label="🟢 منخفضة (احتياطي)"        selected={priority==="low"}  onClick={() => setPriority("low")} />
        </div>
        <div className="card p-5 space-y-3">
          <SectionTitle>القيود الخاصة</SectionTitle>
          <Checkbox label="استخدامه في التجميع"         checked={perms.gather}   onChange={(v)=>setPerms({...perms,gather:v})} />
          <Checkbox label="استخدامه في الإضافة"         checked={perms.add}      onChange={(v)=>setPerms({...perms,add:v})} />
          <Checkbox label="استخدامه في الرسائل الجماعية" checked={perms.dm}       onChange={(v)=>setPerms({...perms,dm:v})} />
          <Checkbox label="استخدامه في حملات القروبات"  checked={perms.campaign} onChange={(v)=>setPerms({...perms,campaign:v})} />
          <Checkbox label="تفعيله في نظام التدوير"      checked={perms.rotation} onChange={(v)=>setPerms({...perms,rotation:v})} />
        </div>
        <div className="card p-5 space-y-3">
          <SectionTitle>ساعات العمل المسموحة</SectionTitle>
          <Checkbox label="تقييد ساعات العمل" checked={limitHours} onChange={setLimitHours} />
          {limitHours && (
            <div className="flex gap-2">
              <InlineEdit label="من الساعة" value={fromH} onSave={setFromH} placeholder="08:00" />
              <InlineEdit label="إلى الساعة" value={toH}  onSave={setToH}   placeholder="22:00" />
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="primary" className="flex-1" onClick={() => { show("💾 تم حفظ الإعدادات"); setSelected(null); }}>💾 حفظ الإعدادات</Button>
          <Button onClick={() => setSelected(null)}>🔙 رجوع</Button>
        </div>
      </div>
      {node}
    </div>
  );
}

/* ── ProfileManager ── */
function ProfileManager() {
  const { show, node } = useToast();
  const [mode, setMode] = useState<"list"|"single"|"bulk">("list");
  const [selected, setSelected] = useState<number|null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [uname, setUname]         = useState("");
  const [bio, setBio]             = useState("");
  const [saving, setSaving]       = useState(false);
  const [bulkSelected, setBulkSelected] = useState<number[]>([]);
  const [bulkChanges, setBulkChanges] = useState({ photos:false, names:false, bio:false });
  const [photoDir, setPhotoDir]   = useState("/photos/");
  const [namesFile, setNamesFile] = useState("/names.txt");
  const [bioFile, setBioFile]     = useState("/bios.txt");
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);

  if (mode === "single" && selected !== null) {
    const acc = accounts.find(a=>a.id===selected)!;
    return (
      <div className="animate-fade">
        <PageHeader title={`تعديل ملف: ${acc.name}`} icon={<Image className="h-5 w-5" />} />
        <div className="mx-auto max-w-lg card p-6 space-y-3">
          <SectionTitle>📸 صورة الملف الشخصي</SectionTitle>
          <div className="grid grid-cols-3 gap-2">
            <Button onClick={() => show("رفع صورة")}>📁 رفع صورة</Button>
            <Button onClick={() => show("مجلد صور")}>📂 من مجلد</Button>
            <Button variant="danger" onClick={() => show("تم حذف الصورة")}>❌ حذف الصورة</Button>
          </div>
          <Field label="✏️ الاسم الأول"    placeholder="الاسم"     value={firstName} onChange={setFirstName} />
          <Field label="✏️ اسم العائلة"   placeholder="العائلة"   value={lastName}  onChange={setLastName} />
          <Field label="✏️ @username"      placeholder="@username" value={uname}     onChange={setUname} />
          <Field label="✏️ السيرة الذاتية (Bio)" placeholder="Bio..." value={bio}  onChange={setBio} />
          <div className="flex gap-2 pt-2">
            <Button variant="primary" className="flex-1" disabled={saving}
              onClick={() => { setSaving(true); setTimeout(()=>{ setSaving(false); show("✅ تم التعديل بنجاح"); setMode("list"); },1500); }}>
              {saving ? "⏳ جاري التطبيق..." : "💾 حفظ التعديلات"}
            </Button>
            <Button onClick={() => setMode("list")}>🔙 رجوع</Button>
          </div>
        </div>
        {node}
      </div>
    );
  }

  if (mode === "bulk") {
    return (
      <div className="animate-fade">
        <PageHeader title="تعديل جماعي (Bulk Profile Edit)" icon={<Image className="h-5 w-5" />} />
        <div className="card p-5 space-y-3">
          <SectionTitle>اختر الحسابات</SectionTitle>
          {accounts.map((a) => (
            <Checkbox key={a.id} label={`${a.name} — ${a.phone}`}
              checked={bulkSelected.includes(a.id)}
              onChange={() => setBulkSelected(s=>s.includes(a.id)?s.filter(x=>x!==a.id):[...s,a.id])} />
          ))}
          <SectionTitle>ماذا تريد تغيير</SectionTitle>
          <Checkbox label="تغيير الصور (من مجلد عشوائي)" checked={bulkChanges.photos} onChange={(v)=>setBulkChanges({...bulkChanges,photos:v})} />
          {bulkChanges.photos && <InlineEdit label="مسار مجلد الصور" value={photoDir} onSave={setPhotoDir} placeholder="/photos/" />}
          <Checkbox label="تغيير الأسماء (من قائمة)"       checked={bulkChanges.names}  onChange={(v)=>setBulkChanges({...bulkChanges,names:v})} />
          {bulkChanges.names && <InlineEdit label="مسار ملف الأسماء" value={namesFile} onSave={setNamesFile} placeholder="/names.txt" />}
          <Checkbox label="تغيير البيو (من قائمة)"          checked={bulkChanges.bio}    onChange={(v)=>setBulkChanges({...bulkChanges,bio:v})} />
          {bulkChanges.bio && <InlineEdit label="مسار ملف البيو" value={bioFile} onSave={setBioFile} placeholder="/bios.txt" />}
          {!bulkRunning && bulkProgress===0 && (
            <Button variant="primary" className="w-full" disabled={bulkSelected.length===0}
              onClick={() => { setBulkRunning(true); const t=setInterval(()=>{ setBulkProgress(p=>{ if(p>=100){clearInterval(t);setBulkRunning(false);return 100;}return p+10; }); },150); }}>
              ✅ بدء التعديل الجماعي
            </Button>
          )}
          {bulkRunning && <Progress value={bulkProgress} label="🖼️ جاري التعديل..." sub={`${bulkProgress}%`} tone="accent" />}
          {bulkProgress===100 && <Alert tone="success" title="✅ اكتمل التعديل الجماعي" />}
          {!bulkRunning && <Button onClick={() => setMode("list")}>❌ إلغاء</Button>}
        </div>
        {node}
      </div>
    );
  }

  return (
    <div className="animate-fade">
      <PageHeader title="إدارة ملفات الشخصية (Profile Manager)" icon={<Image className="h-5 w-5" />} />
      <div className="space-y-3">
        <Button variant="primary" onClick={() => setMode("bulk")}>🔀 تعديل جماعي</Button>
        <Table columns={["اسم","هاتف","username",""]} rows={accounts.map((a) => [
          a.name, a.phone, a.username,
          <Button onClick={() => { setSelected(a.id); setMode("single"); }}>✏️ تعديل</Button>,
        ])} />
      </div>
      {node}
    </div>
  );
}

/* ── ActivityLog ── */
function ActivityLog() {
  const { show, node } = useToast();
  const [view, setView]     = useState<"all"|"single">("all");
  const [selected, setSelected] = useState<number|null>(null);
  const [typeFilter, setTypeFilter] = useState<"all"|"gather"|"add"|"dm"|"error">("all");
  const [dateFilter, setDateFilter] = useState<"today"|"7d"|"30d"|"custom">("7d");

  const mockLogs = [
    { time:"2026-07-01 14:32", acc:"+966501234567", type:"تجميع",   detail:"@market_sa", result:"15,340" },
    { time:"2026-07-01 12:00", acc:"+966552345678", type:"إضافة",   detail:"@my_group",  result:"250 ناجح" },
    { time:"2026-06-30 09:15", acc:"+966563456789", type:"خطأ",     detail:"FloodWait",  result:"تبديل" },
    { time:"2026-06-30 08:00", acc:"+966574567890", type:"رسائل",   detail:"DM حملة",    result:"300 مُرسل" },
  ];

  if (view === "single" && selected !== null) {
    const acc = accounts.find(a=>a.id===selected)!;
    return (
      <div className="animate-fade">
        <PageHeader title={`سجل: ${acc.name}`} icon={<Activity className="h-5 w-5" />} />
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="إجمالي تجميع" value="15,340" tone="accent" />
            <StatCard label="إجمالي إضافة" value="4,200"  tone="brand"  />
            <StatCard label="أخطاء"         value="12"     tone="danger" />
          </div>
          <div className="card p-4">
            <SectionTitle>نشاط آخر 7 أيام</SectionTitle>
            <div className="h-16 flex items-end gap-1">
              {[40,70,55,90,65,80,45].map((h,i)=>(
                <div key={i} className="flex-1 bg-brand-400 rounded-t" style={{height:`${h}%`}} />
              ))}
            </div>
          </div>
          <Table columns={["وقت","نوع","تفاصيل","نتيجة"]} rows={mockLogs.filter(l=>l.acc===acc.phone).map(l=>[l.time,l.type,l.detail,l.result])} />
          <div className="flex gap-2">
            <Button onClick={() => show("تم تصدير السجل")}>📤 تصدير (PDF/CSV)</Button>
            <Button onClick={() => setView("all")}>🔙 رجوع</Button>
          </div>
        </div>
        {node}
      </div>
    );
  }

  return (
    <div className="animate-fade">
      <PageHeader title="سجل نشاط الحسابات (Activity Log)" icon={<Activity className="h-5 w-5" />} />
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Tabs tabs={[{id:"all",label:"الكل"},{id:"gather",label:"تجميع"},{id:"add",label:"إضافة"},{id:"dm",label:"رسائل"},{id:"error",label:"أخطاء"}]}
            active={typeFilter} onChange={(v)=>setTypeFilter(v as typeof typeFilter)} />
          <Tabs tabs={[{id:"today",label:"اليوم"},{id:"7d",label:"7 أيام"},{id:"30d",label:"30 يوم"}]}
            active={dateFilter} onChange={(v)=>setDateFilter(v as typeof dateFilter)} />
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setView("single")}>📋 سجل حساب محدد</Button>
          <Button onClick={() => show("تم تصدير السجل")}>📤 تصدير (PDF/CSV)</Button>
        </div>
        {view === "single" && selected === null && (
          <div className="card p-4 space-y-2">
            {accounts.map((a) => (
              <OptionButton key={a.id} label={`${a.name} — ${a.phone}`} onClick={() => setSelected(a.id)} />
            ))}
          </div>
        )}
        <Table columns={["وقت","حساب","نوع","تفاصيل","نتيجة"]} rows={mockLogs.map((l) => [l.time,l.acc,l.type,l.detail,l.result])} />
      </div>
      {node}
    </div>
  );
}

/* ── AccountSecurity ── */
function AccountSecurity() {
  const { show, node } = useToast();
  const [tab, setTab]       = useState<"scan"|"sessions"|"2fa">("scan");
  const [scanning, setScanning] = useState(false);
  const [scanDone, setScanDone] = useState(false);
  const [selectedAcc, setSelectedAcc] = useState<number|null>(null);
  const [curPass, setCurPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confPass, setConfPass] = useState("");
  const [saving, setSaving]   = useState(false);

  return (
    <div className="animate-fade">
      <PageHeader title="أمان الحسابات (Account Security)" icon={<Lock className="h-5 w-5" />} />
      <div className="space-y-4">
        <Tabs tabs={[{id:"scan",label:"🛡️ فحص أمان"},{id:"sessions",label:"📱 الأجهزة"},{id:"2fa",label:"🔐 2FA"}]}
          active={tab} onChange={(v)=>setTab(v as typeof tab)} />

        {tab === "scan" && (
          <div className="card p-5 space-y-4">
            {!scanning && !scanDone && (
              <Button variant="primary" className="w-full" onClick={() => { setScanning(true); setTimeout(()=>{ setScanning(false); setScanDone(true); },2000); }}>
                🛡️ بدء فحص أمان شامل
              </Button>
            )}
            {scanning && (
              <div>
                <Progress value={70} label="🔍 جاري الفحص..." sub="70%" tone="accent" />
                <p className="mt-2 text-xs text-surface-500">يفحص: الجلسة | النشاط المشبوه | تسجيلات الدخول</p>
              </div>
            )}
            {scanDone && (
              <div className="space-y-3">
                <Table columns={["حساب","نتيجة","الجلسة","التوصية"]} rows={[
                  ["+966501234567","✅ آمن","سليمة","—"],
                  ["+966552345678","⚠️ مشبوه","نشاط غير معتاد","مراجعة"],
                  ["+966563456789","✅ آمن","سليمة","—"],
                ]} />
                <Button onClick={() => show("تم تصدير التقرير")}>📊 عرض التقرير المفصل</Button>
              </div>
            )}
          </div>
        )}

        {tab === "sessions" && (
          <div className="space-y-3">
            {selectedAcc === null ? (
              <div className="card p-4 space-y-2">
                <SectionTitle>اختر حساباً</SectionTitle>
                {accounts.map((a) => (
                  <OptionButton key={a.id} label={`${a.name} — ${a.phone}`} onClick={() => setSelectedAcc(a.id)} />
                ))}
              </div>
            ) : (
              <div className="card p-5 space-y-3">
                <SectionTitle>📱 الأجهزة المتصلة حالياً</SectionTitle>
                <Table columns={["جهاز","تطبيق","IP","آخر نشاط",""]} rows={[
                  ["iPhone 15","Telegram 10.0","185.12.45.10","الآن",     <Button variant="danger" onClick={()=>show("تم الإنهاء")}>❌ إنهاء</Button>],
                  ["Samsung S23","Telegram 9.8","94.21.10.5", "قبل ساعة", <Button variant="danger" onClick={()=>show("تم الإنهاء")}>❌ إنهاء</Button>],
                ]} />
                <div className="flex gap-2">
                  <Button variant="danger" className="flex-1" onClick={() => show("تم إنهاء جميع الجلسات")}>❌ إنهاء جميع الجلسات (عدا الحالية)</Button>
                  <Button onClick={() => setSelectedAcc(null)}>🔙 رجوع</Button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "2fa" && (
          <div className="space-y-3">
            {selectedAcc === null ? (
              <div className="card p-4 space-y-2">
                <SectionTitle>اختر حساباً</SectionTitle>
                {accounts.map((a) => (
                  <OptionButton key={a.id} label={`${a.name} — ${a.phone}`} onClick={() => setSelectedAcc(a.id)} />
                ))}
              </div>
            ) : (
              <div className="card p-5 space-y-3">
                <SectionTitle>🔐 تحديث كلمة مرور 2FA</SectionTitle>
                <Field label="كلمة المرور الحالية"   type="password" placeholder="••••••••" value={curPass} onChange={setCurPass} />
                <Field label="كلمة المرور الجديدة"   type="password" placeholder="••••••••" value={newPass} onChange={setNewPass} />
                <Field label="تأكيد كلمة المرور الجديدة" type="password" placeholder="••••••••" value={confPass} onChange={setConfPass} />
                <div className="flex gap-2">
                  <Button variant="primary" className="flex-1" disabled={saving||!curPass||!newPass||newPass!==confPass}
                    onClick={() => { setSaving(true); setTimeout(()=>{ setSaving(false); show("✅ تم تغيير كلمة المرور"); setSelectedAcc(null); setCurPass(""); setNewPass(""); setConfPass(""); },1500); }}>
                    {saving ? "⏳ جاري التغيير..." : "💾 تطبيق التغيير"}
                  </Button>
                  <Button onClick={() => setSelectedAcc(null)}>🔙 رجوع</Button>
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
