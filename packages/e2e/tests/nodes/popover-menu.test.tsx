import type * as Gtk from "@gtkx/ffi/gtk";
import { GtkMenuButton, GtkPopoverMenu } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

const MenuItem = "MenuItem" as const;
const MenuSection = "MenuSection" as const;

describe("render - PopoverMenu > PopoverMenuNode (1)", () => {
    it("creates PopoverMenu widget", async () => {
        const ref = createRef<Gtk.PopoverMenu>();

        await render(<GtkPopoverMenu ref={ref} />);

        expect(ref.current).not.toBeNull();
    });

    it("sets menu model", async () => {
        const popoverRef = createRef<Gtk.PopoverMenu>();

        await render(
            <GtkPopoverMenu ref={popoverRef}>
                <MenuItem id="item1" label="Item 1" onActivate={() => {}} />
                <MenuItem id="item2" label="Item 2" onActivate={() => {}} />
            </GtkPopoverMenu>,
        );

        expect(popoverRef.current?.getMenuModel()?.getNItems()).toBeGreaterThan(0);
    });

    it("handles MenuButton parent", async () => {
        const buttonRef = createRef<Gtk.MenuButton>();

        await render(
            <GtkMenuButton ref={buttonRef}>
                <MenuItem id="opt1" label="Option 1" onActivate={() => {}} />
                <MenuItem id="opt2" label="Option 2" onActivate={() => {}} />
            </GtkMenuButton>,
        );

        expect(buttonRef.current?.getMenuModel()?.getNItems()).toBeGreaterThan(0);
    });

    it("adds menu items", async () => {
        const popoverRef = createRef<Gtk.PopoverMenu>();

        await render(
            <GtkPopoverMenu ref={popoverRef}>
                <MenuItem id="first" label="First" onActivate={() => {}} />
                <MenuItem id="second" label="Second" onActivate={() => {}} />
                <MenuItem id="third" label="Third" onActivate={() => {}} />
            </GtkPopoverMenu>,
        );

        expect(popoverRef.current?.getMenuModel()?.getNItems()).toBe(3);
    });
});

describe("render - PopoverMenu > PopoverMenuNode (2)", () => {
    it("handles menu item with action", async () => {
        const popoverRef = createRef<Gtk.PopoverMenu>();
        const onActivate = vi.fn();

        await render(
            <GtkPopoverMenu ref={popoverRef}>
                <MenuItem id="click" label="Click Me" onActivate={onActivate} />
            </GtkPopoverMenu>,
        );

        expect(popoverRef.current?.getMenuModel()?.getNItems()).toBe(1);
    });

    it("removes menu items", async () => {
        const popoverRef = createRef<Gtk.PopoverMenu>();

        function App({ items }: { items: string[] }) {
            return (
                <GtkPopoverMenu ref={popoverRef}>
                    {items.map((label) => (
                        <MenuItem key={label} id={label} label={label} onActivate={() => {}} />
                    ))}
                </GtkPopoverMenu>
            );
        }

        await render(<App items={["A", "B", "C"]} />);
        expect(popoverRef.current?.getMenuModel()?.getNItems()).toBe(3);

        await render(<App items={["A"]} />);
        expect(popoverRef.current?.getMenuModel()?.getNItems()).toBe(1);
    });
});

describe("render - PopoverMenu > PopoverMenuNode (3)", () => {
    it("handles menu sections", async () => {
        const popoverRef = createRef<Gtk.PopoverMenu>();

        await render(
            <GtkPopoverMenu ref={popoverRef}>
                <MenuSection>
                    <MenuItem id="s1item" label="Section 1 Item" onActivate={() => {}} />
                </MenuSection>
                <MenuSection>
                    <MenuItem id="s2item" label="Section 2 Item" onActivate={() => {}} />
                </MenuSection>
            </GtkPopoverMenu>,
        );

        expect(popoverRef.current?.getMenuModel()).not.toBeNull();
    });
});
