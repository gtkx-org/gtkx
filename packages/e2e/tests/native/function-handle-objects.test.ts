import * as GObject from "@gtkx/gi/gobject";
import { bind, call, type Descriptor, resolveFunction } from "@gtkx/native";
import { getClassType, getHandle, typeName } from "@gtkx/runtime";
import { expect, test } from "vitest";
import { fixtureLibrary } from "./helpers/fixture-library.js";
import { drainAfterEachTest, drainGC } from "./helpers/memory.js";

drainAfterEachTest();

const library = fixtureLibrary("function-handle-objects");
const BUFFER: Descriptor = { kind: "buffer" };
const VOID: Descriptor = { kind: "void" };
const COMPLETE: Descriptor = {
    kind: "callback",
    argDescriptors: [BUFFER],
    returnDescriptor: VOID,
    scope: "async",
    hasUserData: true,
    userDataIndex: 0,
};
const hold = bind(library, "gtkx_object_buffer_hold", [BUFFER, COMPLETE], VOID);
const complete = bind(library, "gtkx_object_buffer_complete", [], VOID);

test("an async buffer pins a generated GObject wrapper until completion", async () => {
    let completed = 0;
    const begin = (): WeakRef<GObject.Object> => {
        const object = new GObject.Object();
        call(
            hold,
            [
                getHandle(object),
                () => {
                    completed += 1;
                },
            ],
            1,
        );

        return new WeakRef(object);
    };
    const weak = begin();
    await drainGC(5);
    expect(weak.deref()).toBeDefined();
    call(complete, []);
    await drainGC(5);
    expect(completed).toBe(1);
    expect(weak.deref()).toBeUndefined();
});

test("function handles cannot be passed as generated boxed data", () => {
    const name = typeName(getClassType(GObject.Closure));
    if (name === null) {
        throw new Error("The closure type is unavailable");
    }
    const boxed: Descriptor = { kind: "boxed", ownership: "borrowed", typeName: name };
    const compare = bind(library, "gtkx_object_buffer_equal", [boxed, boxed], { kind: "int32" });
    const pointer = resolveFunction(library, "gtkx_object_buffer_complete");

    expect(() => call(compare, [pointer, pointer])).toThrow();
});
