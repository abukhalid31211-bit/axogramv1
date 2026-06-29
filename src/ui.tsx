import { type ReactNode, useState } from "react";
import {
  ChevronLeft,
  Home,
  Check,
  X,
  AlertTriangle,
  Info,
  Loader2,
  Search,
} from "lucide-react";
import { useNav } from "./nav";

export function PageHeader({
  title,
  subtitle,
  icon,
  steps,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  steps?: { label: string; n: number; total: number };
}) {
  const { back, home } = useNav();
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={back}
            className="grid h-10 w-10 place-items-center rounded-xl border border-ink-600/60 bg-ink-800/60 text-slate-300 hover:bg-ink-700/60"
            title="رجوع"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          {icon && (
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-500/15 text-brand-300 ring-1 ring-brand-500/30">
              {icon}
            </div>
          )}
          <div>
            <h1 className="text-lg font-bold text-white sm:text-xl">{title}</h1>
            {subtitle && <p className="text-xs text-slate-400 sm:text-sm">{subtitle}</p>}
          </div>
        </div>
        <button
          onClick={home}
          className="hidden items-center gap-2 rounded-xl border border-ink-600/60 bg-ink-800/60 px-3 py-2 text-xs text-slate-300 hover:bg-ink-700/60 sm:inline-flex"
        >
          <Home className="h-4 w-4" /> الرئيسية
        </button>
      </div>
      {steps && (
        <div className="mt-4 flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-full bg-brand-500/10 px-3 py-1 text-xs font-medium text-brand-300 ring-1 ring-brand-500/30">
            خطوة {steps.n} / {steps.total}
          </div>
          <div className="text-xs text-slate-400">{steps.label}</div>
          <div className="ml-auto flex gap-1.5">
            {Array.from({ length: steps.total }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 w-8 rounded-full ${i < steps.n ? "bg-brand-500" : "bg-ink-600/60"}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = "ghost",
  icon,
  className = "",
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger" | "warn";
  icon?: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const cls = {
    primary: "btn-primary",
    ghost: "btn-ghost",
    danger: "btn-danger",
    warn: "btn-warn",
  }[variant];
  return (
    <button onClick={onClick} disabled={disabled} className={`${cls} ${className} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}>
      {icon}
      {children}
    </button>
  );
}

export function Field({
  label,
  placeholder,
  value,
  onChange,
  type = "text",
  hint,
  icon,
}: {
  label?: string;
  placeholder?: string;
  value?: string;
  onChange?: (v: string) => void;
  type?: string;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <div>
      {label && <label className="label">{label}</label>}
      <div className="relative">
        {icon && <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">{icon}</div>}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          className={`field ${icon ? "pr-10" : ""}`}
        />
      </div>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function TextArea({
  label,
  placeholder,
  value,
  onChange,
  rows = 4,
}: {
  label?: string;
  placeholder?: string;
  value?: string;
  onChange?: (v: string) => void;
  rows?: number;
}) {
  return (
    <div>
      {label && <label className="label">{label}</label>}
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className="field resize-y leading-relaxed"
      />
    </div>
  );
}

export function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: ReactNode;
  checked: boolean;
  onChange?: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange?.(!checked)}
      className="flex w-full items-center gap-3 rounded-xl border border-ink-600/50 bg-ink-850/50 px-3.5 py-2.5 text-right transition hover:bg-ink-700/40"
    >
      <span
        className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border transition ${
          checked ? "border-brand-400 bg-brand-500 text-white" : "border-ink-500 bg-ink-900"
        }`}
      >
        {checked && <Check className="h-3.5 w-3.5" />}
      </span>
      <span className="text-sm text-slate-200">{label}</span>
    </button>
  );
}

export function OptionButton({
  label,
  desc,
  selected,
  onClick,
  badge,
}: {
  label: ReactNode;
  desc?: string;
  selected?: boolean;
  onClick?: () => void;
  badge?: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-right transition ${
        selected
          ? "border-brand-400 bg-brand-500/10 ring-1 ring-brand-500/40"
          : "border-ink-600/60 bg-ink-850/50 hover:bg-ink-700/40"
      }`}
    >
      <div>
        <div className="text-sm font-medium text-slate-100">{label}</div>
        {desc && <div className="text-xs text-slate-400">{desc}</div>}
      </div>
      <div className="flex items-center gap-2">
        {badge}
        <span
          className={`grid h-5 w-5 place-items-center rounded-full border ${
            selected ? "border-brand-400 bg-brand-500" : "border-ink-500"
          }`}
        >
          {selected && <Check className="h-3 w-3 text-white" />}
        </span>
      </div>
    </button>
  );
}

export function Progress({
  value,
  label,
  sub,
  tone = "brand",
}: {
  value: number;
  label?: string;
  sub?: string;
  tone?: "brand" | "accent" | "warn" | "danger";
}) {
  const toneCls = {
    brand: "bg-brand-500",
    accent: "bg-accent-500",
    warn: "bg-warn-500",
    danger: "bg-danger-500",
  }[tone];
  return (
    <div>
      {(label || sub) && (
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="text-slate-300">{label}</span>
          <span className="text-slate-400">{sub}</span>
        </div>
      )}
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-ink-700/70">
        <div className={`h-full rounded-full ${toneCls} transition-all`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export function StatusChip({ status }: { status: "active" | "blocked" | "restricted" | "dead" | "slow" | "draft" | "paused" | "done" }) {
  const map = {
    active: { cls: "bg-brand-500/15 text-brand-300 ring-brand-500/30", label: "نشط" },
    blocked: { cls: "bg-danger-500/15 text-danger-400 ring-danger-500/30", label: "محظور" },
    restricted: { cls: "bg-warn-500/15 text-warn-400 ring-warn-500/30", label: "مقيد" },
    dead: { cls: "bg-danger-500/15 text-danger-400 ring-danger-500/30", label: "ميت" },
    slow: { cls: "bg-warn-500/15 text-warn-400 ring-warn-500/30", label: "بطيء" },
    draft: { cls: "bg-ink-600/40 text-slate-300 ring-ink-500/40", label: "مسودة" },
    paused: { cls: "bg-warn-500/15 text-warn-400 ring-warn-500/30", label: "متوقفة" },
    done: { cls: "bg-brand-500/15 text-brand-300 ring-brand-500/30", label: "مكتملة" },
  }[status];
  return <span className={`chip ring-1 ${map.cls}`}>{map.label}</span>;
}

export function Table({ columns, rows }: { columns: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-ink-700/60">
      <table className="w-full text-right text-sm">
        <thead>
          <tr className="bg-ink-800/70 text-xs text-slate-400">
            {columns.map((c, i) => (
              <th key={i} className="whitespace-nowrap px-4 py-3 font-medium">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-700/50">
          {rows.map((r, i) => (
            <tr key={i} className="row-hover">
              {r.map((c, j) => (
                <td key={j} className="px-4 py-3 text-slate-200">{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SectionTitle({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      {icon && <span className="text-brand-300">{icon}</span>}
      <h3 className="text-sm font-bold text-slate-200">{children}</h3>
    </div>
  );
}

export function Alert({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "success" | "warn" | "danger";
  title?: string;
  children?: ReactNode;
}) {
  const map = {
    info: { cls: "border-accent-500/40 bg-accent-500/10 text-accent-400", Icon: Info },
    success: { cls: "border-brand-500/40 bg-brand-500/10 text-brand-300", Icon: Check },
    warn: { cls: "border-warn-500/40 bg-warn-500/10 text-warn-400", Icon: AlertTriangle },
    danger: { cls: "border-danger-500/40 bg-danger-500/10 text-danger-400", Icon: AlertTriangle },
  }[tone];
  const Icon = map.Icon;
  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${map.cls}`}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        {title && <div className="text-sm font-bold">{title}</div>}
        {children && <div className="text-xs opacity-90">{children}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "تأكيد",
  cancelLabel = "إلغاء",
  onConfirm,
  onCancel,
  danger,
}: {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink-950/70 p-4 backdrop-blur-sm">
      <div className="card w-full max-w-md animate-fade p-6">
        <div className="mb-3 flex items-center gap-3">
          <div className={`grid h-10 w-10 place-items-center rounded-xl ${danger ? "bg-danger-500/15 text-danger-400" : "bg-warn-500/15 text-warn-400"}`}>
            <AlertTriangle className="h-5 w-5" />
          </div>
          <h3 className="text-base font-bold text-white">{title}</h3>
        </div>
        {message && <p className="mb-5 text-sm text-slate-300">{message}</p>}
        <div className="flex gap-2">
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} className="flex-1">{confirmLabel}</Button>
          <Button variant="ghost" onClick={onCancel} className="flex-1">{cancelLabel}</Button>
        </div>
      </div>
    </div>
  );
}

export function useToast() {
  const [msg, setMsg] = useState<{ text: string; tone: "success" | "danger" | "info" } | null>(null);
  const show = (text: string, tone: "success" | "danger" | "info" = "success") => {
    setMsg({ text, tone });
    setTimeout(() => setMsg(null), 2600);
  };
  const node = msg ? (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-fade">
      <div
        className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm shadow-card ${
          msg.tone === "success"
            ? "border-brand-500/40 bg-brand-500/15 text-brand-200"
            : msg.tone === "danger"
            ? "border-danger-500/40 bg-danger-500/15 text-danger-300"
            : "border-accent-500/40 bg-accent-500/15 text-accent-300"
        }`}
      >
        {msg.tone === "success" ? <Check className="h-4 w-4" /> : <Info className="h-4 w-4" />}
        {msg.text}
      </div>
    </div>
  ) : null;
  return { show, node };
}

export function SearchInput({ value, onChange, placeholder = "بحث..." }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="field py-2 pr-10" />
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-6 text-slate-400">
      <Loader2 className="h-5 w-5 animate-spin text-brand-400" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}

export function EmptyState({ icon, title, desc }: { icon?: ReactNode; title: string; desc?: string }) {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed border-ink-600/60 bg-ink-850/30 py-10 text-center">
      {icon && <div className="mb-2 text-slate-500">{icon}</div>}
      <div className="text-sm font-medium text-slate-300">{title}</div>
      {desc && <div className="mt-1 text-xs text-slate-500">{desc}</div>}
    </div>
  );
}

export function StatCard({ label, value, icon, tone = "brand" }: { label: string; value: ReactNode; icon?: ReactNode; tone?: "brand" | "accent" | "warn" | "danger" }) {
  const toneCls = {
    brand: "text-brand-300 bg-brand-500/10 ring-brand-500/30",
    accent: "text-accent-400 bg-accent-500/10 ring-accent-500/30",
    warn: "text-warn-400 bg-warn-500/10 ring-warn-500/30",
    danger: "text-danger-400 bg-danger-500/10 ring-danger-500/30",
  }[tone];
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">{label}</span>
        {icon && <span className={`grid h-8 w-8 place-items-center rounded-lg ring-1 ${toneCls}`}>{icon}</span>}
      </div>
      <div className="mt-2 text-2xl font-bold text-white">{value}</div>
    </div>
  );
}

export function Tabs({ tabs, active, onChange }: { tabs: { id: string; label: string }[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5 rounded-xl border border-ink-700/60 bg-ink-850/50 p-1.5">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`rounded-lg px-3.5 py-2 text-xs font-medium transition ${
            active === t.id ? "bg-brand-500 text-white shadow-glow" : "text-slate-300 hover:bg-ink-700/50"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function IconClose({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-ink-700/50 hover:text-slate-200">
      <X className="h-4 w-4" />
    </button>
  );
}
