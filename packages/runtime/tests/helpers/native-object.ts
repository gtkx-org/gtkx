import { type Descriptor, type ExternalObject, type Handle } from "@gtkx/native";
import { wrapHandle } from "@gtkx/runtime";
import { BIGUINT64, callArgs, GOBJECT_LIB } from "./native-utils.js";

const UINT32_DESCRIPTOR: Descriptor = { kind: "uint32" };
const POINTER_DESCRIPTOR: Descriptor = { kind: "buffer" };
const OBJECT_DESCRIPTOR: Descriptor = { kind: "object", ownership: "full" };

const newObjectFromNative = (gtype: bigint): object =>
    wrapHandle(
        callArgs(
            GOBJECT_LIB,
            "g_object_new_with_properties",
            [
                { type: BIGUINT64, value: gtype },
                { type: UINT32_DESCRIPTOR, value: 0 },
                { type: POINTER_DESCRIPTOR, value: null },
                { type: POINTER_DESCRIPTOR, value: null },
            ],
            OBJECT_DESCRIPTOR,
        ) as ExternalObject<Handle>,
    );

export { newObjectFromNative };
