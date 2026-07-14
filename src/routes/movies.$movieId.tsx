import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { getMovie } from "@/data/library";
import { Play } from "lucide-react";

export const Route = createFileRoute("/movies/$movieId")({
  loader: ({ params }) => {
    const movie = getMovie(params.movieId);
    if (!movie) throw notFound();
    return { movie };
  },
  head: ({ loaderData }) => {
    const m = loaderData?.movie;
    if (!m) return { meta: [{ title: "Not found" }] };
    return {
      meta: [
        { title: `${m.title} (${m.year}) — ChunkFlix` },
        { name: "description", content: m.overview },
        { name: "robots", content: "noindex,nofollow" },
        { property: "og:title", content: `${m.title} (${m.year})` },
        { property: "og:description", content: m.overview },
        { property: "og:image", content: m.backdropUrl },
        { property: "og:type", content: "video.movie" },
      ],
    };
  },
  component: MovieDetail,
  notFoundComponent: () => (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold">Movie not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          It may have been removed from the library.
        </p>
        <Link
          to="/"
          className="mt-6 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Back to library
        </Link>
      </div>
    </div>
  ),
  errorComponent: ({ reset }) => (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <button
          onClick={reset}
          className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Try again
        </button>
      </div>
    </div>
  ),
});

function MovieDetail() {
  const { movie } = Route.useLoaderData();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <img
            src={movie.backdropUrl}
            alt=""
            className="h-full w-full object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/30" />
        </div>

        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:grid-cols-[220px_1fr] sm:px-6 sm:py-24">
          <img
            src={movie.posterUrl}
            alt={`${movie.title} poster`}
            className="hidden w-[220px] rounded-lg shadow-2xl ring-1 ring-border/60 sm:block"
          />
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-primary/80">
              {movie.genres.join(" · ")}
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
              {movie.title}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {movie.year} · {movie.runtimeMin} min
            </p>
            <p className="mt-6 max-w-2xl text-sm leading-relaxed text-foreground/90 sm:text-base">
              {movie.overview}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/watch/$movieId"
                params={{ movieId: movie.id }}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
              >
                <Play className="h-4 w-4 fill-current" />
                Play
              </Link>
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
              >
                Back
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
