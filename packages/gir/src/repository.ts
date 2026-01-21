/**
 * GIR Repository - Central entry point for GIR data.
 *
 * Loads, normalizes, and provides query access to GIR namespaces.
 * All type references are normalized to fully qualified names.
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { type NormalizerContext, normalizeNamespace } from "./internal/normalizer.js";
import { type ParserOptions, RawGirParser } from "./internal/parser.js";
import type { RawNamespace } from "./internal/raw-types.js";
import { isIntrinsicType } from "./intrinsics.js";
import {
    type GirAlias,
    type GirCallback,
    type GirClass,
    type GirConstant,
    type GirEnumeration,
    type GirFunction,
    type GirInterface,
    type GirNamespace,
    type GirRecord,
    type GirType,
    parseQualifiedName,
    type QualifiedName,
    type TypeKind,
} from "./types.js";

/**
 * Central repository for GIR data.
 *
 * Loads, normalizes, and provides query access to GIR namespaces.
 * All type references are normalized to fully qualified names.
 *
 * @example
 * ```typescript
 * const repo = new GirRepository();
 * await repo.loadFromDirectory("./girs");
 * repo.resolve();
 *
 * const gtkNs = repo.getNamespace("Gtk");
 * const buttonClass = repo.resolveClass("Gtk.Button");
 * const chain = buttonClass.getInheritanceChain();
 * // ["Gtk.Button", "Gtk.Widget", "GObject.InitiallyUnowned", "GObject.Object"]
 * ```
 */
export type RepositoryOptions = ParserOptions;

export class GirRepository {
    private rawNamespaces = new Map<string, RawNamespace>();
    private normalizedNamespaces = new Map<string, GirNamespace>();
    private parser: RawGirParser;
    private resolved = false;

    constructor(options: RepositoryOptions = {}) {
        this.parser = new RawGirParser(options);
    }

    /**
     * Loads a single GIR file from XML content.
     */
    loadFromXml(xml: string): void {
        const raw = this.parser.parse(xml);
        this.rawNamespaces.set(raw.name, raw);
        this.resolved = false;
    }

    /**
     * Loads a GIR file from disk.
     */
    async loadFromFile(path: string): Promise<void> {
        const xml = await readFile(path, "utf-8");
        this.loadFromXml(xml);
    }

    /**
     * Loads all .gir files from a directory.
     */
    async loadFromDirectory(dirPath: string): Promise<void> {
        const files = await readdir(dirPath);
        const girFiles = files.filter((f) => f.endsWith(".gir"));

        await Promise.all(girFiles.map((file) => this.loadFromFile(join(dirPath, file))));
    }

    /**
     * After loading all raw GIR files, normalize and resolve all references.
     * This must be called after loading and before querying.
     */
    resolve(): void {
        if (this.resolved) return;

        const ctx: NormalizerContext = {
            rawNamespaces: this.rawNamespaces,
        };

        for (const [name, raw] of this.rawNamespaces) {
            const normalized = normalizeNamespace(raw, ctx);
            this.normalizedNamespaces.set(name, normalized);
        }

        for (const ns of this.normalizedNamespaces.values()) {
            for (const cls of ns.classes.values()) {
                cls._setRepository(this);
            }
            for (const iface of ns.interfaces.values()) {
                iface._setRepository(this);
            }
        }

        this.resolved = true;
    }

    /**
     * Gets all loaded namespace names.
     */
    getNamespaceNames(): string[] {
        this.ensureResolved();
        return [...this.normalizedNamespaces.keys()];
    }

    /**
     * Gets a normalized namespace by name.
     */
    getNamespace(name: string): GirNamespace | null {
        this.ensureResolved();
        return this.normalizedNamespaces.get(name) ?? null;
    }

    /**
     * Gets all normalized namespaces.
     */
    getAllNamespaces(): Map<string, GirNamespace> {
        this.ensureResolved();
        return this.normalizedNamespaces;
    }

    /**
     * Resolves a class by qualified name.
     * @example repo.resolveClass("Gtk.Button" as QualifiedName)
     */
    resolveClass(qualifiedName: QualifiedName): GirClass | null {
        this.ensureResolved();
        const { namespace, name } = parseQualifiedName(qualifiedName);
        return this.normalizedNamespaces.get(namespace)?.classes.get(name) ?? null;
    }

