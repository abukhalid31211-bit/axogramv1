import { NavProvider, useNav } from "./nav";
import { HomeScreen } from "./screens/Home";
import { AccountsModule, AccountsScreen, AccountDetail } from "./screens/Accounts";
import { GatherModule, GatherScreen } from "./screens/Gather";
import { AddModule, AddScreen } from "./screens/Add";
import { RotationModule, RotationScreen } from "./screens/Rotation";
import { ProxyModule, ProxyScreen } from "./screens/Proxy";
import { SettingsModule } from "./screens/Settings";
import { ReportsModule, ReportsScreen } from "./screens/Reports";
import { SecurityModule, SecurityScreen } from "./screens/Security";
import { CampaignsModule, CampaignsScreen } from "./screens/Campaigns";
import { MassDmModule, MassDmScreen } from "./screens/MassDm";
import { ExitScreen } from "./screens/Exit";

function Router() {
  const { current } = useNav();
  const [root, ...rest] = current;

  if (root === "home") return <HomeScreen />;
  if (root === "exit") return <ExitScreen />;

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
  }

  return <HomeScreen />;
}

function Shell() {
  const { current } = useNav();
  return (
    <div className="min-h-full">
      <Router key={current.join("/")} />
    </div>
  );
}

export default function App() {
  return (
    <NavProvider>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <Shell />
      </div>
    </NavProvider>
  );
}
