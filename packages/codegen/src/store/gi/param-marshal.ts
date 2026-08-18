import { sanitizeTypeIdentifier } from "@gtkx/utils";
import type { TypeId } from "../../gir/type-id.js";
import type { GirType } from "../../gir/type.js";
import type { ModuleContext } from "../../writer/context.js";
import { type GirParameter, isInoutParameter } from "../../gir/parameter.js";
import { recordInlineSize } from "./record-layout.js";
import { isConstructibleRecord } from "./value-marshalable.js";

type TypeName = { namespaceName: string; typeName: string };
type CallerOutAllocation = TypeName & ({ strategy: "construct" } | { strategy: "allocate"; size: number });

const isHandlePassedInPlace = (context: ModuleContext, parameter: GirParameter): boolean => {
    if (parameter.direction !== "out" && parameter.direction !== "inout") {
        return false;
    }

    return (
        (parameter.callerAllocates || parameter.direction === "inout") &&
        parameter.type !== undefined &&
        isHandlePassing(context, parameter.type)
    );
};

const underlyingType = (context: ModuleContext, ref: TypeId): GirType | undefined => {
    const type = context.library.typeFor(ref);

    if (type?.kind !== "alias") {
        return type;
    }

    return type.value.target === undefined ? undefined : underlyingType(context, type.value.target);
};

const underlyingParamKind = (context: ModuleContext, parameter: GirParameter): GirType["kind"] | undefined =>
    parameter.type === undefined ? undefined : underlyingType(context, parameter.type)?.kind;

const resolvedTypeName = (context: ModuleContext, ref: TypeId | undefined): TypeName | undefined => {
    let current = ref;

    while (current !== undefined) {
        const resolved = context.library.typeFor(current);

        if (resolved?.kind === "alias" && resolved.value.target !== undefined) {
            current = resolved.value.target;
            continue;
        }

        return context.library.nameFor(current);
    }

    return undefined;
};

const recordCallerOutAllocation = (
    context: ModuleContext,
    name: TypeName,
    type: Extract<GirType, { kind: "record" }>,
): CallerOutAllocation | undefined => {
    const size = recordInlineSize(context, type.value);

    if (size === undefined) {
        return undefined;
    }

    return isConstructibleRecord(context, type.namespace.name, type.value)
        ? { ...name, strategy: "construct" }
        : { ...name, strategy: "allocate", size };
};

const callerOutAllocation = (context: ModuleContext, parameter: GirParameter): CallerOutAllocation | undefined => {
    const name = resolvedTypeName(context, parameter.type);
    const type = parameter.type === undefined ? undefined : underlyingType(context, parameter.type);

    if (name === undefined || type === undefined) {
        return undefined;
    }

    if (type.kind === "class") {
        return { ...name, strategy: "construct" };
    }

    return type.kind === "record" ? recordCallerOutAllocation(context, name, type) : undefined;
};

const renderCallerOutInstance = (context: ModuleContext, parameter: GirParameter): string => {
    const allocation = callerOutAllocation(context, parameter);

    if (allocation === undefined) {
        throw new Error("renderCallerOutInstance: expected a caller-allocated out-parameter with a known layout");
    }

    const classExpression = context.qualify(allocation.namespaceName, sanitizeTypeIdentifier(allocation.typeName));

    if (allocation.strategy === "construct") {
        return `new ${classExpression}()`;
    }

    context.addRuntimeImport("alloc");
    context.addRuntimeImport("wrapHandle");

    return `wrapHandle(alloc(${String(allocation.size)}), ${classExpression})`;
};

const isCollectibleCallerOut = (context: ModuleContext, parameter: GirParameter): boolean =>
    callerOutAllocation(context, parameter) !== undefined;

const isAllocatableCallerOut = (context: ModuleContext, parameter: GirParameter): boolean =>
    underlyingParamKind(context, parameter) === "record" && isCollectibleCallerOut(context, parameter);

const isRecordInout = (context: ModuleContext, parameter: GirParameter): boolean =>
    isInoutParameter(parameter) && underlyingParamKind(context, parameter) === "record";

const isHandlePassing = (context: ModuleContext, ref: TypeId): boolean => {
    const type = context.library.typeFor(ref);

    if (type === undefined) {
        return true;
    }

    switch (type.kind) {
        case "class":
        case "interface":
        case "record": {
            return true;
        }
        case "alias": {
            return type.value.target !== undefined && isHandlePassing(context, type.value.target);
        }
        case "callback":
        case "carray":
        case "enum":
        case "hashtable":
        case "list":
        case "primitive":
        case "varargs": {
            return false;
        }
    }
};

const isGObjectTypeNamed = (context: ModuleContext, ref: TypeId, typeName: string): boolean => {
    const name = context.library.nameFor(ref);

    return name?.namespaceName === "GObject" && name.typeName === typeName;
};

const isClosureType = (context: ModuleContext, ref: TypeId): boolean => isGObjectTypeNamed(context, ref, "Closure");
const isValueType = (context: ModuleContext, ref: TypeId): boolean => isGObjectTypeNamed(context, ref, "Value");
const isValueTypeName = (name: TypeName): boolean => name.namespaceName === "GObject" && name.typeName === "Value";

export {
    isAllocatableCallerOut,
    isClosureType,
    isValueType,
    isValueTypeName,
    isHandlePassedInPlace,
    isCollectibleCallerOut,
    isRecordInout,
    isHandlePassing,
    renderCallerOutInstance,
    underlyingType,
};
