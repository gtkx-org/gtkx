import {
    bindField,
    type Descriptor,
    type ExternalObject,
    type Handle,
    read as nativeRead,
    write as nativeWrite,
} from "@gtkx/native";

const fieldCodecCache = new Map<string, ReturnType<typeof bindField>>();

const boundFieldCodec = (descriptor: Descriptor): ReturnType<typeof bindField> => {
    const key = JSON.stringify(descriptor);
    let codec = fieldCodecCache.get(key);
    if (codec === undefined) {
        codec = bindField(descriptor);
        fieldCodecCache.set(key, codec);
    }
    return codec;
};

export const readField = (handle: ExternalObject<Handle>, descriptor: Descriptor, offset: number): unknown =>
    nativeRead(handle, boundFieldCodec(descriptor), offset);

export const writeField = (
    handle: ExternalObject<Handle>,
    descriptor: Descriptor,
    offset: number,
    value: unknown,
): unknown => nativeWrite(handle, boundFieldCodec(descriptor), offset, value);
