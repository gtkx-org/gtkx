import type { ListItem, ListSection } from "@gtkx/components";
import type { ReactNode } from "react";
import { ColumnView, GridView, ListView } from "@gtkx/components";
import type * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { render, waitFor } from "@gtkx/testing";
import { useEffect, useState } from "react";
import { describe, expect, it } from "vitest";
import { labelTexts } from "./helpers/row-texts.js";
import { ScrollWrapper } from "./helpers/scroll-wrapper.js";

type Shape = "list" | "grid" | "columns" | "sections" | "tree" | "column tree";

type Rows = {
    container: Gtk.Widget;
    mounts: string[];
    to: (names: string[]) => Promise<void>;
    texts: (names: string[]) => Promise<void>;
};

const GROUP = "Group";
const leaves = (names: string[]): ListItem<string>[] => names.map((name) => ({ id: name, value: name }));
const isTree = (shape: Shape): boolean => shape === "tree" || shape === "column tree";

function Row({ name, mounts }: { name: string; mounts: string[] }): ReactNode {
    const [initial] = useState(name);

    useEffect(() => {
        mounts.push(name);
    }, [mounts, name]);

    return <GtkLabel>{`${name}:${initial}`}</GtkLabel>;
}

function drawView(shape: Shape, names: string[], mounts: string[]): ReactNode {
    const renderItem = ({ item }: { item: string }): ReactNode => <Row name={item} mounts={mounts} />;
    const items = isTree(shape) ? [{ id: GROUP, value: GROUP, children: leaves(names) }] : leaves(names);
    const sections: ListSection<string, string>[] = [{ id: "section", value: "Section", data: items }];

    switch (shape) {
        case "grid":
            return <GridView items={items} renderItem={renderItem} maxColumns={1} />;
        case "columns":
        case "column tree":
            return (
                <ColumnView
                    items={items}
                    expandedIds={[GROUP]}
                    columns={[{ id: "name", title: "Name", renderCell: renderItem }]}
                />
            );
        case "sections":
            return <ListView sections={sections} renderItem={renderItem} />;
        default:
            return <ListView items={items} expandedIds={[GROUP]} renderItem={renderItem} />;
    }
}

const renderRows = async (shape: Shape, names: string[]): Promise<Rows> => {
    const mounts: string[] = [];
    const draw = (next: string[]): ReactNode => (
        <ScrollWrapper minContentHeight={400}>{drawView(shape, next, mounts)}</ScrollWrapper>
    );
    const { rerender, container } = await render(draw(names));
    const rows: Rows = {
        container,
        mounts,
        to: async (next) => {
            mounts.length = 0;
            await rerender(draw(next));
        },
        texts: async (expected) => {
            const prefix = isTree(shape) ? [`${GROUP}:${GROUP}`] : [];
            await waitFor(() => {
                const shown = labelTexts(container).filter((text) => text.includes(":"));
                expect(shown).toEqual([...prefix, ...expected.map((name) => `${name}:${name}`)]);
            });
        },
    };

    return rows;
};

describe.each<Shape>(["list", "grid", "columns", "sections", "tree", "column tree"])("%s rows", (shape) => {
    it("mounts only the row inserted above the others", async () => {
        const rows = await renderRows(shape, ["b", "c", "d"]);
        await rows.texts(["b", "c", "d"]);
        await rows.to(["a", "b", "c", "d"]);
        await rows.texts(["a", "b", "c", "d"]);
        expect(rows.mounts).toEqual(["a"]);
    });

    it("keeps the rows after a removed item mounted", async () => {
        const rows = await renderRows(shape, ["a", "b", "c"]);
        await rows.texts(["a", "b", "c"]);
        await rows.to(["b", "c"]);
        await rows.texts(["b", "c"]);
        expect(rows.mounts).toEqual([]);
    });

    it("keeps the rows around two swapped items mounted", async () => {
        const rows = await renderRows(shape, ["a", "b", "c", "d"]);
        await rows.texts(["a", "b", "c", "d"]);
        await rows.to(["a", "c", "b", "d"]);
        await rows.texts(["a", "c", "b", "d"]);
        expect(rows.mounts.filter((name) => name === "a" || name === "d")).toEqual([]);
    });
});

describe.each<Shape>(["list", "grid", "columns", "sections"])("%s rows that move", (shape) => {
    it("keep their state", async () => {
        const rows = await renderRows(shape, ["a", "b", "c", "d"]);
        await rows.texts(["a", "b", "c", "d"]);
        await rows.to(["d", "c", "b", "a"]);
        await rows.texts(["d", "c", "b", "a"]);
        expect(rows.mounts).toEqual([]);
    });

    it("keep the state of each occurrence of a repeated id", async () => {
        const rows = await renderRows(shape, ["a", "x", "b", "x"]);
        await rows.texts(["a", "x", "b", "x"]);
        await rows.to(["x", "a", "x", "b"]);
        await rows.texts(["x", "a", "x", "b"]);
        expect(rows.mounts).toEqual([]);
    });
});

