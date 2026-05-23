import * as Gio from "@gtkx/ffi/gio";
import type * as Gtk from "@gtkx/ffi/gtk";
import { GtkPopoverMenu, GtkPopoverMenuBar } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef, type ReactNode } from "react";
import { describe, expect, it } from "vitest";

const MenuItem = "MenuItem" as const;
const MenuSection = "MenuSection" as const;
const MenuSubmenu = "MenuSubmenu" as const;

const noop = () => {};

const itemLabel = (model: Gio.MenuModel, index: number): string | null => {
    const variant = model.getItemAttributeValue(index, Gio.MENU_ATTRIBUTE_LABEL, null);
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
    await render(<GtkPopoverMenu ref={ref}>{children}</GtkPopoverMenu>);
    return requireModel(ref.current);
};

describe("render - Menu (1)", () => {
    describe("GtkPopoverMenu", () => {
        it("creates PopoverMenu widget", async () => {
            const model = await renderPopoverMenu(<MenuItem id="item1" label="Item 1" onActivate={noop} />);

            expect(model.getNItems()).toBe(1);
            expect(itemLabel(model, 0)).toBe("Item 1");
        });

        it("rebuilds menu when children change", async () => {
            const ref = createRef<Gtk.PopoverMenu>();

            function App({ items }: { items: string[] }) {
                return (
                    <GtkPopoverMenu ref={ref}>
                        {items.map((label, i) => (
                            <MenuItem key={label} id={`item${i}`} label={label} onActivate={noop} />
                        ))}
                    </GtkPopoverMenu>
                );
            }

            await render(<App items={["Item 1", "Item 2"]} />);
            expect(requireModel(ref.current).getNItems()).toBe(2);

            await render(<App items={["Item 1", "Item 2", "Item 3"]} />);

            const model = requireModel(ref.current);
            expect(model.getNItems()).toBe(3);
            expect(itemLabel(model, 2)).toBe("Item 3");
        });
    });
});

describe("render - Menu (2)", () => {
    describe("PopoverMenuBar", () => {
        it("creates PopoverMenuBar widget", async () => {
            const ref = createRef<Gtk.PopoverMenuBar>();

            await render(
                <GtkPopoverMenuBar ref={ref}>
                    <MenuSubmenu label="File">
                        <MenuItem id="new" label="New" onActivate={noop} />
                    </MenuSubmenu>
                </GtkPopoverMenuBar>,
            );

            const model = requireModel(ref.current);
            expect(model.getNItems()).toBe(1);
            expect(itemLabel(model, 0)).toBe("File");

            const fileSubmenu = requireLink(submenuAt(model, 0));
            expect(fileSubmenu.getNItems()).toBe(1);
            expect(itemLabel(fileSubmenu, 0)).toBe("New");
        });
    });
});

describe("render - Menu (3)", () => {
    describe("Menu.Item (1)", () => {
        it("adds menu item with label", async () => {
            const model = await renderPopoverMenu(<MenuItem id="test" label="Test Item" onActivate={noop} />);

            expect(model.getNItems()).toBe(1);
            expect(itemLabel(model, 0)).toBe("Test Item");
        });

        it("sets keyboard accelerators via accels prop", async () => {
            const model = await renderPopoverMenu(
                <MenuItem id="save" label="Save" accels="<Control>s" onActivate={noop} />,
            );

            expect(model.getNItems()).toBe(1);
            expect(itemLabel(model, 0)).toBe("Save");
        });

        it("updates label when prop changes", async () => {
            const ref = createRef<Gtk.PopoverMenu>();

            function App({ label }: { label: string }) {
                return (
                    <GtkPopoverMenu ref={ref}>
                        <MenuItem id="item" label={label} onActivate={noop} />
                    </GtkPopoverMenu>
                );
            }

            await render(<App label="Initial" />);
            expect(itemLabel(requireModel(ref.current), 0)).toBe("Initial");

            await render(<App label="Updated" />);
            expect(itemLabel(requireModel(ref.current), 0)).toBe("Updated");
        });
    });
});

describe("render - Menu (4)", () => {
    describe("Menu.Item (2)", () => {
        it("cleans up action on unmount", async () => {
            const ref = createRef<Gtk.PopoverMenu>();

            function App({ showItem }: { showItem: boolean }) {
                return (
                    <GtkPopoverMenu ref={ref}>
                        {showItem && <MenuItem id="removable" label="Removable" onActivate={noop} />}
                    </GtkPopoverMenu>
                );
            }

            await render(<App showItem={true} />);
            expect(requireModel(ref.current).getNItems()).toBe(1);

            await render(<App showItem={false} />);
            expect(requireModel(ref.current).getNItems()).toBe(0);
        });
    });
});

