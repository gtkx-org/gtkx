import type { ConfigLoader } from "@gtkx/config";
import type { ResolvedReactCompilerOptions } from "@gtkx/config/internal";
import type { Plugin, ResolvedConfig, UserConfig } from "vite";
import { transformAsync } from "@babel/core";
import babelPresetTypescriptNs from "@babel/preset-typescript";
import { createConfigLoader } from "@gtkx/config/internal";
import babelPluginReactCompilerNs from "babel-plugin-react-compiler";

type ReactCompilerState = {
    root: string;
    options: ResolvedReactCompilerOptions | null;
};

const babelPresetTypescript = babelPresetTypescriptNs.default ?? babelPresetTypescriptNs;
const babelPluginReactCompiler = babelPluginReactCompilerNs.default ?? babelPluginReactCompilerNs;
const SOURCE_EXTENSION = /\.[jt]sx?$/;
const TYPESCRIPT_EXTENSION = /\.tsx?$/;
const NODE_MODULES = /(?:^|\/)node_modules\//;
const REGEXP_SPECIAL_CHARACTERS = /[.*+?^${}()|[\]\\]/g;

const projectSourcePattern = (root: string): RegExp => {
    if (root === "") {
        return SOURCE_EXTENSION;
    }

    const escapedRoot = root.replaceAll(REGEXP_SPECIAL_CHARACTERS, String.raw`\$&`);

    return new RegExp(String.raw`^${escapedRoot}/.*\.[jt]sx?$`);
};

const isProjectSource = (root: string, id: string): boolean => {
    if (!SOURCE_EXTENSION.test(id)) {
        return false;
    }

    if (NODE_MODULES.test(id)) {
        return false;
    }

    if (root !== "" && !id.startsWith(`${root}/`)) {
        return false;
    }

    return true;
};

const compileSource = async (code: string, id: string, options: ResolvedReactCompilerOptions) => {
    const result = await transformAsync(code, {
        filename: id,
        babelrc: false,
        configFile: false,
        sourceMaps: true,
        parserOpts: { plugins: id.endsWith(".ts") ? [] : ["jsx"] },
        presets: TYPESCRIPT_EXTENSION.test(id) ? [babelPresetTypescript] : [],
        plugins: [[babelPluginReactCompiler, options]],
    });

    if (!result?.code) {
        return;
    }

    return result.map == null ? { code: result.code } : { code: result.code, map: JSON.stringify(result.map) };
};

function gtkxReactCompiler(loadConfig: ConfigLoader = createConfigLoader()): Plugin {
    const state: ReactCompilerState = {
        root: "",
        options: null,
    };

    const sourceFilter = {
        id: {
            include: SOURCE_EXTENSION,
            exclude: NODE_MODULES,
        },
    };

    return {
        name: "gtkx:react-compiler",
        enforce: "pre",

        async config(config: UserConfig) {
            const resolved = await loadConfig.resolve(config.root ?? process.cwd());
            state.options = resolved.reactCompiler;
        },

        configResolved(config: ResolvedConfig) {
            state.root = config.root;
            sourceFilter.id.include = projectSourcePattern(config.root);
        },

        transform: {
            filter: sourceFilter,
            async handler(code, id) {
                const options = state.options;

                if (options === null || !isProjectSource(state.root, id)) {
                    return;
                }

                return compileSource(code, id, options);
            },
        },
    };
}

export { gtkxReactCompiler };
