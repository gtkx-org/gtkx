/// <reference path="../babel-modules.d.ts" />
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
const JSX_EXTENSION = /\.tsx$/;
const NODE_MODULES = /(?:^|\/)node_modules\//;

type ReactCompilerState = {
    root: string;
    options: ResolvedReactCompilerOptions | null;
};

const isProjectSource = (root: string, id: string): boolean => {
    if (!SOURCE_EXTENSION.test(id)) return false;
    if (NODE_MODULES.test(id)) return false;
    if (root !== "" && !id.startsWith(`${root}/`)) return false;
    return true;
};

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
                parserOpts: { plugins: JSX_EXTENSION.test(id) ? ["jsx"] : [] },
                presets: [babelPresetTypescript],
                plugins: [[babelPluginReactCompiler, options]],
            });

            if (!result?.code) {
                return;
            }

            return result.map == null ? { code: result.code } : { code: result.code, map: JSON.stringify(result.map) };
        },
    };
}
