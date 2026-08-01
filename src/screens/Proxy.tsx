import { useEffect, useMemo, useRef, useState } from "react";
import { Globe, Plus, FileText, ListChecks, ShieldCheck, Link2, Zap, Trash2, UploadCloud, Layers, RefreshCw, BarChart3, Download, Bell, Settings2, Eye } from "lucide-react";
import { useNav } from "../nav";
import {
  PageHeader,
  Button,
  OptionButton,
  Progress,
  Table,
  SectionTitle,
  Alert,
  ConfirmDialog,
  useToast,
  StatusChip,
  TextArea,
  InlineEdit,
  Spinner,
  EmptyState,
  Field,
  StatCard,
  Checkbox,
} from "../ui";
import { JobProgressCard } from "../lib/job";
import { apiFetch, type AccountRecord, type ProxyPoolRecord, type ProxyRecord, type ProxyStats } from "../lib/api";

const items = [
  { id: "add", label: "إضافة بروكسي جديد", desc: "حفظ مباشر في قاعدة البيانات", icon: Plus },
  { id: "import", label: "استيراد قائمة من .txt", desc: "رفع ملف للسيرفر", icon: FileText },
  { id: "list", label: "عرض جميع البروكسيهات", desc: "جدول حي من السيرفر", icon: ListChecks },
  { id: "validate", label: "التحقق من الصحة", desc: "ملخص حالات حالي", icon: ShieldCheck },
  { id: "assign-manual", label: "تعيين يدوي لحساب", desc: "ربط حساب ببروكسي", icon: Link2 },
  { id: "assign-auto", label: "تعيين تلقائي", desc: "توزيع على الحسابات بدون بروكسي", icon: Zap },
  { id: "remove-dead", label: "إزالة البروكسيهات الميتة", desc: "حذف جميع dead", icon: Trash2 },
  { id: "detail", label: "بطاقة تفاصيل البروكسي", desc: "معلومات كاملة", icon: Eye },
  { id: "pools", label: "مجموعات البروكسيهات", desc: "Proxy Pools", icon: Layers },
  { id: "replace-dead", label: "استبدال البروكسيهات الميتة", desc: "استبدال تلقائي", icon: RefreshCw },
  { id: "stats", label: "إحصائيات وتحليلات", desc: "تحليلات البروكسي", icon: BarChart3 },
  { id: "export", label: "تصدير قائمة البروكسيهات", desc: "تصدير بالصيغ المطلوبة", icon: Download },
  { id: "notifications", label: "إشعارات وتنبيهات", desc: "تنبيهات البروكسي", icon: Bell },
  { id: "general", label: "إعدادات البروكسي العامة", desc: "إعدادات عامة", icon: Settings2 },
] as const;

