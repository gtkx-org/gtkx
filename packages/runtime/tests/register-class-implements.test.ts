import type * as GLib from "@gtkx/gi/glib";
import type { ParamSpec } from "@gtkx/gi/gobject";
import type { Interface } from "@gtkx/runtime";
import * as Gdk from "@gtkx/gi/gdk";
import * as Gio from "@gtkx/gi/gio";
import {
    Object as GObject,
    ParamFlags,
    paramSpecEnum,
    TYPE_BOOLEAN,
    TYPE_OBJECT,
    TYPE_STRING,
    typeFromName,
    typeIsA,
    TypePlugin,
    Value,
} from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { getHandle, getInstanceType, registerClass } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";
import { isInstanceOfType, pointerValue, stringValue } from "./helpers/gobject.js";
import { createTypeNameFactory } from "./helpers/unique-name.js";

type SectionStore = Gio.ListModel & Gtk.SectionModel;
type SectionInterface = typeof Gio.ListModel | typeof Gtk.SectionModel;
type LevelStoreClass = (new () => Gio.ListModelImpl) & { prototype: Gio.ListModelImpl };
type SplicedBase<T> = Omit<typeof GObject, never> & (new (props?: object) => GObject & T);

const LAST_POSITION = 0xFF_FF_FF_FF;
const BUILDER_NUL_TERMINATED = -1;
const uniqueName = createTypeNameFactory("_");
const undestroyableToplevels = new Gio.ListStore({ itemType: TYPE_OBJECT });
const ChainBase = GObject as SplicedBase<Gtk.SectionModel>;

function createSectionStore(items: GObject[], interfaces: SectionInterface[]): SectionStore {
    class Sectioned extends GObject implements Gtk.SectionModelImpl {
        vfuncGetItemType(): bigint {
            return TYPE_OBJECT;
        }

        vfuncGetNItems(): number {
            return items.length;
        }

        vfuncGetItem(position: number): GObject | null {
            return items[position] ?? null;
        }

        vfuncGetSection(position: number): [number, number] {
            return position < items.length ? [0, items.length] : [items.length, LAST_POSITION];
        }
    }

    registerClass(Sectioned, { typeName: uniqueName("GtkxSectionStore"), implements: interfaces });

    return new Sectioned() as SectionStore;
}

function defineLevelStore(items: GObject[]): LevelStoreClass {
    return class LevelStore extends GObject implements Gio.ListModelImpl {
        vfuncGetItemType(): bigint {
            return TYPE_OBJECT;
        }

        vfuncGetNItems(): number {
            return items.length;
        }

        vfuncGetItem(position: number): GObject | null {
            return items[position] ?? null;
        }
    };
}

function createLevelStore(items: GObject[]): Gio.ListModel {
    const LevelStore = defineLevelStore(items);
    registerClass(LevelStore, { typeName: uniqueName("GtkxLevelStore"), implements: [Gio.ListModel] });

    return new LevelStore() as Gio.ListModel;
}

function createAdopter(typeName: string, iface: Interface<unknown>): GObject {
    class Adopter extends GObject {}
    registerClass(Adopter, { typeName: uniqueName(typeName), implements: [iface] });

    return new Adopter();
}

function createWidgetAdopter(typeName: string, iface: Interface<unknown>): Gtk.Widget {
    class WidgetAdopter extends Gtk.Widget {}
    registerClass(WidgetAdopter, { typeName: uniqueName(typeName), implements: [iface] });

    return new WidgetAdopter();
}

function buildObject(typeName: string, id: string, body: string): GObject | null {
    const builder = new Gtk.Builder();

    builder.addFromString(`<interface><object class="${typeName}" id="${id}">${body}</object></interface>`,
        BUILDER_NUL_TERMINATED);

    return builder.getObject(id);
}

const withListModel = (Base: typeof GObject): typeof GObject =>
    class extends Base implements Gio.ListModelImpl {
        vfuncGetItemType(): bigint {
            return TYPE_OBJECT;
        }

        vfuncGetNItems(): number {
            return 3;
        }

        vfuncGetItem(position: number): GObject | null {
            return position < 3 ? new GObject({}) : null;
        }
    };

