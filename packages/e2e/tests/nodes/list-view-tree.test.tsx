import * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel } from "@gtkx/jsx/gtk";
import type { ListItem } from "@gtkx/react";
import { act, screen, waitFor } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { type FixtureInput, renderListView } from "../helpers/list-fixtures.js";
import { getChildTexts } from "../helpers/widget-text.js";

interface Category {
    type: "category";
    id: string;
    name: string;
}

interface Setting {
    type: "setting";
    id: string;
    name: string;
}

type TreeItem = Category | Setting;

const toTreeItems = (categories: Array<Category & { children: Setting[] }>): FixtureInput<TreeItem> =>
    categories.map((category) => ({
        id: category.id,
        value: category as TreeItem,
        children: category.children.map((setting) => ({
            id: setting.id,
            value: setting as TreeItem,
            hideExpander: true,
        })),
    }));

const expandableExpanders = (): Gtk.TreeExpander[] =>
    screen
        .queryAllByRole(Gtk.AccessibleRole.BUTTON)
        .filter((w): w is Gtk.TreeExpander => w instanceof Gtk.TreeExpander)
        .filter((w) => w.getListRow()?.isExpandable() ?? false);

type DemoItem = { name: string };
const demoLeaf = (id: string, name: string) => ({ id, value: { name } });
const demoChild = (id: string, name: string) => ({ id, value: { name }, hideExpander: true as const });
const demoCat = (id: string, name: string, children: ReturnType<typeof demoChild>[]) => ({
    id,
    value: { name },
    children,
});

const demoFullTree: ListItem<DemoItem>[] = [
    demoLeaf("demo-intro", "GTK Demo"),
    demoCat("cat-Benchmark", "Benchmark", [demoChild("demo-frames", "Frames"), demoChild("demo-themes", "Themes")]),
    demoLeaf("demo-clipboard", "Clipboard"),
    demoCat("cat-Constraints", "Constraints", [
        demoChild("demo-interactive", "Interactive Constraints"),
        demoChild("demo-simple", "Simple Constraints"),
        demoChild("demo-vfl", "VFL"),
    ]),
    demoLeaf("demo-cursors", "Cursors"),
    demoLeaf("demo-dialog", "Dialogs"),
    demoLeaf("demo-dnd", "Drag-and-Drop"),
    demoLeaf("demo-drawingarea", "Drawing Area"),
    demoCat("cat-Entry", "Entry", [
        demoChild("demo-password", "Password Entry"),
        demoChild("demo-search-entry", "Search Entry"),
        demoChild("demo-undo-entry", "Undo and Redo"),
    ]),
    demoLeaf("demo-errorstates", "Error States"),
    demoLeaf("demo-expander", "Expander"),
    demoCat("cat-Fixed-Layout", "Fixed Layout", [
        demoChild("demo-cube", "Cube"),
        demoChild("demo-transforms", "Transformations"),
    ]),
    demoLeaf("demo-flowbox", "Flow Box"),
    demoLeaf("demo-gestures", "Gestures"),
    demoLeaf("demo-headerbar", "Header Bar"),
    demoLeaf("demo-images", "Images"),
    demoLeaf("demo-links", "Links"),
    demoCat("cat-List-Box", "List Box", [
        demoChild("demo-listbox-complex", "Complex"),
        demoChild("demo-listbox-controls", "Controls"),
    ]),
    demoCat("cat-Lists", "Lists", [
        demoChild("demo-alt-settings", "Alternative Settings"),
        demoChild("demo-app-launcher", "Application launcher"),
        demoChild("demo-characters", "Characters"),
        demoChild("demo-colors", "Colors"),
        demoChild("demo-file-browser", "File browser"),
        demoChild("demo-minesweeper", "Minesweeper"),
        demoChild("demo-selections", "Selections"),
        demoChild("demo-settings", "Settings"),
        demoChild("demo-weather", "Weather"),
        demoChild("demo-words", "Words"),
    ]),
    demoCat("cat-OpenGL", "OpenGL", [
        demoChild("demo-gears", "Gears"),
        demoChild("demo-glarea", "OpenGL Area"),
        demoChild("demo-shadertoy", "Shadertoy"),
    ]),
    demoCat("cat-Overlay", "Overlay", [
        demoChild("demo-decorative", "Decorative Overlay"),
        demoChild("demo-interactive-overlay", "Interactive Overlay"),
    ]),
    demoCat("cat-Paintable", "Paintable", [demoChild("demo-svg", "SVG")]),
    demoLeaf("demo-panes", "Paned Widgets"),
    demoCat("cat-Pango", "Pango", [
        demoChild("demo-font-explorer", "Font Explorer"),
        demoChild("demo-font-rendering", "Font Rendering"),
        demoChild("demo-rotated-text", "Rotated Text"),
        demoChild("demo-text-mask", "Text Mask"),
    ]),
    demoLeaf("demo-pickers", "Pickers and Launchers"),
    demoCat("cat-Printing", "Printing", [
        demoChild("demo-page-setup", "Page Setup"),
        demoChild("demo-printing", "Printing"),
    ]),
    demoLeaf("demo-revealer", "Revealer"),
    demoLeaf("demo-scale", "Scales"),
    demoLeaf("demo-shortcut-triggers", "Shortcut Triggers"),
    demoLeaf("demo-shortcuts", "Shortcuts"),
    demoLeaf("demo-sizegroup", "Size Groups"),
    demoLeaf("demo-spinbutton", "Spin Buttons"),
    demoLeaf("demo-spinner", "Spinner"),
    demoLeaf("demo-stack", "Stack"),
    demoLeaf("demo-sidebar", "Stack Sidebar"),
    demoCat("cat-Text-View", "Text View", [
        demoChild("demo-auto-scroll", "Automatic Scrolling"),
        demoChild("demo-hypertext", "Hypertext"),
        demoChild("demo-markup", "Markup"),
        demoChild("demo-multi-views", "Multiple Views"),
        demoChild("demo-tabs", "Tabs"),
        demoChild("demo-undo-text", "Undo and Redo"),
    ]),
    demoCat("cat-Theming", "Theming", [
        demoChild("demo-accordion", "CSS Accordion"),
        demoChild("demo-css-basics", "CSS Basics"),
        demoChild("demo-blend-modes", "CSS Blend Modes"),
        demoChild("demo-multi-bg", "Multiple Backgrounds"),
        demoChild("demo-animated-bg", "Animated Backgrounds"),
        demoChild("demo-shadows", "Shadows"),
        demoChild("demo-style-classes", "Style Classes"),
    ]),
    demoLeaf("demo-video-player", "Video Player"),
];

