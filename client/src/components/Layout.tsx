import { Link, useLocation } from "wouter";
import { useTheme } from "./ThemeProvider";
import { Home, BookOpen, Trophy, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/", label: "Главная", icon: Home },
  { href: "/achievements", label: "Достижения", icon: Trophy },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-background" data-testid="app-layout">
      {/* Top nav */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="mx-auto max-w-3xl flex items-center justify-between px-4 h-14">
          {/* Logo */}
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer" data-testid="logo">
              <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-label="Svenska Tutorn">
                <rect x="2" y="2" width="28" height="28" rx="8" className="fill-primary" />
                <text x="16" y="22" textAnchor="middle" className="fill-primary-foreground" fontWeight="700" fontSize="16" fontFamily="var(--font-sans)">S</text>
              </svg>
              <span className="font-bold text-foreground text-base hidden sm:inline">Svenska Tutorn</span>
            </div>
          </Link>

          {/* Navigation */}
          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = location === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    size="sm"
                    className={`gap-1.5 text-sm font-medium rounded-lg ${isActive ? "" : "text-muted-foreground"}`}
                    data-testid={`nav-${item.label}`}
                  >
                    <item.icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{item.label}</span>
                  </Button>
                </Link>
              );
            })}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              className="rounded-lg text-muted-foreground"
              data-testid="theme-toggle"
            >
              {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </Button>
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-3xl px-4 py-6">
        {children}
      </main>
    </div>
  );
}
