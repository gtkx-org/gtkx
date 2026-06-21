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

type Arena = {
    types: (GirType | undefined)[];
    names: (string | undefined)[];
    index: Map<string, number>;
};

export class GirRepository {
    private namespacesByName = new Map<string, GirNamespace>();
    private namespaceById: (GirNamespace | undefined)[] = [];
    private nsNameById: string[] = [];
    private nsIdByName = new Map<string, number>();
    private arenas: Arena[] = [];
    private girFilesValue: string[] = [];

    public get namespaces(): Map<string, GirNamespace> {
        return this.namespacesByName;
    }

    public get girFiles(): string[] {
        return this.girFilesValue;
    }

    constructor() {
        this.arenas[INTERNAL_NS_ID] = { types: [], names: [], index: new Map() };
        this.namespaceById[INTERNAL_NS_ID] = undefined;
        this.nsNameById[INTERNAL_NS_ID] = "$internal";
    }

    private ensureNsId(name: string): number {
        const existing = this.nsIdByName.get(name);
        if (existing !== undefined) return existing;
        const nsId = this.arenas.length;
        this.arenas[nsId] = { types: [], names: [], index: new Map() };
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
            throw new Error(`No namespace registered for arena id ${nsId}`);
        }
        return namespace;
    }

    private arenaOf(nsId: number): Arena {
        const arena = this.arenas[nsId];
        if (arena === undefined) {
            throw new Error(`No arena for namespace id ${nsId}`);
        }
        return arena;
    }

    private insertIntoArena(
        arena: Arena,
        slot: { type: GirType | undefined; indexKey?: string; displayName?: string },
    ): number {
        const id = arena.types.length;
        arena.types.push(slot.type);
        arena.names.push(slot.displayName);
        if (slot.indexKey !== undefined) arena.index.set(slot.indexKey, id);
        return id;
    }

    private setType(nsId: number, name: string, type: GirType): void {
        const arena = this.arenaOf(nsId);
        const existing = arena.index.get(name);
        if (existing !== undefined) {
            arena.types[existing] = type;
            return;
        }
        this.insertIntoArena(arena, { type, indexKey: name, displayName: name });
    }

    private stubNamed(nsId: number, name: string): TypeId {
        const arena = this.arenaOf(nsId);
        const existing = arena.index.get(name);
        if (existing !== undefined) return { nsId, id: existing };
        const id = this.insertIntoArena(arena, { type: undefined, indexKey: name, displayName: name });
        return { nsId, id };
    }

    private pushAnonymous(nsId: number, type: GirType): TypeId {
        const arena = this.arenaOf(nsId);
        const id = this.insertIntoArena(arena, { type });
        return { nsId, id };
    }

    private findOrStubType(currentNsId: number, name: string): TypeId {
        const [namespaceName, localName] = splitOptionalNamespace(name);
        const targetNsId = namespaceName === undefined ? currentNsId : this.ensureNsId(namespaceName);
        return this.stubNamed(targetNsId, localName);
    }

    private parseContext(nsId: number): ParseContext {
        const context: ParseContext = {
            nsId,
            findOrStubType: (name) => this.findOrStubType(nsId, name),
            internPrimitive: (category) => this.internPrimitive(category),
            internVarargs: () => this.internVarargs(),
            internContainer: (type: CArrayType | GListType | GHashTableType) => this.pushAnonymous(nsId, type),
            internInlineCallback: (node) =>
                this.pushAnonymous(nsId, {
                    kind: "callback",
                    namespace: this.namespaceOf(nsId),
                    value: callbackFromNode(node, context),
                }),
        };
        return context;
    }

    private internPrimitive(category: PrimitiveCategory): TypeId {
        return this.internInternal(`primitive:${category}`, { kind: "primitive", category });
    }

    private internVarargs(): TypeId {
        return this.internInternal("varargs", { kind: "varargs" });
    }

    private internInternal(key: string, type: GirType): TypeId {
        const arena = this.arenaOf(INTERNAL_NS_ID);
        const existing = arena.index.get(key);
        if (existing !== undefined) return { nsId: INTERNAL_NS_ID, id: existing };
        const id = this.insertIntoArena(arena, { type, indexKey: key });
        return { nsId: INTERNAL_NS_ID, id };
    }

    private internDeclarations(shell: GirNamespace): void {
        const nsId = shell.id;
        for (const value of shell.classes) this.setType(nsId, value.name, { kind: "class", namespace: shell, value });
        for (const value of shell.interfaces) {
            this.setType(nsId, value.name, { kind: "interface", namespace: shell, value });
        }
        for (const value of shell.boxeds) this.setType(nsId, value.name, { kind: "boxed", namespace: shell, value });
        for (const value of shell.enums) this.setType(nsId, value.name, { kind: "enum", namespace: shell, value });
        for (const value of shell.callbacks) {
            this.setType(nsId, value.name, { kind: "callback", namespace: shell, value });
        }
        for (const alias of shell.aliases) {
            this.setType(nsId, alias.name, {
                kind: "alias",
                namespace: shell,
                target: alias.target,
                targetCType: alias.targetCType,
            });
        }
    }

    typeOf(tid: TypeId): GirType | undefined {
        return this.arenas[tid.nsId]?.types[tid.id];
    }

    nameOf(tid: TypeId): { namespaceName: string; typeName: string } | undefined {
        const typeName = this.arenas[tid.nsId]?.names[tid.id];
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
        const id = this.arenaOf(targetNsId).index.get(localName);
        if (id === undefined) return undefined;
        return this.arenaOf(targetNsId).types[id];
    }

    resolveNamed(namespaceName: string, typeName: string): GirType | undefined {
        const nsId = this.nsIdByName.get(namespaceName);
        if (nsId === undefined) return undefined;
        const id = this.arenaOf(nsId).index.get(typeName);
        if (id === undefined) return undefined;
        return this.arenaOf(nsId).types[id];
    }

    collectUnresolved(): string[] {
        const unresolved: string[] = [];
        for (const [name, nsId] of this.nsIdByName) {
            const arena = this.arenaOf(nsId);
            for (const [local, id] of arena.index) {
                if (arena.types[id] === undefined) unresolved.push(`${name}.${local}`);
            }
        }
        return unresolved;
    }

    private static drive(repository: GirRepository, libraries: string[], girPath: string[]): void {
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
            const shell = repository.registerNamespace(header);
            discovered.push({ header, shell });
            for (const include of header.includes) {
                queue.push(`${include.name}-${include.version}`);
            }
        }
        for (const { header, shell } of discovered) {
            populateNamespaceBody(shell, header.namespaceNode, repository.parseContext(shell.id));
        }
        for (const { shell } of discovered) {
            repository.internDeclarations(shell);
        }
        repository.girFilesValue = girFiles;
    }

    static load(libraries: string[], girPath: string[]): GirRepository {
        const repository = new GirRepository();
        GirRepository.drive(repository, libraries, girPath);
        return repository;
    }
}

const readRepositoryNode = (path: string): RawNode => {
    const root = parseGirFile(path);
    const repository = root["repository"];
    if (typeof repository !== "object" || repository === null) {
        throw new Error(`GIR file at ${path} has no <repository> root`);
    }
    return repository as RawNode;
};

export const loadGirRepository = (libraries: string[], girPath: string[]): GirRepository =>
    GirRepository.load(libraries, girPath);

const locateGirFile = (identifier: string, girPath: string[]): string => {
    const filename = `${identifier}.gir`;
    for (const directory of girPath) {
        const candidate = join(directory, filename);
        if (existsSync(candidate)) return candidate;
    }
    const tried = girPath.map((directory) => join(directory, filename)).join(", ");
    throw new Error(`GIR file ${filename} not found on girPath. Tried: ${tried}`);
};
