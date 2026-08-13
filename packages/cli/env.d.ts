/// <reference types="vite/client" />
/// <reference types="@gtkx/react/env" />

declare module "#data/*.aac" {
    /** `resource://` URI of the bundled asset, accepted anywhere GTK takes a URI. */
    const resourceUri: string;
    /** GResource path of the bundled asset, for use with the `Gio.resources*` lookup functions. */
    export const path: string;
    export default resourceUri;
}

declare module "#data/*.avif" {
    /** `resource://` URI of the bundled asset, accepted anywhere GTK takes a URI. */
    const resourceUri: string;
    /** GResource path of the bundled asset, for use with the `Gio.resources*` lookup functions. */
    export const path: string;
    export default resourceUri;
}

declare module "#data/*.data" {
    /** `resource://` URI of the bundled asset, accepted anywhere GTK takes a URI. */
    const resourceUri: string;
    /** GResource path of the bundled asset, for use with the `Gio.resources*` lookup functions. */
    export const path: string;
    export default resourceUri;
}

declare module "#data/*.eot" {
    /** `resource://` URI of the bundled asset, accepted anywhere GTK takes a URI. */
    const resourceUri: string;
    /** GResource path of the bundled asset, for use with the `Gio.resources*` lookup functions. */
    export const path: string;
    export default resourceUri;
}

declare module "#data/*.flac" {
    /** `resource://` URI of the bundled asset, accepted anywhere GTK takes a URI. */
    const resourceUri: string;
    /** GResource path of the bundled asset, for use with the `Gio.resources*` lookup functions. */
    export const path: string;
    export default resourceUri;
}

declare module "#data/*.gif" {
    /** `resource://` URI of the bundled asset, accepted anywhere GTK takes a URI. */
    const resourceUri: string;
    /** GResource path of the bundled asset, for use with the `Gio.resources*` lookup functions. */
    export const path: string;
    export default resourceUri;
}

declare module "#data/*.gpa" {
    /** `resource://` URI of the bundled asset, accepted anywhere GTK takes a URI. */
    const resourceUri: string;
    /** GResource path of the bundled asset, for use with the `Gio.resources*` lookup functions. */
    export const path: string;
    export default resourceUri;
}

declare module "#data/*.ico" {
    /** `resource://` URI of the bundled asset, accepted anywhere GTK takes a URI. */
    const resourceUri: string;
    /** GResource path of the bundled asset, for use with the `Gio.resources*` lookup functions. */
    export const path: string;
    export default resourceUri;
}

declare module "#data/*.jpeg" {
    /** `resource://` URI of the bundled asset, accepted anywhere GTK takes a URI. */
    const resourceUri: string;
    /** GResource path of the bundled asset, for use with the `Gio.resources*` lookup functions. */
    export const path: string;
    export default resourceUri;
}

declare module "#data/*.jpg" {
    /** `resource://` URI of the bundled asset, accepted anywhere GTK takes a URI. */
    const resourceUri: string;
    /** GResource path of the bundled asset, for use with the `Gio.resources*` lookup functions. */
    export const path: string;
    export default resourceUri;
}

declare module "#data/*.mp3" {
    /** `resource://` URI of the bundled asset, accepted anywhere GTK takes a URI. */
    const resourceUri: string;
    /** GResource path of the bundled asset, for use with the `Gio.resources*` lookup functions. */
    export const path: string;
    export default resourceUri;
}

declare module "#data/*.mp4" {
    /** `resource://` URI of the bundled asset, accepted anywhere GTK takes a URI. */
    const resourceUri: string;
    /** GResource path of the bundled asset, for use with the `Gio.resources*` lookup functions. */
    export const path: string;
    export default resourceUri;
}

declare module "#data/*.ogg" {
    /** `resource://` URI of the bundled asset, accepted anywhere GTK takes a URI. */
    const resourceUri: string;
    /** GResource path of the bundled asset, for use with the `Gio.resources*` lookup functions. */
    export const path: string;
    export default resourceUri;
}

declare module "#data/*.otf" {
    /** `resource://` URI of the bundled asset, accepted anywhere GTK takes a URI. */
    const resourceUri: string;
    /** GResource path of the bundled asset, for use with the `Gio.resources*` lookup functions. */
    export const path: string;
    export default resourceUri;
}

declare module "#data/*.png" {
    /** `resource://` URI of the bundled asset, accepted anywhere GTK takes a URI. */
    const resourceUri: string;
    /** GResource path of the bundled asset, for use with the `Gio.resources*` lookup functions. */
    export const path: string;
    export default resourceUri;
}

declare module "#data/*.svg" {
    /** `resource://` URI of the bundled asset, accepted anywhere GTK takes a URI. */
    const resourceUri: string;
    /** GResource path of the bundled asset, for use with the `Gio.resources*` lookup functions. */
    export const path: string;
    export default resourceUri;
}

declare module "#data/*.ttf" {
    /** `resource://` URI of the bundled asset, accepted anywhere GTK takes a URI. */
    const resourceUri: string;
    /** GResource path of the bundled asset, for use with the `Gio.resources*` lookup functions. */
    export const path: string;
    export default resourceUri;
}

declare module "#data/*.wav" {
    /** `resource://` URI of the bundled asset, accepted anywhere GTK takes a URI. */
    const resourceUri: string;
    /** GResource path of the bundled asset, for use with the `Gio.resources*` lookup functions. */
    export const path: string;
    export default resourceUri;
}

declare module "#data/*.webm" {
    /** `resource://` URI of the bundled asset, accepted anywhere GTK takes a URI. */
    const resourceUri: string;
    /** GResource path of the bundled asset, for use with the `Gio.resources*` lookup functions. */
    export const path: string;
    export default resourceUri;
}

declare module "#data/*.webp" {
    /** `resource://` URI of the bundled asset, accepted anywhere GTK takes a URI. */
    const resourceUri: string;
    /** GResource path of the bundled asset, for use with the `Gio.resources*` lookup functions. */
    export const path: string;
    export default resourceUri;
}

declare module "#data/*.woff" {
    /** `resource://` URI of the bundled asset, accepted anywhere GTK takes a URI. */
    const resourceUri: string;
    /** GResource path of the bundled asset, for use with the `Gio.resources*` lookup functions. */
    export const path: string;
    export default resourceUri;
}

declare module "#data/*.woff2" {
    /** `resource://` URI of the bundled asset, accepted anywhere GTK takes a URI. */
    const resourceUri: string;
    /** GResource path of the bundled asset, for use with the `Gio.resources*` lookup functions. */
    export const path: string;
    export default resourceUri;
}

declare module "*.data" {
    /**
     * URL of the emitted asset: a dev server URL under `gtkx dev`, an absolute filesystem path once built.
     * Import it under `#data/` instead for a GResource path and a `resource://` URI.
     */
    const assetUrl: string;
    export default assetUrl;
}

declare module "*.gpa" {
    /**
     * URL of the emitted asset: a dev server URL under `gtkx dev`, an absolute filesystem path once built.
     * Import it under `#data/` instead for a GResource path and a `resource://` URI.
     */
    const assetUrl: string;
    export default assetUrl;
}

declare module "*.css?url" {
    /**
     * URL of the emitted stylesheet, imported without installing it on the default display: a dev server URL
     * under `gtkx dev`, an absolute filesystem path once built.
     */
    const styleSheetUrl: string;
    export default styleSheetUrl;
}
