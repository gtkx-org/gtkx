import type { RefObject } from "react";
import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import {
    GtkBox,
    GtkCallbackAction,
    GtkEntry,
    GtkEventControllerKey,
    GtkKeyvalTrigger,
    GtkShortcut,
    GtkShortcutController,
    GtkShortcutTrigger,
} from "@gtkx/jsx/gtk";
import { render, userEvent, within } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

type ShortcutTreeProps = {
    accelerator: string;
    callback: Gtk.ShortcutFunc;
    controllerRef?: RefObject<Gtk.ShortcutController | null>;
    isMounted?: boolean;
    onKeyPressed?: () => boolean;
};

const ShortcutTree = ({
    accelerator,
    callback,
    controllerRef,
    isMounted = true,
    onKeyPressed,
}: ShortcutTreeProps) => (
    <GtkBox
        controllers={(
            <GtkShortcutController
                ref={controllerRef}
                propagationPhase={Gtk.PropagationPhase.CAPTURE}
                shortcuts={
                    isMounted && (
                        <GtkShortcut
                            trigger={<GtkShortcutTrigger accelerator={accelerator} />}
                            action={<GtkCallbackAction callback={callback} />}
                        />
                    )
                }
            />
        )}
    >
        <GtkEntry name="field" controllers={<GtkEventControllerKey onKeyPressed={onKeyPressed} />} />
    </GtkBox>
);

describe("declarative shortcuts", () => {
    it("activates, updates callbacks, replaces triggers, and unmounts", async () => {
        const calls: string[] = [];
        const controllerRef = createRef<Gtk.ShortcutController>();
        const first = () => {
            calls.push("first");

            return true;
        };
        const second = () => {
            calls.push("second");

            return true;
        };
        const third = () => {
            calls.push("third");

            return true;
        };

        const { container, rerender } = await render(
            <ShortcutTree accelerator="F5" callback={first} controllerRef={controllerRef} />,
        );
        const field = await within(container).findByName("field");

        await userEvent.keyboard(field, "{F5}");
        expect(calls).toEqual(["first"]);

        await rerender(<ShortcutTree accelerator="F5" callback={second} controllerRef={controllerRef} />);
        await userEvent.keyboard(field, "{F5}");
        expect(calls).toEqual(["first", "second"]);

        await rerender(<ShortcutTree accelerator="F6" callback={third} controllerRef={controllerRef} />);
        await userEvent.keyboard(field, "{F5}");
        await userEvent.keyboard(field, "{F6}");
        expect(calls).toEqual(["first", "second", "third"]);

        await rerender(
            <ShortcutTree accelerator="F6" callback={third} controllerRef={controllerRef} isMounted={false} />,
        );
        expect(controllerRef.current?.nItems).toBe(0);
        await userEvent.keyboard(field, "{F6}");
        expect(calls).toEqual(["first", "second", "third"]);
    });

    it("propagates a false result and stops a true result", async () => {
        let shortcutCalls = 0;
        let keyCalls = 0;
        const handleKeyPressed = () => {
            keyCalls += 1;

            return false;
        };
        const tree = (isHandled: boolean) => (
            <ShortcutTree
                accelerator="F5"
                callback={() => {
                    shortcutCalls += 1;

                    return isHandled;
                }}
                onKeyPressed={handleKeyPressed}
            />
        );

        const { container, rerender } = await render(tree(false));
        const field = await within(container).findByName("field");

        await userEvent.keyboard(field, "{F5}");
        expect([shortcutCalls, keyCalls]).toEqual([1, 1]);

        await rerender(tree(true));
        await userEvent.keyboard(field, "{F5}");
        expect([shortcutCalls, keyCalls]).toEqual([2, 1]);
    });

    it("constructs a keyval trigger through its existing props", async () => {
        let calls = 0;
        const { container } = await render(
            <GtkBox
                name="host"
                controllers={(
                    <GtkShortcutController
                        shortcuts={(
                            <GtkShortcut
                                trigger={(
                                    <GtkKeyvalTrigger
                                        keyval={Gdk.KEY_F5}
                                        modifiers={Gdk.ModifierType.NO_MODIFIER_MASK}
                                    />
                                )}
                                action={(
                                    <GtkCallbackAction
                                        callback={() => {
                                            calls += 1;

                                            return true;
                                        }}
                                    />
                                )}
                            />
                        )}
                    />
                )}
            />,
        );

        await userEvent.keyboard(await within(container).findByName("host"), "{F5}");
        expect(calls).toBe(1);
    });

    it("keeps native shortcut objects as valid prop values", async () => {
        let calls = 0;
        const trigger = Gtk.ShortcutTrigger.parseString("F7");
        const action = Gtk.CallbackAction.new(() => {
            calls += 1;

            return true;
        });
        const { container } = await render(
            <GtkBox
                name="host"
                controllers={(
                    <GtkShortcutController shortcuts={<GtkShortcut trigger={trigger} action={action} />} />
                )}
            />,
        );

        await userEvent.keyboard(await within(container).findByName("host"), "{F7}");
        expect(calls).toBe(1);
    });

    it("rejects an invalid accelerator", async () => {
        await expect(render(
            <ShortcutTree accelerator="not an accelerator" callback={() => true} />,
        )).rejects.toThrow();
    });
});
