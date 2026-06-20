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

/** One namespace's interned type slots plus the name index over its entities. */
type Arena = {
    /** Slots in interning order; `undefined` marks an unresolved forward stub. */
    readonly types: (GirType | undefined)[];
    /** Local name of each named slot; `undefined` for anonymous container/callback slots. */
    readonly names: (string | undefined)[];
    /** Local entity name to slot id (anonymous container/callback slots are unindexed). */
    readonly index: Map<string, number>;
};

/**
 * In-memory database of every loaded GIR namespace plus the interned type arena
 * that backs reference resolution.
 *
 * Construct via {@link loadGirRepository}, which discovers and parses files.
 * Every `<type>` slot in the IR is a {@link TypeId} into this arena; resolve one
 * with {@link typeOf}. The namespace is baked into each handle at parse time, so
 * resolution is an array index with no namespace re-derivation.
 */
export class GirRepository {
    private readonly namespacesByName = new Map<string, GirNamespace>();
    private readonly namespaceById: (GirNamespace | undefined)[] = [];
    private readonly nsNameById: string[] = [];
    private readonly nsIdByName = new Map<string, number>();
    private readonly arenas: Arena[] = [];
    private girFilesValue: readonly string[] = [];

    /** Namespaces keyed by their unqualified name (e.g. `"Gtk"`, `"GLib"`). */
    public get namespaces(): ReadonlyMap<string, GirNamespace> {
        return this.namespacesByName;
    }

    /** Absolute paths of every `.gir` file loaded, for staleness fingerprinting. */
    public get girFiles(): readonly string[] {
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

    private setType(nsId: number, name: string, type: GirType): void {
        const arena = this.arenaOf(nsId);
        const existing = arena.index.get(name);
        if (existing !== undefined) {
            arena.types[existing] = type;
            return;
        }
        const id = arena.types.length;
        arena.types.push(type);
        arena.names.push(name);
        arena.index.set(name, id);
    }

    private stubNamed(nsId: number, name: string): TypeId {
        const arena = this.arenaOf(nsId);
        const existing = arena.index.get(name);
        if (existing !== undefined) return { nsId, id: existing };
        const id = arena.types.length;
        arena.types.push(undefined);
        arena.names.push(name);
        arena.index.set(name, id);
        return { nsId, id };
    }

    private pushAnonymous(nsId: number, type: GirType): TypeId {
        const arena = this.arenaOf(nsId);
        const id = arena.types.length;
        arena.types.push(type);
        arena.names.push(undefined);
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
        const id = arena.types.length;
        arena.types.push(type);
        arena.names.push(undefined);
        arena.index.set(key, id);
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

    /**
     * Resolves a {@link TypeId} handle to its interned type, or `undefined` when
     * the slot is an unresolved forward stub.
     *
     * @param tid - The handle to resolve
     */
    typeOf(tid: TypeId): GirType | undefined {
        return this.arenas[tid.nsId]?.types[tid.id];
    }

    /**
     * Recovers the namespace-qualified name a {@link TypeId} was interned under,
     * or `undefined` for an anonymous slot (a container or inline callback).
     *
     * Used to render an unresolved reference, an alias export name, or a named
     * callback, where the entity itself does not carry its own name.
     *
     * @param tid - The handle to name
     */
    nameOf(tid: TypeId): { readonly namespaceName: string; readonly typeName: string } | undefined {
        const typeName = this.arenas[tid.nsId]?.names[tid.id];
        const namespaceName = this.nsNameById[tid.nsId];
        if (typeName === undefined || namespaceName === undefined) return undefined;
        return { namespaceName, typeName };
    }

    /**
     * Resolves `name` (optionally `Namespace.Name`) against `currentNamespaceName`
     * to its interned type, mirroring the parse-time namespace fallback. Returns
     * `undefined` when the namespace is unknown or the name is undeclared.
     *
     * @param currentNamespaceName - The namespace unqualified names resolve against
     * @param name - The GIR identifier (e.g. `"Gtk.Widget"` or `"Widget"`)
     */
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

    /**
     * Looks up a local type name within an explicit namespace, returning the
     * interned type or `undefined` when neither the namespace nor the entity
     * exists. Aliases are not dereferenced.
     *
     * @param namespaceName - Namespace to look in (e.g. `"GLib"`)
     * @param typeName - Local type name within the namespace (e.g. `"Variant"`)
     */
    resolveNamed(namespaceName: string, typeName: string): GirType | undefined {
        const nsId = this.nsIdByName.get(namespaceName);
        if (nsId === undefined) return undefined;
        const id = this.arenaOf(nsId).index.get(typeName);
        if (id === undefined) return undefined;
        return this.arenaOf(nsId).types[id];
    }

    /**
     * Lists every named type slot left unresolved after loading — references to
     * types absent from the loaded closure. Empty when the closure is complete.
     */
    collectUnresolved(): readonly string[] {
        const unresolved: string[] = [];
        for (const [name, nsId] of this.nsIdByName) {
            const arena = this.arenaOf(nsId);
            for (const [local, id] of arena.index) {
                if (arena.types[id] === undefined) unresolved.push(`${name}.${local}`);
            }
        }
        return unresolved;
    }

    private static drive(repository: GirRepository, libraries: readonly string[], girPath: readonly string[]): void {
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

    /**
     * Discovers and parses every GIR file needed to satisfy `libraries` and their
     * transitive `<include>` dependencies, interning every type into the arena.
     *
     * @param libraries - Resolved `Name-Version` namespace identifiers
     * @param girPath - Ordered list of directories to search for `.gir` files
     * @returns A populated repository
     * @throws If any required GIR file cannot be located on `girPath`
     */
    static load(libraries: readonly string[], girPath: readonly string[]): GirRepository {
        const repository = new GirRepository();
        GirRepository.drive(repository, libraries, girPath);
        return repository;
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

/**
 * Discovers and parses every GIR file needed to satisfy `libraries` and their
 * transitive `<include>` dependencies.
 *
 * @param libraries - Resolved `Name-Version` namespace identifiers
 * @param girPath - Ordered list of directories to search for `.gir` files
 * @returns A populated {@link GirRepository}
 * @throws If any required GIR file cannot be located on `girPath`
 */
export const loadGirRepository = (libraries: readonly string[], girPath: readonly string[]): GirRepository =>
    GirRepository.load(libraries, girPath);

const locateGirFile = (identifier: string, girPath: readonly string[]): string => {
    const filename = `${identifier}.gir`;
    for (const directory of girPath) {
        const candidate = join(directory, filename);
        if (existsSync(candidate)) return candidate;
    }
    const tried = girPath.map((directory) => join(directory, filename)).join(", ");
    throw new Error(`GIR file ${filename} not found on girPath. Tried: ${tried}`);
};
