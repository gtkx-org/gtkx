/**
 * File extensions treated as binary assets by both the GResource pipeline
 * (`gtkxResources`) and the dev-time asset resolver (`gtkxAssets`).
 *
 * Listed without the leading dot. Matching is case-insensitive.
 */
export const ASSET_EXTENSIONS = [
    "png",
    "jpg",
    "jpeg",
    "gif",
    "svg",
    "webp",
    "webm",
    "mp4",
    "ogg",
    "mp3",
    "wav",
    "flac",
    "aac",
    "woff",
    "woff2",
    "eot",
    "ttf",
    "otf",
    "ico",
    "avif",
    "data",
    "gpa",
] as const;

/**
 * Regex matching any file whose extension is in {@link ASSET_EXTENSIONS}.
 *
 * The match is anchored to the end of the string and tolerates query
 * suffixes via the caller-supplied test (use {@link ASSET_PATH_RE} for
 * paths with potential `?query` parts).
 */
export const ASSET_RE = new RegExp(String.raw`\.(?:${ASSET_EXTENSIONS.join("|")})$`, "i");

/**
 * Regex matching asset extensions while ignoring any trailing query string.
 *
 * Useful when inspecting Vite ids that may carry `?import`, `?inline`, or
 * other suffixes appended by the resolver.
 */
export const ASSET_PATH_RE = new RegExp(String.raw`\.(?:${ASSET_EXTENSIONS.join("|")})(?:\?.*)?$`, "i");
