import { toCamelIdentifier, upperFirst } from "@gtkx/utils";
import { forEachAncestor } from "../../analysis/inheritance.js";
import { renderHandlerParameters, renderHandlerResultType } from "../../analysis/param-structure.js";
import { renderBaseTypeFor, type TsTypeTarget } from "../../analysis/ts-type.js";
import type { GirClass } from "../../gir/class.js";
import type { Library } from "../../gir/library.js";
import type { GirNamespace } from "../../gir/namespace.js";
import type { GirSignal } from "../../gir/parameter.js";
import { type GirProperty, isConstructableProperty } from "../../gir/property.js";
import type { TypeId } from "../../gir/type-id.js";
import { renderJsDoc } from "../../writer/doc.js";
import {
    classExposesMethod,
    giNamespaceAlias,
    isIntrinsicElementClass,
    signalHandlerName,
} from "./intrinsic-elements.js";

type IntrinsicElementPropsEntries = {
    propLines: string[];
    imports: Map<string, string>;
    objectPropNames: string[];
};

type IntrinsicElementPropsOptions = {
    library: Library;
    klass: GirClass;
    namespace: GirNamespace;
    isIntrinsicElementAncestor?: (candidate: GirClass) => boolean;
};

type PropTypeRenderContext = {
    library: Library;
    imports: Map<string, string>;
};

type SignalRenderOptions = {
    types: PropTypeRenderContext;
    signal: GirSignal;
    selfType: string;
};

type PropEntryCollector = {
    propLines: string[];
    imports: Map<string, string>;
    objectPropNames: string[];
    acceptProperty: (property: GirProperty) => void;
    acceptSignal: (signal: GirSignal) => void;
};

const createPropEntryCollector = (owner: PropOwner): PropEntryCollector => {
    const { library } = owner;
    const imports = new Map<string, string>();
    const types: PropTypeRenderContext = { library, imports };
    const propLines: string[] = [];
    const objectPropNames: string[] = [];
    const seen = new Set<string>();

    const acceptProperty = (property: GirProperty): void => {
        if (!property.introspectable) return;
        const jsName = toCamelIdentifier(property.name);
        if (seen.has(jsName)) return;
        seen.add(jsName);
        const tsType = renderReactPropType(types, property.type, false);
        const doc = renderJsDoc(property.doc);
        if (isObjectProp(owner, property, jsName)) {
            propLines.push(`${doc}${jsName}?: ${tsType} | ReactElement | null | undefined;`);
            objectPropNames.push(jsName);
            return;
        }
        const settable = isConstructableProperty(property);
        if (settable) propLines.push(`${doc}${jsName}?: ${tsType} | null | undefined;`);
        propLines.push(
            `${settable ? "" : doc}onNotify${upperFirst(jsName)}?: ((value: ${tsType} | null, self: Self) => void) | null | undefined;`,
        );
    };

    const acceptSignal = (signal: GirSignal): void => {
        const handlerName = signalHandlerName(signal.name);
        if (seen.has(handlerName)) return;
        seen.add(handlerName);
        const signature = renderSignalHandler({ types, signal, selfType: "Self" });
        propLines.push(`${renderJsDoc(signal.doc)}${handlerName}?: (${signature}) | undefined;`);
    };

    return { propLines, imports, objectPropNames, acceptProperty, acceptSignal };
};

export const buildElementPropsEntries = (options: IntrinsicElementPropsOptions): IntrinsicElementPropsEntries => {
    const { library, klass, namespace, isIntrinsicElementAncestor = () => false } = options;
    const collector = createPropEntryCollector({ library, klass, namespace });
    walkIntrinsicElementMembers({
        library,
        klass,
        namespace,
        isIntrinsicElementAncestor,
        acceptProperty: collector.acceptProperty,
        acceptSignal: collector.acceptSignal,
    });
    return { propLines: collector.propLines, imports: collector.imports, objectPropNames: collector.objectPropNames };
};

