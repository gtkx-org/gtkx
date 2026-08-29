import { existsSync } from "node:fs";
import { join } from "node:path";
import type { PrimitiveCategory } from "./primitives.js";
import type { CArrayType, HashTableType, ListType, ParseContext, TypeId } from "./type-id.js";
import type { GirType } from "./type.js";
import { callbackFromNode } from "./callback.js";
import {
    createNamespaceShell,
    type GirNamespace,
    type NamespaceHeader,
    parseNamespaceHeader,
    populateNamespaceBody,
} from "./namespace.js";
import { parseGirFile, type RawNode } from "./parse.js";
import { splitOptionalNamespace } from "./type-ref.js";

/** The types belonging to one namespace, addressed by the id half of a {@link TypeId}. */
type TypeTable = {
    /** Parsed type in each slot, still `undefined` while only a forward reference to it has been seen. */
    types: (GirType | undefined)[];
    /** Declared name of each slot, `undefined` for anonymous types such as containers and inline callbacks. */
    names: (string | undefined)[];
    /** Slot id each named type occupies, so repeated references resolve to the same id. */
    index: Map<string, number>;
};

/** A namespace whose header has been read and whose shell is registered, before its body is parsed. */
type DiscoveredNamespace = {
    /** Attributes and includes read from the namespace's GIR file. */
    header: NamespaceHeader;
    /** Empty namespace registered for the header, populated once every header is known. */
    shell: GirNamespace;
};

const INTERNAL_NS_ID = 0;

const readRepositoryNode = (path: string): RawNode => {
    const root = parseGirFile(path);
    const repository = root.repository;

    if (typeof repository !== "object" || repository === null) {
        throw new Error(`GIR file at ${path} has no <repository> root`);
    }

    return repository as RawNode;
};

const locateGirFile = (identifier: string, girPath: string[]): string => {
    const filename = `${identifier}.gir`;

    for (const directory of girPath) {
        const candidate = join(directory, filename);

        if (existsSync(candidate)) {
            return candidate;
        }
    }

    const tried = girPath.map((directory) => join(directory, filename)).join(", ");
    throw new Error(`GIR file ${filename} not found on girPath. Tried: ${tried}`);
};

/**
 * The parsed GIR universe: every requested namespace plus everything those namespaces include,
 * with types resolvable across namespace boundaries.
 */
class Library {
    private static drive(library: Library, libraries: string[], girPath: string[]): void {
        const { discovered, girFiles } = library.discoverNamespaces(libraries, girPath);

        for (const { header, shell } of discovered) {
            populateNamespaceBody(shell, header.namespaceNode, library.parseContext(shell.id));
        }

        for (const { shell } of discovered) {
            library.addDeclarations(shell);
        }

        library.girFilesValue = girFiles;
    }

    /**
     * Parses the named GIR libraries along with every namespace they transitively include.
     *
     * @param libraries GIR identifiers to load, such as `Gtk-4.0`.
     * @param girPath Directories searched, in order, for each `.gir` file.
     * @returns A library holding every namespace that was parsed.
     */
    static load(libraries: string[], girPath: string[]): Library {
        const library = new Library();
        this.drive(library, libraries, girPath);

        return library;
    }

    private namespacesByName: Map<string, GirNamespace> = new Map();
    private namespaceById: (GirNamespace | undefined)[] = [];
    private nsNameById: string[] = [];
    private nsIdByName: Map<string, number> = new Map();
    private typeTables: TypeTable[] = [];
    private girFilesValue: string[] = [];

    /** Creates a library with no namespaces loaded; {@link Library.load} builds a populated one. */
    constructor() {
        this.typeTables[INTERNAL_NS_ID] = { types: [], names: [], index: new Map() };
        this.namespaceById[INTERNAL_NS_ID] = undefined;
        this.nsNameById[INTERNAL_NS_ID] = "$internal";
    }

    private ensureNsId(name: string): number {
        const existing = this.nsIdByName.get(name);

        if (existing !== undefined) {
            return existing;
        }

        const nsId = this.typeTables.length;
        this.typeTables[nsId] = { types: [], names: [], index: new Map() };
        this.namespaceById[nsId] = undefined;
        this.nsNameById[nsId] = name;
        this.nsIdByName.set(name, nsId);

        return nsId;
    }

