import { ListItemFactory, type ListItemRenderer } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import {
    GtkBox,
    GtkButton,
    GtkFilterListModel,
    GtkLabel,
    GtkListView,
    GtkNoSelection,
    GtkScrolledWindow,
    GtkSearchEntry,
    GtkStringFilter,
    GtkStringList,
} from "@gtkx/jsx/gtk";
import { getClassType } from "@gtkx/runtime";
import { render, screen, userEvent, waitFor, within } from "@gtkx/testing";
import { type ReactNode, useState } from "react";
import { describe, expect, it } from "vitest";

type NativeStringListProps = {
    strings: string[];
    renderItem: ListItemRenderer<Gtk.StringObject>;
    search?: string | undefined;
    estimatedItemHeight?: number | undefined;
    estimatedItemWidth?: number | undefined;
    onList?: ((list: Gtk.StringList | null) => void) | undefined;
    onView?: ((view: Gtk.ListView | null) => void) | undefined;
    maxContentHeight?: number | undefined;
};

const renderIndexedString: ListItemRenderer<Gtk.StringObject> = ({ item, index }) => (
    <GtkLabel>{`${String(index)}:${item.getString()}`}</GtkLabel>
);
const renderEmptyString: ListItemRenderer<Gtk.StringObject> = () => null;
const FILTER_STRINGS = ["alpha", "beta", "alpha"];
const MUTABLE_STRINGS = ["alpha", "beta"];
const SINGLE_STRING = ["alpha"];

function NativeStringList({
    strings,
    renderItem,
    search = "",
    estimatedItemHeight,
    estimatedItemWidth,
    onList,
    onView,
    maxContentHeight,
}: NativeStringListProps): ReactNode {
    const [expression] = useState(() =>
        Gtk.PropertyExpression.new(getClassType(Gtk.StringObject), null, "string"));

    return (
        <GtkScrolledWindow
            minContentWidth={240}
            minContentHeight={120}
            maxContentHeight={maxContentHeight}
        >
            <GtkListView
                ref={onView}
                model={(
                    <GtkNoSelection
                        model={(
                            <GtkFilterListModel
                                filter={(
                                    <GtkStringFilter
                                        expression={expression}
                                        ignoreCase
                                        matchMode={Gtk.StringFilterMatchMode.SUBSTRING}
                                        search={search}
                                    />
                                )}
                                model={<GtkStringList ref={onList} strings={strings} />}
                            />
                        )}
                    />
                )}
                factory={(
                    <ListItemFactory<Gtk.StringObject>
                        estimatedItemHeight={estimatedItemHeight}
                        estimatedItemWidth={estimatedItemWidth}
                        renderItem={renderItem}
                    />
                )}
            />
        </GtkScrolledWindow>
    );
}

function SearchFixture(): ReactNode {
    const [search, setSearch] = useState("");

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkSearchEntry
                placeholderText="Filter strings"
                text={search}
                onSearchChanged={(entry) => {
                    setSearch(entry.getText());
                }}
            />
            <NativeStringList
                strings={FILTER_STRINGS}
                search={search}
                renderItem={renderIndexedString}
            />
        </GtkBox>
    );
}

function StatefulString({ value }: { value: string }): ReactNode {
    const [initial] = useState(value);

    return <GtkLabel>{`${value}:${initial}`}</GtkLabel>;
}

const renderStatefulString: ListItemRenderer<Gtk.StringObject> = ({ item }) => (
    <StatefulString value={item.getString()} />
);

function MutationFixture(): ReactNode {
    const [list, setList] = useState<Gtk.StringList | null>(null);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkBox>
                <GtkButton
                    label="Replace first"
                    sensitive={list !== null}
                    onClicked={() => {
                        list?.splice(0, 1, ["gamma"]);
                    }}
                />
                <GtkButton
                    label="Clear strings"
                    sensitive={list !== null}
                    onClicked={() => {
                        if (list !== null) {
                            list.splice(0, list.getNItems(), null);
                        }
                    }}
                />
                <GtkButton
                    label="Append string"
                    sensitive={list !== null}
                    onClicked={() => {
                        list?.append("delta");
                    }}
                />
            </GtkBox>
            <NativeStringList
                strings={MUTABLE_STRINGS}
                renderItem={renderStatefulString}
                onList={setList}
            />
        </GtkBox>
    );
}

function RendererFixture(): ReactNode {
    const [shouldShowIndex, setShouldShowIndex] = useState(false);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkButton
                label="Show indexes"
                onClicked={() => {
                    setShouldShowIndex(true);
                }}
            />
            <NativeStringList
                strings={MUTABLE_STRINGS}
                renderItem={({ item, index }) => (
                    <GtkLabel>{shouldShowIndex ? `${String(index)}:${item.getString()}` : item.getString()}</GtkLabel>
                )}
            />
        </GtkBox>
    );
}

const LARGE_STRINGS = Array.from({ length: 2000 }, (_, index) => `Item ${String(index)}`);