const allSettingCategories: Array<Category & { children: Setting[] }> = [
    {
        type: "category",
        id: "appearance",
        name: "Appearance",
        children: [
            { type: "setting", id: "dark-mode", name: "Dark Mode" },
            { type: "setting", id: "large-text", name: "Large Text" },
            { type: "setting", id: "animations", name: "Enable Animations" },
            { type: "setting", id: "transparency", name: "Transparency Effects" },
        ],
    },
    {
        type: "category",
        id: "notifications",
        name: "Notifications",
        children: [
            { type: "setting", id: "notifications-enabled", name: "Alerts" },
            { type: "setting", id: "sounds", name: "Notification Sounds" },
            { type: "setting", id: "do-not-disturb", name: "Do Not Disturb" },
            { type: "setting", id: "badge-count", name: "Show Badge Count" },
        ],
    },
    {
        type: "category",
        id: "privacy",
        name: "Privacy",
        children: [
            { type: "setting", id: "location", name: "Location Services" },
            { type: "setting", id: "camera", name: "Camera Access" },
            { type: "setting", id: "microphone", name: "Microphone Access" },
            { type: "setting", id: "analytics", name: "Usage Analytics" },
        ],
    },
    {
        type: "category",
        id: "power",
        name: "Power",
        children: [
            { type: "setting", id: "auto-brightness", name: "Auto Brightness" },
            { type: "setting", id: "power-saver", name: "Power Saver Mode" },
            { type: "setting", id: "screen-timeout", name: "Screen Timeout" },
            { type: "setting", id: "auto-suspend", name: "Automatic Suspend" },
        ],
    },
    {
        type: "category",
        id: "network",
        name: "Network",
        children: [
            { type: "setting", id: "wifi", name: "Wi-Fi" },
            { type: "setting", id: "bluetooth", name: "Bluetooth" },
            { type: "setting", id: "airplane", name: "Airplane Mode" },
            { type: "setting", id: "vpn", name: "VPN" },
        ],
    },
];

type FilterItem = { type: "category"; name: string } | { type: "leaf"; name: string };

