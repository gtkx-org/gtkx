import * as Gdk from "@gtkx/gi/gdk";
import * as GLib from "@gtkx/gi/glib";
import * as GObject from "@gtkx/gi/gobject";
import * as Graphene from "@gtkx/gi/graphene";
import * as Gsk from "@gtkx/gi/gsk";
import * as Gtk from "@gtkx/gi/gtk";
import { getClassType, registerClass, typeFromName } from "@gtkx/runtime";
import { spawn } from "node:child_process";
import { assert, expect, test } from "vitest";
import { childEnv, fixtureArgs } from "./helpers/child-process.js";
import { drainAfterEachTest, drainGC } from "./helpers/memory.js";

type SurfaceRun = { exitCode: number | null; output: string };
type ObservedConstruction = { seen: GObject.Object | null; window: Gtk.Window };
type FundamentalClass = new (props: object) => unknown;

Gtk.init();

class ObservedWindow extends Gtk.Window {}

registerClass(ObservedWindow, { typeName: "GtkxNodeTestObservedWindow" });

const toplevels = Gtk.Window.getToplevels();

drainAfterEachTest();

const runSurfaceRelease = (scenario: string): Promise<SurfaceRun> =>
    new Promise((resolve) => {
        const child = spawn(process.execPath, [...fixtureArgs("surface-release.ts", ["--expose-gc"]), scenario], {
            env: childEnv({ G_DEBUG: "fatal-warnings" }),
            stdio: ["ignore", "pipe", "pipe"],
        });

        let output = "";

        const append = (chunk: Buffer): void => {
            output += chunk.toString();
        };

        child.stdout.on("data", append);
        child.stderr.on("data", append);
        child.once("close", (exitCode) => {
            resolve({ exitCode, output });
        });
    });

const pause = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const settleFrames = async (rounds = 20): Promise<void> => {
    for (let round = 0; round < rounds; round += 1) {
        await pause(10);
    }
};

const constructObserved = (construct: () => Gtk.Window): ObservedConstruction => {
    let seen: GObject.Object | null = null;

    const observe = (position: number, _removed: number, added: number): void => {
        if (added > 0) {
            seen = toplevels.getItem(position);
        }
    };

    toplevels.on("items-changed", observe);

    try {
        return { window: construct(), seen };
    } finally {
        toplevels.off("items-changed", observe);
    }
};

const constructSymbolTitledWindow = (): Gtk.Window =>
    new Gtk.Window({
        // @ts-expect-error a window title is a string, never a symbol
        title: Symbol("title"),
    });

const detachObservedWindow = (): WeakRef<Gtk.Window> => {
    const { window } = constructObserved(() => new Gtk.Window({}));
    window.destroy();

    return new WeakRef(window);
};

const insertingBuffer = (onInsert: Gtk.TextBufferSignals["insert-text"]): Gtk.TextBuffer => {
    const buffer = new Gtk.TextBuffer({});
    buffer.setText("abcdef", -1);
    buffer.connect("insert-text", onInsert);

    return buffer;
};

const insertAtStart = (buffer: Gtk.TextBuffer, text: string): void => {
    buffer.insert(buffer.getStartIter(), text, text.length);
};

const bufferText = (buffer: Gtk.TextBuffer): string =>
    buffer.getText(buffer.getStartIter(), buffer.getEndIter(), true);

const deserializeBadNode = (onError: Gsk.ParseErrorFunc): void => {
    Gsk.RenderNode.deserialize(GLib.Bytes.new(new TextEncoder().encode("not a render node")), onError);
};

const getToplevel = (window: Gtk.Window): Gdk.Toplevel => {
    const surface = window.getSurface();

    assert(surface instanceof Gdk.Toplevel);

    return surface;
};

const isPositiveExtent = (extent: number | undefined): boolean =>
    extent !== undefined && Number.isSafeInteger(extent) && extent > 0;

const unitRect = (): Graphene.Rect => {
    const rect = new Graphene.Rect({});
    rect.init(0, 0, 10, 10);

    return rect;
};

