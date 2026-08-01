import { useEffect, useState, type ReactNode } from "react";
import { NavProvider, useNav } from "./nav";
import { AuthProvider, useAuth } from "./auth";
import { HomeScreen } from "./screens/Home";
import { AccountsModule, AccountsScreen, AccountDetail } from "./screens/Accounts";
import { GatherModule, GatherScreen } from "./screens/Gather";
import { AddModule, AddScreen } from "./screens/Add";
import { RotationModule, RotationScreen } from "./screens/Rotation";
import { ProxyModule, ProxyScreen } from "./screens/Proxy";
import { SettingsModule, SettingsScreen } from "./screens/Settings";
import { ReportsModule, ReportsScreen } from "./screens/Reports";
import { SecurityModule, SecurityScreen } from "./screens/Security";
import { CampaignsModule, CampaignsScreen } from "./screens/Campaigns";
import { MassDmModule, MassDmScreen } from "./screens/MassDm";
import { ExitScreen } from "./screens/Exit";
import { LoginScreen } from "./screens/Login";
import { AdminScreen } from "./screens/Admin";
import { apiFetch, type UserNotices } from "./lib/api";

const MODULE_SCREENS = new Set([
  "accounts", "gather", "add", "rotation", "proxy",
  "settings", "reports", "security", "campaigns", "massdm",
]);

function LockedModuleScreen({ moduleId }: { moduleId: string }) {
  const { back } = useNav();
  return (
    <div className="animate-fade mx-auto max-w-md py-16">
      <div className="card p-8 text-center">
        <div className="text-4xl">🔒</div>
        <h2 className="mt-3 text-lg font-extrabold text-surface-800">هذه الوحدة غير مشمولة بباقتك</h2>
        <p className="mt-2 text-sm text-surface-500">
          الوحدة <span className="font-bold text-surface-700">{moduleId}</span> غير متاحة في اشتراكك الحالي — تواصل مع الإدارة للترقية.
        </p>
        <button className="btn-primary mt-5 w-full" onClick={() => back()}>العودة للرئيسية</button>
      </div>
    </div>
  );
}

/** Expiry warning + admin broadcast bar (polled every ~60s). */
function WarningBar() {
  const { refreshMe, user } = useAuth();
  const [notices, setNotices] = useState<UserNotices | null>(null);
  const [dismissedBroadcast, setDismissedBroadcast] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const data = await apiFetch<UserNotices>("/users/me/notices");
        if (!mounted) return;
        setNotices(data);
        // Sync the user's subscription snapshot so UI gates stay fresh.
        if (data.subscription_status !== user?.subscription_status) void refreshMe();
      } catch {
        /* keep last known state */
      }
    };
    void load();
    const timer = window.setInterval(load, 60000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!notices) return null;

  const bars: ReactNode[] = [];
  const secondsLeft = notices.remaining_seconds;

  if (notices.subscription_status === "expiring_soon" && secondsLeft != null && secondsLeft > 0) {
    const days = Math.floor(secondsLeft / 86400);
    const tone =
      days >= 4
        ? "bg-amber-50 border-amber-300 text-amber-800"
        : days >= 2
          ? "bg-orange-50 border-orange-300 text-orange-800"
          : "bg-red-50 border-red-300 text-red-700";
    const icon = days >= 4 ? "⏳" : days >= 2 ? "⚠️" : "‼️";
    bars.push(
      <div key="expiry" className={`mb-4 rounded-xl border px-4 py-2.5 text-center text-sm font-bold ${tone}`}>
        {icon} اشتراكك ينتهي خلال <span className="mx-1">{notices.remaining_label}</span> — جدّد الآن قبل توقف الخدمة
      </div>,
    );
  }

  if (notices.broadcast && notices.broadcast.sent_at !== dismissedBroadcast) {
    bars.push(
      <div key="broadcast" className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-accent-300 bg-accent-50 px-4 py-2.5 text-sm text-accent-800">
        <div>
          <span className="font-bold">📢 {notices.broadcast.title}: </span>
          {notices.broadcast.message}
        </div>
        <button
          className="text-lg leading-none text-accent-400 hover:text-accent-700"
          onClick={() => setDismissedBroadcast(notices.broadcast!.sent_at)}
          aria-label="إغلاق التنبيه"
        >
          ×
        </button>
      </div>,
    );
  }

  if (bars.length === 0) return null;
  return <div className="animate-fade">{bars}</div>;
}

function Router() {
  const { current } = useNav();
  const { user } = useAuth();
  const [root, ...rest] = current;

  if (root === "home") return <HomeScreen />;
  if (root === "exit") return <ExitScreen />;

  // Admin panel — platform admin only.
  if (root === "admin") {
    if (!user?.platform_admin) return <HomeScreen />;
    return <AdminScreen sub={rest[0]} param={rest[1]} />;
  }

  // Subscription module gate: the screen stays hidden in Home and is
  // blocked here too (defense in depth alongside the backend 403s).
  if (MODULE_SCREENS.has(root) && !user?.platform_admin && !(user?.modules ?? []).includes(root)) {
    return <LockedModuleScreen moduleId={root} />;
  }

  if (rest.length === 0) {
    switch (root) {
      case "accounts": return <AccountsModule />;
      case "gather": return <GatherModule />;
      case "add": return <AddModule />;
      case "rotation": return <RotationModule />;
      case "proxy": return <ProxyModule />;
      case "settings": return <SettingsModule />;
      case "reports": return <ReportsModule />;
      case "security": return <SecurityModule />;
      case "campaigns": return <CampaignsModule />;
      case "massdm": return <MassDmModule />;
    }
  }

  const sub = rest[0];
  switch (root) {
    case "accounts":
      if (sub === "detail" && rest[1]) return <AccountDetail id={rest[1]} />;
      return <AccountsScreen sub={sub} />;
    case "gather":
      return <GatherScreen sub={sub} />;
    case "add":
      return <AddScreen sub={sub} />;
    case "rotation":
      return <RotationScreen sub={sub} />;
    case "proxy":
      return <ProxyScreen sub={sub} />;
    case "reports":
      return <ReportsScreen sub={sub} />;
    case "security":
      return <SecurityScreen sub={sub} />;
    case "campaigns":
      return <CampaignsScreen sub={sub} />;
    case "massdm":
      return <MassDmScreen sub={sub} />;
    case "settings":
      return <SettingsScreen sub={sub} />;
  }

  return <HomeScreen />;
}

function Shell() {
  const { current } = useNav();
  const { user } = useAuth();
  return (
    <div className="min-h-full">
      {!user?.platform_admin && <WarningBar />}
      <Router key={current.join("/")} />
    </div>
  );
}

function ProtectedApp() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="rounded-2xl border border-surface-200 bg-white px-6 py-4 text-sm text-surface-500 shadow-card">
          جاري تحميل الجلسة...
        </div>
      </div>
    );
  }

  if (!user) return <LoginScreen />;

  return (
    <NavProvider>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <Shell />
      </div>
    </NavProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ProtectedApp />
    </AuthProvider>
  );
}