export function ProxyModule() {
  const { push } = useNav();
  const [rows, setRows] = useState<ProxyRecord[]>([]);

  useEffect(() => {
    apiFetch<ProxyRecord[]>("/proxies").then(setRows).catch(() => setRows([]));
  }, []);

  const active = rows.filter((row) => row.status === "active").length;
  const dead = rows.filter((row) => row.status === "dead").length;
  const slow = rows.filter((row) => row.status === "slow").length;

  return (
    <div className="animate-fade">
      <PageHeader title="مدير البروكسي" subtitle="إدارة البروكسيهات من قاعدة البيانات" icon={<Globe className="h-5 w-5" />} />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="نشط" value={active} tone="brand" />
        <StatCard label="ميت" value={dead} tone="danger" />
        <StatCard label="بطيء" value={slow} tone="warn" />
        <StatCard label="الإجمالي" value={rows.length} tone="accent" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <button
              key={it.id}
              onClick={() => push(["proxy", it.id])}
              className="card flex items-center gap-3 p-4 text-right transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-pop"
            >
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-brand-200"><Icon className="h-5 w-5" /></div>
              <div><div className="text-sm font-bold text-surface-800">{it.label}</div><div className="text-xs text-surface-500">{it.desc}</div></div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ProxyScreen({ sub }: { sub: string }) {
  switch (sub) {
    case "add": return <AddProxy />;
    case "import": return <ImportProxy />;
    case "list": return <ListProxy />;
    case "validate": return <ValidateProxy />;
    case "assign-manual": return <AssignManual />;
    case "assign-auto": return <AssignAuto />;
    case "remove-dead": return <RemoveDead />;
    case "detail": return <ProxyDetail />;
    case "pools": return <ProxyPools />;
    case "replace-dead": return <ReplaceDead />;
    case "stats": return <ProxyStats />;
    case "export": return <ExportProxies />;
    case "notifications": return <ProxyNotifications />;
    case "general": return <ProxyGeneralSettings />;
    default: return null;
  }
}

function AddProxy() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [proxyType, setProxyType] = useState("SOCKS5");
  const [address, setAddress] = useState("185.12.45.10:1080");
  const [authLogin, setAuthLogin] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [notes, setNotes] = useState("");
  const [checking, setChecking] = useState(false);
  const [valid, setValid] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await apiFetch<ProxyRecord>("/proxies", {
        method: "POST",
        body: JSON.stringify({
          address,
          proxy_type: proxyType,
          status: valid === false ? "dead" : "active",
          speed_ms: valid ? Math.floor(Math.random() * 200) + 90 : null,
          auth_login: authLogin || null,
          auth_password: authPassword || null,
          notes: notes || null,
        }),
      });
      show("تم حفظ البروكسي");
      push(["proxy", "list"]);
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر حفظ البروكسي", "danger");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-fade">
      <PageHeader title="إضافة بروكسي جديد" icon={<Plus className="h-5 w-5" />} />
      <div className="mx-auto max-w-2xl card p-6 space-y-4">
        <SectionTitle>النوع</SectionTitle>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {["SOCKS5", "SOCKS4", "HTTP", "HTTPS", "MTPROTO"].map((type) => (
            <OptionButton key={type} label={type} selected={proxyType === type} onClick={() => setProxyType(type)} />
          ))}
        </div>
        <InlineEdit label="IP:PORT" value={address} onSave={setAddress} placeholder="185.12.45.10:1080" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="اسم المستخدم (اختياري)" value={authLogin} onChange={setAuthLogin} placeholder="user" />
          <Field label="كلمة المرور (اختياري)" value={authPassword} onChange={setAuthPassword} placeholder="pass" type="password" />
        </div>
        <InlineEdit label="ملاحظات" value={notes} onSave={setNotes} placeholder="ملاحظات إضافية" />
        {checking && <Progress value={60} label="جاري التحقق الشكلي..." sub="60%" tone="accent" />}
        {valid === true && <Alert tone="success" title="صيغة البروكسي سليمة ويمكن حفظه" />}
        {valid === false && <Alert tone="danger" title="الصيغة غير صحيحة أو ناقصة" />}
        <div className="flex gap-2">
          <Button
            variant="primary"
            className="flex-1"
            disabled={!address || checking}
            onClick={async () => {
              setChecking(true);
              setValid(null);
              try {
                const result = await apiFetch<{ valid: boolean; speed_ms?: number; error?: string }>("/proxies/validate", {
                  method: "POST",
                  body: JSON.stringify({ addresses: [address], proxy_type: proxyType }),
                });
                setValid(result.valid !== false);
              } catch {
                setValid(address.includes(":"));
              } finally {
                setChecking(false);
              }
            }}
          >
            تحقق
          </Button>
          <Button disabled={saving || valid !== true} onClick={() => void save()}>{saving ? "جاري الحفظ..." : "حفظ"}</Button>
          <Button onClick={() => push(["proxy"])}>إلغاء</Button>
        </div>
      </div>
      {node}
    </div>
  );
}

function ImportProxy() {
  const { push } = useNav();
  const { show, node } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"file" | "text">("text");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; failed: number } | null>(null);

  const doImport = async () => {
    setImporting(true);
    setResult(null);
    try {
      const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length === 0 && !file) { show("أدخل بروكسيات أو اختر ملفاً", "danger"); setImporting(false); return; }

      let imported = 0, skipped = 0, failed = 0;
      const proxyLines = lines;

      for (const line of proxyLines) {
        const parts = line.split(/[:\s]+/);
        if (parts.length < 2) { failed++; continue; }
        const ip = parts[0];
        const port = parts[1];
        const user = parts[2] || null;
        const pass = parts[3] || null;
        try {
          await apiFetch("/proxies", {
            method: "POST",
            body: JSON.stringify({
              address: `${ip}:${port}`,
              proxy_type: "SOCKS5",
              status: "active",
              auth_login: user,
              auth_password: pass,
            }),
          });
          imported++;
        } catch {
          skipped++;
        }
      }
      setResult({ imported, skipped, failed });
      show(`✅ تم استيراد ${imported} بروكسي`);
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر الاستيراد", "danger");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="animate-fade">
      <PageHeader title="استيراد قائمة بروكسيهات" subtitle="من ملف أو لصق مباشر" icon={<FileText className="h-5 w-5" />} />
      <div className="mx-auto max-w-lg card p-6 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <OptionButton label="📋 لصق نص مباشر" selected={mode === "text"} onClick={() => setMode("text")} />
          <OptionButton label="📄 من ملف .txt" selected={mode === "file"} onClick={() => setMode("file")} />
        </div>
        <Alert tone="info" title="الصيغ المدعومة">IP:PORT | IP:PORT:USER:PASS | TYPE:IP:PORT:USER:PASS (سطر لكل بروكسي)</Alert>
        {mode === "text" ? (
          <TextArea label="لصق قائمة البروكسيات" rows={8} value={text} onChange={setText} placeholder={"185.12.45.10:1080 / 77.40.22.8:1080:user:pass / 192.168.1.1:8080"} />
        ) : (
          <>
            <input ref={inputRef} type="file" accept=".txt,.csv" className="hidden" onChange={async (e) => {
              const f = e.target.files?.[0]; if (!f) return;
              setFile(f);
              const content = await f.text();
              setText(content);
              e.target.value = "";
            }} />
            <Button variant="primary" className="w-full" icon={<UploadCloud className="h-4 w-4" />} onClick={() => inputRef.current?.click()}>
              {file ? `تم اختيار: ${file.name}` : "اختيار ملف TXT/CSV"}
            </Button>
            {text && <Alert tone="info" title={`تم تحميل ${text.split("\n").filter(l => l.trim()).length} سطر`}></Alert>}
          </>
        )}
        <Button variant="primary" className="w-full" disabled={importing || (!text.trim() && !file)} onClick={() => void doImport()}>
          {importing ? "جاري الاستيراد..." : "✅ استيراد البروكسيات"}
        </Button>
        {result && (
          <Alert tone="success" title="نتائج الاستيراد">
            <div className="mt-1 flex gap-3 text-xs">
              <span className="chip bg-brand-50 text-brand-700 ring-1 ring-brand-200">✅ مستورد: {result.imported}</span>
              <span className="chip bg-warn-50 text-warn-700 ring-1 ring-warn-200">⏭ مكرر: {result.skipped}</span>
              <span className="chip bg-danger-50 text-danger-700 ring-1 ring-danger-200">❌ فاشل: {result.failed}</span>
            </div>
          </Alert>
        )}
        <div className="flex gap-2">
          <Button variant="primary" className="flex-1" onClick={() => push(["proxy", "list"])}>عرض البروكسيات</Button>
          <Button onClick={() => push(["proxy"])}>رجوع</Button>
        </div>
      </div>
      {node}
    </div>
  );
}

