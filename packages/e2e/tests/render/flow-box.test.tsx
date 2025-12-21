import type * as Gtk from "@gtkx/ffi/gtk";
import { GtkFlowBox, GtkLabel } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

const getFlowBoxChildLabels = (flowBox: Gtk.FlowBox): string[] => {
    const labels: string[] = [];
    let child = flowBox.getChildAtIndex(0);
    let index = 0;
    while (child) {
        const innerChild = child.getChild();
        if (innerChild && "getLabel" in innerChild && typeof innerChild.getLabel === "function") {
            labels.push((innerChild as Gtk.Label).getLabel() ?? "");
        }
        index++;
        child = flowBox.getChildAtIndex(index);
    }
    return labels;
};

describe("render - FlowBox", () => {
    describe("adding items", () => {
        it("appends child widgets", async () => {
            const ref = createRef<Gtk.FlowBox>();

            await render(
                <GtkFlowBox ref={ref}>
                    <GtkLabel label="First" />
                    <GtkLabel label="Second" />
                </GtkFlowBox>,
                { wrapper: false },
            );

            const labels = getFlowBoxChildLabels(ref.current as Gtk.FlowBox);
            expect(labels).toEqual(["First", "Second"]);
        });
    });

    describe("inserting items", () => {
        it("inserts child at correct position", async () => {
            const ref = createRef<Gtk.FlowBox>();

            function App({ items }: { items: string[] }) {
                return (
                    <GtkFlowBox ref={ref}>
                        {items.map((item) => (
                            <GtkLabel key={item} label={item} />
                        ))}
                    </GtkFlowBox>
                );
            }

            await render(<App items={["A", "C"]} />, { wrapper: false });

            await render(<App items={["A", "B", "C"]} />, { wrapper: false });

            const labels = getFlowBoxChildLabels(ref.current as Gtk.FlowBox);
            expect(labels).toEqual(["A", "B", "C"]);
        });
    });

    describe("removing items", () => {
        it("removes item at correct position", async () => {
            const ref = createRef<Gtk.FlowBox>();

            function App({ items }: { items: string[] }) {
                return (
                    <GtkFlowBox ref={ref}>
                        {items.map((item) => (
                            <GtkLabel key={item} label={item} />
                        ))}
                    </GtkFlowBox>
                );
            }

            await render(<App items={["A", "B", "C"]} />, { wrapper: false });

            await render(<App items={["A", "C"]} />, { wrapper: false });

            const labels = getFlowBoxChildLabels(ref.current as Gtk.FlowBox);
            expect(labels).toEqual(["A", "C"]);
        });
    });
});
