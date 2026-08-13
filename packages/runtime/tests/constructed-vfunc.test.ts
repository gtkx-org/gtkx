import * as Gio from "@gtkx/gi/gio";
import { Object as GObject, TYPE_OBJECT, typeFromName } from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { getWrapper } from "@gtkx/native";
import { getHandle, registerClass } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";
import { newObjectFromNative } from "./helpers/native-object.js";
import { createTypeNameFactory } from "./helpers/unique-name.js";

const uniqueName = createTypeNameFactory("_");

const record = <T>(log: T[], entry: T): T => {
    log.push(entry);

    return entry;
};

describe("vfuncConstructed — the wrapper the override runs against", () => {
    it("runs once during `new` with `this` bound to the object `new` returns", () => {
        const seen: object[] = [];

        class IdentityObject extends GObject {
            override vfuncConstructed(): void {
                super.vfuncConstructed();
                seen.push(this);
            }
        }

        registerClass(IdentityObject, { typeName: uniqueName("GtkxConstructedIdentity") });
        const instance = new IdentityObject();
        expect(seen).toHaveLength(1);
        expect(seen[0]).toBe(instance);
    });

    it("exposes the native handle to the override and keeps it after construction", () => {
        const seen: unknown[] = [];

        class HandleObject extends GObject {
            override vfuncConstructed(): void {
                super.vfuncConstructed();
                seen.push(getHandle(this));
            }
        }

        registerClass(HandleObject, { typeName: uniqueName("GtkxConstructedHandle") });
        const instance = new HandleObject();
        expect(seen[0]).toBe(getHandle(instance));
        expect(getWrapper(getHandle(instance))).toBe(instance);
    });
});

describe("vfuncConstructed — what the override can do with the instance", () => {
    it("reads a construct property the caller passed in", () => {
        const seen: bigint[] = [];

        class ReadingStore extends Gio.ListStore {
            override vfuncConstructed(): void {
                super.vfuncConstructed();
                seen.push(this.getItemType());
            }
        }

        registerClass(ReadingStore, { typeName: uniqueName("GtkxConstructedReadsProperty") });
        const store = new ReadingStore({ itemType: TYPE_OBJECT });
        expect(seen).toEqual([store.getItemType()]);
        expect(seen).toEqual([TYPE_OBJECT]);
    });

    it("calls a method on the instance and the effect survives construction", () => {
        class WritingLabel extends Gtk.Label {
            override vfuncConstructed(): void {
                super.vfuncConstructed();
                this.setLabel("set in constructed");
            }
        }

        registerClass(WritingLabel, { typeName: uniqueName("GtkxConstructedWritesProperty") });
        expect(new WritingLabel().getLabel()).toBe("set in constructed");
    });
});

describe("vfuncConstructed — ordering", () => {
    it("runs before the subclass field initializers and constructor body", () => {
        const order: string[] = [];

        class OrderedObject extends GObject {
            marker = record(order, "field-initializer");

            constructor() {
                super({});
                order.push("constructor-body");
            }

            override vfuncConstructed(): void {
                super.vfuncConstructed();
                order.push("constructed");
            }
        }

        registerClass(OrderedObject, { typeName: uniqueName("GtkxConstructedOrdering") });
        expect(new OrderedObject().marker).toBe("field-initializer");
        expect(order).toEqual(["constructed", "field-initializer", "constructor-body"]);
    });
});

describe("vfuncConstructed — the subclass state the override cannot see", () => {
    it("runs before the field initializers, which then overwrite what it assigned", () => {
        const seen: unknown[] = [];

        class FieldObject extends GObject {
            marker = "from the initializer";

            override vfuncConstructed(): void {
                super.vfuncConstructed();
                seen.push(this.marker);
                this.marker = "from constructed";
            }
        }

        registerClass(FieldObject, { typeName: uniqueName("GtkxConstructedFieldInitializer") });
        expect(seen).toEqual([]);
        expect(new FieldObject().marker).toBe("from the initializer");
        expect(seen).toEqual([undefined]);
    });

    it("cannot reach a private field the subclass declares", () => {
        const errors: string[] = [];

        class PrivateObject extends GObject {
            #count = 0;

            override vfuncConstructed(): void {
                super.vfuncConstructed();

                try {
                    this.#count += 1;
                } catch (error) {
                    errors.push(String(error));
                }
            }

            getCount(): number {
                return this.#count;
            }
        }

        registerClass(PrivateObject, { typeName: uniqueName("GtkxConstructedPrivateField") });
        expect(new PrivateObject().getCount()).toBe(0);
        expect(errors).toEqual([expect.stringContaining("Cannot read private member #count")]);
    });

    it("keeps what the override assigns to a property the subclass never initializes", () => {
        class AssigningObject extends GObject {
            declare marker: string;

            override vfuncConstructed(): void {
                super.vfuncConstructed();
                this.marker = "from constructed";
            }
        }

        registerClass(AssigningObject, { typeName: uniqueName("GtkxConstructedAssignedProperty") });
        expect(new AssigningObject().marker).toBe("from constructed");
    });
});