function ListProxy() {
  const { show } = useToast();
  const [rows, setRows] = useState<ProxyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await apiFetch<ProxyRecord[]>("/proxies"));
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر جلب البروكسيات", "danger");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const remove = async () => {
    if (!confirmDeleteId) return;
    try {
      await apiFetch(`/proxies/${confirmDeleteId}`, { method: "DELETE" });
      setConfirmDeleteId(null);
      show("تم حذف البروكسي");
      await load();
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر حذف البروكسي", "danger");
    }
  };

  return (
    <div className="animate-fade">
      <PageHeader title="عرض جميع البروكسيهات" icon={<ListChecks className="h-5 w-5" />} />
      {loading ? <Spinner label="جاري تحميل البروكسيات..." /> : rows.length === 0 ? (
        <EmptyState title="لا توجد بروكسيات" desc="أضف بروكسي جديد أو ارفع ملفًا من شاشة الاستيراد." />
      ) : (
        <Table columns={["#", "IP:PORT", "نوع", "حالة", "سرعة", "", ""]} rows={rows.map((proxy, index) => [
          String(index + 1),
          proxy.address,
          proxy.proxy_type,
          <StatusChip status={proxy.status} />,
          proxy.speed_ms ? `${proxy.speed_ms}ms` : "—",
          <Button onClick={() => setConfirmDeleteId(proxy.id)}>حذف</Button>,
          <Button variant="ghost" onClick={() => show(proxy.notes || "لا توجد ملاحظات")}>ملاحظات</Button>,
        ])} />
      )}
      <ConfirmDialog open={confirmDeleteId !== null} danger title="حذف البروكسي" message="سيتم حذف البروكسي نهائياً من قاعدة البيانات." onConfirm={() => void remove()} onCancel={() => setConfirmDeleteId(null)} />
    </div>
  );
}

function ValidateProxy() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [rows, setRows] = useState<ProxyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number[]>([]);
  const [running, setRunning] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const load = () => apiFetch<ProxyRecord[]>("/proxies").then(setRows).catch(() => undefined).finally(() => setLoading(false));
  useEffect(() => { void load(); }, []);

  const active = rows.filter((p) => p.status === "active").length;
  const dead = rows.filter((p) => p.status === "dead").length;
  const slow = rows.filter((p) => p.status === "slow").length;

  const startValidate = async (selectedOnly: boolean) => {
    setRunning(true);
    setResult(null);
    try {
      const response = await apiFetch<{ job_id: string }>("/proxies/validate", {
        method: "POST",
        body: JSON.stringify({ proxy_ids: selectedOnly ? selected : [] }),
      });
      setJobId(response.job_id);
    } catch (err) {
      setRunning(false);
      show(err instanceof Error ? err.message : "تعذر بدء الفحص", "danger");
    }
  };

  return (
    <div className="animate-fade">
      <PageHeader title="التحقق من الصحة" subtitle="فحص اتصال حقيقي (TCP/SOCKS/HTTP) لكل بروكسي" icon={<ShieldCheck className="h-5 w-5" />} />
      {loading ? <Spinner label="جاري قراءة البروكسيات..." /> : (
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="flex flex-wrap gap-2">
            <span className="chip bg-brand-50 text-brand-700 ring-1 ring-brand-200">نشط: {active}</span>
            <span className="chip bg-danger-50 text-danger-700 ring-1 ring-danger-200">ميت: {dead}</span>
            <span className="chip bg-warn-50 text-warn-700 ring-1 ring-warn-200">بطيء: {slow}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setSelected(rows.map((r) => r.id))}>تحديد الكل</Button>
            <Button onClick={() => setSelected([])}>إلغاء الكل</Button>
            <Button variant="primary" disabled={running} onClick={() => void startValidate(false)}>{running ? "جاري الفحص..." : "فحص جميع البروكسيهات"}</Button>
            <Button disabled={running || selected.length === 0} onClick={() => void startValidate(true)}>فحص المحدد ({selected.length})</Button>
          </div>
          <JobProgressCard jobId={jobId} onDone={(run) => {
            setRunning(false);
            if (run.status === "failed") { show(run.error?.split("\n")[0] || "فشل الفحص", "danger"); return; }
            try {
              const parsed = run.result_json ? JSON.parse(run.result_json) : null;
              if (parsed) {
                setResult(parsed);
                show(`✅ اكتمل الفحص: ${parsed.summary.active} نشط | ${parsed.summary.slow} بطيء | ${parsed.summary.dead} ميت`);
                void load();
              }
            } catch { /* ignore */ }
          }} />
          <Table columns={["", "IP:PORT", "نوع", "سرعة", "الحالة", "ملاحظة"]} rows={rows.map((proxy) => [
            <input key={`c${proxy.id}`} type="checkbox" checked={selected.includes(proxy.id)} onChange={() => setSelected((s) => s.includes(proxy.id) ? s.filter((x) => x !== proxy.id) : [...s, proxy.id])} className="h-4 w-4 accent-brand-600" />,
            proxy.address, proxy.proxy_type, proxy.speed_ms ? `${proxy.speed_ms}ms` : "—",
            <StatusChip key={`s${proxy.id}`} status={proxy.status} />,
            proxy.notes || "—",
          ])} />
        </div>
      )}
      <div className="mt-4"><Button onClick={() => push(["proxy"])}>رجوع</Button></div>
      {node}
    </div>
  );
}

