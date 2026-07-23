import { Menu, type MenuEntry } from "@gtkx/components";
import * as Gio from "@gtkx/gi/gio";
import type * as Gtk from "@gtkx/gi/gtk";

import { GtkPopoverMenu, GtkPopoverMenuBar } from "@gtkx/jsx/gtk";

import { render } from "@gtkx/testing";
import { createRef, type RefObject } from "react";
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

const renderPopoverMenu = async (items: MenuEntry[]): Promise<Gio.MenuModel> => {
    const ref = createRef<Gtk.PopoverMenu>();
    await render(<GtkPopoverMenu ref={ref} menuModel={<Menu items={items} />} />);
    return requireModel(ref.current);
};

type MenuRef = RefObject<Gtk.PopoverMenu | null>;

const ItemListApp = ({ menuRef, items }: { menuRef: MenuRef; items: string[] }) => (
    <GtkPopoverMenu
        ref={menuRef}
        menuModel={<Menu items={items.map((label) => ({ label, action: `win.${label.replace(/\s+/g, "")}` }))} />}
    />
);

const renderItemListTransition = async (initialItems: string[], updatedItems: string[]): Promise<Gio.MenuModel> => {
    const ref = createRef<Gtk.PopoverMenu>();

    await render(<ItemListApp menuRef={ref} items={initialItems} />);
    await render(<ItemListApp menuRef={ref} items={updatedItems} />);

    return requireModel(ref.current);
};

const LabeledItemApp = ({ menuRef, label }: { menuRef: MenuRef; label: string }) => (
    <GtkPopoverMenu ref={menuRef} menuModel={<Menu items={[{ label, action: "win.item" }]} />} />
);

const RemovableItemApp = ({ menuRef, showItem }: { menuRef: MenuRef; showItem: boolean }) => (
    <GtkPopoverMenu
        ref={menuRef}
        menuModel={<Menu items={showItem ? [{ label: "Removable", action: "win.r" }] : []} />}
    />
);

describe("render - Menu items", () => {
    it("adds a menu item with a label and detailed action", async () => {
        const model = await renderPopoverMenu([{ label: "Item 1", action: "win.item1" }]);

        expect(model.getNItems()).toBe(1);
        expect(itemLabel(model, 0)).toBe("Item 1");
        expect(itemAction(model, 0)).toBe("win.item1");
    });

    it("appends items in array order and re-snapshots on change", async () => {
        const ref = createRef<Gtk.PopoverMenu>();

        await render(<ItemListApp menuRef={ref} items={["Item 1", "Item 2"]} />);
        expect(requireModel(ref.current).getNItems()).toBe(2);

        await render(<ItemListApp menuRef={ref} items={["Item 1", "Item 2", "Item 3"]} />);
        const model = requireModel(ref.current);
        expect(model.getNItems()).toBe(3);
        expect(itemLabel(model, 2)).toBe("Item 3");
    });

    it("places a new item at its array position, not the end", async () => {
        const model = await renderItemListTransition(["A", "C"], ["A", "B", "C"]);

        expect(model.getNItems()).toBe(3);
        expect(itemLabel(model, 0)).toBe("A");
        expect(itemLabel(model, 1)).toBe("B");
        expect(itemLabel(model, 2)).toBe("C");
    });

    it("reflects a reordered items array", async () => {
        const model = await renderItemListTransition(["A", "B", "C"], ["C", "A", "B"]);

        expect([itemLabel(model, 0), itemLabel(model, 1), itemLabel(model, 2)]).toEqual(["C", "A", "B"]);
    });
});

describe("render - Menu item updates", () => {
    it("updates a label when its entry changes", async () => {
        const ref = createRef<Gtk.PopoverMenu>();

        await render(<LabeledItemApp menuRef={ref} label="Initial" />);
        expect(itemLabel(requireModel(ref.current), 0)).toBe("Initial");

        await render(<LabeledItemApp menuRef={ref} label="Updated" />);
        expect(itemLabel(requireModel(ref.current), 0)).toBe("Updated");
    });

    it("removes an item when it leaves the items array", async () => {
        const ref = createRef<Gtk.PopoverMenu>();

        await render(<RemovableItemApp menuRef={ref} showItem={true} />);
        expect(requireModel(ref.current).getNItems()).toBe(1);

        await render(<RemovableItemApp menuRef={ref} showItem={false} />);
        expect(requireModel(ref.current).getNItems()).toBe(0);
    });
});

