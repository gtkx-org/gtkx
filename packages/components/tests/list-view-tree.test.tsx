import type { ListItem, ListItemRenderer } from "@gtkx/components";
import type { RefObject } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { act, getWidgetNodeText, screen, waitFor, within } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { expectRenderItemFunctionUpdate, namedRows, renderTestItemWithSpy } from "./helpers/list-collection-render.js";
import {
    firstSecondItems,
    firstSecondThirdItems,
    type FixtureInput,
    type ListViewFixture,
    renderListView,
} from "./helpers/list-fixtures.js";
import { expectNoBoxBetween } from "./helpers/widget-chain.js";

type Category = {
    type: "category";
    id: string;
    name: string;
};

type Setting = {
    type: "setting";
    id: string;
    name: string;
};

type TreeItem = Category | Setting;
type DemoItem = { name: string };
type FilterItem = { type: "category"; name: string } | { type: "leaf"; name: string };

const parentWithChild = parentWith([leafNode("child", "Child")]);
const parentWithTwoChildren = parentWith([leafNode("child1", "Child 1"), leafNode("child2", "Child 2")]);

const firstThirdItems = namedRows([
    ["1", "First"],
    ["3", "Third"],
]);

const abcItems = namedRows([
    ["1", "A"],
    ["2", "B"],
    ["3", "C"],
]);

const acItems = namedRows([
    ["1", "A"],
    ["3", "C"],
]);

const demoFullTree: ListItem<DemoItem>[] = [
    leafNode("demo-intro", "GTK Demo"),
    categoryNode("cat-Benchmark", "Benchmark", [
        childNode("demo-frames", "Frames"),
        childNode("demo-themes", "Themes"),
    ]),
    leafNode("demo-clipboard", "Clipboard"),
    categoryNode("cat-Constraints", "Constraints", [
        childNode("demo-interactive", "Interactive Constraints"),
        childNode("demo-simple", "Simple Constraints"),
        childNode("demo-vfl", "VFL"),
    ]),
    leafNode("demo-cursors", "Cursors"),
    leafNode("demo-dialog", "Dialogs"),
    leafNode("demo-dnd", "Drag-and-Drop"),
    leafNode("demo-drawingarea", "Drawing Area"),
    categoryNode("cat-Entry", "Entry", [
        childNode("demo-password", "Password Entry"),
        childNode("demo-search-entry", "Search Entry"),
        childNode("demo-undo-entry", "Undo and Redo"),
    ]),
    leafNode("demo-errorstates", "Error States"),
    leafNode("demo-expander", "Expander"),
    categoryNode("cat-Fixed-Layout", "Fixed Layout", [
        childNode("demo-cube", "Cube"),
        childNode("demo-transforms", "Transformations"),
    ]),
    leafNode("demo-flowbox", "Flow Box"),
    leafNode("demo-gestures", "Gestures"),
    leafNode("demo-headerbar", "Header Bar"),
    leafNode("demo-images", "Images"),
    leafNode("demo-links", "Links"),
    categoryNode("cat-List-Box", "List Box", [
        childNode("demo-listbox-complex", "Complex"),
        childNode("demo-listbox-controls", "Controls"),
    ]),
    categoryNode("cat-Lists", "Lists", [
        childNode("demo-alt-settings", "Alternative Settings"),
        childNode("demo-app-launcher", "Application launcher"),
        childNode("demo-characters", "Characters"),
        childNode("demo-colors", "Colors"),
        childNode("demo-file-browser", "File browser"),
        childNode("demo-minesweeper", "Minesweeper"),
        childNode("demo-selections", "Selections"),
        childNode("demo-settings", "Settings"),
        childNode("demo-weather", "Weather"),
        childNode("demo-words", "Words"),
    ]),
    categoryNode("cat-OpenGL", "OpenGL", [
        childNode("demo-gears", "Gears"),
        childNode("demo-glarea", "OpenGL Area"),
        childNode("demo-shadertoy", "Shadertoy"),
    ]),
    categoryNode("cat-Overlay", "Overlay", [
        childNode("demo-decorative", "Decorative Overlay"),
        childNode("demo-interactive-overlay", "Interactive Overlay"),
    ]),
    categoryNode("cat-Paintable", "Paintable", [childNode("demo-svg", "SVG")]),
    leafNode("demo-panes", "Paned Widgets"),
    categoryNode("cat-Pango", "Pango", [
        childNode("demo-font-explorer", "Font Explorer"),
        childNode("demo-font-rendering", "Font Rendering"),
        childNode("demo-rotated-text", "Rotated Text"),
        childNode("demo-text-mask", "Text Mask"),
    ]),
    leafNode("demo-pickers", "Pickers and Launchers"),
    categoryNode("cat-Printing", "Printing", [
        childNode("demo-page-setup", "Page Setup"),
        childNode("demo-printing", "Printing"),
    ]),
    leafNode("demo-revealer", "Revealer"),
    leafNode("demo-scale", "Scales"),
    leafNode("demo-shortcut-triggers", "Shortcut Triggers"),
    leafNode("demo-shortcuts", "Shortcuts"),
    leafNode("demo-sizegroup", "Size Groups"),
    leafNode("demo-spinbutton", "Spin Buttons"),
    leafNode("demo-spinner", "Spinner"),
    leafNode("demo-stack", "Stack"),
    leafNode("demo-sidebar", "Stack Sidebar"),
    categoryNode("cat-Text-View", "Text View", [
        childNode("demo-auto-scroll", "Automatic Scrolling"),
        childNode("demo-hypertext", "Hypertext"),
        childNode("demo-markup", "Markup"),
        childNode("demo-multi-views", "Multiple Views"),
        childNode("demo-tabs", "Tabs"),
        childNode("demo-undo-text", "Undo and Redo"),
    ]),
    categoryNode("cat-Theming", "Theming", [
        childNode("demo-accordion", "CSS Accordion"),
        childNode("demo-css-basics", "CSS Basics"),
        childNode("demo-blend-modes", "CSS Blend Modes"),
        childNode("demo-multi-bg", "Multiple Backgrounds"),
        childNode("demo-animated-bg", "Animated Backgrounds"),
        childNode("demo-shadows", "Shadows"),
        childNode("demo-style-classes", "Style Classes"),
    ]),
    leafNode("demo-video-player", "Video Player"),
];

