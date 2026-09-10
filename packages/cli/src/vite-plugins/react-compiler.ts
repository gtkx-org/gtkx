import type { ConfigLoader } from "@gtkx/config";
import type { ResolvedReactCompilerOptions } from "@gtkx/config/internal";
import type { Plugin, ResolvedConfig, UserConfig } from "vite";
import { createConfigLoader, viteProjectRoot } from "@gtkx/config/internal";
import {
    type CompilerOutput,
    createReactCompilerCache,
    type ReactCompilerCache,
} from "../internal/react-compiler-cache.js";

type ReactCompilerState = {
    cache: ReactCompilerCache | null;
    options: ResolvedReactCompilerOptions | null;
    root: string;
};

type BabelToolchain = Awaited<ReturnType<typeof loadBabelToolchain>>;

const SOURCE_EXTENSION = /\.[jt]sx?$/;
const TYPESCRIPT_EXTENSION = /\.tsx?$/;
const NODE_MODULES = /(?:^|\/)node_modules\//;
const MEMOIZABLE_SOURCE = /use[A-Z0-9]|use memo|use forget/;
const JSX_MARK = "<";
const PLAIN_TYPESCRIPT = ".ts";
const ALL_FUNCTIONS = "all";
const babel: { toolchain: Promise<BabelToolchain> | undefined } = { toolchain: undefined };

const loadBabelToolchain = async () => {
    const [core, preset, plugin] = await Promise.all([
        import("@babel/core"),
        import("@babel/preset-typescript"),
        import("babel-plugin-react-compiler"),
    ]);

    return {
        presetTypescript: preset.default.default ?? preset.default,
        reactCompiler: plugin.default.default ?? plugin.default,
        transformAsync: core.transformAsync,
    };
};

const babelToolchain = (): Promise<BabelToolchain> => (babel.toolchain ??= loadBabelToolchain());

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

const isMemoizable = (code: string, id: string, options: ResolvedReactCompilerOptions): boolean => {
    if (options.compilationMode === ALL_FUNCTIONS || MEMOIZABLE_SOURCE.test(code)) {
        return true;
    }

    return !id.endsWith(PLAIN_TYPESCRIPT) && code.includes(JSX_MARK);
};

const compileSource = async (code: string, id: string, options: ResolvedReactCompilerOptions) => {
    const toolchain = await babelToolchain();

    const result = await toolchain.transformAsync(code, {
        filename: id,
        babelrc: false,
        configFile: false,
        sourceMaps: true,
        parserOpts: { plugins: id.endsWith(PLAIN_TYPESCRIPT) ? [] : ["jsx"] },
        presets: TYPESCRIPT_EXTENSION.test(id) ? [toolchain.presetTypescript] : [],
        plugins: [[toolchain.reactCompiler, options]],
    });

    if (!result?.code) {
        return;
    }

    return result.map == null ? { code: result.code } : { code: result.code, map: JSON.stringify(result.map) };
};

const cachedSource = async (
    cache: ReactCompilerCache,
    code: string,
    id: string,
    options: ResolvedReactCompilerOptions,
): Promise<CompilerOutput | undefined> => {
    const key = cache.keyFor(code, id);
    const cached = cache.read(key);

    if (cached !== undefined) {
        return cached;
    }

    const compiled = await compileSource(code, id, options);

    if (compiled !== undefined) {
        cache.write(key, compiled);
    }

    return compiled;
};

function gtkxReactCompiler(loadConfig: ConfigLoader = createConfigLoader()): Plugin {
    const state: ReactCompilerState = {
        cache: null,
        options: null,
        root: "",
    };

    return {
        name: "gtkx:react-compiler",
        enforce: "pre",

        async config(config: UserConfig) {
            const resolved = await loadConfig.resolve(viteProjectRoot(config));
            state.options = resolved.reactCompiler;
        },

        configResolved(config: ResolvedConfig) {
            state.root = config.root;
            state.cache = state.options === null ? null : createReactCompilerCache(config.cacheDir, state.options);
        },

        transform: {
            filter: { id: { include: SOURCE_EXTENSION, exclude: NODE_MODULES } },

            async handler(code, id) {
                const options = state.options;

                if (options === null || !isProjectSource(state.root, id) || !isMemoizable(code, id, options)) {
                    return;
                }

                const cache = state.cache;

                return cache === null ? compileSource(code, id, options) : cachedSource(cache, code, id, options);
            },
        },
    };
}

export { gtkxReactCompiler };
