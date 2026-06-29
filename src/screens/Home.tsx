import {
  Users, Download, UserPlus, RefreshCw, Globe, Settings, BarChart3,
  Shield, Megaphone, MessageSquare, LogOut, Send, ChevronLeft,
} from "lucide-react";
import { useNav } from "../nav";
import { StatCard } from "../ui";
import { accounts, campaigns, dmCampaigns, proxies } from "../data";

const modules = [
  { id: "accounts",  label: "مدير الحسابات",      desc: "إضافة، استيراد، تهيئة وتحقق",      icon: Users,         tone: "brand"  },
  { id: "gather",    label: "تجميع الأعضاء",       desc: "من المجموعات والقنوات",               icon: Download,      tone: "accent" },
  { id: "add",       label: "إضافة الأعضاء",        desc: "إضافة جماعية للقروبات",               icon: UserPlus,      tone: "brand"  },
  { id: "rotation",  label: "نظام التدوير",          desc: "إدارة تدوير الحسابات",                icon: RefreshCw,     tone: "accent" },
  { id: "proxy",     label: "مدير البروكسي",         desc: "إضافة وتعيين البروكسيهات",            icon: Globe,         tone: "brand"  },
  { id: "settings",  label: "الإعدادات",             desc: "API، الحدود، المسارات",               icon: Settings,      tone: "surface" },
  { id: "reports",   label: "التقارير والسجلات",     desc: "تقارير وسجلات العمليات",              icon: BarChart3,     tone: "accent" },
  { id: "security",  label: "أدوات الأمان",          desc: "قائمة سوداء، حدود ذكية",             icon: Shield,        tone: "brand"  },
  { id: "campaigns", label: "حملات القروبات",        desc: "إنشاء وإدارة الحملات",                icon: Megaphone,     tone: "accent" },
  { id: "massdm",    label: "الرسائل الجماعية",      desc: "Mass DM للمستخدمين",                  icon: MessageSquare, tone: "brand"  },
] as const;

type Tone = "brand" | "accent" | "surface";

const toneMap: Record<Tone, { icon: string; card: string }> = {
  brand:   { icon: "text-brand-600 bg-brand-50 ring-brand-200",       card: "hover:border-brand-300   hover:shadow-[0_4px_20px_-4px_rgba(34,197,94,0.18)]" },
  accent:  { icon: "text-accent-600 bg-accent-50 ring-accent-200",   card: "hover:border-accent-300  hover:shadow-[0_4px_20px_-4px_rgba(59,130,246,0.18)]" },
  surface: { icon: "text-surface-600 bg-surface-100 ring-surface-300", card: "hover:border-surface-400" },
};

export function HomeScreen() {
  const { push } = useNav();
  const activeAccounts  = accounts.filter((a) => a.status === "active").length;
  const activeProxies   = proxies.filter((p) => p.status === "active").length;
  const activeCampaigns = campaigns.filter((c) => c.status === "active").length
                        + dmCampaigns.filter((c) => c.status === "active").length;
  return (
    <div className="animate-fade">
      <div className="mb-8 overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-card">
        <div className="relative bg-gradient-to-l from-brand-50 via-white to-white px-6 py-8 sm:px-10">
          <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at 90% 50%, rgba(34,197,94,.18), transparent 55%)" }} />
          <div className="relative flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-600 text-white shadow-soft">
              <Send className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-surface-800 sm:text-3xl">Axogram Pro</h1>
              <p className="text-sm text-surface-500">لوحة إدارة حسابات وحملات تيليجرام</p>
            </div>
          </div>
          <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="حسابات نشطة"  value={activeAccounts}  icon={<Users className="h-4 w-4"/>}     tone="brand"  />
            <StatCard label="بروكسي نشط"   value={activeProxies}   icon={<Globe className="h-4 w-4"/>}     tone="accent" />
            <StatCard label="حملات نشطة"   value={activeCampaigns} icon={<Megaphone className="h-4 w-4"/>}  tone="warn"   />
            <StatCard label="قروبات"        value={5}               icon={<BarChart3 className="h-4 w-4"/>}  tone="brand"  />
          </div>
        </div>
      </div>
      <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-surface-400">الوحدات</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((m) => {
          const Icon = m.icon;
          const t = toneMap[m.tone];
          return (
            <button key={m.id} onClick={() => push([m.id])}
              className={`group card flex items-center gap-4 p-5 text-right transition-all hover:-translate-y-0.5 ${t.card}`}>
              <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ring-1 transition-transform group-hover:scale-105 ${t.icon}`}>
                <Icon className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-surface-800">{m.label}</div>
                <div className="text-xs text-surface-500 mt-0.5">{m.desc}</div>
              </div>
              <ChevronLeft className="h-4 w-4 shrink-0 text-surface-300 transition group-hover:text-brand-400 group-hover:-translate-x-0.5" />
            </button>
          );
        })}
      </div>
      <div className="mt-6">
        <button onClick={() => push(["exit"])} className="btn-danger w-full py-3">
          <LogOut className="h-4 w-4" /> خروج
        </button>
      </div>
    </div>
  );
}