function createToplevelAdopter(): Toplevel & Gdk.Toplevel {
    const display = Gdk.Display.getDefault();

    if (display === null) {
        throw new Error("Expected a default GdkDisplay");
    }

    const clockSource = Gdk.Surface.newToplevel(display);
    const top = new Toplevel({ display, frameClock: clockSource.getFrameClock() }) as Toplevel & Gdk.Toplevel;
    undestroyableToplevels.append(top);

    return top;
}

function createDefaultSectionStore(items: GObject[]): Gtk.SectionModel {
    const LevelStore = defineLevelStore(items);

    registerClass(LevelStore, {
        typeName: uniqueName("GtkxDefaultSectionStore"),
        implements: [Gio.ListModel, Gtk.SectionModel],
    });

    return new LevelStore() as Gtk.SectionModel;
}

class Act extends GObject implements Gio.ActionImpl {
    stage = "";

    vfuncGetName(): string {
        return this.stage === "" ? "act" : `act.${this.stage}`;
    }

    vfuncGetEnabled(): boolean {
        return false;
    }

    vfuncGetParameterType(): GLib.VariantType | null {
        return null;
    }

    vfuncGetStateType(): GLib.VariantType | null {
        return null;
    }

    vfuncGetState(): GLib.Variant | null {
        return null;
    }

    vfuncGetStateHint(): GLib.Variant | null {
        return null;
    }

    vfuncChangeState(): void {
        this.stage = "changed";
    }

    vfuncActivate(): void {
        this.stage = "activated";
    }
}

class Trigger extends Gtk.Label implements Gtk.ActionableImpl {
    stored: string | null = null;
    target: GLib.Variant | null = null;

    vfuncGetActionName(): string | null {
        return this.stored;
    }

    vfuncSetActionName(actionName: string | null): void {
        this.stored = actionName;
    }

    vfuncGetActionTargetValue(): GLib.Variant | null {
        return this.target;
    }

    vfuncSetActionTargetValue(targetValue: GLib.Variant | null): void {
        this.target = targetValue;
    }
}

class BaseStore extends GObject implements Gio.ListModelImpl {
    vfuncGetItemType(): bigint {
        return TYPE_OBJECT;
    }

    vfuncGetNItems(): number {
        return 2;
    }

    vfuncGetItem(position: number): GObject | null {
        return position < 2 ? new GObject({}) : null;
    }
}

class DerivedStore extends BaseStore {}

class NarrowedStore extends BaseStore {
    override vfuncGetNItems(): number {
        return 5;
    }
}

class FieldSectioned extends BaseStore {
    declare getSection: Gtk.SectionModel["getSection"];
    vfuncGetSection = (): [number, number] => [1, 1];
}

class ShadowedStore extends BaseStore {
    override vfuncGetNItems = (): number => 9;
}

abstract class AbstractStore extends GObject implements Gio.ListModelImpl {
    abstract tag(): string;

    vfuncGetItemType(): bigint {
        return TYPE_OBJECT;
    }

    vfuncGetNItems(): number {
        return 2;
    }

    vfuncGetItem(position: number): GObject | null {
        return position < 2 ? new GObject({}) : null;
    }
}

class ConcreteStore extends AbstractStore {
    tag(): string {
        return "concrete";
    }
}

class MixedStore extends withListModel(GObject) {}

class Pad extends Gtk.Widget {
    declare getBorder: Gtk.Scrollable["getBorder"];
    declare getHscrollPolicy: Gtk.Scrollable["getHscrollPolicy"];
}

class PartialStore extends GObject {
    vfuncGetItemType(): bigint {
        return TYPE_OBJECT;
    }

    vfuncGetNItems(): number {
        return 2;
    }
}

class ChainedStore extends ChainBase implements Gio.ListModelImpl {
    override vfuncGetItemType(): bigint {
        return TYPE_OBJECT;
    }

