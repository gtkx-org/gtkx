import { ModuleContext } from "../dsl/context.js";
import type { GirClass } from "../gir/class.js";
import type { GirNamespace } from "../gir/namespace.js";
import type { GirRepository } from "../gir/repository.js";
import { splitOptionalNamespace } from "../gir/type-ref.js";
import { emitAlias } from "../writers/alias.js";
import { emitBoxed } from "../writers/boxed.js";
import { emitCallback } from "../writers/callback.js";
import { emitClass } from "../writers/class.js";
import { emitConstant } from "../writers/constant.js";
import { emitEnum } from "../writers/enum.js";
import { emitNamespaceBootstrap, emitNamespaceFunction } from "../writers/function.js";
import { emitInterface } from "../writers/interface.js";

export const generateNamespaceModule = (namespace: GirNamespace, repository: GirRepository): { source: string } => {
    const context = new ModuleContext(namespace, repository);
    context.addGobjectBootstrapImports();

    for (const enumeration of namespace.enums) {
        emitEnum(context, enumeration);
    }
    for (const boxed of namespace.boxeds) {
        emitBoxed(context, boxed);
    }
    for (const klass of topologicalClassOrder(namespace.classes, namespace.name)) {
        emitClass(context, klass);
    }
    for (const iface of namespace.interfaces) {
        emitInterface(context, iface);
    }
    for (const callback of namespace.callbacks) {
        emitCallback(context, callback);
    }
    for (const fn of namespace.functions) {
        emitNamespaceFunction(context, fn);
    }
    emitNamespaceBootstrap(context, namespace);
    for (const constant of namespace.constants) {
        emitConstant(context, constant);
    }
    for (const alias of namespace.aliases) {
        emitAlias(context, alias);
    }

    context.flushImports();
    return { source: context.module.toSource() };
};

const topologicalClassOrder = (classes: GirClass[], namespaceName: string): GirClass[] => {
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
    byLocalName: Map<string, GirClass>,
): GirClass | undefined => {
    if (klass.parent === undefined) return undefined;
    const [parentNamespace, typeName] = splitOptionalNamespace(klass.parent);
    if (parentNamespace !== undefined && parentNamespace !== namespaceName) return undefined;
    return byLocalName.get(typeName);
};