const opaqueRed = (red = 1): Gdk.RGBA => Object.assign(new Gdk.RGBA({}), { red, green: 0, blue: 0, alpha: 1 });

const colorNode = (red = 1): Gsk.ColorNode => Gsk.ColorNode.new(opaqueRed(red), unitRect());

const stringExpression = (): Gtk.PropertyExpression =>
    Gtk.PropertyExpression.new(getClassType(Gtk.StringObject), null, "string");

const expressionValue = (expression: Gtk.Expression): GObject.Value => {
    const value = new GObject.Value();
    value.init(getClassType(Gtk.Expression));
    Gtk.valueSetExpression(value, expression);

    return value;
};

const constructFundamental = (klass: FundamentalClass): unknown => new klass({});

const detachChild = (container: Gsk.ContainerNode): WeakRef<Gsk.RenderNode> => new WeakRef(container.getChild(0));

const detachReplay = (): WeakRef<Gsk.RenderReplay> => new WeakRef(Gsk.RenderReplay.new());

test("a surface dropped without ever being destroyed releases without a warning", async () => {
    const run = await runSurfaceRelease("undestroyed");
    expect(run.exitCode).toBe(0);
    expect(run.output).toMatch(/SETTLED/);
});

test("a surface whose window was destroyed first releases without a warning", async () => {
    const run = await runSurfaceRelease("predestroyed");
    expect(run.exitCode).toBe(0);
    expect(run.output).toMatch(/PREDESTROYED true/);
    expect(run.output).toMatch(/SETTLED/);
});

test("a surface held across collection rounds releases without a warning", async () => {
    const run = await runSurfaceRelease("held");
    expect(run.exitCode).toBe(0);
    expect(run.output).toMatch(/HELD false/);
    expect(run.output).toMatch(/SETTLED/);
});

test("a window wrapped during construction is the wrapper the constructor returns", async () => {
    const { window, seen } = constructObserved(() => new Gtk.Window({ title: "Observed" }));
    expect(window).toBe(seen);
    expect(window.getTitle()).toBe("Observed");
    window.destroy();
    await drainGC();
});

test("a window observed through its child's parent is the wrapper the constructor returns", async () => {
    const label = new Gtk.Label({});
    let seen: Gtk.Widget | null = null;

    const handler = label.connect("notify::parent", () => {
        seen = label.getParent();
    });

    const window = new Gtk.Window({ child: label });
    expect(window).toBe(seen);
    expect(window.getChild()).toBe(label);
    label.disconnect(handler);
    window.destroy();
    await drainGC();
});

test("a registered subclass instance is already an instance of the subclass during construction", async () => {
    const { window, seen } = constructObserved(() => new ObservedWindow({}));
    expect(window).toBe(seen);
    expect(window).toBeInstanceOf(ObservedWindow);
    expect(seen).toBeInstanceOf(ObservedWindow);
    expect(window).toBeInstanceOf(Gtk.Window);
    window.destroy();
    await drainGC();
});

test("a destroyed window's wrapper is collectable", async () => {
    const weak = detachObservedWindow();
    await drainGC(20);
    expect(weak.deref()).toBeUndefined();
});

test("constructing an observed window with an uncoercible prop throws", async () => {
    expect(() => constructObserved(constructSymbolTitledWindow)).toThrow();
    await drainGC();
    expect(toplevels.getNItems()).toBe(0);
});

test("a text iter mutated inside insert-text moves where the text lands", () => {
    const offsets: number[] = [];
    const buffer = insertingBuffer((location) => {
        offsets.push(location.getOffset());
        location.forwardChars(3);
    });

    insertAtStart(buffer, "X");
    expect(offsets).toEqual([0]);
    expect(bufferText(buffer)).toBe("abcXdef");
});

test("a text iter left alone inside insert-text lands the text where C asked", () => {
    const offsets: number[] = [];
    const buffer = insertingBuffer((location) => {
        offsets.push(location.getOffset());
    });

    insertAtStart(buffer, "X");
    expect(offsets).toEqual([0]);
    expect(bufferText(buffer)).toBe("Xabcdef");
});

