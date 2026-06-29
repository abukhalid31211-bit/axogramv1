import { useState } from "react";
import { Settings, KeyRound, Save, RotateCcw, Folder } from "lucide-react";
import { useNav } from "../nav";
import { PageHeader, Button, Field, Checkbox, SectionTitle, Alert, useToast } from "../ui";

export function SettingsModule() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [apiId, setApiId] = useState("12345678");
  const [apiHash, setApiHash] = useState("a1b2c3d4e5f6");
  const [addLimit, setAddLimit] = useState("20");
  const [gatherLimit, setGatherLimit] = useState("500");
  const [msgLimit, setMsgLimit] = useState("30");
  const [delayMin, setDelayMin] = useState("60");
  const [delayMax, setDelayMax] = useState("120");
  const [sessionsPath, setSessionsPath] = useState("./sessions/");
  const [exportsPath, setExportsPath] = useState("./exports/");
  const [logsPath, setLogsPath] = useState("./logs/");
  const [lang, setLang] = useState("AR");
  const [toggles, setToggles] = useState({ notify: true, verbose: false });

  return (
    <div className="animate-fade">
      <PageHeader title="الإعدادات" subtitle="API، الحدود، المسارات" icon={<Settings className="h-5 w-5" />} />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <SectionTitle icon={<KeyRound className="h-4 w-4" />}>إعدادات API</SectionTitle>
          <div className="space-y-3">
            <Field label="معرف API" value={apiId} onChange={setApiId} />
            <Field label="تجزئة API" value={apiHash} onChange={setApiHash} />
          </div>
        </div>
        <div className="card p-5">
          <SectionTitle>الحدود الافتراضية</SectionTitle>
          <div className="space-y-3">
            <Field label="حد الإضافة اليومي" value={addLimit} onChange={setAddLimit} />
            <Field label="حد التجميع اليومي" value={gatherLimit} onChange={setGatherLimit} />
            <Field label="حد الرسائل اليومي" value={msgLimit} onChange={setMsgLimit} />
            <div className="grid grid-cols-2 gap-2">
              <Field label="التأخير الأدنى (ث)" value={delayMin} onChange={setDelayMin} />
              <Field label="التأخير الأقصى (ث)" value={delayMax} onChange={setDelayMax} />
            </div>
          </div>
        </div>
        <div className="card p-5">
          <SectionTitle icon={<Folder className="h-4 w-4" />}>مسارات التخزين</SectionTitle>
          <div className="space-y-3">
            <Field label="مجلد الجلسات" value={sessionsPath} onChange={setSessionsPath} />
            <Field label="مجلد المصدرة" value={exportsPath} onChange={setExportsPath} />
            <Field label="مجلد السجلات" value={logsPath} onChange={setLogsPath} />
          </div>
        </div>
        <div className="card p-5">
          <SectionTitle>إعدادات أخرى</SectionTitle>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-ink-600/60 bg-ink-850/50 px-4 py-3">
              <span className="text-sm text-slate-200">اللغة</span>
              <div className="flex gap-1.5">
                {["AR", "EN"].map((l) => (
                  <button key={l} onClick={() => setLang(l)} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${lang === l ? "bg-brand-500 text-white" : "bg-ink-700/50 text-slate-300"}`}>{l}</button>
                ))}
              </div>
            </div>
            <Checkbox label="الإشعارات" checked={toggles.notify} onChange={(v) => setToggles({ ...toggles, notify: v })} />
            <Checkbox label="التسجيل التفصيلي" checked={toggles.verbose} onChange={(v) => setToggles({ ...toggles, verbose: v })} />
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="primary" icon={<Save className="h-4 w-4" />} onClick={() => show("تم حفظ الإعدادات")}>حفظ الكل</Button>
        <Button variant="danger" icon={<RotateCcw className="h-4 w-4" />} onClick={() => show("تم إعادة التعيين", "danger")}>إعادة تعيين افتراضي</Button>
        <Button onClick={() => push(["home"])}>القائمة الرئيسية</Button>
      </div>
      {node}
    </div>
  );
}
