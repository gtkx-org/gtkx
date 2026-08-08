import { DropDown, ListView } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { render, screen, userEvent } from "@gtkx/testing";
import { renderChildren } from "@gtkx/testing/internal";
import { describe, expect, it } from "vitest";
import { expectAllVisibleOnce } from "./helpers/list-collection-render.js";
import { ScrollWrapper } from "./helpers/scroll-wrapper.js";
import { expectTextPresent } from "./helpers/text-presence.js";

type TextItem = {
    id: string;
    text: string;
};

const firstSecondThirdTextItems: TextItem[] = [
    { id: "1", text: "First" },
    { id: "2", text: "Second" },
    { id: "3", text: "Third" },
];

const buildTextListView = (items: TextItem[]) => (
    <ScrollWrapper>
        <ListView
            items={items.map((item) => ({ id: item.id, value: item }))}
            renderItem={({ item }) => <GtkLabel>{item.text}</GtkLabel>}
        />
    </ScrollWrapper>
);

const buildValueDropDown = (items: string[]) => <DropDown items={items.map((item) => ({ id: item, value: item }))} />;
const comboBox = () => screen.getByRole(Gtk.AccessibleRole.COMBO_BOX);

const expectOptionAtIndex = async (index: number, text: string): Promise<void> => {
    await userEvent.selectOptions(comboBox(), index);
    await expectTextPresent(text);
};

function App({ value }: { value: { text: string } }) {
    return (
        <ScrollWrapper>
            <ListView
                items={[{ id: "dynamic", value }]}
                renderItem={({ item }) => <GtkLabel>{item.text}</GtkLabel>}
            />
        </ScrollWrapper>
    );
}

function App2({ value }: { value: string }) {
    return <DropDown items={[{ id: "dynamic", value }]} />;
}

describe("render - ListItem (1)", () => {
    describe("ListItem (1)", () => {
        it("renders list item in ListView", async () => {
            await render(buildTextListView([{ id: "1", text: "First" }]));
            expectAllVisibleOnce("First");
        });

        it("renders multiple list items", async () => {
            await render(buildTextListView(firstSecondThirdTextItems));
            expectAllVisibleOnce("First", "Second", "Third");
        });
    });
});

describe("render - ListItem (2)", () => {
    describe("ListItem (2)", () => {
        it("updates item value on prop change", async () => {
            const { rerender } = await render(<App value={{ text: "Initial" }} />);
            expect(screen.queryAllByText("Initial")).toHaveLength(1);
            await rerender(<App value={{ text: "Updated" }} />);
            expect(screen.queryAllByText("Updated")).toHaveLength(1);
            expect(screen.queryAllByText("Initial")).toHaveLength(0);
        });

        it("removes item from list", async () => {
            const { rerender } = await renderChildren(firstSecondThirdTextItems, buildTextListView);
            expectAllVisibleOnce("First", "Second", "Third");
            await rerender([{ id: "1", text: "First" }]);
            expect(screen.queryAllByText("First")).toHaveLength(1);
            expect(screen.queryAllByText("Second")).toHaveLength(0);
            expect(screen.queryAllByText("Third")).toHaveLength(0);
        });
    });
});

describe("render - ListItem (3)", () => {
    describe("ListItem (3)", () => {
        it("inserts item before existing item", async () => {
            const { rerender } = await renderChildren(
                [
                    { id: "first", text: "First" },
                    { id: "last", text: "Last" },
                ],
                buildTextListView,
            );

            expectAllVisibleOnce("First", "Last");

            await rerender([
                { id: "first", text: "First" },
                { id: "middle", text: "Middle" },
                { id: "last", text: "Last" },
            ]);

            expectAllVisibleOnce("First", "Middle", "Last");
        });
    });
});

describe("render - ListItem (4)", () => {
    describe("ListItem in DropDown (1)", () => {
        it("renders list item in DropDown", async () => {
            await render(<DropDown items={[{ id: "item1", value: "Item Value" }]} />);
            expect(screen.queryAllByText("Item Value").length).toBeGreaterThan(0);
        });

        it("handles string value", async () => {
            await render(<DropDown items={[{ id: "test", value: "Test String" }]} />);
            expect(screen.queryAllByText("Test String").length).toBeGreaterThan(0);
        });

        it("updates value on prop change", async () => {
            const { rerender } = await render(<App2 value="Initial" />);
            expect(screen.queryAllByText("Initial").length).toBeGreaterThan(0);
            await rerender(<App2 value="Updated" />);
            expect(screen.queryAllByText("Updated").length).toBeGreaterThan(0);
            expect(screen.queryAllByText("Initial")).toHaveLength(0);
        });
    });
});

describe("render - ListItem (5)", () => {
    describe("ListItem in DropDown (2)", () => {
        it("maintains order with multiple items", async () => {
            await render(
                <DropDown
                    items={[
                        { id: "a", value: "First" },
                        { id: "b", value: "Second" },
                        { id: "c", value: "Third" },
                    ]}
                />,
            );

            await expectTextPresent("First");
            await expectOptionAtIndex(1, "Second");
            await expectOptionAtIndex(2, "Third");
        });

        it("inserts item before existing item", async () => {
            const { rerender } = await renderChildren(["first", "last"], buildValueDropDown);
            await expectTextPresent("first");
            await expectOptionAtIndex(1, "last");
            await rerender(["first", "middle", "last"]);
            await expectOptionAtIndex(0, "first");
            await expectOptionAtIndex(1, "middle");
            await expectOptionAtIndex(2, "last");
        });
    });
});
