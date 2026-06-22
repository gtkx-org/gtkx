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
];

export const ASSET_RE = new RegExp(String.raw`\.(?:${ASSET_EXTENSIONS.join("|")})$`, "i");

export const ASSET_PATH_RE = new RegExp(String.raw`\.(?:${ASSET_EXTENSIONS.join("|")})(?:\?.*)?$`, "i");

const assetModuleBlock = (extension: string): string =>
    [
        `declare module "*.${extension}" {`,
        "    const resourceUri: string;",
        "    export const path: string;",
        "    export default resourceUri;",
        "}",
    ].join("\n");

/** @public */
export const renderAssetEnvModule = (extensions: string[]): string => extensions.map(assetModuleBlock).join("\n\n");
