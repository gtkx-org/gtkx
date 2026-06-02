import { existsSync } from "node:fs";
import { join } from "node:path";
import type { GirBoxed } from "./boxed.js";
import type { GirCallback } from "./callback.js";
import type { GirClass } from "./class.js";
import type { GirEnum } from "./enum.js";
import { type GirNamespace, namespaceFromRepository } from "./namespace.js";
import { parseGirFile } from "./parse.js";
import type { GirTypeRef } from "./type-ref.js";

/**
 * Resolved entity that a {@link GirRepository.resolveNamed} call returns.
 *
 * Wraps the matching entity along with the namespace it lives in, so
 * writers can pull the namespace identifier or shared library name without
 * a second lookup.
 */
export type ResolvedNamed =
    | { readonly kind: "class"; readonly namespace: GirNamespace; readonly value: GirClass }
    | { readonly kind: "interface"; readonly namespace: GirNamespace; readonly value: GirClass }
    | { readonly kind: "boxed"; readonly namespace: GirNamespace; readonly value: GirBoxed }
    | { readonly kind: "enum"; readonly namespace: GirNamespace; readonly value: GirEnum }
    | { readonly kind: "callback"; readonly namespace: GirNamespace; readonly value: GirCallback }
    | {
          readonly kind: "alias";
          readonly namespace: GirNamespace;
          readonly target: string | undefined;
          readonly targetRef: GirTypeRef | undefined;
      };

/**
 * In-memory database of every loaded GIR namespace, indexed by name.
 *
 * Construct via {@link loadGirRepository}; the public API after that is the
 * `namespaces` map and {@link resolveNamed} for cross-namespace lookups.
 */
export class GirRepository {
    /** Namespaces keyed by their unqualified name (e.g. `"Gtk"`, `"GLib"`). */
    public readonly namespaces: ReadonlyMap<string, GirNamespace>;
    /** Absolute paths of every `.gir` file loaded, for staleness fingerprinting. */
    public readonly girFiles: readonly string[];
    private readonly entityIndex: Map<string, ResolvedNamed>;

    /**
     * Constructs a repository from the supplied namespace map.
     *
     * Callers should prefer {@link loadGirRepository} which discovers and
     * parses files for you.
     *
     * @param namespaces - Namespaces keyed by unqualified name
     * @param girFiles - Absolute paths of the `.gir` files the namespaces came from
     */
    constructor(namespaces: ReadonlyMap<string, GirNamespace>, girFiles: readonly string[] = []) {
        this.namespaces = namespaces;
        this.girFiles = girFiles;
        this.entityIndex = new Map();
        for (const namespace of namespaces.values()) {
            indexNamespace(this.entityIndex, namespace);
        }
    }

    /**
     * Looks up a type by `(namespace, name)`. Aliases are followed one step
     * to their target. Returns `undefined` when neither the namespace nor a
     * matching entity exists.
     *
     * @param namespaceName - Namespace to look in (e.g. `"GLib"`)
     * @param typeName - Local type name within the namespace (e.g. `"Variant"`)
     */
    resolveNamed(namespaceName: string, typeName: string): ResolvedNamed | undefined {
        const key = entityKey(namespaceName, typeName);
        const direct = this.entityIndex.get(key);
        if (direct !== undefined) return direct;
        return undefined;
    }
}

const entityKey = (namespaceName: string, typeName: string): string => `${namespaceName}.${typeName}`;

const indexNamespace = (index: Map<string, ResolvedNamed>, namespace: GirNamespace): void => {
    for (const value of namespace.classes) {
        index.set(entityKey(namespace.name, value.name), { kind: "class", namespace, value });
    }
    for (const value of namespace.interfaces) {
        index.set(entityKey(namespace.name, value.name), { kind: "interface", namespace, value });
    }
    for (const value of namespace.boxeds) {
        index.set(entityKey(namespace.name, value.name), { kind: "boxed", namespace, value });
    }
    for (const value of namespace.enums) {
        index.set(entityKey(namespace.name, value.name), { kind: "enum", namespace, value });
    }
    for (const value of namespace.callbacks) {
        index.set(entityKey(namespace.name, value.name), { kind: "callback", namespace, value });
    }
    for (const alias of namespace.aliases) {
        const target = alias.target?.kind === "named" ? alias.target.typeName : undefined;
        index.set(entityKey(namespace.name, alias.name), {
            kind: "alias",
            namespace,
            target,
            targetRef: alias.target,
        });
    }
};

/**
 * Discovers and parses every GIR file needed to satisfy `libraries` and
 * their transitive `<include>` dependencies.
 *
 * @param libraries - Resolved `Name-Version` namespace identifiers
 * @param girPath - Ordered list of directories to search for `.gir` files
 * @returns A populated {@link GirRepository}
 * @throws If any required GIR file cannot be located on `girPath`
 */
export const loadGirRepository = (libraries: readonly string[], girPath: readonly string[]): GirRepository => {
    const namespaces = new Map<string, GirNamespace>();
    const girFiles: string[] = [];
    const queue: string[] = [...libraries];
    while (queue.length > 0) {
        const identifier = queue.shift();
        if (identifier === undefined) continue;
        const namespaceName = identifier.split("-")[0] ?? identifier;
        if (namespaces.has(namespaceName)) continue;
        const path = locateGirFile(identifier, girPath);
        girFiles.push(path);
        const root = parseGirFile(path);
        const repository = root.repository;
        if (typeof repository !== "object" || repository === null) {
            throw new Error(`GIR file at ${path} has no <repository> root`);
        }
        const namespace = namespaceFromRepository(repository as Record<string, unknown>);
        namespaces.set(namespace.name, namespace);
        for (const include of namespace.includes) {
            queue.push(`${include.name}-${include.version}`);
        }
    }
    return new GirRepository(namespaces, girFiles);
};

const locateGirFile = (identifier: string, girPath: readonly string[]): string => {
    const filename = `${identifier}.gir`;
    for (const directory of girPath) {
        const candidate = join(directory, filename);
        if (existsSync(candidate)) return candidate;
    }
    const tried = girPath.map((directory) => join(directory, filename)).join(", ");
    throw new Error(`GIR file ${filename} not found on girPath. Tried: ${tried}`);
};
