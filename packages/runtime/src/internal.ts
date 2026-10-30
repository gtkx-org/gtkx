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

type SignalMethodMember = "connect" | "disconnect" | "emit" | "off" | "on" | "once";

/**
 * `unknown` when the receiver's type keeps the signal method `K`, and the natural member's brand
 * when a GIR method of that name replaces it. It is an indexed access rather than a conditional
 * type so it also resolves for the polymorphic `this` of a subclass body.
 */
type SignalMethodReceiver<T, K extends SignalMethodMember> = NonNullable<
    (T & { [naturalSignalMember]?: Record<SignalMethodMember, unknown> })[typeof naturalSignalMember]
>[K];

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
export { newParamSpecOverride, propertyValueType } from "./properties.js";
export { propertyWriteComplete } from "./property-brand.js";
export type { DescriptorFreePropertySpec } from "./property-brand.js";
export type { Camelized, Dashed, ReadableProperties, WritableProperties } from "./property-types.js";
export { createRegexBindings } from "./regex.js";
export { getExactWrapperClass, getVfuncRegistry, peekTypeClass, resolveWrapperClass } from "./registry.js";
export type { SignalMethodReceiver };
export { classSignalMember, naturalSignalMember, signalEmitMapOverride, signalMapOverride } from "./signal-brand.js";
export { emitSignalByName, signalConnect, signalEmit };
export { hasSignalListener } from "./signal.js";
export {
    canonicalSignalName,
    connectSignalByName,
    installSignalDispatch,
    type SignalEmitArguments,
    type SignalEmitName,
    type SignalEmitResult,
    type SignalHandlerFor,
    type SignalHandlerId,
    type SignalMap,
    type SignalName,
} from "./signal.js";
export { retainWrapperClasses };
export { defineStatics } from "./statics.js";
export { fromValue, getBoxedValue, getValueType, setBoxedValue, toValue } from "./value.js";
export { registerClassOption } from "./class-options.js";
export {
    connectNativeSignal,
    disconnectNativeSignalHandlers,
    findNativeSignalHandler,
    isNativeHandleAlive,
    type NativeHandle,
} from "./native-lifetime.js";
export { initializeWrapper } from "./wrapper-brand.js";
export { keepAlive } from "./keep-alive.js";
export { reportExternalMemory, setWrapperBorrow } from "./native.js";
export { resolveFunction } from "./native-bindings.js";
