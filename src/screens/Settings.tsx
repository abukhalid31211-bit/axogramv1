import { useEffect, useMemo, useState } from "react";
import { Settings, KeyRound, Save, RotateCcw, Folder } from "lucide-react";
import { useNav } from "../nav";
import { Alert, Button, Checkbox, PageHeader, SectionTitle, useToast, InlineEdit } from "../ui";
import { apiFetch, type SettingItem } from "../lib/api";

type SettingsMap = Record<string, string>;

const fallbackSettings: SettingsMap = {
  telegram_api_id: "12345678",
  telegram_api_hash: "a1b2c3d4e5f6",
  default_add_limit: "20",
  default_gather_limit: "500",
  default_message_limit: "30",
  default_delay_min: "60",
  default_delay_max: "120",
  sessions_path: "./sessions/",
  exports_path: "./exports/",
  logs_path: "./logs/",
  language: "AR",
};

const descriptions: Record<string, { is_secret: boolean; description: string }> = {
  telegram_api_id: { is_secret: true, description: "Telegram API ID" },
  telegram_api_hash: { is_secret: true, description: "Telegram API Hash" },
  default_add_limit: { is_secret: false, description: "Daily add limit" },
  default_gather_limit: { is_secret: false, description: "Daily gather limit" },
  default_message_limit: { is_secret: false, description: "Daily message limit" },
  default_delay_min: { is_secret: false, description: "Minimum delay in seconds" },
  default_delay_max: { is_secret: false, description: "Maximum delay in seconds" },
  sessions_path: { is_secret: false, description: "Sessions path" },
  exports_path: { is_secret: false, description: "Exports path" },
  logs_path: { is_secret: false, description: "Logs path" },
  language: { is_secret: false, description: "Dashboard language" },
};

function itemsToMap(items: SettingItem[]): SettingsMap {
  const mapped = { ...fallbackSettings };
  for (const item of items) {
    mapped[item.key] = item.value ?? "";
  }
  return mapped;
}

export function SettingsModule() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [form, setForm] = useState<SettingsMap>(fallbackSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toggles, setToggles] = useState({ notify: true, verbose: false });

  useEffect(() => {
    let mounted = true;
    apiFetch<SettingItem[]>("/settings")
      .then((items) => {
        if (!mounted) return;
        setForm(itemsToMap(items));
        setError(null);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "تعذر تحميل الإعدادات");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const lang = form.language || "AR";

  const payload = useMemo(
    () => ({
      items: Object.entries(form).map(([key, value]) => ({
        key,
        value,
        is_secret: descriptions[key]?.is_secret ?? false,
        description: descriptions[key]?.description ?? key,
      })),
    }),
    [form]
  );

  const saveAll = async () => {
    setSaving(true);
    setError(null);
    try {
      await apiFetch<{ message: string }>("/settings", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      show("تم حفظ الإعدادات في السيرفر");
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر حفظ الإعدادات");
      show("فشل حفظ الإعدادات", "danger");
    } finally {
      setSaving(false);
    }
  };

  const resetDefaults = () => {
    setForm(fallbackSettings);
    show("تمت إعادة القيم الافتراضية محلياً", "danger");
  };

  if (loading) {
    return (
      <div className="animate-fade">
        <Alert tone="info" title="جاري تحميل الإعدادات من السيرفر..." />
      </div>
    );
  }

  return (
    <div className="animate-fade">
      <PageHeader title="الإعدادات" subtitle="API، الحدود، المسارات" icon={<Settings className="h-5 w-5" />} />
      {error && (
        <div className="mb-4">
          <Alert tone="danger" title="تعذر تحميل أو حفظ الإعدادات">{error}</Alert>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <SectionTitle icon={<KeyRound className="h-4 w-4" />}>إعدادات API</SectionTitle>
          <div className="space-y-2">
            <InlineEdit label="معرف API"  value={form.telegram_api_id}   onSave={(v) => setForm((s) => ({ ...s, telegram_api_id: v }))}   placeholder="12345678" />
            <InlineEdit label="تجزئة API" value={form.telegram_api_hash} onSave={(v) => setForm((s) => ({ ...s, telegram_api_hash: v }))} placeholder="a1b2c3d4e5f6" />
          </div>
        </div>
        <div className="card p-5">
          <SectionTitle>الحدود الافتراضية</SectionTitle>
          <div className="space-y-2">
            <InlineEdit label="حد الإضافة اليومي"   value={form.default_add_limit}    onSave={(v) => setForm((s) => ({ ...s, default_add_limit: v }))}    placeholder="20" />
            <InlineEdit label="حد التجميع اليومي"   value={form.default_gather_limit} onSave={(v) => setForm((s) => ({ ...s, default_gather_limit: v }))} placeholder="500" />
            <InlineEdit label="حد الرسائل اليومي"   value={form.default_message_limit} onSave={(v) => setForm((s) => ({ ...s, default_message_limit: v }))} placeholder="30" />
            <InlineEdit label="التأخير الأدنى (ث)"  value={form.default_delay_min}    onSave={(v) => setForm((s) => ({ ...s, default_delay_min: v }))}    placeholder="60" />
            <InlineEdit label="التأخير الأقصى (ث)"  value={form.default_delay_max}    onSave={(v) => setForm((s) => ({ ...s, default_delay_max: v }))}    placeholder="120" />
          </div>
        </div>
        <div className="card p-5">
          <SectionTitle icon={<Folder className="h-4 w-4" />}>مسارات التخزين</SectionTitle>
          <div className="space-y-2">
            <InlineEdit label="مجلد الجلسات"  value={form.sessions_path} onSave={(v) => setForm((s) => ({ ...s, sessions_path: v }))} placeholder="./sessions/" />
            <InlineEdit label="مجلد المصدرة"  value={form.exports_path}  onSave={(v) => setForm((s) => ({ ...s, exports_path: v }))}  placeholder="./exports/" />
            <InlineEdit label="مجلد السجلات"  value={form.logs_path}     onSave={(v) => setForm((s) => ({ ...s, logs_path: v }))}     placeholder="./logs/" />
          </div>
        </div>
        <div className="card p-5">
          <SectionTitle>إعدادات أخرى</SectionTitle>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-surface-200 bg-surface-50 px-4 py-3">
              <span className="text-sm font-medium text-surface-700">اللغة</span>
              <div className="flex gap-1.5">
                {["AR", "EN"].map((l) => (
                  <button key={l} onClick={() => setForm((s) => ({ ...s, language: l }))} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${lang === l ? "bg-brand-600 text-white shadow-soft" : "bg-white border border-surface-200 text-surface-600 hover:bg-surface-100"}`}>{l}</button>
                ))}
              </div>
            </div>
            <Checkbox label="الإشعارات"       checked={toggles.notify}  onChange={(v) => setToggles({ ...toggles, notify: v })} />
            <Checkbox label="التسجيل التفصيلي" checked={toggles.verbose} onChange={(v) => setToggles({ ...toggles, verbose: v })} />
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="primary" icon={<Save className="h-4 w-4" />} onClick={saveAll} disabled={saving}>{saving ? "جاري الحفظ..." : "حفظ الكل"}</Button>
        <Button variant="danger"  icon={<RotateCcw className="h-4 w-4" />} onClick={resetDefaults}>إعادة تعيين افتراضي</Button>
        <Button onClick={() => push(["home"])}>القائمة الرئيسية</Button>
      </div>
      {node}
    </div>
  );
}
