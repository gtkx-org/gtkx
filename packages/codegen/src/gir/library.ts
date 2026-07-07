import { existsSync } from "node:fs";
import { join } from "node:path";
import { callbackFromNode } from "./callback.js";
import {
    createNamespaceShell,
    type GirNamespace,
    type NamespaceHeader,
    parseNamespaceHeader,
    populateNamespaceBody,
} from "./namespace.js";
import { parseGirFile, type RawNode } from "./parse.js";
import type { PrimitiveCategory } from "./primitives.js";
import type { GirType } from "./type.js";
import type { CArrayType, GHashTableType, GListType, ParseContext, TypeId } from "./type-id.js";
import { splitOptionalNamespace } from "./type-ref.js";

const INTERNAL_NS_ID = 0;

type TypeTable = {
    types: (GirType | undefined)[];
    names: (string | undefined)[];
    index: Map<string, number>;
};

export class Library {
    private namespacesByName = new Map<string, GirNamespace>();
    private namespaceById: (GirNamespace | undefined)[] = [];
    private nsNameById: string[] = [];
    private nsIdByName = new Map<string, number>();
    private typeTables: TypeTable[] = [];
    private girFilesValue: string[] = [];

    public get namespaces(): Map<string, GirNamespace> {
        return this.namespacesByName;
    }

    public get girFiles(): string[] {
        return this.girFilesValue;
    }

    constructor() {
        this.typeTables[INTERNAL_NS_ID] = { types: [], names: [], index: new Map() };
        this.namespaceById[INTERNAL_NS_ID] = undefined;
        this.nsNameById[INTERNAL_NS_ID] = "$internal";
    }

    private ensureNsId(name: string): number {
        const existing = this.nsIdByName.get(name);
        if (existing !== undefined) return existing;
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

    private namespaceOf(nsId: number): GirNamespace {
        const namespace = this.namespaceById[nsId];
        if (namespace === undefined) {
            throw new Error(`No namespace registered for type table id ${nsId}`);
        }
        return namespace;
    }

    private typeTableOf(nsId: number): TypeTable {
        const typeTable = this.typeTables[nsId];
        if (typeTable === undefined) {
            throw new Error(`No type table for namespace id ${nsId}`);
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
        if (slot.indexKey !== undefined) typeTable.index.set(slot.indexKey, id);
        return id;
    }

    private addType(nsId: number, name: string, type: GirType): void {
        const typeTable = this.typeTableOf(nsId);
        const existing = typeTable.index.get(name);
        if (existing !== undefined) {
            typeTable.types[existing] = type;
            return;
        }
        this.insertIntoTypeTable(typeTable, { type, indexKey: name, displayName: name });
    }

    private findType(nsId: number, name: string): TypeId {
        const typeTable = this.typeTableOf(nsId);
        const existing = typeTable.index.get(name);
        if (existing !== undefined) return { nsId, id: existing };
        const id = this.insertIntoTypeTable(typeTable, { type: undefined, indexKey: name, displayName: name });
        return { nsId, id };
    }

    private addAnonymousType(nsId: number, type: GirType): TypeId {
        const typeTable = this.typeTableOf(nsId);
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
            addContainer: (type: CArrayType | GListType | GHashTableType) => this.addAnonymousType(nsId, type),
            addAnonymousCallback: (node) =>
                this.addAnonymousType(nsId, {
                    kind: "callback",
                    namespace: this.namespaceOf(nsId),
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
        const typeTable = this.typeTableOf(INTERNAL_NS_ID);
        const existing = typeTable.index.get(key);
        if (existing !== undefined) return { nsId: INTERNAL_NS_ID, id: existing };
        const id = this.insertIntoTypeTable(typeTable, { type, indexKey: key });
        return { nsId: INTERNAL_NS_ID, id };
    }

    private addDeclarations(shell: GirNamespace): void {
        const nsId = shell.id;
        for (const value of shell.classes) this.addType(nsId, value.name, { kind: "class", namespace: shell, value });
        for (const value of shell.interfaces) {
            this.addType(nsId, value.name, { kind: "interface", namespace: shell, value });
        }
        for (const value of shell.records) this.addType(nsId, value.name, { kind: "record", namespace: shell, value });
        for (const value of shell.enums) this.addType(nsId, value.name, { kind: "enum", namespace: shell, value });
        for (const value of shell.callbacks) {
            this.addType(nsId, value.name, { kind: "callback", namespace: shell, value });
        }
        for (const alias of shell.aliases) {
            this.addType(nsId, alias.name, { kind: "alias", namespace: shell, value: alias });
        }
    }

    typeOf(tid: TypeId): GirType | undefined {
        return this.typeTables[tid.nsId]?.types[tid.id];
    }

    nameOf(tid: TypeId): { namespaceName: string; typeName: string } | undefined {
        const typeName = this.typeTables[tid.nsId]?.names[tid.id];
        const namespaceName = this.nsNameById[tid.nsId];
        if (typeName === undefined || namespaceName === undefined) return undefined;
        return { namespaceName, typeName };
    }

    resolveType(currentNamespaceName: string, name: string): GirType | undefined {
        const currentNsId = this.nsIdByName.get(currentNamespaceName);
        if (currentNsId === undefined) return undefined;
        const [namespaceName, localName] = splitOptionalNamespace(name);
        const targetNsId = namespaceName === undefined ? currentNsId : this.nsIdByName.get(namespaceName);
        if (targetNsId === undefined) return undefined;
        const id = this.typeTableOf(targetNsId).index.get(localName);
        if (id === undefined) return undefined;
        return this.typeTableOf(targetNsId).types[id];
    }

    private static drive(library: Library, libraries: string[], girPath: string[]): void {
        const queue: string[] = [...libraries];
        const seen = new Set<string>();
        const discovered: { header: NamespaceHeader; shell: GirNamespace }[] = [];
        const girFiles: string[] = [];
        while (queue.length > 0) {
            const identifier = queue.shift();
            if (identifier === undefined) continue;
            const namespaceName = identifier.split("-")[0] ?? identifier;
            if (seen.has(namespaceName)) continue;
            seen.add(namespaceName);
            const path = locateGirFile(identifier, girPath);
            girFiles.push(path);
            const repositoryNode = readRepositoryNode(path);
            const header = parseNamespaceHeader(repositoryNode);
            const shell = library.registerNamespace(header);
            discovered.push({ header, shell });
            for (const include of header.includes) {
                queue.push(`${include.name}-${include.version}`);
            }
        }
        for (const { header, shell } of discovered) {
            populateNamespaceBody(shell, header.namespaceNode, library.parseContext(shell.id));
        }
        for (const { shell } of discovered) {
            library.addDeclarations(shell);
        }
        library.girFilesValue = girFiles;
    }

    static load(libraries: string[], girPath: string[]): Library {
        const library = new Library();
        Library.drive(library, libraries, girPath);
        return library;
    }
}

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
        if (existsSync(candidate)) return candidate;
    }
    const tried = girPath.map((directory) => join(directory, filename)).join(", ");
    throw new Error(`GIR file ${filename} not found on girPath. Tried: ${tried}`);
};
