import type * as Gtk from "@gtkx/gi/gtk";
import { ListView, type Section } from "@gtkx/components";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { render, screen } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { ScrollWrapper } from "./helpers/scroll-wrapper.js";
import { expectTextPresent } from "./helpers/text-presence.js";
import { expectNoBoxBetween } from "./helpers/widget-chain.js";

type Row = {
    name: string;
};

const sectioned: Section<string, Row>[] = [
    {
        id: "s1",
        value: "Section One",
        data: [
            { id: "a", value: { name: "Alpha" } },
            { id: "b", value: { name: "Beta" } },
        ],
    },
    {
        id: "s2",
        value: "Section Two",
        data: [{ id: "c", value: { name: "Gamma" } }],
    },
];

const renderSectioned = async (ref: ReturnType<typeof createRef<Gtk.ListView>>) => {
    await render(
        <ScrollWrapper minContentHeight={400}>
            <ListView<Row, string>
                ref={ref}
                sections={sectioned}
                renderItem={({ item }) => <GtkLabel>{item.name}</GtkLabel>}
                renderHeader={({ section: label }: { section: string }) => <GtkLabel>{label}</GtkLabel>}
            />
        </ScrollWrapper>,
    );
};

describe("ListView sections", () => {
    it("renders a header per section through the header factory", async () => {
        const ref = createRef<Gtk.ListView>();
        await renderSectioned(ref);
        await expectTextPresent("Section One");
        await expectTextPresent("Section Two");
        await expectTextPresent("Alpha");
        await expectTextPresent("Beta");
        await expectTextPresent("Gamma");
    });

    it("models only the children as items, never the headers", async () => {
        const ref = createRef<Gtk.ListView>();
        await renderSectioned(ref);
        await screen.findAllByText("Alpha");
        expect(ref.current?.getModel()).toHaveObjectProperty("nItems", 3);
    });

    it("renders the header label as the header's direct content with no wrapper container", async () => {
        const ref = createRef<Gtk.ListView>();
        await renderSectioned(ref);
        const [headerLabel] = await screen.findAllByText("Section One");

        if (headerLabel === undefined || ref.current === null) {
            throw new Error("Expected the header to render");
        }

        expectNoBoxBetween(headerLabel, ref.current);
    });
});
