import { Library } from "../../src/gir/library.js";
import { namespaceDirectory } from "../../src/gir/namespace.js";
import { generateNamespaceModule } from "../../src/store/gi/pipeline.js";

export const library = Library.load(["Gtk-4.0", "Adw-1"], ["/usr/share/gir-1.0"]);

export const giModules = [...library.namespaces.values()].map((namespace) => ({
    directory: namespaceDirectory(namespace),
    source: generateNamespaceModule(namespace, library),
}));
