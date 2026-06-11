import type * as Gtk from "@gtkx/gi/gtk";
import { GMenu, GMenuItem, GSimpleAction } from "@gtkx/jsx/gio";
import { GtkApplicationWindow, GtkMenuButton, GtkPopoverMenu } from "@gtkx/jsx/gtk";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

describe("render - PopoverMenu widget integration", () => {
    it("creates a PopoverMenu widget", async () => {
        const ref = createRef<Gtk.PopoverMenu>();
        await render(<GtkPopoverMenu ref={ref} />);
        expect(ref.current).not.toBeNull();
    });

    it("installs the menuModel on a PopoverMenu", async () => {
        const ref = createRef<Gtk.PopoverMenu>();
        await render(
            <GtkPopoverMenu
                ref={ref}
                menuModel={
                    <GMenu>
                        <GMenuItem label="Item 1" action="win.item1" />
                        <GMenuItem label="Item 2" action="win.item2" />
                    </GMenu>
                }
            />,
        );
        expect(ref.current?.getMenuModel()?.getNItems()).toBe(2);
    });

    it("installs the menuModel on a MenuButton", async () => {
        const ref = createRef<Gtk.MenuButton>();
        await render(
            <GtkMenuButton
                ref={ref}
                menuModel={
                    <GMenu>
                        <GMenuItem label="Option 1" action="win.opt1" />
                        <GMenuItem label="Option 2" action="win.opt2" />
                    </GMenu>
                }
            />,
        );
        expect(ref.current?.getMenuModel()?.getNItems()).toBe(2);
    });
});

describe("render - PopoverMenu actions", () => {
    it("invokes a GSimpleAction referenced by a menu item", async () => {
        const windowRef = createRef<Gtk.ApplicationWindow>();
        const onActivate = vi.fn();

        await render(
            <GtkApplicationWindow ref={windowRef} addAction={<GSimpleAction name="click" onActivate={onActivate} />}>
                <GtkPopoverMenu
                    menuModel={
                        <GMenu>
                            <GMenuItem label="Click Me" action="win.click" />
                        </GMenu>
                    }
                />
            </GtkApplicationWindow>,
        );

        expect(windowRef.current?.activateAction("win.click", null)).toBe(true);
        expect(onActivate).toHaveBeenCalledTimes(1);
    });

    it("removes a menu item's action when it unmounts", async () => {
        const windowRef = createRef<Gtk.ApplicationWindow>();

        function App({ enabled }: { enabled: boolean }) {
            return (
                <GtkApplicationWindow
                    ref={windowRef}
                    addAction={enabled && <GSimpleAction name="toggle" onActivate={() => {}} />}
                />
            );
        }

        await render(<App enabled={true} />);
        expect(windowRef.current?.hasAction("toggle")).toBe(true);

        await render(<App enabled={false} />);
        expect(windowRef.current?.hasAction("toggle")).toBe(false);
    });
});
