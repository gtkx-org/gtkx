import type { GirClass } from "../../gir/class.js";
import type { Library } from "../../gir/library.js";
import type { GirAlias, GirNamespace } from "../../gir/namespace.js";
import { renderTsType } from "../../analysis/ts-type.js";
import { PRIMITIVE_TS_TYPE, primitiveCategory } from "../../gir/primitives.js";
import { splitOptionalNamespace } from "../../gir/type-ref.js";
import { ModuleContext } from "../../writer/context.js";
import { renderJsDoc } from "../../writer/doc.js";
import { generateCallback } from "./callback.js";
import { generateClass } from "./class.js";
import { generateConstant } from "./constant.js";
import { generateEnum } from "./enum.js";
import { generateNamespaceBootstrap, generateNamespaceFunction } from "./function.js";
import { generateInterface } from "./interface.js";
import { generateRecord } from "./record.js";

type TopologicalState = {
    namespaceName: string;
    byLocalName: Map<string, GirClass>;
    placed: Set<GirClass>;
    visiting: Set<GirClass>;
    result: GirClass[];
};

const generateNamespaceModule = (namespace: GirNamespace, library: Library): string => {
    const context = new ModuleContext(namespace, library);
    context.addGObjectBootstrapImports();
    generateNamespaceTypes(context, namespace);
    generateNamespaceMembers(context, namespace);

    return context.module.toSource();
};

const generateNamespaceTypes = (context: ModuleContext, namespace: GirNamespace): void => {
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
};

const generateNamespaceMembers = (context: ModuleContext, namespace: GirNamespace): void => {
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
};

const generateAlias = (context: ModuleContext, alias: GirAlias): void => {
    const category = alias.cType === undefined ? undefined : primitiveCategory(alias.cType);
    const targetType = category === "gtype" ? PRIMITIVE_TS_TYPE.gtype : renderTsType(context, alias.target);
    context.module.appendDeclaration(`${renderJsDoc(alias.doc)}export type ${alias.name} = ${targetType};`);
};

const visitClass = (state: TopologicalState, klass: GirClass): void => {
    if (state.placed.has(klass) || state.visiting.has(klass)) {
        return;
    }

    state.visiting.add(klass);
    const parent = sameNamespaceParent(klass, state.namespaceName, state.byLocalName);

    if (parent !== undefined) {
        visitClass(state, parent);
    }

    state.visiting.delete(klass);
    state.placed.add(klass);
    state.result.push(klass);
};

const topologicalClassOrder = (classes: GirClass[], namespaceName: string): GirClass[] => {
    const byLocalName: Map<string, GirClass> = new Map();

    for (const klass of classes) {
        byLocalName.set(klass.name, klass);
    }

    const state: TopologicalState = {
        namespaceName,
        byLocalName,
        placed: new Set<GirClass>(),
        visiting: new Set<GirClass>(),
        result: [],
    };

    for (const klass of classes) {
        visitClass(state, klass);
    }

    return state.result;
};

const sameNamespaceParent = (
    klass: GirClass,
    namespaceName: string,
    byLocalName: Map<string, GirClass>,
): GirClass | undefined => {
    if (klass.parent === undefined) {
        return undefined;
    }

    const [parentNamespace, typeName] = splitOptionalNamespace(klass.parent);

    if (parentNamespace !== undefined && parentNamespace !== namespaceName) {
        return undefined;
    }

    return byLocalName.get(typeName);
};

export { generateNamespaceModule };