    override vfuncGetNItems(): number {
        return 2;
    }

    override vfuncGetItem(position: number): GObject | null {
        return position < 2 ? super.vfuncGetItem(position) : null;
    }
}

class ChainedSectioned extends ChainBase implements Gtk.SectionModelImpl {
    chained: [number, number][] = [];

    override vfuncGetItemType(): bigint {
        return TYPE_OBJECT;
    }

    override vfuncGetNItems(): number {
        return 3;
    }

    override vfuncGetItem(position: number): GObject | null {
        return position < 3 ? new GObject({}) : null;
    }

    override vfuncGetSection(position: number): [number, number] {
        const section = super.vfuncGetSection(position);
        this.chained.push(section);

        return section;
    }
}

class DefaultSectioned extends BaseStore {}
class LeafSectioned extends DefaultSectioned {}
class Toplevel extends Gdk.Surface {}

class DtlsClient extends GObject {
    advertised: string[] | null = null;

    vfuncSetAdvertisedProtocols(protocols: string[] | null): void {
        this.advertised = protocols;
    }
}

registerClass(Act, { typeName: uniqueName("GtkxAct"), implements: [Gio.Action] });
registerClass(Trigger, { typeName: uniqueName("GtkxTrigger"), implements: [Gtk.Actionable] });
registerClass(DerivedStore, { typeName: uniqueName("GtkxDerivedStore"), implements: [Gio.ListModel] });
registerClass(NarrowedStore, { typeName: uniqueName("GtkxNarrowedStore"), implements: [Gio.ListModel] });

registerClass(FieldSectioned, {
    typeName: uniqueName("GtkxFieldSectioned"),
    implements: [Gio.ListModel, Gtk.SectionModel],
});

registerClass(Pad, { typeName: uniqueName("GtkxPad"), implements: [Gtk.Scrollable] });
registerClass(ShadowedStore, { typeName: uniqueName("GtkxShadowedStore"), implements: [Gio.ListModel] });
registerClass(ConcreteStore, { typeName: uniqueName("GtkxConcreteStore"), implements: [Gio.ListModel] });
registerClass(MixedStore, { typeName: uniqueName("GtkxMixedStore"), implements: [Gio.ListModel] });
registerClass(PartialStore, { typeName: uniqueName("GtkxPartialStore"), implements: [Gio.ListModel] });
registerClass(ChainedStore, { typeName: uniqueName("GtkxChainedStore"), implements: [Gio.ListModel] });

registerClass(ChainedSectioned, {
    typeName: uniqueName("GtkxChainedSectioned"),
    implements: [Gio.ListModel, Gtk.SectionModel],
});

registerClass(DefaultSectioned, {
    typeName: uniqueName("GtkxDefaultSectioned"),
    implements: [Gio.ListModel, Gtk.SectionModel],
});

registerClass(LeafSectioned, { typeName: uniqueName("GtkxLeafSectioned") });
registerClass(Toplevel, { typeName: uniqueName("GtkxToplevel"), implements: [Gdk.Toplevel] });

registerClass(DtlsClient, {
    typeName: uniqueName("GtkxDtlsClient"),
    implements: [Gio.DatagramBased, Gio.DtlsConnection, Gio.DtlsClientConnection],
});

describe("registerClass — implements, vfunc dispatch", () => {
    it("serves a list model straight out of the class's own vfuncs", () => {
        const items = [new GObject({}), new GObject({})];
        const store = createLevelStore(items);
        expect(store.getItemType()).toBe(TYPE_OBJECT);
        expect(store.getNItems()).toBe(2);
        expect(store.getItem(0)).toBe(items[0]);
        expect(store.getItem(1)).toBe(items[1]);
        expect(store.getItem(2)).toBeNull();
    });

    it("keeps the subclass's own vfunc method reachable instead of the interface default", () => {
        const store = createLevelStore([new GObject({})]);
        expect(store.vfuncGetNItems()).toBe(1);
    });
});