describe("render - Menu sections", () => {
    it("links a section entry's items as a section", async () => {
        const model = await renderPopoverMenu([
            {
                section: [
                    { label: "Section Item 1", action: "win.s1" },
                    { label: "Section Item 2", action: "win.s2" },
                ],
            },
        ]);

        expect(model.getNItems()).toBe(1);
        const section = requireLink(sectionAt(model, 0));
        expect(section.getNItems()).toBe(2);
        expect(itemLabel(section, 0)).toBe("Section Item 1");
        expect(itemLabel(section, 1)).toBe("Section Item 2");
    });

    it("keeps a section header label on the linking item", async () => {
        const model = await renderPopoverMenu([
            { label: "Section Title", section: [{ label: "Item", action: "win.i" }] },
        ]);

        expect(itemLabel(model, 0)).toBe("Section Title");
        expect(requireLink(sectionAt(model, 0)).getNItems()).toBe(1);
    });
});

const FILE_SUBMENU_ITEMS: MenuEntry[] = [
    {
        label: "File",
        submenu: [
            { label: "New", action: "win.new" },
            { label: "Open", action: "win.open" },
        ],
    },
];

const NESTED_SUBMENU_ITEMS: MenuEntry[] = [
    {
        label: "File",
        submenu: [
            {
                label: "Recent",
                submenu: [
                    { label: "File 1", action: "win.f1" },
                    { label: "File 2", action: "win.f2" },
                ],
            },
        ],
    },
];

const GrowingSubmenuApp = ({ menuRef, extra }: { menuRef: MenuRef; extra: boolean }) => {
    const submenu: MenuEntry[] = [{ label: "Cut", action: "win.cut" }];
    if (extra) submenu.push({ label: "Copy", action: "win.copy" });
    return <GtkPopoverMenu ref={menuRef} menuModel={<Menu items={[{ label: "Edit", submenu }]} />} />;
};

describe("render - Menu submenus", () => {
    it("links a submenu entry's items as a submenu", async () => {
        const ref = createRef<Gtk.PopoverMenuBar>();
        await render(<GtkPopoverMenuBar ref={ref} menuModel={<Menu items={FILE_SUBMENU_ITEMS} />} />);

        const model = requireModel(ref.current);
        expect(model.getNItems()).toBe(1);
        expect(itemLabel(model, 0)).toBe("File");

        const submenu = requireLink(submenuAt(model, 0));
        expect(submenu.getNItems()).toBe(2);
        expect(itemLabel(submenu, 0)).toBe("New");
        expect(itemLabel(submenu, 1)).toBe("Open");
    });

    it("supports nested submenus", async () => {
        const model = await renderPopoverMenu(NESTED_SUBMENU_ITEMS);

        const file = requireLink(submenuAt(model, 0));
        expect(file.getNItems()).toBe(1);
        expect(itemLabel(file, 0)).toBe("Recent");

        const recent = requireLink(submenuAt(file, 0));
        expect(recent.getNItems()).toBe(2);
        expect(itemLabel(recent, 0)).toBe("File 1");
        expect(itemLabel(recent, 1)).toBe("File 2");
    });

    it("adds items to a submenu when its entries grow", async () => {
        const ref = createRef<Gtk.PopoverMenu>();

        await render(<GrowingSubmenuApp menuRef={ref} extra={false} />);
        expect(requireLink(submenuAt(requireModel(ref.current), 0)).getNItems()).toBe(1);

        await render(<GrowingSubmenuApp menuRef={ref} extra={true} />);
        expect(requireLink(submenuAt(requireModel(ref.current), 0)).getNItems()).toBe(2);
    });
});