const fullItems: FixtureInput<FilterItem> = [
    { id: "leaf-a", value: { type: "leaf", name: "Alpha" } },
    {
        id: "cat-b",
        value: { type: "category", name: "Bravo" },
        children: [
            { id: "leaf-b1", value: { type: "leaf", name: "B-One" }, hideExpander: true },
            { id: "leaf-b2", value: { type: "leaf", name: "B-Two" }, hideExpander: true },
        ],
    },
    { id: "leaf-c", value: { type: "leaf", name: "Charlie" } },
    {
        id: "cat-d",
        value: { type: "category", name: "Delta" },
        children: [
            { id: "leaf-d1", value: { type: "leaf", name: "D-One" }, hideExpander: true },
            { id: "leaf-d2", value: { type: "leaf", name: "D-Two" }, hideExpander: true },
            { id: "leaf-d3", value: { type: "leaf", name: "D-Three" }, hideExpander: true },
        ],
    },
    { id: "leaf-e", value: { type: "leaf", name: "Echo" } },
];

describe("render - ListView (tree) (1)", () => {
    describe("GtkListView (tree)", () => {
        it("creates ListView widget with tree items", async () => {
            const { ref } = await renderListView([{ id: "1", value: { name: "First" } }]);

            expect(ref.current).not.toBeNull();
        });
    });
});

describe("render - ListView (tree) (2)", () => {
    describe("ListItem (tree) (1)", () => {
        it("adds item to tree model", async () => {
            await renderListView([
                { id: "1", value: { name: "First" } },
                { id: "2", value: { name: "Second" } },
            ]);

            expect(screen.queryAllByText("First")).toHaveLength(1);
            expect(screen.queryAllByText("Second")).toHaveLength(1);
        });

        it("supports nested tree items", async () => {
            const { ref } = await renderListView(
                [
                    {
                        id: "parent",
                        value: { name: "Parent" },
                        children: [
                            { id: "child1", value: { name: "Child 1" } },
                            { id: "child2", value: { name: "Child 2" } },
                        ],
                    },
                ],
                { autoexpand: true },
            );

            expect(ref.current).not.toBeNull();
        });

        it("inserts item before existing item", async () => {
            const { rerender } = await renderListView([
                { id: "1", value: { name: "First" } },
                { id: "3", value: { name: "Third" } },
            ]);

            expect(screen.queryAllByText("First")).toHaveLength(1);
            expect(screen.queryAllByText("Third")).toHaveLength(1);

            await rerender([
                { id: "1", value: { name: "First" } },
                { id: "2", value: { name: "Second" } },
                { id: "3", value: { name: "Third" } },
            ]);

            expect(screen.queryAllByText("First")).toHaveLength(1);
            expect(screen.queryAllByText("Second")).toHaveLength(1);
            expect(screen.queryAllByText("Third")).toHaveLength(1);
        });
    });
});

describe("render - ListView (tree) (3)", () => {
    describe("ListItem (tree) (2)", () => {
        it("removes item from tree model", async () => {
            const { rerender } = await renderListView([
                { id: "1", value: { name: "A" } },
                { id: "2", value: { name: "B" } },
                { id: "3", value: { name: "C" } },
            ]);

            expect(screen.queryAllByText("A")).toHaveLength(1);
            expect(screen.queryAllByText("B")).toHaveLength(1);
            expect(screen.queryAllByText("C")).toHaveLength(1);

            await rerender([
                { id: "1", value: { name: "A" } },
                { id: "3", value: { name: "C" } },
            ]);

            expect(screen.queryAllByText("A")).toHaveLength(1);
            expect(screen.queryAllByText("B")).toHaveLength(0);
            expect(screen.queryAllByText("C")).toHaveLength(1);
        });

        it("updates item value", async () => {
            const { rerender } = await renderListView([{ id: "1", value: { name: "Initial" } }]);

            await rerender([{ id: "1", value: { name: "Updated" } }]);

            expect(screen.queryAllByText("Updated")).toHaveLength(1);
        });
    });
});

