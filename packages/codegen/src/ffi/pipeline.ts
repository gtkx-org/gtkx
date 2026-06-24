import { ModuleContext } from "../writer/context.js";
import type { GirClass } from "../gir/class.js";
import type { GirNamespace } from "../gir/namespace.js";
import type { Library } from "../gir/repository.js";
import { splitOptionalNamespace } from "../gir/type-ref.js";
import { generateAlias } from "../codegen/alias.js";
import { generateBoxed } from "../codegen/boxed.js";
import { generateCallback } from "../codegen/callback.js";
import { generateClass } from "../codegen/class.js";
import { generateConstant } from "../codegen/constant.js";
import { generateEnum } from "../codegen/enum.js";
import { generateNamespaceBootstrap, generateNamespaceFunction } from "../codegen/function.js";
import { generateInterface } from "../codegen/interface.js";

export const generateNamespaceModule = (namespace: GirNamespace, library: Library): { source: string } => {
    const context = new ModuleContext(namespace, library);
    context.addGobjectBootstrapImports();

    for (const enumeration of namespace.enums) {
        generateEnum(context, enumeration);
    }
    for (const boxed of namespace.records) {
        generateBoxed(context, boxed);
    }
    for (const klass of topologicalClassOrder(namespace.classes, namespace.name)) {
        generateClass(context, klass);
    }
    for (const iface of namespace.interfaces) {
        generateInterface(context, iface);
    }
    for (const callback of namespace.callbacks) {
        generateCallback(context, callback);
    }
    for (const fn of namespace.functions) {
        generateNamespaceFunction(context, fn);
    }
    generateNamespaceBootstrap(context, namespace);
    for (const constant of namespace.constants) {
        generateConstant(context, constant);
    }
    for (const alias of namespace.aliases) {
        generateAlias(context, alias);
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