describe("registerClass — implements, GTK consumers", () => {
    it("hands a working vtable to a GTK consumer of the model", () => {
        const items = [new GObject({}), new GObject({}), new GObject({})];
        const store = createLevelStore(items);
        const selection = new Gtk.SingleSelection({ model: store });
        expect(selection.getNItems()).toBe(3);
        expect(selection.getItem(2)).toBe(items[2]);
        expect(selection.getModel()).toBe(store);
    });

    it("flattens through a model of models, reading every item back through GTK", () => {
        const first = [new GObject({}), new GObject({})];
        const second = [new GObject({})];
        const outer = new Gio.ListStore({ itemType: typeFromName("GListModel") });
        outer.append(createLevelStore(first));
        outer.append(createLevelStore(second));
        const flattened = new Gtk.FlattenListModel({ model: outer });
        expect(flattened.getNItems()).toBe(3);
        expect(flattened.getItem(0)).toBe(first[0]);
        expect(flattened.getItem(2)).toBe(second[0]);
    });
});

describe("registerClass — implements, interface identity", () => {
    it("reports the interface through instanceof and the type system", () => {
        const store = createLevelStore([]);
        expect(store).toBeInstanceOf(Gio.ListModel);
        expect(typeIsA(getInstanceType(store), typeFromName("GListModel"))).toBe(true);
        expect(isInstanceOfType(getHandle(store), typeFromName("GListModel"))).toBe(true);
    });

    it("delivers itemsChanged to a connected handler", () => {
        const store = createLevelStore([new GObject({})]);
        const calls: number[][] = [];

        store.connect("items-changed", (position, removed, added) => {
            calls.push([position, removed, added]);
        });

        store.itemsChanged(0, 0, 1);
        expect(calls).toEqual([[0, 0, 1]]);
    });
});

describe("registerClass — implements, rejected and redundant entries", () => {
    it("leaves an interface the parent already provides untouched", () => {
        class InheritedStore extends Gio.ListStore {}

        registerClass(InheritedStore, {
            typeName: uniqueName("GtkxInheritedListModel"),
            implements: [Gio.ListModel],
        });

        const store = new InheritedStore({ itemType: TYPE_OBJECT });
        const item = new GObject({});
        store.append(item);
        expect(store.getNItems()).toBe(1);
        expect(store.getItem(0)).toBe(item);
        expect(store.find(item)).toEqual([true, 0]);
    });

    it("rejects a value that is not a registered interface", () => {
        class NotAnImplementer extends GObject {}

        const register = (): unknown =>
            registerClass(NotAnImplementer, {
                typeName: uniqueName("GtkxBadImplements"),
                // @ts-expect-error a class is not an interface value
                implements: [Gtk.Label],
            });

        expect(register).toThrow(TypeError);
        expect(register).toThrow(/lists 'Label' in implements, which is not a registered interface/);
    });
});

describe("registerClass — implements, interface prerequisites", () => {
    it("composes an interface with the prerequisite listed before it", () => {
        const store = createSectionStore([new GObject({}), new GObject({})], [Gio.ListModel, Gtk.SectionModel]);
        expect(typeIsA(getInstanceType(store), typeFromName("GListModel"))).toBe(true);
        expect(typeIsA(getInstanceType(store), typeFromName("GtkSectionModel"))).toBe(true);
        expect(store.getNItems()).toBe(2);
        expect(store.getSection(0)).toEqual([0, 2]);
    });

    it("composes an interface listed before the prerequisite it needs", () => {
        const store = createSectionStore([new GObject({})], [Gtk.SectionModel, Gio.ListModel]);
        expect(typeIsA(getInstanceType(store), typeFromName("GListModel"))).toBe(true);
        expect(typeIsA(getInstanceType(store), typeFromName("GtkSectionModel"))).toBe(true);
        expect(store.getSection(0)).toEqual([0, 1]);
        expect(store.getSection(5)).toEqual([1, LAST_POSITION]);
    });

    it("rejects an interface whose prerequisite neither the parent nor the list provides", () => {
        class Unsectioned extends GObject implements Gtk.SectionModelImpl {
            vfuncGetItemType(): bigint {
                return TYPE_OBJECT;
            }

            vfuncGetNItems(): number {
                return 0;
            }

            vfuncGetItem(): GObject | null {
                return null;
            }

            vfuncGetSection(): [number, number] {
                return [0, 0];
            }
        }

        const register = (): unknown =>
            registerClass(Unsectioned, {
                typeName: uniqueName("GtkxUnsectioned"),
                implements: [Gtk.SectionModel],
            });

        expect(register).toThrow(/does not meet prerequisite 'GListModel' of interface 'GtkSectionModel'/);
    });
});