describe("render - ListView (tree) (4)", () => {
    describe("renderItem (tree)", () => {
        it("receives item data in renderItem", async () => {
            const renderItem = vi.fn((item: { name: string }) => <GtkLabel label={item.name} />);

            await renderListView([{ id: "1", value: { name: "Test Item" } }], { renderItem });

            expect(renderItem).toHaveBeenCalled();
        });

        it("receives TreeListRow in renderItem", async () => {
            const renderItem = vi.fn((item: { name: string }, row?: Gtk.TreeListRow | null) => (
                <GtkLabel label={`${item.name} - depth: ${row?.getDepth() ?? 0}`} />
            ));

            await renderListView(
                [
                    {
                        id: "parent",
                        value: { name: "Parent" },
                        children: [{ id: "child", value: { name: "Child" } }],
                    },
                ],
                { renderItem, autoexpand: true },
            );

            expect(screen.queryAllByText("Parent - depth: 0")).toHaveLength(1);
        });

        it("updates when renderItem function changes", async () => {
            const { rerender } = await renderListView([{ id: "1", value: { name: "Test" } }], {
                renderItem: (item) => <GtkLabel label={`First: ${item.name}`} />,
            });

            await rerender([{ id: "1", value: { name: "Test" } }], {
                renderItem: (item) => <GtkLabel label={`Second: ${item.name}`} />,
            });

            expect(screen.queryAllByText("Second: Test")).toHaveLength(1);
        });
    });
});

describe("render - ListView (tree) (5)", () => {
    describe("autoexpand (1)", () => {
        it("sets autoexpand property", async () => {
            const { ref } = await renderListView(
                [
                    {
                        id: "parent",
                        value: { name: "Parent" },
                        children: [{ id: "child", value: { name: "Child" } }],
                    },
                ],
                { autoexpand: true },
            );

            expect(ref.current).not.toBeNull();
        });

        it("shows children in model when autoexpand is true", async () => {
            const { ref } = await renderListView(
                [
                    {
                        id: "parent",
                        value: { name: "Parent" },
                        children: [
                            { id: "child1", value: { name: "Child 1" } },
                            { id: "child2", value: { name: "Child 2" } },
                        ],
                    },
                ],
                { autoexpand: true },
            );

            expect(getChildTexts(ref.current)).toEqual(["Parent", "Child 1", "Child 2"]);
        });
    });
});

describe("render - ListView (tree) (6)", () => {
    describe("autoexpand (2)", () => {
        it("parent row is expandable when it has children", async () => {
            await renderListView([
                {
                    id: "parent",
                    value: { name: "Parent" },
                    children: [{ id: "child1", value: { name: "Child 1" } }],
                },
            ]);

            const expanders = expandableExpanders();
            expect(expanders.length).toBeGreaterThan(0);

            const row = expanders[0]?.getListRow();
            expect(row).not.toBeNull();
            expect(row?.isExpandable()).toBe(true);
        });

        it("expands parent row to show children when expanded", async () => {
            const { ref } = await renderListView([
                {
                    id: "parent",
                    value: { name: "Parent" },
                    children: [
                        { id: "child1", value: { name: "Child 1" } },
                        { id: "child2", value: { name: "Child 2" } },
                    ],
                },
            ]);

            await waitFor(() => expect(getChildTexts(ref.current)).toEqual(["Parent"]));

            const row = expandableExpanders()[0]?.getListRow();
            if (!row) throw new Error("Expected row to exist");
            row.setExpanded(true);

            await waitFor(() => expect(getChildTexts(ref.current)).toEqual(["Parent", "Child 1", "Child 2"]));
        });
    });
});

describe("render - ListView (tree) (7)", () => {
    describe("autoexpand (3)", () => {
        it("updates autoexpand property", async () => {
            const items: FixtureInput<{ name: string }> = [
                {
                    id: "parent",
                    value: { name: "Parent" },
                    children: [{ id: "child", value: { name: "Child" } }],
                },
            ];

            const { ref, rerender } = await renderListView(items, { autoexpand: false });
            expect(getChildTexts(ref.current)).toEqual(["Parent"]);

            await rerender(items, { autoexpand: true });
            expect(ref.current).not.toBeNull();
        });
    });
});

