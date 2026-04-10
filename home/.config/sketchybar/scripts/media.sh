#!/usr/bin/env bash
set -euo pipefail

# Read the system-wide "Now Playing" state through osascript so the helper
# stays self-contained and does not depend on third-party binaries.
# Artwork is resolved only through the iTunes Search API.
EMPTY='{"title":"","artist":"","album":"","app":"","playing":false,"artwork":"","artwork_size":0}'
CACHE_DIR="/tmp/sketchybar-media-cache"
CACHE_VERSION=4
CACHE_MAX_AGE=86400
MISS_CACHE_MAX_AGE=1800

if ! command -v jq >/dev/null 2>&1; then
  printf '%s\n' "$EMPTY"
  exit 0
fi

mkdir -p "$CACHE_DIR"

result="$(
  osascript -l JavaScript 2>/dev/null <<'EOF'
ObjC.import("Foundation");

function emptyPayload() {
  return JSON.stringify({
    title: "",
    artist: "",
    album: "",
    app: "",
    playing: false,
    artwork: "",
    artwork_size: 0,
  });
}

function unwrapString(value) {
  if (!value) return "";

  try {
    return String(ObjC.unwrap(value));
  } catch (_) {
    return "";
  }
}

function unwrapNumber(value) {
  if (!value) return 0;

  try {
    return Number(ObjC.unwrap(value));
  } catch (_) {
    return 0;
  }
}

function run() {
  try {
    const mediaRemote = $.NSBundle.bundleWithPath("/System/Library/PrivateFrameworks/MediaRemote.framework/");
    if (!mediaRemote) return emptyPayload();

    mediaRemote.load;

    // MRNowPlayingRequest works under osascript on recent macOS releases,
    // while the older callback-based bridge is no longer reliable here.
    const MRNowPlayingRequest = $.NSClassFromString("MRNowPlayingRequest");
    if (!MRNowPlayingRequest) return emptyPayload();

    const playerPath = MRNowPlayingRequest.localNowPlayingPlayerPath;
    const item = MRNowPlayingRequest.localNowPlayingItem;
    const info = item ? item.nowPlayingInfo : null;

    const title = info ? unwrapString(info.objectForKey("kMRMediaRemoteNowPlayingInfoTitle")) : "";
    const artist = info ? unwrapString(info.objectForKey("kMRMediaRemoteNowPlayingInfoArtist")) : "";
    const album = info ? unwrapString(info.objectForKey("kMRMediaRemoteNowPlayingInfoAlbum")) : "";
    const playbackRate = info
      ? unwrapNumber(info.objectForKey("kMRMediaRemoteNowPlayingInfoPlaybackRate"))
      : 0;

    let app = "";
    try {
      app = playerPath ? unwrapString(playerPath.client.displayName) : "";
    } catch (_) {
      app = "";
    }

    return JSON.stringify({
      title: title,
      artist: artist,
      album: album,
      app: app,
      playing: playbackRate > 0,
    });
  } catch (_) {
    return emptyPayload();
  }
}

run();
EOF
)"

cache_is_fresh() {
  local path="$1"

  [ -f "$path" ] || return 1

  local modified_at now age max_age artwork cache_version artwork_size
  modified_at="$(stat -f '%m' "$path" 2>/dev/null || printf '0')"
  now="$(date +%s)"
  age="$((now - modified_at))"
  max_age="$CACHE_MAX_AGE"

  cache_version="$(jq -r '.version // 0' <"$path" 2>/dev/null || printf '0')"
  artwork_size="$(jq -r '.artwork_size // -1' <"$path" 2>/dev/null || printf '-1')"
  artwork="$(jq -r '.artwork // ""' <"$path" 2>/dev/null || printf '')"

  [ "$cache_version" = "$CACHE_VERSION" ] || return 1
  [ "$artwork_size" -ge 0 ] 2>/dev/null || return 1

  if [ -z "$artwork" ]; then
    max_age="$MISS_CACHE_MAX_AGE"
  elif [ ! -f "$artwork" ]; then
    return 1
  fi

  [ "$age" -lt "$max_age" ]
}

