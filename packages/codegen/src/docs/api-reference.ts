import type { ElementProp } from "@gtkx/config";
import { sortStrings, sortStringsBy, toPascalCase } from "@gtkx/utils";
import { Library } from "../gir/library.js";
import { type GirNamespace, namespaceDirectory } from "../gir/namespace.js";
import { dedupeCallables, isEmittableCallable } from "../store/gi/callables.js";
import { isClassStructRecord } from "../store/gi/class-struct-record.js";
import { namespaceFunctionExportName } from "../store/gi/function.js";
import { collectIntrinsicElementClasses, type GlibNamedClass } from "../store/react/intrinsic-elements.js";
import { createElementPageContext, type ElementPageContext, renderElementPage } from "./element-page.js";
import { docsSignatureContext, firstSentence, namespaceOrder } from "./render.js";
import { type GiSymbolEntry, renderSymbolPage, type SymbolPageOptions } from "./symbol-page.js";

export type ApiReferenceOptions = {
    libraries: string[];
    girPath: string[];
    elementProps?: Record<string, ElementProp[]>;
};

export type ApiSymbolKind = GiSymbolEntry["kind"] | "element";

export const API_SYMBOL_KINDS: ApiSymbolKind[] = [
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

export type ApiSymbol = {
    namespace: string;
    name: string;
    kind: ApiSymbolKind;
    summary: string;
};

export type ApiNamespaceSummary = {
    name: string;
    importPath: string;
    symbols: number;
    elements: number;
};

export type ApiLookupResult =
    | { outcome: "page"; symbol: ApiSymbol; markdown: string }
    | { outcome: "ambiguous"; candidates: ApiSymbol[] }
    | { outcome: "notFound" };

export type ApiSearchOptions = {
    query: string;
    namespace?: string;
    kinds?: ApiSymbolKind[];
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

const compareNames = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export class ApiReference {
    private library: Library;
    private libraries: string[];
    private elementContext: ElementPageContext;
    private entries: SymbolEntry[] = [];
    private byQualified = new Map<string, SymbolEntry[]>();
    private byName = new Map<string, SymbolEntry[]>();
    private byNamespace = new Map<string, SymbolEntry[]>();
    private elementsByClass = new Map<string, string>();

    private constructor(options: ApiReferenceOptions) {
        this.libraries = options.libraries;
        this.library = Library.load(options.libraries, options.girPath);
        this.elementContext = createElementPageContext(this.library, options.elementProps ?? {}, () => undefined);
        this.buildIndex();
    }

    static load(options: ApiReferenceOptions): ApiReference {
        return new ApiReference(options);
    }

    get girFiles(): string[] {
        return this.library.girFiles;
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
            ...recordEntries(this.library, namespace),
            ...valueEntries(namespace),
        ];
        for (const entry of entries) {
            this.add(entry);
        }
        this.indexFunctions(namespace);
    }

    private indexFunctions(namespace: GirNamespace): void {
        if (namespace.sharedLibrary === undefined) return;
        const docsContext = docsSignatureContext(namespace, this.library);
        for (const fn of dedupeCallables(namespace.functions)) {
            if (!isEmittableCallable(docsContext, fn)) continue;
            const cIdentifier = fn.cIdentifier;
            if (cIdentifier === undefined) continue;
            const name = namespaceFunctionExportName(cIdentifier, fn.name, namespace.cSymbolPrefixes);
            this.add({ kind: "function", namespace, name, doc: fn.doc, fn });
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
        if (entry.kind === "element") return renderElementPage(entry.element, this.elementContext);
        return renderSymbolPage(entry, this.symbolPageOptions());
    }

    private findNamespace(name: string): GirNamespace | undefined {
        const lower = name.toLowerCase();
        for (const namespace of this.library.namespaces.values()) {
            if (namespace.name.toLowerCase() === lower) return namespace;
        }
        return undefined;
    }

    lookup(query: string, kind?: ApiSymbolKind): ApiLookupResult {
        const trimmed = query.trim();
        if (trimmed.length === 0) return { outcome: "notFound" };
        const qualified = trimmed.includes(".");
        const map = qualified ? this.byQualified : this.byName;
        let candidates = map.get(trimmed.toLowerCase()) ?? [];
        if (kind !== undefined) candidates = candidates.filter((entry) => entry.kind === kind);
        if (candidates.length > 1) {
            const exact = candidates.filter((entry) =>
                qualified ? `${entry.namespace.name}.${entry.name}` === trimmed : entry.name === trimmed,
            );
            if (exact.length > 0) candidates = exact;
        }
        const entry = candidates[0];
        if (entry === undefined) return { outcome: "notFound" };
        if (candidates.length > 1) {
            return { outcome: "ambiguous", candidates: candidates.map((candidate) => this.toApiSymbol(candidate)) };
        }
        return { outcome: "page", symbol: this.toApiSymbol(entry), markdown: this.renderPage(entry) };
    }

    search(options: ApiSearchOptions): ApiSymbol[] {
        const query = options.query.trim().toLowerCase();
        if (query.length === 0) return [];
        const limit = Math.max(1, Math.floor(options.limit ?? DEFAULT_SEARCH_LIMIT));
        const namespaceFilter = options.namespace?.toLowerCase();
        const scored: { score: number; entry: SymbolEntry }[] = [];
        for (const entry of this.entries) {
            if (namespaceFilter !== undefined && entry.namespace.name.toLowerCase() !== namespaceFilter) continue;
            if (options.kinds !== undefined && !options.kinds.includes(entry.kind)) continue;
            const score = searchScore(entry, query);
            if (score === 0) continue;
            scored.push({ score, entry });
        }
        scored.sort(
            (a, b) =>
                b.score - a.score ||
                a.entry.name.length - b.entry.name.length ||
                compareNames(a.entry.name, b.entry.name) ||
                compareNames(namespaceOrder(a.entry.namespace.name), namespaceOrder(b.entry.namespace.name)) ||
                compareNames(a.entry.kind, b.entry.kind),
        );
        return scored.slice(0, limit).map((item) => this.toApiSymbol(item.entry));
    }

    namespaces(): ApiNamespaceSummary[] {
        const summaries = [...this.byNamespace.entries()].map(([name, entries]) => ({
            name,
            importPath: `@gtkx/gi/${namespaceDirectory({ name })}`,
            symbols: entries.filter((entry) => entry.kind !== "element").length,
            elements: entries.filter((entry) => entry.kind === "element").length,
        }));
        return sortStringsBy(summaries, (summary) => namespaceOrder(summary.name));
    }

    symbolNames(namespaceName: string): string[] {
        const namespace = this.findNamespace(namespaceName);
        if (namespace === undefined) return [];
        const entries = this.byNamespace.get(namespace.name) ?? [];
        return sortStrings(entries.map((entry) => entry.name));
    }

    overview(): string {
        const rows = this.namespaces().map(
            (summary) => `| ${summary.name} | \`${summary.importPath}\` | ${summary.symbols} | ${summary.elements} |`,
        );
        const librariesList = this.libraries.map((library) => `\`${library}\``).join(", ");
        return [
            "# API Reference",
            "",
            `Generated bindings for ${librariesList} and the namespaces they pull in. Classes, interfaces, records, enums, callbacks, aliases, functions, and constants are imported from \`@gtkx/gi/<namespace>\`; JSX elements are imported from \`@gtkx/jsx/<namespace>\`.`,
            "",
            "Every symbol has a reference page addressed by its qualified name (for example `Gtk.Button`, `Gtk.Orientation`, `GLib.idleAdd`) and every JSX element by its element name (for example `GtkButton`).",
            "",
            "| Namespace | Import | Symbols | JSX elements |",
            "| --- | --- | --- | --- |",
            ...rows,
            "",
        ].join("\n");
    }

    namespaceOverview(name: string): string | undefined {
        const namespace = this.findNamespace(name);
        if (namespace === undefined) return undefined;
        const entries = this.byNamespace.get(namespace.name) ?? [];
        const directory = namespaceDirectory(namespace);
        const lines = [
            `# ${namespace.name}`,
            "",
            `\`\`\`ts\nimport * as ${namespace.name} from "@gtkx/gi/${directory}";\n\`\`\``,
        ];
        for (const kind of API_SYMBOL_KINDS) {
            const names = entries.filter((entry) => entry.kind === kind).map((entry) => entry.name);
            if (names.length === 0) continue;
            lines.push(
                "",
                `## ${KIND_SECTION_TITLES[kind]} (${names.length})`,
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

const classEntries = (namespace: GirNamespace): GiSymbolEntry[] => {
    const entries: GiSymbolEntry[] = [];
    for (const klass of [...namespace.classes, ...namespace.interfaces]) {
        if (!klass.introspectable || klass.name.length === 0) continue;
        const kind = klass.isInterface ? "interface" : "class";
        entries.push({ kind, namespace, name: toPascalCase(klass.name), doc: klass.doc, klass });
    }
    return entries;
};

const recordEntries = (library: Library, namespace: GirNamespace): GiSymbolEntry[] => {
    const entries: GiSymbolEntry[] = [];
    for (const record of namespace.records) {
        if (!record.introspectable || record.isVtable || record.name.length === 0) continue;
        if (isClassStructRecord(library, namespace.name, record)) continue;
        entries.push({ kind: "record", namespace, name: record.name, doc: record.doc, record });
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

const searchScore = (entry: SymbolEntry, query: string): number => {
    const name = entry.name.toLowerCase();
    const qualified = `${entry.namespace.name.toLowerCase()}.${name}`;
    if (name === query || qualified === query) return 3;
    if (name.startsWith(query)) return 2;
    if (name.includes(query) || qualified.includes(query)) return 1;
    return 0;
};