describe("registerClass — implements, slots the class leaves alone", () => {
    it("takes a class that leaves an interface slot without an implementation", () => {
        class HalfStore extends GObject implements Gio.ListModelImpl {
            vfuncGetItemType(): bigint {
                return TYPE_OBJECT;
            }

            vfuncGetNItems(): number {
                return 0;
            }
        }

        registerClass(HalfStore, {
            typeName: uniqueName("GtkxHalfStore"),
            implements: [Gio.ListModel],
        });

        const store = new HalfStore();
        expect(typeIsA(getInstanceType(store), typeFromName("GListModel"))).toBe(true);
        expect(store.vfuncGetNItems()).toBe(0);
    });

    it("takes an interface whose own default implementations fill its vtable", () => {
        class Selectable extends GObject implements Gio.ListModelImpl {
            vfuncGetItemType(): bigint {
                return TYPE_OBJECT;
            }

            vfuncGetNItems(): number {
                return 1;
            }

            vfuncGetItem(position: number): GObject | null {
                return position === 0 ? new GObject({}) : null;
            }
        }

        registerClass(Selectable, {
            typeName: uniqueName("GtkxSelectable"),
            implements: [Gio.ListModel, Gtk.SelectionModel],
        });

        const model = new Selectable() as Gtk.SelectionModel;
        expect(isInstanceOfType(getHandle(model), typeFromName("GtkSelectionModel"))).toBe(true);
        expect(model.selectItem(0, true)).toBe(false);
        expect(model.selectAll()).toBe(false);
    });
});

describe("registerClass — implements, defaults the interface installs", () => {
    it("takes a class that leaves the slot an interface adds on top of its prerequisite", () => {
        class UnsectionedStore extends ChainBase implements Gtk.SectionModelImpl {
            override vfuncGetItemType(): bigint {
                return TYPE_OBJECT;
            }

            override vfuncGetNItems(): number {
                return 2;
            }

            override vfuncGetItem(): GObject | null {
                return new GObject({});
            }
        }

        registerClass(UnsectionedStore, {
            typeName: uniqueName("GtkxUnsectionedStore"),
            implements: [Gio.ListModel, Gtk.SectionModel],
        });

        const store = new UnsectionedStore() as SectionStore;
        expect(store.getSection(0)).toEqual([0, 2]);
        expect(store.vfuncGetSection(0)).toEqual([0, 2]);
    });

    it("serves a section out of the implementation GtkSectionModel installs by default", () => {
        const store = createDefaultSectionStore([new GObject({}), new GObject({})]);
        expect(store.getSection(0)).toEqual([0, 2]);
    });
});

