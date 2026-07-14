import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { allMovies } from "@/data/library";
import { Terminal } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — RhineTV" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const movies = allMovies();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Phase-1 stub — user management, invites, and the “Add movie” import
          flow land in the next phase. For now, movies are loaded from{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            src/data/library.ts
          </code>
          .
        </p>

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
{`# On TrueNAS
./prep-movie.sh "/mnt/tank/media/raw/Inception (2010).mkv"

# Produces:
# /mnt/tank/media/hls/inception-2010/
#   master.m3u8
#   1080p/index.m3u8, seg00001.ts ...
#   720p/... 480p/...
#   subs/en.vtt
#   movie.json`}
          </pre>
          <p className="mt-3 text-xs text-muted-foreground">
            The prep script and docker-compose bundle ship in a later phase.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Current library ({movies.length})
          </h2>
          <ul className="mt-4 divide-y divide-border/50 rounded-lg border border-border/60 bg-card">
            {movies.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-4 px-4 py-3 text-sm"
              >
                <img
                  src={m.posterUrl}
                  alt=""
                  className="h-12 w-8 rounded object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{m.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {m.year} · {m.runtimeMin}m · {m.hlsUrl}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
