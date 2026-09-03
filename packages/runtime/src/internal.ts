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
    elementMetadataVersion,
    registeredElementProperties,
    registeredElementSignals,
} from "./element-metadata.js";
export { createErrorDomain } from "./error.js";
export { markSyntheticSignalMembers };
export { type ApplicationInstance, getApplicationInstance } from "./lifecycle.js";
export {
    descriptorFreePropertySpec,
    propertyMapOverride,
    writablePropertyMapOverride,
} from "./property-brand.js";
export { getExactWrapperClass, resolveWrapperClass } from "./registry.js";
export type { SignalMethodReceiver };
export {
    classSignalMember,
    naturalSignalMember,
    signalEmitMapOverride,
    signalMapOverride,
} from "./signal-brand.js";
export { hasSignalListener } from "./signal.js";
export { emitSignalByName, signalConnect, signalEmit };
export {
    canonicalDetailedSignalName,
    canonicalSignalName,
    connectSignalByName,
    installSignalDispatch,
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