describe("registerClass — implements, where an implementation lives", () => {
    it("fills a slot from a method the base class it extends declares", () => {
        const store = new DerivedStore() as Gio.ListModel;
        expect(store.getItemType()).toBe(TYPE_OBJECT);
        expect(store.getNItems()).toBe(2);
        expect(store.getItem(0)).toBeInstanceOf(GObject);
        expect(store.getItem(2)).toBeNull();
    });

    it("keeps the subclass's own method ahead of the one its base declares", () => {
        expect((new NarrowedStore() as Gio.ListModel).getNItems()).toBe(5);
    });

    it("leaves a slot an implementation the instance carries as a field would fill to the interface", () => {
        expect(new FieldSectioned().getSection(0)).toEqual([0, 2]);
    });

    it("keeps the base's own method in the slot a field on the subclass shadows", () => {
        const store = new ShadowedStore() as ShadowedStore & Gio.ListModel;
        expect(store.getNItems()).toBe(2);
        expect(store.vfuncGetNItems()).toBe(9);
    });

    it("fills a slot from a method an abstract base declares", () => {
        const store = new ConcreteStore() as ConcreteStore & Gio.ListModel;
        expect(store.getNItems()).toBe(2);
        expect(store.getItemType()).toBe(TYPE_OBJECT);
        expect(store.tag()).toBe("concrete");
        expect(new Gtk.SingleSelection({ model: store }).getNItems()).toBe(2);
    });

    it("fills a slot from a method a mixin-composed base declares", () => {
        const store = new MixedStore() as MixedStore & Gio.ListModel;
        expect(store.getNItems()).toBe(3);
        expect(new Gtk.SingleSelection({ model: store }).getNItems()).toBe(3);
    });

    it("keeps the class's own vfunc member ahead of the one the interface splices in", () => {
        expect((new ConcreteStore() as ConcreteStore & Gio.ListModel).vfuncGetNItems()).toBe(2);
        expect((new MixedStore() as MixedStore & Gio.ListModel).vfuncGetNItems()).toBe(3);
    });
});

describe("registerClass — implements, calling a slot through the member the interface splices in", () => {
    it("reaches the implementation an adopted interface installs by default", () => {
        const store = new DefaultSectioned() as DefaultSectioned & Gtk.SectionModel;
        expect(store.vfuncGetSection(0)).toEqual([0, 2]);
    });

    it("reaches it through the second of two adopted interfaces", () => {
        const store = new DefaultSectioned() as DefaultSectioned & Gio.ListModel & Gtk.SectionModel;
        expect(store.vfuncGetNItems()).toBe(2);
        expect(store.vfuncGetSection(1)).toEqual([0, 2]);
    });

    it("reaches it on a subclass of the class that adopted the interface", () => {
        const store = new LeafSectioned() as LeafSectioned & Gtk.SectionModel;
        expect(store.vfuncGetSection(0)).toEqual([0, 2]);
        expect(store.getSection(0)).toEqual([0, 2]);
    });

    it("names the interface when it installs no implementation of the slot", () => {
        const store = new PartialStore() as PartialStore & Gio.ListModel;
        expect(store.vfuncGetNItems()).toBe(2);
        expect(() => store.vfuncGetItem(0)).toThrow(/interface 'GListModel' provides no implementation/);
    });
});

describe("registerClass — implements, chaining up out of a slot the class fills", () => {
    it("reaches the implementation the adopted interface installs by default", () => {
        const store = new ChainedSectioned() as ChainedSectioned & Gtk.SectionModel;
        expect(store.vfuncGetSection(0)).toEqual([0, 3]);
        expect(store.getSection(2)).toEqual([0, 3]);
        expect(store.chained).toEqual([[0, 3], [0, 3]]);
    });

    it("names the interface when it installs no implementation to chain up to", () => {
        const store = new ChainedStore() as ChainedStore & Gio.ListModel;
        expect(store.vfuncGetNItems()).toBe(2);
        expect(() => store.vfuncGetItem(0)).toThrow(/interface 'GListModel' provides no implementation/);
    });
});

describe("registerClass — implements, what introspection describes of an interface", () => {
    it("takes an interface whose vtable holds a slot introspection cannot describe", () => {
        const pane = createAdopter("GtkxPane", Gtk.Buildable);
        expect(typeIsA(getInstanceType(pane), typeFromName("GtkBuildable"))).toBe(true);
        const icon = createAdopter("GtkxIcon", Gio.Icon);
        expect(typeIsA(getInstanceType(icon), typeFromName("GIcon"))).toBe(true);
    });

    it("takes an interface keeping its whole vtable out of introspection", () => {
        const plugin = createAdopter("GtkxPlugin", TypePlugin);
        expect(typeIsA(getInstanceType(plugin), typeFromName("GTypePlugin"))).toBe(true);
    });

    it("takes an interface whose vtable struct introspection describes as opaque", () => {
        const surface = createWidgetAdopter("GtkxSurface", Gtk.Native);
        expect(typeIsA(getInstanceType(surface), typeFromName("GtkNative"))).toBe(true);
    });
});

