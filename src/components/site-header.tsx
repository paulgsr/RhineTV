import { Link } from "@tanstack/react-router";
import { Search, Shield, Compass, Inbox, Menu, X } from "lucide-react";
import { useState } from "react";

const navLinks: Array<{
  to: "/" | "/discover" | "/admin/requests" | "/admin";
  label: string;
  icon: typeof Compass | null;
  exact?: boolean;
}> = [
  { to: "/", label: "Library", icon: null, exact: true },
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/admin/requests", label: "Requests", icon: Inbox },
  { to: "/admin", label: "Admin", icon: Shield, exact: true },
];


export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link
          to="/"
          className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground"
          onClick={() => setOpen(false)}
        >
          <img src="/favicon.png" alt="" width={24} height={24} className="h-6 w-6 rounded-sm" />
          <span>RhineTV</span>
        </Link>
        <nav className="hidden items-center gap-4 text-sm text-muted-foreground sm:flex">
          {navLinks.map((l) => {
            const Icon = l.icon;
            return (
              <Link
                key={l.to}
                to={l.to}
                className="flex items-center gap-1 transition-colors hover:text-foreground"
                activeProps={{ className: "text-foreground" }}
                activeOptions={l.exact ? { exact: true } : undefined}
              >
                {Icon && <Icon className="h-3.5 w-3.5" />}
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <Search className="hidden h-3.5 w-3.5 sm:block" />
          <span className="hidden sm:inline">Press / to search</span>
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/60 text-foreground sm:hidden"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-border/40 bg-background/95 px-4 py-2 sm:hidden">
          <ul className="flex flex-col">
            {navLinks.map((l) => {
              const Icon = l.icon;
              return (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                    activeProps={{ className: "text-foreground" }}
                    activeOptions={l.exact ? { exact: true } : undefined}
                  >
                    {Icon && <Icon className="h-4 w-4" />}
                    {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </header>
  );
}
