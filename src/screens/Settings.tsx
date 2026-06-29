import { useState } from "react";
import { Settings, KeyRound, Save, RotateCcw, Folder } from "lucide-react";
import { useNav } from "../nav";
import { PageHeader, Button, Checkbox, SectionTitle, useToast, InlineEdit } from "../ui";

export function SettingsModule() {
  const { push } = useNav();
  const { show, node } = useToast();
  const [apiId,       setApiId]       = useState("12345678");
  const [apiHash,     setApiHash]     = useState("a1b2c3d4e5f6");
  const [addLimit,    setAddLimit]    = useState("20");
  const [gatherLimit, setGatherLimit] = useState("500");
  const [msgLimit,    setMsgLimit]    = useState("30");
  const [delayMin,    setDelayMin]    = useState("60");
  const [delayMax,    setDelayMax]    = useState("120");
  const [sessPath,    setSessPath]    = useState("./sessions/");
  const [expPath,     setExpPath]     = useState("./exports/");
  const [logsPath,    setLogsPath]    = useState("./logs/");
  const [lang,        setLang]        = useState("AR");
  const [toggles,     setToggles]     = useState({ notify: true, verbose: false });
  return (
    <div className="animate-fade">
      <PageHeader title="الإعدادات" subtitle="API، الحدود، المسارات" icon={<Settings className="h-5 w-5" />} />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <SectionTitle icon={<KeyRound className="h-4 w-4" />}>إعدادات API</SectionTitle>
          <div className="space-y-2">
            <InlineEdit label="معرف API"  value={apiId}   onSave={setApiId}   placeholder="12345678" />
            <InlineEdit label="تجزئة API" value={apiHash} onSave={setApiHash} placeholder="a1b2c3d4e5f6" />
          </div>
        </div>
        <div className="card p-5">
          <SectionTitle>الحدود الافتراضية</SectionTitle>
          <div className="space-y-2">
            <InlineEdit label="حد الإضافة اليومي"   value={addLimit}    onSave={setAddLimit}    placeholder="20" />
            <InlineEdit label="حد التجميع اليومي"   value={gatherLimit} onSave={setGatherLimit} placeholder="500" />
            <InlineEdit label="حد الرسائل اليومي"   value={msgLimit}    onSave={setMsgLimit}    placeholder="30" />
            <InlineEdit label="التأخير الأدنى (ث)"  value={delayMin}    onSave={setDelayMin}    placeholder="60" />
            <InlineEdit label="التأخير الأقصى (ث)"  value={delayMax}    onSave={setDelayMax}    placeholder="120" />
          </div>
        </div>
        <div className="card p-5">
          <SectionTitle icon={<Folder className="h-4 w-4" />}>مسارات التخزين</SectionTitle>
          <div className="space-y-2">
            <InlineEdit label="مجلد الجلسات"  value={sessPath} onSave={setSessPath} placeholder="./sessions/" />
            <InlineEdit label="مجلد المصدرة"  value={expPath}  onSave={setExpPath}  placeholder="./exports/" />
            <InlineEdit label="مجلد السجلات"  value={logsPath} onSave={setLogsPath} placeholder="./logs/" />
          </div>
        </div>
        <div className="card p-5">
          <SectionTitle>إعدادات أخرى</SectionTitle>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-surface-200 bg-surface-50 px-4 py-3">
              <span className="text-sm font-medium text-surface-700">اللغة</span>
              <div className="flex gap-1.5">
                {["AR", "EN"].map((l) => (
                  <button key={l} onClick={() => setLang(l)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${lang === l ? "bg-brand-600 text-white shadow-soft" : "bg-white border border-surface-200 text-surface-600 hover:bg-surface-100"}`}>{l}</button>
                ))}
              </div>
            </div>
            <Checkbox label="الإشعارات"       checked={toggles.notify}  onChange={(v) => setToggles({ ...toggles, notify: v })} />
            <Checkbox label="التسجيل التفصيلي" checked={toggles.verbose} onChange={(v) => setToggles({ ...toggles, verbose: v })} />
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="primary" icon={<Save className="h-4 w-4" />} onClick={() => show("تم حفظ الإعدادات")}>حفظ الكل</Button>
        <Button variant="danger"  icon={<RotateCcw className="h-4 w-4" />} onClick={() => show("تم إعادة التعيين", "danger")}>إعادة تعيين افتراضي</Button>
        <Button onClick={() => push(["home"])}>القائمة الرئيسية</Button>
      </div>
      {node}
    </div>
  );
}