describe("registerClass — implements, slots GLib guards for null", () => {
    it("takes the not-supported path GFile guards its slot with", () => {
        const file = createAdopter("GtkxFile", Gio.File) as Gio.File;
        expect(file.querySettableAttributes(null).nInfos).toBe(0);
    });

    it("answers getBorder the way a stock scrollable does", () => {
        const pad = new Pad();
        const [hasBorder] = pad.getBorder();
        const [viewportHasBorder] = new Gtk.Viewport().getBorder();
        expect(hasBorder).toBe(false);
        expect(hasBorder).toBe(viewportHasBorder);
        expect(pad.getHscrollPolicy()).toBe(Gtk.ScrollablePolicy.MINIMUM);
    });
});

describe("registerClass — implements, GtkBuilder", () => {
    it("keeps the properties and the id GtkBuilder sets through GtkBuildable", () => {
        class Pane extends GObject {}
        const typeName = uniqueName("GtkxBuiltPane");
        registerClass(Pane, { typeName, implements: [Gtk.Orientable, Gtk.Buildable] });
        const body = "<property name=\"orientation\">vertical</property>";
        const pane = buildObject(typeName, "pane", body) as (Gtk.Orientable & Gtk.Buildable) | null;
        expect(pane).not.toBeNull();
        expect(pane?.getOrientation()).toBe(Gtk.Orientation.VERTICAL);
        expect(pane?.getBuildableId()).toBe("pane");
    });
});

describe("registerClass — implements, interface properties", () => {
    it("carries the properties an adopted interface declares", () => {
        class Rail extends GObject {}
        registerClass(Rail, { typeName: uniqueName("GtkxRail"), implements: [Gtk.Orientable] });
        const rail = new Rail() as Gtk.Orientable;
        expect(rail.getOrientation()).toBe(Gtk.Orientation.HORIZONTAL);
        rail.setOrientation(Gtk.Orientation.VERTICAL);
        expect(rail.getOrientation()).toBe(Gtk.Orientation.VERTICAL);
        expect(rail.orientation).toBe(Gtk.Orientation.VERTICAL);
    });

    it("notifies on an interface property the same way GObject does for its own", () => {
        class Gauge extends GObject {}
        registerClass(Gauge, { typeName: uniqueName("GtkxGauge"), implements: [Gtk.Orientable] });
        const gauge = new Gauge() as GObject & Gtk.Orientable;
        const seen: string[] = [];

        gauge.connect("notify::orientation", (pspec: ParamSpec) => {
            seen.push(pspec.getName());
        });

        gauge.setOrientation(Gtk.Orientation.VERTICAL);
        expect(seen).toEqual(["orientation"]);
    });

    it("keeps the class's own pspec for a name the interface also declares", () => {
        const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL });
        expect(box.getOrientation()).toBe(Gtk.Orientation.VERTICAL);
        const orientationType = typeFromName("GtkOrientation");

        class Beam extends GObject {
            declare orientation: number;
        }

        registerClass(Beam, {
            typeName: uniqueName("GtkxBeam"),
            implements: [Gtk.Orientable],
            properties: {
                orientation: paramSpecEnum(
                    "orientation",
                    null,
                    null,
                    orientationType,
                    Gtk.Orientation.VERTICAL,
                    ParamFlags.READWRITE,
                ),
            },
        });

        const beam = new Beam() as Beam & Gtk.Orientable;
        expect(beam.getOrientation()).toBe(Gtk.Orientation.VERTICAL);
        beam.orientation = Gtk.Orientation.HORIZONTAL;
        expect(beam.getOrientation()).toBe(Gtk.Orientation.HORIZONTAL);
    });
});

