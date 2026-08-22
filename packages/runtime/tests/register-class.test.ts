import * as Gio from "@gtkx/gi/gio";
import { Object as GObject, TYPE_OBJECT, typeFromName, typeName, typeParent } from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { getHandle, registerClass } from "@gtkx/runtime";
import { resolveWrapperClass } from "@gtkx/runtime/internal";
import { describe, expect, it } from "vitest";
import { isInstanceOfType } from "./helpers/gobject.js";
import { newObjectFromNative } from "./helpers/native-object.js";
import { createTypeNameFactory } from "./helpers/unique-name.js";

const uniqueName = createTypeNameFactory("_");

describe("registerClass — registration", () => {
    it("registers a new GType derived from the parent class", () => {
        const name = uniqueName("GtkxTestSubclass");
        class CustomLabel extends Gtk.Label {}
        registerClass(CustomLabel, { typeName: name });
        const gtype = typeFromName(name);
        expect(gtype).not.toBe(0n);
        expect(typeName(gtype)).toBe(name);
        expect(typeName(typeParent(gtype))).toBe("GtkLabel");
    });

    it("registers the JS class so resolveWrapperClass resolves to it for the new GType", () => {
        const name = uniqueName("GtkxResolvableSubclass");
        class CustomButton extends Gtk.Button {}
        registerClass(CustomButton, { typeName: name });
        const newGtype = typeFromName(name);
        expect(resolveWrapperClass(newGtype)).toBe(CustomButton);
    });

    it("falls back to klass.name when no typeName option is supplied", () => {
        const dynamicName = uniqueName("GtkxAutoNameSubclass");
        const klass = { [dynamicName]: class extends Gtk.Box {} }[dynamicName] as typeof Gtk.Box;
        registerClass(klass);
        expect(typeFromName(dynamicName)).not.toBe(0n);
    });

    it("rejects classes that do not extend a registered wrapper class", () => {
        class NotANativeObject {
            marker = "plain-js-class";
        }

        expect(() =>
            registerClass(NotANativeObject as Parameters<typeof registerClass>[0], {
                typeName: uniqueName("ShouldNotRegister"),
            }),
        ).toThrow(/must extend a registered wrapper class/);
    });

    it("rejects a name that is already registered with the type system", () => {
        const name = uniqueName("GtkxAlreadyRegistered");
        class FirstUse extends Gtk.Label {}
        class SecondUse extends Gtk.Label {}
        registerClass(FirstUse, { typeName: name });
        expect(() => registerClass(SecondUse, { typeName: name })).toThrow(/already registered/);
    });
});

describe("registerClass — accessor safety", () => {
    it("does not invoke a subclass getter while discovering vfuncs", () => {
        const reads: unknown[] = [];

        class WithGetter extends Gtk.Label {
            get derived(): string {
                reads.push(this);

                return "derived";
            }
        }

        registerClass(WithGetter, { typeName: uniqueName("GtkxGetterSubclass") });
        expect(reads).toHaveLength(0);
        expect(new WithGetter().derived).toBe("derived");
        expect(reads).toHaveLength(1);
    });
});

describe("registerClass — interface vtable isolation", () => {
    it("keeps an overridden interface vfunc off the parent type and off sibling subclasses", () => {
        const plain = new Gio.ListStore({ itemType: TYPE_OBJECT });
        plain.append(new GObject({}));

        class FirstStore extends Gio.ListStore {
            override vfuncGetNItems(): number {
                return 111;
            }
        }

        class SecondStore extends Gio.ListStore {
            override vfuncGetNItems(): number {
                return 222;
            }
        }

        registerClass(FirstStore, { typeName: uniqueName("GtkxFirstStore") });
        registerClass(SecondStore, { typeName: uniqueName("GtkxSecondStore") });
        const first = new FirstStore({ itemType: TYPE_OBJECT });
        const second = new SecondStore({ itemType: TYPE_OBJECT });
        expect(plain.getNItems()).toBe(1);
        expect(first.getNItems()).toBe(111);
        expect(second.getNItems()).toBe(222);
    });
});

