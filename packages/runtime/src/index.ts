import "./exit-hook.js";

/** @public */
export { type ApplicationClass, type CommandLineApplication, createApplication } from "./application-class.js";
/** @public */
export { type ClosureCallback, ClosureMarshalError, toClosure, tryToClosure } from "./closure.js";
/** @public */
export { createErrorDomain, type ErrorDomain } from "./error.js";
/** @public */
export { onExit, quit, quitApplication, runApplication, type RunApplicationResult } from "./lifecycle.js";
/** @public */
export { offSignal, onceSignal, onSignal } from "./listeners.js";
/** @public */
export { installMixins, type Mixin } from "./mixin.js";
/** @public */
export { fromNative, toNative } from "./native-value.js";
/** @public */
export {
    type ConstructBinding,
    type ConstructBindings,
    getObjectProperty,
    newObjectWithProperties,
    registerConstructProperties,
    setObjectProperty,
} from "./object.js";
/** @public */
export { promisify } from "./promisify.js";
/** @public */
export { type Interface, registerClass } from "./register-class.js";
/** @public */
export {
    getClassType,
    getHandle,
    getInstanceType,
    getWrapperClass,
    registerInterface,
    registerWrapperClass,
    type StaticBase,
    setHandle,
    wrapHandle,
} from "./registry.js";
/** @public */
export { connectSignal, disconnectSignal, emitSignal, getSignalBaseName, type SignalHandler } from "./signal.js";
/** @public */
export { t } from "./t.js";
/** @public */
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
/** @public */
export { getBoxedValue, setBoxedValue } from "./value.js";
/** @public */
export { fromVariant, toVariant, type VariantValue } from "./variant.js";
/** @public */
export { callParent, callVfunc } from "./vfunc-call.js";
/** @public */
export { alloc, type ExternalObject, type Handle, read, write } from "@gtkx/native";
/** @public */
export { type AnyClass } from "@gtkx/utils";
