import { Link } from "@tanstack/react-router";
import {
  Search,
  Shield,
  Compass,
  Inbox,
  Menu,
  X,
  Library,
  ChevronRight,
} from "lucide-react";
import { useEffect, useState } from "react";

const navLinks: Array<{
  to: "/" | "/discover" | "/admin/requests" | "/admin";
  label: string;
  description: string;
  icon: typeof Compass;
  exact?: boolean;
}> = [
  {
    to: "/",
    label: "Library",
    description: "Everything on the server",
    icon: Library,
    exact: true,
  },
  {
    to: "/discover",
    label: "Discover",
    description: "Find something new to request",
    icon: Compass,
  },
  {
    to: "/admin/requests",
    label: "Requests",
    description: "Pending & recent requests",
    icon: Inbox,
  },
  {
    to: "/admin",
    label: "Admin",
    description: "Library & server settings",
    icon: Shield,
    exact: true,
  },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  // Lock body scroll + close on Escape while the sheet is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link
          to="/"
          className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground"
          onClick={() => setOpen(false)}
        >
          <img
            src="/favicon.png"
            alt=""
            width={24}
            height={24}
            className="h-6 w-6 rounded-sm"
          />
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
                <Icon className="h-3.5 w-3.5" />
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
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-full bg-muted/60 text-foreground transition-colors hover:bg-muted sm:hidden"
          >
            <Menu
              className={`h-4 w-4 transition-all duration-200 ${
                open ? "rotate-90 scale-75 opacity-0" : "rotate-0 scale-100 opacity-100"
              }`}
            />
            <X
              className={`absolute h-4 w-4 transition-all duration-200 ${
                open ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-75 opacity-0"
              }`}
            />
          </button>
        </div>
      </div>

      {/* iOS-style sheet overlay (mobile only) */}
      <div
        className={`fixed inset-x-0 top-14 bottom-0 z-30 sm:hidden ${
          open ? "pointer-events-auto" : "pointer-events-none"
        }`}
        aria-hidden={!open}
      >
        {/* Dim + blur backdrop */}
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className={`absolute inset-0 bg-background/40 backdrop-blur-md transition-opacity duration-300 ${
            open ? "opacity-100" : "opacity-0"
          }`}
        />

        {/* Sheet */}
        <div
          className={`absolute inset-x-0 top-0 origin-top transition-all duration-300 ease-out ${
            open
              ? "translate-y-0 opacity-100"
              : "-translate-y-2 opacity-0"
          }`}
        >
          <div className="mx-3 mt-2 overflow-hidden rounded-2xl border border-border/60 bg-background/95 shadow-2xl backdrop-blur-xl">
            <ul className="divide-y divide-border/40">
              {navLinks.map((l) => {
                const Icon = l.icon;
                return (
                  <li key={l.to}>
                    <Link
                      to={l.to}
                      onClick={() => setOpen(false)}
                      className="group flex items-center gap-3 px-4 py-3 text-foreground active:bg-muted"
                      activeOptions={l.exact ? { exact: true } : undefined}
                      activeProps={{ className: "bg-muted/60" }}
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-medium leading-tight">
                          {l.label}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {l.description}
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-active:translate-x-0.5" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Home-indicator hint */}
          <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>
      </div>
    </header>
  );
}