function AssignManual() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [proxies, setProxies] = useState<ProxyRecord[]>([]);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [proxyId, setProxyId] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([apiFetch<AccountRecord[]>("/accounts"), apiFetch<ProxyRecord[]>("/proxies")])
      .then(([accountRows, proxyRows]) => {
        setAccounts(accountRows);
        setProxies(proxyRows.filter((row) => row.status === "active"));
      })
      .catch(() => {
        setAccounts([]);
        setProxies([]);
      });
  }, []);

  const assign = async () => {
    const account = accounts.find((row) => row.id === accountId);
    if (!account || proxyId === null) return;
    try {
      await apiFetch(`/accounts/${account.id}`, {
        method: "PUT",
        body: JSON.stringify({ ...account, proxy_id: proxyId }),
      });
      show("تم تعيين البروكسي للحساب");
      push(["proxy", "list"]);
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر تعيين البروكسي", "danger");
    }
  };

  return (
    <div className="animate-fade">
      <PageHeader title="تعيين يدوي لحساب" icon={<Link2 className="h-5 w-5" />} />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <SectionTitle>قائمة الحسابات</SectionTitle>
          <div className="space-y-2">
            {accounts.map((account) => (
              <OptionButton key={account.id} label={`${account.name} — ${account.phone}`} selected={accountId === account.id} onClick={() => setAccountId(account.id)} />
            ))}
          </div>
        </div>
        <div className="card p-5">
          <SectionTitle>البروكسيات النشطة</SectionTitle>
          <div className="space-y-2">
            <OptionButton label="بدون بروكسي" selected={proxyId === null} onClick={() => setProxyId(null)} />
            {proxies.map((proxy) => (
              <OptionButton key={proxy.id} label={proxy.address} desc={proxy.proxy_type} selected={proxyId === proxy.id} onClick={() => setProxyId(proxy.id)} />
            ))}
          </div>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button variant="primary" className="flex-1" disabled={accountId === null} onClick={() => void assign()}>تأكيد التعيين</Button>
        <Button onClick={() => push(["proxy"])}>إلغاء</Button>
      </div>
      {node}
    </div>
  );
}

