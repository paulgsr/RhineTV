import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
  useSuspenseQuery,
  useQuery,
  useMutation,
  useQueryClient,
  queryOptions,
} from "@tanstack/react-query";
import { useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { listLibrary } from "@/lib/library.functions";
import {
  clearEncoderHistory,
  encoderStatus,
  rescanInbox,
} from "@/lib/encoder.functions";
import { RefreshCw, Terminal, Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";

const libraryQuery = queryOptions({
  queryKey: ["library"],
  queryFn: () => listLibrary(),
});

const encoderQuery = queryOptions({
  queryKey: ["encoder-status"],
  queryFn: () => encoderStatus(),
  refetchInterval: 2000,
});

export const Route = createFileRoute("/admin")({
  loader: ({ context }) => context.queryClient.ensureQueryData(libraryQuery),

  head: () => ({
    meta: [
      { title: "Admin — RhineTV" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const router = useRouter();
  const { data: lib } = useSuspenseQuery(libraryQuery);
  const [refreshing, setRefreshing] = useState(false);
  const movies = lib.movies;

  async function rescan() {
    setRefreshing(true);
    try {
      await router.invalidate();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Library scans <code className="rounded bg-muted px-1 py-0.5 text-xs">$MEDIA_ROOT</code>{" "}
              — every folder containing{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                master.m3u8
              </code>{" "}
              becomes a movie.
            </p>

          </div>
          <button
            onClick={rescan}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-card px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
            />
            Rescan
          </button>
        </div>

        {!lib.configured && (
          <div className="mt-6 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4 text-sm">
            <p className="font-medium text-yellow-200">MEDIA_ROOT not set</p>
            <p className="mt-1 text-muted-foreground">
              Set <code className="rounded bg-muted px-1">MEDIA_ROOT</code> in
              your container env to the path holding HLS-prepared movies (e.g.
              <code className="rounded bg-muted px-1">/media</code>). Optional:{" "}
              <code className="rounded bg-muted px-1">TMDB_API_KEY</code> for
              auto-filled posters &amp; overviews,{" "}
              <code className="rounded bg-muted px-1">
                PUBLIC_MEDIA_BASE_URL
              </code>{" "}
              for the URL your reverse proxy serves the HLS files from.
            </p>
          </div>
        )}

        {lib.error && (
          <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm">
            <p className="font-medium text-red-200">Scan error</p>
            <p className="mt-1 text-muted-foreground">{lib.error}</p>
          </div>
        )}

        <EncoderPanel />

        <details className="mt-6 rounded-lg border border-border/60 bg-card p-6 text-sm">
          <summary className="flex cursor-pointer items-center gap-2 font-medium">
            <Terminal className="h-4 w-4 text-primary" />
            Prefer the CLI? Prep manually
          </summary>
          <p className="mt-3 text-muted-foreground">
            You can also run <code className="rounded bg-muted px-1">scripts/prep-movie.sh</code>{" "}
            on any host with ffmpeg to produce the same layout:
          </p>
          <pre className="mt-3 overflow-x-auto rounded-md bg-black/60 p-4 text-xs leading-relaxed text-emerald-300">
{`./prep-movie.sh "/mnt/tank/media/raw/Inception (2010).mkv"
# → $MEDIA_ROOT/Inception (2010)/{master.m3u8, 1080p/, 720p/, ...}`}
          </pre>
        </details>


        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Current library ({movies.length})
          </h2>
          {movies.length === 0 ? (
            <p className="mt-4 rounded-lg border border-dashed border-border/60 bg-card/40 p-6 text-center text-sm text-muted-foreground">
              No movies scanned yet.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-border/50 rounded-lg border border-border/60 bg-card">
              {movies.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center gap-4 px-4 py-3 text-sm"
                >
                  {m.posterUrl ? (
                    <img
                      src={m.posterUrl}
                      alt=""
                      className="h-12 w-8 rounded object-cover"
                    />
                  ) : (
                    <div className="h-12 w-8 rounded bg-muted" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {m.title}
                      {m.year && (
                        <span className="ml-1 text-muted-foreground">
                          ({m.year})
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {m.folder} · {m.hlsUrl}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function EncoderPanel() {
  const qc = useQueryClient();
  const { data: status } = useQuery(encoderQuery);
  const rescan = useMutation({
    mutationFn: () => rescanInbox(),
    onSuccess: (s) => qc.setQueryData(encoderQuery.queryKey, s),
  });
  const clear = useMutation({
    mutationFn: () => clearEncoderHistory(),
    onSuccess: (s) => qc.setQueryData(encoderQuery.queryKey, s),
  });

  if (!status) {
    return (
      <div className="mt-10 rounded-lg border border-border/60 bg-card p-6 text-sm text-muted-foreground">
        Loading encoder status…
      </div>
    );
  }

  const active = status.jobs.filter(
    (j) => j.status !== "done" && j.status !== "failed",
  );
  const finished = status.jobs.filter(
    (j) => j.status === "done" || j.status === "failed",
  );

  return (
    <section className="mt-10 rounded-lg border border-border/60 bg-card p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Auto-encoder</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Drop a video file into <code className="rounded bg-muted px-1">$INBOX_ROOT</code>{" "}
            and it's re-encoded to HLS and added to the library automatically.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => rescan.mutate()}
            disabled={rescan.isPending}
            className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3 w-3 ${rescan.isPending ? "animate-spin" : ""}`}
            />
            Scan inbox
          </button>
          {finished.length > 0 && (
            <button
              onClick={() => clear.mutate()}
              className="rounded-md border border-border/60 bg-background px-3 py-1.5 text-xs hover:bg-accent"
            >
              Clear history
            </button>
          )}
        </div>
      </div>

      {!status.configured && (
        <div className="mt-4 rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3 text-xs text-muted-foreground">
          Set <code className="rounded bg-muted px-1">INBOX_ROOT</code> and{" "}
          <code className="rounded bg-muted px-1">MEDIA_ROOT</code> in your
          container env, then mount your raw-files folder read-write at the
          inbox path.
        </div>
      )}
      {status.configured && !status.available && (
        <div className="mt-4 rounded-md border border-red-500/30 bg-red-500/5 p-3 text-xs text-muted-foreground">
          ffmpeg not available in this runtime. In the Lovable preview this is
          expected — auto-encoding only runs inside the Docker container on
          your NAS.
        </div>
      )}
      {status.lastScanError && (
        <div className="mt-4 rounded-md border border-red-500/30 bg-red-500/5 p-3 text-xs text-muted-foreground">
          Last scan error: {status.lastScanError}
        </div>
      )}

      {status.jobs.length === 0 ? (
        <p className="mt-4 rounded-md border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">
          Inbox is empty. Drop videos into <code>$INBOX_ROOT</code> to get started.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border/50 rounded-md border border-border/60">
          {[...active, ...finished].map((j) => (
            <li key={j.id} className="px-4 py-3 text-sm">
              <div className="flex items-center gap-3">
                <JobIcon status={j.status} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{j.sourceName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {jobLabel(j.status)}
                    {j.currentRendition && ` · ${j.currentRendition}`}
                    {j.error && ` · ${j.error}`}
                  </p>
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {Math.round(j.progress * 100)}%
                </span>
              </div>
              {j.status !== "done" && j.status !== "failed" && (
                <div className="mt-2 h-1 overflow-hidden rounded bg-muted">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${Math.max(2, j.progress * 100)}%` }}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function JobIcon({ status }: { status: string }) {
  if (status === "done")
    return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
  if (status === "failed") return <XCircle className="h-4 w-4 text-red-400" />;
  if (status === "queued")
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
}

function jobLabel(status: string): string {
  switch (status) {
    case "queued":
      return "Queued";
    case "probing":
      return "Probing source";
    case "encoding":
      return "Encoding";
    case "writing-master":
      return "Writing master playlist";
    case "fetching-metadata":
      return "Fetching metadata";
    case "done":
      return "Done";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}

