import type { GirCallable, GirParameter, GirReturnValue, ParameterTransfer } from "../gir/parameter.js";
import type { CArrayType, TypeId } from "../gir/type-id.js";
import type { GirType } from "../gir/type.js";
import type { ModuleContext } from "../writer/context.js";
import { isCallerAllocatedOut, isInoutParameter } from "../gir/parameter.js";
import {
    isCollectibleCallerOut,
    isHandlePassedInPlace,
    isPointerReplacingRecord,
    underlyingType,
} from "../store/gi/param-marshal.js";
import { recordInlineSize } from "../store/gi/record-layout.js";
import { isScalarRef } from "./descriptor-render.js";

type CapabilityIssueCode =
    "caller-allocated-array-length" |
    "invalid-caller-allocated-record-layout" |
    "parameter-indirection-mismatch" |
    "plain-record-input-transfer" |
    "plain-record-output-transfer" |
    "type-erased-callback" |
    "unregistered-union" |
    "unsupported-caller-allocated-type" |
    "variadic-parameter";

type CapabilityIssueLocation =
    { kind: "instance" } |
    { kind: "parameter"; index: number } |
    { kind: "return" };

type CapabilityIssue = {
    code: CapabilityIssueCode;
    disposition: "omit" | "runtime" | "stub";
    location: CapabilityIssueLocation;
};

type CallableCapability = {
    kind: "supported" | "runtime-rejected" | "unsupported";
    issues: CapabilityIssue[];
};

type CallableSignature = GirCallable & { instance?: GirParameter | undefined };

type RecordOccurrence = {
    ref: TypeId | undefined;
    transfer: ParameterTransfer;
    input: boolean;
    output: boolean;
    location: CapabilityIssueLocation;
};

const POINTER_DEPTH = 1;

const isPointerType = (context: ModuleContext, type: GirType): boolean => {
    switch (type.kind) {
        case "primitive": {
            return type.category === "string";
        }
        case "record": {
            return recordInlineSize(context, type.value) === undefined;
        }
        case "class":
        case "interface":
        case "carray":
        case "list":
        case "hashtable": {
            return true;
        }
        case "alias":
        case "callback":
        case "enum":
        case "varargs": {
            return false;
        }
    }
};

const isPointerElement = (context: ModuleContext, element: TypeId): boolean => {
    if (isScalarRef(context.library, element)) {
        return false;
    }

    const type = underlyingType(context, element);

    return type !== undefined && isPointerType(context, type);
};

const carrayIndirection = (context: ModuleContext, type: CArrayType): number =>
    POINTER_DEPTH + (isPointerElement(context, type.element) ? POINTER_DEPTH : 0);

const typeIndirection = (context: ModuleContext, type: GirType): number | undefined => {
    switch (type.kind) {
        case "primitive": {
            return type.category === "string" ? POINTER_DEPTH : undefined;
        }
        case "callback":
        case "class":
        case "hashtable":
        case "interface":
        case "list":
        case "record": {
            return POINTER_DEPTH;
        }
        case "carray": {
            return carrayIndirection(context, type);
        }
        case "alias":
        case "enum":
        case "varargs": {
            return undefined;
        }
    }
};

const baseIndirection = (context: ModuleContext, ref: TypeId | undefined): number | undefined => {
    if (isScalarRef(context.library, ref)) {
        return 0;
    }

    const type = ref === undefined ? undefined : underlyingType(context, ref);

    return type === undefined ? undefined : typeIndirection(context, type);
};

const declaredIndirection = (parameter: GirParameter): number | undefined => {
    const cType = parameter.cType;

    if (cType === undefined) {
        return undefined;
    }

    return cType.split("*").length - 1;
};

const inoutIndirection = (context: ModuleContext, parameter: GirParameter, base: number): number => {
    const hasAdditionalPointer =
        isPointerReplacingRecord(context, parameter) || isScalarRef(context.library, parameter.type);

    return base + Number(hasAdditionalPointer);
};

const marshalledIndirection = (context: ModuleContext, parameter: GirParameter): number | undefined => {
    const base = baseIndirection(context, parameter.type);

    if (base === undefined) {
        return undefined;
    }

    if (isCallerAllocatedOut(parameter) || isHandlePassedInPlace(context, parameter)) {
        return base;
    }

    if (isInoutParameter(parameter)) {
        return inoutIndirection(context, parameter, base);
    }

    return base + POINTER_DEPTH;
};

const hasCallerSuppliedLength = (context: ModuleContext, parameter: GirParameter): boolean => {
    const type = parameter.type === undefined ? undefined : underlyingType(context, parameter.type);

    return type?.kind === "carray" && type.lengthParameterIndex !== undefined;
};

const isUnmarshalableCallerOut = (context: ModuleContext, parameter: GirParameter): boolean => {
    if (hasCallerSuppliedLength(context, parameter)) {
        return true;
    }

    return !isCollectibleCallerOut(context, parameter) && !parameter.optional;
};

const resolvedRecord = (
    context: ModuleContext,
    ref: TypeId | undefined,
): Extract<GirType, { kind: "record" }> | undefined => {
    if (ref === undefined) {
        return undefined;
    }

    const type = underlyingType(context, ref);

    return type?.kind === "record" ? type : undefined;
};

const isPlainRecord = (type: Extract<GirType, { kind: "record" }>): boolean =>
    type.value.glibGetType === undefined;

const isOwnershipTransfer = (transfer: ParameterTransfer): boolean => transfer !== "none";

