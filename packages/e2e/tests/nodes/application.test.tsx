import * as Gio from "@gtkx/gi/gio";
import type * as Gtk from "@gtkx/gi/gtk";
import { GMenu, GMenuItem } from "@gtkx/jsx/gio";
import { GtkApplication, GtkApplicationWindow } from "@gtkx/jsx/gtk";
import { render } from "@gtkx/testing";
import { createRef, type ReactNode, type RefObject } from "react";
import { describe, expect, it } from "vitest";

const APP_FLAGS = Gio.ApplicationFlags.NON_UNIQUE;

let nextAppId = 0;
const uniqueAppId = (): string => `org.gtkx.applicationtest${nextAppId++}`;

const MenubarApp = ({
    appRef,
    appId,
    menubar,
}: {
    appRef: RefObject<Gtk.Application | null>;
    appId: string;
    menubar: ReactNode;
}): ReactNode => (
    <GtkApplication ref={appRef} applicationId={appId} flags={APP_FLAGS} menubar={menubar}>
        <GtkApplicationWindow defaultWidth={800} defaultHeight={600} />
    </GtkApplication>
);

const renderApp = async (menubar: ReactNode): Promise<Gtk.Application> => {
    const ref = createRef<Gtk.Application>();
    await render(<MenubarApp appRef={ref} appId={uniqueAppId()} menubar={menubar} />, { wrapper: false });
    if (!ref.current) throw new Error("Expected application instance");
    return ref.current;
};

describe("render - Application", () => {
    describe("menubar slot", () => {
        it("sets menubar from a GMenu", async () => {
            const app = await renderApp(
                <GMenu>
                    <GMenuItem label="File">
                        <GMenu>
                            <GMenuItem label="New" action="win.new" />
                            <GMenuItem label="Open" action="win.open" />
                        </GMenu>
                    </GMenuItem>
                    <GMenuItem label="Edit">
                        <GMenu>
                            <GMenuItem label="Cut" action="win.cut" />
                        </GMenu>
                    </GMenuItem>
                </GMenu>,
            );

            const menubar = app.getMenubar();
            expect(menubar).not.toBeNull();
            expect(menubar?.getNItems()).toBe(2);
        });

        it("clears menubar when the GMenu is removed", async () => {
            const ref = createRef<Gtk.Application>();
            const appId = uniqueAppId();
            const fileMenu = (
                <GMenu>
                    <GMenuItem label="File">
                        <GMenu>
                            <GMenuItem label="New" action="win.new" />
                        </GMenu>
                    </GMenuItem>
                </GMenu>
            );

            const { rerender } = await render(<MenubarApp appRef={ref} appId={appId} menubar={fileMenu} />, {
                wrapper: false,
            });
            expect(ref.current?.getMenubar()).not.toBeNull();

            await rerender(<MenubarApp appRef={ref} appId={appId} menubar={null} />);
            expect(ref.current?.getMenubar()).toBeNull();
        });

        it("updates menubar when items change", async () => {
            const ref = createRef<Gtk.Application>();
            const appId = uniqueAppId();
            const fileMenu = (items: string[]): ReactNode => (
                <GMenu>
                    <GMenuItem label="File">
                        <GMenu>
                            {items.map((label) => (
                                <GMenuItem key={label} label={label} action={`win.${label}`} />
                            ))}
                        </GMenu>
                    </GMenuItem>
                </GMenu>
            );

            const { rerender } = await render(
                <MenubarApp appRef={ref} appId={appId} menubar={fileMenu(["New", "Open"])} />,
                { wrapper: false },
            );
            expect(ref.current?.getMenubar()?.getItemLink(0, "submenu")?.getNItems()).toBe(2);

            await rerender(<MenubarApp appRef={ref} appId={appId} menubar={fileMenu(["New", "Open", "Save"])} />);
            expect(ref.current?.getMenubar()?.getItemLink(0, "submenu")?.getNItems()).toBe(3);
        });
    });
});