describe("render - ListView (tree) (8)", () => {
    describe("item reordering (tree)", () => {
        it("respects React declaration order on initial render", async () => {
            const { ref } = await renderListView(["C", "A", "B"]);

            expect(getChildTexts(ref.current)).toEqual(["C", "A", "B"]);
        });

        it("handles complete reversal of items", async () => {
            const { ref, rerender } = await renderListView(["A", "B", "C", "D", "E"]);
            expect(getChildTexts(ref.current)).toEqual(["A", "B", "C", "D", "E"]);

            await rerender(["E", "D", "C", "B", "A"]);
            expect(getChildTexts(ref.current)).toEqual(["E", "D", "C", "B", "A"]);
        });

        it("handles interleaved reordering", async () => {
            const { ref, rerender } = await renderListView(["A", "B", "C", "D"]);
            expect(getChildTexts(ref.current)).toEqual(["A", "B", "C", "D"]);

            await rerender(["B", "D", "A", "C"]);
            expect(getChildTexts(ref.current)).toEqual(["B", "D", "A", "C"]);
        });

        it("handles removing and adding while reordering", async () => {
            const { ref, rerender } = await renderListView(["A", "B", "C"]);
            expect(getChildTexts(ref.current)).toEqual(["A", "B", "C"]);

            await rerender(["D", "B", "E"]);
            expect(getChildTexts(ref.current)).toEqual(["D", "B", "E"]);
        });

        it("handles rapid reordering", async () => {
            const { ref, rerender } = await renderListView(["A", "B", "C"]);
            await rerender(["C", "A", "B"]);
            await rerender(["B", "C", "A"]);
            await rerender(["A", "B", "C"]);

            expect(getChildTexts(ref.current)).toEqual(["A", "B", "C"]);
        });
    });
});

describe("render - ListView (tree) (9)", () => {
    describe("nested children rendering (1)", () => {
        it("renders all nested children with correct data after expansion", async () => {
            const categories: Array<Category & { children: Setting[] }> = [
                {
                    type: "category",
                    id: "appearance",
                    name: "Appearance",
                    children: [
                        { type: "setting", id: "dark-mode", name: "Dark Mode" },
                        { type: "setting", id: "large-text", name: "Large Text" },
                        { type: "setting", id: "animations", name: "Animations" },
                        { type: "setting", id: "transparency", name: "Transparency" },
                    ],
                },
                {
                    type: "category",
                    id: "notifications",
                    name: "Notifications",
                    children: [
                        { type: "setting", id: "notifications-enabled", name: "Alerts" },
                        { type: "setting", id: "sounds", name: "Notification Sounds" },
                        { type: "setting", id: "do-not-disturb", name: "Do Not Disturb" },
                        { type: "setting", id: "badge-count", name: "Show Badge Count" },
                    ],
                },
                {
                    type: "category",
                    id: "privacy",
                    name: "Privacy",
                    children: [
                        { type: "setting", id: "location", name: "Location Services" },
                        { type: "setting", id: "camera", name: "Camera Access" },
                        { type: "setting", id: "microphone", name: "Microphone Access" },
                        { type: "setting", id: "analytics", name: "Usage Analytics" },
                    ],
                },
            ];

            const { ref } = await renderListView(toTreeItems(categories));

            expect(getChildTexts(ref.current)).toEqual(["Appearance", "Notifications", "Privacy"]);

            const row = expandableExpanders()[1]?.getListRow();
            if (!row) throw new Error("Expected row to exist");

            row.setExpanded(true);

            await waitFor(() => {
                expect(screen.queryAllByText("Loading...")).toHaveLength(0);
                expect(getChildTexts(ref.current)).toEqual([
                    "Appearance",
                    "Notifications",
                    "Alerts",
                    "Notification Sounds",
                    "Do Not Disturb",
                    "Show Badge Count",
                    "Privacy",
                ]);
            });
        });
    });
});

describe("render - ListView (tree) (10)", () => {
    describe("nested children rendering (2)", () => {
        it("renders all children with correct data when using autoexpand", async () => {
            const categories: Array<Category & { children: Setting[] }> = [
                {
                    type: "category",
                    id: "notifications",
                    name: "Notifications",
                    children: [
                        { type: "setting", id: "notifications-enabled", name: "Alerts" },
                        { type: "setting", id: "sounds", name: "Notification Sounds" },
                        { type: "setting", id: "do-not-disturb", name: "Do Not Disturb" },
                        { type: "setting", id: "badge-count", name: "Show Badge Count" },
                    ],
                },
            ];

            const { ref } = await renderListView(toTreeItems(categories), { autoexpand: true });

            expect(screen.queryAllByText("Loading...")).toHaveLength(0);
            expect(getChildTexts(ref.current)).toEqual([
                "Notifications",
                "Alerts",
                "Notification Sounds",
                "Do Not Disturb",
                "Show Badge Count",
            ]);
        });
    });
});