const allSettingCategories: (Category & { children: Setting[] })[] = [
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

const appearanceChildNames = ["Dark Mode", "Large Text", "Enable Animations", "Transparency Effects"];
const notificationChildNames = ["Alerts", "Notification Sounds", "Do Not Disturb", "Show Badge Count"];

const fullItems: FixtureInput<FilterItem> = [
    filterLeaf("leaf-a", "Alpha"),
    filterCategory("cat-b", "Bravo", [
        ["leaf-b1", "B-One"],
        ["leaf-b2", "B-Two"],
    ]),
    filterLeaf("leaf-c", "Charlie"),
    filterCategory("cat-d", "Delta", [
        ["leaf-d1", "D-One"],
        ["leaf-d2", "D-Two"],
        ["leaf-d3", "D-Three"],
    ]),
    filterLeaf("leaf-e", "Echo"),
];

const deltaWithDTwo = [filterCategory("cat-d", "Delta", [["leaf-d2", "D-Two"]])];
const alphaAndBravoBOne = [filterLeaf("leaf-a", "Alpha"), filterCategory("cat-b", "Bravo", [["leaf-b1", "B-One"]])];
const anchorCategory = categoryNode("cat-anchor", "Anchor", [childNode("anchor-child", "Anchor Child")]);

const toTreeItems = (categories: (Category & { children: Setting[] })[]): FixtureInput<TreeItem> =>
    categories.map((category) => ({
        id: category.id,
        value: category,
        children: category.children.map((setting) => ({
            id: setting.id,
            value: setting,
            hideExpander: true,
        })),
    }));

const expanderByName = (name: string): Gtk.TreeExpander =>
    screen.getByRole(Gtk.AccessibleRole.BUTTON, { name, as: Gtk.TreeExpander });

const rowTexts = (container: Gtk.ListView | null): (string | null)[] =>
    container === null
        ? []
        : within(container)
                .queryAllByRole(Gtk.AccessibleRole.LABEL)
                .map((widget) => getWidgetNodeText(widget));

const listRowByName = (name: string): Gtk.TreeListRow => {
    const row = expanderByName(name).getListRow();

    if (!row) {
        throw new Error("Expected row to exist");
    }

    return row;
};

const setRowExpandedByName = async (name: string, isExpanded: boolean): Promise<void> => {
    const row = listRowByName(name);

    await act(() => {
        row.setExpanded(isExpanded);
    });
};

const expectRowTexts = (ref: RefObject<Gtk.ListView>, expected: (string | null)[]): Promise<void> =>
    waitFor(() => {
        expect(rowTexts(ref.current)).toEqual(expected);
    });

const expectSettledRowTexts = (ref: RefObject<Gtk.ListView>, expected: (string | null)[]): Promise<void> =>
    waitFor(() => {
        expect(screen.queryAllByText("Loading...")).toHaveLength(0);
        expect(rowTexts(ref.current)).toEqual(expected);
    });

const expectVisibleOnce = (names: string[]): Promise<void> =>
    waitFor(() => {
        expect(screen.queryAllByText("Loading...")).toHaveLength(0);

        for (const name of names) {
            expect(screen.queryAllByText(name)).toHaveLength(1);
        }
    });

const expectAllHidden = (names: string[]): Promise<void> =>
    waitFor(() => {
        for (const name of names) {
            expect(screen.queryAllByText(name)).toHaveLength(0);
        }
    });

function leafNode(id: string, name: string) {
    return { id, value: { name } };
}

function childNode(id: string, name: string) {
    return { id, value: { name }, hideExpander: true as const };
}

function categoryNode(id: string, name: string, children: ReturnType<typeof childNode>[]) {
    return { id, value: { name }, children };
}

function parentWith(children: ListItem<DemoItem>[]): FixtureInput<DemoItem> {
    return [{ id: "parent", value: { name: "Parent" }, children }];
}

const expectTextCounts = (scope: ReturnType<typeof within>, counts: [string, number][]): void => {
    for (const [text, count] of counts) {
        expect(scope.queryAllByText(text)).toHaveLength(count);
    }
};

const expectItemsRerender = async (config: {
    initial: FixtureInput<DemoItem>;
    initialCounts: [string, number][];
    next: FixtureInput<DemoItem>;
    nextCounts: [string, number][];
}): Promise<void> => {
    const { ref, rerender } = await renderListView(config.initial);
    expectTextCounts(within(ref.current), config.initialCounts);
    await rerender(config.next);
    expectTextCounts(within(ref.current), config.nextCounts);
};

const expectParentChildRenders = async (
    parentProps: Partial<ListItem<DemoItem>>,
    childProps: Partial<ListItem<DemoItem>>,
): Promise<void> => {
    const { ref } = await renderListView(
        [
            {
                id: "parent",
                value: { name: "Parent" },
                ...parentProps,
                children: [{ id: "child", value: { name: "Child" }, ...childProps }],
            },
        ],
        { expandAll: true },
    );

    expect(ref.current).not.toBeNull();
};

const buildFilterTree = (options: {
    count: number;
    isCategory: (i: number) => boolean;
    children: (i: number) => ReturnType<typeof childNode>[];
}): ListItem<DemoItem>[] => {
    const tree: ListItem<DemoItem>[] = [];

    for (let i = 0; i < options.count; i++) {
        if (options.isCategory(i)) {
            tree.push(categoryNode(`cat-${String(i)}`, `Category ${String(i)}`, options.children(i)));
        } else {
            tree.push(leafNode(`leaf-${String(i)}`, `Leaf ${String(i)}`));
        }
    }

    return tree;
};

const buildLargeCategoryTree = (): ListItem<DemoItem>[] =>
    buildFilterTree({
        count: 38,
        isCategory: (i) => i % 5 === 1,
        children: (i) =>
            Array.from({ length: 3 }, (_, j) =>
                childNode(`child-${String(i)}-${String(j)}`, `Child ${String(i)}-${String(j)}`),
            ),
    });

const buildViewportCategoryTree = (): ListItem<DemoItem>[] =>
    buildFilterTree({
        count: 40,
        isCategory: (i) => i % 4 === 0,
        children: (i) => [
            childNode(`ch-${String(i)}-0`, `Child ${String(i)}-0`),
            childNode(`ch-${String(i)}-1`, `Child ${String(i)}-1`),
        ],
    });

const expandAppearance = async (): Promise<RefObject<Gtk.ListView>> => {
    const { ref } = await renderListView(toTreeItems(allSettingCategories.slice(0, 1)));
    await setRowExpandedByName("Appearance", true);

    return ref;
};

function filterLeaf(id: string, name: string): ListItem<FilterItem> {
    return { id, value: { type: "leaf", name } };
}

function filterCategory(id: string, name: string, children: [string, string][]): ListItem<FilterItem> {
    return {
        id,
        value: { type: "category", name },
        children: children.map(([childId, childName]) => ({
            id: childId,
            value: { type: "leaf", name: childName },
            hideExpander: true,
        })),
    };
}

const expectFilteredToDelta = async ({ ref, rerender }: ListViewFixture<FilterItem>): Promise<void> => {
    await rerender(deltaWithDTwo, { expandAll: true });
    await expectRowTexts(ref, ["Delta", "D-Two"]);
};

const renderExpandedState: ListItemRenderer<{ name: string }> = ({ item, isExpanded }) => (
    <GtkLabel>{`${item.name}:${String(isExpanded)}`}</GtkLabel>
);

const expectChildrenVisible = () => expectVisibleOnce(appearanceChildNames);
const expectChildrenHidden = () => expectAllHidden(appearanceChildNames);

const toggleRow = async (row: Gtk.TreeListRow, isExpanded: boolean) => {
    await act(() => {
        row.setExpanded(isExpanded);
    });
};

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
            await renderListView(firstSecondItems);
            expect(screen.queryAllByText("First")).toHaveLength(1);
            expect(screen.queryAllByText("Second")).toHaveLength(1);
        });

        it("supports nested tree items", async () => {
            const { ref } = await renderListView(parentWithTwoChildren, { expandAll: true });
            expect(ref.current).not.toBeNull();
        });

        it("inserts item before existing item", async () => {
            await expectItemsRerender({
                initial: firstThirdItems,
                initialCounts: [
                    ["First", 1],
                    ["Third", 1],
                ],
                next: firstSecondThirdItems,
                nextCounts: [
                    ["First", 1],
                    ["Second", 1],
                    ["Third", 1],
                ],
            });
        });
    });
});

