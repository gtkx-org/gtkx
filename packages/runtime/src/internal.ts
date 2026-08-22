export {
    bigint64T,
    biguint64T,
    booleanT,
    bufferT,
    float32T,
    float64T,
    gtypeT,
    int8T,
    int16T,
    int32T,
    int64T,
    objectBorrowedT,
    objectFullT,
    stringBorrowedT,
    stringFullT,
    uint8T,
    uint16T,
    uint32T,
    uint64T,
    unicharT,
    voidT,
} from "./descriptors.js";
export { checkError, createErrorDomain } from "./error.js";
export { type ApplicationInstance, getApplicationInstance } from "./lifecycle.js";
export { registerClassType, resolveWrapperClass, wrapHandle } from "./registry.js";
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
