/// <reference types="vite/client" />
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

declare module "*.css?url" {
    /**
     * Absolute filesystem path of the source stylesheet under `gtkx dev` or the emitted stylesheet once built,
     * imported without installing it on the default display.
     */
    const styleSheetUrl: string;
    export default styleSheetUrl;
}