describe("render - Menu (5)", () => {
    describe("Menu.Section", () => {
        it("creates menu section", async () => {
            const model = await renderPopoverMenu(
                <MenuSection>
                    <MenuItem id="section1" label="Section Item 1" onActivate={noop} />
                    <MenuItem id="section2" label="Section Item 2" onActivate={noop} />
                </MenuSection>,
            );

            expect(model.getNItems()).toBe(1);

            const section = requireLink(sectionAt(model, 0));
            expect(section.getNItems()).toBe(2);
            expect(itemLabel(section, 0)).toBe("Section Item 1");
            expect(itemLabel(section, 1)).toBe("Section Item 2");
        });

        it("adds items within section", async () => {
            const model = await renderPopoverMenu(
                <>
                    <MenuSection>
                        <MenuItem id="itemA" label="Item A" onActivate={noop} />
                    </MenuSection>
                    <MenuSection>
                        <MenuItem id="itemB" label="Item B" onActivate={noop} />
                    </MenuSection>
                </>,
            );

            expect(model.getNItems()).toBe(2);

            const first = requireLink(sectionAt(model, 0));
            const second = requireLink(sectionAt(model, 1));
            expect(itemLabel(first, 0)).toBe("Item A");
            expect(itemLabel(second, 0)).toBe("Item B");
        });

        it("sets section label", async () => {
            const model = await renderPopoverMenu(
                <MenuSection label="Section Title">
                    <MenuItem id="item" label="Item" onActivate={noop} />
                </MenuSection>,
            );

            expect(itemLabel(model, 0)).toBe("Section Title");
            expect(requireLink(sectionAt(model, 0)).getNItems()).toBe(1);
        });
    });
});

describe("render - Menu (6)", () => {
    describe("Menu.Submenu (1)", () => {
        it("creates submenu", async () => {
            const model = await renderPopoverMenu(
                <MenuSubmenu label="File">
                    <MenuItem id="new" label="New" onActivate={noop} />
                    <MenuItem id="open" label="Open" onActivate={noop} />
                </MenuSubmenu>,
            );

            expect(model.getNItems()).toBe(1);
            expect(itemLabel(model, 0)).toBe("File");

            const submenu = requireLink(submenuAt(model, 0));
            expect(submenu.getNItems()).toBe(2);
            expect(itemLabel(submenu, 0)).toBe("New");
            expect(itemLabel(submenu, 1)).toBe("Open");
        });

        it("adds items within submenu", async () => {
            const model = await renderPopoverMenu(
                <MenuSubmenu label="Edit">
                    <MenuItem id="cut" label="Cut" onActivate={noop} />
                    <MenuItem id="copy" label="Copy" onActivate={noop} />
                    <MenuItem id="paste" label="Paste" onActivate={noop} />
                </MenuSubmenu>,
            );

            const submenu = requireLink(submenuAt(model, 0));
            expect(submenu.getNItems()).toBe(3);
        });

        it("sets submenu label", async () => {
            const model = await renderPopoverMenu(
                <MenuSubmenu label="Help">
                    <MenuItem id="about" label="About" onActivate={noop} />
                </MenuSubmenu>,
            );

            expect(itemLabel(model, 0)).toBe("Help");
            expect(requireLink(submenuAt(model, 0)).getNItems()).toBe(1);
        });
    });
});

describe("render - Menu (7)", () => {
    describe("Menu.Submenu (2)", () => {
        it("supports nested submenus", async () => {
            const model = await renderPopoverMenu(
                <MenuSubmenu label="File">
                    <MenuSubmenu label="Recent">
                        <MenuItem id="file1" label="File 1" onActivate={noop} />
                        <MenuItem id="file2" label="File 2" onActivate={noop} />
                    </MenuSubmenu>
                </MenuSubmenu>,
            );

            expect(model.getNItems()).toBe(1);

            const file = requireLink(submenuAt(model, 0));
            expect(file.getNItems()).toBe(1);
            expect(itemLabel(file, 0)).toBe("Recent");

            const recent = requireLink(submenuAt(file, 0));
            expect(recent.getNItems()).toBe(2);
            expect(itemLabel(recent, 0)).toBe("File 1");
            expect(itemLabel(recent, 1)).toBe("File 2");
        });
    });
});
