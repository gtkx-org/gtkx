import { getHandle, registerClass } from "@gtkx/ffi";
import { Object as GObject, typeFromName, typeName, typeParent } from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { describe, expect, it } from "vitest";
import { findNativeClass } from "../src/registry.js";
import { instanceIsA } from "./helpers.js";

let suffix = 0;
const uniqueName = (prefix: string): string => `${prefix}_${process.pid}_${++suffix}`;

describe("registerClass — registration", () => {
    it("registers a new GType derived from the parent class", () => {
        const name = uniqueName("GtkxTestSubclass");
        class CustomLabel extends Gtk.Label {}

        registerClass(CustomLabel, { gtypeName: name });

        const gtype = typeFromName(name);
        expect(gtype).not.toBe(0);
        expect(typeName(gtype)).toBe(name);
        expect(typeName(typeParent(gtype))).toBe("GtkLabel");
    });

    it("registers the JS class so findNativeClass resolves to it for the new GType", () => {
        const name = uniqueName("GtkxResolvableSubclass");
        class CustomButton extends Gtk.Button {}

        registerClass(CustomButton, { gtypeName: name });

        const newGtype = typeFromName(name);
        expect(findNativeClass(newGtype)).toBe(CustomButton);
    });

    it("falls back to klass.name when no gtypeName option is supplied", () => {
        const dynamicName = uniqueName("GtkxAutoNameSubclass");
        const klass = { [dynamicName]: class extends Gtk.Box {} }[dynamicName] as typeof Gtk.Box;

        registerClass(klass);

        expect(typeFromName(dynamicName)).not.toBe(0);
    });

    it("rejects classes that do not extend a registered native class", () => {
        class NotANativeObject {}

        expect(() =>
            registerClass(NotANativeObject as unknown as Parameters<typeof registerClass>[0], {
                gtypeName: uniqueName("ShouldNotRegister"),
            }),
        ).toThrow(/must extend a registered native class/);
    });

    it("rejects a name that is already registered with the type system", () => {
        const name = uniqueName("GtkxAlreadyRegistered");
        class FirstUse extends Gtk.Label {}
        class SecondUse extends Gtk.Label {}

        registerClass(FirstUse, { gtypeName: name });
        expect(() => registerClass(SecondUse, { gtypeName: name })).toThrow(/already registered/);
    });
});

describe("registerClass — vfunc dispatch", () => {
    it("auto-discovers a class vfunc override from a subclass method", () => {
        const name = uniqueName("GtkxVfuncSubclass");
        class CustomObject extends GObject {
            setProperty(): void {}
        }

        registerClass(CustomObject, { gtypeName: name });

        const customGtype = typeFromName(name);
        expect(customGtype).not.toBe(0);
        const instance = GObject.newv(customGtype, []);
        expect(instance).toBeDefined();
    });

    it("invokes the auto-discovered class vfunc trampoline when GObject dispatches the slot", () => {
        const name = uniqueName("GtkxVfuncInvocationSubclass");
        const constructedCalls: string[] = [];
        class CustomObject extends GObject {
            constructed(): void {
                constructedCalls.push("constructed invoked");
            }
        }

        registerClass(CustomObject, { gtypeName: name });

        const customGtype = typeFromName(name);
        GObject.newv(customGtype, []);

        expect(constructedCalls).toEqual(["constructed invoked"]);
    });

    it("auto-discovers and dispatches a vfunc override for an interface inherited from the parent", () => {
        const name = uniqueName("GtkxInheritedInterfaceVfunc");
        const parserFinishedCalls: number[] = [];

        class CustomWidget extends Gtk.Widget {
            parserFinished(..._args: unknown[]): void {
                parserFinishedCalls.push(1);
            }
        }

        registerClass(CustomWidget, { gtypeName: name });

        const customGtype = typeFromName(name);
        expect(customGtype).not.toBe(0);

        const instance = GObject.newv(customGtype, []);
        expect(instanceIsA(getHandle(instance), typeFromName("GtkBuildable"))).toBe(true);

        const builder = Gtk.Builder.new();
        builder.addFromString(`<interface><object class="${name}" id="customWidget"/></interface>`, -1);

        expect(parserFinishedCalls).toEqual([1]);
    });
});

describe("registerClass — vfunc self argument convention", () => {
    it("binds self as `this` and does not pass it positionally to vfunc overrides", () => {
        const name = uniqueName("GtkxVfuncSelfArgConvention");
        const observed: { positionalArgs: unknown[]; thisRef: unknown }[] = [];
        class CustomWidget extends Gtk.Widget {
            parserFinished(...args: unknown[]): void {
                observed.push({ positionalArgs: args, thisRef: this });
            }
        }

        registerClass(CustomWidget, { gtypeName: name });

        const builder = Gtk.Builder.new();
        builder.addFromString(`<interface><object class="${name}" id="customWidget"/></interface>`, -1);

        expect(observed).toHaveLength(1);
        const call = observed[0];
        if (!call) throw new Error("expected one observed vfunc call");
        expect(call.positionalArgs).toHaveLength(1);
        expect(call.positionalArgs[0]).toBeInstanceOf(Gtk.Builder);
        expect(call.thisRef).toBeInstanceOf(CustomWidget);
    });
});

describe("registerClass — construction identity", () => {
    it("delivers the same wrapper to a synchronous vfunc and to user code after `new`", () => {
        const name = uniqueName("GtkxConstructIdentity");
        let constructedThis: object | null = null;

        class CustomObject extends GObject {
            constructed(): void {
                constructedThis = this;
            }
        }

        registerClass(CustomObject, { gtypeName: name });

        const instance = new CustomObject({});

        expect(constructedThis).toBe(instance);
    });

    it("makes class field initializers visible on the wrapper after construction returns", () => {
        const name = uniqueName("GtkxConstructFieldVisibility");

        class CustomObject extends GObject {
            counter = 0;

            constructed(): void {
                this.counter = (this.counter ?? 0) + 1;
            }
        }

        registerClass(CustomObject, { gtypeName: name });

        const instance = new CustomObject({});

        expect(instance.counter).toBe(0);
    });
});

describe("registerClass — nested construction", () => {
    it("preserves identity when one constructed vfunc instantiates another type", () => {
        const outerName = uniqueName("GtkxConstructOuter");
        const innerName = uniqueName("GtkxConstructInner");
        let innerThis: object | null = null;
        let outerThis: object | null = null;
        let nestedInstance: object | null = null;

        class InnerObject extends GObject {
            constructed(): void {
                innerThis = this;
            }
        }
        registerClass(InnerObject, { gtypeName: innerName });

        class OuterObject extends GObject {
            constructed(): void {
                outerThis = this;
                nestedInstance = new InnerObject({});
            }
        }
        registerClass(OuterObject, { gtypeName: outerName });

        const outer = new OuterObject({});

        expect(outerThis).toBe(outer);
        expect(innerThis).toBe(nestedInstance);
        expect(outerThis).not.toBe(innerThis);
    });
});
