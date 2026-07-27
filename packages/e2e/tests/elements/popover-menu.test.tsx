import type * as Gtk from "@gtkx/gi/gtk";
import * as Gio from "@gtkx/gi/gio";
import { GSimpleAction } from "@gtkx/jsx/gio";
import { GtkApplication, GtkApplicationWindow, GtkMenuButton, GtkPopoverMenu } from "@gtkx/jsx/gtk";
import { rootElement } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { createAppIdFactory } from "../helpers/unique-name.js";

const APP_FLAGS = Gio.ApplicationFlags.NON_UNIQUE;
const uniqueAppId = createAppIdFactory("org.gtkx.popovermenutest");

const buildMenu = (items: { label: string; action: string }[]): Gio.Menu => {
    const menu = Gio.Menu.new();

    for (const item of items) {
        menu.append(item.label, item.action);
    }

    return menu;
};

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
                menuModel={buildMenu([
                    { label: "Item 1", action: "win.item1" },
                    { label: "Item 2", action: "win.item2" },
                ])}
            />,
        );

        expect(ref.current?.getMenuModel()?.getNItems()).toBe(2);
    });

    it("installs the menuModel on a MenuButton", async () => {
        const ref = createRef<Gtk.MenuButton>();

        await render(
            <GtkMenuButton
                ref={ref}
                menuModel={buildMenu([
                    { label: "Option 1", action: "win.opt1" },
                    { label: "Option 2", action: "win.opt2" },
                ])}
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
            <GtkApplication applicationId={uniqueAppId()} flags={APP_FLAGS}>
                <GtkApplicationWindow ref={windowRef} actions={<GSimpleAction name="click" onActivate={onActivate} />}>
                    <GtkPopoverMenu menuModel={buildMenu([{ label: "Click Me", action: "win.click" }])} />
                </GtkApplicationWindow>
            </GtkApplication>,
            { container: rootElement },
        );

        expect(windowRef.current?.activateAction("win.click", null)).toBe(true);
        expect(onActivate).toHaveBeenCalledTimes(1);
    });

    it("removes a menu item's action when it unmounts", async () => {
        const windowRef = createRef<Gtk.ApplicationWindow>();
        const appId = uniqueAppId();

        function App({ enabled }: { enabled: boolean }) {
            return (
                <GtkApplication applicationId={appId} flags={APP_FLAGS}>
                    <GtkApplicationWindow
                        ref={windowRef}
                        actions={enabled && (
                            <GSimpleAction name="toggle" onActivate={vi.fn()} />
                        )}
                    />
                </GtkApplication>
            );
        }

        const { rerender } = await render(<App enabled={true} />, { container: rootElement });
        expect(windowRef.current?.hasAction("toggle")).toBe(true);
        await rerender(<App enabled={false} />);
        expect(windowRef.current?.hasAction("toggle")).toBe(false);
    });
});
