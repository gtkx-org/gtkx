import type * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel, GtkListView } from "@gtkx/jsx/gtk";
import type { ListItem } from "@gtkx/react";
import { render, screen } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { ScrollWrapper } from "../helpers/scroll-wrapper.js";

interface Row {
    name: string;
}

const sectioned: ListItem<Row, string>[] = [
    {
        id: "s1",
        value: "Section One",
        section: true,
        children: [
            { id: "a", value: { name: "Alpha" } },
            { id: "b", value: { name: "Beta" } },
        ],
    },
    {
        id: "s2",
        value: "Section Two",
        section: true,
        children: [{ id: "c", value: { name: "Gamma" } }],
    },
];

const renderSectioned = async (ref: ReturnType<typeof createRef<Gtk.ListView>>) => {
    await render(
        <ScrollWrapper minContentHeight={400}>
            <GtkListView<Row, string>
                ref={ref}
                items={sectioned}
                renderItem={(item) => <GtkLabel label={item.name} />}
                renderHeader={(label) => <GtkLabel label={label} />}
            />
        </ScrollWrapper>,
    );
};

describe("ListView sections", () => {
    it("renders a header per section through the header factory", async () => {
        const ref = createRef<Gtk.ListView>();
        await renderSectioned(ref);

        await screen.findAllByText("Section One");
        await screen.findAllByText("Section Two");
        await screen.findAllByText("Alpha");
        await screen.findAllByText("Beta");
        await screen.findAllByText("Gamma");
    });

    it("models only the children as items, never the headers", async () => {
        const ref = createRef<Gtk.ListView>();
        await renderSectioned(ref);
        await screen.findAllByText("Alpha");

        expect(ref.current?.getModel()?.getNItems()).toBe(3);
    });
});
