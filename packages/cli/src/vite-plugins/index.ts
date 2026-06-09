import type { Plugin } from "vite";
import { gtkxAssets } from "./assets.js";
import { gtkxConfig } from "./config.js";
import { gtkxResources } from "./gresources.js";
import { gtkxGSettings } from "./gsettings.js";
import { gtkxReactCompiler } from "./react-compiler.js";

/**
 * The core GTKX Vite plugins shared by the `dev`, `build`, and test
 * pipelines, in the order they must run: the `virtual:gtkx-config` resolver,
 * GSettings schema compilation, GResource bundling, asset URL resolution, then
 * the React Compiler.
 *
 * Each pipeline appends its own extras (Fast Refresh for `dev`, the native
 * binary and built-url rewrites for `build`); the `@gtkx/vitest` plugin
 * spreads this set verbatim. The React Compiler runs first among the
 * JS-transforming plugins (`enforce: "pre"`), so each pipeline's own
 * JSX/TypeScript transform lowers its output afterward. `gtkxConfig`,
 * `gtkxResources`, and `gtkxReactCompiler` self-load their settings from
 * `gtkx.config.ts`, so no caller threads build-time configuration through.
 *
 * @returns The ordered list of core GTKX plugins.
 */
export const gtkxVitePlugins = (): Plugin[] => [
    gtkxConfig(),
    gtkxGSettings(),
    gtkxResources(),
    gtkxAssets(),
    gtkxReactCompiler(),
];
