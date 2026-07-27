/// <reference types="vite/client" />
/// <reference types="@gtkx/react/env" />

declare module "*.aac" {
    export const path: string;
}

declare module "*.avif" {
    export const path: string;
}

declare module "*.eot" {
    export const path: string;
}

declare module "*.flac" {
    export const path: string;
}

declare module "*.gif" {
    export const path: string;
}

declare module "*.ico" {
    export const path: string;
}

declare module "*.jpeg" {
    export const path: string;
}

declare module "*.jpg" {
    export const path: string;
}

declare module "*.mp3" {
    export const path: string;
}

declare module "*.mp4" {
    export const path: string;
}

declare module "*.ogg" {
    export const path: string;
}

declare module "*.otf" {
    export const path: string;
}

declare module "*.png" {
    export const path: string;
}

declare module "*.svg" {
    export const path: string;
}

declare module "*.ttf" {
    export const path: string;
}

declare module "*.wav" {
    export const path: string;
}

declare module "*.webm" {
    export const path: string;
}

declare module "*.webp" {
    export const path: string;
}

declare module "*.woff" {
    export const path: string;
}

declare module "*.woff2" {
    export const path: string;
}

declare module "*.data" {
    const resourceUri: string;
    export const path: string;
    export default resourceUri;
}

declare module "*.gpa" {
    const resourceUri: string;
    export const path: string;
    export default resourceUri;
}

declare module "*.css?url" {
    const path: string;
    export default path;
}
