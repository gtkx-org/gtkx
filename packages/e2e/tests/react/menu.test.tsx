import type { GMenuProps } from "@gtkx/jsx/gio";
import type { RefObject } from "react";
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { GMenu, GSimpleAction } from "@gtkx/jsx/gio";
import {
    GtkApplication,
    GtkApplicationWindow,
    GtkBox,
    GtkMenuButton,
    GtkPopoverMenu,
    GtkPopoverMenuBar,
    GtkShortcut,
    GtkShortcutController,
} from "@gtkx/jsx/gtk";
import { rootElement } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { createAppIdFactory } from "../helpers/unique-name.js";

type MenuRef = RefObject<Gtk.PopoverMenu | null>;
type MenuItem = NonNullable<GMenuProps["items"]>[number];

const FILE_SUBMENU_ITEMS: MenuItem[] = [
    {
        label: "File",
        submenu: [
            { label: "New", action: "win.new" },
            { label: "Open", action: "win.open" },
        ],
    },
];

const NESTED_SUBMENU_ITEMS: MenuItem[] = [
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

const APP_FLAGS = Gio.ApplicationFlags.NON_UNIQUE;
const uniqueAppId = createAppIdFactory("org.gtkx.popovermenutest");

const itemLabel = (model: Gio.MenuModel, index: number): string | null => {
    const variant = model.getItemAttributeValue(index, Gio.MENU_ATTRIBUTE_LABEL, null);

    if (!variant) {
        return null;
    }

    const [text] = variant.dupString();

    return typeof text === "string" ? text : null;
};

const itemAction = (model: Gio.MenuModel, index: number): string | null => {
    const variant = model.getItemAttributeValue(index, Gio.MENU_ATTRIBUTE_ACTION, null);

    if (!variant) {
        return null;
    }

    const [text] = variant.dupString();

    return typeof text === "string" ? text : null;
};

const sectionAt = (model: Gio.MenuModel, index: number): Gio.MenuModel | null =>
    model.getItemLink(index, Gio.MENU_LINK_SECTION);

const submenuAt = (model: Gio.MenuModel, index: number): Gio.MenuModel | null =>
    model.getItemLink(index, Gio.MENU_LINK_SUBMENU);

const requireModel = (menu: Gtk.PopoverMenu | Gtk.PopoverMenuBar | null): Gio.MenuModel => {
    const model = menu?.getMenuModel();

    if (!model) {
        throw new Error("Expected menu model");
    }

    return model;
};

const requireLink = (model: Gio.MenuModel | null): Gio.MenuModel => {
    if (!model) {
        throw new Error("Expected linked menu model");
    }

    return model;
};

const renderPopoverMenu = async (items: MenuItem[]): Promise<Gio.MenuModel> => {
    const ref = createRef<Gtk.PopoverMenu>();
    await render(<GtkPopoverMenu ref={ref} menuModel={<GMenu items={items} />} />);

    return requireModel(ref.current);
};

const ItemListApp = ({ menuRef, items }: { menuRef: MenuRef; items: string[] }) => (
    <GtkPopoverMenu
        ref={menuRef}
        menuModel={<GMenu items={items.map((label) => ({ label, action: `win.${label.replaceAll(/\s+/g, "")}` }))} />}
    />
);

const renderItemListTransition = async (
    initialItems: string[],
    updatedItems: string[],
    betweenRenders?: (initial: Gio.MenuModel) => void,
): Promise<Gio.MenuModel> => {
    const ref = createRef<Gtk.PopoverMenu>();
    await render(<ItemListApp menuRef={ref} items={initialItems} />);
    betweenRenders?.(requireModel(ref.current));
    await render(<ItemListApp menuRef={ref} items={updatedItems} />);

    return requireModel(ref.current);
};

const SingleEntryApp = ({ menuRef, entry }: { menuRef: MenuRef; entry: MenuItem }) => (
    <GtkPopoverMenu ref={menuRef} menuModel={<GMenu items={[entry]} />} />
);

const LabeledItemApp = ({ menuRef, label }: { menuRef: MenuRef; label: string }) => (
    <SingleEntryApp menuRef={menuRef} entry={{ label, action: "win.item" }} />
);

const RemovableItemApp = ({ menuRef, shouldShowItem }: { menuRef: MenuRef; shouldShowItem: boolean }) => (
    <GtkPopoverMenu
        ref={menuRef}
        menuModel={<GMenu items={shouldShowItem ? [{ label: "Removable", action: "win.r" }] : []} />}
    />
);

const buildDeepItems = (quitLabel: string): MenuItem[] => [
    { label: "Open", action: "win.open" },
    { label: "Edit", submenu: [{ label: "Cut", action: "win.cut" }] },
    { label: "App", section: [{ label: quitLabel, action: "app.quit" }] },
];

const DeepMenuApp = ({ menuRef, quitLabel }: { menuRef: MenuRef; quitLabel: string }) => (
    <GtkPopoverMenu ref={menuRef} menuModel={<GMenu items={buildDeepItems(quitLabel)} />} />
);

const observeItemsChanged = (model: Gio.MenuModel): { count: number } => {
    const observed = { count: 0 };

    model.connect("items-changed", () => {
        observed.count++;
    });

    return observed;
};

const setupDeepMenu = async () => {
    const ref = createRef<Gtk.PopoverMenu>();
    const { rerender } = await render(<DeepMenuApp menuRef={ref} quitLabel="Quit" />);

    return { ref, rerender };
};

const GrowingSubmenuApp = ({ menuRef, hasExtraItem }: { menuRef: MenuRef; hasExtraItem: boolean }) => {
    const submenu: MenuItem[] = [{ label: "Cut", action: "win.cut" }];

    if (hasExtraItem) {
        submenu.push({ label: "Copy", action: "win.copy" });
    }

    return <SingleEntryApp menuRef={menuRef} entry={{ label: "Edit", submenu }} />;
};

const buildMenu = (items: { label: string; action: string }[]): Gio.Menu => {
    const menu = Gio.Menu.new();

    for (const item of items) {
        menu.append(item.label, item.action);
    }

    return menu;
};

const callbackAction = (): Gtk.ShortcutAction => Gtk.CallbackAction.new(() => true);

describe("render - Menu items", () => {
    it("adds a menu item with a label and detailed action", async () => {
        const model = await renderPopoverMenu([{ label: "Item 1", action: "win.item1" }]);
        expect(model.getNItems()).toBe(1);
        expect(itemLabel(model, 0)).toBe("Item 1");
        expect(itemAction(model, 0)).toBe("win.item1");
    });

    it("appends items in array order and re-snapshots on change", async () => {
        const model = await renderItemListTransition(
            ["Item 1", "Item 2"],
            ["Item 1", "Item 2", "Item 3"],
            (initial) => {
                expect(initial.getNItems()).toBe(2);
            },
        );

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
        await render(<RemovableItemApp menuRef={ref} shouldShowItem={true} />);
        expect(requireModel(ref.current).getNItems()).toBe(1);
        await render(<RemovableItemApp menuRef={ref} shouldShowItem={false} />);
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

describe("render - Menu change notification", () => {
    it("emits no items-changed when rerendered with structurally equal entries", async () => {
        const { ref, rerender } = await setupDeepMenu();
        const model = requireModel(ref.current);
        const notifications = observeItemsChanged(model);
        await rerender(<DeepMenuApp menuRef={ref} quitLabel="Quit" />);
        expect(notifications.count).toBe(0);
        expect(model.getNItems()).toBe(3);
    });

    it("applies and notifies a change arriving after an unchanged rerender", async () => {
        const { ref, rerender } = await setupDeepMenu();
        await rerender(<DeepMenuApp menuRef={ref} quitLabel="Quit" />);
        const model = requireModel(ref.current);
        const notifications = observeItemsChanged(model);
        await rerender(<DeepMenuApp menuRef={ref} quitLabel="Exit" />);
        expect(notifications.count).toBe(4);
        const section = requireLink(sectionAt(model, 2));
        expect(itemLabel(section, 0)).toBe("Exit");
    });
});

describe("render - Menu submenus", () => {
    it("links a submenu entry's items as a submenu", async () => {
        const ref = createRef<Gtk.PopoverMenuBar>();
        await render(<GtkPopoverMenuBar ref={ref} menuModel={<GMenu items={FILE_SUBMENU_ITEMS} />} />);
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
        await render(<GrowingSubmenuApp menuRef={ref} hasExtraItem={false} />);
        const submenu = requireLink(submenuAt(requireModel(ref.current), 0));
        expect(submenu.getNItems()).toBe(1);
        await render(<GrowingSubmenuApp menuRef={ref} hasExtraItem={true} />);
        const grownSubmenu = requireLink(submenuAt(requireModel(ref.current), 0));
        expect(grownSubmenu.getNItems()).toBe(2);
    });
});

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

        function App({ isEnabled }: { isEnabled: boolean }) {
            return (
                <GtkApplication applicationId={appId} flags={APP_FLAGS}>
                    <GtkApplicationWindow
                        ref={windowRef}
                        actions={isEnabled && (
                            <GSimpleAction name="toggle" onActivate={vi.fn()} />
                        )}
                    />
                </GtkApplication>
            );
        }

        const { rerender } = await render(<App isEnabled={true} />, { container: rootElement });
        expect(windowRef.current?.hasAction("toggle")).toBe(true);
        await rerender(<App isEnabled={false} />);
        expect(windowRef.current?.hasAction("toggle")).toBe(false);
    });
});

describe("render - Shortcut (1)", () => {
    it("attaches shortcuts to the parent ShortcutController", async () => {
        const controllerRef = createRef<Gtk.ShortcutController>();

        await render(
            <GtkBox
                controllers={(
                    <GtkShortcutController
                        ref={controllerRef}
                        shortcuts={(
                            <GtkShortcut
                                trigger={Gtk.ShortcutTrigger.parseString("<Control>s")}
                                action={callbackAction()}
                            />
                        )}
                    />
                )}
            />,
        );

        expect(controllerRef.current?.getNItems()).toBe(1);
    });

    it.each([
        {
            label: "supports an alternative trigger",
            trigger: Gtk.AlternativeTrigger.new(
                Gtk.ShortcutTrigger.parseString("<Control>s"),
                Gtk.ShortcutTrigger.parseString("F2"),
            ),
        },
        { label: "supports a never trigger", trigger: Gtk.NeverTrigger.get() },
    ])("$label", async ({ trigger }) => {
        const controllerRef = createRef<Gtk.ShortcutController>();

        await render(
            <GtkBox
                controllers={(
                    <GtkShortcutController
                        ref={controllerRef}
                        shortcuts={<GtkShortcut trigger={trigger} action={callbackAction()} />}
                    />
                )}
            />,
        );

        expect(controllerRef.current).toHaveObjectProperty("nItems", 1);
    });
});

describe("render - Shortcut (2)", () => {
    it("removes the shortcut from the controller when unmounted", async () => {
        const controllerRef = createRef<Gtk.ShortcutController>();

        const Harness = () => {
            const [show, setShow] = useState(true);

            return (
                <GtkBox
                    controllers={(
                        <GtkShortcutController
                            ref={controllerRef}
                            shortcuts={
                                show && (
                                    <GtkShortcut
                                        trigger={Gtk.ShortcutTrigger.parseString("<Control>s")}
                                        action={Gtk.CallbackAction.new(() => {
                                            setShow(false);

                                            return true;
                                        })}
                                    />
                                )
                            }
                        />
                    )}
                />
            );
        };

        const { rerender } = await render(<Harness />);
        expect(controllerRef.current).toHaveObjectProperty("nItems", 1);
        const Empty = () => <GtkBox controllers={<GtkShortcutController ref={controllerRef} />} />;
        await rerender(<Empty />);
        expect(controllerRef.current).toHaveObjectProperty("nItems", 0);
    });
});

describe("render - Shortcut (3)", () => {
    it("re-applies the trigger when it changes", async () => {
        const controllerRef = createRef<Gtk.ShortcutController>();

        const Harness = ({ isDisabled }: { isDisabled: boolean }) => (
            <GtkBox
                controllers={(
                    <GtkShortcutController
                        ref={controllerRef}
                        shortcuts={(
                            <GtkShortcut
                                trigger={
                                    isDisabled
                                        ? Gtk.NeverTrigger.get()
                                        : Gtk.ShortcutTrigger.parseString("<Control>s")
                                }
                                action={callbackAction()}
                            />
                        )}
                    />
                )}
            />
        );

        const { rerender } = await render(<Harness isDisabled={false} />);
        expect(controllerRef.current).toHaveObjectProperty("nItems", 1);
        await rerender(<Harness isDisabled={true} />);
        expect(controllerRef.current).toHaveObjectProperty("nItems", 1);
    });
});
