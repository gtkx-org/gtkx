import type * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkShortcutController } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef, useState } from "react";
import { describe, expect, it } from "vitest";

describe("render - Shortcut", () => {
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

    it("supports an array of triggers (alternative trigger)", async () => {
        const controllerRef = createRef<Gtk.ShortcutController>();

        await render(
            <GtkBox>
                <GtkShortcutController ref={controllerRef}>
                    <GtkShortcutController.Shortcut trigger={["<Control>s", "F2"]} onActivate={() => true} />
                </GtkShortcutController>
            </GtkBox>,
        );

        expect(controllerRef.current?.getNItems() ?? 0).toBe(1);
    });

    it("uses NeverTrigger when disabled", async () => {
        const controllerRef = createRef<Gtk.ShortcutController>();

        await render(
            <GtkBox>
                <GtkShortcutController ref={controllerRef}>
                    <GtkShortcutController.Shortcut trigger="<Control>s" onActivate={() => true} disabled={true} />
                </GtkShortcutController>
            </GtkBox>,
        );

        expect(controllerRef.current?.getNItems() ?? 0).toBe(1);
    });

    it("uses NeverTrigger for an empty trigger array", async () => {
        const controllerRef = createRef<Gtk.ShortcutController>();

        await render(
            <GtkBox>
                <GtkShortcutController ref={controllerRef}>
                    <GtkShortcutController.Shortcut trigger={[]} onActivate={() => true} />
                </GtkShortcutController>
            </GtkBox>,
        );

        expect(controllerRef.current?.getNItems() ?? 0).toBe(1);
    });

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

        updateDisabled(true);
        await rerender(<Harness />);

        expect(controllerRef.current?.getNItems() ?? 0).toBe(1);
    });
});
