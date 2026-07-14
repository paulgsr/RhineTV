import { Link } from "@tanstack/react-router";
import { Film, Search, Shield } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link
          to="/"
          className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground"
        >
          <Film className="h-5 w-5 text-primary" />
          <span>ChunkFlix</span>
        </Link>
        <nav className="hidden items-center gap-4 text-sm text-muted-foreground sm:flex">
          <Link
            to="/"
            className="transition-colors hover:text-foreground"
            activeProps={{ className: "text-foreground" }}
            activeOptions={{ exact: true }}
          >
            Library
          </Link>
          <Link
            to="/admin"
            className="flex items-center gap-1 transition-colors hover:text-foreground"
            activeProps={{ className: "text-foreground" }}
          >
            <Shield className="h-3.5 w-3.5" />
            Admin
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <Search className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Press / to search</span>
        </div>
      </div>
    </header>
  );
}
