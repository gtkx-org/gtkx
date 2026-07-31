/// <reference types="vite/client" />
/// <reference types="@gtkx/react/env" />

declare module "*.aac" {
    /** GResource path of the bundled asset, for use with the `Gio.resources*` lookup functions. */
    export const path: string;
}

declare module "*.avif" {
    /** GResource path of the bundled asset, for use with the `Gio.resources*` lookup functions. */
    export const path: string;
}

declare module "*.eot" {
    /** GResource path of the bundled asset, for use with the `Gio.resources*` lookup functions. */
    export const path: string;
}

declare module "*.flac" {
    /** GResource path of the bundled asset, for use with the `Gio.resources*` lookup functions. */
    export const path: string;
}

declare module "*.gif" {
    /** GResource path of the bundled asset, for use with the `Gio.resources*` lookup functions. */
    export const path: string;
}

declare module "*.ico" {
    /** GResource path of the bundled asset, for use with the `Gio.resources*` lookup functions. */
    export const path: string;
}

declare module "*.jpeg" {
    /** GResource path of the bundled asset, for use with the `Gio.resources*` lookup functions. */
    export const path: string;
}

declare module "*.jpg" {
    /** GResource path of the bundled asset, for use with the `Gio.resources*` lookup functions. */
    export const path: string;
}

declare module "*.mp3" {
    /** GResource path of the bundled asset, for use with the `Gio.resources*` lookup functions. */
    export const path: string;
}

declare module "*.mp4" {
    /** GResource path of the bundled asset, for use with the `Gio.resources*` lookup functions. */
    export const path: string;
}

declare module "*.ogg" {
    /** GResource path of the bundled asset, for use with the `Gio.resources*` lookup functions. */
    export const path: string;
}

declare module "*.otf" {
    /** GResource path of the bundled asset, for use with the `Gio.resources*` lookup functions. */
    export const path: string;
}

declare module "*.png" {
    /** GResource path of the bundled asset, for use with the `Gio.resources*` lookup functions. */
    export const path: string;
}

declare module "*.svg" {
    /** GResource path of the bundled asset, for use with the `Gio.resources*` lookup functions. */
    export const path: string;
}

declare module "*.ttf" {
    /** GResource path of the bundled asset, for use with the `Gio.resources*` lookup functions. */
    export const path: string;
}

declare module "*.wav" {
    /** GResource path of the bundled asset, for use with the `Gio.resources*` lookup functions. */
    export const path: string;
}

declare module "*.webm" {
    /** GResource path of the bundled asset, for use with the `Gio.resources*` lookup functions. */
    export const path: string;
}

declare module "*.webp" {
    /** GResource path of the bundled asset, for use with the `Gio.resources*` lookup functions. */
    export const path: string;
}

declare module "*.woff" {
    /** GResource path of the bundled asset, for use with the `Gio.resources*` lookup functions. */
    export const path: string;
}

declare module "*.woff2" {
    /** GResource path of the bundled asset, for use with the `Gio.resources*` lookup functions. */
    export const path: string;
}

declare module "*.data" {
    /** `resource://` URI of the bundled asset, accepted anywhere GTK takes a URI. */
    const resourceUri: string;
    /** GResource path of the bundled asset, for use with the `Gio.resources*` lookup functions. */
    export const path: string;
    export default resourceUri;
}

declare module "*.gpa" {
    /** `resource://` URI of the bundled asset, accepted anywhere GTK takes a URI. */
    const resourceUri: string;
    /** GResource path of the bundled asset, for use with the `Gio.resources*` lookup functions. */
    export const path: string;
    export default resourceUri;
}

declare module "*.css?url" {
    /** Filesystem path of the emitted stylesheet, imported without installing it on the default display. */
    const path: string;
    export default path;
}
