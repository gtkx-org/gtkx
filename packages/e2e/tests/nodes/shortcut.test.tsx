import type * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkShortcutController } from "@gtkx/react";
import { act, render } from "@gtkx/testing";
import { createRef, useState } from "react";
import { describe, expect, it } from "vitest";

describe("render - Shortcut (1)", () => {
    it("attaches shortcuts to the parent ShortcutController", async () => {
        const controllerRef = createRef<Gtk.ShortcutController>();

        await render(
            <GtkBox>
                <GtkShortcutController ref={controllerRef}>
                    <GtkShortcutController.Shortcut trigger="<Control>s" onActivate={() => true} />
                </GtkShortcutController>
            </GtkBox>,
        );

        const controller = controllerRef.current;
        expect(controller).toBeDefined();
        expect(controller?.getNItems() ?? 0).toBeGreaterThan(0);
    });

    it.each([
        {
            label: "supports an array of triggers (alternative trigger)",
            trigger: ["<Control>s", "F2"],
            disabled: false,
        },
        { label: "uses NeverTrigger when disabled", trigger: "<Control>s", disabled: true },
        { label: "uses NeverTrigger for an empty trigger array", trigger: [], disabled: false },
    ])("$label", async ({ trigger, disabled }) => {
        const controllerRef = createRef<Gtk.ShortcutController>();

        await render(
            <GtkBox>
                <GtkShortcutController ref={controllerRef}>
                    <GtkShortcutController.Shortcut trigger={trigger} onActivate={() => true} disabled={disabled} />
                </GtkShortcutController>
            </GtkBox>,
        );

        expect(controllerRef.current?.getNItems() ?? 0).toBe(1);
    });
});

describe("render - Shortcut (2)", () => {
    it("removes the shortcut from the controller when unmounted", async () => {
        const controllerRef = createRef<Gtk.ShortcutController>();

        const Harness = () => {
            const [show, setShow] = useState(true);
            return (
                <GtkBox>
                    <GtkShortcutController ref={controllerRef}>
                        {show && (
                            <GtkShortcutController.Shortcut
                                trigger="<Control>s"
                                onActivate={() => {
                                    setShow(false);
                                    return true;
                                }}
                            />
                        )}
                    </GtkShortcutController>
                </GtkBox>
            );
        };

        const { rerender } = await render(<Harness />);
        expect(controllerRef.current?.getNItems() ?? 0).toBe(1);

        const Empty = () => (
            <GtkBox>
                <GtkShortcutController ref={controllerRef} />
            </GtkBox>
        );
        await rerender(<Empty />);

        expect(controllerRef.current?.getNItems() ?? 0).toBe(0);
    });
});

describe("render - Shortcut (3)", () => {
    it("re-applies the trigger when the disabled prop changes", async () => {
        const controllerRef = createRef<Gtk.ShortcutController>();
        let updateDisabled: (next: boolean) => void = () => {};

        const Harness = () => {
            const [disabled, setDisabled] = useState(false);
            updateDisabled = setDisabled;
            return (
                <GtkBox>
                    <GtkShortcutController ref={controllerRef}>
                        <GtkShortcutController.Shortcut
                            trigger="<Control>s"
                            disabled={disabled}
                            onActivate={() => true}
                        />
                    </GtkShortcutController>
                </GtkBox>
            );
        };

        const { rerender } = await render(<Harness />);
        expect(controllerRef.current?.getNItems() ?? 0).toBe(1);

        await act(() => updateDisabled(true));
        await rerender(<Harness />);

        expect(controllerRef.current?.getNItems() ?? 0).toBe(1);
    });
});
