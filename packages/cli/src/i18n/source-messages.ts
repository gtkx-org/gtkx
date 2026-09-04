import type { ExtractedKey, ExtractedKeysMap, Logger, Plugin } from "i18next-cli";
import type { ESTree } from "vite";
import { type NodePath, parseSync as parseBabelSync, type Scope, traverse, types } from "@babel/core";
import { isPathInside, isPathWithin, toPosixPath } from "@gtkx/utils";
import { runExtractor } from "i18next-cli";
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { parseSync, Visitor } from "vite";
import type { CatalogProject } from "./catalogs.js";
import { runCliTool } from "../internal/run-cli-tool.js";
import { sourceLanguage } from "../internal/source-imports.js";
import { replaceCatalogTemplate } from "./catalog-template.js";
import { metadataTemplateFiles } from "./metadata-templates.js";
import { clearI18nResources, i18nToolkitConfig } from "./types.js";

type SourceLocation = {
    file: string;
    line?: number | undefined;
    column?: number | undefined;
};
type ExtractedLocation = NonNullable<ExtractedKey["locations"]>[number];

type SourceMessage = {
    context: string | null;
    locations: SourceLocation[];
    namespace: string;
    plural: string | null;
    singular: string;
    sourceKey: string;
};

type SyntheticEntry = {
    call: string;
    line: number | undefined;
};

type SourceExtraction = {
    messages: SourceMessage[];
    output: string;
    project: CatalogProject;
    workDir: string;
};

type CatalogTemplateExtraction = {
    messages: SourceMessage[];
    output?: string | undefined;
    project: CatalogProject;
    shouldPreserveMetadataMessages: boolean;
};

type PluralVariant = {
    category: string;
    defaultValue: string;
    locations: SourceLocation[];
};

type PluralGroup = {
    baseKey: string;
    namespace: string;
    variants: PluralVariant[];
};

type TranslationReferences = {
    calls: Set<number>;
    elements: Set<number>;
    entryLocations: Map<string, SourcePoint[]>;
    locations: Map<string, SourcePoint>;
    masks: SourceMask[];
    sourcePoints: Map<number, SourcePoint>;
};
type SourceMask = { end: number; start: number };
type SourcePoint = { column: number; line: number };
type TranslationCallKind = "alias" | "canonical";
type ImportedBinding = {
    imported: string;
    local: string;
    source: string;
    style: "default" | "named" | "namespace";
};
type TranslationHookBinding = { call: types.CallExpression; isCanonical: boolean };
type TranslationMemberExpression = types.MemberExpression | types.OptionalMemberExpression;
type ResolvedBinding = NonNullable<ReturnType<Scope["getBinding"]>>;
type LocatableNode = { loc?: { start: SourcePoint } | null | undefined };

