/** @internal */
export { registerElementMetadata } from "./element-metadata.js";
export {
    elementMetadataVersion,
    registeredElementProperties,
    registeredElementSignals,
} from "./element-metadata.js";
export { checkError, createErrorDomain } from "./error.js";
export { type ApplicationInstance, getApplicationInstance } from "./lifecycle.js";
export { getExactWrapperClass, registerClassType, resolveWrapperClass, wrapHandle } from "./registry.js";
export { hasSignalListener } from "./signal.js";
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