    private registerNamespace(header: NamespaceHeader): GirNamespace {
        const nsId = this.ensureNsId(header.name);
        const shell = createNamespaceShell(header, nsId);
        this.namespaceById[nsId] = shell;
        this.namespacesByName.set(header.name, shell);

        return shell;
    }

    private namespaceFor(nsId: number): GirNamespace {
        const namespace = this.namespaceById[nsId];

        if (namespace === undefined) {
            throw new Error(`No namespace registered for type table id ${String(nsId)}`);
        }

        return namespace;
    }

    private typeTableFor(nsId: number): TypeTable {
        const typeTable = this.typeTables[nsId];

        if (typeTable === undefined) {
            throw new Error(`No type table for namespace id ${String(nsId)}`);
        }

        return typeTable;
    }

    private insertIntoTypeTable(
        typeTable: TypeTable,
        slot: { type: GirType | undefined; indexKey?: string; displayName?: string },
    ): number {
        const id = typeTable.types.length;
        typeTable.types.push(slot.type);
        typeTable.names.push(slot.displayName);

        if (slot.indexKey !== undefined) {
            typeTable.index.set(slot.indexKey, id);
        }

        return id;
    }

    private resolveTypeId(nsId: number, name: string, type: GirType | undefined): number {
        const typeTable = this.typeTableFor(nsId);
        const existing = typeTable.index.get(name);

        if (existing !== undefined) {
            return existing;
        }

        return this.insertIntoTypeTable(typeTable, { type, indexKey: name, displayName: name });
    }

    private addType(nsId: number, name: string, type: GirType): void {
        this.typeTableFor(nsId).types[this.resolveTypeId(nsId, name, type)] = type;
    }

    private findType(nsId: number, name: string): TypeId {
        return { nsId, id: this.resolveTypeId(nsId, name, undefined) };
    }

    private addAnonymousType(nsId: number, type: GirType): TypeId {
        const typeTable = this.typeTableFor(nsId);
        const id = this.insertIntoTypeTable(typeTable, { type });

        return { nsId, id };
    }

    private findTypeByName(currentNsId: number, name: string): TypeId {
        const [namespaceName, localName] = splitOptionalNamespace(name);
        const targetNsId = namespaceName === undefined ? currentNsId : this.ensureNsId(namespaceName);

        return this.findType(targetNsId, localName);
    }

    private parseContext(nsId: number): ParseContext {
        const context: ParseContext = {
            nsId,
            findType: (name) => this.findTypeByName(nsId, name),
            addPrimitive: (category) => this.addPrimitive(category),
            addVarargs: () => this.addVarargs(),
            addContainer: (type: CArrayType | ListType | HashTableType) => this.addAnonymousType(nsId, type),
            addAnonymousCallback: (node) =>
                this.addAnonymousType(nsId, {
                    kind: "callback",
                    namespace: this.namespaceFor(nsId),
                    value: callbackFromNode(node, context),
                }),
        };

        return context;
    }

    private addPrimitive(category: PrimitiveCategory): TypeId {
        return this.findOrAddContainer(`primitive:${category}`, { kind: "primitive", category });
    }

    private addVarargs(): TypeId {
        return this.findOrAddContainer("varargs", { kind: "varargs" });
    }

    private findOrAddContainer(key: string, type: GirType): TypeId {
        const typeTable = this.typeTableFor(INTERNAL_NS_ID);
        const existing = typeTable.index.get(key);

        if (existing !== undefined) {
            return { nsId: INTERNAL_NS_ID, id: existing };
        }

        const id = this.insertIntoTypeTable(typeTable, { type, indexKey: key });

        return { nsId: INTERNAL_NS_ID, id };
    }

    private addDeclarations(shell: GirNamespace): void {
        this.addClassDeclarations(shell);
        this.addValueDeclarations(shell);
    }

    private addClassDeclarations(shell: GirNamespace): void {
        const nsId = shell.id;

        for (const value of shell.classes) {
            this.addType(nsId, value.name, { kind: "class", namespace: shell, value });
        }

        for (const value of shell.interfaces) {
            this.addType(nsId, value.name, { kind: "interface", namespace: shell, value });
        }

        for (const value of shell.records) {
            this.addType(nsId, value.name, { kind: "record", namespace: shell, value });
        }
    }

