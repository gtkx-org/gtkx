import { markSyntheticSignalMembers as markSyntheticSignalMembersImpl } from "./mixin.js";
import { naturalSignalMember } from "./signal-brand.js";
import {
    emitSignalByName as emitSignalByNameImpl,
    signalConnect as signalConnectImpl,
    signalEmit as signalEmitImpl,
} from "./signal.js";

const markSyntheticSignalMembers: typeof markSyntheticSignalMembersImpl = markSyntheticSignalMembersImpl;
const emitSignalByName: typeof emitSignalByNameImpl = emitSignalByNameImpl;
const signalConnect: typeof signalConnectImpl = signalConnectImpl;
const signalEmit: typeof signalEmitImpl = signalEmitImpl;

const retainWrapperClasses = (wrappers: readonly unknown[]): readonly unknown[] => wrappers;

type SignalMethodReceiver<T, K extends PropertyKey> = T extends {
    [naturalSignalMember]?: infer TMembers;
}
    ? K extends keyof NonNullable<TMembers>
        ? never
        : unknown
    : unknown;

export { preserveArrayNull } from "./descriptors.js";
/** @internal */
export { registerElementMetadata } from "./element-metadata.js";
export {
    type ElementPropertyEntry,
    elementMetadataVersion,
    registeredElementProperties,
    registeredElementSignals,
} from "./element-metadata.js";
export { fixedArrayEntries } from "./field.js";
export { markSyntheticSignalMembers };
export { getObjectProperty, getProperty, registerConstructFactory, setProperty } from "./object.js";
export { getParamSpecFlags, getParamSpecOwnerType, getParamSpecValueType } from "./param-spec.js";
export { newParamSpecOverride } from "./properties.js";
export { descriptorFreePropertySpec, propertyWriteComplete } from "./property-brand.js";
export type { DescriptorFreePropertySpec } from "./property-brand.js";
export type { Camelized, Dashed, ReadableProperties, WritableProperties } from "./property-types.js";
export { installMatchInfo, matchAllRegex, matchRegex, replaceRegexEval } from "./regex.js";
export { getExactWrapperClass, getVfuncRegistry, peekTypeClass, resolveWrapperClass } from "./registry.js";
export type { SignalMethodReceiver };
export {
    classSignalMember,
    naturalSignalMember,
    signalEmitMapOverride,
    signalMapOverride,
} from "./signal-brand.js";
export { emitSignalByName, signalConnect, signalEmit };
export { hasSignalListener } from "./signal.js";
export {
    canonicalSignalName,
    connectSignalByName,
    installSignalDispatch,
    type SignalEmitArguments,
    type SignalEmitName,
    type SignalEmitResult,
    type SignalHandlerId,
    type SignalMap,
    type SignalName,
} from "./signal.js";
export { retainWrapperClasses };
export { resolveType } from "./type.js";
export {
    fromValue,
    getBoxedValue,
    getValueType,
    inoutValueForBoxedDescriptor,
    newValueForDescriptor,
    outValueForBoxedDescriptor,
    setBoxedValue,
    toValue,
} from "./value.js";
export { registerClassOption } from "./class-options.js";
export {
    connectNativeSignal,
    disconnectNativeSignalHandlers,
    findNativeSignalHandler,
    isNativeHandleAlive,
    type NativeHandle,
} from "./native-lifetime.js";
export { initializeWrapper } from "./wrapper-brand.js";
export { keepAlive, setWrapperBorrow } from "@gtkx/native";
