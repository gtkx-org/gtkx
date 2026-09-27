import * as GIMarshallingTests from "@gtkx/gi/gimarshallingtests";
import * as GObject from "@gtkx/gi/gobject";
import { alloc, copy, type ExternalObject, getType, type Handle, newObject, read } from "@gtkx/native";
import { getClassType, getHandle, registerClass, setHandle, wrapHandle } from "@gtkx/runtime";
import { expect, test } from "vitest";
import { drainAfterEachTest } from "./helpers/memory.js";

drainAfterEachTest();

const registrations = { count: 0 };
const uniqueName = () => `GtkxGeneratedClassConstruction${String(registrations.count++)}`;
const registerObject = () => registerClass(class extends GObject.Object {}, { typeName: uniqueName() });
const counterClass = () => registerClass(class extends GObject.Object {}, {
    typeName: uniqueName(),
    properties: { count: GObject.paramSpecInt("count", null, null, 0, 100, 0, GObject.ParamFlags.READWRITE) },
});

const construct = (gtype: bigint, names: string[] = [], values: ExternalObject<Handle>[] = []) => {
    let handle: ExternalObject<Handle> | undefined;
    const adopted = newObject(gtype, names, values, {}, (bound) => {
        handle = bound;
    });
    if (handle === undefined) {
        throw new Error("Construction did not associate a handle");
    }

    return { adopted, handle };
};

test("registering a subclass of GObject yields a new named GType with its declared parent", () => {
    const name = uniqueName();
    const Registered = registerClass(class extends GObject.Object {}, { typeName: name });
    const type = getClassType(Registered);
    expect(type).toBeGreaterThan(0n);
    expect(type).not.toBe(getClassType(GObject.Object));
    expect(GObject.typeName(type)).toBe(name);
    expect(GObject.typeParent(type)).toBe(getClassType(GObject.Object));
});

test("registration with default or empty options derives from GObject", () => {
    class GtkxGeneratedDefaultClassOptions extends GObject.Object {}
    class GtkxGeneratedEmptyClassOptions extends GObject.Object {}
    const Default = registerClass(GtkxGeneratedDefaultClassOptions);
    const Empty = registerClass(GtkxGeneratedEmptyClassOptions, {});
    expect(GObject.typeIsA(Default, GObject.Object)).toBe(true);
    expect(GObject.typeIsA(Empty, GObject.Object)).toBe(true);
});

test("a subclass of a registered subclass derives from both ancestors", () => {
    const Parent = registerObject();
    const Child = registerClass(class extends Parent {}, { typeName: uniqueName() });
    expect(GObject.typeParent(Child)).toBe(getClassType(Parent));
    expect(GObject.typeIsA(Child, Parent)).toBe(true);
    expect(GObject.typeIsA(Child, GObject.Object)).toBe(true);
});

test("a registered class implements the interfaces it declares", () => {
    const Registered = registerClass(class extends GObject.Object {}, {
        typeName: uniqueName(), implements: [GObject.TypePlugin],
    });
    expect(GObject.typeIsA(Registered, GObject.TypePlugin)).toBe(true);
});

test("a registered property is installed and absent properties are not found", () => {
    const Registered = counterClass();
    const klass = GObject.ObjectClass.peek(Registered);
    expect(klass.findProperty("count").getName()).toBe("count");
    expect(klass.findProperty("missing")).toBeNull();
});

test("construction and later writes reach registered property accessors", () => {
    const seen: number[] = [];
    class Counter extends GObject.Object {
        declare stored: number | undefined;
        get count(): number {
            return this.stored ?? 0;
        }

        set count(value: number) {
            this.stored = value;
            seen.push(value);
        }
    }
    const Registered = registerClass(Counter, {
        typeName: uniqueName(),
        properties: { count: GObject.paramSpecInt("count", null, null, 0, 100, 0, GObject.ParamFlags.READWRITE) },
    });
    const instance = new Registered({ count: 7 });
    expect(GObject.getProperty(instance, "count")).toBe(7);
    GObject.setProperty(instance, "count", 42);
    expect(GObject.getProperty(instance, "count")).toBe(42);
    expect(seen).toEqual([7, 42]);
});