describe.each<Shape>(["list", "tree"])("%s rows of a large reorder", (shape) => {
    it("show their own item and state", async () => {
        const names = Array.from({ length: 2000 }, (_, index) => String(index).padStart(4, "0"));
        const rows = await renderRows(shape, names);
        await waitFor(() => {
            expect(labelTexts(rows.container)).toContain("0000:0000");
        });
        await rows.to(names.toReversed());

        await waitFor(() => {
            const shown = labelTexts(rows.container).filter((text) => /^\d+:/.test(text));
            expect(shown.length).toBeGreaterThan(1);
            expect(shown.every((text) => text.split(":")[0] === text.split(":")[1])).toBe(true);
            expect(shown.map(Number.parseFloat).toSorted((a, b) => b - a)).toEqual(shown.map(Number.parseFloat));
        });
    });
});

describe("Tree rows", () => {
    const branch = (id: string, children: string[]): ListItem<string> => ({
        id,
        value: id,
        children: leaves(children),
    });

    const draw = (items: ListItem<string>[], expandedIds: string[], mounts: string[]): ReactNode => (
        <ScrollWrapper minContentHeight={400}>
            <ListView
                items={items}
                expandedIds={expandedIds}
                renderItem={({ item }) => <Row name={item} mounts={mounts} />}
            />
        </ScrollWrapper>
    );

    it("keep a branch expanded and its rows mounted when branches come and go above it", async () => {
        const mounts: string[] = [];
        const { rerender, container } = await render(draw([branch("p", ["p1", "p2"])], ["p"], mounts));
        const expectRows = (names: string[]) =>
            waitFor(() => {
                expect(labelTexts(container)).toEqual(names.map((name) => `${name}:${name}`));
            });
        await expectRows(["p", "p1", "p2"]);
        mounts.length = 0;
        await rerender(draw([branch("q", ["q1"]), branch("p", ["p1", "p2"])], ["p"], mounts));
        await expectRows(["q", "p", "p1", "p2"]);
        expect(mounts).toEqual(["q"]);
        mounts.length = 0;
        await rerender(draw([branch("q", ["q1"]), branch("p", ["p1", "p2"])], ["q", "p"], mounts));
        await expectRows(["q", "q1", "p", "p1", "p2"]);
        expect(mounts).toEqual(["q1"]);
        mounts.length = 0;
        await rerender(draw([branch("p", ["p1", "p2"])], ["q", "p"], mounts));
        await expectRows(["p", "p1", "p2"]);
        expect(mounts).toEqual([]);
    });

    it("keep their state when an item with the same id sits in another branch", async () => {
        const mounts: string[] = [];
        const items = [branch("p", ["x", "y"]), branch("q", ["x"])];
        const { rerender, container } = await render(draw(items, ["p", "q"], mounts));
        const expectRows = (names: string[]) =>
            waitFor(() => {
                expect(labelTexts(container)).toEqual(names.map((name) => `${name}:${name}`));
            });
        await expectRows(["p", "x", "y", "q", "x"]);
        mounts.length = 0;
        await rerender(draw([branch("p", ["y"]), branch("q", ["x"])], ["p", "q"], mounts));
        await expectRows(["p", "y", "q", "x"]);
        expect(mounts).toEqual([]);
    });
});

describe("Section rows", () => {
    const section = (id: string, names: string[]): ListSection<string, string> => ({
        id,
        value: id,
        data: leaves(names),
    });

    const draw = (sections: ListSection<string, string>[], mounts: string[]): ReactNode => (
        <ScrollWrapper minContentHeight={400}>
            <ListView
                sections={sections}
                renderHeader={({ section: name }) => <GtkLabel>{`${name}:`}</GtkLabel>}
                renderItem={({ item }) => <Row name={item} mounts={mounts} />}
            />
        </ScrollWrapper>
    );

    it("stay mounted when a section is inserted above theirs or moves", async () => {
        const mounts: string[] = [];
        const { rerender, container } = await render(draw([section("T", ["b", "c"])], mounts));
        const expectLabels = (labels: string[]) =>
            waitFor(() => {
                expect(labelTexts(container)).toEqual(labels);
            });
        await expectLabels(["T:", "b:b", "c:c"]);
        mounts.length = 0;
        await rerender(draw([section("S", ["a"]), section("T", ["b", "c"])], mounts));
        await expectLabels(["S:", "a:a", "T:", "b:b", "c:c"]);
        expect(mounts).toEqual(["a"]);
        mounts.length = 0;
        await rerender(draw([section("T", ["b", "c"]), section("S", ["a"])], mounts));
        await expectLabels(["T:", "b:b", "c:c", "S:", "a:a"]);
        expect(mounts).toEqual([]);
    });
});
