import { pascalCase, sortStrings, sortStringsBy } from "@gtkx/utils";
import type { GirClass } from "../gir/class.js";
import type { GirFunction } from "../gir/function.js";
import type { GirRecord } from "../gir/record.js";
import { Library } from "../gir/library.js";
import { type GirNamespace, namespaceDirectory } from "../gir/namespace.js";
import { dedupeCallables, isEmittableCallable } from "../store/gi/callables.js";
import { namespaceFunctionExportName } from "../store/gi/function.js";
import { type ElementProps, setElementProps } from "../store/jsx/element-prop-imports.js";
import { collectIntrinsicElementClasses, type GlibNamedClass } from "../store/jsx/intrinsic-elements.js";
import { type OmittedProps, setOmittedProps } from "../store/jsx/omitted-props.js";
import { createElementPageContext, type ElementPageContext, renderElementPage } from "./element-page.js";
import { docsSignatureContext, firstSentence, namespaceOrder } from "./render.js";
import { type GiSymbolEntry, renderSymbolPage, type SymbolPageOptions } from "./symbol-page.js";

/** What to index and the element config the rendered pages reflect. */
type ApiReferenceOptions = {
    /** GIR library identifiers to load, such as `"Gtk-4.0"`; their dependencies are pulled in too. */
    libraries: string[];
    /** Directories to search for `.gir` files. */
    girPath: string[];
    /** Base props interfaces per element, as read by `readBuiltinElements`; without it pages miss them. */
    props?: ElementProps;
    /** GObject properties the project omits from generated props; without it pages show props that do not exist. */
    omittedProps?: OmittedProps;
};

/** Narrows an `ApiReference.symbols` enumeration. */
type ApiSymbolQuery = {
    /** GIR namespace to keep, matched case-insensitively; every namespace when omitted. */
    namespace?: string;
    /** Symbol kinds to keep; every kind when omitted. */
    kinds?: ApiSymbolKind[];
};

/** What an indexed symbol is: one of the GIR symbol kinds, or a JSX element. */
type ApiSymbolKind = GiSymbolEntry["kind"] | "element";

/** An indexed symbol, without its reference page. */
type ApiSymbol = {
    /** GIR namespace declaring the symbol, such as `"Gtk"`. */
    namespace: string;
    /** Name within the namespace, which for an element is its GLib type name. */
    name: string;
    /** Kind the reference groups and filters the symbol by, `"element"` for a JSX tag. */
    kind: ApiSymbolKind;
    /** First sentence of the symbol's GIR documentation, elided past 220 characters and empty when it has none. */
    summary: string;
};

/** How much of one namespace the reference indexes. */
type ApiNamespaceSummary = {
    /** GIR namespace name, such as `"Gtk"`. */
    name: string;
    /** The `@gtkx/gi` subpath the namespace's symbols are imported from. */
    importPath: string;
    /** How many symbols other than JSX elements the namespace contributes. */
    symbols: number;
    /** How many JSX elements the namespace contributes. */
    elements: number;
};

/** What an `ApiReference.lookup` found: a rendered page, several candidates for the name, or nothing. */
type ApiLookupResult =
    | {
        /** Discriminant selecting the variant. */
        outcome: "page";
        /** Index entry for the symbol the query resolved to. */
        symbol: ApiSymbol;
        /** The symbol's complete reference page, rendered as Markdown. */
        markdown: string;
    } |
    {
        /** Discriminant selecting the variant. */
        outcome: "ambiguous";
        /** Every symbol the name answers to, to be narrowed by namespace or kind. */
        candidates: ApiSymbol[];
    } |
    {
        /** Discriminant selecting the variant. */
        outcome: "notFound";
    };

/** A fuzzy search over indexed symbol names. */
type ApiSearchOptions = {
    /** Text matched case-insensitively against each symbol's name and its qualified `Namespace.Name` form. */
    query: string;
    /** GIR namespace to keep, matched case-insensitively; every namespace when omitted. */
    namespace?: string;
    /** Symbol kinds to keep; every kind when omitted. */
    kinds?: ApiSymbolKind[];
    /** Maximum number of results, 20 by default. */
    limit?: number;
};

type ElementEntry = {
    kind: "element";
    namespace: GirNamespace;
    name: string;
    doc: string | undefined;
    element: GlibNamedClass;
};

