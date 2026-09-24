import type { GirParameter, ParameterTransfer } from "../gir/parameter.js";
import type { CArrayType, TypeId } from "../gir/type-id.js";
import type { GirType } from "../gir/type.js";
import type { ModuleContext } from "../writer/context.js";
import { deriveElementTransfer } from "../gir/parameter.js";
import { isConstructibleRecord, isValueMarshalable } from "../store/gi/value-marshalable.js";
import { cTypePointerDepth, underlyingType } from "./type-shape.js";

type InlineRecordArrayDirection = "from-native" | "lent-from-native" | "to-native";

type InlineRecordArrayOptions = {
    direction: InlineRecordArrayDirection;
    hasOutIndirection?: boolean;
    isCallerAllocated?: boolean;
    isRetained?: boolean;
};

type InlineRecordArray = {
    container: "carray" | "garray";
    record: Extract<GirType, { kind: "record" }>;
};

type AdmissionContext = Pick<ModuleContext, "library">;

const carrayElementPointerDepth = (array: CArrayType, hasOutIndirection: boolean): number => {
    const declared = cTypePointerDepth(array.elementCType);

    return hasOutIndirection ? declared - 1 : declared;
};

const carrayInlineRecord = (
    context: AdmissionContext,
    array: CArrayType,
    hasOutIndirection: boolean,
): InlineRecordArray | undefined => {
    if (carrayElementPointerDepth(array, hasOutIndirection) > 0) {
        return undefined;
    }

    const record = underlyingType(context.library, array.element);

    return record?.kind === "record" ? { container: "carray", record } : undefined;
};

const garrayInlineRecord = (
    context: AdmissionContext,
    container: GirType | undefined,
): InlineRecordArray | undefined => {
    if (container?.kind !== "list" || container.flavor !== "garray") {
        return undefined;
    }

    const record = underlyingType(context.library, container.element);

    return record?.kind === "record" ? { container: "garray", record } : undefined;
};

const inlineRecordArray = (
    context: AdmissionContext,
    ref: TypeId | undefined,
    hasOutIndirection: boolean,
): InlineRecordArray | undefined => {
    const container = underlyingType(context.library, ref);

    if (container?.kind === "carray") {
        return carrayInlineRecord(context, container, hasOutIndirection);
    }

    return garrayInlineRecord(context, container);
};

const isUnsupportedToNative = (transfer: ParameterTransfer, options: InlineRecordArrayOptions): boolean =>
    options.isCallerAllocated === true || options.isRetained === true || transfer !== "none";

const isUnsupportedFromNative = (
    context: AdmissionContext,
    array: InlineRecordArray,
    transfer: ParameterTransfer,
    options: InlineRecordArrayOptions,
): boolean => {
    if (transfer === "none" && options.direction === "lent-from-native") {
        return false;
    }

    if (options.isCallerAllocated === true) {
        return true;
    }

    const { namespace, value } = array.record;

    if (!isConstructibleRecord(context, namespace.name, value)) {
        return true;
    }

    if (deriveElementTransfer(transfer) !== "full") {
        return false;
    }

    return array.container === "carray" || transfer !== "full";
};

const hasUnsupportedInlineRecordArray = (
    context: AdmissionContext,
    ref: TypeId | undefined,
    transfer: ParameterTransfer,
    options: InlineRecordArrayOptions,
): boolean => {
    const array = inlineRecordArray(context, ref, options.hasOutIndirection === true);

    if (array === undefined) {
        return false;
    }

    const { namespace, value } = array.record;

    if (isValueMarshalable(context, namespace.name, value)) {
        return false;
    }

    return options.direction === "to-native"
        ? isUnsupportedToNative(transfer, options)
        : isUnsupportedFromNative(context, array, transfer, options);
};

const hasUnsupportedCallbackInput = (context: AdmissionContext, parameter: GirParameter): boolean => {
    if (parameter.direction === "out") {
        return false;
    }

    return hasUnsupportedInlineRecordArray(context, parameter.type, parameter.transferOwnership, {
        direction: "lent-from-native",
        hasOutIndirection: parameter.direction === "inout",
    });
};

const hasUnsupportedCallbackOutput = (context: AdmissionContext, parameter: GirParameter): boolean => {
    if (parameter.direction === "in") {
        return false;
    }

    return hasUnsupportedInlineRecordArray(context, parameter.type, parameter.transferOwnership, {
        direction: "to-native",
        hasOutIndirection: !parameter.callerAllocates,
        isCallerAllocated: parameter.callerAllocates || parameter.direction === "inout",
        isRetained: true,
    });
};

const hasUnsupportedCallbackInlineRecordArray = (
    context: AdmissionContext,
    parameter: GirParameter,
): boolean => hasUnsupportedCallbackInput(context, parameter) || hasUnsupportedCallbackOutput(context, parameter);

export { hasUnsupportedCallbackInlineRecordArray, hasUnsupportedInlineRecordArray };
