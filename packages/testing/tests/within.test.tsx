import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkFrame } from "@gtkx/jsx/gtk";
import { describe, expect, it } from "vitest";
import { render, screen, within } from "../src/index.js";

describe("within scoping", () => {
    it("scopes queries to the given container", async () => {
        await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkFrame name="section-a" label="Section A">
                    <GtkButton label="Submit" />
                </GtkFrame>
                <GtkFrame name="section-b" label="Section B">
                    <GtkButton label="Cancel" />
                </GtkFrame>
            </GtkBox>,
        );

        const sectionA = await screen.findByName("section-a");
        const submit = await within(sectionA).findByRole(Gtk.AccessibleRole.BUTTON);

        expect(submit).toBeDefined();
        expect((submit as Gtk.Button).getLabel()).toBe("Submit");
    });

    it("does not find elements outside the container", async () => {
        await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkFrame name="inner-frame" label="Inner">
                    Inside
                </GtkFrame>
                Outside
            </GtkBox>,
        );

        const frame = await screen.findByName("inner-frame");

        await expect(within(frame).findByText("Outside", { timeout: 100 })).rejects.toThrow("Unable to find");
    });

    it("returns the full bound-queries surface", async () => {
        await render(
            <GtkFrame name="container">
                <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                    <GtkButton label="Item" />
                    <GtkButton label="Item" />
                </GtkBox>
            </GtkFrame>,
        );

        const frame = await screen.findByName("container");
        const bound = within(frame);
        const items = await bound.findAllByText("Item");

        expect(items.length).toBe(2);
        expect(typeof bound.queryByRole).toBe("function");
        expect(typeof bound.queryAllByName).toBe("function");
    });
});

describe("within nested", () => {
    it("supports nested within calls", async () => {
        await render(
            <GtkFrame name="outer-frame">
                <GtkFrame name="inner-frame">
                    <GtkButton label="Deep" />
                </GtkFrame>
            </GtkFrame>,
        );

        const outer = await screen.findByName("outer-frame");
        const inner = await within(outer).findByName("inner-frame");
        const button = await within(inner).findByRole(Gtk.AccessibleRole.BUTTON);

        expect(button).toBeDefined();
    });
});