type SymbolEntry = GiSymbolEntry | ElementEntry;
type ScoredEntry = { score: number; entry: SymbolEntry };

/** Every kind the reference indexes, in the order a namespace overview groups its symbols. */
const API_SYMBOL_KINDS: ApiSymbolKind[] = [
    "element",
    "class",
    "interface",
    "record",
    "enum",
    "callback",
    "alias",
    "function",
    "constant",
];

const KIND_SECTION_TITLES: Record<ApiSymbolKind, string> = {
    element: "JSX elements",
    class: "Classes",
    interface: "Interfaces",
    record: "Records",
    enum: "Enums",
    callback: "Callbacks",
    alias: "Aliases",
    function: "Functions",
    constant: "Constants",
};

const DEFAULT_SEARCH_LIMIT = 20;

const compareNames = (a: string, b: string): number => {
    if (a < b) {
        return -1;
    }

    return a > b ? 1 : 0;
};

const isQueriedEntry = (
    entry: SymbolEntry,
    namespaceFilter: string | undefined,
    kinds: Set<ApiSymbolKind> | undefined,
): boolean => {
    if (namespaceFilter !== undefined && entry.namespace.name.toLowerCase() !== namespaceFilter) {
        return false;
    }

    return kinds === undefined || kinds.has(entry.kind);
};

const compareApiSymbols = (a: ApiSymbol, b: ApiSymbol): number => {
    const byNamespace = namespaceOrder(a.namespace).localeCompare(namespaceOrder(b.namespace));

    return byNamespace === 0 ? a.name.localeCompare(b.name) : byNamespace;
};

/**
 * Loads the GIR data for the given libraries and indexes every symbol and JSX element in it. The result is
 * a read-only view: it generates no store and needs none, so a tool can explore the bindings a project would
 * get without running codegen.
 *
 * @param options Which libraries to index, where to find them, and the project's element config.
 * @returns The indexed reference.
 */
const loadApiReference = (options: ApiReferenceOptions): ApiReference => new ApiReference(options);

const functionEntry = (
    namespace: GirNamespace,
    docsContext: ReturnType<typeof docsSignatureContext>,
    fn: GirFunction,
): GiSymbolEntry | undefined => {
    if (!isEmittableCallable(docsContext, fn)) {
        return undefined;
    }

    const cIdentifier = fn.cIdentifier;

    if (cIdentifier === undefined) {
        return undefined;
    }

    const name = namespaceFunctionExportName(cIdentifier, fn.name, namespace.cSymbolPrefixes);

    return { kind: "function", namespace, name, doc: fn.doc, fn };
};

const classEntry = (namespace: GirNamespace, klass: GirClass): GiSymbolEntry | undefined => {
    if (!klass.introspectable || klass.name.length === 0) {
        return undefined;
    }

    const kind = klass.isInterface ? "interface" : "class";

    return { kind, namespace, name: pascalCase(klass.name), doc: klass.doc, klass };
};

const classEntries = (namespace: GirNamespace): GiSymbolEntry[] => {
    const entries: GiSymbolEntry[] = [];

    for (const klass of [...namespace.classes, ...namespace.interfaces]) {
        const entry = classEntry(namespace, klass);

        if (entry !== undefined) {
            entries.push(entry);
        }
    }

    return entries;
};

const recordEntry = (namespace: GirNamespace, record: GirRecord): GiSymbolEntry | undefined => {
    if (!record.introspectable || record.isVtable || record.name.length === 0) {
        return undefined;
    }

    return { kind: "record", namespace, name: record.name, doc: record.doc, record };
};

const recordEntries = (namespace: GirNamespace): GiSymbolEntry[] => {
    const entries: GiSymbolEntry[] = [];

    for (const record of namespace.records) {
        const entry = recordEntry(namespace, record);

        if (entry !== undefined) {
            entries.push(entry);
        }
    }

    return entries;
};

const valueEntries = (namespace: GirNamespace): GiSymbolEntry[] => [
    ...namespace.enums
        .filter((enumeration) => enumeration.introspectable)
        .map<GiSymbolEntry>((enumeration) => ({
            kind: "enum",
            namespace,
            name: enumeration.name,
            doc: enumeration.doc,
            enumeration,
        })),
    ...namespace.callbacks
        .filter((callback) => callback.introspectable)
        .map<GiSymbolEntry>((callback) => ({
            kind: "callback",
            namespace,
            name: callback.name,
            doc: callback.doc,
            callback,
        })),
    ...namespace.aliases.map<GiSymbolEntry>((alias) => ({
        kind: "alias",
        namespace,
        name: alias.name,
        doc: alias.doc,
        alias,
    })),
    ...namespace.constants.map<GiSymbolEntry>((constant) => ({
        kind: "constant",
        namespace,
        name: constant.name,
        doc: constant.doc,
        constant,
    })),
];

