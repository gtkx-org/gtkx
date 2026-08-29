import type { ParseResult, Plugin } from "vite";
import { parseSync } from "vite";
import { sourceLanguage } from "../internal/source-imports.js";
import { ASSET_MENTION_RE } from "./asset-extensions.js";
import {
    isAssetSpecifier,
    isUrlSpecifier,
    parseIconSpecifier,
    parseResourceSpecifier,
} from "./asset-specifier.js";
import { RESOURCE_PATH_EXPORT } from "./resource-shared.js";
import { stripQuery } from "./strip-query.js";

type ParsedModule = ParseResult["module"];
type ImportStatement = ParsedModule["staticImports"][number];
type ExportStatement = ParsedModule["staticExports"][number];
type ExportEntry = ExportStatement["entries"][number];
type BindingEntry = { importName: { name: string | null }; isType: boolean };
type NamedBinding = { name: string; source: string };

const NODE_MODULES = /(?:^|\/)node_modules\//;
const VIRTUAL_PREFIX = "\0";
const DEFAULT_BINDING = "default";
const RESOURCE_BINDING = JSON.stringify(RESOURCE_PATH_EXPORT);

const QUERY_ADVICE =
    `A URL asset exports only its default filesystem path; import the default instead of ${RESOURCE_BINDING}.`;

const RESOURCE_ADVICE =
    `A resource asset exports only its default GResource path and ${RESOURCE_BINDING}, and nothing else.`;

const ICON_ADVICE = "An icon asset exports only its default icon-theme name, and nothing else.";

const RELATIVE_ADVICE =
    "Add ?resource for a GResource, ?icon for a themed icon, or ?url for an emitted file.";

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

const isBacked = ({ name, source }: NamedBinding): boolean => {
    if (name !== RESOURCE_PATH_EXPORT) {
        return false;
    }

    return parseResourceSpecifier(source) !== null;
};

const isCheckedSpecifier = (source: string): boolean => isAssetSpecifier(source) || isUrlSpecifier(source);

const unbackedBinding = (parsed: ParsedModule): NamedBinding | undefined =>
    bindings(parsed).find((binding) => isCheckedSpecifier(binding.source) && !isBacked(binding));

const adviceFor = (source: string): string => {
    if (parseResourceSpecifier(source) !== null) {
        return RESOURCE_ADVICE;
    }

    if (parseIconSpecifier(source) !== null) {
        return ICON_ADVICE;
    }

    if (isUrlSpecifier(source)) {
        return QUERY_ADVICE;
    }

    return RELATIVE_ADVICE;
};

const unbackedBindingError = (path: string, binding: NamedBinding): Error =>
    new Error(
        `${path}: ${JSON.stringify(binding.source)} does not export ${JSON.stringify(binding.name)}, which ` +
        "gtkx build rejects and gtkx dev would bind as undefined. " +
        adviceFor(binding.source),
    );

const isCheckedSource = (path: string): boolean => !path.startsWith(VIRTUAL_PREFIX) && !NODE_MODULES.test(path);
const hasCheckedAssetMention = (code: string): boolean => ASSET_MENTION_RE.test(code) || code.includes("?url");

const checkAssetImports = (code: string, id: string): void => {
    const path = stripQuery(id);
    const lang = sourceLanguage(path);

    if (lang === undefined || !isCheckedSource(path) || !hasCheckedAssetMention(code)) {
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
