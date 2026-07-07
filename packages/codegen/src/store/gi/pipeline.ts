import { renderTsType } from "../../analysis/ts-type.js";
import type { GirClass } from "../../gir/class.js";
import type { Library } from "../../gir/library.js";
import type { GirAlias, GirNamespace } from "../../gir/namespace.js";
import { PRIMITIVE_TS_TYPE, primitiveCategory } from "../../gir/primitives.js";
import { splitOptionalNamespace } from "../../gir/type-ref.js";
import { ModuleContext } from "../../writer/context.js";
import { generateCallback } from "./callback.js";
import { generateClass } from "./class.js";
import { generateConstant } from "./constant.js";
import { generateEnum } from "./enum.js";
import { generateNamespaceBootstrap, generateNamespaceFunction } from "./function.js";
import { generateInterface } from "./interface.js";
import { generateRecord } from "./record.js";

export const generateNamespaceModule = (namespace: GirNamespace, library: Library): string => {
    const context = new ModuleContext(namespace, library);
    context.addGObjectBootstrapImports();

    for (const enumeration of namespace.enums) {
        generateEnum(context, enumeration);
    }
    for (const record of namespace.records) {
        generateRecord(context, record);
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

    return context.module.toSource();
};

const generateAlias = (context: ModuleContext, alias: GirAlias): void => {
    const category = alias.cType === undefined ? undefined : primitiveCategory(alias.cType);
    const targetType = category === "gtype" ? PRIMITIVE_TS_TYPE.gtype : renderTsType(context, alias.target);
    context.module.appendDeclaration(`export type ${alias.name} = ${targetType};`);
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
