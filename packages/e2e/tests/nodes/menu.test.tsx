import * as Gio from "@gtkx/gi/gio";
import type * as Gtk from "@gtkx/gi/gtk";
import { GMenu, GMenuItem } from "@gtkx/jsx/gio";
import { GtkPopoverMenu, GtkPopoverMenuBar } from "@gtkx/jsx/gtk";
import { render } from "@gtkx/testing";
import { createRef, type ReactNode, type RefObject } from "react";
import { describe, expect, it } from "vitest";

const itemLabel = (model: Gio.MenuModel, index: number): string | null => {
    const variant = model.getItemAttributeValue(index, Gio.MENU_ATTRIBUTE_LABEL, null);
    if (!variant) return null;
    const [text] = variant.dupString();
    return typeof text === "string" ? text : null;
};

const itemAction = (model: Gio.MenuModel, index: number): string | null => {
    const variant = model.getItemAttributeValue(index, Gio.MENU_ATTRIBUTE_ACTION, null);
    if (!variant) return null;
    const [text] = variant.dupString();
    return typeof text === "string" ? text : null;
};

const sectionAt = (model: Gio.MenuModel, index: number): Gio.MenuModel | null =>
    model.getItemLink(index, Gio.MENU_LINK_SECTION);

const submenuAt = (model: Gio.MenuModel, index: number): Gio.MenuModel | null =>
    model.getItemLink(index, Gio.MENU_LINK_SUBMENU);

const requireModel = (menu: Gtk.PopoverMenu | Gtk.PopoverMenuBar | null): Gio.MenuModel => {
    const model = menu?.getMenuModel();
    if (!model) throw new Error("Expected menu model");
    return model;
};

const requireLink = (model: Gio.MenuModel | null): Gio.MenuModel => {
    if (!model) throw new Error("Expected linked menu model");
    return model;
};

const renderPopoverMenu = async (children: ReactNode): Promise<Gio.MenuModel> => {
    const ref = createRef<Gtk.PopoverMenu>();
    await render(<GtkPopoverMenu ref={ref} menuModel={<GMenu>{children}</GMenu>} />);
    return requireModel(ref.current);
};

type MenuRef = RefObject<Gtk.PopoverMenu | null>;

const ItemListApp = ({ menuRef, items }: { menuRef: MenuRef; items: string[] }) => (
    <GtkPopoverMenu
        ref={menuRef}
        menuModel={
            <GMenu>
                {items.map((label) => (
                    <GMenuItem key={label} label={label} action={`win.${label.replace(/\s+/g, "")}`} />
                ))}
            </GMenu>
        }
    />
);

const renderItemListTransition = async (initialItems: string[], updatedItems: string[]): Promise<Gio.MenuModel> => {
    const ref = createRef<Gtk.PopoverMenu>();

    await render(<ItemListApp menuRef={ref} items={initialItems} />);
    await render(<ItemListApp menuRef={ref} items={updatedItems} />);

    return requireModel(ref.current);
};

const LabeledItemApp = ({ menuRef, label }: { menuRef: MenuRef; label: string }) => (
    <GtkPopoverMenu
        ref={menuRef}
        menuModel={
            <GMenu>
                <GMenuItem label={label} action="win.item" />
            </GMenu>
        }
    />
);

const RemovableItemApp = ({ menuRef, showItem }: { menuRef: MenuRef; showItem: boolean }) => (
    <GtkPopoverMenu
        ref={menuRef}
        menuModel={<GMenu>{showItem && <GMenuItem label="Removable" action="win.r" />}</GMenu>}
    />
);

describe("render - Menu items", () => {
    it("adds a menu item with a label and detailed action", async () => {
        const model = await renderPopoverMenu(<GMenuItem label="Item 1" action="win.item1" />);

        expect(model.getNItems()).toBe(1);
        expect(itemLabel(model, 0)).toBe("Item 1");
        expect(itemAction(model, 0)).toBe("win.item1");
    });

    it("inserts items in tree order and re-snapshots on change", async () => {
        const ref = createRef<Gtk.PopoverMenu>();

        await render(<ItemListApp menuRef={ref} items={["Item 1", "Item 2"]} />);
        expect(requireModel(ref.current).getNItems()).toBe(2);

        await render(<ItemListApp menuRef={ref} items={["Item 1", "Item 2", "Item 3"]} />);
        const model = requireModel(ref.current);
        expect(model.getNItems()).toBe(3);
        expect(itemLabel(model, 2)).toBe("Item 3");
    });

    it("inserts a new item at its tree position, not the end", async () => {
        const model = await renderItemListTransition(["A", "C"], ["A", "B", "C"]);

        expect(model.getNItems()).toBe(3);
        expect(itemLabel(model, 0)).toBe("A");
        expect(itemLabel(model, 1)).toBe("B");
        expect(itemLabel(model, 2)).toBe("C");
    });

    it("reorders items by moving a single entry", async () => {
        const model = await renderItemListTransition(["A", "B", "C"], ["C", "A", "B"]);

        expect([itemLabel(model, 0), itemLabel(model, 1), itemLabel(model, 2)]).toEqual(["C", "A", "B"]);
    });
});

