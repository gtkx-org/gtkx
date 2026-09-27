import * as GIMarshallingTests from "@gtkx/gi/gimarshallingtests";
import * as GObject from "@gtkx/gi/gobject";
import { callParent, registerClass } from "@gtkx/runtime";
import { expect, test } from "vitest";
import { drainAfterEachTest } from "./helpers/memory.js";

drainAfterEachTest();

const registrations = { count: 0 };
const uniqueName = () => `GtkxGeneratedVfuncDispatch${String(registrations.count++)}`;

test("a generated class caller reaches its installed slot repeatedly", () => {
    const Registered = registerClass(class extends GIMarshallingTests.Object {
        override vfuncMethodInt8ArgAndOutCaller(value: number): number {
            return value * 2;
        }
    }, { typeName: uniqueName() });
    const instance = new Registered({});
    expect(instance.methodInt8ArgAndOutCaller(21)).toBe(42);
    expect([1, 2, 3].map((value) => instance.methodInt8ArgAndOutCaller(value))).toEqual([2, 4, 6]);
});

test("a generated interface caller reaches the installed implementation", () => {
    const seen: number[] = [];
    class Implementer extends GObject.Object implements GIMarshallingTests.InterfaceImplImpl {
        vfuncTestInt8In(value: number): void {
            seen.push(value + 100);
        }
    }
    const Registered = registerClass(Implementer, {
        typeName: uniqueName(), implements: [GIMarshallingTests.Interface],
    });
    GIMarshallingTests.testInterfaceTestInt8In(new Registered({}), 1);
    expect(seen).toEqual([101]);
});

test("parent dispatch reaches the replaced slot while the generated caller reaches the child", () => {
    const Parent = registerClass(class extends GIMarshallingTests.Object {
        override vfuncVfuncReturnValueOnly(): bigint {
            return 1n;
        }
    }, { typeName: uniqueName() });
    class Child extends Parent {
        override vfuncVfuncReturnValueOnly(): bigint {
            return 2n;
        }
    }
    const Registered = registerClass(Child, { typeName: uniqueName() });
    const instance = new Registered({});
    expect(instance.vfuncReturnValueOnly()).toBe(2n);
    expect(callParent(Child, "vfuncVfuncReturnValueOnly", instance)).toBe(1n);
});

test("a generated caller reaches a slot inherited from a registered parent", () => {
    const Parent = registerClass(class extends GIMarshallingTests.Object {
        override vfuncVfuncReturnValueOnly(): bigint {
            return 7n;
        }
    }, { typeName: uniqueName() });
    const Child = registerClass(class extends Parent {}, { typeName: uniqueName() });
    expect(new Child({}).vfuncReturnValueOnly()).toBe(7n);
});

test("a generated zero-input void vfunc runs during construction", () => {
    const constructed: GObject.Object[] = [];
    const Registered = registerClass(class extends GObject.Object {
        override vfuncConstructed(): void {
            super.vfuncConstructed();
            constructed.push(this);
        }
    }, { typeName: uniqueName() });
    const instance = new Registered({});
    expect(constructed).toEqual([instance]);
});

test("generated string vfuncs marshal their argument and returned string", () => {
    const Registered = registerClass(class extends GIMarshallingTests.Object {
        override vfuncMethodStrArgOutRet(value: string): [string, number] {
            return [`${value}-x`, 42];
        }
    }, { typeName: uniqueName() });
    expect(new Registered({}).methodStrArgOutRet("gtk")).toEqual(["gtk-x", 42]);
});

test("a throwing implementation propagates through its generated caller", () => {
    const Registered = registerClass(class extends GIMarshallingTests.Object {
        override vfuncVfuncMethWithErr(): boolean {
            throw new Error("Refused");
        }
    }, { typeName: uniqueName() });
    expect(() => new Registered({}).vfuncMethWithError(0)).toThrow();
});
