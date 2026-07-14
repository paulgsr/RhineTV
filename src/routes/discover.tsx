import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useTransition } from "react";
import { SiteHeader } from "@/components/site-header";
import { searchJellyseerr, requestMedia } from "@/lib/jellyseerr.functions";
import type { JellyseerrSearchResult } from "@/lib/jellyseerr.server";
import { jsPosterUrl, jsStatusLabel } from "@/lib/jellyseerr.server";
import { Loader2, Plus, Search, Check, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/discover")({
  head: () => ({
    meta: [
      { title: "Discover — RhineTV" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: DiscoverPage,
});

type ItemState = "idle" | "requesting" | "requested" | "error";

function DiscoverPage() {
  const search = useServerFn(searchJellyseerr);
  const doRequest = useServerFn(requestMedia);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<JellyseerrSearchResult[]>([]);
  const [state, setState] = useState<
    "idle" | "loading" | "error" | "not-configured"
  >("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [itemState, setItemState] = useState<Record<number, ItemState>>({});
  const [itemMsg, setItemMsg] = useState<Record<number, string>>({});
  const [, startTransition] = useTransition();

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setState("loading");
    setErrorMsg(null);
    try {
      const res = await search({ data: { query } });
      if (!res.configured) {
        setState("not-configured");
        setResults([]);
        return;
      }
      if (!res.ok) {
        setState("error");
        setErrorMsg(res.error ?? "Search failed");
        setResults([]);
        return;
      }
      startTransition(() => {
        setResults(res.results);
        setState("idle");
      });
    } catch (err) {
      setState("error");
      setErrorMsg(err instanceof Error ? err.message : "Search failed");
    }
  }

  async function submitRequest(item: JellyseerrSearchResult) {
    setItemState((s) => ({ ...s, [item.id]: "requesting" }));
    setItemMsg((m) => ({ ...m, [item.id]: "" }));
    try {
      const res = await doRequest({
        data: {
          mediaId: item.id,
          mediaType: item.mediaType === "tv" ? "tv" : "movie",
        },
      });
      if (res.ok) {
        setItemState((s) => ({ ...s, [item.id]: "requested" }));
      } else {
        setItemState((s) => ({ ...s, [item.id]: "error" }));
        setItemMsg((m) => ({ ...m, [item.id]: res.error }));
      }
    } catch (err) {
      setItemState((s) => ({ ...s, [item.id]: "error" }));
      setItemMsg((m) => ({
        ...m,
        [item.id]: err instanceof Error ? err.message : "Request failed",
      }));
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight">Discover</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Search anything and request it. Once it's available, RhineTV picks
          it up automatically.
        </p>

        <form onSubmit={runSearch} className="mt-6 flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search movies and shows…"
              className="w-full rounded-md border border-border/60 bg-card py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={state === "loading"}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
          >
            {state === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
            Search
          </button>
        </form>

        {state === "not-configured" && (
          <div className="mt-6 flex items-start gap-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-4 text-sm text-yellow-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              Jellyseerr isn't configured. Add{" "}
              <code className="rounded bg-black/40 px-1">JELLYSEERR_URL</code>{" "}
              and{" "}
              <code className="rounded bg-black/40 px-1">
                JELLYSEERR_API_KEY
              </code>{" "}
              as secrets, then reload.
            </div>
          </div>
        )}

        {state === "error" && errorMsg && (
          <div className="mt-6 flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div>
              <p className="font-medium">Search failed</p>
              <p className="mt-1 text-xs opacity-80">{errorMsg}</p>
              <p className="mt-2 text-xs opacity-70">
                In the Lovable preview, Jellyseerr must be reachable over the
                public internet (LAN URLs work once the app runs on your NAS).
              </p>
            </div>
          </div>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((item) => {
            const poster = jsPosterUrl(item.posterPath);
            const title = item.title ?? item.name ?? "Untitled";
            const year = (item.releaseDate ?? item.firstAirDate ?? "").slice(
              0,
              4,
            );
            const status = item.mediaInfo?.status;
            const st = itemState[item.id] ?? "idle";
            const alreadyOnServer = status && status >= 4;

            return (
              <div
                key={`${item.mediaType}-${item.id}`}
                className="flex gap-3 rounded-lg border border-border/60 bg-card p-3"
              >
                <div className="h-32 w-20 shrink-0 overflow-hidden rounded bg-muted">
                  {poster ? (
                    <img
                      src={poster}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                      no image
                    </div>
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <p className="truncate text-sm font-semibold">{title}</p>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    {item.mediaType} {year && `· ${year}`}
                  </p>
                  <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">
                    {item.overview}
                  </p>
                  <div className="mt-auto pt-2">
                    {alreadyOnServer ? (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-2 py-1 text-xs font-medium text-emerald-300">
                        <Check className="h-3 w-3" />
                        {jsStatusLabel(status)}
                      </span>
                    ) : status === 2 || status === 3 ? (
                      <span className="inline-flex items-center gap-1 rounded bg-yellow-500/15 px-2 py-1 text-xs font-medium text-yellow-300">
                        {jsStatusLabel(status)}
                      </span>
                    ) : st === "requested" ? (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-2 py-1 text-xs font-medium text-emerald-300">
                        <Check className="h-3 w-3" />
                        Requested
                      </span>
                    ) : (
                      <button
                        onClick={() => submitRequest(item)}
                        disabled={st === "requesting"}
                        className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
                      >
                        {st === "requesting" ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Plus className="h-3 w-3" />
                        )}
                        Request
                      </button>
                    )}
                    {st === "error" && itemMsg[item.id] && (
                      <p className="mt-1 text-xs text-destructive">
                        {itemMsg[item.id]}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {state === "idle" && results.length === 0 && (
          <p className="mt-12 text-center text-sm text-muted-foreground">
            Try “Interstellar”, “Severance”, or your favorite director.
          </p>
        )}
      </div>
    </div>
  );
}