const isUnregisteredUnion = (type: Extract<GirType, { kind: "record" }>): boolean =>
    type.value.isUnion && type.value.glibGetType === undefined;

const isTransferredPlainRecord = (
    type: Extract<GirType, { kind: "record" }>,
    transfer: ParameterTransfer,
): boolean => isPlainRecord(type) && isOwnershipTransfer(transfer);

const plainRecordTransferIssues = (occurrence: RecordOccurrence): CapabilityIssue[] => {
    const issues: CapabilityIssue[] = [];

    if (occurrence.input) {
        issues.push({
            code: "plain-record-input-transfer",
            disposition: "runtime",
            location: occurrence.location,
        });
    }

    if (occurrence.output) {
        issues.push({
            code: "plain-record-output-transfer",
            disposition: "runtime",
            location: occurrence.location,
        });
    }

    return issues;
};

const recordTransferIssues = (context: ModuleContext, occurrence: RecordOccurrence): CapabilityIssue[] => {
    const type = resolvedRecord(context, occurrence.ref);

    if (type === undefined) {
        return [];
    }

    if (isUnregisteredUnion(type) && occurrence.input) {
        return [{ code: "unregistered-union", disposition: "runtime", location: occurrence.location }];
    }

    if (!isTransferredPlainRecord(type, occurrence.transfer)) {
        return [];
    }

    return plainRecordTransferIssues(occurrence);
};

const hasInvalidCallerAllocatedRecordLayout = (
    context: ModuleContext,
    parameter: GirParameter,
): boolean => {
    if (!isCallerAllocatedOut(parameter)) {
        return false;
    }

    const type = resolvedRecord(context, parameter.type);

    return type !== undefined && recordInlineSize(context, type.value) === undefined;
};

const hasIndirectionMismatch = (context: ModuleContext, parameter: GirParameter): boolean => {
    const declared = declaredIndirection(parameter);
    const marshalled = marshalledIndirection(context, parameter);

    if (declared === undefined || marshalled === undefined) {
        return false;
    }

    return declared !== marshalled;
};

const isTypeErasedCallback = (context: ModuleContext, parameter: GirParameter): boolean => {
    if (parameter.closureIndex === undefined) {
        return false;
    }

    const type = parameter.type === undefined ? undefined : underlyingType(context, parameter.type);

    return type?.kind === "callback" && type.value.parameters.length === 0;
};

const callerAllocatedIssueCode = (
    context: ModuleContext,
    parameter: GirParameter,
): CapabilityIssueCode | undefined => {
    if (hasInvalidCallerAllocatedRecordLayout(context, parameter)) {
        return "invalid-caller-allocated-record-layout";
    }

    if (!isUnmarshalableCallerOut(context, parameter)) {
        return undefined;
    }

    return hasCallerSuppliedLength(context, parameter)
        ? "caller-allocated-array-length"
        : "unsupported-caller-allocated-type";
};

const structuralParameterIssueCode = (
    context: ModuleContext,
    parameter: GirParameter,
): CapabilityIssueCode | undefined => {
    if (parameter.isVarargs) {
        return "variadic-parameter";
    }

    if (isTypeErasedCallback(context, parameter)) {
        return "type-erased-callback";
    }

    if (parameter.direction === "in") {
        return undefined;
    }

    if (isCallerAllocatedOut(parameter)) {
        return callerAllocatedIssueCode(context, parameter);
    }

    return hasIndirectionMismatch(context, parameter) ? "parameter-indirection-mismatch" : undefined;
};

const parameterIssues = (
    context: ModuleContext,
    parameter: GirParameter,
    location: CapabilityIssueLocation,
): CapabilityIssue[] => {
    const isCallerAllocated = isCallerAllocatedOut(parameter);

    const issues = recordTransferIssues(context, {
        ref: parameter.type,
        transfer: parameter.transferOwnership,
        input: parameter.direction !== "out",
        output: parameter.direction !== "in" && !isCallerAllocated,
        location,
    });

    const structural = structuralParameterIssueCode(context, parameter);

    if (structural !== undefined) {
        issues.push({
            code: structural,
            disposition: structural === "invalid-caller-allocated-record-layout" ? "stub" : "omit",
            location,
        });
    }

    return issues;
};

const returnIssues = (context: ModuleContext, returnValue: GirReturnValue): CapabilityIssue[] =>
    recordTransferIssues(context, {
        ref: returnValue.type,
        transfer: returnValue.transferOwnership,
        input: false,
        output: true,
        location: { kind: "return" },
    });

const capabilityKind = (issues: CapabilityIssue[]): CallableCapability["kind"] => {
    if (issues.some((issue) => issue.disposition === "omit")) {
        return "unsupported";
    }

    return issues.length === 0 ? "supported" : "runtime-rejected";
};

const callableCapability = (context: ModuleContext, callable: CallableSignature): CallableCapability => {
    const issues: CapabilityIssue[] = [];

    if (callable.instance !== undefined) {
        issues.push(...parameterIssues(context, callable.instance, { kind: "instance" }));
    }

    for (const [index, parameter] of callable.parameters.entries()) {
        issues.push(...parameterIssues(context, parameter, { kind: "parameter", index }));
    }

    issues.push(...returnIssues(context, callable.returnValue));

    return { kind: capabilityKind(issues), issues };
};

const isCallableEmittable = (capability: CallableCapability): boolean => capability.kind !== "unsupported";

const isCallableStubbed = (capability: CallableCapability): boolean =>
    isCallableEmittable(capability) && capability.issues.some((issue) => issue.disposition === "stub");

export { callableCapability, isCallableEmittable, isCallableStubbed };