describe("render - Menu item updates", () => {
    it("updates a label when its prop changes", async () => {
        const ref = createRef<Gtk.PopoverMenu>();

        await render(<LabeledItemApp menuRef={ref} label="Initial" />);
        expect(itemLabel(requireModel(ref.current), 0)).toBe("Initial");

        await render(<LabeledItemApp menuRef={ref} label="Updated" />);
        expect(itemLabel(requireModel(ref.current), 0)).toBe("Updated");
    });

    it("removes an item when it unmounts", async () => {
        const ref = createRef<Gtk.PopoverMenu>();

        await render(<RemovableItemApp menuRef={ref} showItem={true} />);
        expect(requireModel(ref.current).getNItems()).toBe(1);

        await render(<RemovableItemApp menuRef={ref} showItem={false} />);
        expect(requireModel(ref.current).getNItems()).toBe(0);
    });
});

describe("render - Menu sections", () => {
    it("links a child menu as a section", async () => {
        const model = await renderPopoverMenu(
            <GMenuItem section>
                <GMenu>
                    <GMenuItem label="Section Item 1" action="win.s1" />
                    <GMenuItem label="Section Item 2" action="win.s2" />
                </GMenu>
            </GMenuItem>,
        );

        expect(model.getNItems()).toBe(1);
        const section = requireLink(sectionAt(model, 0));
        expect(section.getNItems()).toBe(2);
        expect(itemLabel(section, 0)).toBe("Section Item 1");
        expect(itemLabel(section, 1)).toBe("Section Item 2");
    });

    it("keeps a section header label on the linking item", async () => {
        const model = await renderPopoverMenu(
            <GMenuItem section label="Section Title">
                <GMenu>
                    <GMenuItem label="Item" action="win.i" />
                </GMenu>
            </GMenuItem>,
        );

        expect(itemLabel(model, 0)).toBe("Section Title");
        expect(requireLink(sectionAt(model, 0)).getNItems()).toBe(1);
    });
});

describe("render - Menu submenus", () => {
    it("links a child menu as a submenu", async () => {
        const ref = createRef<Gtk.PopoverMenuBar>();
        await render(
            <GtkPopoverMenuBar
                ref={ref}
                menuModel={
                    <GMenu>
                        <GMenuItem label="File">
                            <GMenu>
                                <GMenuItem label="New" action="win.new" />
                                <GMenuItem label="Open" action="win.open" />
                            </GMenu>
                        </GMenuItem>
                    </GMenu>
                }
            />,
        );

        const model = requireModel(ref.current);
        expect(model.getNItems()).toBe(1);
        expect(itemLabel(model, 0)).toBe("File");

        const submenu = requireLink(submenuAt(model, 0));
        expect(submenu.getNItems()).toBe(2);
        expect(itemLabel(submenu, 0)).toBe("New");
        expect(itemLabel(submenu, 1)).toBe("Open");
    });

    it("supports nested submenus", async () => {
        const model = await renderPopoverMenu(
            <GMenuItem label="File">
                <GMenu>
                    <GMenuItem label="Recent">
                        <GMenu>
                            <GMenuItem label="File 1" action="win.f1" />
                            <GMenuItem label="File 2" action="win.f2" />
                        </GMenu>
                    </GMenuItem>
                </GMenu>
            </GMenuItem>,
        );

        const file = requireLink(submenuAt(model, 0));
        expect(file.getNItems()).toBe(1);
        expect(itemLabel(file, 0)).toBe("Recent");

        const recent = requireLink(submenuAt(file, 0));
        expect(recent.getNItems()).toBe(2);
        expect(itemLabel(recent, 0)).toBe("File 1");
        expect(itemLabel(recent, 1)).toBe("File 2");
    });

    it("adds items to a submenu as they mount", async () => {
        const ref = createRef<Gtk.PopoverMenu>();

        function App({ extra }: { extra: boolean }) {
            return (
                <GtkPopoverMenu
                    ref={ref}
                    menuModel={
                        <GMenu>
                            <GMenuItem label="Edit">
                                <GMenu>
                                    <GMenuItem label="Cut" action="win.cut" />
                                    {extra && <GMenuItem label="Copy" action="win.copy" />}
                                </GMenu>
                            </GMenuItem>
                        </GMenu>
                    }
                />
            );
        }

        await render(<App extra={false} />);
        expect(requireLink(submenuAt(requireModel(ref.current), 0)).getNItems()).toBe(1);

        await render(<App extra={true} />);
        expect(requireLink(submenuAt(requireModel(ref.current), 0)).getNItems()).toBe(2);
    });
});