describe("render - ListView (tree) (11)", () => {
    describe("tree item properties", () => {
        it("supports indentForDepth property", async () => {
            const { ref } = await renderListView(
                [
                    {
                        id: "parent",
                        value: { name: "Parent" },
                        indentForDepth: false,
                        children: [{ id: "child", value: { name: "Child" }, indentForDepth: true }],
                    },
                ],
                { autoexpand: true },
            );

            expect(ref.current).not.toBeNull();
        });

        it("supports indentForIcon property", async () => {
            const { ref } = await renderListView(
                [
                    {
                        id: "parent",
                        value: { name: "Parent" },
                        indentForIcon: true,
                        children: [{ id: "child", value: { name: "Child" }, indentForIcon: false }],
                    },
                ],
                { autoexpand: true },
            );

            expect(ref.current).not.toBeNull();
        });

        it("supports hideExpander property", async () => {
            const { ref } = await renderListView(
                [
                    {
                        id: "parent",
                        value: { name: "Parent" },
                        hideExpander: false,
                        children: [{ id: "child", value: { name: "Child" }, hideExpander: true }],
                    },
                ],
                { autoexpand: true },
            );

            expect(ref.current).not.toBeNull();
        });
    });
});

describe("render - ListView (tree) (12)", () => {
    describe("settings tree regression (1)", () => {
        it("renders all children with non-null values on first expansion", async () => {
            const categories: Array<Category & { children: Setting[] }> = [
                {
                    type: "category",
                    id: "appearance",
                    name: "Appearance",
                    children: [
                        { type: "setting", id: "dark-mode", name: "Dark Mode" },
                        { type: "setting", id: "large-text", name: "Large Text" },
                        { type: "setting", id: "animations", name: "Enable Animations" },
                        { type: "setting", id: "transparency", name: "Transparency Effects" },
                    ],
                },
            ];

            const { ref } = await renderListView(toTreeItems(categories));

            const row = expandableExpanders()[0]?.getListRow();
            if (!row) throw new Error("Expected row to exist");

            row.setExpanded(true);

            await waitFor(() => {
                expect(screen.queryAllByText("Loading...")).toHaveLength(0);
                expect(getChildTexts(ref.current)).toEqual([
                    "Appearance",
                    "Dark Mode",
                    "Large Text",
                    "Enable Animations",
                    "Transparency Effects",
                ]);
            });
        });
    });
});

describe("render - ListView (tree) (13)", () => {
    describe("settings tree regression (2)", () => {
        it("renders all children with non-null values when clicking TreeExpander", async () => {
            const categories: Array<Category & { children: Setting[] }> = [
                {
                    type: "category",
                    id: "appearance",
                    name: "Appearance",
                    children: [
                        { type: "setting", id: "dark-mode", name: "Dark Mode" },
                        { type: "setting", id: "large-text", name: "Large Text" },
                        { type: "setting", id: "animations", name: "Enable Animations" },
                        { type: "setting", id: "transparency", name: "Transparency Effects" },
                    ],
                },
            ];

            const { ref } = await renderListView(toTreeItems(categories));

            const expanders = expandableExpanders();
            expect(expanders.length).toBeGreaterThan(0);

            const row = expanders[0]?.getListRow();
            if (!row) throw new Error("Expected row to exist");

            row.setExpanded(true);

            await waitFor(() =>
                expect(getChildTexts(ref.current)).toEqual([
                    "Appearance",
                    "Dark Mode",
                    "Large Text",
                    "Enable Animations",
                    "Transparency Effects",
                ]),
            );
        });
    });
});

describe("render - ListView (tree) (14) > settings tree regression (3)", () => {
    it("renders all children correctly after multiple expand/collapse cycles", async () => {
        const { ref } = await renderListView(toTreeItems(allSettingCategories));

        expect(getChildTexts(ref.current)).toEqual(["Appearance", "Notifications", "Privacy", "Power", "Network"]);

        const expandAndVerify = async (categoryIndex: number, expectedChildren: string[]) => {
            const row = expandableExpanders()[categoryIndex]?.getListRow();
            if (!row) throw new Error("Expected row to exist");
            row.setExpanded(true);

            await waitFor(() => {
                expect(screen.queryAllByText("Loading...")).toHaveLength(0);
                for (const childName of expectedChildren) {
                    expect(screen.queryAllByText(childName)).toHaveLength(1);
                }
            });
        };

        const collapseRow = async (categoryIndex: number) => {
            const row = expandableExpanders()[categoryIndex]?.getListRow();
            if (!row) throw new Error("Expected row to exist");
            row.setExpanded(false);
        };

        await expandAndVerify(0, ["Dark Mode", "Large Text", "Enable Animations", "Transparency Effects"]);

        await collapseRow(0);
        await waitFor(() =>
            expect(getChildTexts(ref.current)).toEqual(["Appearance", "Notifications", "Privacy", "Power", "Network"]),
        );

        await expandAndVerify(0, ["Dark Mode", "Large Text", "Enable Animations", "Transparency Effects"]);

        await collapseRow(0);

        await expandAndVerify(1, ["Alerts", "Notification Sounds", "Do Not Disturb", "Show Badge Count"]);

        await collapseRow(1);

        await expandAndVerify(0, ["Dark Mode", "Large Text", "Enable Animations", "Transparency Effects"]);

        await waitFor(() => expect(screen.queryAllByText("Loading...")).toHaveLength(0));
    });
});

