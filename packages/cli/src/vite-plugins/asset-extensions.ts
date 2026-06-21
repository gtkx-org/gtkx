/**
 * The single source-of-truth list of file extensions GTKX treats as bundled
 * GResource assets. Both the asset-matching regexes and the public `./env`
 * ambient module declarations are derived from this one list, so the two can
 * never drift.
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
];

/**
 * Matches a bare asset path ending in one of {@link ASSET_EXTENSIONS}.
 */
export const ASSET_RE = new RegExp(String.raw`\.(?:${ASSET_EXTENSIONS.join("|")})$`, "i");

/**
 * Matches an asset path ending in one of {@link ASSET_EXTENSIONS}, tolerating a
 * trailing query string (e.g. `?inline`).
 */
export const ASSET_PATH_RE = new RegExp(String.raw`\.(?:${ASSET_EXTENSIONS.join("|")})(?:\?.*)?$`, "i");

const assetModuleBlock = (extension: string): string =>
    [
        `declare module "*.${extension}" {`,
        "    const resourceUri: string;",
        "    export const path: string;",
        "    export default resourceUri;",
        "}",
    ].join("\n");

/**
 * Renders the ambient `declare module "*.<ext>"` blocks for every extension in
 * {@link ASSET_EXTENSIONS}, mirroring the GSettings `renderEnvModule` emitter.
 *
 * Each block exports the bundled `resourceUri` as the default plus a named
 * `path`. The blocks are returned newline-separated with no surrounding header,
 * so callers can compose them with reference directives and other declarations.
 *
 * @param extensions - The asset extensions to emit a module declaration for.
 * @returns The concatenated declare-module blocks.
 * @public
 */
export const renderAssetEnvModule = (extensions: string[]): string => extensions.map(assetModuleBlock).join("\n\n");