type InterfacePropsOptions = {
    library: Library;
    iface: GirClass;
    namespace: GirNamespace;
};

export const buildInterfacePropsEntries = (options: InterfacePropsOptions): IntrinsicElementPropsEntries => {
    const { library, iface, namespace } = options;
    const collector = createPropEntryCollector({ library, klass: iface, namespace });
    for (const property of iface.properties) collector.acceptProperty(property);
    for (const signal of iface.signals) collector.acceptSignal(signal);
    return { propLines: collector.propLines, imports: collector.imports, objectPropNames: collector.objectPropNames };
};

type IntrinsicElementMemberWalk = {
    library: Library;
    klass: GirClass;
    namespace: GirNamespace;
    isIntrinsicElementAncestor: (candidate: GirClass) => boolean;
    acceptProperty: (property: GirProperty) => void;
    acceptSignal: (signal: GirSignal) => void;
};

const walkIntrinsicElementMembers = (walk: IntrinsicElementMemberWalk): void => {
    const { library, klass, namespace, isIntrinsicElementAncestor, acceptProperty, acceptSignal } = walk;
    const visitMembers = (memberClass: GirClass): void => {
        for (const property of memberClass.properties) acceptProperty(property);
        for (const signal of memberClass.signals) acceptSignal(signal);
    };
    const ancestry = { library, namespace };
    visitMembers(klass);
    forEachAncestor(ancestry, klass, (ancestor) => visitMembers(ancestor.klass), isIntrinsicElementAncestor);
};

const resolvesToGObjectClass = (library: Library, ref: TypeId | undefined): boolean => {
    if (ref === undefined) return false;
    const resolved = library.typeOf(ref);
    if (resolved?.kind !== "class") return false;
    return isIntrinsicElementClass(resolved.value, resolved.namespace, library);
};

type PropOwner = {
    library: Library;
    klass: GirClass;
    namespace: GirNamespace;
};

export const isObjectProp = (owner: PropOwner, property: GirProperty, jsName: string): boolean => {
    if (!property.writable || property.constructOnly) return false;
    if (!resolvesToGObjectClass(owner.library, property.type)) return false;
    if (jsName === "child" && classExposesMethod(owner.klass, owner.namespace, owner.library, "set_child")) {
        return false;
    }
    return true;
};

const renderSignalHandler = (options: SignalRenderOptions): string => {
    const { types, signal, selfType } = options;
    const params = [
        ...renderHandlerParameters(signal.parameters, (ref, nullable) => renderReactPropType(types, ref, nullable)),
        `self: ${selfType}`,
    ];
    const result = renderHandlerResultType({
        library: types.library,
        signal,
        renderType: (ref, nullable) => renderReactPropType(types, ref, nullable),
        includeCallerAllocated: false,
        optOut: true,
    });
    return `(${params.join(", ")}) => ${result}`;
};

export const reactTarget = (context: PropTypeRenderContext): TsTypeTarget => ({
    containerStyle: "record",
    callbackType: "((...args: unknown[]) => unknown)",
    byteArrayAsNumber: false,
    renderNamed: (resolved, name) => {
        if (resolved?.kind === "alias") {
            return resolved.value.target === undefined
                ? "number"
                : renderBaseTypeFor(context.library, reactTarget(context), resolved.value.target);
        }
        context.imports.set(name.namespaceName, giNamespaceAlias(name.namespaceName));
        return `${giNamespaceAlias(name.namespaceName)}.${name.typeName}`;
    },
    renderGtype: () => {
        context.imports.set("GObject", giNamespaceAlias("GObject"));
        return `${giNamespaceAlias("GObject")}.Type`;
    },
});

const renderReactPropType = (context: PropTypeRenderContext, ref: TypeId | undefined, isNullable: boolean): string => {
    const base = renderBaseTypeFor(context.library, reactTarget(context), ref);
    return isNullable ? `${base} | null` : base;
};