describe("render - ListView (tree) (15) > settings tree regression (4)", () => {
    const twoCategories: Array<Category & { children: Setting[] }> = allSettingCategories.slice(0, 2);
    const appearanceChildNames = ["Dark Mode", "Large Text", "Enable Animations", "Transparency Effects"];

    const assertChildrenVisible = () =>
        waitFor(() => {
            expect(screen.queryAllByText("Loading...")).toHaveLength(0);
            for (const name of appearanceChildNames) {
                expect(screen.queryAllByText(name)).toHaveLength(1);
            }
        });

    const assertChildrenHidden = () =>
        waitFor(() => {
            for (const name of appearanceChildNames) {
                expect(screen.queryAllByText(name)).toHaveLength(0);
            }
        });

    const toggleRow = async (row: Gtk.TreeListRow, expanded: boolean) => {
        await act(() => row.setExpanded(expanded));
    };

    it("third child does not remain stuck on Loading after expansion", async () => {
        const { ref } = await renderListView(toTreeItems(twoCategories), { estimatedItemHeight: 48 });

        const row = expandableExpanders()[0]?.getListRow();
        if (!row) throw new Error("Expected row to exist");

        for (let i = 0; i < 3; i++) {
            await toggleRow(row, true);
            await assertChildrenVisible();
            await toggleRow(row, false);
            await assertChildrenHidden();
        }

        await toggleRow(row, true);
        await assertChildrenVisible();

        expect(ref.current).not.toBeNull();
    });
});

describe("render - ListView (tree) (16)", () => {
    describe("tree filtering (1)", () => {
        it("shows children after filtering from many root items to few", async () => {
            const { ref, rerender } = await renderListView(fullItems, { autoexpand: true });

            expect(getChildTexts(ref.current)).toEqual([
                "Alpha",
                "Bravo",
                "B-One",
                "B-Two",
                "Charlie",
                "Delta",
                "D-One",
                "D-Two",
                "D-Three",
                "Echo",
            ]);

            await rerender(
                [
                    {
                        id: "cat-d",
                        value: { type: "category", name: "Delta" },
                        children: [{ id: "leaf-d2", value: { type: "leaf", name: "D-Two" }, hideExpander: true }],
                    },
                ],
                { autoexpand: true },
            );

            expect(getChildTexts(ref.current)).toEqual(["Delta", "D-Two"]);
        });
    });
});

describe("render - ListView (tree) (17)", () => {
    describe("tree filtering (2)", () => {
        it("shows children after multiple filter transitions", async () => {
            const { ref, rerender } = await renderListView(fullItems, { autoexpand: true });

            await rerender(
                [
                    { id: "leaf-a", value: { type: "leaf", name: "Alpha" } },
                    {
                        id: "cat-b",
                        value: { type: "category", name: "Bravo" },
                        children: [{ id: "leaf-b1", value: { type: "leaf", name: "B-One" }, hideExpander: true }],
                    },
                ],
                { autoexpand: true },
            );

            expect(getChildTexts(ref.current)).toEqual(["Alpha", "Bravo", "B-One"]);

            await rerender(fullItems, { autoexpand: true });

            await rerender(
                [
                    {
                        id: "cat-d",
                        value: { type: "category", name: "Delta" },
                        children: [{ id: "leaf-d2", value: { type: "leaf", name: "D-Two" }, hideExpander: true }],
                    },
                ],
                { autoexpand: true },
            );

            expect(getChildTexts(ref.current)).toEqual(["Delta", "D-Two"]);
        });
    });
});

