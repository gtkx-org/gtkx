import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { createRoot, rootElement } from "@gtkx/react";
import { act, render, screen } from "@gtkx/testing";
import { createRef, startTransition, useState } from "react";
import { expect, it } from "vitest";

const CounterProbe = () => {
    const [count, setCount] = useState(0);

    return (
        <GtkBox>
            <GtkButton
                label="Advance"
                onClicked={() => {
                    startTransition(() => {
                        setCount((value) => value + 1);
                    });
                }}
            />
            <GtkLabel label={String(count)} name="transition-value" />
        </GtkBox>
    );
};

it("commits a transition scheduled by a native button outside act", async () => {
    await render(<CounterProbe />);
    const button = screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Advance", as: Gtk.Button });
    for (const value of [1, 2, 3]) {
        button.emit("clicked");
        const deadline = Date.now() + 3000;
        while (
            Date.now() < deadline &&
            screen.getByName("transition-value", { as: Gtk.Label }).getLabel() !== String(value)
        ) {
            await new Promise((resolve) => setTimeout(resolve, 10));
        }
        expect(screen.getByName("transition-value")).toHaveTextContent(String(value));
    }
});

it("unmounts while a native signal has scheduled a transition", async () => {
    const { unmount } = await render(<CounterProbe />);
    screen.getByRole(Gtk.AccessibleRole.BUTTON, { as: Gtk.Button }).emit("clicked");
    await unmount();
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(screen.queryByRole(Gtk.AccessibleRole.BUTTON)).toBeNull();
});

it("unmounts a failed transition and reports its error", async () => {
    const errors: unknown[] = [];
    const button = createRef<Gtk.Button>();
    const root = createRoot(
        { ...rootElement },
        {
            onUncaughtError: (error) => {
                errors.push(error);
            },
        },
    );
    const Probe = () => {
        const [failed, setFailed] = useState(false);
        if (failed) {
            throw new Error("Transition failed");
        }

        return (
            <GtkButton
                ref={button}
                label="Fail"
                onClicked={() => {
                    startTransition(() => {
                        setFailed(true);
                    });
                }}
            />
        );
    };
    try {
        await act(() => {
            root.render(<Probe />);
        });
        const mountedButton = button.current;
        if (mountedButton === null) {
            throw new Error("Button did not mount");
        }
        mountedButton.emit("clicked");
        const deadline = Date.now() + 3000;
        while ((errors.length === 0 || button.current !== null) && Date.now() < deadline) {
            await new Promise((resolve) => setTimeout(resolve, 10));
        }
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0]).toBeInstanceOf(Error);
        expect(button.current).toBeNull();
    } finally {
        await act(() => {
            root.unmount();
        });
    }
});