describe("render - ListView (tree) (3)", () => {
    describe("ListItem (tree) (2)", () => {
        it("removes item from tree model", async () => {
            await expectItemsRerender({
                initial: abcItems,
                initialCounts: [
                    ["A", 1],
                    ["B", 1],
                    ["C", 1],
                ],
                next: acItems,
                nextCounts: [
                    ["A", 1],
                    ["B", 0],
                    ["C", 1],
                ],
            });
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
            const renderItem = await renderTestItemWithSpy();
            expect(renderItem).toHaveBeenCalled();
        });

        it("receives depth in renderItem", async () => {
            const renderItem = vi.fn<ListItemRenderer<{ name: string }>>(({ item, depth }) => (
                <GtkLabel>{`${item.name} - depth: ${String(depth)}`}</GtkLabel>
            ));

            await renderListView(parentWithChild, { renderItem, expandAll: true });
            expect(screen.queryAllByText("Parent - depth: 0")).toHaveLength(1);
        });

        it("updates when renderItem function changes", async () => {
            await expectRenderItemFunctionUpdate();
        });
    });
});

describe("render - ListView (tree) (5)", () => {
    describe("controlled expansion (1)", () => {
        it("mounts a tree with rows expanded via expandedIds", async () => {
            const { ref } = await renderListView(parentWithChild, { expandAll: true });
            expect(ref.current).not.toBeNull();
        });

        it("shows children when rows are expanded via expandedIds", async () => {
            const { ref } = await renderListView(parentWithTwoChildren, { expandAll: true });
            await expectRowTexts(ref, ["Parent", "Child 1", "Child 2"]);
        });
    });
});