test("a parse location lent to the deserialize error callback carries usable offsets", () => {
    const starts: number[] = [];
    const ends: number[] = [];
    const messages: string[] = [];

    deserializeBadNode((start, end, error) => {
        starts.push(start.bytes);
        ends.push(end.bytes);
        messages.push(typeof error.message);
    });

    expect(starts.length > 0).toBeTruthy();
    expect(starts.every((offset) => Number.isSafeInteger(offset) && offset >= 0)).toBeTruthy();
    expect(ends.every((offset) => Number.isSafeInteger(offset) && offset >= 0)).toBeTruthy();
    expect(messages.every((kind) => kind === "string")).toBeTruthy();
});

test("a presented toplevel lends its compute size and takes the size the callback sets", async () => {
    const window = new Gtk.Window({ title: "lent-boxed", defaultWidth: 160, defaultHeight: 120 });
    window.present();
    const bounds: number[][] = [];

    getToplevel(window).connect("compute-size", (size) => {
        bounds.push(size.getBounds());
        size.setSize(321, 234);
    });

    await settleFrames();
    const width = getToplevel(window).getWidth();
    const height = getToplevel(window).getHeight();
    window.destroy();
    await drainGC(20);

    expect(bounds.length > 0).toBeTruthy();
    expect(bounds.every((bound) => bound.length === 2)).toBeTruthy();
    expect(bounds.every(([boundsWidth]) => isPositiveExtent(boundsWidth))).toBeTruthy();
    expect(bounds.every(([, boundsHeight]) => isPositiveExtent(boundsHeight))).toBeTruthy();
    expect(width).toBe(321);
    expect(height).toBe(234);
});

test("a lent text iter that escapes its callback throws on any later access", () => {
    const escaped: Gtk.TextIter[] = [];
    const buffer = insertingBuffer((location) => {
        escaped.push(location);
    });

    insertAtStart(buffer, "X");
    expect(escaped).toHaveLength(1);
    expect(() => escaped[0]?.getOffset()).toThrow();
    expect(() => escaped[0]?.forwardChars(1)).toThrow();
});

test("a lent parse location that escapes its callback throws on field access", () => {
    const escaped: Gsk.ParseLocation[] = [];

    deserializeBadNode((start) => {
        escaped.push(start);
    });

    expect(escaped.length > 0).toBeTruthy();
    expect(() => escaped[0]?.bytes).toThrow();
});

test("a render node reached through its container is the wrapper that was put in", () => {
    const child = colorNode();
    const container = Gsk.ContainerNode.new([child]);
    expect(container.getChild(0)).toBe(child);
    expect(container.getChild(0)).toBe(container.getChild(0));
    expect(container.getNChildren()).toBe(1);
});

test("distinct container children get distinct wrappers", () => {
    const container = Gsk.ContainerNode.new([colorNode(1), colorNode(0.5)]);
    expect(container.getNChildren()).toBe(2);
    expect(container.getChild(0)).not.toBe(container.getChild(1));
    expect(container.getChild(0).getBounds().getWidth()).toBe(10);
    expect(container.getChild(1).getBounds().getWidth()).toBe(10);
});

test("a collected render node wrapper revives into a working wrapper", async () => {
    const container = Gsk.ContainerNode.new([colorNode()]);
    const weak = detachChild(container);
    await drainGC(20);
    expect(weak.deref()).toBeUndefined();

    const revived = container.getChild(0);
    expect(revived).toBe(container.getChild(0));
    expect(revived.getBounds().getWidth()).toBe(10);
});

test("an expression reached through a method, a property and a GValue is one wrapper", () => {
    const expression = stringExpression();
    const filter = Gtk.StringFilter.new(expression);
    expect(filter.getExpression()).toBe(expression);
    expect(filter.expression).toBe(expression);
    expect(Gtk.valueGetExpression(expressionValue(expression))).toBe(expression);
});

test("fundamental arguments reject plain objects", () => {
    // @ts-expect-error a plain object is not a render node
    expect(() => Gsk.ContainerNode.new([{}])).toThrow();

    const value = new GObject.Value();
    value.init(getClassType(Gtk.Expression));
    expect(() => {
        // @ts-expect-error a plain object is not an expression
        Gtk.valueSetExpression(value, {});
    }).toThrow();
    // @ts-expect-error a plain object is not an expression
    expect(() => Gtk.StringFilter.new({})).toThrow();
});

