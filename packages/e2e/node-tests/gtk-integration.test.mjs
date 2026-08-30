import * as Gdk from "@gtkx/gi/gdk";
import * as GLib from "@gtkx/gi/glib";
import * as GObject from "@gtkx/gi/gobject";
import * as Graphene from "@gtkx/gi/graphene";
import * as Gsk from "@gtkx/gi/gsk";
import * as Gtk from "@gtkx/gi/gtk";
import { getClassType, registerClass } from "@gtkx/runtime";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { childEnv } from "./helpers/child-process.mjs";
import { drainAfterEachTest, drainGC } from "./helpers/memory.mjs";

Gtk.init();

class ObservedWindow extends Gtk.Window {}

registerClass(ObservedWindow, { typeName: "GtkxNodeTestObservedWindow" });

const toplevels = Gtk.Window.getToplevels();

drainAfterEachTest();

const FIXTURE = fileURLToPath(new URL("fixtures/surface-release.mjs", import.meta.url));

const runSurfaceRelease = (scenario) =>
    new Promise((resolve) => {
        const child = spawn(process.execPath, ["--expose-gc", FIXTURE, scenario], {
            env: childEnv({ G_DEBUG: "fatal-warnings" }),
            stdio: ["ignore", "pipe", "pipe"],
        });

        let output = "";

        const append = (chunk) => {
            output += chunk.toString();
        };

        child.stdout.on("data", append);
        child.stderr.on("data", append);
        child.once("close", (exitCode) => {
            resolve({ exitCode, output });
        });
    });

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const settleFrames = async (rounds = 20) => {
    for (let round = 0; round < rounds; round += 1) {
        await pause(10);
    }
};

