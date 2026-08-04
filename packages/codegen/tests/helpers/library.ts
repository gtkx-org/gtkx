import type { GirFunction } from "../../src/gir/function.js";
import { Library } from "../../src/gir/library.js";
import { type GirNamespace, namespaceDirectory } from "../../src/gir/namespace.js";
import { generateNamespaceModule } from "../../src/store/gi/pipeline.js";

type LocatedCallable = { namespace: GirNamespace; callable: GirFunction };

const library = Library.load(["Gtk-4.0", "Adw-1"], ["/usr/share/gir-1.0"]);

const giModules = library.namespaces
    .values()
    .map((namespace) => ({
        directory: namespaceDirectory(namespace),
        source: generateNamespaceModule(namespace, library),
    }))
    .toArray();

const namespaceCallables = (namespace: GirNamespace): GirFunction[] => {
    const owners = [...namespace.classes, ...namespace.interfaces, ...namespace.records];

    return [
        ...namespace.functions,
        ...owners.flatMap((owner) => [...owner.methods, ...owner.functions, ...owner.constructors]),
    ];
};

const locateCallable = (cIdentifier: string): LocatedCallable | undefined => {
    for (const namespace of library.namespaces.values()) {
        const callable = namespaceCallables(namespace).find((candidate) => candidate.cIdentifier === cIdentifier);

        if (callable !== undefined) {
            return { namespace, callable };
        }
    }

    return undefined;
};

export { giModules, library, locateCallable };