test("a render replay filter round trips the node identity it returns", () => {
    const replay = Gsk.RenderReplay.new();
    const source = colorNode(1);
    const replacement = colorNode(0.5);
    let seen: Gsk.RenderReplay | null = null;

    replay.setNodeFilter((filtered) => {
        seen = filtered;

        return replacement;
    });

    expect(Gsk.RenderReplay.new().filterNode(source)).toBe(source);
    expect(replay.filterNode(source)).toBe(replacement);
    expect(seen).toBeInstanceOf(Gsk.RenderReplay);
});

test("a render replay filter returning null yields null", () => {
    const replay = Gsk.RenderReplay.new();
    replay.setNodeFilter(() => null);
    expect(replay.filterNode(colorNode(1))).toBeNull();

    replay.setNodeFilter(null);
    const source = colorNode(1);
    expect(replay.filterNode(source)).toBe(source);
});

test("a dropped render replay wrapper is collectable", async () => {
    const weak = detachReplay();
    await drainGC(20);
    expect(weak.deref()).toBeUndefined();
});

test("a render replay refuses direct construction and non node arguments", () => {
    expect(() => {
        Reflect.construct(Gsk.RenderReplay, []);
    }).toThrow();
    // @ts-expect-error a plain object is not a render node
    expect(() => Gsk.RenderReplay.new().filterNode({})).toThrow();
    // @ts-expect-error a string is not a render node
    expect(() => Gsk.RenderReplay.new().filterNode("node")).toThrow();
});

test("a render replay lent to its own filter throws once the filter has returned", () => {
    const replay = Gsk.RenderReplay.new();
    const escaped: Gsk.RenderReplay[] = [];

    replay.setNodeFilter((filtered, node) => {
        escaped.push(filtered);

        return node;
    });

    const source = colorNode(1);
    expect(replay.filterNode(source)).toBe(source);
    expect(escaped).toHaveLength(1);
    expect(() => escaped[0]?.filterNode(colorNode(0.5))).toThrow();
});

test("fundamental GTK types are not constructible with new", () => {
    // @ts-expect-error an abstract render node is not constructible
    expect(() => constructFundamental(Gsk.RenderNode)).toThrow();
    // @ts-expect-error an abstract color node is not constructible
    expect(() => constructFundamental(Gsk.ColorNode)).toThrow();
    // @ts-expect-error an abstract container node is not constructible
    expect(() => constructFundamental(Gsk.ContainerNode)).toThrow();
    // @ts-expect-error an abstract expression is not constructible
    expect(() => constructFundamental(Gtk.Expression)).toThrow();
    // @ts-expect-error an abstract constant expression is not constructible
    expect(() => constructFundamental(Gtk.ConstantExpression)).toThrow();
    // @ts-expect-error an abstract event is not constructible
    expect(() => constructFundamental(Gdk.Event)).toThrow();
});

test("fundamental GTK instances still come from their own constructors", () => {
    const node = colorNode(1);
    expect(node).toBeInstanceOf(Gsk.ColorNode);
    expect(node).toBeInstanceOf(Gsk.RenderNode);
    expect(node.getColor().red).toBe(1);

    const expression = stringExpression();
    expect(expression).toBeInstanceOf(Gtk.PropertyExpression);
    expect(expression).toBeInstanceOf(Gtk.Expression);
    expect(expression.getValueType()).toBe(typeFromName("gchararray"));
});

test("a gtk precondition failure throws out of the call that caused it", () => {
    const box = Gtk.Box.new(Gtk.Orientation.VERTICAL, 0);
    const adopted = Gtk.Label.new("a widget the box adopted");
    box.append(adopted);

    expect(() => {
        box.remove(Gtk.Label.new("a widget the box never adopted"));
    }).toThrow();

    box.remove(adopted);
    expect(box.getFirstChild()).toBeNull();
});
