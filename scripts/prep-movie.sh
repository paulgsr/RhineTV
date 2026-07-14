#!/usr/bin/env bash
# prep-movie.sh — turn a single source video into the HLS layout RhineTV scans.
#
# Requirements on the host (TrueNAS / any Linux):
#   - ffmpeg + ffprobe   (apt install ffmpeg  |  ix-chart:  ships in most images)
#   - jq                 (only if you want the metadata.json auto-filled from TMDB)
#
# Usage:
#   ./prep-movie.sh "/mnt/tank/media/raw/Inception (2010).mkv"
#   ./prep-movie.sh "/mnt/tank/media/raw/Inception (2010).mkv" "Inception (2010)"
#
# Output (goes into $OUT_ROOT/<folder-name>/):
#   master.m3u8
#   1080p/index.m3u8 + segNNNNN.ts
#   720p/index.m3u8  + segNNNNN.ts
#   480p/index.m3u8  + segNNNNN.ts
#   metadata.json    (title, year, runtimeMin — plus TMDB fields if TMDB_API_KEY set)
#
# Configure with env vars:
#   OUT_ROOT         Where HLS folders live. Default: /mnt/tank/media/hls
#                    Point your RhineTV container at this via MEDIA_ROOT.
#   SEG_SECONDS      Segment length in seconds. Default: 6
#   TMDB_API_KEY     Optional. If set, the script looks up the movie on TMDB
#                    and writes overview / poster / backdrop / genres.
#   RENDITIONS       Which renditions to build, space-separated subset of
#                    "1080p 720p 480p". Default: all three.
#                    (Downscale-only — the script skips renditions taller than
#                    the source so a 720p file doesn't get upscaled to 1080p.)

set -euo pipefail

SRC="${1:-}"
NAME_OVERRIDE="${2:-}"

if [[ -z "$SRC" ]]; then
  echo "Usage: $0 <source-video> [folder-name]" >&2
  exit 1
fi
if [[ ! -f "$SRC" ]]; then
  echo "Source not found: $SRC" >&2
  exit 1
fi

command -v ffmpeg  >/dev/null || { echo "ffmpeg not installed" >&2; exit 1; }
command -v ffprobe >/dev/null || { echo "ffprobe not installed" >&2; exit 1; }

OUT_ROOT="${OUT_ROOT:-/mnt/tank/media/hls}"
SEG_SECONDS="${SEG_SECONDS:-6}"
RENDITIONS="${RENDITIONS:-1080p 720p 480p}"

# Derive folder name from the source filename if not given: "Inception (2010).mkv" -> "Inception (2010)"
if [[ -n "$NAME_OVERRIDE" ]]; then
  FOLDER_NAME="$NAME_OVERRIDE"
else
  FOLDER_NAME="$(basename "$SRC")"
  FOLDER_NAME="${FOLDER_NAME%.*}"
fi

OUT_DIR="$OUT_ROOT/$FOLDER_NAME"
mkdir -p "$OUT_DIR"

echo "==> Source: $SRC"
echo "==> Output: $OUT_DIR"
echo "==> Segments: ${SEG_SECONDS}s"

# ---- Probe source ----------------------------------------------------------
SRC_HEIGHT="$(ffprobe -v error -select_streams v:0 \
  -show_entries stream=height -of csv=p=0 "$SRC")"
SRC_DUR="$(ffprobe -v error -show_entries format=duration \
  -of csv=p=0 "$SRC" | awk '{printf "%d", $1+0.5}')"
RUNTIME_MIN=$(( (SRC_DUR + 30) / 60 ))
echo "==> Source height: ${SRC_HEIGHT}p, duration: ${SRC_DUR}s (${RUNTIME_MIN}m)"

# ---- Build renditions ------------------------------------------------------
# 1080p: 5000k video, 192k audio    720p: 2800k / 128k    480p: 1400k / 96k
declare -A V_BITRATE=( [1080p]=5000k [720p]=2800k [480p]=1400k )
declare -A A_BITRATE=( [1080p]=192k  [720p]=128k  [480p]=96k  )
declare -A HEIGHT   =( [1080p]=1080  [720p]=720   [480p]=480  )
declare -A BANDWIDTH=( [1080p]=5500000 [720p]=3200000 [480p]=1600000 )
declare -A RES      =( [1080p]=1920x1080 [720p]=1280x720 [480p]=854x480 )

