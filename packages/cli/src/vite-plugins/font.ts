import type { Plugin, Rollup } from "vite";
import { readFileSync } from "node:fs";
import { parseSync } from "vite";
import type { AssetEmitter } from "./asset-emitter.js";
import { prependBanner } from "../internal/banner.js";
import { fontFileName, FONTS_DIR } from "../internal/font-path.js";
import { sourceLanguage } from "../internal/source-imports.js";
import { xdgDataDirsBanner } from "../internal/xdg-banner.js";
import { parseFontSpecifier } from "./asset-specifier.js";
import { fontFamilyNames } from "./font-name.js";
import { stripQuery } from "./strip-query.js";
import { createVirtualNamespace } from "./virtual-module.js";

type PluginState = {
    isBuild: boolean;
    emitted: Set<string>;
};

type ResolveContext = Parameters<typeof resolveToVirtual>[0];
type ResolveRequest = Parameters<typeof resolveToVirtual>[1];

type RetainedFontModuleId = {
    id: string;
    moduleSideEffects: true;
};

type LoadContext = AssetEmitter & {
    addWatchFile: (file: string) => void;
    error: (message: string) => never;
};

const VIRTUAL_PREFIX = "\0gtkx-font:";
const { isVirtual, fromVirtualId, resolveToVirtual } = createVirtualNamespace(VIRTUAL_PREFIX);

const unreadableFontError = (filePath: string): string =>
    `Cannot read a font family name from ${filePath}; ?font expects a TrueType, OpenType, ` +
    "TrueType Collection, WOFF, or WOFF2 font";

const resolveFontId = async (
    ctx: ResolveContext,
    request: ResolveRequest,
): Promise<RetainedFontModuleId | undefined> => {
    if (parseFontSpecifier(request.source) === null) {
        return undefined;
    }

    const virtualId = await resolveToVirtual(ctx, request);

    return virtualId === undefined ? undefined : { id: virtualId, moduleSideEffects: true };
};

const emitFont = (ctx: LoadContext, state: PluginState, filePath: string, content: Buffer): void => {
    const fileName = `${FONTS_DIR}/${fontFileName(filePath, content)}`;

    if (state.emitted.has(fileName)) {
        return;
    }

    state.emitted.add(fileName);
    ctx.emitFile({ type: "asset", fileName, source: content });
};

const loadFontModule = (ctx: LoadContext, state: PluginState, id: string): string | undefined => {
    if (!isVirtual(id)) {
        return undefined;
    }

    const filePath = stripQuery(fromVirtualId(id));
    const content = readFileSync(filePath);
    const [family] = fontFamilyNames(content);

    if (family === undefined) {
        return ctx.error(unreadableFontError(filePath));
    }

    ctx.addWatchFile(filePath);

    if (state.isBuild) {
        emitFont(ctx, state, filePath, content);
    }

    return `export default ${JSON.stringify(family)};`;
};

const hasSideEffectFontImport = (code: string, id: string): boolean => {
    const lang = sourceLanguage(stripQuery(id));

    if (lang === undefined || !code.includes("?font")) {
        return false;
    }

    const parsed = parseSync(id, code, { lang });

    if (parsed.errors.length > 0) {
        return false;
    }

    return parsed.module.staticImports.some(
        (statement) => statement.entries.length === 0 && parseFontSpecifier(statement.moduleRequest.value) !== null,
    );
};

const retainSideEffectFontImport = (
    code: string,
    id: string,
): { code: string; moduleSideEffects: true } | null =>
    hasSideEffectFontImport(code, id)
        ? { code, moduleSideEffects: true }
        : null;

const fontBanner = (state: PluginState) => (chunk: Rollup.RenderedChunk): string =>
    state.emitted.size === 0 ? "" : xdgDataDirsBanner(chunk);

function gtkxFont(): Plugin {
    const state: PluginState = { isBuild: false, emitted: new Set() };

    return {
        name: "gtkx:font",
        enforce: "pre",

        configResolved(config) {
            state.isBuild = config.command === "build";
        },

        resolveId(source, importer, options) {
            return resolveFontId(this, { source, importer, options });
        },

        load(id) {
            return loadFontModule(this, state, id);
        },

        transform(code, id) {
            return retainSideEffectFontImport(code, id);
        },

        outputOptions(options) {
            if (!state.isBuild) {
                return;
            }

            return prependBanner(options, fontBanner(state));
        },
    };
}

export { gtkxFont };
