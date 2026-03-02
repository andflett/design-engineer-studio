import { useState } from "react";
import { DashboardPage } from "@/pages/DashboardPage";
import { ComponentsPage } from "@/pages/ComponentsPage";
import { TokensPage } from "@/pages/TokensPage";
import { Button } from "@/components/ui/button";

const tabs = ["Dashboard", "Components", "Tokens"] as const;
type Tab = (typeof tabs)[number];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("Dashboard");
  const [dark, setDark] = useState(false);

  function toggleDark() {
    setDark((d) => {
      document.documentElement.classList.toggle("dark", !d);
      return !d;
    });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <h1 className="text-sm font-bold tracking-tight">
              designtools / vite
            </h1>
            <nav className="flex gap-1">
              {tabs.map((tab) => (
                <Button
                  key={tab}
                  variant={activeTab === tab ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </Button>
              ))}
            </nav>
          </div>
          <Button variant="outline" size="sm" onClick={toggleDark}>
            {dark ? "Light" : "Dark"}
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {activeTab === "Dashboard" && <DashboardPage />}
        {activeTab === "Components" && <ComponentsPage />}
        {activeTab === "Tokens" && <TokensPage />}
      </main>
    </div>
  );
}
