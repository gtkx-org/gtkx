import type {
    NormalizedCallback,
    NormalizedClass,
    NormalizedConstant,
    NormalizedEnumeration,
    NormalizedFunction,
    NormalizedInterface,
    NormalizedNamespace,
    NormalizedRecord,
    QualifiedName,
    TypeKind,
} from "@gtkx/gir";
import { parseQualifiedName } from "@gtkx/gir";

export interface MockGirRepository {
    getNamespace(name: string): NormalizedNamespace | null;
    getNamespaceNames(): string[];
    getAllNamespaces(): Map<string, NormalizedNamespace>;
    resolveClass(qualifiedName: QualifiedName): NormalizedClass | null;
    resolveInterface(qualifiedName: QualifiedName): NormalizedInterface | null;
    resolveRecord(qualifiedName: QualifiedName): NormalizedRecord | null;
    resolveEnum(qualifiedName: QualifiedName): NormalizedEnumeration | null;
    resolveFlags(qualifiedName: QualifiedName): NormalizedEnumeration | null;
    resolveCallback(qualifiedName: QualifiedName): NormalizedCallback | null;
    resolveConstant(qualifiedName: QualifiedName): NormalizedConstant | null;
    resolveFunction(qualifiedName: QualifiedName): NormalizedFunction | null;
    getTypeKind(qualifiedName: QualifiedName): TypeKind | null;
    getInheritanceChain(qualifiedName: QualifiedName): QualifiedName[];
    getImplementedInterfaces(qualifiedName: QualifiedName): QualifiedName[];
    getDerivedClasses(qualifiedName: QualifiedName): QualifiedName[];
    getImplementors(interfaceName: QualifiedName): QualifiedName[];
    isGObject(qualifiedName: QualifiedName): boolean;
    isBoxed(qualifiedName: QualifiedName): boolean;
    isPrimitive(typeName: string): boolean;
    findClasses(predicate: (cls: NormalizedClass) => boolean): NormalizedClass[];
}

export function createMockRepository(namespaces: Map<string, NormalizedNamespace> = new Map()): MockGirRepository {
    const repo: MockGirRepository = {
        getNamespace(name: string): NormalizedNamespace | null {
            return namespaces.get(name) ?? null;
        },

        getNamespaceNames(): string[] {
            return [...namespaces.keys()];
        },

        getAllNamespaces(): Map<string, NormalizedNamespace> {
            return namespaces;
        },

        resolveClass(qn: QualifiedName): NormalizedClass | null {
            const { namespace, name } = parseQualifiedName(qn);
            return namespaces.get(namespace)?.classes.get(name) ?? null;
        },

        resolveInterface(qn: QualifiedName): NormalizedInterface | null {
            const { namespace, name } = parseQualifiedName(qn);
            return namespaces.get(namespace)?.interfaces.get(name) ?? null;
        },

        resolveRecord(qn: QualifiedName): NormalizedRecord | null {
            const { namespace, name } = parseQualifiedName(qn);
            return namespaces.get(namespace)?.records.get(name) ?? null;
        },

        resolveEnum(qn: QualifiedName): NormalizedEnumeration | null {
            const { namespace, name } = parseQualifiedName(qn);
            return namespaces.get(namespace)?.enumerations.get(name) ?? null;
        },

        resolveFlags(qn: QualifiedName): NormalizedEnumeration | null {
            const { namespace, name } = parseQualifiedName(qn);
            return namespaces.get(namespace)?.bitfields.get(name) ?? null;
        },

        resolveCallback(qn: QualifiedName): NormalizedCallback | null {
            const { namespace, name } = parseQualifiedName(qn);
            return namespaces.get(namespace)?.callbacks.get(name) ?? null;
        },

        resolveConstant(qn: QualifiedName): NormalizedConstant | null {
            const { namespace, name } = parseQualifiedName(qn);
            return namespaces.get(namespace)?.constants.get(name) ?? null;
        },

        resolveFunction(qn: QualifiedName): NormalizedFunction | null {
            const { namespace, name } = parseQualifiedName(qn);
            return namespaces.get(namespace)?.functions.get(name) ?? null;
        },

        getTypeKind(qn: QualifiedName): TypeKind | null {
            const { namespace, name } = parseQualifiedName(qn);
            const ns = namespaces.get(namespace);
            if (!ns) return null;

            if (ns.classes.has(name)) return "class";
            if (ns.interfaces.has(name)) return "interface";
            if (ns.records.has(name)) return "record";
            if (ns.enumerations.has(name)) return "enum";
            if (ns.bitfields.has(name)) return "flags";
            if (ns.callbacks.has(name)) return "callback";

            return null;
        },

        getInheritanceChain(qn: QualifiedName): QualifiedName[] {
            const cls = repo.resolveClass(qn);
            return cls?.getInheritanceChain() ?? [];
        },

        getImplementedInterfaces(qn: QualifiedName): QualifiedName[] {
            const cls = repo.resolveClass(qn);
            return cls?.getAllImplementedInterfaces() ?? [];
        },

        getDerivedClasses(qn: QualifiedName): QualifiedName[] {
            const derived: QualifiedName[] = [];
            for (const ns of namespaces.values()) {
                for (const cls of ns.classes.values()) {
                    if (cls.qualifiedName !== qn && cls.isSubclassOf(qn)) {
                        derived.push(cls.qualifiedName);
                    }
                }
            }
            return derived;
        },

        getImplementors(interfaceName: QualifiedName): QualifiedName[] {
            const implementors: QualifiedName[] = [];
            for (const ns of namespaces.values()) {
                for (const cls of ns.classes.values()) {
                    if (cls.implementsInterface(interfaceName)) {
                        implementors.push(cls.qualifiedName);
                    }
                }
            }
            return implementors;
        },

        isGObject(qn: QualifiedName): boolean {
            const cls = repo.resolveClass(qn);
            return cls?.hasGType() ?? false;
        },

        isBoxed(qn: QualifiedName): boolean {
            const record = repo.resolveRecord(qn);
            return record?.isBoxed() ?? false;
        },

        isPrimitive(typeName: string): boolean {
            const primitives = new Set([
                "gint",
                "guint",
                "gint8",
                "guint8",
                "gint16",
                "guint16",
                "gint32",
                "guint32",
                "gint64",
                "guint64",
                "gfloat",
                "gdouble",
                "gboolean",
                "gchar",
                "guchar",
                "gshort",
                "gushort",
                "glong",
                "gulong",
                "gsize",
                "gssize",
                "gpointer",
                "gconstpointer",
                "utf8",
                "filename",
                "none",
            ]);
            return primitives.has(typeName);
        },

        findClasses(predicate: (cls: NormalizedClass) => boolean): NormalizedClass[] {
            const results: NormalizedClass[] = [];
            for (const ns of namespaces.values()) {
                for (const cls of ns.classes.values()) {
                    if (predicate(cls)) {
                        results.push(cls);
                    }
                }
            }
            return results;
        },
    };

    for (const ns of namespaces.values()) {
        for (const cls of ns.classes.values()) {
            cls._setRepository(repo as unknown as Parameters<typeof cls._setRepository>[0]);
        }
        for (const iface of ns.interfaces.values()) {
            iface._setRepository(repo as unknown as Parameters<typeof iface._setRepository>[0]);
        }
    }

    return repo;
}
