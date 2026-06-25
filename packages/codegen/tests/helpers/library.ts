import { generateNamespaceModule } from "../../src/ffi/pipeline.js";
import { Library } from "../../src/gir/library.js";
import { namespaceDirectory } from "../../src/gir/namespace.js";

export const library = Library.load(["Gtk-4.0", "Adw-1"], ["/usr/share/gir-1.0"]);

export const ffiModules = [...library.namespaces.values()].map((namespace) => ({
    directory: namespaceDirectory(namespace),
    source: generateNamespaceModule(namespace, library).source,
}));
