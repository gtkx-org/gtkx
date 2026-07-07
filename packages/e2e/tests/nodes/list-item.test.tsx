import { DropDown, ListView, type RenderItemProps } from "@gtkx/components";
import type * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { render, screen, userEvent } from "@gtkx/testing";
import { createRef, type RefObject } from "react";
import { describe, expect, it } from "vitest";
import { expectAllVisibleOnce } from "../helpers/list-collection-render.js";
import { renderChildren } from "../helpers/render-children.js";
import { ScrollWrapper } from "../helpers/scroll-wrapper.js";

interface TextItem {
    id: string;
    text: string;
}

const buildTextListView = (items: TextItem[]) => (
    <ScrollWrapper>
        <ListView
            items={items.map((item) => ({ id: item.id, value: item }))}
            renderItem={({ item }: RenderItemProps<{ text: string }>) => <GtkLabel label={item.text} />}
        />
    </ScrollWrapper>
);

const buildValueDropDown = (dropDownRef: RefObject<Gtk.DropDown | null>) => (items: string[]) => (
    <DropDown ref={dropDownRef} items={items.map((item) => ({ id: item, value: item }))} />
);

describe("render - ListItem (1)", () => {
    describe("ListItem (1)", () => {
        it("renders list item in ListView", async () => {
            await render(buildTextListView([{ id: "1", text: "First" }]));

            expectAllVisibleOnce("First");
        });

        it("renders multiple list items", async () => {
            await render(
                buildTextListView([
                    { id: "1", text: "First" },
                    { id: "2", text: "Second" },
                    { id: "3", text: "Third" },
                ]),
            );

            expectAllVisibleOnce("First", "Second", "Third");
        });
    });
});

describe("render - ListItem (2)", () => {
    describe("ListItem (2)", () => {
        it("updates item value on prop change", async () => {
            function App({ value }: { value: { text: string } }) {
                return (
                    <ScrollWrapper>
                        <ListView
                            items={[{ id: "dynamic", value }]}
                            renderItem={({ item }) => <GtkLabel label={item.text} />}
                        />
                    </ScrollWrapper>
                );
            }

            const { rerender } = await render(<App value={{ text: "Initial" }} />);
            expect(screen.queryAllByText("Initial")).toHaveLength(1);

            await rerender(<App value={{ text: "Updated" }} />);
            expect(screen.queryAllByText("Updated")).toHaveLength(1);
            expect(screen.queryAllByText("Initial")).toHaveLength(0);
        });

        it("removes item from list", async () => {
            const { rerender } = await renderChildren(
                [
                    { id: "1", text: "First" },
                    { id: "2", text: "Second" },
                    { id: "3", text: "Third" },
                ],
                buildTextListView,
            );
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
            function App({ value }: { value: string }) {
                return <DropDown items={[{ id: "dynamic", value }]} />;
            }

            const { rerender } = await render(<App value="Initial" />);
            expect(screen.queryAllByText("Initial").length).toBeGreaterThan(0);

            await rerender(<App value="Updated" />);
            expect(screen.queryAllByText("Updated").length).toBeGreaterThan(0);
            expect(screen.queryAllByText("Initial")).toHaveLength(0);
        });
    });
});

describe("render - ListItem (5)", () => {
    describe("ListItem in DropDown (2)", () => {
        it("maintains order with multiple items", async () => {
            const dropDownRef = createRef<Gtk.DropDown>();

            await render(
                <DropDown
                    ref={dropDownRef}
                    items={[
                        { id: "a", value: "First" },
                        { id: "b", value: "Second" },
                        { id: "c", value: "Third" },
                    ]}
                />,
            );

            await screen.findAllByText("First");

            if (dropDownRef.current) await userEvent.selectOptions(dropDownRef.current, 1);
            await screen.findAllByText("Second");

            if (dropDownRef.current) await userEvent.selectOptions(dropDownRef.current, 2);
            await screen.findAllByText("Third");
        });

        it("inserts item before existing item", async () => {
            const dropDownRef = createRef<Gtk.DropDown>();

            const { rerender } = await renderChildren(["first", "last"], buildValueDropDown(dropDownRef));
            await screen.findAllByText("first");

            if (dropDownRef.current) await userEvent.selectOptions(dropDownRef.current, 1);
            await screen.findAllByText("last");

            await rerender(["first", "middle", "last"]);
            if (dropDownRef.current) await userEvent.selectOptions(dropDownRef.current, 0);
            await screen.findAllByText("first");

            if (dropDownRef.current) await userEvent.selectOptions(dropDownRef.current, 1);
            await screen.findAllByText("middle");

            if (dropDownRef.current) await userEvent.selectOptions(dropDownRef.current, 2);
            await screen.findAllByText("last");
        });
    });
});
