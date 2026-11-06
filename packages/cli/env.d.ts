/// <reference types="vite/types/importMeta.d.ts" />
/// <reference types="@gtkx/react/env" />

declare module "*?resource" {
    /** GResource path of the bundled asset. */
    const path: string;
    export { path };
    export default path;
}

declare module "*?icon" {
    /** Icon-theme name of the bundled asset. */
    const iconName: string;
    export default iconName;
}

declare module "*?font" {
    /**
     * Font family name of the bundled font. Importing the module bundles the font file with the application and
     * puts it where fontconfig finds it, so the family is available to Pango without any runtime registration.
     */
    const fontFamily: string;
    export default fontFamily;
}

declare module "*.css?url" {
    /**
     * Absolute filesystem path of the source stylesheet under `gtkx dev` or the emitted stylesheet once built,
     * imported without installing it on the default display.
     */
    const styleSheetUrl: string;
    export default styleSheetUrl;
}

declare module "*?url" {
    /** Absolute filesystem path of the source file under `gtkx dev` and Vitest, or of the emitted copy once built. */
    const url: string;
    export default url;
}

declare module "*?raw" {
    /** Text content of the file. */
    const text: string;
    export default text;
}

declare module "*?inline" {
    /** Content of the file inlined into the bundle: a stylesheet's text, or a data URL for any other file. */
    const content: string;
    export default content;
}

declare module "*.css" {}
