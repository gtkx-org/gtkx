import type { Descriptor as NativeDescriptor } from "@gtkx/native";

type Descriptor =
    Exclude<NativeDescriptor, {
        kind: "array" | "hashtable" | "callback" | "ref";
    }> |
    { kind: "boolean" } |
    { kind: "unichar" } |
    { kind: "enum"; sharedLibrary: string; getTypeFnName: string; isSigned: boolean; members?: number[] } |
    { kind: "flags"; sharedLibrary: string; getTypeFnName: string; isSigned: boolean; mask?: number } |
    (Omit<Extract<NativeDescriptor, { kind: "array" }>, "itemDescriptor"> & { itemDescriptor: Descriptor }) |
    (Omit<Extract<NativeDescriptor, { kind: "hashtable" }>, "keyDescriptor" | "valueDescriptor"> & {
        keyDescriptor: Descriptor;
        valueDescriptor: Descriptor;
    }) |
    (Omit<Extract<NativeDescriptor, { kind: "callback" }>, "argDescriptors" | "returnDescriptor"> & {
        argDescriptors: Descriptor[];
        returnDescriptor: Descriptor;
    }) |
    (Omit<Extract<NativeDescriptor, { kind: "ref" }>, "innerDescriptor"> & { innerDescriptor: Descriptor });

export type { Descriptor };