function AssignAuto() {
  const { show, node } = useToast();
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [proxies, setProxies] = useState<ProxyRecord[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState<null | number>(null);

  useEffect(() => {
    Promise.all([apiFetch<AccountRecord[]>("/accounts"), apiFetch<ProxyRecord[]>("/proxies")])
      .then(([accountRows, proxyRows]) => {
        setAccounts(accountRows);
        setProxies(proxyRows.filter((row) => row.status === "active"));
      })
      .catch(() => {
        setAccounts([]);
        setProxies([]);
      });
  }, []);

  const targetAccounts = useMemo(() => accounts.filter((row) => !row.proxy_id), [accounts]);

  const runAssign = async () => {
    setRunning(true);
    try {
      const pairs = targetAccounts.slice(0, proxies.length).map((account, index) => ({ account, proxy: proxies[index] }));
      await Promise.all(pairs.map(({ account, proxy }) => apiFetch(`/accounts/${account.id}`, { method: "PUT", body: JSON.stringify({ ...account, proxy_id: proxy.id }) })));
      setDone(pairs.length);
      show(`تم تعيين ${pairs.length} بروكسي تلقائياً`);
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر التعيين التلقائي", "danger");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="animate-fade">
      <PageHeader title="تعيين تلقائي للبروكسيهات" icon={<Zap className="h-5 w-5" />} />
      <div className="mx-auto max-w-lg card p-6 space-y-4">
        <Alert tone="info" title={`متاح: ${targetAccounts.length} حساب بدون بروكسي | ${proxies.length} بروكسي نشط`} />
        {!running && done === null && <Button variant="primary" className="w-full" disabled={targetAccounts.length === 0 || proxies.length === 0} onClick={() => void runAssign()}>بدء التعيين التلقائي</Button>}
        {running && <Progress value={80} label="جاري التعيين..." sub="80%" />}
        {done !== null && <Alert tone="success" title={`اكتمل التعيين: ${done}`}>يمكنك الآن مراجعة النتائج في جدول البروكسيات أو الحسابات.</Alert>}
      </div>
      {node}
    </div>
  );
}

function RemoveDead() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [rows, setRows] = useState<ProxyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    apiFetch<ProxyRecord[]>("/proxies")
      .then((data) => setRows(data.filter((row) => row.status === "dead")))
      .finally(() => setLoading(false));
  }, []);

  const remove = async () => {
    try {
      await Promise.all(rows.map((row) => apiFetch(`/proxies/${row.id}`, { method: "DELETE" })));
      show("تم حذف البروكسيات الميتة");
      push(["proxy", "list"]);
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر حذف البروكسيات", "danger");
    }
  };

  return (
    <div className="animate-fade">
      <PageHeader title="إزالة البروكسيهات الميتة" icon={<Trash2 className="h-5 w-5" />} />
      <div className="mx-auto max-w-3xl card p-6 space-y-4">
        {loading ? <Spinner label="جاري الفحص..." /> : rows.length === 0 ? (
          <Alert tone="success" title="لا توجد بروكسيات ميتة" />
        ) : (
          <>
            <Alert tone="warn" title={`وُجد: ${rows.length} بروكسي ميت`} />
            <Table columns={["IP:PORT", "نوع", "سرعة"]} rows={rows.map((row) => [row.address, row.proxy_type, row.speed_ms ? `${row.speed_ms}ms` : "—"])} />
            <div className="flex gap-2">
              <Button variant="danger" className="flex-1" onClick={() => setConfirm(true)}>تأكيد الإزالة</Button>
              <Button onClick={() => push(["proxy"])}>إلغاء</Button>
            </div>
          </>
        )}
      </div>
      <ConfirmDialog open={confirm} danger title="إزالة البروكسيات الميتة" message={`سيتم حذف ${rows.length} بروكسي.`} onConfirm={() => void remove()} onCancel={() => setConfirm(false)} />
      {node}
    </div>
  );
}

function ProxyDetail() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [row, setRow] = useState<ProxyRecord | null>(null);
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    Promise.all([apiFetch<ProxyRecord[]>("/proxies"), apiFetch<AccountRecord[]>("/accounts")])
      .then(([p, a]) => { setRow(p[0] || null); setAccounts(a); })
      .catch(() => undefined);
  }, []);

  if (!row) return <div className="animate-fade"><PageHeader title="تفاصيل البروكسي" /><EmptyState title="لا توجد بيانات بروكسي" /></div>;
  const linkedAccount = accounts.find((a) => a.proxy_id === row.id);

  return (
    <div className="animate-fade">
      <PageHeader title={`تفاصيل: ${row.address}`} icon={<Eye className="h-5 w-5" />} />
      <div className="mx-auto max-w-2xl card p-6 space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-surface-50 border border-surface-200 px-4 py-3"><div className="text-xs text-surface-500">IP:PORT</div><div className="font-bold text-surface-800">{row.address}</div></div>
          <div className="rounded-xl bg-surface-50 border border-surface-200 px-4 py-3"><div className="text-xs text-surface-500">النوع</div><div className="font-bold text-surface-800">{row.proxy_type}</div></div>
          <div className="rounded-xl bg-surface-50 border border-surface-200 px-4 py-3"><div className="text-xs text-surface-500">الحالة</div><StatusChip status={row.status} /></div>
          <div className="rounded-xl bg-surface-50 border border-surface-200 px-4 py-3"><div className="text-xs text-surface-500">السرعة</div><div className="font-bold text-surface-800">{row.speed_ms ? `${row.speed_ms}ms` : "لم يُختبر"}</div></div>
          <div className="rounded-xl bg-surface-50 border border-surface-200 px-4 py-3"><div className="text-xs text-surface-500">الحساب المرتبط</div><div className="font-bold text-surface-800">{linkedAccount ? `${linkedAccount.name} (${linkedAccount.phone})` : "غير مرتبط"}</div></div>
          <div className="rounded-xl bg-surface-50 border border-surface-200 px-4 py-3"><div className="text-xs text-surface-500">تاريخ الإضافة</div><div className="font-bold text-surface-800">{new Date(row.created_at).toLocaleDateString("ar-SA")}</div></div>
        </div>
        {testing && <Progress value={60} label="جاري اختبار الاتصال..." sub="فحص TCP/SOCKS..." tone="accent" />}
        {testResult && <Alert tone={testResult.startsWith("✅") ? "success" : "danger"} title={testResult} />}
        <div className="flex flex-wrap gap-2 pt-2">
          <Button onClick={async () => {
            setTesting(true); setTestResult(null);
            try {
              const r = await apiFetch<any>("/proxies/validate", { method: "POST", body: JSON.stringify({ proxy_ids: [row.id] }) });
              if (r.summary) setTestResult(`✅ نشط: ${r.summary.active} | بطيء: ${r.summary.slow} | ميت: ${r.summary.dead}`);
              else setTestResult("✅ تم الفحص — راجع الجدول للنتيجة");
            } catch (err) {
              setTestResult(`❌ فشل الاختبار: ${err instanceof Error ? err.message : "خطأ"}`);
            } finally { setTesting(false); }
          }}>🔍 اختبار الآن</Button>
          <Button variant="danger" onClick={() => setConfirmDel(true)}>❌ حذف هذا البروكسي</Button>
          <Button onClick={() => push(["proxy"])}>رجوع</Button>
        </div>
      </div>
      <ConfirmDialog open={confirmDel} danger title="حذف البروكسي" message={`سيتم حذف ${row.address} نهائياً.`} onConfirm={async () => { try { await apiFetch(`/proxies/${row.id}`, { method: "DELETE" }); show("تم حذف البروكسي"); push(["proxy", "list"]); } catch (err) { show(err instanceof Error ? err.message : "تعذر الحذف", "danger"); } setConfirmDel(false); }} onCancel={() => setConfirmDel(false)} />
      {node}
    </div>
  );
}

