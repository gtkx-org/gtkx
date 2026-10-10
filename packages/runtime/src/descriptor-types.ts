import type { Descriptor as NativeDescriptor, Ownership } from "./native.js";

type NativeCallbackDescriptor = Extract<NativeDescriptor, { kind: "callback" }>;
type CallbackDefaults = "scope" | "hasDestroy" | "destroyKind" | "hasUserData" | "canThrow";

type Descriptor =
    | Exclude<
          NativeDescriptor,
          {
              kind: "array" | "hashtable" | "callback" | "ref";
          }
      >
    | (Omit<Extract<NativeDescriptor, { kind: "bytes" }>, "kind"> & { kind: "string" })
    | { kind: "indirect"; innerDescriptor: Descriptor; ownership: Ownership }
    | { kind: "pointerValue"; innerDescriptor: Descriptor }
    | { kind: "boolean" }
    | { kind: "unichar" }
    | { kind: "enum"; sharedLibrary: string; getTypeFnName: string; isSigned: boolean; members?: number[] }
    | { kind: "flags"; sharedLibrary: string; getTypeFnName: string; isSigned: boolean; mask?: number }
    | (Omit<Extract<NativeDescriptor, { kind: "array" }>, "itemDescriptor"> & {
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
    | (Omit<Extract<NativeDescriptor, { kind: "ref" }>, "innerDescriptor"> & { innerDescriptor: Descriptor });

export type { Descriptor };