    private addValueDeclarations(shell: GirNamespace): void {
        const nsId = shell.id;

        for (const value of shell.enums) {
            this.addType(nsId, value.name, { kind: "enum", namespace: shell, value });
        }

        for (const value of shell.callbacks) {
            this.addType(nsId, value.name, { kind: "callback", namespace: shell, value });
        }

        for (const alias of shell.aliases) {
            this.addType(nsId, alias.name, { kind: "alias", namespace: shell, value: alias });
        }
    }

    private processIdentifier(input: {
        identifier: string;
        girPath: string[];
        seen: Set<string>;
        queue: string[];
        girFiles: string[];
        discovered: DiscoveredNamespace[];
    }): void {
        const { identifier, girPath, seen, queue, girFiles, discovered } = input;
        const namespaceName = identifier.split("-", 1)[0] ?? identifier;

        if (seen.has(namespaceName)) {
            return;
        }

        seen.add(namespaceName);
        const path = locateGirFile(identifier, girPath);
        girFiles.push(path);
        const header = parseNamespaceHeader(readRepositoryNode(path), path);
        const shell = this.registerNamespace(header);
        discovered.push({ header, shell });

        for (const include of header.includes) {
            queue.push(`${include.name}-${include.version}`);
        }
    }

    private discoverNamespaces(
        libraries: string[],
        girPath: string[],
    ): { discovered: DiscoveredNamespace[]; girFiles: string[] } {
        const queue: string[] = [...libraries];
        const seen: Set<string> = new Set();
        const discovered: DiscoveredNamespace[] = [];
        const girFiles: string[] = [];

        while (queue.length > 0) {
            const identifier = queue.shift();

            if (identifier !== undefined) {
                this.processIdentifier({ identifier, girPath, seen, queue, girFiles, discovered });
            }
        }

        return { discovered, girFiles };
    }

    /** The loaded namespaces, keyed by their GIR name such as `Gtk`. */
    public get namespaces(): Map<string, GirNamespace> {
        return this.namespacesByName;
    }

    /** Paths of the `.gir` files that were read, in the order they were discovered. */
    public get girFiles(): string[] {
        return this.girFilesValue;
    }

    /**
     * Reads the type a {@link TypeId} points at.
     *
     * @param tid The type id to dereference.
     * @returns The parsed type, or `undefined` when nothing has been parsed into that slot.
     */
    typeFor(tid: TypeId): GirType | undefined {
        return this.typeTables[tid.nsId]?.types[tid.id];
    }

    /**
     * Reads the name a {@link TypeId} was registered under.
     *
     * @param tid The type id to name.
     * @returns The namespace and type name, or `undefined` for an anonymous type.
     */
    nameFor(tid: TypeId): {
        /** GIR namespace to qualify the type with, such as `Gtk`. */
        namespaceName: string;
        /** Unqualified type name as GIR declares it, such as `Widget`. */
        typeName: string;
    } | undefined {
        const typeName = this.typeTables[tid.nsId]?.names[tid.id];
        const namespaceName = this.nsNameById[tid.nsId];

        if (typeName === undefined || namespaceName === undefined) {
            return undefined;
        }

        return { namespaceName, typeName };
    }

    /**
     * Looks up a type by the name a GIR file writes, resolving an unqualified name against the
     * namespace it appears in and a `Namespace.Type` name against the loaded namespaces.
     *
     * @param currentNamespaceName Namespace the name is written in.
     * @param name Type name, optionally qualified with a namespace prefix.
     * @returns The parsed type, or `undefined` when the name is unknown or only a forward reference to it exists.
     */
    resolveType(currentNamespaceName: string, name: string): GirType | undefined {
        const currentNsId = this.nsIdByName.get(currentNamespaceName);

        if (currentNsId === undefined) {
            return undefined;
        }

        const [namespaceName, localName] = splitOptionalNamespace(name);
        const targetNsId = namespaceName === undefined ? currentNsId : this.nsIdByName.get(namespaceName);

        if (targetNsId === undefined) {
            return undefined;
        }

        const id = this.typeTableFor(targetNsId).index.get(localName);

        if (id === undefined) {
            return undefined;
        }

        return this.typeTableFor(targetNsId).types[id];
    }
}

export { Library };
