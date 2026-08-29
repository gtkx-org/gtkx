import { sanitizeTypeIdentifier } from "@gtkx/utils";
import type { GirClass } from "../../gir/class.js";
import type { Library } from "../../gir/library.js";
import type { GirAlias, GirNamespace } from "../../gir/namespace.js";
import { renderTsType } from "../../analysis/ts-type.js";
import { getParentRef } from "../../gir/ancestry.js";
import { isEmittableEntity } from "../../gir/emittable.js";
import { PRIMITIVE_TS_TYPE, primitiveCategory } from "../../gir/primitives.js";
import { ModuleContext } from "../../writer/context.js";
import { renderBootstrapModule } from "./bootstrap.js";
import { generateCallback } from "./callback.js";
import { generateClass } from "./class.js";
import { generateConstant } from "./constant.js";
import { getDoc } from "./doc-spec.js";
import { generateEnum } from "./enum.js";
import { generateNamespaceFunction } from "./function.js";
import { generateInterface } from "./interface.js";
import { generateRecord } from "./record.js";

type TopologicalState = {
    namespaceName: string;
    byLocalName: Map<string, GirClass>;
    placed: Set<GirClass>;
    visiting: Set<GirClass>;
    result: GirClass[];
};

type NamespaceModule = {
    source: string;
    bootstrapSource: string;
};

const generateNamespaceModule = (namespace: GirNamespace, library: Library): NamespaceModule => {
    const context = new ModuleContext(namespace, library);
    generateNamespaceTypes(context, namespace);
    generateNamespaceMembers(context, namespace);

    if (!context.module.hasExports()) {
        throw new Error(
            `GIR file at ${namespace.girFile} has nothing to generate: its ${namespace.name} namespace produces a ` +
            "module with no exports, so the file is empty, truncated, or declares only entries GIR marks as not " +
            "introspectable",
        );
    }

    return {
        source: context.module.toSource(),
        bootstrapSource: renderBootstrapModule(context),
    };
};

const generateNamespaceTypes = (context: ModuleContext, namespace: GirNamespace): void => {
    for (const enumeration of namespace.enums) {
        generateEnum(context, enumeration);
    }

    for (const record of namespace.records) {
        generateRecord(context, record);
    }

    generateInterfaces(context, namespace);

    for (const klass of topologicalClassOrder(namespace.classes, namespace.name)) {
        generateClass(context, klass);
    }
};

const generateInterfaces = (context: ModuleContext, namespace: GirNamespace): void => {
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

    for (const constant of namespace.constants) {
        generateConstant(context, constant);
    }

    for (const alias of namespace.aliases) {
        generateAlias(context, alias);
    }
};

const generateAlias = (context: ModuleContext, alias: GirAlias): void => {
    if (!isEmittableEntity(alias)) {
        return;
    }

    const category = alias.cType === undefined ? undefined : primitiveCategory(alias.cType);
    const targetType = category === "gtype" ? PRIMITIVE_TS_TYPE.gtype : renderTsType(context, alias.target);
    const doc = getDoc(alias);
    const name = sanitizeTypeIdentifier(alias.name);

    context.declare({
        name,
        code: `${doc}export type ${name} = ${targetType};`,
        owner: alias.name,
    });
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
    const parent = getParentRef(klass);

    if (parent === undefined || (parent.namespaceName !== undefined && parent.namespaceName !== namespaceName)) {
        return undefined;
    }

    return byLocalName.get(parent.typeName);
};

export { generateNamespaceModule };
