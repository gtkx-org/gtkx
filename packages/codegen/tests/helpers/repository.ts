import { generateNamespaceModule } from "../../src/ffi/pipeline.js";
import { namespaceDirectory } from "../../src/gir/namespace.js";
import { loadGirRepository } from "../../src/gir/repository.js";

export const repository = loadGirRepository(["Gtk-4.0", "Adw-1"], ["/usr/share/gir-1.0"]);

export const ffiModules = [...repository.namespaces.values()].map((namespace) => ({
    directory: namespaceDirectory(namespace),
    source: generateNamespaceModule(namespace, repository).source,
}));