const narrowToExactMatches = (candidates: SymbolEntry[], trimmed: string, isQualified: boolean): SymbolEntry[] => {
    if (candidates.length <= 1) {
        return candidates;
    }

    const exact = candidates.filter(
        (entry) => (isQualified ? `${entry.namespace.name}.${entry.name}` : entry.name) === trimmed,
    );

    return exact.length > 0 ? exact : candidates;
};

const isSearchFilterMatch = (
    entry: SymbolEntry,
    namespaceFilter: string | undefined,
    kinds: ApiSymbolKind[] | undefined,
): boolean => {
    if (namespaceFilter !== undefined && entry.namespace.name.toLowerCase() !== namespaceFilter) {
        return false;
    }

    if (kinds !== undefined && !kinds.includes(entry.kind)) {
        return false;
    }

    return true;
};

const getScoredEntry = (
    entry: SymbolEntry,
    query: string,
    namespaceFilter: string | undefined,
    kinds: ApiSymbolKind[] | undefined,
): ScoredEntry | undefined => {
    if (!isSearchFilterMatch(entry, namespaceFilter, kinds)) {
        return undefined;
    }

    const score = searchScore(entry, query);

    if (score === 0) {
        return undefined;
    }

    return { score, entry };
};

const compareScoredEntries = (a: ScoredEntry, b: ScoredEntry): number =>
    b.score - a.score ||
    a.entry.name.length - b.entry.name.length ||
    compareNames(a.entry.name, b.entry.name) ||
    compareNames(namespaceOrder(a.entry.namespace.name), namespaceOrder(b.entry.namespace.name)) ||
    compareNames(a.entry.kind, b.entry.kind);

const searchScore = (entry: SymbolEntry, query: string): number => {
    const name = entry.name.toLowerCase();
    const qualified = `${entry.namespace.name.toLowerCase()}.${name}`;

    if (name === query || qualified === query) {
        return 3;
    }

    if (name.startsWith(query)) {
        return 2;
    }

    if (name.includes(query) || qualified.includes(query)) {
        return 1;
    }

    return 0;
};

/** An index over the GIR data a project's bindings are generated from, queryable and renderable as Markdown. */
class ApiReference {
    private library: Library;
    private libraries: string[];
    private elementContext: ElementPageContext;
    private entries: SymbolEntry[] = [];
    private byQualified: Map<string, SymbolEntry[]> = new Map();
    private byName: Map<string, SymbolEntry[]> = new Map();
    private byNamespace: Map<string, SymbolEntry[]> = new Map();
    private elementsByClass: Map<string, string> = new Map();

    private props: ElementProps;
    private omittedProps: OmittedProps;

    constructor(options: ApiReferenceOptions) {
        this.libraries = options.libraries;
        this.props = options.props ?? {};
        this.omittedProps = options.omittedProps ?? {};
        this.library = Library.load(options.libraries, options.girPath);
        this.elementContext = createElementPageContext(this.library, (): string | undefined => undefined);
        this.buildIndex();
    }

    private applyElementConfig(): void {
        setElementProps(this.props);
        setOmittedProps(this.omittedProps);
    }

    private add(entry: SymbolEntry): void {
        this.entries.push(entry);

        const push = (map: Map<string, SymbolEntry[]>, key: string): void => {
            const list = map.get(key) ?? [];
            list.push(entry);
            map.set(key, list);
        };

        push(this.byQualified, `${entry.namespace.name}.${entry.name}`.toLowerCase());
        push(this.byName, entry.name.toLowerCase());
        push(this.byNamespace, entry.namespace.name);
    }

    private buildIndex(): void {
        for (const namespace of this.library.namespaces.values()) {
            this.indexNamespace(namespace);
        }

        for (const element of collectIntrinsicElementClasses(this.library)) {
            this.add({
                kind: "element",
                namespace: element.namespace,
                name: element.glibName,
                doc: element.klass.doc,
                element,
            });

            this.elementsByClass.set(`${element.namespace.name}.${element.klass.name}`, element.glibName);
        }
    }

