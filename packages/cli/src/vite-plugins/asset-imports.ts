import type { ParseResult, ParserOptions, Plugin } from "vite";
import { extname } from "node:path";
import { parseSync } from "vite";
import { ASSET_MENTION_RE } from "./asset-extensions.js";
import { DATA_PREFIX, isAssetSpecifier, isDataAsset } from "./asset-specifier.js";
import { RESOURCE_PATH_EXPORT } from "./resource-shared.js";
import { stripQuery } from "./strip-query.js";

type SourceLanguage = NonNullable<ParserOptions["lang"]>;
type ParsedModule = ParseResult["module"];
type ImportStatement = ParsedModule["staticImports"][number];
type ExportStatement = ParsedModule["staticExports"][number];
type ExportEntry = ExportStatement["entries"][number];
type BindingEntry = { importName: { name: string | null }; isType: boolean };
type NamedBinding = { name: string; source: string };

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
    "A query suffix hands the import to the Vite asset pipeline instead of the GResource bundle; drop the " +
    `query to keep ${RESOURCE_BINDING}${URL_FALLBACK}`;

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

const isBacked = ({ name, source }: NamedBinding): boolean =>
    isDataAsset(source) && name === RESOURCE_PATH_EXPORT;

const unbackedBinding = (parsed: ParsedModule): NamedBinding | undefined =>
    bindings(parsed).find((binding) => isAssetSpecifier(binding.source) && !isBacked(binding));

const bundleAdvice = (source: string): string => {
    if (isDataAsset(source)) {
        return BUNDLE_ADVICE;
    }

    return source.startsWith(DATA_PREFIX) ? QUERY_ADVICE : RELATIVE_ADVICE;
};

const unbackedBindingError = (path: string, binding: NamedBinding): Error =>
    new Error(
        `${path}: ${JSON.stringify(binding.source)} does not export ${JSON.stringify(binding.name)}, which ` +
        "gtkx build rejects and gtkx dev would bind as undefined. " +
        bundleAdvice(binding.source),
    );

const isCheckedSource = (path: string): boolean => !path.startsWith(VIRTUAL_PREFIX) && !NODE_MODULES.test(path);

const checkAssetImports = (code: string, id: string): void => {
    const path = stripQuery(id);
    const lang = SOURCE_LANGUAGES.get(extname(path).toLowerCase());

    if (lang === undefined || !isCheckedSource(path) || !ASSET_MENTION_RE.test(code)) {
        return;
    }

    const parsed = parseSync(path, code, { lang });

    if (parsed.errors.length > 0) {
        return;
    }

    const binding = unbackedBinding(parsed.module);

    if (binding !== undefined) {
        throw unbackedBindingError(path, binding);
    }
};

function gtkxAssetImports(): Plugin {
    return {
        name: "gtkx:asset-imports",
        enforce: "pre",

        transform(code, id) {
            checkAssetImports(code, id);
        },
    };
}

export { gtkxAssetImports };
