import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { expect, it } from "vitest";

type DefaultWrite = (window: Gtk.Window, widget: Gtk.Widget | null) => void;

const writes: { name: string; write: DefaultWrite }[] = [
    {
        name: "method",
        write: (window, widget) => {
            window.setDefaultWidget(widget);
        },
    },
    {
        name: "property",
        write: (window, widget) => {
            window.defaultWidget = widget;
        },
    },
    {
        name: "GValue property",
        write: (window, widget) => {
            const value = new GObject.Value();
            value.init(GObject.TYPE_OBJECT);
            value.setObject(widget);
            window.setProperty("default-widget", value);
        },
    },
];

const settle = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

async function collect(rounds: number): Promise<void> {
    if (globalThis.gc === undefined) {
        throw new Error("Window lifetime tests require --expose-gc");
    }

    for (let round = 0; round < rounds; round++) {
        await settle();
        globalThis.gc();
        await settle();
    }
}

async function collectUntilReleased(...references: WeakRef<object>[]): Promise<void> {
    for (let round = 0; round < 30; round++) {
        await collect(1);
        if (references.every((reference) => reference.deref() === undefined)) {
            return;
        }
    }
}

function setDefault(window: Gtk.Window, write: DefaultWrite, label: string): WeakRef<Gtk.Button> {
    const widget = new Gtk.Button({ label });
    write(window, widget);

    return new WeakRef(widget);
}

it.each(writes)("retains only the current default widget through $name writes", async ({ write }) => {
    const window = new Gtk.Window({});

    try {
        const first = setDefault(window, write, "First");
        await collect(3);

        expect(first.deref()).toBeInstanceOf(Gtk.Button);
        expect(window.getDefaultWidget()).toBe(first.deref());

        const second = setDefault(window, write, "Second");
        await collectUntilReleased(first);

        expect(first.deref()).toBeUndefined();
        expect(second.deref()).toBeInstanceOf(Gtk.Button);
        expect(window.getDefaultWidget()).toBe(second.deref());

        write(window, null);
        await collectUntilReleased(second);

        expect(second.deref()).toBeUndefined();
        expect(window.getDefaultWidget()).toBeNull();
    } finally {
        window.setDefaultWidget(null);
        window.destroy();
    }
});

it("collects a destroyed window and a default widget that refers back to it", async () => {
    const references = (() => {
        const window = new Gtk.Window({});
        const widget = Object.assign(new Gtk.Button({ label: "Default" }), { owner: window });
        window.setDefaultWidget(widget);
        window.destroy();

        return { window: new WeakRef(window), widget: new WeakRef(widget) };
    })();

    await collectUntilReleased(references.window, references.widget);

    expect(references.window.deref()).toBeUndefined();
    expect(references.widget.deref()).toBeUndefined();
});
