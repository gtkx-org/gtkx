import type { ConfigLoader } from "@gtkx/config";
import type { ParseResult, ParserOptions, Plugin, UserConfig } from "vite";
import { createConfigLoader } from "@gtkx/config/internal";
import { extname } from "node:path";
import { parseSync } from "vite";
import { ASSET_MENTION_RE } from "./asset-extensions.js";
import {
    DATA_PREFIX,
    isAssetSpecifier,
    isDataAsset,
    isUrlSpecifier,
    parseIconSpecifier,
    parseResourceSpecifier,
} from "./asset-specifier.js";
import { RESOURCE_PATH_EXPORT } from "./resource-shared.js";
import { stripQuery } from "./strip-query.js";

type SourceLanguage = NonNullable<ParserOptions["lang"]>;
type ParsedModule = ParseResult["module"];
type ImportStatement = ParsedModule["staticImports"][number];
type ExportStatement = ParsedModule["staticExports"][number];
type ExportEntry = ExportStatement["entries"][number];
type BindingEntry = { importName: { name: string | null }; isType: boolean };
type NamedBinding = { name: string; source: string };
type PluginState = { isV2: boolean };

const SOURCE_LANGUAGES: Map<string, SourceLanguage> = new Map([
    [".cjs", "jsx"],
    [".cts", "ts"],
    [".js", "jsx"],
    [".jsx", "jsx"],
    [".mjs", "jsx"],
    [".mts", "ts"],
    [".ts", "ts"],
    [".tsx", "tsx"],
]);

const NODE_MODULES = /(?:^|\/)node_modules\//;
const VIRTUAL_PREFIX = "\0";
const DEFAULT_BINDING = "default";
const RESOURCE_BINDING = JSON.stringify(RESOURCE_PATH_EXPORT);
const DATA_IMPORT_EXAMPLE = `"${DATA_PREFIX}<path>"`;
const URL_FALLBACK = ", or import the default for the asset URL.";

const BUNDLE_ADVICE =
    `An asset staged into the GResource bundle exports ${RESOURCE_BINDING} and a "resource://" default, and ` +
    "nothing else.";

const QUERY_ADVICE =
    `A URL asset exports only its default filesystem path; import the default instead of ${RESOURCE_BINDING}.`;

const RESOURCE_ADVICE =
    `A resource asset exports only its default GResource path and ${RESOURCE_BINDING}, and nothing else.`;

const ICON_ADVICE = "An icon asset exports only its default icon-theme name, and nothing else.";

const RELATIVE_ADVICE =
    `Only assets imported through "${DATA_PREFIX}" are staged into the GResource bundle and export ` +
    `${RESOURCE_BINDING}; move the file under the data directory and import it as ` +
    `${DATA_IMPORT_EXAMPLE}${URL_FALLBACK}`;

const boundName = (entry: BindingEntry): string | null => {
    const { name } = entry.importName;

    if (name === null || name === DEFAULT_BINDING || entry.isType) {
        return null;
    }

    return name;
};

const importBindings = (statement: ImportStatement): NamedBinding[] =>
    statement.entries
        .map((entry) => boundName(entry))
        .filter((name) => name !== null)
        .map((name) => ({ name, source: statement.moduleRequest.value }));

const exportBinding = (entry: ExportEntry): NamedBinding | null => {
    const name = boundName(entry);
    const source = entry.moduleRequest?.value;

    return name === null || source === undefined ? null : { name, source };
};

const exportBindings = (statement: ExportStatement): NamedBinding[] =>
    statement.entries.map((entry) => exportBinding(entry)).filter((binding) => binding !== null);

const bindings = (parsed: ParsedModule): NamedBinding[] => [
    ...parsed.staticImports.flatMap((statement) => importBindings(statement)),
    ...parsed.staticExports.flatMap((statement) => exportBindings(statement)),
];

const isBacked = ({ name, source }: NamedBinding, isV2: boolean): boolean => {
    if (name !== RESOURCE_PATH_EXPORT) {
        return false;
    }

    return isV2 ? parseResourceSpecifier(source) !== null : isDataAsset(source);
};

const isCheckedSpecifier = (source: string): boolean => isAssetSpecifier(source) || isUrlSpecifier(source);

const unbackedBinding = (parsed: ParsedModule, isV2: boolean): NamedBinding | undefined =>
    bindings(parsed).find((binding) => isCheckedSpecifier(binding.source) && !isBacked(binding, isV2));

const isBundledResource = (source: string, isV2: boolean): boolean =>
    isV2
        ? parseResourceSpecifier(source) !== null || parseIconSpecifier(source) !== null
        : isDataAsset(source);

const v2BundleAdvice = (source: string): string =>
    parseIconSpecifier(source) === null ? RESOURCE_ADVICE : ICON_ADVICE;

const bundleAdvice = (source: string, isV2: boolean): string => {
    if (isBundledResource(source, isV2)) {
        return isV2 ? v2BundleAdvice(source) : BUNDLE_ADVICE;
    }

    if (isUrlSpecifier(source)) {
        return QUERY_ADVICE;
    }

    return source.startsWith(DATA_PREFIX) ? QUERY_ADVICE : RELATIVE_ADVICE;
};

const unbackedBindingError = (path: string, binding: NamedBinding, isV2: boolean): Error =>
    new Error(
        `${path}: ${JSON.stringify(binding.source)} does not export ${JSON.stringify(binding.name)}, which ` +
        "gtkx build rejects and gtkx dev would bind as undefined. " +
        bundleAdvice(binding.source, isV2),
    );

const isCheckedSource = (path: string): boolean => !path.startsWith(VIRTUAL_PREFIX) && !NODE_MODULES.test(path);
const hasCheckedAssetMention = (code: string): boolean => ASSET_MENTION_RE.test(code) || code.includes("?url");

const checkAssetImports = (code: string, id: string, isV2: boolean): void => {
    const path = stripQuery(id);
    const lang = SOURCE_LANGUAGES.get(extname(path).toLowerCase());

    if (lang === undefined || !isCheckedSource(path) || !hasCheckedAssetMention(code)) {
        return;
    }

    const parsed = parseSync(path, code, { lang });

    if (parsed.errors.length > 0) {
        return;
    }

    const binding = unbackedBinding(parsed.module, isV2);

    if (binding !== undefined) {
        throw unbackedBindingError(path, binding, isV2);
    }
};

function gtkxAssetImports(loadConfig: ConfigLoader = createConfigLoader()): Plugin {
    const state: PluginState = { isV2: false };

    return {
        name: "gtkx:asset-imports",
        enforce: "pre",

        async config(config: UserConfig) {
            const loaded = await loadConfig.load(config.root ?? process.cwd());
            state.isV2 = loaded.config.future?.v2ResourceImports === true;
        },

        transform(code, id) {
            checkAssetImports(code, id, state.isV2);
        },
    };
}

export { gtkxAssetImports };