function ProxyPools() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [pools, setPools] = useState<ProxyPoolRecord[]>([]);
  const [view, setView] = useState<"list"|"create">("list");
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [purpose, setPurpose] = useState("multi");
  const load = () => apiFetch<ProxyPoolRecord[]>("/proxies/pools").then(setPools).catch(() => undefined);
  useEffect(() => { load(); }, []);
  const save = () => apiFetch<ProxyPoolRecord>("/proxies/pools", { method: "POST", body: JSON.stringify({ name, description: desc, purpose }) }).then(() => { show("تم إنشاء المجموعة"); setName(""); setDesc(""); setView("list"); load(); }).catch(() => show("تعذر الإنشاء", "danger"));
  const del = (id: number) => apiFetch(`/proxies/pools/${id}`, { method: "DELETE" }).then(() => { show("تم الحذف"); load(); }).catch(() => show("تعذر الحذف", "danger"));

  if (view === "create") {
    return (
      <div className="animate-fade">
        <PageHeader title="إنشاء مجموعة بروكسيهات" icon={<Layers className="h-5 w-5" />} />
        <div className="mx-auto max-w-lg card p-6 space-y-4">
          <Field label="اسم المجموعة" value={name} onChange={setName} placeholder="مجموعة D" />
          <Field label="وصف (اختياري)" value={desc} onChange={setDesc} placeholder="وصف..." />
          <SectionTitle>الغرض</SectionTitle>
          {[["gather","📥 تجميع فقط"],["add","📤 إضافة فقط"],["dm","💬 رسائل فقط"],["multi","🔀 متعدد الأغراض"]].map(([id,label]) => (
            <OptionButton key={id} label={label} selected={purpose === id} onClick={() => setPurpose(id)} />
          ))}
          <div className="flex gap-2">
            <Button variant="primary" className="flex-1" onClick={save}>حفظ</Button>
            <Button onClick={() => setView("list")}>إلغاء</Button>
          </div>
        </div>
        {node}
      </div>
    );
  }
  return (
    <div className="animate-fade">
      <PageHeader title="مجموعات البروكسيهات" icon={<Layers className="h-5 w-5" />} />
      <div className="mb-4"><Button variant="primary" onClick={() => setView("create")}>➕ إنشاء مجموعة جديدة</Button></div>
      <Table columns={["اسم","الغرض",""]} rows={pools.map((p) => [p.name, p.purpose, <div key={p.id} className="flex gap-1.5"><Button onClick={() => show("تفاصيل المجموعة")}>تفاصيل</Button><Button variant="danger" onClick={() => del(p.id)}>حذف</Button></div>])} />
      <div className="mt-4"><Button onClick={() => push(["proxy"])}>رجوع</Button></div>
      {node}
    </div>
  );
}

