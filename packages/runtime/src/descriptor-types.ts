import type { Descriptor as NativeDescriptor } from "@gtkx/native";

type Descriptor =
    Exclude<NativeDescriptor, {
        kind: "array" | "hashtable" | "callback" | "ref";
    }> |
    (Omit<Extract<NativeDescriptor, { kind: "bytes" }>, "kind"> & { kind: "string" }) |
    { kind: "boolean" } |
    { kind: "unichar" } |
    { kind: "enum"; sharedLibrary: string; getTypeFnName: string; isSigned: boolean; members?: number[] } |
    { kind: "flags"; sharedLibrary: string; getTypeFnName: string; isSigned: boolean; mask?: number } |
    (Omit<Extract<NativeDescriptor, { kind: "array" }>, "itemDescriptor"> & {
        itemDescriptor: Descriptor;
        preserveNull?: boolean;
    }) |
    (Omit<Extract<NativeDescriptor, { kind: "hashtable" }>, "keyDescriptor" | "valueDescriptor"> & {
        keyDescriptor: Descriptor;
        valueDescriptor: Descriptor;
    }) |
    (Omit<
        Extract<NativeDescriptor, { kind: "callback" }>,
        "argDescriptors" | "returnDescriptor" | "scope" | "releaseWithCompletion"
    > & {
        scope?: Extract<NativeDescriptor, { kind: "callback" }>["scope"];
        argDescriptors: Descriptor[];
        returnDescriptor: Descriptor;
    }) |
    (Omit<Extract<NativeDescriptor, { kind: "ref" }>, "innerDescriptor"> & { innerDescriptor: Descriptor });

export type { Descriptor };