BUILT=()
for R in $RENDITIONS; do
  H="${HEIGHT[$R]:-}"
  if [[ -z "$H" ]]; then
    echo "  ! Unknown rendition '$R', skipping" >&2
    continue
  fi
  if (( SRC_HEIGHT < H )); then
    echo "  - Skipping ${R} (source is only ${SRC_HEIGHT}p, won't upscale)"
    continue
  fi

  echo "==> Encoding ${R} …"
  R_DIR="$OUT_DIR/$R"
  mkdir -p "$R_DIR"

  ffmpeg -hide_banner -loglevel warning -y \
    -i "$SRC" \
    -vf "scale=-2:${H}" \
    -c:v libx264 -profile:v main -preset veryfast -crf 20 \
    -b:v "${V_BITRATE[$R]}" -maxrate "${V_BITRATE[$R]}" -bufsize "${V_BITRATE[$R]}" \
    -pix_fmt yuv420p -g $((SEG_SECONDS * 2)) -keyint_min $((SEG_SECONDS * 2)) \
    -sc_threshold 0 \
    -c:a aac -b:a "${A_BITRATE[$R]}" -ac 2 \
    -hls_time "$SEG_SECONDS" \
    -hls_playlist_type vod \
    -hls_segment_filename "$R_DIR/seg%05d.ts" \
    -f hls "$R_DIR/index.m3u8"

  BUILT+=("$R")
done

if [[ ${#BUILT[@]} -eq 0 ]]; then
  echo "No renditions were built — nothing to write." >&2
  exit 1
fi

# ---- master.m3u8 -----------------------------------------------------------
echo "==> Writing master.m3u8"
{
  echo "#EXTM3U"
  echo "#EXT-X-VERSION:3"
  for R in "${BUILT[@]}"; do
    echo "#EXT-X-STREAM-INF:BANDWIDTH=${BANDWIDTH[$R]},RESOLUTION=${RES[$R]}"
    echo "$R/index.m3u8"
  done
} > "$OUT_DIR/master.m3u8"

# ---- metadata.json --------------------------------------------------------
# Parse "Title (YYYY)" out of the folder name.
TITLE="$FOLDER_NAME"
YEAR=""
if [[ "$FOLDER_NAME" =~ ^(.*)[[:space:]]\(([0-9]{4})\)[[:space:]]*$ ]]; then
  TITLE="${BASH_REMATCH[1]}"
  YEAR="${BASH_REMATCH[2]}"
fi

echo "==> Writing metadata.json (title=\"$TITLE\", year=${YEAR:-null})"

TMDB_JSON=""
if [[ -n "${TMDB_API_KEY:-}" ]] && command -v jq >/dev/null && command -v curl >/dev/null; then
  echo "  - Looking up on TMDB…"
  Q="$(printf '%s' "$TITLE" | jq -sRr @uri)"
  URL="https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${Q}"
  [[ -n "$YEAR" ]] && URL="${URL}&year=${YEAR}"
  SEARCH="$(curl -fsS "$URL" || echo '{}')"
  TMDB_ID="$(echo "$SEARCH" | jq -r '.results[0].id // empty')"
  if [[ -n "$TMDB_ID" ]]; then
    DETAILS="$(curl -fsS "https://api.themoviedb.org/3/movie/${TMDB_ID}?api_key=${TMDB_API_KEY}" || echo '{}')"
    TMDB_JSON="$DETAILS"
  fi
fi

if [[ -n "$TMDB_JSON" ]]; then
  jq -n \
    --arg title "$TITLE" \
    --arg year "$YEAR" \
    --argjson runtimeMin "$RUNTIME_MIN" \
    --argjson t "$TMDB_JSON" \
    '{
      title:      ($t.title      // $title),
      year:       ( ($t.release_date // "" | .[0:4] | tonumber?) // (if $year == "" then null else ($year|tonumber) end) ),
      runtimeMin: ($t.runtime    // $runtimeMin),
      overview:   ($t.overview   // ""),
      genres:     ([$t.genres[]?.name] // []),
      tmdbId:     ($t.id         // null),
      posterPath:   $t.poster_path,
      backdropPath: $t.backdrop_path
    }' > "$OUT_DIR/metadata.json"
else
  # Minimal metadata without TMDB — RhineTV will still work.
  {
    echo "{"
    echo "  \"title\": $(printf '%s' "$TITLE" | jq -Rs . 2>/dev/null || printf '"%s"' "$TITLE"),"
    if [[ -n "$YEAR" ]]; then echo "  \"year\": $YEAR,"; fi
    echo "  \"runtimeMin\": $RUNTIME_MIN,"
    echo "  \"overview\": \"\","
    echo "  \"genres\": []"
    echo "}"
  } > "$OUT_DIR/metadata.json"
fi

echo "==> Done."
echo "    Folder: $OUT_DIR"
echo "    Master: $OUT_DIR/master.m3u8"
echo "    Open RhineTV → Admin → Rescan to pick it up immediately."