const constructObserved = (construct) => {
    let seen = null;

    const observe = (position, _removed, added) => {
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

const detachObservedWindow = () => {
    const { window } = constructObserved(() => new Gtk.Window({}));
    window.destroy();

    return new WeakRef(window);
};

const insertingBuffer = (onInsert) => {
    const buffer = new Gtk.TextBuffer({});
    buffer.setText("abcdef", -1);
    buffer.connect("insert-text", onInsert);

    return buffer;
};

const insertAtStart = (buffer, text) => {
    buffer.insert(buffer.getStartIter(), text, text.length);
};

const bufferText = (buffer) => buffer.getText(buffer.getStartIter(), buffer.getEndIter(), true);

const deserializeBadNode = (onError) => {
    Gsk.RenderNode.deserialize(GLib.Bytes.new(new TextEncoder().encode("not a render node")), onError);
};

const getToplevel = (window) => {
    const surface = window.getSurface();

    assert.ok(surface instanceof Gdk.Toplevel);

    return surface;
};

const unitRect = () => {
    const rect = new Graphene.Rect({});
    rect.init(0, 0, 10, 10);

    return rect;
};

const opaqueRed = (red = 1) => Object.assign(new Gdk.RGBA({}), { red, green: 0, blue: 0, alpha: 1 });

const colorNode = (red = 1) => Gsk.ColorNode.new(opaqueRed(red), unitRect());

const stringExpression = () => Gtk.PropertyExpression.new(getClassType(Gtk.StringObject), null, "string");

const expressionValue = (expression) => {
    const value = new GObject.Value();
    value.init(getClassType(Gtk.Expression));
    Gtk.valueSetExpression(value, expression);

    return value;
};

const detachChild = (container) => new WeakRef(container.getChild(0));

const detachReplay = () => new WeakRef(Gsk.RenderReplay.new());

test("a surface dropped without ever being destroyed releases without a warning", async () => {
    const run = await runSurfaceRelease("undestroyed");
    assert.equal(run.exitCode, 0);
    assert.match(run.output, /SETTLED/);
});

test("a surface whose window was destroyed first releases without a warning", async () => {
    const run = await runSurfaceRelease("predestroyed");
    assert.equal(run.exitCode, 0);
    assert.match(run.output, /PREDESTROYED true/);
    assert.match(run.output, /SETTLED/);
});

test("a surface held across collection rounds releases without a warning", async () => {
    const run = await runSurfaceRelease("held");
    assert.equal(run.exitCode, 0);
    assert.match(run.output, /HELD false/);
    assert.match(run.output, /SETTLED/);
});

test("a window wrapped during construction is the wrapper the constructor returns", async () => {
    const { window, seen } = constructObserved(() => new Gtk.Window({ title: "Observed" }));
    assert.equal(window, seen);
    assert.equal(window.getTitle(), "Observed");
    window.destroy();
    await drainGC();
});

test("a window observed through its child's parent is the wrapper the constructor returns", async () => {
    const label = new Gtk.Label({});
    let seen = null;

    const handler = label.connect("notify::parent", () => {
        seen = label.getParent();
    });

    const window = new Gtk.Window({ child: label });
    assert.equal(window, seen);
    assert.equal(window.getChild(), label);
    label.disconnect(handler);
    window.destroy();
    await drainGC();
});

test("a registered subclass instance is already an instance of the subclass during construction", async () => {
    const { window, seen } = constructObserved(() => new ObservedWindow({}));
    assert.equal(window, seen);
    assert.ok(window instanceof ObservedWindow);
    assert.ok(seen instanceof ObservedWindow);
    assert.ok(window instanceof Gtk.Window);
    window.destroy();
    await drainGC();
});

test("a destroyed window's wrapper is collectable", async () => {
    const weak = detachObservedWindow();
    await drainGC(20);
    assert.equal(weak.deref(), undefined);
});

test("constructing an observed window with an uncoercible prop throws", async () => {
    assert.throws(() => constructObserved(() => new Gtk.Window({ title: Symbol("title") })));
    await drainGC();
    assert.equal(toplevels.getNItems(), 0);
});

test("a text iter mutated inside insert-text moves where the text lands", () => {
    const offsets = [];
    const buffer = insertingBuffer((location) => {
        offsets.push(location.getOffset());
        location.forwardChars(3);
    });

    insertAtStart(buffer, "X");
    assert.deepEqual(offsets, [0]);
    assert.equal(bufferText(buffer), "abcXdef");
});

test("a text iter left alone inside insert-text lands the text where C asked", () => {
    const offsets = [];
    const buffer = insertingBuffer((location) => {
        offsets.push(location.getOffset());
    });

    insertAtStart(buffer, "X");
    assert.deepEqual(offsets, [0]);
    assert.equal(bufferText(buffer), "Xabcdef");
});

test("a parse location lent to the deserialize error callback carries usable offsets", () => {
    const starts = [];
    const ends = [];
    const messages = [];

    deserializeBadNode((start, end, error) => {
        starts.push(start.bytes);
        ends.push(end.bytes);
        messages.push(typeof error.message);
    });

    assert.ok(starts.length > 0);
    assert.ok(starts.every((offset) => Number.isSafeInteger(offset) && offset >= 0));
    assert.ok(ends.every((offset) => Number.isSafeInteger(offset) && offset >= 0));
    assert.ok(messages.every((kind) => kind === "string"));
});

test("a presented toplevel lends its compute size and takes the size the callback sets", async () => {
    const window = new Gtk.Window({ title: "lent-boxed", defaultWidth: 160, defaultHeight: 120 });
    window.present();
    const bounds = [];

    getToplevel(window).connect("compute-size", (size) => {
        bounds.push(size.getBounds());
        size.setSize(321, 234);
    });

    await settleFrames();
    const width = getToplevel(window).getWidth();
    const height = getToplevel(window).getHeight();
    window.destroy();
    await drainGC(20);

    assert.ok(bounds.length > 0);
    assert.ok(bounds.every((bound) => bound.length === 2));
    assert.ok(bounds.every(([boundsWidth]) => Number.isSafeInteger(boundsWidth) && boundsWidth > 0));
    assert.ok(bounds.every(([, boundsHeight]) => Number.isSafeInteger(boundsHeight) && boundsHeight > 0));
    assert.equal(width, 321);
    assert.equal(height, 234);
});

test("a lent text iter that escapes its callback throws on any later access", () => {
    const escaped = [];
    const buffer = insertingBuffer((location) => {
        escaped.push(location);
    });

    insertAtStart(buffer, "X");
    assert.equal(escaped.length, 1);
    assert.throws(() => escaped[0].getOffset());
    assert.throws(() => escaped[0].forwardChars(1));
});

test("a lent parse location that escapes its callback throws on field access", () => {
    const escaped = [];

    deserializeBadNode((start) => {
        escaped.push(start);
    });

    assert.ok(escaped.length > 0);
    assert.throws(() => escaped[0].bytes);
});

test("a render node reached through its container is the wrapper that was put in", () => {
    const child = colorNode();
    const container = Gsk.ContainerNode.new([child]);
    assert.equal(container.getChild(0), child);
    assert.equal(container.getChild(0), container.getChild(0));
    assert.equal(container.getNChildren(), 1);
});

test("distinct container children get distinct wrappers", () => {
    const container = Gsk.ContainerNode.new([colorNode(1), colorNode(0.5)]);
    assert.equal(container.getNChildren(), 2);
    assert.notEqual(container.getChild(0), container.getChild(1));
    assert.equal(container.getChild(0).getBounds().getWidth(), 10);
    assert.equal(container.getChild(1).getBounds().getWidth(), 10);
});

test("a collected render node wrapper revives into a working wrapper", async () => {
    const container = Gsk.ContainerNode.new([colorNode()]);
    const weak = detachChild(container);
    await drainGC(20);
    assert.equal(weak.deref(), undefined);

    const revived = container.getChild(0);
    assert.equal(revived, container.getChild(0));
    assert.equal(revived.getBounds().getWidth(), 10);
});

test("an expression reached through a method, a property and a GValue is one wrapper", () => {
    const expression = stringExpression();
    const filter = Gtk.StringFilter.new(expression);
    assert.equal(filter.getExpression(), expression);
    assert.equal(filter.expression, expression);
    assert.equal(Gtk.valueGetExpression(expressionValue(expression)), expression);
});

test("fundamental arguments reject plain objects", () => {
    assert.throws(() => Gsk.ContainerNode.new([{}]));

    const value = new GObject.Value();
    value.init(getClassType(Gtk.Expression));
    assert.throws(() => Gtk.valueSetExpression(value, {}));
    assert.throws(() => Gtk.StringFilter.new({}));
});

test("a render replay filter round trips the node identity it returns", () => {
    const replay = Gsk.RenderReplay.new();
    const source = colorNode(1);
    const replacement = colorNode(0.5);
    let seen = null;

    replay.setNodeFilter((filtered) => {
        seen = filtered;

        return replacement;
    });

    assert.equal(Gsk.RenderReplay.new().filterNode(source), source);
    assert.equal(replay.filterNode(source), replacement);
    assert.ok(seen instanceof Gsk.RenderReplay);
});

test("a render replay filter returning null yields null", () => {
    const replay = Gsk.RenderReplay.new();
    replay.setNodeFilter(() => null);
    assert.equal(replay.filterNode(colorNode(1)), null);

    replay.setNodeFilter(null);
    const source = colorNode(1);
    assert.equal(replay.filterNode(source), source);
});

test("a dropped render replay wrapper is collectable", async () => {
    const weak = detachReplay();
    await drainGC(20);
    assert.equal(weak.deref(), undefined);
});

test("a render replay refuses direct construction and non node arguments", () => {
    assert.throws(() => Reflect.construct(Gsk.RenderReplay, []));
    assert.throws(() => Gsk.RenderReplay.new().filterNode({}));
    assert.throws(() => Gsk.RenderReplay.new().filterNode("node"));
});

test("a render replay lent to its own filter throws once the filter has returned", () => {
    const replay = Gsk.RenderReplay.new();
    const escaped = [];

    replay.setNodeFilter((filtered, node) => {
        escaped.push(filtered);

        return node;
    });

    const source = colorNode(1);
    assert.equal(replay.filterNode(source), source);
    assert.equal(escaped.length, 1);
    assert.throws(() => escaped[0].filterNode(colorNode(0.5)));
});