    /**
     * Resolves an interface by qualified name.
     * @example repo.resolveInterface("Gio.ListModel" as QualifiedName)
     */
    resolveInterface(qualifiedName: QualifiedName): GirInterface | null {
        this.ensureResolved();
        const { namespace, name } = parseQualifiedName(qualifiedName);
        return this.normalizedNamespaces.get(namespace)?.interfaces.get(name) ?? null;
    }

    /**
     * Resolves a record (boxed type) by qualified name.
     * @example repo.resolveRecord("Gdk.Rectangle" as QualifiedName)
     */
    resolveRecord(qualifiedName: QualifiedName): GirRecord | null {
        this.ensureResolved();
        const { namespace, name } = parseQualifiedName(qualifiedName);
        return this.normalizedNamespaces.get(namespace)?.records.get(name) ?? null;
    }

    /**
     * Resolves an enumeration by qualified name.
     * @example repo.resolveEnum("Gtk.Orientation" as QualifiedName)
     */
    resolveEnum(qualifiedName: QualifiedName): GirEnumeration | null {
        this.ensureResolved();
        const { namespace, name } = parseQualifiedName(qualifiedName);
        return this.normalizedNamespaces.get(namespace)?.enumerations.get(name) ?? null;
    }

    /**
     * Resolves a bitfield (flags) by qualified name.
     * @example repo.resolveFlags("Gdk.ModifierType" as QualifiedName)
     */
    resolveFlags(qualifiedName: QualifiedName): GirEnumeration | null {
        this.ensureResolved();
        const { namespace, name } = parseQualifiedName(qualifiedName);
        return this.normalizedNamespaces.get(namespace)?.bitfields.get(name) ?? null;
    }

    /**
     * Resolves a callback type by qualified name.
     * @example repo.resolveCallback("Gio.AsyncReadyCallback" as QualifiedName)
     */
    resolveCallback(qualifiedName: QualifiedName): GirCallback | null {
        this.ensureResolved();
        const { namespace, name } = parseQualifiedName(qualifiedName);
        return this.normalizedNamespaces.get(namespace)?.callbacks.get(name) ?? null;
    }

    /**
     * Resolves a constant by qualified name.
     * @example repo.resolveConstant("Gtk.MAJOR_VERSION" as QualifiedName)
     */
    resolveConstant(qualifiedName: QualifiedName): GirConstant | null {
        this.ensureResolved();
        const { namespace, name } = parseQualifiedName(qualifiedName);
        return this.normalizedNamespaces.get(namespace)?.constants.get(name) ?? null;
    }

    /**
     * Resolves a standalone function by qualified name.
     * @example repo.resolveFunction("Gtk.init" as QualifiedName)
     */
    resolveFunction(qualifiedName: QualifiedName): GirFunction | null {
        this.ensureResolved();
        const { namespace, name } = parseQualifiedName(qualifiedName);
        return this.normalizedNamespaces.get(namespace)?.functions.get(name) ?? null;
    }

    /**
     * Resolves an alias by qualified name.
     * @example repo.resolveAlias("Pango.LayoutRun" as QualifiedName)
     */
    resolveAlias(qualifiedName: QualifiedName): GirAlias | null {
        this.ensureResolved();
        const { namespace, name } = parseQualifiedName(qualifiedName);
        return this.normalizedNamespaces.get(namespace)?.aliases.get(name) ?? null;
    }

    /**
     * Resolves a type name through aliases to get the target type.
     * If the type is an alias, returns the target type.
     * If not an alias, returns null.
     * @example repo.resolveTypeAlias("Pango.LayoutRun" as QualifiedName) // returns GirType pointing to Pango.GlyphItem
     */
    resolveTypeAlias(qualifiedName: QualifiedName): GirType | null {
        const alias = this.resolveAlias(qualifiedName);
        return alias?.targetType ?? null;
    }

    /**
     * Gets the kind of a type (class, interface, record, enum, flags, callback).
     * Returns null for intrinsic types or unknown types.
     */
    getTypeKind(qualifiedName: QualifiedName): TypeKind | null {
        this.ensureResolved();

        if (isIntrinsicType(qualifiedName)) {
            return null;
        }

        const { namespace, name } = parseQualifiedName(qualifiedName);
        const ns = this.normalizedNamespaces.get(namespace);
        if (!ns) return null;

        if (ns.classes.has(name)) return "class";
        if (ns.interfaces.has(name)) return "interface";
        if (ns.records.has(name)) return "record";
        if (ns.enumerations.has(name)) return "enum";
        if (ns.bitfields.has(name)) return "flags";
        if (ns.callbacks.has(name)) return "callback";

        return null;
    }

