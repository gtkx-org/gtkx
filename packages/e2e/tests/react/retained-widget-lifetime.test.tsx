import type * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkStack, GtkStackPage } from "@gtkx/jsx/gtk";
import { createPortal } from "@gtkx/react";
import { act, cleanup, render } from "@gtkx/testing";
import { setImmediate } from "node:timers/promises";
import { createRef } from "react";
import { expect, it } from "vitest";
import { gcUntil } from "../helpers/native-utils.js";

const collect = async (): Promise<void> => {
    expect(globalThis.gc).toBeTypeOf("function");

    for (let round = 0; round < 3; round += 1) {
        await setImmediate();
        globalThis.gc?.();
    }
};

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

const failAfterCreatingButton = async (): Promise<WeakRef<() => void>> => {
    let clicks = 0;
    const onClicked = (): void => {
        clicks += 1;
    };
    const handler = new WeakRef(onClicked);
    let didThrow = false;

    try {
        await render(
            <GtkBox>
                <GtkButton label="Abandoned" onClicked={onClicked} />
                <GtkBox>Invalid text child</GtkBox>
            </GtkBox>,
        );
    } catch {
        didThrow = true;
    }

    expect(didThrow).toBe(true);
    expect(clicks).toBe(0);
    await cleanup();

    return handler;
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

it("releases signal handlers when rendering fails before commit", async () => {
    const handler = await failAfterCreatingButton();
    await gcUntil(() => handler.deref() === undefined);
    expect(handler.deref()).toBeUndefined();
});

it("keeps mounted widget and adopted page handlers through collection and replacement", async () => {
    const buttonRef = createRef<Gtk.Button>();
    const pageRef = createRef<Gtk.StackPage>();
    const events: string[] = [];
    const App = ({ version }: { version: string }) => (
        <GtkStack>
            <GtkStackPage
                ref={pageRef}
                title="Initial"
                onNotifyTitle={(title) => {
                    events.push(`${version}:${String(title)}`);
                }}
            >
                <GtkButton
                    ref={buttonRef}
                    label="Click"
                    onClicked={() => {
                        events.push(`${version}:click`);
                    }}
                />
            </GtkStackPage>
        </GtkStack>
    );
    const { rerender, unmount } = await render(<App version="first" />);
    const button = buttonRef.current;
    const page = pageRef.current;

    if (button === null || page === null) {
        throw new Error("The button and page were not mounted");
    }

    await collect();
    await act(() => {
        button.emit("clicked");
        page.setTitle("Changed");
    });
    expect(events).toEqual(["first:click", "first:Changed"]);

    await rerender(<App version="second" />);
    events.length = 0;
    await collect();
    await act(() => {
        button.emit("clicked");
        page.setTitle("Again");
    });
    expect(events).toEqual(["second:click", "second:Again"]);

    await unmount();
    button.emit("clicked");
    page.setTitle("Detached");
    expect(events).toEqual(["second:click", "second:Again"]);
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