describe("render - ListView (tree) (18)", () => {
    describe("tree filtering (3)", () => {
        it("shows children after filtering a large tree with many root items", async () => {
            type Item = { name: string };
            const fullTree: ListItem<Item>[] = [];
            for (let i = 0; i < 38; i++) {
                if (i % 5 === 1) {
                    fullTree.push({
                        id: `cat-${i}`,
                        value: { name: `Category ${i}` },
                        children: Array.from({ length: 3 }, (_, j) => ({
                            id: `child-${i}-${j}`,
                            value: { name: `Child ${i}-${j}` },
                            hideExpander: true,
                        })),
                    });
                } else {
                    fullTree.push({ id: `leaf-${i}`, value: { name: `Leaf ${i}` } });
                }
            }

            const { ref, rerender } = await renderListView(fullTree, { autoexpand: true, minContentHeight: 400 });

            await rerender(
                [
                    {
                        id: "cat-21",
                        value: { name: "Category 21" },
                        children: [{ id: "child-21-1", value: { name: "Child 21-1" }, hideExpander: true }],
                    },
                ],
                { autoexpand: true, minContentHeight: 400 },
            );

            await waitFor(() => expect(getChildTexts(ref.current)).toEqual(["Category 21", "Child 21-1"]));
        });
    });
});

describe("render - ListView (tree) (19) > tree filtering (4)", () => {
    it("shows children after filtering demo-like tree from 38 items to single category", async () => {
        const { ref, rerender } = await renderListView(demoFullTree, {
            autoexpand: true,
            minContentHeight: 600,
        });

        await rerender([demoCat("cat-Lists", "Lists", [demoChild("demo-weather", "Weather")])], {
            autoexpand: true,
            minContentHeight: 600,
        });

        await waitFor(() => expect(getChildTexts(ref.current)).toEqual(["Lists", "Weather"]));
    });
});

describe("render - ListView (tree) (20)", () => {
    describe("tree filtering (5)", () => {
        it("shows children after filtering demo-like tree with small viewport", async () => {
            type Item = { name: string };
            const leaf = (id: string, name: string) => ({ id, value: { name } });
            const ch = (id: string, name: string) => ({ id, value: { name }, hideExpander: true as const });
            const cat = (id: string, name: string, children: ReturnType<typeof ch>[]) => ({
                id,
                value: { name },
                children,
            });

            const fullTree: ListItem<Item>[] = [];
            for (let i = 0; i < 40; i++) {
                if (i % 4 === 0) {
                    fullTree.push(
                        cat(`cat-${i}`, `Category ${i}`, [
                            ch(`ch-${i}-0`, `Child ${i}-0`),
                            ch(`ch-${i}-1`, `Child ${i}-1`),
                        ]),
                    );
                } else {
                    fullTree.push(leaf(`leaf-${i}`, `Leaf ${i}`));
                }
            }

            const viewport = { autoexpand: true, minContentHeight: 100, maxContentHeight: 100 } as const;
            const { ref, rerender } = await renderListView(fullTree, viewport);

            await rerender([cat("cat-36", "Category 36", [ch("ch-36-0", "Child 36-0")])], viewport);

            await waitFor(() => expect(getChildTexts(ref.current)).toEqual(["Category 36", "Child 36-0"]));
        });
    });
});

describe("render - ListView (tree) (21)", () => {
    describe("tree filtering (6)", () => {
        it("shows children when transitioning from one filter to another without restoring full list", async () => {
            const { ref, rerender } = await renderListView(fullItems, { autoexpand: true });

            await rerender(
                [
                    { id: "leaf-a", value: { type: "leaf", name: "Alpha" } },
                    {
                        id: "cat-b",
                        value: { type: "category", name: "Bravo" },
                        children: [{ id: "leaf-b1", value: { type: "leaf", name: "B-One" }, hideExpander: true }],
                    },
                    {
                        id: "cat-d",
                        value: { type: "category", name: "Delta" },
                        children: [{ id: "leaf-d1", value: { type: "leaf", name: "D-One" }, hideExpander: true }],
                    },
                ],
                { autoexpand: true },
            );

            expect(getChildTexts(ref.current)).toEqual(["Alpha", "Bravo", "B-One", "Delta", "D-One"]);

            await rerender(
                [
                    {
                        id: "cat-d",
                        value: { type: "category", name: "Delta" },
                        children: [{ id: "leaf-d2", value: { type: "leaf", name: "D-Two" }, hideExpander: true }],
                    },
                ],
                { autoexpand: true },
            );

            expect(getChildTexts(ref.current)).toEqual(["Delta", "D-Two"]);
        });
    });
});
