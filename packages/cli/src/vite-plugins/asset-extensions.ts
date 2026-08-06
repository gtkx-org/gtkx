const ASSET_EXTENSIONS = [
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
];

const ASSET_RE = new RegExp(String.raw`\.(?:${ASSET_EXTENSIONS.join("|")})$`, "i");
const ASSET_PATH_RE = new RegExp(String.raw`\.(?:${ASSET_EXTENSIONS.join("|")})(?:\?.*)?$`, "i");

export { ASSET_RE, ASSET_PATH_RE };
