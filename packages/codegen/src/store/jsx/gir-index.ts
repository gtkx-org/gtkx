import type { GirClass } from "../../gir/class.js";
import type { Library } from "../../gir/library.js";
import type { GirNamespace } from "../../gir/namespace.js";
import { ancestorChain } from "../../gir/ancestry.js";
import { getGlibName, implementedInterfaces } from "./intrinsic-elements.js";

type GirTypeEntry = {
    klass: GirClass;
    namespace: GirNamespace;
    isInterface: boolean;
};

type GirIndex = {
    library: Library;
    index: Map<string, GirTypeEntry>;
};

const indexClasses = (
    index: Map<string, GirTypeEntry>,
    classes: Iterable<GirClass>,
    namespace: GirNamespace,
    isInterface: boolean,
): void => {
    for (const klass of classes) {
        const glibName = getGlibName(klass);

        if (glibName !== undefined && !index.has(glibName)) {
            index.set(glibName, { klass, namespace, isInterface });
        }
    }
};

const buildGirIndex = (library: Library): GirIndex => {
    const index: Map<string, GirTypeEntry> = new Map();

    for (const namespace of library.namespaces.values()) {
        indexClasses(index, namespace.classes, namespace, false);
        indexClasses(index, namespace.interfaces, namespace, true);
    }

    return { library, index };
};

const getChain = (context: GirIndex, entry: GirTypeEntry): GirClass[] => {
    if (entry.isInterface) {
        return [entry.klass];
    }

    const chain: GirClass[] = [];

    for (const { klass } of ancestorChain(context.library, entry.klass, entry.namespace.name)) {
        chain.push(klass);
    }

    for (const iface of implementedInterfaces(entry.klass, entry.namespace, context.library)) {
        chain.push(iface.klass);
    }

    return chain;
};

export { buildGirIndex, getChain, type GirTypeEntry, type GirIndex };
