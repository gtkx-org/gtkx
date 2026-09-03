/** @internal */
export { registerElementMetadata } from "./element-metadata.js";
export {
    elementMetadataVersion,
    registeredElementProperties,
    registeredElementSignals,
} from "./element-metadata.js";
export { createErrorDomain } from "./error.js";
export { type ApplicationInstance, getApplicationInstance } from "./lifecycle.js";
export { markSyntheticSignalMembers } from "./mixin.js";
export { getExactWrapperClass, resolveWrapperClass } from "./registry.js";
export {
    classSignalMember,
    naturalSignalMember,
    signalEmitMapOverride,
    signalMapOverride,
    type SignalMethodReceiver,
} from "./signal-brand.js";
export { hasSignalListener } from "./signal.js";
export {
    canonicalDetailedSignalName,
    canonicalSignalName,
    connectSignalByName,
    emitSignalByName,
    installSignalDispatch,
    signalConnect,
    signalEmit,
} from "./signal.js";
export { resolveType } from "./type.js";
export {
    fromValue,
    getBoxedValue,
    getValueType,
    inoutValueForBoxedDescriptor,
    newValueForDescriptor,
    outValueForBoxedDescriptor,
    toValue,
} from "./value.js";
