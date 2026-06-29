import {
  Users,
  Download,
  UserPlus,
  RefreshCw,
  Globe,
  Settings,
  BarChart3,
  Shield,
  Megaphone,
  MessageSquare,
  LogOut,
  Send,
} from "lucide-react";
import { useNav } from "../nav";
import { StatCard } from "../ui";
import { accounts, campaigns, dmCampaigns, proxies } from "../data";

const modules = [
  { id: "accounts", label: "مدير الحسابات", desc: "إضافة، استيراد، تهيئة وتحقق", icon: Users, tone: "text-brand-300 bg-brand-500/10 ring-brand-500/30" },
  { id: "gather", label: "تجميع الأعضاء", desc: "من المجموعات والقنوات", icon: Download, tone: "text-accent-400 bg-accent-500/10 ring-accent-500/30" },
  { id: "add", label: "إضافة الأعضاء", desc: "إضافة جماعية للقروبات", icon: UserPlus, tone: "text-brand-300 bg-brand-500/10 ring-brand-500/30" },
  { id: "rotation", label: "نظام التدوير", desc: "إدارة تدوير الحسابات", icon: RefreshCw, tone: "text-accent-400 bg-accent-500/10 ring-accent-500/30" },
  { id: "proxy", label: "مدير البروكسي", desc: "إضافة وتعيين البروكسيهات", icon: Globe, tone: "text-brand-300 bg-brand-500/10 ring-brand-500/30" },
  { id: "settings", label: "الإعدادات", desc: "API، الحدود، المسارات", icon: Settings, tone: "text-slate-300 bg-ink-600/40 ring-ink-500/40" },
  { id: "reports", label: "التقارير والسجلات", desc: "تقارير وسجلات العمليات", icon: BarChart3, tone: "text-accent-400 bg-accent-500/10 ring-accent-500/30" },
  { id: "security", label: "أدوات الأمان", desc: "قائمة سوداء، حدود ذكية", icon: Shield, tone: "text-brand-300 bg-brand-500/10 ring-brand-500/30" },
  { id: "campaigns", label: "حملات القروبات", desc: "إنشاء وإدارة الحملات", icon: Megaphone, tone: "text-accent-400 bg-accent-500/10 ring-accent-500/30" },
  { id: "massdm", label: "الرسائل الجماعية", desc: "Mass DM للمستخدمين", icon: MessageSquare, tone: "text-brand-300 bg-brand-500/10 ring-brand-500/30" },
];

export function HomeScreen() {
  const { push } = useNav();
  const activeAccounts = accounts.filter((a) => a.status === "active").length;
  const activeProxies = proxies.filter((p) => p.status === "active").length;
  const activeCampaigns = campaigns.filter((c) => c.status === "active").length + dmCampaigns.filter((c) => c.status === "active").length;

  return (
    <div className="animate-fade">
      <div className="mb-8 overflow-hidden rounded-2xl border border-ink-700/60 bg-gradient-to-l from-brand-500/10 via-ink-900/60 to-ink-900/60 p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand-500 text-white shadow-glow">
            <Send className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white sm:text-3xl">Axogram Pro</h1>
            <p className="text-sm text-slate-400">لوحة إدارة حسابات وحملات تيليجرام</p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="حسابات نشطة" value={activeAccounts} icon={<Users className="h-4 w-4" />} tone="brand" />
          <StatCard label="بروكسي نشط" value={activeProxies} icon={<Globe className="h-4 w-4" />} tone="accent" />
          <StatCard label="حملات نشطة" value={activeCampaigns} icon={<Megaphone className="h-4 w-4" />} tone="warn" />
          <StatCard label="قروبات" value={5} icon={<BarChart3 className="h-4 w-4" />} tone="brand" />
        </div>
      </div>

      <h2 className="mb-4 text-sm font-bold text-slate-300">الوحدات</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((m) => {
          const Icon = m.icon;
          return (
            <button
              key={m.id}
              onClick={() => push([m.id])}
              className="group card flex items-center gap-4 p-5 text-right transition hover:-translate-y-0.5 hover:border-brand-500/40 hover:shadow-glow"
            >
              <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ring-1 ${m.tone}`}>
                <Icon className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-white">{m.label}</div>
                <div className="text-xs text-slate-400">{m.desc}</div>
              </div>
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
