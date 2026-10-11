import type { Descriptor as NativeDescriptor, Ownership } from "./native.js";

type NativeCallbackDescriptor = Extract<NativeDescriptor, { kind: "callback" }>;
type CallbackDefaults = "scope" | "hasDestroy" | "destroyKind" | "hasUserData" | "canThrow";
type InstanceDefaults = "isCallerAllocated" | "isInline" | "isValueSafe";
type ArrayDefaults = "elementOwnership" | "isBytes" | "isCallerAllocated" | "isZeroTerminated";
type OptionalMetadata<T, Keys extends keyof T> = Omit<T, Keys> & Partial<Pick<T, Keys>>;
type BytesDescriptor = OptionalMetadata<Extract<NativeDescriptor, { kind: "bytes" }>, "hasOwnedStorage">;
type RecordDescriptor<Kind extends "boxed" | "struct"> = Omit<
    OptionalMetadata<Extract<NativeDescriptor, { kind: Kind }>, InstanceDefaults>,
    "abiFields" | "typeResolver" | "hasTypeGetter" | "freeResolver" | "copyResolver" | "copyConverter"
>;
interface BoxedDescriptor extends RecordDescriptor<"boxed"> {
    abiFields?: Descriptor[];
    sharedLibrary?: string;
    getTypeFnName?: string;
    freeFnName?: string;
}
interface StructDescriptor extends RecordDescriptor<"struct"> {
    abiFields?: Descriptor[];
    sharedLibrary?: string;
    copyFnName?: string;
    freeFnName?: string;
    copyStrategy?: string;
}
type FundamentalDescriptor = Omit<
    OptionalMetadata<Extract<NativeDescriptor, { kind: "fundamental" }>, InstanceDefaults>,
    "refResolver" | "unrefResolver" | "unrefLabel"
> & {
    sharedLibrary: string;
    refFnName: string;
    unrefFnName: string;
    typeName?: string;
};

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
    | (Omit<OptionalMetadata<Extract<NativeDescriptor, { kind: "object" }>, "isCallScoped">, "typeResolver"> & {
          typeName?: string;
      })
    | BoxedDescriptor
    | StructDescriptor
    | FundamentalDescriptor
    | { kind: "indirect"; innerDescriptor: Descriptor; ownership: Ownership }
    | { kind: "pointerValue"; innerDescriptor: Descriptor }
    | { kind: "boolean" }
    | { kind: "unichar" }
    | { kind: "enum"; sharedLibrary: string; getTypeFnName: string; isSigned: boolean; members?: number[] }
    | { kind: "flags"; sharedLibrary: string; getTypeFnName: string; isSigned: boolean; mask?: number }
    | (Omit<OptionalMetadata<Extract<NativeDescriptor, { kind: "array" }>, ArrayDefaults>, "itemDescriptor"> & {
          itemDescriptor: Descriptor;
          preserveNull?: boolean;
      })
    | (Omit<Extract<NativeDescriptor, { kind: "hashtable" }>, "keyDescriptor" | "valueDescriptor"> & {
          keyDescriptor: Descriptor;
          valueDescriptor: Descriptor;
      })
    | (Omit<
          NativeCallbackDescriptor,
          "argDescriptors" | "returnDescriptor" | "releaseWithCompletion" | CallbackDefaults
      > &
          Partial<Pick<NativeCallbackDescriptor, CallbackDefaults>> & {
              argDescriptors: Descriptor[];
              returnDescriptor: Descriptor;
              userDataArgIndex?: number;
              destroyArgIndex?: number;
          })
    | (Omit<OptionalMetadata<Extract<NativeDescriptor, { kind: "ref" }>, "inout">, "innerDescriptor"> & {
          innerDescriptor: Descriptor;
      });

export type { Descriptor };
