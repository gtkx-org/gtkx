import type { Descriptor as NativeDescriptor, Ownership } from "./native.js";

/** @inline */
type NativeCallbackDescriptor = Extract<NativeDescriptor, { kind: "callback" }>;
/** @inline */
type CallbackDefaults = "scope" | "hasDestroy" | "destroyKind" | "hasUserData";
/** @inline */
type InstanceDefaults = "isCallerAllocated" | "isInline" | "isValueSafe";
/** @inline */
type ArrayDefaults = "elementOwnership" | "isBytes" | "isCallerAllocated" | "isZeroTerminated";
/** @inline */
type OptionalMetadata<T, Keys extends keyof T> = Omit<T, Keys> & Partial<Pick<T, Keys>>;
/** @inline */
type BytesDescriptor = OptionalMetadata<Extract<NativeDescriptor, { kind: "bytes" }>, "hasOwnedStorage">;
/** @inline */
type ObjectDescriptor = Omit<
    OptionalMetadata<Extract<NativeDescriptor, { kind: "object" }>, "isCallScoped">,
    "typeResolver"
> & {
    typeName?: string;
};
/** @inline */
type RecordDescriptor<Kind extends "boxed" | "struct"> = Omit<
    OptionalMetadata<Extract<NativeDescriptor, { kind: Kind }>, InstanceDefaults>,
    "abiFields" | "typeResolver" | "hasTypeGetter" | "freeResolver" | "copyResolver" | "copyConverter"
>;
/** @inline */
interface BoxedDescriptor extends RecordDescriptor<"boxed"> {
    abiFields?: Descriptor[];
    sharedLibrary?: string;
    getTypeFnName?: string;
    freeFnName?: string;
}
/** @inline */
interface StructDescriptor extends RecordDescriptor<"struct"> {
    abiFields?: Descriptor[];
    sharedLibrary?: string;
    copyFnName?: string;
    freeFnName?: string;
    copyStrategy?: string;
}
/** @inline */
type FundamentalDescriptor = Omit<
    OptionalMetadata<Extract<NativeDescriptor, { kind: "fundamental" }>, InstanceDefaults>,
    "refResolver" | "unrefResolver" | "unrefLabel"
> & {
    sharedLibrary: string;
    refFnName: string;
    unrefFnName: string;
    typeName?: string;
};
/** @inline */
interface ArrayDescriptor extends Omit<
    OptionalMetadata<Extract<NativeDescriptor, { kind: "array" }>, ArrayDefaults>,
    "itemDescriptor"
> {
    itemDescriptor: Descriptor;
    preserveNull?: boolean;
}
/** @inline */
interface ReferenceDescriptor extends Omit<
    OptionalMetadata<Extract<NativeDescriptor, { kind: "ref" }>, "inout">,
    "innerDescriptor"
> {
    innerDescriptor: Descriptor;
}

type Descriptor =
    | Exclude<
          NativeDescriptor,
          {
              kind:
                  | "bytes"
                  | "object"
                  | "boxed"
                  | "struct"
                  | "fundamental"
                  | "array"
                  | "hashtable"
                  | "callback"
                  | "bigint64"
                  | "biguint64"
                  | "reference"
                  | "ref";
          }
      >
    | { kind: "int64" }
    | { kind: "uint64" }
    | { kind: "bigint64" }
    | { kind: "biguint64" }
    | BytesDescriptor
    | (Omit<BytesDescriptor, "kind"> & { kind: "string" })
    | ObjectDescriptor
    | BoxedDescriptor
    | StructDescriptor
    | FundamentalDescriptor
    | { kind: "indirect"; innerDescriptor: Descriptor; ownership: Ownership }
    | { kind: "pointerValue"; innerDescriptor: Descriptor }
    | { kind: "boolean" }
    | { kind: "unichar" }
    | { kind: "enum"; sharedLibrary: string; getTypeFnName: string; isSigned: boolean; members?: number[] }
    | { kind: "flags"; sharedLibrary: string; getTypeFnName: string; isSigned: boolean; mask?: number }
    | ArrayDescriptor
    | (Omit<Extract<NativeDescriptor, { kind: "hashtable" }>, "keyDescriptor" | "valueDescriptor"> & {
          keyDescriptor: Descriptor;
          valueDescriptor: Descriptor;
      })
    | (Omit<NativeCallbackDescriptor, "signature" | "releaseWithCompletion" | CallbackDefaults> &
          Partial<Pick<NativeCallbackDescriptor, CallbackDefaults>> & {
              argDescriptors: Descriptor[];
              returnDescriptor: Descriptor;
              userDataIndex?: number;
              canThrow?: boolean;
              userDataArgIndex?: number;
              destroyArgIndex?: number;
          })
    | ReferenceDescriptor;

export type { Descriptor };