    private indexNamespace(namespace: GirNamespace): void {
        const entries = [
            ...classEntries(namespace),
            ...recordEntries(namespace),
            ...valueEntries(namespace),
        ];

        for (const entry of entries) {
            this.add(entry);
        }

        this.indexFunctions(namespace);
    }

    private indexFunctions(namespace: GirNamespace): void {
        if (namespace.sharedLibrary === undefined) {
            return;
        }

        const docsContext = docsSignatureContext(namespace, this.library);

        for (const fn of dedupeCallables(namespace.functions)) {
            const entry = functionEntry(namespace, docsContext, fn);

            if (entry !== undefined) {
                this.add(entry);
            }
        }
    }

    private toApiSymbol(entry: SymbolEntry): ApiSymbol {
        return {
            namespace: entry.namespace.name,
            name: entry.name,
            kind: entry.kind,
            summary: firstSentence(entry.doc),
        };
    }

    private symbolPageOptions(): SymbolPageOptions {
        return {
            library: this.library,
            elementNameFor: (namespaceName, className) => this.elementsByClass.get(`${namespaceName}.${className}`),
        };
    }

    private renderPage(entry: SymbolEntry): string {
        if (entry.kind === "element") {
            this.applyElementConfig();

            return renderElementPage(entry.element, this.elementContext);
        }

        return renderSymbolPage(entry, this.symbolPageOptions());
    }

    private findNamespace(name: string): GirNamespace | undefined {
        const lower = name.toLowerCase();

        for (const namespace of this.library.namespaces.values()) {
            if (namespace.name.toLowerCase() === lower) {
                return namespace;
            }
        }

        return undefined;
    }

    private lookupCandidates(trimmed: string, kind: ApiSymbolKind | undefined): SymbolEntry[] {
        const isQualified = trimmed.includes(".");
        const map = isQualified ? this.byQualified : this.byName;
        let candidates = map.get(trimmed.toLowerCase()) ?? [];

        if (kind !== undefined) {
            candidates = candidates.filter((entry) => entry.kind === kind);
        }

        return narrowToExactMatches(candidates, trimmed, isQualified);
    }

    private scoreEntries(
        query: string,
        namespaceFilter: string | undefined,
        kinds: ApiSymbolKind[] | undefined,
    ): ScoredEntry[] {
        const scored: ScoredEntry[] = [];

        for (const entry of this.entries) {
            const item = getScoredEntry(entry, query, namespaceFilter, kinds);

            if (item !== undefined) {
                scored.push(item);
            }
        }

        return scored;
    }

    /** Paths of the `.gir` files the index was built from, including the ones pulled in as dependencies. */
    get girFiles(): string[] {
        return this.library.girFiles;
    }

    /**
     * Resolves a name to a single symbol and renders its reference page. The name may be bare (`Button`) or
     * qualified (`Gtk.Button`), and is matched case-insensitively; a name several symbols answer to is
     * reported as ambiguous rather than picked between.
     *
     * @param kind Restricts the match to one kind, which is how a class and its JSX element are told apart.
     */
    lookup(query: string, kind?: ApiSymbolKind): ApiLookupResult {
        const trimmed = query.trim();

        if (trimmed.length === 0) {
            return { outcome: "notFound" };
        }

        const candidates = this.lookupCandidates(trimmed, kind);
        const entry = candidates[0];

        if (entry === undefined) {
            return { outcome: "notFound" };
        }

        if (candidates.length > 1) {
            return { outcome: "ambiguous", candidates: candidates.map((candidate) => this.toApiSymbol(candidate)) };
        }

        return { outcome: "page", symbol: this.toApiSymbol(entry), markdown: this.renderPage(entry) };
    }

    /** Every indexed symbol the query keeps, ordered by namespace (Gtk, then Adw, then alphabetically) and name. */
    symbols(query: ApiSymbolQuery = {}): ApiSymbol[] {
        const namespaceFilter = query.namespace?.toLowerCase();
        const kinds = query.kinds === undefined ? undefined : new Set(query.kinds);

        return this.entries
            .filter((entry) => isQueriedEntry(entry, namespaceFilter, kinds))
            .map((entry) => this.toApiSymbol(entry))
            .toSorted(compareApiSymbols);
    }