describe("render - ListView (tree) (6)", () => {
    describe("expandable rows (uncontrolled)", () => {
        it("parent row is expandable when it has children", async () => {
            await renderListView(parentWith([leafNode("child1", "Child 1")]));
            const row = expanderByName("Parent").getListRow();
            expect(row).not.toBeNull();
            expect(row).toHaveObjectProperty("expandable", true);
        });

        it("expands parent row to show children when expanded", async () => {
            const { ref } = await renderListView(parentWithTwoChildren);
            await expectRowTexts(ref, ["Parent"]);
            await setRowExpandedByName("Parent", true);
            await expectRowTexts(ref, ["Parent", "Child 1", "Child 2"]);
        });
    });
});

describe("render - ListView (tree) (7)", () => {
    describe("controlled expansion (2)", () => {
        it("expands and collapses when expandedIds changes", async () => {
            const { ref, rerender } = await renderListView(parentWithChild, { expandedIds: [] });
            expect(rowTexts(ref.current)).toEqual(["Parent"]);
            await rerender(parentWithChild, { expandedIds: ["parent"] });
            await expectRowTexts(ref, ["Parent", "Child"]);
            await rerender(parentWithChild, { expandedIds: [] });
            await expectRowTexts(ref, ["Parent"]);
        });
    });
});

