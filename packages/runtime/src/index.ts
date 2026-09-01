import "./exit-hook.js";

export { type ApplicationClass, type CommandLineApplication, createApplication } from "./application-class.js";
export { CallbackMarshalError } from "./callback.js";
export { type ClosureCallback, ClosureMarshalError, toClosure, tryToClosure } from "./closure.js";
export { createErrorDomain, type ErrorDomain } from "./error.js";
export { type Field, type StridedField } from "./field.js";
export { onExit, quit, quitApplication, runApplication, type RunApplicationResult } from "./lifecycle.js";
export { offSignal, onceSignal, onSignal } from "./listeners.js";
export { installMixins, type Mixin } from "./mixin.js";
export { fromNative, toHashTableEntries, toNative } from "./native-value.js";
export {
    type ConstructBinding,
    type ConstructBindings,
    getObjectProperty,
    newObjectWithProperties,
    registerConstructProperties,
    setObjectProperty,
} from "./object.js";
export { getParamSpecFlags, getParamSpecOwnerType, getParamSpecValueType } from "./param-spec.js";
export { promisify, trimFinish } from "./promisify.js";
export {
    coerceObjectProperty,
    getDeclaredPropertyName,
    isReadableProperty,
    newParamSpecOverride,
} from "./properties.js";
export { matchAllRegex, matchRegex } from "./regex.js";
export { type Interface, registerClass, type SignalGType, type SignalSpec } from "./register-class.js";
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
export {
    connectSignal,
    disconnectSignal,
    emitSignal,
    getSignalBaseName,
    type SignalHandler,
    signalForHandlerName,
} from "./signal.js";
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
    retainWrapperClasses,
    typeFromName,
    typeInterfaces,
    typeIsA,
    typeName,
    typeParent,
    valueIsA,
} from "./type.js";
export {
    fromValue,
    getBoxedValue,
    type JsValue,
    setBoxedValue,
    toValueHandle,
    tryToValueHandle,
    ValueMarshalError,
} from "./value.js";
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
export { callParent, callVfunc } from "./vfunc-call.js";
export { alloc, type ExternalObject, type Handle, read, write } from "@gtkx/native";
export { type AnyClass } from "@gtkx/utils";