    /**
     * Gets the full inheritance chain for a class.
     * Returns array from most derived to base.
     *
     * @example
     * getInheritanceChain("Gtk.Button" as QualifiedName)
     * // ["Gtk.Button", "Gtk.Widget", "GObject.InitiallyUnowned", "GObject.Object"]
     */
    getInheritanceChain(qualifiedName: QualifiedName): QualifiedName[] {
        const cls = this.resolveClass(qualifiedName);
        return cls?.getInheritanceChain() ?? [];
    }

    /**
     * Gets all interfaces implemented by a class (including inherited).
     */
    getImplementedInterfaces(qualifiedName: QualifiedName): QualifiedName[] {
        const cls = this.resolveClass(qualifiedName);
        return cls?.getAllImplementedInterfaces() ?? [];
    }

    /**
     * Gets all classes that derive from a given class.
     */
    getDerivedClasses(qualifiedName: QualifiedName): QualifiedName[] {
        this.ensureResolved();
        const derived: QualifiedName[] = [];

        for (const ns of this.normalizedNamespaces.values()) {
            for (const cls of ns.classes.values()) {
                if (cls.qualifiedName !== qualifiedName && cls.isSubclassOf(qualifiedName)) {
                    derived.push(cls.qualifiedName);
                }
            }
        }

        return derived;
    }

    /**
     * Gets all classes that implement a given interface.
     */
    getImplementors(interfaceName: QualifiedName): QualifiedName[] {
        this.ensureResolved();
        const implementors: QualifiedName[] = [];

        for (const ns of this.normalizedNamespaces.values()) {
            for (const cls of ns.classes.values()) {
                if (cls.implementsInterface(interfaceName)) {
                    implementors.push(cls.qualifiedName);
                }
            }
        }

        return implementors;
    }

    /**
     * Checks if a type is a GObject (class with GType).
     */
    isGObject(qualifiedName: QualifiedName): boolean {
        const cls = this.resolveClass(qualifiedName);
        return cls?.hasGType() ?? false;
    }

    /**
     * Checks if a type is a boxed type (record with GType).
     */
    isBoxed(qualifiedName: QualifiedName): boolean {
        const record = this.resolveRecord(qualifiedName);
        return record?.isBoxed() ?? false;
    }

    /**
     * Checks if a type is a primitive (intrinsic).
     */
    isPrimitive(typeName: string): boolean {
        return isIntrinsicType(typeName);
    }

    /**
     * Finds all classes matching a predicate across all namespaces.
     */
    findClasses(predicate: (cls: GirClass) => boolean): GirClass[] {
        this.ensureResolved();
        const results: GirClass[] = [];

        for (const ns of this.normalizedNamespaces.values()) {
            for (const cls of ns.classes.values()) {
                if (predicate(cls)) {
                    results.push(cls);
                }
            }
        }

        return results;
    }

    /**
     * Finds all interfaces matching a predicate across all namespaces.
     */
    findInterfaces(predicate: (iface: GirInterface) => boolean): GirInterface[] {
        this.ensureResolved();
        const results: GirInterface[] = [];

        for (const ns of this.normalizedNamespaces.values()) {
            for (const iface of ns.interfaces.values()) {
                if (predicate(iface)) {
                    results.push(iface);
                }
            }
        }

        return results;
    }

    /**
     * Finds all records matching a predicate across all namespaces.
     */
    findRecords(predicate: (record: GirRecord) => boolean): GirRecord[] {
        this.ensureResolved();
        const results: GirRecord[] = [];

        for (const ns of this.normalizedNamespaces.values()) {
            for (const record of ns.records.values()) {
                if (predicate(record)) {
                    results.push(record);
                }
            }
        }

        return results;
    }

    private ensureResolved(): void {
        if (!this.resolved) {
            throw new Error(
                "GirRepository.resolve() must be called before querying. Call resolve() after loading all GIR files.",
            );
        }
    }
}
