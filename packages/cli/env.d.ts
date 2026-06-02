/// <reference types="vite/client" />

interface ImportMetaEnv {
    /**
     * GLib application id declared by `applicationId` in `gtkx.config.ts`.
     *
     * Empty string when the project has not declared an application id.
     */
    readonly GTKX_APPLICATION_ID: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

declare module "*.css?url" {
    const path: string;
    export default path;
}

declare module "*.data" {
    const resourceUri: string;
    /** Resource path of the file (the URI without the `resource://` scheme). */
    export const path: string;
    export default resourceUri;
}

declare module "*.gpa" {
    const resourceUri: string;
    /** Resource path of the file (the URI without the `resource://` scheme). */
    export const path: string;
    export default resourceUri;
}

declare module "*.png" {
    const resourceUri: string;
    /** Resource path of the file (the URI without the `resource://` scheme). */
    export const path: string;
    export default resourceUri;
}

declare module "*.jpg" {
    const resourceUri: string;
    /** Resource path of the file (the URI without the `resource://` scheme). */
    export const path: string;
    export default resourceUri;
}

declare module "*.jpeg" {
    const resourceUri: string;
    /** Resource path of the file (the URI without the `resource://` scheme). */
    export const path: string;
    export default resourceUri;
}

declare module "*.gif" {
    const resourceUri: string;
    /** Resource path of the file (the URI without the `resource://` scheme). */
    export const path: string;
    export default resourceUri;
}

declare module "*.svg" {
    const resourceUri: string;
    /** Resource path of the file (the URI without the `resource://` scheme). */
    export const path: string;
    export default resourceUri;
}

declare module "*.webp" {
    const resourceUri: string;
    /** Resource path of the file (the URI without the `resource://` scheme). */
    export const path: string;
    export default resourceUri;
}

declare module "*.webm" {
    const resourceUri: string;
    /** Resource path of the file (the URI without the `resource://` scheme). */
    export const path: string;
    export default resourceUri;
}

declare module "*.mp4" {
    const resourceUri: string;
    /** Resource path of the file (the URI without the `resource://` scheme). */
    export const path: string;
    export default resourceUri;
}

declare module "*.ogg" {
    const resourceUri: string;
    /** Resource path of the file (the URI without the `resource://` scheme). */
    export const path: string;
    export default resourceUri;
}

declare module "*.mp3" {
    const resourceUri: string;
    /** Resource path of the file (the URI without the `resource://` scheme). */
    export const path: string;
    export default resourceUri;
}

declare module "*.wav" {
    const resourceUri: string;
    /** Resource path of the file (the URI without the `resource://` scheme). */
    export const path: string;
    export default resourceUri;
}

declare module "*.flac" {
    const resourceUri: string;
    /** Resource path of the file (the URI without the `resource://` scheme). */
    export const path: string;
    export default resourceUri;
}

declare module "*.aac" {
    const resourceUri: string;
    /** Resource path of the file (the URI without the `resource://` scheme). */
    export const path: string;
    export default resourceUri;
}

declare module "*.woff" {
    const resourceUri: string;
    /** Resource path of the file (the URI without the `resource://` scheme). */
    export const path: string;
    export default resourceUri;
}

declare module "*.woff2" {
    const resourceUri: string;
    /** Resource path of the file (the URI without the `resource://` scheme). */
    export const path: string;
    export default resourceUri;
}

declare module "*.eot" {
    const resourceUri: string;
    /** Resource path of the file (the URI without the `resource://` scheme). */
    export const path: string;
    export default resourceUri;
}

declare module "*.ttf" {
    const resourceUri: string;
    /** Resource path of the file (the URI without the `resource://` scheme). */
    export const path: string;
    export default resourceUri;
}

declare module "*.otf" {
    const resourceUri: string;
    /** Resource path of the file (the URI without the `resource://` scheme). */
    export const path: string;
    export default resourceUri;
}

declare module "*.ico" {
    const resourceUri: string;
    /** Resource path of the file (the URI without the `resource://` scheme). */
    export const path: string;
    export default resourceUri;
}

declare module "*.avif" {
    const resourceUri: string;
    /** Resource path of the file (the URI without the `resource://` scheme). */
    export const path: string;
    export default resourceUri;
}

declare module "*.gschema.xml" {
    const schemaId: string;
    export default schemaId;
}
