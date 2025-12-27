import type * as Gtk from "@gtkx/ffi/gtk";
import { GtkMenuButton, GtkPopoverMenu, Menu } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

describe("render - PopoverMenu", () => {
    describe("PopoverMenuNode", () => {
        it("creates PopoverMenu widget", async () => {
            const ref = createRef<Gtk.PopoverMenu>();

            await render(<GtkPopoverMenu ref={ref} />, { wrapper: false });

            expect(ref.current).not.toBeNull();
        });

        it("sets menu model", async () => {
            const popoverRef = createRef<Gtk.PopoverMenu>();

            await render(
                <GtkPopoverMenu ref={popoverRef}>
                    <Menu.Item id="item1" label="Item 1" onActivate={() => {}} />
                    <Menu.Item id="item2" label="Item 2" onActivate={() => {}} />
                </GtkPopoverMenu>,
                { wrapper: false },
            );

            expect(popoverRef.current?.getMenuModel()?.getNItems()).toBeGreaterThan(0);
        });

        it("handles MenuButton parent", async () => {
            const buttonRef = createRef<Gtk.MenuButton>();

            await render(
                <GtkMenuButton ref={buttonRef}>
                    <Menu.Item id="opt1" label="Option 1" onActivate={() => {}} />
                    <Menu.Item id="opt2" label="Option 2" onActivate={() => {}} />
                </GtkMenuButton>,
                { wrapper: false },
            );

            expect(buttonRef.current?.getMenuModel()?.getNItems()).toBeGreaterThan(0);
        });

        it("adds menu items", async () => {
            const popoverRef = createRef<Gtk.PopoverMenu>();

            await render(
                <GtkPopoverMenu ref={popoverRef}>
                    <Menu.Item id="first" label="First" onActivate={() => {}} />
                    <Menu.Item id="second" label="Second" onActivate={() => {}} />
                    <Menu.Item id="third" label="Third" onActivate={() => {}} />
                </GtkPopoverMenu>,
                { wrapper: false },
            );

            expect(popoverRef.current?.getMenuModel()?.getNItems()).toBe(3);
        });

        it("handles menu item with action", async () => {
            const popoverRef = createRef<Gtk.PopoverMenu>();
            const onActivate = vi.fn();

            await render(
                <GtkPopoverMenu ref={popoverRef}>
                    <Menu.Item id="click" label="Click Me" onActivate={onActivate} />
                </GtkPopoverMenu>,
                { wrapper: false },
            );

            expect(popoverRef.current?.getMenuModel()?.getNItems()).toBe(1);
        });

        it("removes menu items", async () => {
            const popoverRef = createRef<Gtk.PopoverMenu>();

            function App({ items }: { items: string[] }) {
                return (
                    <GtkPopoverMenu ref={popoverRef}>
                        {items.map((label) => (
                            <Menu.Item key={label} id={label} label={label} onActivate={() => {}} />
                        ))}
                    </GtkPopoverMenu>
                );
            }

            await render(<App items={["A", "B", "C"]} />, { wrapper: false });
            expect(popoverRef.current?.getMenuModel()?.getNItems()).toBe(3);

            await render(<App items={["A"]} />, { wrapper: false });
            expect(popoverRef.current?.getMenuModel()?.getNItems()).toBe(1);
        });

        it("handles menu sections", async () => {
            const popoverRef = createRef<Gtk.PopoverMenu>();

            await render(
                <GtkPopoverMenu ref={popoverRef}>
                    <Menu.Section>
                        <Menu.Item id="s1item" label="Section 1 Item" onActivate={() => {}} />
                    </Menu.Section>
                    <Menu.Section>
                        <Menu.Item id="s2item" label="Section 2 Item" onActivate={() => {}} />
                    </Menu.Section>
                </GtkPopoverMenu>,
                { wrapper: false },
            );

            expect(popoverRef.current?.getMenuModel()).not.toBeNull();
        });
    });
});
