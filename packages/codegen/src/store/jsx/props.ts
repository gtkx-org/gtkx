import { toCamelIdentifier, upperFirst } from "@gtkx/utils";
import type { GirClass } from "../../gir/class.js";
import type { Library } from "../../gir/library.js";
import type { GirNamespace } from "../../gir/namespace.js";
import type { GirCallable } from "../../gir/parameter.js";
import type { TypeId } from "../../gir/type-id.js";
import { forEachAncestor } from "../../analysis/inheritance.js";
import { renderHandlerParameters, renderHandlerResultType } from "../../analysis/param-structure.js";
import { recordTypeTarget, renderBaseType, type TsTypeTarget } from "../../analysis/ts-type.js";
import { type GirProperty, isConstructableProperty } from "../../gir/property.js";
import { renderJsDoc } from "../../writer/doc.js";
import {
    giNamespaceAlias,
    hasExposedMethod,
    isIntrinsicElementClass,
    signalHandlerName,
} from "./intrinsic-elements.js";

type IntrinsicElementPropsEntries = {
    propLines: string[];
    imports: Map<string, string>;
    objectPropNames: string[];
};

type IntrinsicElementScope = {
    library: Library;
    klass: GirClass;
    namespace: GirNamespace;
};

type IntrinsicElementPropsOptions = IntrinsicElementScope & {
    isIntrinsicElementAncestor?: (candidate: GirClass) => boolean;
};

type PropTypeRenderContext = {
    library: Library;
    imports: Map<string, string>;
};

type SignalRenderOptions = {
    types: PropTypeRenderContext;
    signal: GirCallable;
    selfType: string;
};

type PropEntryCollector = {
    propLines: string[];
    imports: Map<string, string>;
    objectPropNames: string[];
    acceptProperty: (property: GirProperty) => void;
    acceptSignal: (signal: GirCallable) => void;
};

type PropCollectorState = {
    owner: IntrinsicElementScope;
    types: PropTypeRenderContext;
    propLines: string[];
    objectPropNames: string[];
    seen: Set<string>;
};

type InterfacePropsOptions = {
    library: Library;
    iface: GirClass;
    namespace: GirNamespace;
};

type IntrinsicElementMemberWalk = IntrinsicElementScope & {
    isIntrinsicElementAncestor: (candidate: GirClass) => boolean;
    acceptProperty: (property: GirProperty) => void;
    acceptSignal: (signal: GirCallable) => void;
};

const appendPropertyLines = (state: PropCollectorState, property: GirProperty, jsName: string): void => {
    const tsType = renderReactPropType(state.types, property.type, false);
    const doc = renderJsDoc(property.doc);

    if (isObjectProp(state.owner, property, jsName)) {
        state.propLines.push(`${doc}${jsName}?: ${tsType} | ReactElement | null | undefined;`);
        state.objectPropNames.push(jsName);

        return;
    }

    const isSettable = isConstructableProperty(property);

    if (isSettable) {
        state.propLines.push(`${doc}${jsName}?: ${tsType} | null | undefined;`);
    }

    const handlerType = `((value: ${tsType} | null, self: Self) => void) | null | undefined`;
    state.propLines.push(`${isSettable ? "" : doc}onNotify${upperFirst(jsName)}?: ${handlerType};`);
};

const acceptCollectorProperty = (state: PropCollectorState, property: GirProperty): void => {
    if (!property.introspectable) {
        return;
    }

    const jsName = toCamelIdentifier(property.name);

    if (state.seen.has(jsName)) {
        return;
    }

    state.seen.add(jsName);
    appendPropertyLines(state, property, jsName);
};

const acceptCollectorSignal = (state: PropCollectorState, signal: GirCallable): void => {
    const handlerName = signalHandlerName(signal.name);

    if (state.seen.has(handlerName)) {
        return;
    }

    state.seen.add(handlerName);
    const signature = renderSignalHandler({ types: state.types, signal, selfType: "Self" });
    state.propLines.push(`${renderJsDoc(signal.doc)}${handlerName}?: (${signature}) | undefined;`);
};

const createPropEntryCollector = (owner: IntrinsicElementScope): PropEntryCollector => {
    const { library } = owner;
    const imports: Map<string, string> = new Map();
    const types: PropTypeRenderContext = { library, imports };

    const state: PropCollectorState = {
        owner,
        types,
        propLines: [],
        objectPropNames: [],
        seen: new Set<string>(),
    };

    return {
        propLines: state.propLines,
        imports,
        objectPropNames: state.objectPropNames,
        acceptProperty: (property) => {
            acceptCollectorProperty(state, property);
        },
        acceptSignal: (signal) => {
            acceptCollectorSignal(state, signal);
        },
    };
};

const buildElementPropsEntries = (options: IntrinsicElementPropsOptions): IntrinsicElementPropsEntries => {
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

const buildInterfacePropsEntries = (options: InterfacePropsOptions): IntrinsicElementPropsEntries => {
    const { library, iface, namespace } = options;
    const collector = createPropEntryCollector({ library, klass: iface, namespace });

    for (const property of iface.properties) {
        collector.acceptProperty(property);
    }

    for (const signal of iface.signals) {
        collector.acceptSignal(signal);
    }

    return { propLines: collector.propLines, imports: collector.imports, objectPropNames: collector.objectPropNames };
};

const walkIntrinsicElementMembers = (walk: IntrinsicElementMemberWalk): void => {
    const { library, klass, namespace, isIntrinsicElementAncestor, acceptProperty, acceptSignal } = walk;

    const visitMembers = (memberClass: GirClass): void => {
        for (const property of memberClass.properties) {
            acceptProperty(property);
        }

        for (const signal of memberClass.signals) {
            acceptSignal(signal);
        }
    };

    const ancestry = { library, namespace };
    visitMembers(klass);

    forEachAncestor(ancestry, klass, (ancestor) => {
        visitMembers(ancestor.klass);
    }, isIntrinsicElementAncestor);
};

const isGObjectType = (library: Library, ref: TypeId | undefined): boolean => {
    if (ref === undefined) {
        return false;
    }

    const resolved = library.typeFor(ref);

    if (resolved?.kind === "interface") {
        return true;
    }

    if (resolved?.kind !== "class") {
        return false;
    }

    return isIntrinsicElementClass(resolved.value, resolved.namespace, library);
};

const isObjectProp = (owner: IntrinsicElementScope, property: GirProperty, jsName: string): boolean => {
    if (!property.writable || property.constructOnly) {
        return false;
    }

    if (!isGObjectType(owner.library, property.type)) {
        return false;
    }

    if (jsName === "child" && hasExposedMethod(owner.klass, owner.namespace, owner.library, "set_child")) {
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

const reactTarget = (context: PropTypeRenderContext): TsTypeTarget =>
    recordTypeTarget(
        context.library,
        (name) => {
            context.imports.set(name.namespaceName, giNamespaceAlias(name.namespaceName));

            return `${giNamespaceAlias(name.namespaceName)}.${name.typeName}`;
        },
        () => {
            context.imports.set("GObject", giNamespaceAlias("GObject"));

            return `${giNamespaceAlias("GObject")}.Type`;
        },
    );

const renderReactPropType = (context: PropTypeRenderContext, ref: TypeId | undefined, isNullable: boolean): string => {
    const base = renderBaseType(context.library, reactTarget(context), ref);

    return isNullable ? `${base} | null` : base;
};

export { buildElementPropsEntries, buildInterfacePropsEntries, isObjectProp, reactTarget };
