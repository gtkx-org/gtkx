import { ModuleContext } from "../dsl/context.js";
import type { GirClass } from "../gir/class.js";
import type { GirNamespace } from "../gir/namespace.js";
import type { GirRepository } from "../gir/repository.js";
import { emitAlias } from "../writers/alias.js";
import { emitBoxed } from "../writers/boxed.js";
import { emitClass } from "../writers/class.js";
import { emitConstant } from "../writers/constants.js";
import { emitEnum } from "../writers/enum.js";
import { emitNamespaceBootstrap, emitNamespaceFunction } from "../writers/function.js";
import { emitInterface } from "../writers/interface.js";

/**
 * Generates the TypeScript source for one FFI namespace module.
 *
 * Walks the namespace's declared classes, interfaces, boxeds, enums,
 * functions, and constants in GIR order, dispatching to the per-construct
 * writers in `writers/`. The order matches what the existing generated
 * output uses today: bindings first, declarations second, registrations
 * trailing.
 *
 * @param namespace - The namespace to emit
 * @param repository - The full repository (for cross-namespace lookups)
 * @returns The relative output path and the TypeScript source string
 */
export const generateNamespaceModule = (
    namespace: GirNamespace,
    repository: GirRepository,
): { readonly path: string; readonly source: string } => {
    const ctx = new ModuleContext(namespace, repository);
    ctx.addGObjectBootstrapImports();

    for (const enumeration of namespace.enums) {
        emitEnum(ctx, enumeration);
    }
    for (const boxed of namespace.boxeds) {
        emitBoxed(ctx, boxed);
    }
    for (const klass of topologicalClassOrder(namespace.classes, namespace.name)) {
        emitClass(ctx, klass);
    }
    for (const iface of namespace.interfaces) {
        emitInterface(ctx, iface);
    }
    for (const fn of namespace.functions) {
        emitNamespaceFunction(ctx, fn);
    }
    emitNamespaceBootstrap(ctx, namespace);
    for (const constant of namespace.constants) {
        emitConstant(ctx, constant);
    }
    for (const alias of namespace.aliases) {
        emitAlias(ctx, alias);
    }

    const directory = namespace.name.toLowerCase();
    return {
        path: `${directory}/${directory}.ts`,
        source: ctx.module.emit(),
    };
};

/**
 * Returns the namespace's classes ordered so each class is preceded by every
 * same-namespace ancestor it extends.
 *
 * Generated JS classes use `extends`, which is a runtime reference: a child
 * class declaration that names its parent before the parent's class body runs
 * hits a temporal dead-zone error. GIR file order is source order, which does
 * not match the inheritance order for namespaces where a leaf type (e.g.
 * `GObject.Binding`) is declared earlier in the file than its base (e.g.
 * `GObject.Object`). The codegen sorts by inheritance instead.
 *
 * Cross-namespace parents are imported by the writer and do not participate in
 * the sort.
 *
 * @param classes - The classes to order
 * @param namespaceName - The namespace these classes live in
 */
const topologicalClassOrder = (classes: readonly GirClass[], namespaceName: string): readonly GirClass[] => {
    const byLocalName = new Map<string, GirClass>();
    for (const klass of classes) byLocalName.set(klass.name, klass);
    const result: GirClass[] = [];
    const placed = new Set<GirClass>();
    const visiting = new Set<GirClass>();
    const visit = (klass: GirClass): void => {
        if (placed.has(klass)) return;
        if (visiting.has(klass)) return;
        visiting.add(klass);
        const parent = sameNamespaceParent(klass, namespaceName, byLocalName);
        if (parent !== undefined) visit(parent);
        visiting.delete(klass);
        placed.add(klass);
        result.push(klass);
    };
    for (const klass of classes) visit(klass);
    return result;
};

const sameNamespaceParent = (
    klass: GirClass,
    namespaceName: string,
    byLocalName: ReadonlyMap<string, GirClass>,
): GirClass | undefined => {
    if (klass.parent === undefined) return undefined;
    const dot = klass.parent.indexOf(".");
    if (dot === -1) return byLocalName.get(klass.parent);
    if (klass.parent.slice(0, dot) !== namespaceName) return undefined;
    return byLocalName.get(klass.parent.slice(dot + 1));
};
