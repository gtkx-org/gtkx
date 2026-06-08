/**
 * Shared GIR repository and generated FFI modules for the codegen integration
 * tests. Loads the `Gtk-4.0` and `Adw-1` namespaces once and generates every
 * namespace's FFI module so test files can assert against the produced source.
 */

import { generateNamespaceModule } from "../../src/ffi/pipeline.js";
import { loadGirRepository } from "../../src/gir/repository.js";

/** The GIR repository loaded with the `Gtk-4.0` and `Adw-1` dependency closure. */
export const repository = loadGirRepository(["Gtk-4.0", "Adw-1"], ["/usr/share/gir-1.0"]);

/** The generated FFI module for every namespace in {@link repository}. */
export const ffiModules = [...repository.namespaces.values()].map((namespace) =>
    generateNamespaceModule(namespace, repository),
);
