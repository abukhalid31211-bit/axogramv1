import { useEffect, useMemo, useRef, useState } from "react";
import { Globe, Plus, FileText, ListChecks, ShieldCheck, Link2, Zap, Trash2, UploadCloud } from "lucide-react";
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
  InlineEdit,
  Spinner,
  EmptyState,
  Field,
  StatCard,
} from "../ui";
import { apiFetch, type AccountRecord, type ProxyRecord } from "../lib/api";

const items = [
  { id: "add", label: "إضافة بروكسي جديد", desc: "حفظ مباشر في قاعدة البيانات", icon: Plus },
  { id: "import", label: "استيراد قائمة من .txt", desc: "رفع ملف للسيرفر", icon: FileText },
  { id: "list", label: "عرض جميع البروكسيهات", desc: "جدول حي من السيرفر", icon: ListChecks },
  { id: "validate", label: "التحقق من الصحة", desc: "ملخص حالات حالي", icon: ShieldCheck },
  { id: "assign-manual", label: "تعيين يدوي لحساب", desc: "ربط حساب ببروكسي", icon: Link2 },
  { id: "assign-auto", label: "تعيين تلقائي", desc: "توزيع على الحسابات بدون بروكسي", icon: Zap },
  { id: "remove-dead", label: "إزالة البروكسيهات الميتة", desc: "حذف جميع dead", icon: Trash2 },
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
            onClick={() => {
              setChecking(true);
              setTimeout(() => {
                const ok = address.includes(":");
                setValid(ok);
                setChecking(false);
              }, 800);
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
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);

  const upload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("category", "txt");
      await apiFetch("/uploads", { method: "POST", body: form });
      setDone(true);
      show("تم رفع الملف إلى السيرفر");
    } catch (err) {
      show(err instanceof Error ? err.message : "تعذر رفع الملف", "danger");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="animate-fade">
      <PageHeader title="استيراد قائمة من .txt" icon={<FileText className="h-5 w-5" />} />
      <div className="mx-auto max-w-lg card p-6 space-y-4">
        <input ref={inputRef} type="file" accept=".txt" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <Alert tone="info" title="رفع ملف بروكسيات">يتم حفظ الملف في السيرفر الآن، ويمكن لاحقاً إضافة parsing تلقائي داخله.</Alert>
        <Button variant="primary" className="w-full" icon={<UploadCloud className="h-4 w-4" />} onClick={() => inputRef.current?.click()}>
          {file ? `تم اختيار: ${file.name}` : "اختيار ملف TXT"}
        </Button>
        {!uploading && !done && <Button className="w-full" disabled={!file} onClick={() => void upload()}>رفع الملف</Button>}
        {uploading && <Progress value={75} label="جاري الرفع..." sub="75%" tone="accent" />}
        {done && (
          <div className="space-y-3">
            <Alert tone="success" title="تم رفع الملف بنجاح">الخطوة القادمة: parsing وربط تلقائي بإضافة البروكسيات من الملف.</Alert>
            <div className="flex gap-2">
              <Button variant="primary" className="flex-1" onClick={() => push(["proxy", "list"])}>عرض البروكسيات</Button>
              <Button onClick={() => push(["proxy"])}>رجوع</Button>
            </div>
          </div>
        )}
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
  const [rows, setRows] = useState<ProxyRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<ProxyRecord[]>("/proxies").then(setRows).finally(() => setLoading(false));
  }, []);

  const active = rows.filter((p) => p.status === "active").length;
  const dead = rows.filter((p) => p.status === "dead").length;
  const slow = rows.filter((p) => p.status === "slow").length;

  return (
    <div className="animate-fade">
      <PageHeader title="التحقق من الصحة" icon={<ShieldCheck className="h-5 w-5" />} />
      {loading ? <Spinner label="جاري قراءة البروكسيات..." /> : (
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="flex flex-wrap gap-2">
            <span className="chip bg-brand-50 text-brand-700 ring-1 ring-brand-200">نشط: {active}</span>
            <span className="chip bg-danger-50 text-danger-700 ring-1 ring-danger-200">ميت: {dead}</span>
            <span className="chip bg-warn-50 text-warn-700 ring-1 ring-warn-200">بطيء: {slow}</span>
          </div>
          <Table columns={["IP:PORT", "نوع", "سرعة", "الحالة"]} rows={rows.map((proxy) => [proxy.address, proxy.proxy_type, proxy.speed_ms ? `${proxy.speed_ms}ms` : "—", <StatusChip status={proxy.status} />])} />
        </div>
      )}
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