describe("registerClass — vfunc dispatch", () => {
    it("auto-discovers a class vfunc override from a subclass method", () => {
        const name = uniqueName("GtkxVfuncSubclass");

        class CustomWidget extends Gtk.Widget {
            override vfuncMeasure(): [number, number, number, number] {
                return [42, 42, -1, -1];
            }
        }

        registerClass(CustomWidget, { typeName: name });
        const customGtype = typeFromName(name);
        expect(customGtype).not.toBe(0n);
        const instance = newObjectFromNative(customGtype);
        expect(instance).toBeInstanceOf(CustomWidget);
        expect((instance as Gtk.Widget).measure(Gtk.Orientation.HORIZONTAL, -1)).toEqual([42, 42, -1, -1]);
    });

    it("auto-discovers and dispatches a vfunc override for an interface inherited from the parent", () => {
        const name = uniqueName("GtkxInheritedInterfaceVfunc");
        const parserFinishedCalls: number[] = [];

        class CustomWidget extends Gtk.Widget {
            override vfuncParserFinished(): void {
                parserFinishedCalls.push(1);
            }
        }

        registerClass(CustomWidget, { typeName: name });
        const customGtype = typeFromName(name);
        expect(customGtype).not.toBe(0n);
        const instance = newObjectFromNative(customGtype);
        expect(isInstanceOfType(getHandle(instance), typeFromName("GtkBuildable"))).toBe(true);
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
            override vfuncParserFinished(...args: unknown[]): void {
                observed.push({ positionalArgs: args, thisRef: this });
            }
        }

        registerClass(CustomWidget, { typeName: name });
        const builder = Gtk.Builder.new();
        builder.addFromString(`<interface><object class="${name}" id="customWidget"/></interface>`, -1);
        expect(observed).toHaveLength(1);
        const call = observed[0];

        if (!call) {
            throw new Error("expected one observed vfunc call");
        }

        expect(call.positionalArgs).toHaveLength(1);
        expect(call.positionalArgs[0]).toBe(builder);
        expect(call.thisRef).toBe(builder.getObject("customWidget"));
    });
});

describe("registerClass — vfunc argument and return marshalling", () => {
    it("lifts a boxed vfunc argument to its typed wrapper, not a raw handle", () => {
        const name = uniqueName("GtkxVfuncBoxedArg");
        const observed: { isTextIter: boolean; offset: number }[] = [];

        class CustomBuffer extends Gtk.TextBuffer {
            override vfuncInsertText(iter: Gtk.TextIter): void {
                observed.push({ isTextIter: iter instanceof Gtk.TextIter, offset: iter.getOffset() });
            }
        }

        registerClass(CustomBuffer, { typeName: name });
        const buffer = new CustomBuffer();
        buffer.insertAtCursor("hi", 2);
        expect(observed).toEqual([{ isTextIter: true, offset: 0 }]);
    });

    it("unwraps a handle-typed vfunc return so the caller receives the object, not null", () => {
        class ReturnedItem extends GObject {}
        registerClass(ReturnedItem, { typeName: uniqueName("GtkxVfuncReturnedItem") });
        const returned = new ReturnedItem();

        class ReturningModel extends Gtk.StringList {
            override vfuncGetNItems(): number {
                return 1;
            }

            override vfuncGetItem(position: number): GObject | null {
                return position === 0 ? returned : null;
            }
        }

        registerClass(ReturningModel, { typeName: uniqueName("GtkxVfuncReturnsObject") });
        const model = new ReturningModel();
        const viaVtable = model.getItem(0);
        expect(viaVtable).toBe(returned);
    });
});

describe("registerClass — caller-allocated and scalar out parameters", () => {
    it("fills a caller-allocated out boxed parameter from the handler's return value", () => {
        class BorderedColumnView extends Gtk.ColumnView {
            override vfuncGetBorder(): [boolean, Gtk.Border] {
                return [true, new Gtk.Border({ top: 11, bottom: 22, left: 33, right: 44 })];
            }
        }

        registerClass(BorderedColumnView, { typeName: uniqueName("GtkxVfuncCallerOutBoxed") });
        const view = new BorderedColumnView();
        const [isSet, border] = view.getBorder();
        expect(isSet).toBe(true);
        expect(border.top).toBe(11);
        expect(border.bottom).toBe(22);
        expect(border.left).toBe(33);
        expect(border.right).toBe(44);
    });

    it("writes scalar out parameters from the handler's returned tuple", () => {
        class CustomWidget extends Gtk.Widget {
            override vfuncMeasure(): [number, number, number, number] {
                return [42, 48, -1, -1];
            }
        }

        registerClass(CustomWidget, { typeName: uniqueName("GtkxVfuncScalarOut") });
        const widget = new CustomWidget();
        const result = widget.measure(Gtk.Orientation.HORIZONTAL, -1);
        expect(result).toEqual([42, 48, -1, -1]);
    });
});

describe("registerClass — construct-time initialization", () => {
    it("runs initialization from the subclass constructor with a live handle", () => {
        const name = uniqueName("GtkxConstructorInit");
        const handles: unknown[] = [];

        class CustomObject extends GObject {
            initialized = false;

            constructor() {
                super({});
                this.initialized = true;
                handles.push(getHandle(this));
            }
        }

        registerClass(CustomObject, { typeName: name });
        const instance = new CustomObject();
        expect(instance.initialized).toBe(true);
        expect(handles).toEqual([getHandle(instance)]);
    });
});
