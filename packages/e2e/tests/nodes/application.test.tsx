import type * as Gtk from "@gtkx/gi/gtk";
import { GtkApplicationWindow } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { describe, expect, it } from "vitest";

const MenuSubmenu = "MenuSubmenu" as const;
const MenuItem = "MenuItem" as const;

describe("render - Application", () => {
    describe("ApplicationNode", () => {
        it("sets menubar from Menu children", async () => {
            const { baseElement } = await render(
                <>
                    <GtkApplicationWindow defaultWidth={800} defaultHeight={600} />
                    <MenuSubmenu label="File">
                        <MenuItem id="new" label="New" onActivate={() => {}} />
                        <MenuItem id="open" label="Open" onActivate={() => {}} />
                    </MenuSubmenu>
                    <MenuSubmenu label="Edit">
                        <MenuItem id="cut" label="Cut" onActivate={() => {}} />
                    </MenuSubmenu>
                </>,
                { wrapper: false },
            );

            const app = baseElement as Gtk.Application;
            expect(app.getMenubar()).not.toBeNull();
        });

        it("clears menubar when Menu is removed", async () => {
            function App({ showMenu }: { showMenu: boolean }) {
                return (
                    <>
                        <GtkApplicationWindow defaultWidth={800} defaultHeight={600} />
                        {showMenu ? (
                            <MenuSubmenu label="File">
                                <MenuItem id="new" label="New" onActivate={() => {}} />
                            </MenuSubmenu>
                        ) : null}
                    </>
                );
            }

            const { baseElement, rerender } = await render(<App showMenu={true} />, { wrapper: false });

            const app = baseElement as Gtk.Application;
            expect(app.getMenubar()).not.toBeNull();

            await rerender(<App showMenu={false} />);
            expect(app.getMenubar()).toBeNull();
        });

        it("updates menubar when items change", async () => {
            function App({ items }: { items: string[] }) {
                return (
                    <>
                        <GtkApplicationWindow defaultWidth={800} defaultHeight={600} />
                        <MenuSubmenu label="File">
                            {items.map((label) => (
                                <MenuItem key={label} id={label} label={label} onActivate={() => {}} />
                            ))}
                        </MenuSubmenu>
                    </>
                );
            }

            const { baseElement, rerender } = await render(<App items={["New", "Open"]} />, { wrapper: false });

            const app = baseElement as Gtk.Application;
            expect(app.getMenubar()).not.toBeNull();

            await rerender(<App items={["New", "Open", "Save"]} />);
            expect(app.getMenubar()).not.toBeNull();
        });
    });
});
