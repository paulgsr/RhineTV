import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SiteHeader } from "@/components/site-header";
import {
  listRequests,
  approveRequest,
  declineRequest,
} from "@/lib/jellyseerr.functions";
import {
  jsPosterUrl,
  jsRequestStatusLabel,
  jsStatusLabel,
} from "@/lib/jellyseerr.server";
import { Check, Loader2, RefreshCw, X, AlertTriangle } from "lucide-react";
import { useState } from "react";

type Filter = "all" | "pending" | "approved" | "available" | "processing" | "declined";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "processing", label: "Processing" },
  { key: "available", label: "Available" },
  { key: "declined", label: "Declined" },
  { key: "all", label: "All" },
];

export const Route = createFileRoute("/admin/requests")({
  head: () => ({
    meta: [
      { title: "Requests — ChunkFlix Admin" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: RequestsPage,
});

function RequestsPage() {
  const [filter, setFilter] = useState<Filter>("pending");
  const list = useServerFn(listRequests);
  const approve = useServerFn(approveRequest);
  const decline = useServerFn(declineRequest);
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["jellyseerr", "requests", filter],
    queryFn: () => list({ data: { filter, take: 50 } }),
    refetchInterval: 15_000, // full-loop polling: pick up "available" transitions
  });

  const approveMut = useMutation({
    mutationFn: (id: number) => approve({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jellyseerr", "requests"] }),
  });
  const declineMut = useMutation({
    mutationFn: (id: number) => decline({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jellyseerr", "requests"] }),
  });

  const data = query.data;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Requests</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Approve, decline, and watch the queue. Auto-refreshes every 15s.
            </p>
          </div>
          <button
            onClick={() =>
              qc.invalidateQueries({ queryKey: ["jellyseerr", "requests"] })
            }
            className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-card px-3 py-1.5 text-sm text-foreground transition hover:bg-accent"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${query.isFetching ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                filter === f.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {data && !data.configured && (
          <div className="mt-6 flex items-start gap-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-4 text-sm text-yellow-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              Jellyseerr isn't configured. Add{" "}
              <code className="rounded bg-black/40 px-1">JELLYSEERR_URL</code>{" "}
              and{" "}
              <code className="rounded bg-black/40 px-1">
                JELLYSEERR_API_KEY
              </code>{" "}
              as secrets.
            </div>
          </div>
        )}

        {data && data.configured && data.error && (
          <div className="mt-6 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
            <p className="font-medium text-destructive">Couldn't load requests</p>
            <p className="mt-1 text-xs opacity-80">{data.error}</p>
          </div>
        )}

        <div className="mt-6 space-y-3">
          {query.isLoading && (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
          {data?.results.length === 0 && !query.isLoading && (
            <p className="rounded-lg border border-dashed border-border/60 bg-card/40 p-8 text-center text-sm text-muted-foreground">
              No {filter === "all" ? "" : filter} requests.
            </p>
          )}
          {data?.results.map((r) => {
            const poster = jsPosterUrl(r.media.posterPath);
            const busy =
              (approveMut.isPending && approveMut.variables === r.id) ||
              (declineMut.isPending && declineMut.variables === r.id);
            return (
              <div
                key={r.id}
                className="flex gap-4 rounded-lg border border-border/60 bg-card p-3"
              >
                <div className="h-24 w-16 shrink-0 overflow-hidden rounded bg-muted">
                  {poster && (
                    <img
                      src={poster}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {r.media.title ?? `TMDB ${r.media.tmdbId}`}
                  </p>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    {r.type} · requested by{" "}
                    {r.requestedBy?.displayName ??
                      r.requestedBy?.username ??
                      "unknown"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className="rounded bg-muted px-2 py-0.5">
                      Request: {jsRequestStatusLabel(r.status)}
                    </span>
                    <span className="rounded bg-muted px-2 py-0.5">
                      Media: {jsStatusLabel(r.media.status)}
                    </span>
                  </div>
                </div>
                {r.status === 1 && (
                  <div className="flex flex-col gap-2 self-center">
                    <button
                      onClick={() => approveMut.mutate(r.id)}
                      disabled={busy}
                      className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-emerald-500 disabled:opacity-60"
                    >
                      {approveMut.isPending && approveMut.variables === r.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Check className="h-3 w-3" />
                      )}
                      Approve
                    </button>
                    <button
                      onClick={() => declineMut.mutate(r.id)}
                      disabled={busy}
                      className="inline-flex items-center gap-1 rounded-md border border-border/60 px-3 py-1 text-xs font-medium text-foreground transition hover:bg-accent disabled:opacity-60"
                    >
                      {declineMut.isPending && declineMut.variables === r.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <X className="h-3 w-3" />
                      )}
                      Decline
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