    /**
     * Symbols whose name matches the query, best first: an exact name beats a prefix, which beats a
     * substring, and shorter names win ties. An empty query matches nothing.
     */
    search(options: ApiSearchOptions): ApiSymbol[] {
        const query = options.query.trim().toLowerCase();

        if (query.length === 0) {
            return [];
        }

        const limit = Math.max(1, Math.floor(options.limit ?? DEFAULT_SEARCH_LIMIT));
        const namespaceFilter = options.namespace?.toLowerCase();
        const scored = this.scoreEntries(query, namespaceFilter, options.kinds);
        scored.sort(compareScoredEntries);

        return scored.slice(0, limit).map((item) => this.toApiSymbol(item.entry));
    }

    /** A summary of every indexed namespace, ordered Gtk, Adw, then alphabetically. */
    namespaces(): ApiNamespaceSummary[] {
        const summaries = [...this.byNamespace].map(([name, entries]) => ({
            name,
            importPath: `@gtkx/gi/${namespaceDirectory({ name })}`,
            symbols: entries.filter((entry) => entry.kind !== "element").length,
            elements: entries.filter((entry) => entry.kind === "element").length,
        }));

        return sortStringsBy(summaries, (summary) => namespaceOrder(summary.name));
    }

    /**
     * Sorted names of everything a namespace contributes, JSX elements included. The namespace is matched
     * case-insensitively, and an unindexed one yields an empty array.
     */
    symbolNames(namespaceName: string): string[] {
        const namespace = this.findNamespace(namespaceName);

        if (namespace === undefined) {
            return [];
        }

        const entries = this.byNamespace.get(namespace.name) ?? [];

        return sortStrings(entries.map((entry) => entry.name));
    }

    /** Renders the reference's Markdown landing page: every namespace, its import path, and its totals. */
    overview(): string {
        const rows = this.namespaces().map(
            (summary) =>
                `| ${summary.name} | \`${summary.importPath}\` | ${String(summary.symbols)} | ` +
                `${String(summary.elements)} |`,
        );

        const librariesList = this.libraries.map((library) => `\`${library}\``).join(", ");

        return [
            "# API Reference",
            "",
            `Generated bindings for ${librariesList} and the namespaces they pull in. Classes, interfaces, ` +
            "records, enums, callbacks, aliases, functions, and constants are imported from " +
            "`@gtkx/gi/<namespace>`; JSX elements are imported from `@gtkx/jsx/<namespace>`.",
            "",
            "Every symbol has a reference page addressed by its qualified name (for example `Gtk.Button`, " +
            "`Gtk.Orientation`, `GLib.idleAdd`) and every JSX element by its element name " +
            "(for example `GtkButton`).",
            "",
            "| Namespace | Import | Symbols | JSX elements |",
            "| --- | --- | --- | --- |",
            ...rows,
            "",
        ].join("\n");
    }

    /**
     * Renders one namespace's Markdown page: its import line and its symbol names grouped by kind. The
     * namespace is matched case-insensitively, and an unindexed one yields undefined.
     */
    namespaceOverview(name: string): string | undefined {
        const namespace = this.findNamespace(name);

        if (namespace === undefined) {
            return undefined;
        }

        const entries = this.byNamespace.get(namespace.name) ?? [];
        const directory = namespaceDirectory(namespace);

        const lines = [
            `# ${namespace.name}`,
            "",
            `\`\`\`ts\nimport * as ${namespace.name} from "@gtkx/gi/${directory}";\n\`\`\``,
        ];

        for (const kind of API_SYMBOL_KINDS) {
            const names = entries.filter((entry) => entry.kind === kind).map((entry) => entry.name);

            if (names.length === 0) {
                continue;
            }

            lines.push(
                "",
                `## ${KIND_SECTION_TITLES[kind]} (${String(names.length)})`,
                "",
                sortStrings(names)
                    .map((symbolName) => `\`${symbolName}\``)
                    .join(", "),
            );
        }

        lines.push("");

        return lines.join("\n");
    }
}

export type { ApiReference };
export {
    API_SYMBOL_KINDS,
    loadApiReference,
    type ApiReferenceOptions,
    type ApiSymbolKind,
    type ApiSymbol,
    type ApiNamespaceSummary,
    type ApiLookupResult,
    type ApiSearchOptions,
    type ApiSymbolQuery,
};
