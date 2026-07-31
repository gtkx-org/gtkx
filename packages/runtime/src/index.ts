import "./exit-hook.js";

export { createErrorDomain, type ErrorDomain } from "./error.js";
export { onExit, quit, quitApplication, runApplication } from "./lifecycle.js";
export { offSignal, onceSignal, onSignal } from "./listeners.js";
export { installMixins, type Mixin } from "./mixin.js";
export { fromNative, toNative } from "./native-value.js";
export { getObjectProperty, newObjectWithProperties, setObjectProperty } from "./object.js";
export { promisify } from "./promisify.js";
export { registerClass } from "./register-class.js";
export {
    getHandle,
    getInstanceType,
    getWrapperClass,
    registerInterface,
    registerWrapperClass,
    type StaticBase,
    setHandle,
    tryGetHandle,
    wrapHandle,
} from "./registry.js";
export { connectSignal, emitSignal, getSignalBaseName, type SignalHandler } from "./signal.js";
export { t } from "./t.js";
export {
    resolveType,
    TYPE_BOOLEAN,
    TYPE_BOXED,
    TYPE_CHAR,
    TYPE_DOUBLE,
    TYPE_ENUM,
    TYPE_FLAGS,
    TYPE_FLOAT,
    TYPE_GTYPE,
    TYPE_INT,
    TYPE_INT64,
    TYPE_INTERFACE,
    TYPE_INVALID,
    TYPE_LONG,
    TYPE_NONE,
    TYPE_OBJECT,
    TYPE_PARAM,
    TYPE_POINTER,
    TYPE_STRING,
    TYPE_UCHAR,
    TYPE_UINT,
    TYPE_UINT64,
    TYPE_ULONG,
    TYPE_UNICHAR,
    TYPE_VARIANT,
    type TypedClass,
    typeFromName,
    typeInterfaces,
    typeIsA,
    typeName,
    typeParent,
    valueIsA,
} from "./type.js";
export { getBoxedValue, setBoxedValue } from "./value.js";
export { alloc, type ExternalObject, type Handle, read, setWrapper, write } from "@gtkx/native";
