import * as GObject from "@gtkx/gi/gobject";
import { alloc, copy, read, registerClass as registerNativeClass, write } from "@gtkx/native";
import { getClassType, getHandle, registerClass, t } from "@gtkx/runtime";
import { expect, test } from "vitest";
import { fixtureLibrary } from "./helpers/fixture-library.js";
import { drainAfterEachTest } from "./helpers/memory.js";

drainAfterEachTest();

const library = fixtureLibrary("object-class-layout", "gobject-2.0");
const classSize = t.bind(library, "gtkx_object_class_size", [], t.uint32);
const registrations = { count: 0 };

function initializedClass(): { handle: ReturnType<typeof getHandle>; gtype: bigint } {
    let klass: GObject.ObjectClass | undefined;
    const Registered = registerClass(class extends GObject.Object {}, {
        typeName: `GtkxGeneratedClassMemory${String(registrations.count++)}`,
        classInit(value) {
            if (!(value instanceof GObject.ObjectClass)) {
                throw new TypeError("Unexpected class structure");
            }
            klass = value;
        },
    });
    if (klass === undefined) {
        throw new Error("Class initialization did not run");
    }

    return { handle: getHandle(klass), gtype: getClassType(Registered) };
}

const sources = [
    {
        name: "type lookup",
        create: () => ({
            handle: getHandle(GObject.ObjectClass.peek(GObject.Object)),
            gtype: getClassType(GObject.Object),
        }),
    },
    { name: "class initialization", create: initializedClass },
];

test.each(sources)("$name retains readable class memory", ({ create }) => {
    const { handle, gtype } = create();
    const size = classSize() as number;
    expect(read(handle, { kind: "biguint64" }, 0)).toBe(gtype);
    expect(typeof read(handle, { kind: "uint8" }, size - 1)).toBe("number");
});

test.each(sources)("$name rejects access beyond the class allocation", ({ create }) => {
    const { handle } = create();
    const size = classSize() as number;
    expect(() => read(handle, { kind: "uint8" }, size)).toThrow();
    expect(() => read(handle, { kind: "biguint64" }, size - 1)).toThrow();
    expect(() => write(handle, { kind: "uint8" }, size, 0)).toThrow();
    expect(() => copy(alloc(size + 1), handle, size + 1)).toThrow();
});

test("class registration rejects a classed parent outside GObject", () => {
    expect(() => registerNativeClass("GtkxGeneratedInvalidParamSubclass", getClassType(GObject.ParamSpec))).toThrow();
});
