import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getLibraryMovie } from "@/lib/library.functions";
import { HlsPlayer } from "@/components/hls-player";
import { ArrowLeft } from "lucide-react";

const movieQuery = (id: string) =>
  queryOptions({
    queryKey: ["library", "movie", id],
    queryFn: () => getLibraryMovie({ data: { id } }),
  });

export const Route = createFileRoute("/watch/$movieId")({
  loader: async ({ params, context }) => {
    const movie = await context.queryClient.ensureQueryData(
      movieQuery(params.movieId),
    );
    if (!movie) throw notFound();
    return { movie };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.movie
          ? `Watching ${loaderData.movie.title} — RhineTV`
          : "Watch",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: WatchPage,
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-black text-white">
      <p>Movie not found.</p>
    </div>
  ),
  errorComponent: ({ reset }) => (
    <div className="flex min-h-screen items-center justify-center bg-black text-white">
      <button
        onClick={reset}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        Try again
      </button>
    </div>
  ),
});

function WatchPage() {
  const { movieId } = Route.useParams();
  const { data: movie } = useSuspenseQuery(movieQuery(movieId));
  if (!movie) return null;

  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      <header className="flex items-center gap-3 px-4 py-3">
        <Link
          to="/movies/$movieId"
          params={{ movieId: movie.id }}
          className="inline-flex items-center gap-2 rounded-md px-2 py-1 text-sm text-white/80 transition hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <h1 className="ml-2 truncate text-sm font-medium">
          {movie.title}
          {movie.year && <span className="text-white/50"> ({movie.year})</span>}
        </h1>
      </header>

      <div className="flex flex-1 items-center justify-center bg-black">
        <div className="aspect-video w-full max-w-6xl">
          <HlsPlayer
            src={movie.hlsUrl}
            movieId={movie.id}
            poster={movie.backdropUrl ?? undefined}
          />
        </div>
      </div>
    </div>
  );
}
