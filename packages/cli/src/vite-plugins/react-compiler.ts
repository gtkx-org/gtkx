/// <reference path="../babel-modules.d.ts" />
import { transformAsync } from "@babel/core";
import babelPresetTypescriptNs from "@babel/preset-typescript";
import type { ResolvedReactCompilerOptions } from "@gtkx/config";
import { type ConfigLoader, createConfigLoader } from "@gtkx/config/internal";
import babelPluginReactCompilerNs from "babel-plugin-react-compiler";
import type { Plugin, ResolvedConfig, UserConfig } from "vite";

const babelPresetTypescript = babelPresetTypescriptNs.default ?? babelPresetTypescriptNs;
const babelPluginReactCompiler = babelPluginReactCompilerNs.default ?? babelPluginReactCompilerNs;

const SOURCE_EXTENSION = /\.[jt]sx?$/;
const TYPESCRIPT_EXTENSION = /\.tsx?$/;
const TYPE_ONLY_EXTENSION = /\.ts$/;
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

export function gtkxReactCompiler(loadConfig: ConfigLoader = createConfigLoader()): Plugin {
    const state: ReactCompilerState = {
        root: "",
        options: null,
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
                parserOpts: { plugins: TYPE_ONLY_EXTENSION.test(id) ? [] : ["jsx"] },
                presets: TYPESCRIPT_EXTENSION.test(id) ? [babelPresetTypescript] : [],
                plugins: [[babelPluginReactCompiler, options]],
            });

            if (!result?.code) {
                return;
            }

            return result.map == null ? { code: result.code } : { code: result.code, map: JSON.stringify(result.map) };
        },
    };
}