const CONTEXT_SEPARATOR = "\u{4}";
const DEFAULT_NAMESPACE = "translation";
const POTFILES_FILENAME = "POTFILES.in";
const SYNTHETIC_FILENAME = "messages.js";
const UNSUPPORTED_PLURAL_OPTION = /^defaultValue_(few|many|two|zero)$/u;
const STATIC_SOURCE_OPTION_NAMES: ReadonlySet<string> = new Set([
    "context",
    "defaultValue",
    "defaultValue_one",
    "defaultValue_other",
    "keyPrefix",
]);
const NESTED_CONTEXT = /["']?context["']?\s*:\s*(?:"([^"]*)"|'([^']*)')/u;
const NESTED_COUNT = /["']?count["']?\s*:/u;
const NESTED_STRUCTURE_TOKEN = /"[^"]*"|'[^']*'|[()]/gu;
const TRANSLATION_MODULES = new Set(["@gtkx/i18n", "i18next"]);
const TRANS_ELEMENTS: ReadonlySet<string> = new Set(["Trans", "TransWithoutContext"]);
const STATIC_KEY_WRAPPER_TYPES: ReadonlySet<string> = new Set([
    "ParenthesizedExpression",
    "TSAsExpression",
    "TSSatisfiesExpression",
    "TSTypeAssertion",
    "TSNonNullExpression",
]);

class SourceExtractionError extends Error {}

const sourceErrorMessage = (error: unknown): string => {
    if (!(error instanceof Error)) {
        return String(error);
    }

    if (
        "code" in error &&
        error.code === "BABEL_PARSE_ERROR"
    ) {
        const separator = error.message.indexOf(": ");

        if (separator !== -1) {
            return error.message.slice(separator + 2);
        }
    }

    return error.message;
};

const projectSourcePath = (root: string, path: string): string => {
    const absolute = isAbsolute(path) ? resolve(path) : resolve(root, path);

    return toPosixPath(isPathInside(root, absolute) ? relative(root, absolute) : path);
};

const sourceExtractionError = (
    root: string,
    path: string,
    point: SourcePoint | null,
    error: unknown,
): SourceExtractionError => {
    if (error instanceof SourceExtractionError) {
        return error;
    }

    const file = projectSourcePath(root, path);
    const location = point === null
        ? file
        : `${file}:${String(point.line)}:${String(point.column + 1)}`;

    return new SourceExtractionError(`${location}: ${sourceErrorMessage(error)}`, { cause: error });
};

const locatablePoint = (node: LocatableNode): SourcePoint | null => {
    const location = node.loc?.start;

    return location === undefined ? null : { column: location.column, line: location.line };
};

const isSourcePoint = (value: unknown): value is SourcePoint =>
    typeof value === "object" &&
    value !== null &&
    "column" in value &&
    typeof value.column === "number" &&
    "line" in value &&
    typeof value.line === "number";

const errorSourcePoint = (error: unknown): SourcePoint | null => {
    if (typeof error !== "object" || error === null) {
        return null;
    }

    if ("loc" in error && isSourcePoint(error.loc)) {
        return error.loc;
    }

    return "location" in error && isSourcePoint(error.location) ? error.location : null;
};

const atSourceNode = <T>(
    root: string,
    path: string,
    node: LocatableNode,
    operation: () => T,
): T => {
    try {
        return operation();
    } catch (error) {
        throw sourceExtractionError(root, path, locatablePoint(node), error);
    }
};

const atExtractedLocation = <T>(
    root: string,
    locations: SourceLocation[],
    operation: () => T,
): T => {
    const location = locations.find((candidate) =>
        candidate.line !== undefined && candidate.column !== undefined);

    if (location?.line === undefined || location.column === undefined) {
        return operation();
    }

    try {
        return operation();
    } catch (error) {
        throw sourceExtractionError(
            root,
            location.file,
            { column: location.column, line: location.line },
            error,
        );
    }
};

const quietLogger = (): { logger: Logger; reports: string[] } => {
    const reports: string[] = [];

    return {
        reports,
        logger: {
            info() {
                return;
            },
            warn(message, more) {
                const detail = more === undefined ? "" : ` ${String(more)}`;
                reports.push(`${message}${detail}`);
            },
            error(message) {
                reports.push(String(message));
            },
        },
    };
};

const splitContext = (key: string): { context: string | null; msgid: string } => {
    const index = key.lastIndexOf(CONTEXT_SEPARATOR);

    if (index === -1) {
        return { context: null, msgid: key };
    }

    return { context: key.slice(index + CONTEXT_SEPARATOR.length), msgid: key.slice(0, index) };
};

const namespaceFor = (entry: ExtractedKey): string =>
    typeof entry.ns === "string" ? entry.ns : DEFAULT_NAMESPACE;

const validateIdentity = (context: string | null, msgid: string): void => {
    if (context === "" || msgid.length === 0) {
        throw new Error("Translation keys and contexts cannot be empty");
    }
};

const compareLocations = (left: SourceLocation, right: SourceLocation): number =>
    left.file.localeCompare(right.file) ||
    (left.line ?? 0) - (right.line ?? 0) ||
    (left.column ?? 0) - (right.column ?? 0);

const normalizedLocations = (locations: SourceLocation[]): SourceLocation[] => {
    const unique: Map<string, SourceLocation> = new Map();

    for (const location of locations) {
        const key = `${location.file}\0${String(location.line)}\0${String(location.column)}`;
        unique.set(key, location);
    }

    return unique.values().toArray().toSorted(compareLocations);
};

const pointSource = (entry: ExtractedKey, msgid: string): string => {
    if (typeof entry.defaultValue !== "string") {
        return msgid;
    }

    if (entry.explicitDefault === true) {
        return entry.defaultValue;
    }

    return entry.defaultValue === msgid || msgid.endsWith(`.${entry.defaultValue}`)
        ? msgid
        : entry.defaultValue;
};

const pointMessage = (entry: ExtractedKey): SourceMessage => {
    const { context, msgid } = splitContext(entry.key);
    validateIdentity(context, msgid);
    const singular = pointSource(entry, msgid);

    if (singular.length === 0) {
        throw new Error("Translation source strings cannot be empty");
    }

    return {
        context,
        locations: normalizedLocations(entry.locations ?? []),
        namespace: namespaceFor(entry),
        plural: null,
        singular,
        sourceKey: msgid,
    };
};

const expandedPlural = (entry: ExtractedKey): { baseKey: string; variant: PluralVariant } => {
    if (entry.isOrdinal === true) {
        throw new Error("GNU gettext catalogs do not support i18next ordinal plurals");
    }

    const suffix = /_(few|many|one|other|two|zero)$/u.exec(entry.key);
    const defaultValue = entry.defaultValue;
    const category = suffix?.[1];

    if (suffix === null || category === undefined || typeof defaultValue !== "string") {
        throw new Error("Unable to recover an i18next plural source pair");
    }

    return {
        baseKey: entry.key.slice(0, -suffix[0].length),
        variant: {
            category,
            defaultValue,
            locations: entry.locations ?? [],
        },
    };
};

const groupedPlurals = (root: string, entries: ExtractedKey[]): PluralGroup[] => {
    const groups: Map<string, PluralGroup> = new Map();

    for (const entry of entries) {
        const { baseKey, variant } = atExtractedLocation(
            root,
            entry.locations ?? [],
            () => expandedPlural(entry),
        );
        const namespace = namespaceFor(entry);
        const key = `${namespace}\0${baseKey}`;
        const group = groups.get(key) ?? { baseKey, namespace, variants: [] };
        group.variants.push(variant);
        groups.set(key, group);
    }

    return groups.values().toArray();
};

const pairedVariants = (variants: PluralVariant[]): { one: PluralVariant; other: PluralVariant } => {
    const categories = new Map(variants.map((variant) => [variant.category, variant]));

    if (categories.size !== 2 || !categories.has("one") || !categories.has("other")) {
        throw new Error("GNU gettext requires one singular and one plural source string");
    }

    const one = categories.get("one");
    const other = categories.get("other");

    if (one === undefined || other === undefined) {
        throw new Error("Unable to recover an i18next plural source pair");
    }

    return { one, other };
};

const pluralMessage = ({ baseKey, namespace, variants }: PluralGroup): SourceMessage => {
    const { one, other } = pairedVariants(variants);
    const { context, msgid } = splitContext(baseKey);
    validateIdentity(context, msgid);
    const singular = one.defaultValue;
    const plural = other.defaultValue;

    if (singular === plural || singular.length === 0 || plural.length === 0) {
        throw new Error("GNU gettext plural source strings must be distinct and non-empty");
    }

    return {
        context,
        locations: normalizedLocations(variants.flatMap((variant) => variant.locations)),
        namespace,
        plural,
        singular,
        sourceKey: msgid,
    };
};

const pluralMessages = (root: string, entries: ExtractedKey[]): SourceMessage[] =>
    groupedPlurals(root, entries).map((group) =>
        atExtractedLocation(
            root,
            group.variants.flatMap((variant) => variant.locations),
            () => pluralMessage(group),
        ));

const assertCardinal = (entry: ExtractedKey): void => {
    if (entry.isOrdinal === true) {
        throw new Error("GNU gettext catalogs do not support i18next ordinal plurals");
    }
};

const sourceMessages = (root: string, entries: ExtractedKey[]): SourceMessage[] => {
    const points: ExtractedKey[] = [];
    const plurals: ExtractedKey[] = [];

    for (const entry of entries) {
        atExtractedLocation(root, entry.locations ?? [], () => {
            assertCardinal(entry);
        });

        if (entry.isExpandedPlural === true) {
            plurals.push(entry);
            continue;
        }

        if (entry.hasCount === true) {
            throw new Error("Count-based translations require an explicit plural source string");
        }

        points.push(entry);
    }

    return [
        ...points.map((entry) =>
            atExtractedLocation(root, entry.locations ?? [], () => pointMessage(entry))),
        ...pluralMessages(root, plurals),
    ];
};

const compareMessages = (left: SourceMessage, right: SourceMessage): number =>
    left.namespace.localeCompare(right.namespace) ||
    (left.context ?? "").localeCompare(right.context ?? "") ||
    left.singular.localeCompare(right.singular) ||
    (left.plural ?? "").localeCompare(right.plural ?? "");

const inferLocations = (message: SourceMessage, sources: Map<string, string>): SourceMessage => {
    if (message.locations.length > 0) {
        return message;
    }

    const locations: SourceLocation[] = [];

    for (const [file, source] of sources) {
        const index = source.indexOf(message.sourceKey);

        if (index !== -1) {
            locations.push({ file, line: source.slice(0, index).split("\n").length });
        }
    }

    return { ...message, locations };
};

const normalizedSourceFiles = (root: string, paths: string[]): string[] => {
    const files = paths
        .map((path) => resolve(root, path))
        .filter((path) => isPathWithin(root, path));

    return new Set(files).values().toArray().toSorted((left, right) => left.localeCompare(right));
};

type StaticKeyWrapper = ESTree.ParenthesizedExpression |
    ESTree.TSAsExpression |
    ESTree.TSSatisfiesExpression |
    ESTree.TSTypeAssertion |
    ESTree.TSNonNullExpression;

const isStaticKeyWrapper = (key: ESTree.Node): key is StaticKeyWrapper =>
    STATIC_KEY_WRAPPER_TYPES.has(key.type);

const unwrapStaticWrapper = (node: ESTree.Node): ESTree.Node =>
    isStaticKeyWrapper(node) ? unwrapStaticWrapper(node.expression) : node;

const isStaticTranslationKey = (key: ESTree.Node | null | undefined): boolean => {
    if (key === undefined || key === null) {
        return false;
    }

    if (key.type === "Literal") {
        return typeof key.value === "string";
    }

    if (key.type === "TemplateLiteral") {
        return key.expressions.length === 0;
    }

    if (key.type === "ParenthesizedExpression") {
        return false;
    }

    if (isStaticKeyWrapper(key)) {
        return isStaticTranslationKey(key.expression);
    }

    return false;
};

const assertStaticTranslationKey = (key: ESTree.Node | null | undefined): void => {
    if (!isStaticTranslationKey(key)) {
        throw new Error("Translation keys must be string literals");
    }
};

const propertyName = (property: ESTree.ObjectProperty): string | null => {
    if (!property.computed && property.key.type === "Identifier") {
        return property.key.name;
    }

    return property.key.type === "Literal" && typeof property.key.value === "string"
        ? property.key.value
        : null;
};

const assertSupportedOptionProperty = (property: ESTree.ObjectPropertyKind): void => {
    if (property.type === "SpreadElement") {
        throw new Error("Translation extraction requires explicit option properties");
    }

    const name = propertyName(property);

    if (name === null) {
        throw new Error("Translation extraction requires static option property names");
    }

    if (UNSUPPORTED_PLURAL_OPTION.test(name)) {
        throw new Error("GNU gettext accepts one singular and one plural source string");
    }

    if (STATIC_SOURCE_OPTION_NAMES.has(name)) {
        assertStaticTranslationKey(property.value);
    }
};

const assertSupportedOptionObject = (options: ESTree.Node | null | undefined): void => {
    if (options === null || options === undefined) {
        return;
    }

    if (isStaticKeyWrapper(options) && unwrapStaticWrapper(options).type === "ObjectExpression") {
        throw new Error("Translation option objects cannot be wrapped in another expression");
    }

    if (options.type !== "ObjectExpression") {
        throw new Error("Translation option objects must be inline object literals");
    }

    for (const property of options.properties) {
        assertSupportedOptionProperty(property);
    }
};

const namedImportedBinding = (path: NodePath, source: string): ImportedBinding | null => {
    if (!path.isImportSpecifier() || path.node.importKind === "type") {
        return null;
    }

    const imported = path.node.imported;

    return {
        imported: types.isIdentifier(imported) ? imported.name : imported.value,
        local: path.node.local.name,
        source,
        style: "named",
    };
};

const defaultImportedBinding = (path: NodePath, source: string): ImportedBinding | null =>
    path.isImportDefaultSpecifier()
        ? { imported: "default", local: path.node.local.name, source, style: "default" }
        : null;

const namespaceImportedBinding = (path: NodePath, source: string): ImportedBinding | null =>
    path.isImportNamespaceSpecifier()
        ? { imported: "*", local: path.node.local.name, source, style: "namespace" }
        : null;

const importedBinding = (binding: ResolvedBinding | undefined): ImportedBinding | null => {
    if (binding === undefined) {
        return null;
    }

    const path = binding.path;
    const declaration = path.parentPath;

    if (!declaration.isImportDeclaration() || declaration.node.importKind === "type") {
        return null;
    }

    const source = declaration.node.source.value;

    return namedImportedBinding(path, source) ??
        defaultImportedBinding(path, source) ??
        namespaceImportedBinding(path, source);
};

const babelPropertyName = (property: types.ObjectProperty): string | null => {
    const key = property.key;

    if (!property.computed && types.isIdentifier(key)) {
        return key.name;
    }

    return types.isStringLiteral(key) ? key.value : null;
};

const isBoundIdentifier = (node: types.Node | null, name: string): boolean => {
    if (types.isIdentifier(node)) {
        return node.name === name;
    }

    if (types.isAssignmentPattern(node)) {
        return types.isIdentifier(node.left) && node.left.name === name;
    }

    return false;
};

const isHookPatternBinding = (pattern: types.VariableDeclarator["id"], name: string): boolean => {
    if (types.isObjectPattern(pattern)) {
        return pattern.properties.some((property) =>
            types.isObjectProperty(property) &&
            babelPropertyName(property) === "t" &&
            isBoundIdentifier(property.value, name));
    }

    if (types.isArrayPattern(pattern)) {
        return isBoundIdentifier(pattern.elements[0] ?? null, name);
    }

    return false;
};

const importedTranslationHook = (scope: Scope, call: types.CallExpression): ImportedBinding | null => {
    if (!types.isIdentifier(call.callee)) {
        return null;
    }

    const imported = importedBinding(scope.getBinding(call.callee.name));

    return imported?.imported === "useTranslation" && TRANSLATION_MODULES.has(imported.source)
        ? imported
        : null;
};

const translationHookBinding = (binding: ResolvedBinding): TranslationHookBinding | null => {
    const path = binding.path;

    if (!path.isVariableDeclarator()) {
        return null;
    }

    const pattern = path.node.id;
    const initializer = path.node.init;

    if (!isHookPatternBinding(pattern, binding.identifier.name) ||
        !types.isCallExpression(initializer)) {
        return null;
    }

    const imported = importedTranslationHook(path.scope, initializer);

    if (imported === null) {
        return null;
    }

    return { call: initializer, isCanonical: imported.local === "useTranslation" };
};

const importedTranslationFunctionKind = (imported: ImportedBinding | null): TranslationCallKind | null => {
    if (imported?.imported !== "t" || !TRANSLATION_MODULES.has(imported.source)) {
        return null;
    }

    return imported.local === "t" ? "canonical" : "alias";
};

const hookTranslationFunctionKind = (binding: ResolvedBinding | undefined): TranslationCallKind | null => {
    if (binding === undefined) {
        return null;
    }

    const hook = translationHookBinding(binding);

    if (hook === null) {
        return null;
    }

    return binding.identifier.name === "t" && hook.isCanonical ? "canonical" : "alias";
};

const directTranslationFunctionKind = (scope: Scope, name: string): TranslationCallKind | null => {
    const binding = scope.getBinding(name);

    return importedTranslationFunctionKind(importedBinding(binding)) ?? hookTranslationFunctionKind(binding);
};

const babelMemberName = (member: TranslationMemberExpression): string | null => {
    const property = member.property;

    if (member.computed) {
        return types.isStringLiteral(property) ? property.value : null;
    }

    return types.isIdentifier(property) ? property.name : null;
};

const isImportedTranslationObject = (scope: Scope, object: types.Node): boolean => {
    if (!types.isIdentifier(object)) {
        return false;
    }

    const imported = importedBinding(scope.getBinding(object.name));

    return imported !== null &&
        TRANSLATION_MODULES.has(imported.source) &&
        (imported.style === "namespace" || (imported.source === "i18next" && imported.imported === "default"));
};

const constantVariableDeclarator = (binding: ResolvedBinding): NodePath<types.VariableDeclarator> | null => {
    const path = binding.path;
    const declaration = path.parentPath;

    if (!path.isVariableDeclarator() ||
        !declaration.isVariableDeclaration() ||
        declaration.node.kind !== "const") {
        return null;
    }

    return path;
};

const isTranslationHookResultBinding = (binding: ResolvedBinding | undefined): boolean => {
    if (binding === undefined) {
        return false;
    }

    const path = constantVariableDeclarator(binding);
    const initializer = path?.node.init;

    return path !== null &&
        types.isIdentifier(path.node.id) &&
        types.isCallExpression(initializer) &&
        importedTranslationHook(path.scope, initializer) !== null;
};

const isHookTranslationMember = (scope: Scope, member: TranslationMemberExpression): boolean => {
    if (babelMemberName(member) !== "t") {
        return false;
    }

    const object = member.object;

    if (types.isCallExpression(object)) {
        return importedTranslationHook(scope, object) !== null;
    }

    return types.isIdentifier(object) && isTranslationHookResultBinding(scope.getBinding(object.name));
};

const isTranslationMember = (scope: Scope, member: TranslationMemberExpression): boolean =>
    babelMemberName(member) === "t" &&
    (isImportedTranslationObject(scope, member.object) || isHookTranslationMember(scope, member));

const isDirectTranslationFunction = (scope: Scope, node: types.Node): boolean =>
    types.isIdentifier(node) && directTranslationFunctionKind(scope, node.name) !== null;

const isTranslationFunctionValue = (scope: Scope, node: types.Node): boolean => {
    if (isDirectTranslationFunction(scope, node)) {
        return true;
    }

    return (types.isMemberExpression(node) || types.isOptionalMemberExpression(node)) &&
        isTranslationMember(scope, node);
};

const isTranslationBindCall = (scope: Scope, node: types.Node): boolean => {
    if (!types.isCallExpression(node) || !types.isMemberExpression(node.callee)) {
        return false;
    }

    return babelMemberName(node.callee) === "bind" &&
        isTranslationFunctionValue(scope, node.callee.object);
};

const isTranslationObjectPatternAlias = (
    path: NodePath<types.VariableDeclarator>,
    binding: ResolvedBinding,
): boolean => {
    const pattern = path.node.id;
    const initializer = path.node.init;

    if (!types.isObjectPattern(pattern) ||
        !isHookPatternBinding(pattern, binding.identifier.name) ||
        !types.isIdentifier(initializer)) {
        return false;
    }

    return isImportedTranslationObject(path.scope, initializer) ||
        isTranslationHookResultBinding(path.scope.getBinding(initializer.name));
};

const isTranslationAliasBinding = (binding: ResolvedBinding | undefined): boolean => {
    if (binding === undefined) {
        return false;
    }

    const path = constantVariableDeclarator(binding);

    if (path === null) {
        return false;
    }

    if (isTranslationObjectPatternAlias(path, binding)) {
        return true;
    }

    const initializer = path.node.init;

    return types.isIdentifier(path.node.id) &&
        initializer !== null &&
        initializer !== undefined &&
        (isTranslationFunctionValue(path.scope, initializer) || isTranslationBindCall(path.scope, initializer));
};

const translationFunctionKind = (scope: Scope, name: string): TranslationCallKind | null => {
    const direct = directTranslationFunctionKind(scope, name);

    if (direct !== null) {
        return direct;
    }

    return isTranslationAliasBinding(scope.getBinding(name)) ? "alias" : null;
};

const translationElementKind = (path: NodePath, name: string): TranslationCallKind | null => {
    const imported = importedBinding(path.scope.getBinding(name));

    if (imported?.source !== "@gtkx/i18n" || !TRANS_ELEMENTS.has(imported.imported)) {
        return null;
    }

    return imported.local === imported.imported ? "canonical" : "alias";
};

const nodeStart = (path: NodePath): number => {
    const start = path.node.start;

    if (start === null || start === undefined) {
        throw new Error("Translation extraction could not locate a source expression");
    }

    return start;
};

const registerSourceMask = (node: types.Node, references: TranslationReferences): void => {
    const { start, end } = node;

    if (start === null || start === undefined || end === null || end === undefined) {
        throw new Error("Translation extraction could not locate a source expression");
    }

    references.masks.push({ start, end });
};

const sourceLocationKey = (line: number, column: number): string => `${String(line)}:${String(column)}`;

const sourcePoint = (node: types.Node): SourcePoint | null => {
    return locatablePoint(node);
};

const registerSourceLocation = (node: types.Node, references: TranslationReferences): SourcePoint | null => {
    const point = sourcePoint(node);

    if (point !== null) {
        references.locations.set(sourceLocationKey(point.line, point.column), point);
    }

    return point;
};

const babelStaticKey = (node: types.Node | null | undefined): string | null => {
    if (node === null || node === undefined) {
        return null;
    }

    if (types.isStringLiteral(node)) {
        return node.value;
    }

    if (types.isTemplateLiteral(node) && node.expressions.length === 0) {
        return node.quasis[0]?.value.cooked ?? null;
    }

    if (types.isParenthesizedExpression(node) ||
        types.isTSAsExpression(node) ||
        types.isTSSatisfiesExpression(node) ||
        types.isTSTypeAssertion(node) ||
        types.isTSNonNullExpression(node)) {
        return babelStaticKey(node.expression);
    }

    return null;
};

const babelObjectExpression = (node: types.Node | null | undefined): types.ObjectExpression | null => {
    if (node === null || node === undefined) {
        return null;
    }

    if (types.isObjectExpression(node)) {
        return node;
    }

    if (types.isParenthesizedExpression(node) ||
        types.isTSAsExpression(node) ||
        types.isTSSatisfiesExpression(node) ||
        types.isTSTypeAssertion(node) ||
        types.isTSNonNullExpression(node)) {
        return babelObjectExpression(node.expression);
    }

    return null;
};

const babelNamedProperty = (
    object: types.ObjectExpression | null,
    name: string,
): types.ObjectProperty | null => {
    if (object === null) {
        return null;
    }

    for (const property of object.properties) {
        if (types.isObjectProperty(property) && babelPropertyName(property) === name) {
            return property;
        }
    }

    return null;
};

const babelStringProperty = (object: types.ObjectExpression | null, name: string): string | null => {
    const property = babelNamedProperty(object, name);

    if (property === null) {
        return null;
    }

    const value = babelStaticKey(property.value);

    if (value === null) {
        throw new Error(`Translation ${name} values must be string literals`);
    }

    return value;
};

const callOptions = (call: types.CallExpression): types.ObjectExpression | null =>
    babelObjectExpression(call.arguments[1]) ?? babelObjectExpression(call.arguments[2]);

const hookKeyPrefix = (callee: NodePath<types.Identifier>): string => {
    const binding = callee.scope.getBinding(callee.node.name);
    const hook = binding === undefined ? null : translationHookBinding(binding);

    return babelStringProperty(
        hook === null ? null : babelObjectExpression(hook.call.arguments[1]),
        "keyPrefix",
    ) ?? "";
};

const prefixedTranslationKey = (prefix: string, key: string): string => {
    if (prefix.length === 0) {
        return key;
    }

    return prefix.endsWith(".") ? `${prefix}${key}` : `${prefix}.${key}`;
};

const extractedEntryKey = (call: types.CallExpression, keyPrefix: string): string | null => {
    const key = babelStaticKey(call.arguments[0]);

    if (key === null) {
        return null;
    }

    const options = callOptions(call);
    const callPrefix = babelStringProperty(options, "keyPrefix");

    if (callPrefix === "" && keyPrefix.length > 0) {
        throw new Error("An empty call keyPrefix cannot override a hook keyPrefix during extraction");
    }

    const selectedPrefix = callPrefix ?? keyPrefix;
    const prefixed = prefixedTranslationKey(selectedPrefix, key);
    const context = babelStringProperty(options, "context");

    return context === null ? prefixed : `${prefixed}${CONTEXT_SEPARATOR}${context}`;
};

const registerEntryLocation = (
    key: string | null,
    point: SourcePoint | null,
    references: TranslationReferences,
): void => {
    if (key === null || point === null) {
        return;
    }

    const locations = references.entryLocations.get(key) ?? [];
    locations.push(point);
    references.entryLocations.set(key, locations);
};

const registerCallReference = (
    callPath: NodePath<types.CallExpression>,
    references: TranslationReferences,
    keyPrefix: string,
): void => {
    references.calls.add(nodeStart(callPath));
    const firstArgument = callPath.node.arguments[0];
    const point = registerSourceLocation(firstArgument ?? callPath.node, references);

    if (point !== null) {
        references.sourcePoints.set(nodeStart(callPath), point);
    }

    registerEntryLocation(extractedEntryKey(callPath.node, keyPrefix), point, references);
};

const parserPlugins = (lang: ReturnType<typeof sourceLanguage>): ("decorators" | "jsx" | "typescript")[] => [
    "decorators",
    ...(lang === "ts" || lang === "tsx" ? ["typescript" as const] : []),
    ...(lang === "jsx" || lang === "tsx" ? ["jsx" as const] : []),
];

const parseTranslationReferences = (
    root: string,
    path: string,
    source: string,
    lang: ReturnType<typeof sourceLanguage>,
) => {
    try {
        return parseBabelSync(source, {
            ast: true,
            babelrc: false,
            configFile: false,
            filename: projectSourcePath(root, path),
            parserOpts: { createParenthesizedExpressions: true, plugins: parserPlugins(lang) },
            sourceType: "module",
        });
    } catch (error) {
        throw sourceExtractionError(root, path, errorSourcePoint(error), error);
    }
};

const registerIdentifierTranslationCall = (
    callPath: NodePath<types.CallExpression>,
    callee: NodePath,
    references: TranslationReferences,
): void => {
    if (!callee.isIdentifier()) {
        return;
    }

    const kind = translationFunctionKind(callee.scope, callee.node.name);

    if (kind === "alias") {
        throw new Error("Translation calls must use the imported name t");
    }

    if (kind === "canonical") {
        registerCallReference(callPath, references, hookKeyPrefix(callee));
    } else if (callee.node.name === "t") {
        registerSourceMask(callee.node, references);
    }
};

const registerTranslationCall = (
    callPath: NodePath<types.CallExpression>,
    references: TranslationReferences,
): void => {
    assertSupportedWrappedCallee(callPath);
    const callee = callPath.get("callee");

    if (callee.isIdentifier()) {
        registerIdentifierTranslationCall(callPath, callee, references);

        return;
    }

    if (callee.isMemberExpression() && isTranslationMember(callee.scope, callee.node)) {
        throw new Error("Translation calls must use the named t export");
    }
};

const unwrapTranslationCallee = (node: types.Node): types.Node => {
    if (types.isParenthesizedExpression(node) ||
        types.isTSAsExpression(node) ||
        types.isTSSatisfiesExpression(node) ||
        types.isTSTypeAssertion(node) ||
        types.isTSNonNullExpression(node)) {
        return unwrapTranslationCallee(node.expression);
    }

    return node;
};

const isTranslationCallee = (scope: Scope, node: types.Node): boolean => {
    if (types.isIdentifier(node)) {
        return translationFunctionKind(scope, node.name) !== null;
    }

    return (types.isMemberExpression(node) || types.isOptionalMemberExpression(node)) &&
        isTranslationMember(scope, node);
};

const assertSupportedWrappedCallee = (callPath: NodePath<types.CallExpression>): void => {
    const callee = callPath.node.callee;
    const unwrapped = unwrapTranslationCallee(callee);

    if (unwrapped !== callee && isTranslationCallee(callPath.scope, unwrapped)) {
        throw new Error("Translation call expressions cannot wrap their callee");
    }
};

const assertSupportedOptionalCall = (callPath: NodePath<types.OptionalCallExpression>): void => {
    const callee = unwrapTranslationCallee(callPath.node.callee);

    if (isTranslationCallee(callPath.scope, callee)) {
        throw new Error("Translation calls cannot use optional chaining");
    }
};

const assertUnsupportedTranslationTag = (tagPath: NodePath<types.TaggedTemplateExpression>): void => {
    const tag = unwrapTranslationCallee(tagPath.node.tag);

    if (isTranslationCallee(tagPath.scope, tag)) {
        throw new Error("Translation calls cannot use tagged-template syntax");
    }
};

const registerUnrecognizedElementMasks = (
    elementPath: NodePath,
    name: NodePath<types.JSXIdentifier>,
    references: TranslationReferences,
): void => {
    registerSourceMask(name.node, references);
    const parent = elementPath.parentPath.node;
    const closingName = types.isJSXElement(parent) ? parent.closingElement?.name : null;

    if (types.isJSXIdentifier(closingName)) {
        registerSourceMask(closingName, references);
    }
};

const registerElementReference = (
    elementPath: NodePath,
    references: TranslationReferences,
): void => {
    const start = nodeStart(elementPath);
    const point = registerSourceLocation(elementPath.node, references);
    references.elements.add(start);

    if (point !== null) {
        references.sourcePoints.set(start, point);
    }
};

const registerTranslationElement = (elementPath: NodePath, references: TranslationReferences): void => {
    const name = elementPath.get("name");

    if (!name.isJSXIdentifier()) {
        return;
    }

    const kind = translationElementKind(name, name.node.name);

    if (kind === "alias") {
        throw new Error("Translation components must use their imported names");
    }

    if (kind === "canonical") {
        registerElementReference(elementPath, references);
    } else if (TRANS_ELEMENTS.has(name.node.name)) {
        registerUnrecognizedElementMasks(elementPath, name, references);
    }
};

const maskUnrecognizedTranslations = (source: string, references: TranslationReferences): string => {
    let masked = source;
    const masks = references.masks.toSorted((left, right) => right.start - left.start);

    for (const { start, end } of masks) {
        masked = `${masked.slice(0, start)}${"_".repeat(end - start)}${masked.slice(end)}`;
    }

    return masked;
};

const translationReferences = (
    root: string,
    path: string,
    source: string,
    lang: ReturnType<typeof sourceLanguage>,
): TranslationReferences => {
    const parsed = parseTranslationReferences(root, path, source, lang);

    if (parsed === null) {
        throw new Error(`Translation extraction could not parse ${path}`);
    }

    const references: TranslationReferences = {
        calls: new Set(),
        elements: new Set(),
        entryLocations: new Map(),
        locations: new Map(),
        masks: [],
        sourcePoints: new Map(),
    };

    traverse(parsed, {
        CallExpression(callPath) {
            atSourceNode(root, path, callPath.node, () => {
                registerTranslationCall(callPath, references);
            });
        },
        JSXOpeningElement(elementPath) {
            atSourceNode(root, path, elementPath.node, () => {
                registerTranslationElement(elementPath, references);
            });
        },
        OptionalCallExpression(callPath) {
            atSourceNode(root, path, callPath.node, () => {
                assertSupportedOptionalCall(callPath);
            });
        },
        TaggedTemplateExpression(tagPath) {
            atSourceNode(root, path, tagPath.node, () => {
                assertUnsupportedTranslationTag(tagPath);
            });
        },
    });

    return references;
};

const assertSupportedTranslationCall = (node: ESTree.CallExpression, references: TranslationReferences): void => {
    if (!references.calls.has(node.start)) {
        return;
    }

    assertStaticTranslationKey(node.arguments[0]);
    assertSupportedTranslationOptions(node.arguments[1], node.arguments[2]);
};

const assertSupportedTranslationOptions = (
    second: ESTree.Node | null | undefined,
    third: ESTree.Node | null | undefined,
): void => {
    if (third !== undefined && third !== null) {
        assertStaticTranslationKey(second);
        assertSupportedOptionObject(third);

        return;
    }

    if (second === undefined || second === null || isStaticTranslationKey(second)) {
        return;
    }

    assertSupportedOptionObject(second);
};

const isNamedJsxAttribute = (attribute: ESTree.JSXAttribute, name: string): boolean =>
    attribute.name.type === "JSXIdentifier" && attribute.name.name === name;

const assertSupportedTransKey = (attribute: ESTree.JSXAttribute): void => {
    if (!isNamedJsxAttribute(attribute, "i18nKey")) {
        return;
    }

    const key = attribute.value?.type === "JSXExpressionContainer"
        ? attribute.value.expression
        : attribute.value;
    assertStaticTranslationKey(key);
};

const assertSupportedTransStringAttribute = (attribute: ESTree.JSXAttribute, name: string): void => {
    if (!isNamedJsxAttribute(attribute, name)) {
        return;
    }

    const value = attribute.value?.type === "JSXExpressionContainer"
        ? attribute.value.expression
        : attribute.value;
    assertStaticTranslationKey(value);
};

const assertSupportedTransOptions = (attribute: ESTree.JSXAttribute): void => {
    if (isNamedJsxAttribute(attribute, "tOptions") && attribute.value?.type === "JSXExpressionContainer") {
        assertSupportedOptionObject(attribute.value.expression);
    }
};

const assertSupportedTransAttribute = (attribute: ESTree.JSXAttributeItem): void => {
    if (attribute.type === "JSXSpreadAttribute") {
        throw new Error("Translation extraction requires explicit component properties");
    }

    assertSupportedTransKey(attribute);
    assertSupportedTransStringAttribute(attribute, "context");
    assertSupportedTransStringAttribute(attribute, "defaults");
    assertSupportedTransOptions(attribute);
};

const assertSupportedTransElement = (node: ESTree.JSXOpeningElement, references: TranslationReferences): void => {
    if (!references.elements.has(node.start)) {
        return;
    }

    for (const attribute of node.attributes) {
        assertSupportedTransAttribute(attribute);
    }
};

const assertSupportedTranslationSyntax = (root: string, path: string, source: string): TranslationReferences => {
    const lang = sourceLanguage(path);

    if (lang === undefined) {
        return {
            calls: new Set(),
            elements: new Set(),
            entryLocations: new Map(),
            locations: new Map(),
            masks: [],
            sourcePoints: new Map(),
        };
    }

    let parsed: ReturnType<typeof parseSync>;

    try {
        parsed = parseSync(projectSourcePath(root, path), source, { lang });
    } catch (error) {
        throw sourceExtractionError(root, path, errorSourcePoint(error), error);
    }

    const references = translationReferences(root, path, source, lang);

    new Visitor({
        CallExpression(node) {
            try {
                assertSupportedTranslationCall(node, references);
            } catch (error) {
                throw sourceExtractionError(root, path, references.sourcePoints.get(node.start) ?? null, error);
            }
        },
        JSXOpeningElement(node) {
            try {
                assertSupportedTransElement(node, references);
            } catch (error) {
                throw sourceExtractionError(root, path, references.sourcePoints.get(node.start) ?? null, error);
            }
        },
    }).visit(parsed.program);

    return references;
};

const extractedLocationFile = (root: string, file: string): string =>
    resolve(root, file);

const isRecognizedLocation = (
    root: string,
    references: Map<string, TranslationReferences>,
    location: SourceLocation,
): boolean => {
    if (location.line === undefined || location.column === undefined) {
        return false;
    }

    const sourceReferences = references.get(extractedLocationFile(root, location.file));

    return sourceReferences?.locations.has(sourceLocationKey(location.line, location.column)) === true;
};

const recognizedKeyLocations = (
    references: Map<string, TranslationReferences>,
    extractedKey: string,
): ExtractedLocation[] => {
    const locations: ExtractedLocation[] = [];

    for (const [file, sourceReferences] of references) {
        const points = sourceReferences.entryLocations.get(extractedKey) ?? [];

        for (const point of points) {
            locations.push({ file, column: point.column, line: point.line });
        }
    }

    return locations;
};

const recognizedEntry = (
    root: string,
    references: Map<string, TranslationReferences>,
    entry: ExtractedKey,
): ExtractedKey | null => {
    const extractedLocations = entry.locations ?? [];
    const locations = extractedLocations.length === 0
        ? recognizedKeyLocations(references, entry.key)
        : extractedLocations.filter((location) => isRecognizedLocation(root, references, location));

    return locations.length === 0 ? null : { ...entry, locations };
};

type NestedReferenceParts = { base: string; options: string };

const quotedNestedReferenceParts = (content: string, quote: string): NestedReferenceParts | null => {
    const end = content.indexOf(quote, 1);

    return end === -1
        ? null
        : { base: content.slice(1, end), options: content.slice(end + 1) };
};

const nestedReferenceParts = (value: string): NestedReferenceParts | null => {
    const content = value.trim();
    const quote = content[0];

    if (quote === "\"" || quote === "'") {
        return quotedNestedReferenceParts(content, quote);
    }

    const separator = content.indexOf(",");
    const base = (separator === -1 ? content : content.slice(0, separator)).trim();

    return base.length === 0
        ? null
        : { base, options: separator === -1 ? "" : content.slice(separator + 1) };
};

const nestedReferenceContext = (options: string): string | null => {
    const match = NESTED_CONTEXT.exec(options);
    const context = match?.[1] ?? match?.[2] ?? null;

    return context === null || context.length === 0 ? null : context;
};

const adjustedParenthesisDepth = (character: string | undefined, depth: number): number => {
    if (character === "(") {
        return depth + 1;
    }

    return character === ")" ? depth - 1 : depth;
};

const nestedReferenceEnd = (text: string, start: number): number => {
    let depth = 0;
    const tokens = text.slice(start).matchAll(NESTED_STRUCTURE_TOKEN);

    for (const token of tokens) {
        const character = token[0];

        if (character === ")" && depth === 0) {
            return start + token.index;
        }

        depth = adjustedParenthesisDepth(character, depth);
    }

    return -1;
};

const nestedReferenceContents = (text: string): string[] => {
    const contents: string[] = [];
    let offset = 0;

    while (offset < text.length) {
        const prefix = text.indexOf("$t(", offset);

        if (prefix === -1) {
            break;
        }

        const start = prefix + 3;
        const end = nestedReferenceEnd(text, start);

        if (end === -1) {
            break;
        }

        contents.push(text.slice(start, end));
        offset = end + 1;
    }

    return contents;
};

const nestedPluralKeys = (base: string, context: string | null): string[] => {
    const pluralBase = context === null ? base : `${base}${CONTEXT_SEPARATOR}${context}`;

    return [`${pluralBase}_one`, `${pluralBase}_other`];
};

const nestedReferenceKeys = (content: string): string[] => {
    const parts = nestedReferenceParts(content);

    if (parts === null) {
        return [];
    }

    const context = nestedReferenceContext(parts.options);
    const contextual = context === null
        ? []
        : [`${parts.base}_${context}`, `${parts.base}${CONTEXT_SEPARATOR}${context}`];

    return NESTED_COUNT.test(parts.options)
        ? [parts.base, ...contextual, ...nestedPluralKeys(parts.base, context)]
        : [parts.base, ...contextual];
};

const nestedEntryKeys = (text: string): Set<string> => {
    const keys: Set<string> = new Set();

    for (const content of nestedReferenceContents(text)) {
        for (const key of nestedReferenceKeys(content)) {
            keys.add(key);
        }
    }

    return keys;
};

const registerNestedKeyLocations = (
    root: string,
    references: Map<string, TranslationReferences>,
    key: string,
    locations: ExtractedLocation[],
): void => {
    for (const location of locations) {
        if (location.line === undefined || location.column === undefined) {
            continue;
        }

        const sourceReferences = references.get(resolve(root, location.file));

        if (sourceReferences !== undefined) {
            registerEntryLocation(key, { column: location.column, line: location.line }, sourceReferences);
        }
    }
};

const registerNestedTextLocations = (
    root: string,
    references: Map<string, TranslationReferences>,
    text: string,
    locations: ExtractedLocation[],
): void => {
    for (const key of nestedEntryKeys(text)) {
        registerNestedKeyLocations(root, references, key, locations);
    }
};

const registerNestedEntryLocations = (
    root: string,
    references: Map<string, TranslationReferences>,
    entry: ExtractedKey,
    locations: ExtractedLocation[],
): void => {
    registerNestedTextLocations(root, references, entry.key, locations);

    if (typeof entry.defaultValue === "string") {
        registerNestedTextLocations(root, references, entry.defaultValue, locations);
    }
};

const didRegisterNestedLocationPass = (
    root: string,
    references: Map<string, TranslationReferences>,
    entries: ExtractedKeysMap,
    processed: Set<string>,
): boolean => {
    let didRegister = false;

    for (const [mapKey, entry] of entries) {
        if (processed.has(mapKey)) {
            continue;
        }

        const recognized = recognizedEntry(root, references, entry);

        if (recognized !== null) {
            processed.add(mapKey);
            registerNestedEntryLocations(root, references, entry, recognized.locations ?? []);
            didRegister = true;
        }
    }

    return didRegister;
};

const registerNestedLocations = (
    root: string,
    references: Map<string, TranslationReferences>,
    entries: ExtractedKeysMap,
): void => {
    const processed: Set<string> = new Set();
    let hasRegisteredLocations = true;

    while (hasRegisteredLocations) {
        hasRegisteredLocations = didRegisterNestedLocationPass(root, references, entries, processed);
    }
};

const retainRecognizedEntries = (
    root: string,
    references: Map<string, TranslationReferences>,
    entries: ExtractedKeysMap,
): void => {
    for (const [mapKey, entry] of entries) {
        const recognized = recognizedEntry(root, references, entry);

        if (recognized === null) {
            entries.delete(mapKey);
        } else {
            entries.set(mapKey, recognized);
        }
    }
};

const fileSourcePointKey = (file: string, line: number, column: number): string =>
    `${file}\0${sourceLocationKey(line, column)}`;

const registerExtractedSourcePoint = (
    root: string,
    points: Set<string>,
    location: ExtractedLocation,
): void => {
    if (location.line !== undefined && location.column !== undefined) {
        points.add(fileSourcePointKey(resolve(root, location.file), location.line, location.column));
    }
};

const extractedSourcePoints = (root: string, entries: ExtractedKeysMap): Set<string> => {
    const points: Set<string> = new Set();

    for (const entry of entries.values()) {
        const locations = entry.locations ?? [];

        for (const location of locations) {
            registerExtractedSourcePoint(root, points, location);
        }
    }

    return points;
};

const missingSourcePoint = (
    file: string,
    references: TranslationReferences,
    extracted: Set<string>,
): SourcePoint | null => {
    for (const [location, point] of references.locations) {
        if (!extracted.has(`${file}\0${location}`)) {
            return point;
        }
    }

    return null;
};

const assertAllReferencesExtracted = (
    root: string,
    references: Map<string, TranslationReferences>,
    entries: ExtractedKeysMap,
): void => {
    const extracted = extractedSourcePoints(root, entries);

    for (const [file, sourceReferences] of references) {
        const point = missingSourcePoint(file, sourceReferences, extracted);

        if (point !== null) {
            throw sourceExtractionError(
                root,
                file,
                point,
                new Error("A translation expression could not be extracted safely"),
            );
        }
    }
};

const findSourceMessages = async (root: string, sourceFiles: string[]): Promise<SourceMessage[]> => {
    if (sourceFiles.length === 0) {
        clearI18nResources(root);

        return [];
    }

    const sources = new Map(sourceFiles.map((file) => [file, readFileSync(file, "utf8")]));
    const references: Map<string, TranslationReferences> = new Map();

    for (const [file, source] of sources) {
        references.set(file, assertSupportedTranslationSyntax(root, file, source));
    }

    let extracted: ExtractedKeysMap | undefined;
    const { logger, reports } = quietLogger();

    const capture: Plugin = {
        name: "gtkx-gettext",
        onLoad(code, path) {
            const sourceReferences = references.get(resolve(root, path));

            return sourceReferences === undefined
                ? code
                : maskUnrecognizedTranslations(code, sourceReferences);
        },
        onEnd(keys) {
            registerNestedLocations(root, references, keys);
            retainRecognizedEntries(root, references, keys);
            assertAllReferencesExtracted(root, references, keys);
            extracted = keys;
        },
    };

    const result = await runExtractor(i18nToolkitConfig(root, sourceFiles, [capture]), {
        logger,
        quiet: true,
        syncPrimaryWithDefaults: true,
        trustDerivedDefaults: true,
    });

    if (extracted === undefined || reports.length > 0 || result.hasErrors) {
        throw new Error(reports.join("\n") || "i18next extraction failed");
    }

    return sourceMessages(root, extracted.values().toArray())
        .map((message) => inferLocations(message, sources))
        .toSorted(compareMessages);
};

const projectPath = (root: string, path: string): string | null => {
    const absolute = isAbsolute(path) ? resolve(path) : resolve(root, path);
    const projectRelative = relative(root, absolute);

    if (!isPathInside(root, absolute)) {
        return null;
    }

    return toPosixPath(projectRelative);
};

const writePotfiles = (project: CatalogProject, sourceFiles: string[]): string => {
    const paths = sourceFiles
        .map((path) => projectPath(project.root, path))
        .filter((path): path is string => path !== null);

    const sorted = [...new Set(paths)].toSorted((left, right) => left.localeCompare(right));
    const target = resolve(project.poDir, POTFILES_FILENAME);
    writeFileSync(target, sorted.length === 0 ? "" : `${sorted.join("\n")}\n`);

    return target;
};

const renderCatalogCall = (message: SourceMessage): string => {
    const msgid = JSON.stringify(message.singular);

    if (message.plural !== null) {
        const plural = JSON.stringify(message.plural);

        return message.context === null
            ? `ngettext(${msgid}, ${plural}, 0);`
            : `npgettext(${JSON.stringify(message.context)}, ${msgid}, ${plural}, 0);`;
    }

    return message.context === null
        ? `gettext(${msgid});`
        : `pgettext(${JSON.stringify(message.context)}, ${msgid});`;
};

const locatedOwners = (
    project: CatalogProject,
    message: SourceMessage,
): { path: string; line: number | undefined }[] => {
    const owners: { path: string; line: number | undefined }[] = [];

    for (const location of message.locations) {
        const path = projectPath(project.root, location.file);

        if (path !== null) {
            owners.push({ path, line: location.line });
        }
    }

    const unique = new Map(owners.map((owner) => [`${owner.path}\0${String(owner.line)}`, owner]));

    return unique.values().toArray();
};

const sourceOwners = (
    project: CatalogProject,
    message: SourceMessage,
): { path: string; line: number | undefined }[] => {
    const located = locatedOwners(project, message);

    return located.length > 0 ? located : [{ path: SYNTHETIC_FILENAME, line: undefined }];
};

const syntheticEntries = (
    project: CatalogProject,
    messages: SourceMessage[],
): Map<string, SyntheticEntry[]> => {
    const entries: Map<string, SyntheticEntry[]> = new Map();

    for (const message of messages) {
        for (const owner of sourceOwners(project, message)) {
            const owned = entries.get(owner.path) ?? [];
            owned.push({ call: renderCatalogCall(message), line: owner.line });
            entries.set(owner.path, owned);
        }
    }

    if (entries.size === 0) {
        entries.set(SYNTHETIC_FILENAME, []);
    }

    return entries;
};

const compareSyntheticEntries = (left: SyntheticEntry, right: SyntheticEntry): number =>
    (left.line ?? Number.MAX_SAFE_INTEGER) - (right.line ?? Number.MAX_SAFE_INTEGER);

const lastSyntheticLine = (entries: SyntheticEntry[]): number => {
    let line = 0;

    for (const entry of entries) {
        line = Math.max(line, entry.line ?? 0);
    }

    return line;
};

const appendSyntheticEntry = (lines: string[], entry: SyntheticEntry, requestedLine: number): void => {
    const index = requestedLine - 1;
    const existing = lines[index];

    if (existing === undefined || existing.length === 0) {
        lines[index] = entry.call;

        return;
    }

    lines[index] = `${existing} ${entry.call}`;
};

const renderSyntheticSource = (entries: SyntheticEntry[]): string => {
    const lines: string[] = [];
    const sorted = entries.toSorted(compareSyntheticEntries);
    let nextLine = lastSyntheticLine(entries) + 1;

    for (const entry of sorted) {
        const requestedLine = Math.max(1, entry.line ?? nextLine++);
        appendSyntheticEntry(lines, entry, requestedLine);
    }

    return `${lines.join("\n")}\n`;
};

const writeSyntheticSources = (
    workDir: string,
    project: CatalogProject,
    messages: SourceMessage[],
): string => {
    const entries = syntheticEntries(project, messages);
    const paths: string[] = [];

    for (const [path, owned] of entries) {
        const target = join(workDir, path);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, renderSyntheticSource(owned));
        paths.push(path);
    }

    const potfiles = join(workDir, POTFILES_FILENAME);
    writeFileSync(potfiles, `${paths.toSorted((left, right) => left.localeCompare(right)).join("\n")}\n`);

    return potfiles;
};

const extractSourceMessages = ({ project, messages, output, workDir }: SourceExtraction): void => {
    const potfilesPath = writeSyntheticSources(workDir, project, messages);

    runCliTool({
        tool: "xgettext",
        args: [
            "--language=JavaScript",
            "--from-code=UTF-8",
            "--force-po",
            "--keyword=gettext:1",
            "--keyword=ngettext:1,2",
            "--keyword=pgettext:1c,2",
            "--keyword=npgettext:1c,2,3",
            `--directory=${workDir}`,
            `--files-from=${potfilesPath}`,
            `--output=${output}`,
        ],
        target: output,
    });
};

const extractMetadataFragment = (project: CatalogProject, input: string, output: string): void => {
    runCliTool({
        tool: "msggrep",
        args: [
            "--force-po",
            `--output-file=${output}`,
            ...metadataTemplateFiles(project).map((file) => `--location=${file.relativePath}`),
            input,
        ],
        target: input,
    });
};

const joinMetadataFragment = (output: string, fragment: string): void => {
    runCliTool({
        tool: "xgettext",
        args: ["--language=PO", "--join-existing", "--force-po", `--output=${output}`, fragment],
        target: output,
    });
};

const extractCatalogTemplate = ({
    project,
    messages,
    shouldPreserveMetadataMessages,
    output = resolve(project.poDir, `${project.domain}.pot`),
}: CatalogTemplateExtraction): void => {
    const workDir = mkdtempSync(join(project.poDir, ".gtkx-i18n-"));
    const source = join(workDir, "source.pot");
    const hasPreviousTemplate = existsSync(output);

    try {
        if (shouldPreserveMetadataMessages && hasPreviousTemplate) {
            const fragment = join(workDir, "metadata.pot");
            extractMetadataFragment(project, output, fragment);
            extractSourceMessages({ project, messages, output: source, workDir });
            joinMetadataFragment(source, fragment);
        } else {
            extractSourceMessages({ project, messages, output: source, workDir });
        }

        replaceCatalogTemplate(source, output);
    } finally {
        rmSync(workDir, { recursive: true, force: true });
    }
};

const extractSourceCatalogTo = async (
    project: CatalogProject,
    paths: string[],
    output: string,
): Promise<void> => {
    const sourceFiles = normalizedSourceFiles(project.root, paths);
    const messages = await findSourceMessages(project.root, sourceFiles);
    writePotfiles(project, sourceFiles);
    extractCatalogTemplate({ project, messages, shouldPreserveMetadataMessages: false, output });
};

const extractSourceCatalog = async (
    project: CatalogProject,
    paths: string[],
    shouldPreserveMetadataMessages = true,
): Promise<void> => {
    const sourceFiles = normalizedSourceFiles(project.root, paths);
    const messages = await findSourceMessages(project.root, sourceFiles);
    writePotfiles(project, sourceFiles);
    extractCatalogTemplate({ project, messages, shouldPreserveMetadataMessages });
};

export { extractSourceCatalog, extractSourceCatalogTo, SourceExtractionError };
