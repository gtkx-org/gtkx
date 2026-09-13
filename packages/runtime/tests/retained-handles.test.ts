import { Object as GObject } from "@gtkx/gi/gobject";
import { bind, call, type ExternalObject, getType, type Handle, read } from "@gtkx/native";
import { callParent, getHandle, registerClass, TYPE_INVALID } from "@gtkx/runtime";
import { expect, it } from "vitest";
import { gcUntil } from "./helpers/native-utils.js";
import { createTypeNameFactory } from "./helpers/unique-name.js";

const uniqueName = createTypeNameFactory("_");
const compare = bind("libglib-2.0.so.0", "g_direct_equal", [{ kind: "buffer" }, { kind: "buffer" }], {
    kind: "int32",
});

it("rejects a retained handle after its GObject wrapper and native instance are finalized", async () => {
    let isFinalized = false;

    class TrackedObject extends GObject {
        vfuncFinalize(): void {
            isFinalized = true;
            callParent(TrackedObject, "vfuncFinalize", this);
        }
    }

    registerClass(TrackedObject, { typeName: uniqueName("GtkxRetainedHandle") });

    const retain = (): {
        handle: ExternalObject<Handle>;
        field: ExternalObject<Handle>;
        weak: WeakRef<TrackedObject>;
    } => {
        const object = new TrackedObject({});
        const handle = getHandle(object);
        expect(call(compare, [handle, handle]).value).toBe(1);

        const field = read(handle, {
            kind: "struct", ownership: "borrowed", isInline: true, size: 8,
        }, 0) as ExternalObject<Handle>;

        return { handle, field, weak: new WeakRef(object) };
    };

    const retained = retain();
    await gcUntil(() => isFinalized);
    expect(isFinalized).toBe(true);
    expect(retained.weak.deref()).toBeUndefined();
    expect(() => call(compare, [retained.handle, null])).toThrow();
    expect(() => call(compare, [retained.field, null])).toThrow();
    expect(getType(retained.handle)).toBe(TYPE_INVALID);
});
