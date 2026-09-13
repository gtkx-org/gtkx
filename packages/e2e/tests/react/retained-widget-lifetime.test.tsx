import type * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton } from "@gtkx/jsx/gtk";
import { createPortal } from "@gtkx/react";
import { cleanup, render } from "@gtkx/testing";
import { createRef } from "react";
import { expect, it } from "vitest";
import { gcUntil } from "../helpers/native-utils.js";

const unmountRetainedButton = async () => {
    const ref = createRef<Gtk.Button>();
    let clicks = 0;
    const onClicked = (): void => {
        clicks += 1;
    };
    const handler = new WeakRef(onClicked);
    await render(<GtkButton ref={ref} label="Retained" onClicked={onClicked} />);
    const button = ref.current;

    if (button === null) {
        throw new Error("The button was not mounted");
    }

    button.emit("clicked");
    expect(clicks).toBe(1);
    await cleanup();
    button.emit("clicked");
    expect(clicks).toBe(1);

    return { button, handler };
};

const unmountRetainedParent = async () => {
    const parentRef = createRef<Gtk.Box>();
    const childRef = createRef<Gtk.Button>();
    await render(<GtkBox ref={parentRef}><GtkButton ref={childRef} label="Released" /></GtkBox>);
    const parent = parentRef.current;
    const child = childRef.current;

    if (parent === null || child === null) {
        throw new Error("The parent and child were not mounted");
    }

    const released = new WeakRef(child);
    await cleanup();

    return { parent, released };
};

it("releases a retained widget's signal handlers after unmount", async () => {
    const { button, handler } = await unmountRetainedButton();
    await gcUntil(() => handler.deref() === undefined);
    expect(handler.deref()).toBeUndefined();
    expect(button.getLabel()).toBe("Retained");
    expect(button.getParent()).toBeNull();
});

it("releases removed children while their unmounted parent is retained", async () => {
    const { parent, released } = await unmountRetainedParent();
    await gcUntil(() => released.deref() === undefined);
    expect(released.deref()).toBeUndefined();
    expect(parent.getFirstChild()).toBeNull();
});

it("accepts a new portal into a retained parent after unmount", async () => {
    const { parent } = await unmountRetainedParent();
    const ref = createRef<Gtk.Button>();
    const { rerender, unmount } = await render(
        createPortal(<GtkButton ref={ref} label="First" />, parent),
    );
    const button = ref.current;
    expect(button?.getParent()).toBe(parent);

    await rerender(createPortal(<GtkButton ref={ref} label="Second" />, parent));
    expect(ref.current).toBe(button);
    expect(button?.getLabel()).toBe("Second");

    await unmount();
    expect(button?.getParent()).toBeNull();
    expect(parent.getFirstChild()).toBeNull();
});

it("updates a portal that adopts a parent in the same commit that unmounts it", async () => {
    const parentRef = createRef<Gtk.Box>();
    const firstRef = createRef<Gtk.Button>();
    const secondRef = createRef<Gtk.Button>();
    const { rerender, unmount } = await render(<GtkBox ref={parentRef} />);
    const parent = parentRef.current;

    if (parent === null) {
        throw new Error("The parent was not mounted");
    }

    await rerender(createPortal(<GtkButton key="first" ref={firstRef} label="First" />, parent));
    const first = firstRef.current;
    expect(first?.getParent()).toBe(parent);

    await rerender(createPortal([
        <GtkButton key="first" ref={firstRef} label="Updated" />,
        <GtkButton key="second" ref={secondRef} label="Second" />,
    ], parent));
    const second = secondRef.current;
    expect(firstRef.current).toBe(first);
    expect(first?.getLabel()).toBe("Updated");
    expect(second?.getParent()).toBe(parent);

    await rerender(createPortal(<GtkButton key="second" ref={secondRef} label="Second" />, parent));
    expect(first?.getParent()).toBeNull();
    expect(parent.getFirstChild()).toBe(second);

    await unmount();
    expect(second?.getParent()).toBeNull();
    expect(parent.getFirstChild()).toBeNull();
});
