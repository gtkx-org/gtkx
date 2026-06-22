import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkShortcut, GtkShortcutController } from "@gtkx/jsx/gtk";
import { act, render } from "@gtkx/testing";
import { createRef, useState } from "react";
import { describe, expect, it } from "vitest";

const callbackAction = (): Gtk.ShortcutAction => Gtk.CallbackAction.new(() => true);

describe("render - Shortcut (1)", () => {
    it("attaches shortcuts to the parent ShortcutController", async () => {
        const controllerRef = createRef<Gtk.ShortcutController>();

        await render(
            <GtkBox
                controllers={
                    <GtkShortcutController
                        ref={controllerRef}
                        shortcuts={
                            <GtkShortcut
                                trigger={Gtk.ShortcutTrigger.parseString("<Control>s")}
                                action={callbackAction()}
                            />
                        }
                    />
                }
            />,
        );

        const controller = controllerRef.current;
        expect(controller).toBeDefined();
        expect(controller?.getNItems() ?? 0).toBeGreaterThan(0);
    });

    it.each([
        {
            label: "supports an alternative trigger",
            trigger: Gtk.AlternativeTrigger.new(
                Gtk.ShortcutTrigger.parseString("<Control>s"),
                Gtk.ShortcutTrigger.parseString("F2"),
            ),
        },
        { label: "supports a never trigger", trigger: Gtk.NeverTrigger.get() },
    ])("$label", async ({ trigger }) => {
        const controllerRef = createRef<Gtk.ShortcutController>();

        await render(
            <GtkBox
                controllers={
                    <GtkShortcutController
                        ref={controllerRef}
                        shortcuts={<GtkShortcut trigger={trigger} action={callbackAction()} />}
                    />
                }
            />,
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
                <GtkBox
                    controllers={
                        <GtkShortcutController
                            ref={controllerRef}
                            shortcuts={
                                show && (
                                    <GtkShortcut
                                        trigger={Gtk.ShortcutTrigger.parseString("<Control>s")}
                                        action={Gtk.CallbackAction.new(() => {
                                            setShow(false);
                                            return true;
                                        })}
                                    />
                                )
                            }
                        />
                    }
                />
            );
        };

        const { rerender } = await render(<Harness />);
        expect(controllerRef.current?.getNItems() ?? 0).toBe(1);

        const Empty = () => <GtkBox controllers={<GtkShortcutController ref={controllerRef} />} />;
        await rerender(<Empty />);

        expect(controllerRef.current?.getNItems() ?? 0).toBe(0);
    });
});

describe("render - Shortcut (3)", () => {
    it("re-applies the trigger when it changes", async () => {
        const controllerRef = createRef<Gtk.ShortcutController>();
        let updateDisabled: (next: boolean) => void = () => {};

        const Harness = () => {
            const [disabled, setDisabled] = useState(false);
            updateDisabled = setDisabled;
            return (
                <GtkBox
                    controllers={
                        <GtkShortcutController
                            ref={controllerRef}
                            shortcuts={
                                <GtkShortcut
                                    trigger={
                                        disabled
                                            ? Gtk.NeverTrigger.get()
                                            : Gtk.ShortcutTrigger.parseString("<Control>s")
                                    }
                                    action={callbackAction()}
                                />
                            }
                        />
                    }
                />
            );
        };

        const { rerender } = await render(<Harness />);
        expect(controllerRef.current?.getNItems() ?? 0).toBe(1);

        await act(() => updateDisabled(true));
        await rerender(<Harness />);

        expect(controllerRef.current?.getNItems() ?? 0).toBe(1);
    });
});
