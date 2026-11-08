/**
 * Ambient types for asset imports with the `?resource`, `?icon`, `?font`, `?url`, `?raw` and `?inline`
 * queries, and for CSS imports.
 *
 * @packageDocumentation
 */
/// <reference types="vite/types/importMeta.d.ts" />
/// <reference types="@gtkx/react/env" />

/**
 * Bundles a file of any type as a GResource. `?resource=/exact/path` chooses its resource path.
 *
 * @module
 */
declare module "*?resource" {
    /** GResource path of the bundled asset. */
    const path: string;
    export { path };
    export default path;
}

/**
 * Bundles an icon into the app's private icon theme. `?icon=name` chooses its name; the file name is the default.
 *
 * @module
 */
declare module "*?icon" {
    /** Icon-theme name of the bundled asset. */
    const iconName: string;
    export default iconName;
}

/**
 * Bundles a font with the app and makes its family available to Pango.
 *
 * @module
 */
declare module "*?font" {
    /**
     * Font family name of the bundled font. Importing the module bundles the font file with the application and
     * puts it where fontconfig finds it, so the family is available to Pango without any runtime registration.
     */
    const fontFamily: string;
    export default fontFamily;
}

/**
 * Provides a stylesheet's file path without installing the stylesheet.
 *
 * @module
 */
declare module "*.css?url" {
    /**
     * Absolute filesystem path of the source stylesheet under `gtkx dev` or the emitted stylesheet once built,
     * imported without installing it on the default display.
     */
    const styleSheetUrl: string;
    export default styleSheetUrl;
}

/**
 * Provides a file's path on disk.
 *
 * @module
 */
declare module "*?url" {
    /** Absolute filesystem path of the source file under `gtkx dev` and Vitest, or of the emitted copy once built. */
    const url: string;
    export default url;
}

/**
 * Imports a file's text.
 *
 * @module
 */
declare module "*?raw" {
    /** Text content of the file. */
    const text: string;
    export default text;
}

/**
 * Inlines a file into the bundle.
 *
 * @module
 */
declare module "*?inline" {
    /** Content of the file inlined into the bundle: a stylesheet's text, or a data URL for any other file. */
    const content: string;
    export default content;
}

/**
 * Installs a stylesheet's rules globally for the app's lifetime.
 *
 * @module
 */
declare module "*.css" {}
