import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { listLibrary } from "@/lib/library.functions";
import { RefreshCw, Terminal } from "lucide-react";

const libraryQuery = queryOptions({
  queryKey: ["library"],
  queryFn: () => listLibrary(),
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
              Library scans{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                {process.env.MEDIA_ROOT_DISPLAY || "$MEDIA_ROOT"}
              </code>{" "}
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

        <section className="mt-10 rounded-lg border border-border/60 bg-card p-6">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Terminal className="h-4 w-4 text-primary" />
            Prep a movie on TrueNAS
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Run the prep script on your NAS to turn a source file into HLS
            chunks the player can stream:
          </p>
          <pre className="mt-3 overflow-x-auto rounded-md bg-black/60 p-4 text-xs leading-relaxed text-emerald-300">
{`# On TrueNAS — inside MEDIA_ROOT
./prep-movie.sh "/mnt/tank/media/raw/Inception (2010).mkv"

# Produces (folder name -> movie id):
# $MEDIA_ROOT/Inception (2010)/
#   master.m3u8
#   1080p/index.m3u8, seg00001.ts ...
#   720p/... 480p/...
#   subs/en.vtt
#   metadata.json   (optional, overrides TMDB lookup)`}
          </pre>
        </section>

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