function ScrollingFixture(): ReactNode {
    const [view, setView] = useState<Gtk.ListView | null>(null);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkBox>
                <GtkButton
                    label="Go to last"
                    sensitive={view !== null}
                    onClicked={() => {
                        view?.scrollTo(LARGE_STRINGS.length - 1, Gtk.ListScrollFlags.NONE, null);
                    }}
                />
                <GtkButton
                    label="Go to first"
                    sensitive={view !== null}
                    onClicked={() => {
                        view?.scrollTo(0, Gtk.ListScrollFlags.NONE, null);
                    }}
                />
            </GtkBox>
            <NativeStringList
                strings={LARGE_STRINGS}
                renderItem={renderIndexedString}
                onView={setView}
                maxContentHeight={120}
            />
        </GtkBox>
    );
}

const drawSizedStringList = (size: number, renderItem: ListItemRenderer<Gtk.StringObject>): ReactNode => (
    <NativeStringList
        strings={SINGLE_STRING}
        estimatedItemHeight={size}
        estimatedItemWidth={size}
        renderItem={renderItem}
    />
);

describe("ListItemFactory native models", () => {
    it("renders duplicate model objects and follows filtering with view indexes", async () => {
        await render(<SearchFixture />);
        expect(await screen.findByText("0:alpha")).toBeVisible();
        expect(await screen.findByText("1:beta")).toBeVisible();
        expect(await screen.findByText("2:alpha")).toBeVisible();
        const search = await screen.findByPlaceholderText("Filter strings");
        await userEvent.type(search, "alpha");

        await waitFor(() => {
            expect(screen.getByText("0:alpha")).toBeVisible();
            expect(screen.getByText("1:alpha")).toBeVisible();
            expect(screen.queryByText("1:beta")).toBeNull();
            expect(screen.queryByText("2:alpha")).toBeNull();
        });

        await userEvent.clear(search);
        expect(await screen.findByText("1:beta")).toBeVisible();
        expect(await screen.findByText("2:alpha")).toBeVisible();
    });

    it("does not carry component state across replacement, clearing, and reuse", async () => {
        await render(<MutationFixture />);
        expect(await screen.findByText("alpha:alpha")).toBeVisible();
        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Replace first" }));
        expect(await screen.findByText("gamma:gamma")).toBeVisible();
        expect(screen.queryByText("gamma:alpha")).toBeNull();

        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Clear strings" }));
        await waitFor(() => {
            expect(screen.queryByText("gamma:gamma")).toBeNull();
            expect(screen.queryByText("beta:beta")).toBeNull();
        });

        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Append string" }));
        expect(await screen.findByText("delta:delta")).toBeVisible();
    });

    it("updates realized rows when the renderItem callback changes", async () => {
        await render(<RendererFixture />);
        expect(await screen.findByText("alpha")).toBeVisible();
        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Show indexes" }));
        expect(await screen.findByText("0:alpha")).toBeVisible();
        expect(screen.queryByText("alpha")).toBeNull();
    });

    it("rebinds pooled rows while scrolling a large external model", async () => {
        await render(<ScrollingFixture />);
        expect(await screen.findByText("0:Item 0")).toBeVisible();
        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Go to last" }));
        expect(await screen.findByText("1999:Item 1999")).toBeVisible();
        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Go to first" }));
        expect(await screen.findByText("0:Item 0")).toBeVisible();
    });

    it("keeps estimated dimensions while rendered content is empty", async () => {
        const { container, rerender } = await render(drawSizedStringList(40, renderIndexedString));
        const row = await within(container).findByRole(Gtk.AccessibleRole.LIST_ITEM);
        expect(await within(container).findByText("0:alpha")).toBeVisible();

        await rerender(drawSizedStringList(40, renderEmptyString));
        expect(within(container).queryByText("0:alpha")).toBeNull();
        const height = row.measure(Gtk.Orientation.VERTICAL, -1)[0];
        const width = row.measure(Gtk.Orientation.HORIZONTAL, -1)[0];
        expect(height).toBeGreaterThanOrEqual(40);
        expect(width).toBeGreaterThanOrEqual(40);

        await rerender(drawSizedStringList(100, renderEmptyString));
        expect(within(container).getByRole(Gtk.AccessibleRole.LIST_ITEM)).toBe(row);
        expect(row.measure(Gtk.Orientation.VERTICAL, -1)[0]).toBeGreaterThan(height);
        expect(row.measure(Gtk.Orientation.HORIZONTAL, -1)[0]).toBeGreaterThan(width);

        await rerender(drawSizedStringList(100, renderIndexedString));
        expect(await within(container).findByText("0:alpha")).toBeVisible();
    });

    it("propagates renderer errors", async () => {
        await expect(render(
            <NativeStringList
                strings={SINGLE_STRING}
                renderItem={() => {
                    throw new Error("Render failed");
                }}
            />,
        )).rejects.toThrow();
    });
});
