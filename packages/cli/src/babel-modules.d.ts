/**
 * Ambient module declarations for the Babel packages used by the React
 * Compiler transform. Both ship as CommonJS without bundled TypeScript types
 * and expose their plugin/preset on the interop `default` member, so callers
 * normalize with `mod.default ?? mod` before handing the value to Babel.
 */

declare module "babel-plugin-react-compiler" {
    import type { PluginTarget } from "@babel/core";

    /** The React Compiler Babel plugin. */
    const plugin: PluginTarget & { default?: PluginTarget };
    export default plugin;
}

declare module "@babel/preset-typescript" {
    import type { PluginTarget } from "@babel/core";

    /** The Babel preset that parses TypeScript/JSX syntax and strips type annotations. */
    const preset: PluginTarget & { default?: PluginTarget };
    export default preset;
}
