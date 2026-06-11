import { transformAsync } from "@babel/core";
import babelPresetTypescriptNs from "@babel/preset-typescript";
import {
    createGtkxConfigLoader,
    type GtkxConfigLoader,
    type ResolvedReactCompilerOptions,
    resolveReactCompilerOptions,
} from "@gtkx/config";
import babelPluginReactCompilerNs from "babel-plugin-react-compiler";
import type { Plugin, ResolvedConfig, UserConfig } from "vite";

const babelPresetTypescript = babelPresetTypescriptNs.default ?? babelPresetTypescriptNs;
const babelPluginReactCompiler = babelPluginReactCompilerNs.default ?? babelPluginReactCompilerNs;

const SOURCE_EXTENSION = /\.tsx?$/;
const NODE_MODULES = /(?:^|\/)node_modules\//;

type ReactCompilerState = {
    /** Absolute Vite project root; compilation is scoped to files beneath it. */
    root: string;
    /** Resolved compiler options, or `null` when disabled via config. */
    options: ResolvedReactCompilerOptions | null;
};

/**
 * Decides whether a module is a project source file the React Compiler should
 * process: a `.ts`/`.tsx` file under the project root and outside
 * `node_modules`. Query-suffixed ids (e.g. `foo.tsx?raw` asset-text imports)
 * fail the extension test and are left untouched. With no resolved root (e.g. a
 * direct unit-test call before `configResolved`), the root check is skipped.
 */
const isProjectSource = (root: string, id: string): boolean => {
    if (!SOURCE_EXTENSION.test(id)) return false;
    if (NODE_MODULES.test(id)) return false;
    if (root !== "" && !id.startsWith(`${root}/`)) return false;
    return true;
};

/**
 * Vite plugin that runs the React Compiler (`babel-plugin-react-compiler`) over
 * a project's own `.ts`/`.tsx` source before the JSX/TypeScript transform that
 * follows it in each pipeline (SWC for `gtkx dev`, Rolldown for `gtkx build`,
 * esbuild under Vitest).
 *
 * The compiler auto-memoizes components and hooks, so the reconciler commits
 * fewer GObject property sets and signal reconnections per render. Babel parses
 * and strips TypeScript while leaving JSX in place; the downstream transform
 * lowers the JSX as usual. The compiler's `react/compiler-runtime` import
 * resolves from the application's React 19 dependency.
 *
 * It is enabled by default and reads its options from `gtkx.config.ts` during
 * the `config` hook (`reactCompiler: false` disables it). Compilation is scoped
 * to files under the resolved Vite root, so workspace dependencies and
 * published packages — which ship pre-compiled — are never recompiled.
 *
 * @param loadConfig - Memoizing config loader, shared with the other gtkx
 *   plugins by `gtkxVitePlugins` so the pipeline loads `gtkx.config.ts` once.
 * @returns The `gtkx:react-compiler` Vite plugin.
 */
export function gtkxReactCompiler(loadConfig: GtkxConfigLoader = createGtkxConfigLoader()): Plugin {
    const state: ReactCompilerState = {
        root: "",
        options: resolveReactCompilerOptions(true),
    };

    return {
        name: "gtkx:react-compiler",
        enforce: "pre",

        async config(config: UserConfig) {
            state.options = (await loadConfig(config.root ?? process.cwd())).reactCompiler;
        },

        configResolved(config: ResolvedConfig) {
            state.root = config.root;
        },

        async transform(code, id) {
            const options = state.options;
            if (options === null || !isProjectSource(state.root, id)) {
                return;
            }

            const result = await transformAsync(code, {
                filename: id,
                babelrc: false,
                configFile: false,
                sourceMaps: true,
                presets: [babelPresetTypescript],
                plugins: [[babelPluginReactCompiler, options]],
            });

            if (!result?.code) {
                return;
            }

            return { code: result.code, map: result.map };
        },
    };
}
