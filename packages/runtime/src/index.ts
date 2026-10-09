import "./exit-hook.js";

export { CallbackMarshalError } from "./callback.js";
export { type ClosureCallback, ClosureMarshalError, toClosure, tryToClosure } from "./closure.js";
export type { Descriptor } from "./descriptor-types.js";
export { createErrorDomain, type ErrorDomain } from "./error.js";
export { type Field, type StridedField } from "./field.js";
export { read, write } from "./field.js";
export { onExit, quit } from "./lifecycle.js";
export { offSignal, onceSignal, onSignal } from "./listeners.js";
export { installMixins, type Mixin } from "./mixin.js";
export { fromNative, toHashTableEntries, toNative } from "./native-value.js";
export {
    type ConstructBinding,
    type ConstructBindings,
    newObjectWithProperties,
    registerConstructProperties,
} from "./object.js";
export { promisify, trimFinish } from "./promisify.js";
export { coerceObjectProperty, getDeclaredPropertyName, isReadableProperty } from "./properties.js";
export {
    type Interface,
    registerClass,
    type RegisteredClass,
    type SignalGType,
    type SignalSpec,
} from "./register-class.js";
export {
    getClassType,
    getHandle,
    getInstanceType,
    getWrapperClass,
    installInterfaces,
    type InterfaceClass,
    registerClassStruct,
    registerInterface,
    registerWrapperClass,
    registerWrapperClassResolver,
    type StaticBase,
    setHandle,
    wrapHandle,
    type WrapperClass,
    type NativeIdentity,
    type NativeInstance,
    type WrapperClassResolver,
} from "./registry.js";
export {
    connectSignal,
    disconnectSignal,
    emitSignal,
    getSignalBaseName,
    type SignalHandler,
    type SignalHandlerId,
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
    typeFromName,
    typeInterfaces,
    typeIsA,
    typeName,
    typeParent,
    valueIsA,
} from "./type.js";
export { fromValue, type JsValue, toValueHandle, tryToValueHandle, ValueMarshalError } from "./value.js";
export { callParent, callVfunc } from "./vfunc-call.js";
export { alloc, type ExternalObject, type Handle } from "@gtkx/native";
export { onLog, type LogLevel, type LogListener, type LogSubscription } from "@gtkx/native";
export { type AnyClass } from "@gtkx/utils";
