import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkButton, GtkWindow } from "@gtkx/jsx/gtk";
import { rootElement } from "@gtkx/react";
import { getClassType } from "@gtkx/runtime";
import { act, cleanup, render, userEvent } from "@gtkx/testing";
import { setImmediate } from "node:timers/promises";
import { createRef } from "react";
import { expect, it } from "vitest";
import { gcUntil } from "../helpers/native-utils.js";

const unmountDefaultWindow = async () => {
    const windowRef = createRef<Gtk.Window>();
    const buttonRef = createRef<Gtk.Button>();
    await render(
        <GtkWindow ref={windowRef} defaultWidth={200} defaultHeight={100}>
            <GtkButton ref={buttonRef} label="Default action" focusable={false} />
        </GtkWindow>,
        { container: rootElement },
    );
    const window = windowRef.current;
    const button = buttonRef.current;

    if (window === null || button === null) {
        throw new Error("The window and button must be mounted");
    }

    await act(() => {
        window.setDefaultWidget(button);
    });
    expect(window.getDefaultWidget()).toBe(button);
    await cleanup();

    return { window, button: new WeakRef(button) };
};

const collect = async (): Promise<void> => {
    expect(globalThis.gc).toBeTypeOf("function");

    for (let round = 0; round < 3; round += 1) {
        await setImmediate();
        globalThis.gc?.();
    }
};

const frozenWriters: [string, (window: Gtk.Window, button: Gtk.Button) => void][] = [
    ["method", (window, button) => {
        window.setDefaultWidget(button);
    }],
    ["property", (window, button) => {
        window.defaultWidget = button;
    }],
    ["GValue", (window, button) => {
        const value = new GObject.Value();
        value.init(getClassType(Gtk.Widget));
        value.setObject(button);
        window.setProperty("default-widget", value);
    }],
];

const unmountFrozenDefault = async (write: (window: Gtk.Window, button: Gtk.Button) => void) => {
    const windowRef = createRef<Gtk.Window>();
    const buttonRef = createRef<Gtk.Button>();
    await render(
        <GtkWindow ref={windowRef} defaultWidth={200} defaultHeight={100}>
            <GtkButton ref={buttonRef} label="Frozen default" focusable={false} />
        </GtkWindow>,
        { container: rootElement },
    );
    const window = windowRef.current;
    const button = buttonRef.current;

    if (window === null || button === null) {
        throw new Error("The window and button must be mounted");
    }

    window.freezeNotify();
    write(window, button);
    expect(window.getDefaultWidget()).toBe(button);
    await cleanup();

    return { window, button: new WeakRef(button) };
};

it("keeps a removed default button alive until its retained window clears it", async () => {
    const { window, button } = await unmountDefaultWindow();
    await collect();
    expect(button.deref()).toBeDefined();
    expect(window.getDefaultWidget()?.getParent()).toBeNull();
    expect(window.getDefaultWidget()).toBe(button.deref());
    window.setDefaultWidget(null);
    await gcUntil(() => button.deref() === undefined);
    expect(button.deref()).toBeUndefined();
    expect(window.getDefaultWidget()).toBeNull();
});

it("releases the previous default when a retained window replaces it", async () => {
    const { window, button } = await unmountDefaultWindow();
    const replacementRef = createRef<Gtk.Button>();
    let clicks = 0;
    const { unmount } = await render(
        <GtkButton
            ref={replacementRef}
            label="Replacement"
            onClicked={() => {
                clicks += 1;
            }}
        />,
    );
    const replacement = replacementRef.current;

    if (replacement === null) {
        throw new Error("The replacement button must be mounted");
    }

    window.setDefaultWidget(replacement);
    await gcUntil(() => button.deref() === undefined);
    expect(button.deref()).toBeUndefined();
    expect(window.getDefaultWidget()).toBe(replacement);
    await userEvent.click(replacement);
    expect(clicks).toBe(1);
    window.setDefaultWidget(null);
    await unmount();
});

const releaseDefaultWindow = async () => {
    const { window, button } = await unmountDefaultWindow();

    return { window: new WeakRef(window), button };
};

const releaseCapturedDefaultWindow = async () => {
    const windowRef = createRef<Gtk.Window>();
    const buttonRef = createRef<Gtk.Button>();
    await render(
        <GtkWindow ref={windowRef} defaultWidth={200} defaultHeight={100}>
            <GtkButton ref={buttonRef} label="Captured default" focusable={false} />
        </GtkWindow>,
        { container: rootElement },
    );
    const window = windowRef.current;
    const button = buttonRef.current;

    if (window === null || button === null) {
        throw new Error("The window and button must be mounted");
    }

    button.connect("clicked", () => {
        window.present();
    });
    window.setDefaultWidget(button);
    await cleanup();

    return { window: new WeakRef(window), button: new WeakRef(button) };
};

const releaseSelfDefaultWindow = async () => {
    const windowRef = createRef<Gtk.Window>();
    await render(<GtkWindow ref={windowRef} defaultWidth={200} defaultHeight={100} />, { container: rootElement });
    const window = windowRef.current;

    if (window === null) {
        throw new Error("The window must be mounted");
    }

    window.setDefaultWidget(window);
    expect(window.getDefaultWidget()).toBe(window);
    await cleanup();

    return new WeakRef(window);
};

it("releases an unmounted window and its default widget together", async () => {
    const { window, button } = await releaseDefaultWindow();
    await gcUntil(() => window.deref() === undefined && button.deref() === undefined);
    expect(window.deref()).toBeUndefined();
    expect(button.deref()).toBeUndefined();
});

it("releases a default button whose signal captures its window", async () => {
    const { window, button } = await releaseCapturedDefaultWindow();
    await gcUntil(() => window.deref() === undefined && button.deref() === undefined);
    expect(window.deref()).toBeUndefined();
    expect(button.deref()).toBeUndefined();
});

it("releases a window used as its own default widget", async () => {
    const window = await releaseSelfDefaultWindow();
    await gcUntil(() => window.deref() === undefined);
    expect(window.deref()).toBeUndefined();
});

it.each(frozenWriters)("retains a default set through the %s while notifications are frozen", async (_name, write) => {
    const { window, button } = await unmountFrozenDefault(write);
    await collect();
    expect(button.deref()).toBeDefined();
    window.setDefaultWidget(null);
    window.thawNotify();
    await gcUntil(() => button.deref() === undefined);
    expect(button.deref()).toBeUndefined();
});