describe("render - ListView (tree) (8)", () => {
    describe("item reordering (tree)", () => {
        it("respects React declaration order on initial render", async () => {
            const { ref } = await renderListView(["C", "A", "B"]);
            expect(rowTexts(ref.current)).toEqual(["C", "A", "B"]);
        });

        it("handles complete reversal of items", async () => {
            const { ref, rerender } = await renderListView(["A", "B", "C", "D", "E"]);
            expect(rowTexts(ref.current)).toEqual(["A", "B", "C", "D", "E"]);
            await rerender(["E", "D", "C", "B", "A"]);
            expect(rowTexts(ref.current)).toEqual(["E", "D", "C", "B", "A"]);
        });

        it("handles interleaved reordering", async () => {
            const { ref, rerender } = await renderListView(["A", "B", "C", "D"]);
            expect(rowTexts(ref.current)).toEqual(["A", "B", "C", "D"]);
            await rerender(["B", "D", "A", "C"]);
            expect(rowTexts(ref.current)).toEqual(["B", "D", "A", "C"]);
        });

        it("handles removing and adding while reordering", async () => {
            const { ref, rerender } = await renderListView(["A", "B", "C"]);
            expect(rowTexts(ref.current)).toEqual(["A", "B", "C"]);
            await rerender(["D", "B", "E"]);
            expect(rowTexts(ref.current)).toEqual(["D", "B", "E"]);
        });

        it("handles rapid reordering", async () => {
            const { ref, rerender } = await renderListView(["A", "B", "C"]);
            await rerender(["C", "A", "B"]);
            await rerender(["B", "C", "A"]);
            await rerender(["A", "B", "C"]);
            expect(rowTexts(ref.current)).toEqual(["A", "B", "C"]);
        });
    });
});

