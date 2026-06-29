import { type ReactNode, useState, useRef, useEffect } from "react";
import {
  ChevronLeft, Home, Check, X, AlertTriangle, Info, Loader2, Search, Pencil, Trash2,
} from "lucide-react";
import { useNav } from "./nav";

export function PageHeader({ title, subtitle, icon, steps }: {
  title: string; subtitle?: string; icon?: ReactNode;
  steps?: { label: string; n: number; total: number };
}) {
  const { back, home } = useNav();
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={back} className="grid h-10 w-10 place-items-center rounded-xl border border-surface-300 bg-white text-surface-600 shadow-soft hover:bg-surface-100 transition" title="رجوع">
            <ChevronLeft className="h-5 w-5" />
          </button>
          {icon && <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-200">{icon}</div>}
          <div>
            <h1 className="text-lg font-bold text-surface-800 sm:text-xl">{title}</h1>
            {subtitle && <p className="text-xs text-surface-500 sm:text-sm">{subtitle}</p>}
          </div>
        </div>
        <button onClick={home} className="hidden items-center gap-2 rounded-xl border border-surface-300 bg-white px-3 py-2 text-xs text-surface-600 shadow-soft hover:bg-surface-100 transition sm:inline-flex">
          <Home className="h-4 w-4" /> الرئيسية
        </button>
      </div>
      {steps && (
        <div className="mt-4 flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 ring-1 ring-brand-200">خطوة {steps.n} / {steps.total}</div>
          <div className="text-xs text-surface-500">{steps.label}</div>
          <div className="ml-auto flex gap-1.5">
            {Array.from({ length: steps.total }).map((_, i) => (
              <div key={i} className={`h-1.5 w-8 rounded-full transition-colors ${i < steps.n ? "bg-brand-500" : "bg-surface-300"}`} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function Button({ children, onClick, variant = "ghost", icon, className = "", disabled }: {
  children: ReactNode; onClick?: () => void; variant?: "primary"|"ghost"|"danger"|"warn";
  icon?: ReactNode; className?: string; disabled?: boolean;
}) {
  const cls = { primary:"btn-primary", ghost:"btn-ghost", danger:"btn-danger", warn:"btn-warn" }[variant];
  return (
    <button onClick={onClick} disabled={disabled} className={`${cls} ${className} ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}>
      {icon}{children}
    </button>
  );
}

export function Field({ label, placeholder, value, onChange, type = "text", hint, icon }: {
  label?: string; placeholder?: string; value?: string; onChange?: (v: string) => void;
  type?: string; hint?: string; icon?: ReactNode;
}) {
  return (
    <div>
      {label && <label className="label">{label}</label>}
      <div className="relative">
        {icon && <div className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400">{icon}</div>}
        <input type={type} value={value} onChange={(e) => onChange?.(e.target.value)} placeholder={placeholder} className={`field ${icon ? "pr-10" : ""}`} />
      </div>
      {hint && <p className="mt-1 text-xs text-surface-500">{hint}</p>}
    </div>
  );
}

export function TextArea({ label, placeholder, value, onChange, rows = 4 }: {
  label?: string; placeholder?: string; value?: string; onChange?: (v: string) => void; rows?: number;
}) {
  return (
    <div>
      {label && <label className="label">{label}</label>}
      <textarea rows={rows} value={value} onChange={(e) => onChange?.(e.target.value)} placeholder={placeholder} className="field resize-y leading-relaxed" />
    </div>
  );
}

export function InlineEdit({ label, value, onSave, onDelete, placeholder = "أدخل القيمة..." }: {
  label: string; value: string; onSave: (v: string) => void; onDelete?: () => void; placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editing) { setDraft(value); inputRef.current?.focus(); inputRef.current?.select(); }
  }, [editing, value]);
  const confirm = () => { if (draft.trim()) { onSave(draft.trim()); } setEditing(false); };
  const cancel  = () => { setDraft(value); setEditing(false); };
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-surface-200 bg-surface-50 px-3.5 py-2.5">
      <span className="min-w-0 shrink-0 text-xs font-semibold text-surface-500">{label}</span>
      {editing ? (
        <div className="flex flex-1 items-center gap-1.5">
          <input ref={inputRef} value={draft} onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") confirm(); if (e.key === "Escape") cancel(); }}
            placeholder={placeholder} className="field min-w-0 flex-1 py-1.5 text-sm" />
          <button onClick={confirm} className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white hover:bg-brand-500 transition shrink-0" title="تأكيد"><Check className="h-4 w-4" /></button>
          <button onClick={cancel} className="grid h-8 w-8 place-items-center rounded-lg border border-surface-300 bg-white text-surface-500 hover:bg-surface-100 transition shrink-0" title="إلغاء"><X className="h-4 w-4" /></button>
          {onDelete && <button onClick={() => { onDelete(); setEditing(false); }} className="grid h-8 w-8 place-items-center rounded-lg bg-danger-50 text-danger-500 hover:bg-danger-100 transition shrink-0" title="حذف"><Trash2 className="h-4 w-4" /></button>}
        </div>
      ) : (
        <button onClick={() => setEditing(true)} className="group flex flex-1 items-center justify-end gap-2 text-sm font-medium text-surface-700 hover:text-brand-700 transition">
          <span className="truncate">{value || <span className="text-surface-400 italic">{placeholder}</span>}</span>
          <Pencil className="h-3.5 w-3.5 shrink-0 opacity-0 group-hover:opacity-60 transition" />
        </button>
      )}
    </div>
  );
}

export function Checkbox({ label, checked, onChange }: { label: ReactNode; checked: boolean; onChange?: (v: boolean) => void; }) {
  return (
    <button onClick={() => onChange?.(!checked)} className="flex w-full items-center gap-3 rounded-xl border border-surface-200 bg-surface-50 px-3.5 py-2.5 text-right transition hover:bg-surface-100">
      <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border transition ${checked ? "border-brand-500 bg-brand-600 text-white" : "border-surface-300 bg-white"}`}>
        {checked && <Check className="h-3.5 w-3.5" />}
      </span>
      <span className="text-sm text-surface-700">{label}</span>
    </button>
  );
}

export function OptionButton({ label, desc, selected, onClick, badge }: {
  label: ReactNode; desc?: string; selected?: boolean; onClick?: () => void; badge?: ReactNode;
}) {
  return (
    <button onClick={onClick} className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-right transition ${selected ? "border-brand-400 bg-brand-50 ring-1 ring-brand-300" : "border-surface-200 bg-white hover:bg-surface-50 hover:border-surface-300"}`}>
      <div className="flex-1">
        <div className="text-sm font-medium text-surface-800">{label}</div>
        {desc && <div className="text-xs text-surface-500 mt-0.5">{desc}</div>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {badge}
        <span className={`grid h-5 w-5 place-items-center rounded-full border transition ${selected ? "border-brand-500 bg-brand-600" : "border-surface-300 bg-white"}`}>
          {selected && <Check className="h-3 w-3 text-white" />}
        </span>
      </div>
    </button>
  );
}

export function Progress({ value, label, sub, tone = "brand" }: {
  value: number; label?: string; sub?: string; tone?: "brand"|"accent"|"warn"|"danger";
}) {
  const bar   = { brand:"bg-brand-500", accent:"bg-accent-500", warn:"bg-warn-500", danger:"bg-danger-500" }[tone];
  const track = { brand:"bg-brand-100", accent:"bg-accent-100", warn:"bg-warn-100", danger:"bg-danger-100" }[tone];
  return (
    <div>
      {(label || sub) && <div className="mb-1.5 flex items-center justify-between text-xs"><span className="text-surface-600">{label}</span><span className="text-surface-400">{sub}</span></div>}
      <div className={`h-2.5 w-full overflow-hidden rounded-full ${track}`}>
        <div className={`h-full rounded-full ${bar} transition-all`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
    </div>
  );
}

export function StatusChip({ status }: { status: "active"|"blocked"|"restricted"|"dead"|"slow"|"draft"|"paused"|"done"; }) {
  const map = {
    active:     { cls: "bg-brand-50 text-brand-700 ring-brand-200",       label: "نشط"     },
    blocked:    { cls: "bg-danger-50 text-danger-700 ring-danger-200",     label: "محظور"   },
    restricted: { cls: "bg-warn-50 text-warn-700 ring-warn-200",           label: "مقيد"    },
    dead:       { cls: "bg-danger-50 text-danger-700 ring-danger-200",     label: "ميت"     },
    slow:       { cls: "bg-warn-50 text-warn-700 ring-warn-200",           label: "بطيء"    },
    draft:      { cls: "bg-surface-100 text-surface-600 ring-surface-300", label: "مسودة"   },
    paused:     { cls: "bg-warn-50 text-warn-700 ring-warn-200",           label: "متوقفة"  },
    done:       { cls: "bg-brand-50 text-brand-700 ring-brand-200",        label: "مكتملة"  },
  }[status];
  return <span className={`chip ring-1 ${map.cls}`}>{map.label}</span>;
}

export function Table({ columns, rows }: { columns: string[]; rows: ReactNode[][]; }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-surface-200 shadow-soft">
      <table className="w-full text-right text-sm">
        <thead><tr className="bg-surface-50 text-xs text-surface-500 border-b border-surface-200">{columns.map((c,i) => <th key={i} className="whitespace-nowrap px-4 py-3 font-semibold">{c}</th>)}</tr></thead>
        <tbody className="divide-y divide-surface-100 bg-white">{rows.map((r,i) => <tr key={i} className="row-hover">{r.map((c,j) => <td key={j} className="px-4 py-3 text-surface-700">{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export function SectionTitle({ children, icon }: { children: ReactNode; icon?: ReactNode; }) {
  return <div className="mb-3 flex items-center gap-2">{icon && <span className="text-brand-500">{icon}</span>}<h3 className="text-sm font-bold text-surface-700">{children}</h3></div>;
}

export function Alert({ tone = "info", title, children }: { tone?: "info"|"success"|"warn"|"danger"; title?: string; children?: ReactNode; }) {
  const map = {
    info:    { cls: "border-accent-300  bg-accent-50  text-accent-700",  Icon: Info },
    success: { cls: "border-brand-300   bg-brand-50   text-brand-700",   Icon: Check },
    warn:    { cls: "border-warn-300    bg-warn-50    text-warn-700",    Icon: AlertTriangle },
    danger:  { cls: "border-danger-300  bg-danger-50  text-danger-700",  Icon: AlertTriangle },
  }[tone];
  const Icon = map.Icon;
  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${map.cls}`}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <div>{title && <div className="text-sm font-bold">{title}</div>}{children && <div className="text-xs mt-0.5 opacity-80">{children}</div>}</div>
    </div>
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel="تأكيد", cancelLabel="إلغاء", onConfirm, onCancel, danger }: {
  open: boolean; title: string; message?: string; confirmLabel?: string; cancelLabel?: string;
  onConfirm: () => void; onCancel: () => void; danger?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/20 p-4 backdrop-blur-[2px]">
      <div className="card w-full max-w-md animate-fade p-6 shadow-pop">
        <div className="mb-3 flex items-center gap-3">
          <div className={`grid h-10 w-10 place-items-center rounded-xl ${danger ? "bg-danger-50 text-danger-500" : "bg-warn-50 text-warn-600"}`}><AlertTriangle className="h-5 w-5" /></div>
          <h3 className="text-base font-bold text-surface-800">{title}</h3>
        </div>
        {message && <p className="mb-5 text-sm text-surface-600">{message}</p>}
        <div className="flex gap-2">
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} className="flex-1">{confirmLabel}</Button>
          <Button variant="ghost" onClick={onCancel} className="flex-1">{cancelLabel}</Button>
        </div>
      </div>
    </div>
  );
}

export function useToast() {
  const [msg, setMsg] = useState<{ text: string; tone: "success"|"danger"|"info" } | null>(null);
  const show = (text: string, tone: "success"|"danger"|"info" = "success") => { setMsg({ text, tone }); setTimeout(() => setMsg(null), 2600); };
  const node = msg ? (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-fade pointer-events-none">
      <div className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm shadow-pop ${
        msg.tone === "success" ? "border-brand-300 bg-brand-50 text-brand-700"
        : msg.tone === "danger" ? "border-danger-300 bg-danger-50 text-danger-700"
        : "border-accent-300 bg-accent-50 text-accent-700"}`}>
        {msg.tone === "success" ? <Check className="h-4 w-4" /> : <Info className="h-4 w-4" />}{msg.text}
      </div>
    </div>
  ) : null;
  return { show, node };
}

export function SearchInput({ value, onChange, placeholder = "بحث..." }: { value: string; onChange: (v: string) => void; placeholder?: string; }) {
  return (
    <div className="relative">
      <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="field py-2 pr-10" />
    </div>
  );
}

export function Spinner({ label }: { label?: string; }) {
  return <div className="flex items-center justify-center gap-2 py-6 text-surface-400"><Loader2 className="h-5 w-5 animate-spin text-brand-500" />{label && <span className="text-sm">{label}</span>}</div>;
}

export function EmptyState({ icon, title, desc }: { icon?: ReactNode; title: string; desc?: string; }) {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed border-surface-300 bg-surface-50 py-10 text-center">
      {icon && <div className="mb-2 text-surface-300">{icon}</div>}
      <div className="text-sm font-semibold text-surface-500">{title}</div>
      {desc && <div className="mt-1 text-xs text-surface-400">{desc}</div>}
    </div>
  );
}

export function StatCard({ label, value, icon, tone = "brand" }: {
  label: string; value: ReactNode; icon?: ReactNode; tone?: "brand"|"accent"|"warn"|"danger";
}) {
  const iconCls = { brand:"text-brand-600 bg-brand-50 ring-brand-200", accent:"text-accent-600 bg-accent-50 ring-accent-200", warn:"text-warn-600 bg-warn-50 ring-warn-200", danger:"text-danger-600 bg-danger-50 ring-danger-200" }[tone];
  const valCls  = { brand:"text-brand-700", accent:"text-accent-700", warn:"text-warn-700", danger:"text-danger-700" }[tone];
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-surface-500">{label}</span>
        {icon && <span className={`grid h-8 w-8 place-items-center rounded-lg ring-1 ${iconCls}`}>{icon}</span>}
      </div>
      <div className={`mt-2 text-2xl font-extrabold ${valCls}`}>{value}</div>
    </div>
  );
}

export function Tabs({ tabs, active, onChange }: { tabs: { id: string; label: string }[]; active: string; onChange: (id: string) => void; }) {
  return (
    <div className="flex flex-wrap gap-1.5 rounded-xl border border-surface-200 bg-surface-100 p-1.5">
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)} className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition ${active === t.id ? "bg-white text-brand-700 shadow-soft border border-surface-200" : "text-surface-500 hover:text-surface-700 hover:bg-surface-200"}`}>{t.label}</button>
      ))}
    </div>
  );
}

export function IconClose({ onClick }: { onClick: () => void; }) {
  return <button onClick={onClick} className="grid h-9 w-9 place-items-center rounded-lg text-surface-400 hover:bg-surface-100 hover:text-surface-700 transition"><X className="h-4 w-4" /></button>;
}
