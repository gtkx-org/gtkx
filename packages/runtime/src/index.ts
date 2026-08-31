import "./exit-hook.js";

/** @public */
export { type ApplicationClass, type CommandLineApplication, createApplication } from "./application-class.js";
/** @public */
export { CallbackMarshalError } from "./callback.js";
/** @public */
export { type ClosureCallback, ClosureMarshalError, toClosure, tryToClosure } from "./closure.js";
/** @public */
export { createErrorDomain, type ErrorDomain } from "./error.js";
/** @public */
export { type Field, type StridedField } from "./field.js";
/** @public */
export { onExit, quit, quitApplication, runApplication, type RunApplicationResult } from "./lifecycle.js";
/** @public */
export { offSignal, onceSignal, onSignal } from "./listeners.js";
/** @public */
export { installMixins, type Mixin } from "./mixin.js";
/** @public */
export { fromNative, toHashTableEntries, toNative } from "./native-value.js";
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
export { getParamSpecFlags, getParamSpecOwnerType, getParamSpecValueType } from "./param-spec.js";
/** @public */
export { promisify, trimFinish } from "./promisify.js";
/** @public */
export {
    coerceObjectProperty,
    getDeclaredPropertyName,
    isReadableProperty,
    newParamSpecOverride,
} from "./properties.js";
/** @public */
export { matchAllRegex, matchRegex } from "./regex.js";
/** @public */
export { type Interface, registerClass, type SignalGType, type SignalSpec } from "./register-class.js";
/** @public */
export {
    getClassType,
    getHandle,
    getInstanceType,
    getWrapperClass,
    installInterfaces,
    peekTypeClass,
    registerClassStruct,
    registerInterface,
    registerWrapperClass,
    registerWrapperClassResolver,
    type StaticBase,
    setHandle,
    wrapHandle,
    type WrapperClass,
    type WrapperClassResolver,
} from "./registry.js";
/** @public */
export {
    connectSignal,
    disconnectSignal,
    emitSignal,
    getSignalBaseName,
    type SignalHandler,
    signalForHandlerName,
} from "./signal.js";
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
    retainWrapperClasses,
    typeFromName,
    typeInterfaces,
    typeIsA,
    typeName,
    typeParent,
    valueIsA,
} from "./type.js";
/** @public */
export {
    fromValue,
    getBoxedValue,
    type JsValue,
    setBoxedValue,
    toValueHandle,
    tryToValueHandle,
    ValueMarshalError,
} from "./value.js";
/** @public */
export {
    type ByteArray,
    type FromVariantOptions,
    fromVariant,
    type RecursiveFromVariantOptions,
    type RecursiveVariantValue,
    toVariant,
    type VariantInput,
    type VariantValue,
} from "./variant.js";
/** @public */
export { callParent, callVfunc } from "./vfunc-call.js";
/** @public */
export { alloc, type ExternalObject, type Handle, read, write } from "@gtkx/native";
/** @public */
export { type AnyClass } from "@gtkx/utils";
