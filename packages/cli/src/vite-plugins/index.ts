import type { Plugin } from "vite";
import { gtkxAssets } from "./assets.js";
import { gtkxResources } from "./gresources.js";
import { gtkxGSettings } from "./gsettings.js";

/**
 * The core GTKX Vite plugins shared by the `dev`, `build`, and test
 * pipelines, in the order they must run: GSettings schema compilation,
 * GResource bundling, then asset URL resolution.
 *
 * Each pipeline appends its own extras (Fast Refresh for `dev`, the native
 * binary and built-url rewrites for `build`); the `@gtkx/vitest` plugin
 * spreads this set verbatim. `gtkxResources` self-loads `applicationId` from
 * `gtkx.config.ts`, so no caller threads build-time configuration through.
 *
 * @returns The ordered list of core GTKX plugins.
 */
export const gtkxVitePlugins = (): Plugin[] => [gtkxGSettings(), gtkxResources(), gtkxAssets()];