describe("vfuncConstructed — the subclass state an instance created from C never gets", () => {
    it("never runs the subclass constructor at all", () => {
        const name = uniqueName("GtkxConstructedNativeFields");
        const errors: string[] = [];

        class NativeFieldObject extends GObject {
            #count = 0;

            marker = "from the initializer";

            declare assigned: string;

            override vfuncConstructed(): void {
                super.vfuncConstructed();
                this.assigned = "from constructed";
            }

            getCount(): number {
                try {
                    return this.#count;
                } catch (error) {
                    errors.push(String(error));

                    return -1;
                }
            }
        }

        registerClass(NativeFieldObject, { typeName: name });
        const instance = newObjectFromNative(typeFromName(name));
        expect(instance).toBeInstanceOf(NativeFieldObject);
        expect((instance as NativeFieldObject).marker).toBeUndefined();
        expect((instance as NativeFieldObject).assigned).toBe("from constructed");
        expect((instance as NativeFieldObject).getCount()).toBe(-1);
        expect(errors).toEqual([expect.stringContaining("Cannot read private member #count")]);
    });
});

describe("vfuncConstructed — failures", () => {
    it("makes `new` throw when the override throws", () => {
        class ThrowingObject extends GObject {
            override vfuncConstructed(): void {
                super.vfuncConstructed();
                throw new Error("constructed refused");
            }
        }

        registerClass(ThrowingObject, { typeName: uniqueName("GtkxConstructedThrows") });
        expect(() => new ThrowingObject()).toThrow(/constructed refused/);
    });
});

describe("vfuncConstructed — wrapper identity under nesting", () => {
    it("gives each nested construction its own wrapper", () => {
        class InnerObject extends GObject {}
        registerClass(InnerObject, { typeName: uniqueName("GtkxConstructedInner") });
        const nested: InnerObject[] = [];

        class OuterObject extends GObject {
            override vfuncConstructed(): void {
                super.vfuncConstructed();
                nested.push(new InnerObject());
            }
        }

        registerClass(OuterObject, { typeName: uniqueName("GtkxConstructedOuter") });
        const outer = new OuterObject();
        const [inner] = nested;

        if (inner === undefined) {
            throw new Error("expected the nested construction to have run");
        }

        expect(inner).toBeInstanceOf(InnerObject);
        expect(getWrapper(getHandle(outer))).toBe(outer);
        expect(getWrapper(getHandle(inner))).toBe(inner);
        expect(getHandle(outer)).not.toBe(getHandle(inner));
    });

    it("gives a two-level hierarchy a single wrapper", () => {
        class BaseObject extends GObject {}
        class DerivedObject extends BaseObject {}
        registerClass(BaseObject, { typeName: uniqueName("GtkxConstructedTwoLevelBase") });
        registerClass(DerivedObject, { typeName: uniqueName("GtkxConstructedTwoLevelDerived") });
        const derived = new DerivedObject();
        expect(getWrapper(getHandle(derived))).toBe(derived);
    });
});

describe("vfuncConstructed — instances created from C", () => {
    it("runs against a usable wrapper for an instance created from C", () => {
        const name = uniqueName("GtkxConstructedFromNative");
        const seen: unknown[] = [];

        class NativeObject extends GObject {
            override vfuncConstructed(): void {
                super.vfuncConstructed();
                seen.push(getHandle(this));
            }
        }

        registerClass(NativeObject, { typeName: name });
        const instance = newObjectFromNative(typeFromName(name));
        expect(instance).toBeInstanceOf(NativeObject);
        expect(seen).toHaveLength(1);
        expect(seen[0]).toBe(getHandle(instance));
        expect(getWrapper(getHandle(instance))).toBe(instance);
    });

    it("runs against a usable wrapper for an instance Gtk.Builder creates", () => {
        const name = uniqueName("GtkxConstructedFromBuilder");
        const seen: object[] = [];

        class BuiltLabel extends Gtk.Label {
            override vfuncConstructed(): void {
                super.vfuncConstructed();
                this.setLabel("set in constructed");
                seen.push(this);
            }
        }

        registerClass(BuiltLabel, { typeName: name });
        const builder = Gtk.Builder.new();
        builder.addFromString(`<interface><object class="${name}" id="built"/></interface>`, -1);
        const built = builder.getObject("built");
        expect(built).toBeInstanceOf(BuiltLabel);
        expect(seen).toEqual([built]);
        expect((built as BuiltLabel).getLabel()).toBe("set in constructed");
    });
});

describe("vfuncConstructed — a C-created instance inside a JavaScript construction", () => {
    it("keeps the two wrappers apart", () => {
        const name = uniqueName("GtkxConstructedInterleavedInner");
        class InterleavedInner extends GObject {}
        registerClass(InterleavedInner, { typeName: name });
        const nested: object[] = [];

        class InterleavedOuter extends GObject {
            override vfuncConstructed(): void {
                super.vfuncConstructed();
                nested.push(newObjectFromNative(typeFromName(name)));
            }
        }

        registerClass(InterleavedOuter, { typeName: uniqueName("GtkxConstructedInterleavedOuter") });
        const outer = new InterleavedOuter();
        const [inner] = nested;

        if (inner === undefined) {
            throw new Error("expected the interleaved construction to have run");
        }

        expect(inner).toBeInstanceOf(InterleavedInner);
        expect(getWrapper(getHandle(outer))).toBe(outer);
        expect(getWrapper(getHandle(inner))).toBe(inner);
        expect(getHandle(outer)).not.toBe(getHandle(inner));
    });
});