describe("render - ListView (tree) (9)", () => {
    describe("nested children rendering (1)", () => {
        it("renders all nested children with correct data after expansion", async () => {
            const { ref } = await renderListView(toTreeItems(allSettingCategories.slice(0, 3)));
            expect(rowTexts(ref.current)).toEqual(["Appearance", "Notifications", "Privacy"]);
            await setRowExpandedByName("Notifications", true);
            await expectSettledRowTexts(ref, ["Appearance", "Notifications", ...notificationChildNames, "Privacy"]);
        });
    });
});

describe("render - ListView (tree) (10)", () => {
    describe("nested children rendering (2)", () => {
        it("renders all children with correct data when expanded via expandedIds", async () => {
            const { ref } = await renderListView(toTreeItems(allSettingCategories.slice(1, 2)), { expandAll: true });
            await expectSettledRowTexts(ref, ["Notifications", ...notificationChildNames]);
        });
    });
});

describe("render - ListView (tree) (11)", () => {
    describe("tree item properties", () => {
        it("supports indentForDepth property", async () => {
            await expectParentChildRenders({ indentForDepth: false }, { indentForDepth: true });
        });

        it("supports indentForIcon property", async () => {
            await expectParentChildRenders({ indentForIcon: true }, { indentForIcon: false });
        });

        it("supports hideExpander property", async () => {
            await expectParentChildRenders({ hideExpander: false }, { hideExpander: true });
        });
    });
});

describe("render - ListView (tree) (12)", () => {
    describe("settings tree regression (1)", () => {
        it("renders all children with non-null values on first expansion", async () => {
            await expectSettledRowTexts(await expandAppearance(), ["Appearance", ...appearanceChildNames]);
        });
    });
});

describe("render - ListView (tree) (13)", () => {
    describe("settings tree regression (2)", () => {
        it("renders all children with non-null values when clicking TreeExpander", async () => {
            await expectRowTexts(await expandAppearance(), ["Appearance", ...appearanceChildNames]);
        });
    });
});

describe("render - ListView (tree) (14) > settings tree regression (3)", () => {
    it("renders all children correctly after multiple expand/collapse cycles", async () => {
        const allCategoryNames = ["Appearance", "Notifications", "Privacy", "Power", "Network"];
        const { ref } = await renderListView(toTreeItems(allSettingCategories));
        expect(rowTexts(ref.current)).toEqual(allCategoryNames);

        const expandAndVerify = async (categoryName: string, expectedChildren: string[]) => {
            await setRowExpandedByName(categoryName, true);
            await expectVisibleOnce(expectedChildren);
        };

        await expandAndVerify("Appearance", appearanceChildNames);
        await setRowExpandedByName("Appearance", false);
        await expectRowTexts(ref, allCategoryNames);
        await expandAndVerify("Appearance", appearanceChildNames);
        await setRowExpandedByName("Appearance", false);
        await expandAndVerify("Notifications", notificationChildNames);
        await setRowExpandedByName("Notifications", false);
        await expandAndVerify("Appearance", appearanceChildNames);

        await waitFor(() => {
            expect(screen.queryAllByText("Loading...")).toHaveLength(0);
        });
    });
});

describe("render - ListView (tree) (15) > settings tree regression (4)", () => {
    it("third child does not remain stuck on Loading after expansion", async () => {
        const { ref } = await renderListView(toTreeItems(allSettingCategories.slice(0, 2)), {
            estimatedItemHeight: 48,
        });

        const row = listRowByName("Appearance");

        for (let i = 0; i < 3; i++) {
            await toggleRow(row, true);
            await expectChildrenVisible();
            await toggleRow(row, false);
            await expectChildrenHidden();
        }

        await toggleRow(row, true);
        await expectChildrenVisible();
        expect(ref.current).not.toBeNull();
    });
});