describe("registerClass — implements, interface properties at construction", () => {
    it("sets an adopted interface property from the value the constructor is handed", () => {
        class Beam extends GObject {}
        registerClass(Beam, { typeName: uniqueName("GtkxConstructedBeam"), implements: [Gtk.Orientable] });
        const beam = new Beam({ orientation: Gtk.Orientation.VERTICAL }) as Gtk.Orientable;
        expect(beam.getOrientation()).toBe(Gtk.Orientation.VERTICAL);
        expect(beam.orientation).toBe(Gtk.Orientation.VERTICAL);
    });

    it("carries a property whose own type is an interface", () => {
        class Conn extends GObject {}

        registerClass(Conn, {
            typeName: uniqueName("GtkxConn"),
            implements: [Gio.DatagramBased, Gio.DtlsConnection],
        });

        const conn = new Conn();
        const read = new Value();
        read.init(typeFromName("GDatagramBased"));
        conn.getProperty("base-socket", read);
        expect(read.getObject()).toBeNull();
    });
});

describe("registerClass — implements, interface properties a pointer type backs", () => {
    it("reads and writes the pointer property GdkToplevel declares", () => {
        const top = createToplevelAdopter();
        const read = pointerValue();
        top.getProperty("icon-list", read);
        expect(read.getPointer()).toBe(0n);
        top.setProperty("icon-list", pointerValue());
        top.getProperty("icon-list", read);
        expect(read.getPointer()).toBe(0n);
    });

    it("reads the pointer property GDtlsClientConnection declares", () => {
        const client = new DtlsClient() as DtlsClient & Gio.DtlsClientConnection;
        const read = pointerValue();
        client.getProperty("accepted-cas", read);
        expect(read.getPointer()).toBe(0n);
    });

    it("reads and writes the string-array property GDtlsConnection declares", () => {
        const client = new DtlsClient() as DtlsClient & Gio.DtlsConnection;
        expect(client.advertisedProtocols).toEqual([]);
        client.advertisedProtocols = ["h2", "http/1.1"];
        expect(client.advertised).toEqual(["h2", "http/1.1"]);
        expect(client.advertisedProtocols).toEqual([]);
    });
});

describe("registerClass — implements, properties a vtable slot backs", () => {
    it("answers g_object_get out of the slot the interface's own accessor reads", () => {
        const action = new Act() as Act & Gio.Action;
        expect(action.getName()).toBe("act");
        expect(action.getEnabled()).toBe(false);
        const name = new Value();
        name.init(TYPE_STRING);
        action.getProperty("name", name);
        expect(name.getString()).toBe("act");
        const enabled = new Value();
        enabled.init(TYPE_BOOLEAN);
        action.getProperty("enabled", enabled);
        expect(enabled.getBoolean()).toBe(false);
    });

    it("follows the slot when the class's own implementation changes what it holds", () => {
        const action = new Act() as Act & Gio.Action;
        action.stage = "ready";
        const name = new Value();
        name.init(TYPE_STRING);
        action.getProperty("name", name);
        expect(name.getString()).toBe("act.ready");
        expect(action.getName()).toBe("act.ready");
    });

    it("sends g_object_set to the slot the interface's own accessor writes", () => {
        const trigger = new Trigger() as Trigger & Gtk.Actionable;
        trigger.setProperty("action-name", stringValue("app.close"));
        expect(trigger.stored).toBe("app.close");
        expect(trigger.getActionName()).toBe("app.close");
    });

    it("reads back what the interface's own accessor wrote", () => {
        const trigger = new Trigger() as Trigger & Gtk.Actionable;
        trigger.setActionName("app.open");
        expect(trigger.stored).toBe("app.open");
        const read = new Value();
        read.init(TYPE_STRING);
        trigger.getProperty("action-name", read);
        expect(read.getString()).toBe("app.open");
    });
});
