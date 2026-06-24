import { toCamelIdentifier, toUpperFirst } from "@gtkx/utils";
import type { GirClass } from "../gir/class.js";
import type { GirNamespace } from "../gir/namespace.js";
import { type GirParameter, isInoutParameter, isOutParameter } from "../gir/parameter.js";
import { type GirProperty, isConstructableProperty } from "../gir/property.js";
import type { Library } from "../gir/repository.js";
import type { GirSignal } from "../gir/signal.js";
import type { TypeId } from "../gir/type-id.js";
import { forEachAncestor, type ResolvedInterface, resolveDirectInterfaces } from "../codegen/inheritance.js";
import { renderHandlerParameters } from "../codegen/param-structure.js";
import { foldOutParamShape } from "../codegen/return-shape.js";
import { renderBaseTypeFor, type TsTypeTarget } from "../codegen/ts-type.js";
import { isScalarRef } from "../codegen/value.js";
import { classExposesMethod, isReactNodeClass, signalHandlerName } from "./widgets.js";

export type WidgetPropsEntries = {
    propLines: string[];
    imports: Map<string, string>;
    slotPropNames: string[];
};

export type WidgetPropsOptions = {
    library: Library;
    klass: GirClass;
    namespace: GirNamespace;
    isReactNodeAncestor?: (candidate: GirClass) => boolean;
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

export const buildElementPropsEntries = (options: WidgetPropsOptions): WidgetPropsEntries => {
    const { library, klass, namespace, isReactNodeAncestor = () => false } = options;
    const imports = new Map<string, string>();
    const types: PropTypeRenderContext = { library, imports };
    const propEntries: string[] = [];
    const slotPropNames: string[] = [];
    const seen = new Set<string>();

    const acceptProperty = (property: GirProperty): void => {
        if (!property.introspectable) return;
        const jsName = toCamelIdentifier(property.name);
        if (seen.has(jsName)) return;
        seen.add(jsName);
        const tsType = renderReactPropType(types, property.type, false);
        if (isSlotProperty({ library, klass, namespace }, property, jsName)) {
            propEntries.push(`${jsName}?: ${tsType} | ReactElement | null | undefined;`);
            slotPropNames.push(jsName);
            return;
        }
        if (isConstructableProperty(property)) propEntries.push(`${jsName}?: ${tsType} | null | undefined;`);
        propEntries.push(
            `onNotify${toUpperFirst(jsName)}?: ((value: ${tsType} | null, self: Self) => void) | null | undefined;`,
        );
    };

    const acceptSignal = (signal: GirSignal): void => {
        const handlerName = signalHandlerName(signal.name);
        if (seen.has(handlerName)) return;
        seen.add(handlerName);
        const signature = renderSignalHandler({ types, signal, selfType: "Self" });
        propEntries.push(`${handlerName}?: (${signature}) | undefined;`);
    };

    walkWidgetMembers({ library, klass, namespace, isReactNodeAncestor, acceptProperty, acceptSignal });

    return { propLines: propEntries, imports, slotPropNames };
};

type WidgetMemberWalk = {
    library: Library;
    klass: GirClass;
    namespace: GirNamespace;
    isReactNodeAncestor: (candidate: GirClass) => boolean;
    acceptProperty: (property: GirProperty) => void;
    acceptSignal: (signal: GirSignal) => void;
};

const walkWidgetMembers = (walk: WidgetMemberWalk): void => {
    const { library, klass, namespace, isReactNodeAncestor, acceptProperty, acceptSignal } = walk;
    const visitMembers = (memberClass: GirClass, interfaces: ResolvedInterface[]): void => {
        for (const property of memberClass.properties) acceptProperty(property);
        for (const signal of memberClass.signals) acceptSignal(signal);
        for (const iface of interfaces) {
            for (const property of iface.klass.properties) acceptProperty(property);
            for (const signal of iface.klass.signals) acceptSignal(signal);
        }
    };
    const ancestry = { library, namespace };
    visitMembers(klass, resolveDirectInterfaces(ancestry, klass, namespace.name));
    forEachAncestor(
        ancestry,
        klass,
        (ancestor, interfaces) => visitMembers(ancestor.klass, interfaces),
        isReactNodeAncestor,
    );
};

const resolvesToGobjectClass = (library: Library, ref: TypeId | undefined): boolean => {
    if (ref === undefined) return false;
    const resolved = library.typeOf(ref);
    if (resolved?.kind !== "class") return false;
    return isReactNodeClass(resolved.value, resolved.namespace, library);
};

type SlotOwner = {
    library: Library;
    klass: GirClass;
    namespace: GirNamespace;
};

const isSlotProperty = (owner: SlotOwner, property: GirProperty, jsName: string): boolean => {
    if (!property.writable || property.constructOnly) return false;
    if (!resolvesToGobjectClass(owner.library, property.type)) return false;
    if (jsName === "child" && classExposesMethod(owner.klass, owner.namespace, owner.library, "set_child")) {
        return false;
    }
    return true;
};

const renderSignalHandler = (options: SignalRenderOptions): string => {
    const { types, signal, selfType } = options;
    const visible = signal.parameters.filter((parameter) => !parameter.isVarargs);
    const params = [
        ...renderHandlerParameters(signal.parameters, (ref, nullable) => renderReactPropType(types, ref, nullable)),
        `self: ${selfType}`,
    ];
    return `(${params.join(", ")}) => ${renderSignalReturnType(options, visible)}`;
};

const renderSignalReturnType = (options: SignalRenderOptions, visible: GirParameter[]): string => {
    const { types, signal } = options;
    const baseReturn = renderReactPropType(types, signal.returnValue.type, signal.returnValue.nullable);
    const outTypes = visible
        .filter(
            (parameter) =>
                isOutParameter(parameter) ||
                (isInoutParameter(parameter) && isScalarRef(types.library, parameter.type)),
        )
        .map((parameter) => renderReactPropType(types, parameter.type, false));
    if (outTypes.length === 0) {
        return baseReturn === "void" ? "void" : `${baseReturn} | undefined`;
    }
    const hasPrimary = baseReturn !== "void";
    return foldOutParamShape({ primary: hasPrimary ? baseReturn : undefined, outTypes, hasPrimary });
};

const reactTarget = (context: PropTypeRenderContext): TsTypeTarget => ({
    containerStyle: "record",
    callbackType: "(...args: unknown[]) => unknown",
    byteArrayAsNumber: false,
    renderNamed: (resolved, name) => {
        if (resolved?.kind === "callback") return "(...args: unknown[]) => unknown";
        if (resolved?.kind === "alias") {
            return resolved.target === undefined
                ? "number"
                : renderBaseTypeFor(context.library, reactTarget(context), resolved.target);
        }
        context.imports.set(name.namespaceName, name.namespaceName);
        return `${name.namespaceName}.${name.typeName}`;
    },
    renderGtype: () => {
        context.imports.set("GObject", "GObject");
        return "GObject.GType";
    },
});

const renderReactPropType = (context: PropTypeRenderContext, ref: TypeId | undefined, isNullable: boolean): string => {
    const base = renderBaseTypeFor(context.library, reactTarget(context), ref);
    return isNullable ? `${base} | null` : base;
};
