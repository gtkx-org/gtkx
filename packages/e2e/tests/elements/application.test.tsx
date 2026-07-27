import type * as Gtk from "@gtkx/gi/gtk";
import * as Gio from "@gtkx/gi/gio";
import { GtkApplication, GtkApplicationWindow } from "@gtkx/jsx/gtk";
import { rootElement } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef, type ReactNode, type RefObject } from "react";
import { describe, expect, it } from "vitest";
import { createAppIdFactory } from "../helpers/unique-name.js";

const APP_FLAGS = Gio.ApplicationFlags.NON_UNIQUE;
const uniqueAppId = createAppIdFactory("org.gtkx.applicationtest");

const buildMenubar = (entries: { label: string; items: { label: string; action: string }[] }[]): Gio.Menu => {
    const menubar = Gio.Menu.new();

    for (const entry of entries) {
        const submenu = Gio.Menu.new();

        for (const item of entry.items) {
            submenu.append(item.label, item.action);
        }

        menubar.appendSubmenu(entry.label, submenu);
    }

    return menubar;
};

const MenubarApp = ({
    appRef,
    appId,
    menubar,
}: {
    appRef: RefObject<Gtk.Application | null>;
    appId: string;
    menubar: Gio.MenuModel | null;
}): ReactNode => (
    <GtkApplication ref={appRef} applicationId={appId} flags={APP_FLAGS} menubar={menubar}>
        <GtkApplicationWindow defaultWidth={800} defaultHeight={600} />
    </GtkApplication>
);

const renderApp = async (menubar: Gio.MenuModel | null): Promise<Gtk.Application> => {
    const ref = createRef<Gtk.Application>();

    await render(<MenubarApp appRef={ref} appId={uniqueAppId()} menubar={menubar} />, {
        container: rootElement,
    });

    if (!ref.current) {
        throw new Error("Expected application instance");
    }

    return ref.current;
};

const fileMenu = (items: string[]): Gio.Menu =>
    buildMenubar([{ label: "File", items: items.map((label) => ({ label, action: `win.${label}` })) }]);

describe("render - Application", () => {
    describe("menubar slot", () => {
        it("sets menubar from a GMenu", async () => {
            const app = await renderApp(
                buildMenubar([
                    {
                        label: "File",
                        items: [
                            { label: "New", action: "win.new" },
                            { label: "Open", action: "win.open" },
                        ],
                    },
                    { label: "Edit", items: [{ label: "Cut", action: "win.cut" }] },
                ]),
            );

            const menubar = app.getMenubar();
            expect(menubar).not.toBeNull();
            expect(menubar?.getNItems()).toBe(2);
        });

        it("clears menubar when the GMenu is removed", async () => {
            const ref = createRef<Gtk.Application>();
            const appId = uniqueAppId();
            const fileMenu = buildMenubar([{ label: "File", items: [{ label: "New", action: "win.new" }] }]);

            const { rerender } = await render(<MenubarApp appRef={ref} appId={appId} menubar={fileMenu} />, {
                container: rootElement,
            });

            expect(ref.current?.getMenubar()).not.toBeNull();
            await rerender(<MenubarApp appRef={ref} appId={appId} menubar={null} />);
            expect(ref.current?.getMenubar()).toBeNull();
        });

        it("updates menubar when items change", async () => {
            const ref = createRef<Gtk.Application>();
            const appId = uniqueAppId();

            const { rerender } = await render(
                <MenubarApp appRef={ref} appId={appId} menubar={fileMenu(["New", "Open"])} />,
                { container: rootElement },
            );

            expect(ref.current?.getMenubar()?.getItemLink(0, "submenu")?.getNItems()).toBe(2);
            await rerender(<MenubarApp appRef={ref} appId={appId} menubar={fileMenu(["New", "Open", "Save"])} />);
            expect(ref.current?.getMenubar()?.getItemLink(0, "submenu")?.getNItems()).toBe(3);
        });
    });
});