get_itunes_artwork() {
  local track_hash="$1"
  local title="$2"
  local artist="$3"
  local album="$4"
  local cache_file="$CACHE_DIR/${track_hash}.json"
  local output_path="$CACHE_DIR/${track_hash}.jpg"

  if cache_is_fresh "$cache_file"; then
    local cached_artwork
    cached_artwork="$(jq -r '.artwork // ""' <"$cache_file")"

    if [ -z "$cached_artwork" ] || [ -f "$cached_artwork" ]; then
      cat "$cache_file"
      return 0
    fi

    rm -f "$cache_file"
  fi

  local search_terms encoded_query response artwork_url
  search_terms="$artist $title $album"
  encoded_query="$(jq -rn --arg q "$search_terms" '$q | @uri')"

  response="$(
    curl -fsSL --max-time 5 \
      "https://itunes.apple.com/search?term=${encoded_query}&entity=song&limit=5" \
      2>/dev/null || true
  )"

  if [ -z "$response" ]; then
    jq -cn '{artwork: "", artwork_size: 0}'
    return 0
  fi

  artwork_url="$(
    jq -r \
      --arg title "$title" \
      --arg artist "$artist" \
      --arg album "$album" \
      '
      def norm:
        tostring
        | ascii_downcase
        | gsub("[^a-z0-9]+"; " ")
        | gsub("^ +| +$"; "");

      [ .results[]
        | select(.artworkUrl100?)
        | (.trackName | norm) as $track_norm
        | (.artistName | norm) as $artist_norm
        | (.collectionName | norm) as $album_norm
        | ($title | norm) as $want_title
        | ($artist | norm) as $want_artist
        | ($album | norm) as $want_album
        | . + {
            score:
              (if ($want_title | length) > 0 and $track_norm == $want_title then 100 else 0 end) +
              (if ($want_artist | length) == 0 then 0
               elif $artist_norm == $want_artist then 50
               elif ($artist_norm | contains($want_artist)) or ($want_artist | contains($artist_norm)) then 25
               else 0
               end) +
              (if ($want_album | length) == 0 then 0
               elif $album_norm == $want_album then 40
               elif ($album_norm | contains($want_album)) or ($want_album | contains($album_norm)) then 20
               else 0
               end)
          }
      ]
      | sort_by(-.score)
      | .[0].artworkUrl100 // empty
      ' <<<"$response"
  )"

  if [ -z "$artwork_url" ]; then
    jq -cn \
      --argjson version "$CACHE_VERSION" \
      '{version: $version, artwork: "", artwork_size: 0}' >"$cache_file"
    cat "$cache_file"
    return 0
  fi

  if curl -fsSL --max-time 5 "$artwork_url" -o "$output_path" 2>/dev/null; then
    jq -cn \
      --argjson version "$CACHE_VERSION" \
      --arg artwork "$output_path" \
      '{version: $version, artwork: $artwork, artwork_size: 100}' >"$cache_file"
    cat "$cache_file"
    return 0
  fi

  jq -cn '{artwork: "", artwork_size: 0}'
}

if [ -n "$result" ]; then
  title="$(jq -r '.title // ""' <<<"$result")"
  artist="$(jq -r '.artist // ""' <<<"$result")"
  album="$(jq -r '.album // ""' <<<"$result")"
  app="$(jq -r '.app // ""' <<<"$result")"
  playing="$(jq -r '.playing // false' <<<"$result")"

  artwork=""
  artwork_size=0
  if [ -n "$title" ]; then
    track_hash="$(md5 -q -s "${title}|${artist}|${album}")"
    artwork_result="$(get_itunes_artwork "$track_hash" "$title" "$artist" "$album")"
    artwork="$(jq -r '.artwork // ""' <<<"$artwork_result")"
    artwork_size="$(jq -r '.artwork_size // 0' <<<"$artwork_result")"
  fi

  jq -cn \
    --arg title "$title" \
    --arg artist "$artist" \
    --arg album "$album" \
    --arg app "$app" \
    --arg artwork "$artwork" \
    --argjson artwork_size "$artwork_size" \
    --argjson playing "$playing" \
    '{title: $title, artist: $artist, album: $album, app: $app, playing: $playing, artwork: $artwork, artwork_size: $artwork_size}'
else
  printf '%s\n' "$EMPTY"
fi