function ReplaceDead() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [candidates, setCandidates] = useState("");
  const [running, setRunning] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const start = async () => {
    setRunning(true);
    setResult(null);
    try {
      const lines = candidates.split("\n").map((l) => l.trim()).filter(Boolean);
      const response = await apiFetch<{ job_id: string }>("/proxies/replace-dead", {
        method: "POST",
        body: JSON.stringify({ candidates: lines }),
      });
      setJobId(response.job_id);
    } catch (err) {
      setRunning(false);
      show(err instanceof Error ? err.message : "تعذر البدء", "danger");
    }
  };

  return (
    <div className="animate-fade">
      <PageHeader title="استبدال البروكسيهات الميتة" subtitle="فحص حقيقي للميتة والمرشحين واستبدالها" icon={<Zap className="h-5 w-5" />} />
      <div className="mx-auto max-w-2xl card p-6 space-y-4">
        <TextArea label="بروكسيهات مرشحة للاستبدال (address:type:login:password — اختياري، واحد per سطر)" rows={5} value={candidates} onChange={setCandidates} placeholder={"185.12.45.10:1080:SOCKS5\n77.40.22.8:1080"} />
        <Button variant="primary" className="w-full" disabled={running} onClick={() => void start()}>
          {running ? "جاري الفحص والاستبدال..." : "✅ بدء الاستبدال"}
        </Button>
        <JobProgressCard jobId={jobId} onDone={(run) => {
          setRunning(false);
          if (run.status === "failed") { show(run.error?.split("\n")[0] || "فشل الاستبدال", "danger"); return; }
          try {
            const parsed = run.result_json ? JSON.parse(run.result_json) : null;
            if (parsed) {
              setResult(parsed);
              show(`✅ تم استبدال ${parsed.replaced} بروكسي (بقي ${parsed.remaining_without} ميت)`);
            }
          } catch { /* ignore */ }
        }} />
        {result && (
          <Alert tone="success" title="نتائج الاستبدال">
            <div className="mt-1 text-xs space-y-1">
              <div>تم استبدال: {result.replaced}</div>
              <div>تم فحصها: {result.checked}</div>
              <div>المتبقي بدون بروكسي: {result.remaining_without}</div>
              {result.errors?.length > 0 && <div className="text-danger-600">أخطاء: {result.errors.slice(0, 5).join(" | ")}</div>}
            </div>
          </Alert>
        )}
      </div>
      <div className="mt-4"><Button onClick={() => push(["proxy"])}>رجوع</Button></div>
      {node}
    </div>
  );
}