describe("render - ListView (tree) (16)", () => {
    describe("tree filtering (1)", () => {
        it("shows children after filtering from many root items to few", async () => {
            const fixture = await renderListView(fullItems, { expandAll: true });

            await expectRowTexts(fixture.ref, [
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

            await expectFilteredToDelta(fixture);
        });
    });
});

describe("render - ListView (tree) (17)", () => {
    describe("tree filtering (2)", () => {
        it("shows children after multiple filter transitions", async () => {
            const fixture = await renderListView(fullItems, { expandAll: true });
            await fixture.rerender(alphaAndBravoBOne, { expandAll: true });
            await expectRowTexts(fixture.ref, ["Alpha", "Bravo", "B-One"]);
            await fixture.rerender(fullItems, { expandAll: true });
            await expectFilteredToDelta(fixture);
        });
    });
});

describe("render - ListView (tree) (18)", () => {
    describe("tree filtering (3)", () => {
        it("shows children after filtering a large tree with many root items", async () => {
            const fullTree = buildLargeCategoryTree();
            const { ref, rerender } = await renderListView(fullTree, { expandAll: true, minContentHeight: 400 });

            await rerender([categoryNode("cat-21", "Category 21", [childNode("child-21-1", "Child 21-1")])], {
                expandAll: true,
                minContentHeight: 400,
            });

            await expectRowTexts(ref, ["Category 21", "Child 21-1"]);
        });
    });
});

describe("render - ListView (tree) (19) > tree filtering (4)", () => {
    it("shows children after filtering demo-like tree from 38 items to single category", async () => {
        const { ref, rerender } = await renderListView(demoFullTree, {
            expandAll: true,
            minContentHeight: 600,
        });

        await rerender([categoryNode("cat-Lists", "Lists", [childNode("demo-weather", "Weather")])], {
            expandAll: true,
            minContentHeight: 600,
        });

        await expectRowTexts(ref, ["Lists", "Weather"]);
    });
});

describe("render - ListView (tree) (20)", () => {
    describe("tree filtering (5)", () => {
        it("shows children after filtering demo-like tree with small viewport", async () => {
            const fullTree = buildViewportCategoryTree();
            const viewport = { expandAll: true, minContentHeight: 100, maxContentHeight: 100 } as const;
            const { ref, rerender } = await renderListView(fullTree, viewport);
            await rerender([categoryNode("cat-36", "Category 36", [childNode("ch-36-0", "Child 36-0")])], viewport);
            await expectRowTexts(ref, ["Category 36", "Child 36-0"]);
        });
    });
});

describe("render - ListView (tree) (21)", () => {
    describe("tree filtering (6)", () => {
        it("shows children when transitioning from one filter to another without restoring full list", async () => {
            const fixture = await renderListView(fullItems, { expandAll: true });

            await fixture.rerender([...alphaAndBravoBOne, filterCategory("cat-d", "Delta", [["leaf-d1", "D-One"]])], {
                expandAll: true,
            });

            await expectRowTexts(fixture.ref, ["Alpha", "Bravo", "B-One", "Delta", "D-One"]);
            await expectFilteredToDelta(fixture);
        });
    });
});

describe("render - ListView (tree) (22)", () => {
    describe("controlled expansion callbacks", () => {
        it("reports onExpandedChange when the user expands a row", async () => {
            const onExpandedChange = vi.fn();
            const { ref } = await renderListView(parentWithChild, { expandedIds: [], onExpandedChange });
            await setRowExpandedByName("Parent", true);

            await waitFor(() => {
                expect(onExpandedChange).toHaveBeenCalledWith(["parent"]);
            });

            expect(ref.current).not.toBeNull();
        });

        it("passes isExpanded to renderItem from expandedIds", async () => {
            await renderListView(parentWithChild, { expandedIds: ["parent"], renderItem: renderExpandedState });

            await waitFor(() => {
                expect(screen.queryAllByText("Parent:true")).toHaveLength(1);
            });
        });
    });
});

describe("render - ListView (tree) (23)", () => {
    describe("direct cell rendering (tree)", () => {
        it("renders the user's label as the tree expander's direct child with no wrapper container", async () => {
            const { ref } = await renderListView(parentWithChild, { expandAll: true });
            await expectRowTexts(ref, ["Parent", "Child"]);
            const expander = expanderByName("Parent");
            const child = expander.getChild();
            expect(child).toBeInstanceOf(Gtk.Label);

            if (!(child instanceof Gtk.Label)) {
                throw new TypeError("Expected the expander child to be a label");
            }

            expect(getWidgetNodeText(child)).toBe("Parent");
            expectNoBoxBetween(child, ref.current);
        });
    });
});

describe("render - ListView (tree) (24)", () => {
    describe("childless row gaining children", () => {
        it("shows the added child and makes the rendered row expandable", async () => {
            const { ref, rerender } = await renderListView([anchorCategory, leafNode("late", "Late")], {
                expandAll: true,
            });

            await expectRowTexts(ref, ["Anchor", "Anchor Child", "Late"]);
            expect(listRowByName("Late")).toHaveObjectProperty("expandable", false);

            await rerender([anchorCategory, categoryNode("late", "Late", [childNode("late-child", "Late Child")])], {
                expandAll: true,
            });

            await expectRowTexts(ref, ["Anchor", "Anchor Child", "Late", "Late Child"]);

            await waitFor(() => {
                expect(listRowByName("Late")).toHaveObjectProperty("expandable", true);
            });
        });
    });
});

describe("render - ListView (tree) (25)", () => {
    describe("children removed then re-added on one node", () => {
        it("shows the children again after removal and re-addition", async () => {
            const parentCategory = categoryNode("parent", "Parent", [childNode("child", "Child")]);
            const { ref, rerender } = await renderListView([anchorCategory, parentCategory], { expandAll: true });
            await expectRowTexts(ref, ["Anchor", "Anchor Child", "Parent", "Child"]);
            await rerender([anchorCategory, leafNode("parent", "Parent")], { expandAll: true });
            await expectRowTexts(ref, ["Anchor", "Anchor Child", "Parent"]);
            await rerender([anchorCategory, parentCategory], { expandAll: true });
            await expectRowTexts(ref, ["Anchor", "Anchor Child", "Parent", "Child"]);

            await waitFor(() => {
                expect(listRowByName("Parent")).toHaveObjectProperty("expandable", true);
            });
        });
    });
});

describe("render - ListView (tree) (26)", () => {
    describe("controlled selection across reorder", () => {
        it("keeps a selected child and never reports an empty selection when top-level rows reorder", async () => {
            const selectedIds = ["child"];
            const expandedIds = ["parent"];
            const onSelectionChanged = vi.fn();
            const parentNode = categoryNode("parent", "Parent", [childNode("child", "Child")]);
            const soloNode = leafNode("solo", "Solo");
            const options = { selected: selectedIds, expandedIds, onSelectionChanged };
            const { ref, rerender } = await renderListView([parentNode, soloNode], options);
            await expectRowTexts(ref, ["Parent", "Child", "Solo"]);

            await waitFor(() => {
                expect(onSelectionChanged).toHaveBeenCalledWith(["child"]);
            });

            await rerender([soloNode, parentNode], options);
            await expectRowTexts(ref, ["Solo", "Parent", "Child"]);

            await waitFor(() => {
                const model = ref.current.getModel();
                expect(model).toBeInstanceOf(Gtk.SingleSelection);

                if (!(model instanceof Gtk.SingleSelection)) {
                    throw new TypeError("Expected a single selection model");
                }

                expect(model.isSelected(2)).toBe(true);
                expect(model.getSelection().getSize()).toBe(1n);
            });

            expect(onSelectionChanged).not.toHaveBeenCalledWith([]);
        });
    });
});