test("construct properties accept complete unaligned GValue storage", () => {
    const value = new GObject.Value();
    value.init(GObject.TYPE_INT);
    value.setInt(7);
    const owner = alloc(25);
    const inlineValue = { kind: "struct", ownership: "borrowed", isInline: true, size: 24 } as const;
    const unaligned = read(owner, inlineValue, 1) as ExternalObject<Handle>;
    copy(unaligned, getHandle(value), 24);
    const { handle } = construct(getClassType(GIMarshallingTests.Object), ["int"], [unaligned]);
    expect(wrapHandle(handle, GIMarshallingTests.Object).int).toBe(7);
});

test("an abstract registered type rejects construction and supports concrete subclasses", () => {
    const Abstract = registerClass(class extends GObject.Object {}, { typeName: uniqueName(), abstract: true });
    expect(() => new Abstract({})).toThrow();
    const Concrete = registerClass(class extends Abstract {}, { typeName: uniqueName() });
    const instance = new Concrete({});
    expect(getType(getHandle(instance))).toBe(getClassType(Concrete));
});

test.each([
    { name: "generated base", type: () => getClassType(GObject.Object) },
    { name: "registered subtype", type: () => getClassType(registerObject()) },
])("$name construction associates a handle and reports its type", ({ type }) => {
    const gtype = type();
    const { adopted, handle } = construct(gtype);
    expect(adopted).toBeNull();
    expect(getType(handle)).toBe(gtype);
});

test("construction hands the original wrapper to the association callback", () => {
    const Registered = registerObject();
    const wrapper = {};
    let received: unknown;
    newObject(getClassType(Registered), [], [], wrapper, (_handle, bound) => {
        received = bound;
    });
    expect(received).toBe(wrapper);
});

test("a registered wrapper is associated before its constructed vfunc runs", () => {
    const order: string[] = [];
    const Registered = registerClass(class extends GObject.Object {
        override vfuncConstructed(): void {
            order.push("constructed");
        }
    }, { typeName: uniqueName() });
    const wrapper = Object.create(Registered.prototype) as object;
    newObject(getClassType(Registered), [], [], wrapper, (handle, bound) => {
        setHandle(bound, handle);
        order.push("associate");
    });
    expect(order).toEqual(["associate", "constructed"]);
});

test("two constructions of the same type yield distinct instances", () => {
    const Registered = registerObject();
    expect(getHandle(new Registered({}))).not.toBe(getHandle(new Registered({})));
});

test("an association failure returns to the caller and subsequent construction succeeds", () => {
    const constructed: GObject.Object[] = [];
    const Registered = registerClass(class extends GObject.Object {
        override vfuncConstructed(): void {
            super.vfuncConstructed();
            constructed.push(this);
        }
    }, { typeName: uniqueName() });
    expect(() => newObject(getClassType(Registered), [], [], {}, () => {
        throw new Error("Association failed");
    })).toThrow();
    expect(constructed).toEqual([]);
    const instance = new Registered({});
    expect(getType(getHandle(instance))).toBe(getClassType(Registered));
    expect(constructed).toEqual([instance]);
});

test("registering an existing name or a name containing a nul byte throws", () => {
    const name = uniqueName();
    registerClass(class extends GObject.Object {}, { typeName: name });
    expect(() => registerClass(class extends GObject.Object {}, { typeName: name })).toThrow();
    expect(() => registerClass(class extends GObject.Object {}, { typeName: "Gtkx\0Named" })).toThrow();
});

test("class initialization observes its registered type before construction", () => {
    let initialized: bigint | undefined;
    const Registered = registerClass(class extends GObject.Object {}, {
        typeName: uniqueName(),
        classInit(klass) {
            if (!(klass instanceof GObject.ObjectClass)) {
                throw new TypeError("Unexpected class structure");
            }
            initialized = read(getHandle(klass), { kind: "biguint64" }, 0) as bigint;
        },
    });
    expect(initialized).toBe(getClassType(Registered));
    const instance = new Registered({});
    expect(getType(getHandle(instance))).toBe(getClassType(Registered));
});

test("a public class initializer exception propagates to registration", () => {
    expect(() => registerClass(class extends GObject.Object {}, {
        typeName: uniqueName(),
        classInit() {
            throw new Error("Initialization failed");
        },
    })).toThrow();
});