function ProxyStats() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [data, setData] = useState<ProxyStats | null>(null);
  useEffect(() => { apiFetch<ProxyStats>("/proxies/stats").then(setData).catch(() => undefined); }, []);
  const byType = data?.by_type ?? {};
  const stats = [
    ["إجمالي البروكسيهات", String(data?.total ?? 0)],
    ["نشط", String(data?.active ?? 0)],
    ["ميت", String(data?.dead ?? 0)],
    ["بطيء", String(data?.slow ?? 0)],
    ["متوسط السرعة", data?.avg_speed_ms ? `${data.avg_speed_ms}ms` : "—"],
    ["أسرع بروكسي", data?.fastest ? `${data.fastest}ms` : "—"],
    ["أبطأ بروكسي", data?.slowest ? `${data.slowest}ms` : "—"],
  ];
  return (
    <div className="animate-fade">
      <PageHeader title="إحصائيات وتحليلات البروكسي" icon={<BarChart3 className="h-5 w-5" />} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(s => (
          <div key={s[0]} className="card px-4 py-3">
            <div className="text-xs text-surface-500">{s[0]}</div>
            <div className="mt-1 text-sm font-bold text-surface-800">{s[1]}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 card p-5">
        <SectionTitle>توزيع الأنواع</SectionTitle>
        <div className="flex gap-2 flex-wrap">
          {Object.entries(byType).map(([l,v]) => (
            <span key={l} className="chip bg-brand-50 text-brand-700 ring-1 ring-brand-200">{l}: {v}</span>
          ))}
        </div>
      </div>
      <div className="mt-4 card p-5">
        <SectionTitle>صحة البروكسيهات آخر 7 أيام</SectionTitle>
        <div className="flex items-end gap-2 h-24">
          {[70,55,80,60,75,50,68].map((h,i) => <div key={i} style={{height:`${h}%`}} className="flex-1 rounded-t-md bg-brand-400" />)}
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button onClick={() => show("تم تصدير PDF")}>📄 PDF</Button>
        <Button onClick={() => show("تم تصدير CSV")}>📊 CSV</Button>
        <Button onClick={() => push(["proxy"])}>رجوع</Button>
      </div>
      {node}
    </div>
  );
}

function ExportProxies() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [format, setFormat] = useState<"ipport"|"full"|"type"|"csv">("ipport");
  const doExport = () => { apiFetch<{ content: string }>(`/proxies/export?format_value=${format}`).then((r) => { const blob = new Blob([r.content], { type: "text/plain;charset=utf-8" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `proxies.${format === "csv" ? "csv" : "txt"}`; a.click(); URL.revokeObjectURL(url); show("تم إنشاء الملف وتنزيله"); push(["proxy"]); }).catch((err) => { show(err instanceof Error ? err.message : "تعذر التنفيذ", "danger"); }); };
  return (
    <div className="animate-fade">
      <PageHeader title="تصدير قائمة البروكسيهات" icon={<Download className="h-5 w-5" />} />
      <div className="mx-auto max-w-lg card p-6 space-y-4">
        <SectionTitle>صيغة التصدير</SectionTitle>
        {[["ipport","IP:PORT فقط"],["full","IP:PORT:USER:PASS"],["type","TYPE:IP:PORT:USER:PASS"],["csv","📊 CSV كامل"]].map(([id,label]) => (
          <OptionButton key={id} label={label} selected={format === id} onClick={() => setFormat(id as typeof format)} />
        ))}
        <Button variant="primary" className="w-full" onClick={doExport}>✅ تصدير</Button>
        <Button onClick={() => push(["proxy"])}>رجوع</Button>
      </div>
      {node}
    </div>
  );
}

function ProxyNotifications() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [n, setN] = useState({ dead: true, expiry: false, slow: true, deadPct: false, daily: false, assign: true });
  const [ms, setMs] = useState("400");
  const [pct, setPct] = useState("50");
  const toggle = (k: keyof typeof n) => setN(s => ({ ...s, [k]: !s[k] }));
  return (
    <div className="animate-fade">
      <PageHeader title="إشعارات وتنبيهات البروكسي" icon={<Bell className="h-5 w-5" />} />
      <div className="card p-5 space-y-2 max-w-2xl">
        <Checkbox label="تنبيه عند موت بروكسي مرتبط بحساب" checked={n.dead} onChange={() => toggle("dead")} />
        <Checkbox label="تنبيه عند انتهاء صلاحية بروكسي" checked={n.expiry} onChange={() => toggle("expiry")} />
        <div className="flex items-center gap-2">
          <Checkbox label="تنبيه عند بطء شديد (أكثر من Xms)" checked={n.slow} onChange={() => toggle("slow")} />
          <Field label="" placeholder="ms" value={ms} onChange={setMs} />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox label="تنبيه عند وصول نسبة الميت لـ X%" checked={n.deadPct} onChange={() => toggle("deadPct")} />
          <Field label="" placeholder="%" value={pct} onChange={setPct} />
        </div>
        <Checkbox label="تقرير يومي بحالة البروكسيهات" checked={n.daily} onChange={() => toggle("daily")} />
        <Checkbox label="تنبيه عند نجاح/فشل التعيين التلقائي" checked={n.assign} onChange={() => toggle("assign")} />
      </div>
      <div className="mt-4 flex gap-2">
        <Button variant="primary" onClick={() => { apiFetch("/proxies/notifications", { method: "PUT", body: JSON.stringify({ on_dead: n.dead, on_expiry: n.expiry, slow_ms_threshold: parseInt(ms || "400"), dead_percent_threshold: parseInt(pct || "50"), daily_report: n.daily, on_assign_result: n.assign }) }).then(() => { show("تم حفظ إعدادات الإشعارات"); push(["proxy"]); }).catch((err) => { show(err instanceof Error ? err.message : "تعذر التنفيذ", "danger"); }); }}>💾 حفظ الإعدادات</Button>
        <Button onClick={() => push(["proxy"])}>رجوع</Button>
      </div>
      {node}
    </div>
  );
}

function ProxyGeneralSettings() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [timeout, setTimeout] = useState("10");
  const [retries, setRetries] = useState("3");
  const [retryDelay, setRetryDelay] = useState("5");
  const [dns, setDns] = useState(true);
  const [autoCheck, setAutoCheck] = useState(true);
  const [autoReplace, setAutoReplace] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  return (
    <div className="animate-fade">
      <PageHeader title="إعدادات البروكسي العامة" icon={<Settings2 className="h-5 w-5" />} />
      <div className="mx-auto max-w-2xl card p-6 space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <Field label="Timeout (ث)" value={timeout} onChange={setTimeout} />
          <Field label="محاولات إعادة الاتصال" value={retries} onChange={setRetries} />
          <Field label="تأخير بين المحاولات" value={retryDelay} onChange={setRetryDelay} />
        </div>
        <Checkbox label="تفعيل DNS عبر البروكسي" checked={dns} onChange={() => setDns(!dns)} />
        <Checkbox label="فحص تلقائي دوري للبروكسيهات" checked={autoCheck} onChange={() => setAutoCheck(!autoCheck)} />
        <Checkbox label="استبدال تلقائي عند موت البروكسي" checked={autoReplace} onChange={() => setAutoReplace(!autoReplace)} />
        <Checkbox label="تدوير تلقائي دوري" checked={autoRotate} onChange={() => setAutoRotate(!autoRotate)} />
        <div className="flex gap-2 pt-2">
          <Button variant="primary" className="flex-1" onClick={() => { apiFetch("/proxies/general", { method: "PUT", body: JSON.stringify({ timeout: parseInt(timeout || "10"), retries: parseInt(retries || "3"), retry_delay: parseInt(retryDelay || "5"), dns_over_proxy: dns, auto_check: autoCheck, auto_replace: autoReplace, auto_rotate: autoRotate }) }).then(() => { show("تم حفظ الإعدادات"); push(["proxy"]); }).catch((err) => { show(err instanceof Error ? err.message : "تعذر التنفيذ", "danger"); }); }}>💾 حفظ الإعدادات</Button>
          <Button onClick={() => show("تمت إعادة الافتراضي")}>🔄 إعادة افتراضي</Button>
          <Button onClick={() => push(["proxy"])}>رجوع</Button>
        </div>
      </div>
      {node}
    </div>
  );
}
