import * as Gtk from "@gtkx/gi/gtk";
import { GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { screen, within } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import {
    clickButton,
    CustomHeader,
    expectHidden,
    expectVisible,
    getHeaderBar,
    pressKeys,
    queryBackButton,
    queryHeaderBar,
    renderStack,
} from "./helpers/stack-fixtures.js";

describe("stack - header (1)", () => {
    it("renders the screen without a header bar when headerShown is false", async () => {
        await renderStack({ details: { headerShown: false } });
        await clickButton("Go to details");
        await screen.findByText("Details 1");
        expect(queryHeaderBar()).toBeNull();
        expect(queryBackButton()).toBeNull();
        expectHidden("Details Page");
    });

    it("uses a headerTitle string as the visible title", async () => {
        await renderStack({ details: { headerTitle: "Custom Title" } });
        await clickButton("Go to details");
        await screen.findByText("Details 1");
        expect(within(getHeaderBar()).getByText("Custom Title")).toBeVisible();
        expectHidden("Details Page");
    });

    it("uses a headerTitle element as the title widget", async () => {
        await renderStack({ details: { headerTitle: <GtkLabel>Element Title</GtkLabel> } });
        await clickButton("Go to details");
        await screen.findByText("Details 1");
        expect(within(getHeaderBar()).getByText("Element Title")).toBeVisible();
        expectHidden("Details Page");
    });

    it("packs headerStart and headerEnd widgets in the header bar", async () => {
        await renderStack({
            home: { headerStart: <GtkButton label="Start Action" />, headerEnd: <GtkLabel>End Widget</GtkLabel> },
        });

        await screen.findByText("Home Content");
        const header = within(getHeaderBar());
        expect(header.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Start Action" })).toBeVisible();
        expect(header.getByText("End Widget")).toBeVisible();
    });
});

describe("stack - header (2)", () => {
    it("renders a custom header with the route, options and back page", async () => {
        await renderStack({ navigator: { screenOptions: { header: CustomHeader } } });
        await screen.findByText("Header Home");
        expect(screen.queryByRole(Gtk.AccessibleRole.BUTTON, { name: /^Back to/ })).toBeNull();
        await clickButton("Go to details");
        await screen.findByText("Header Details Page");
        expect(queryBackButton()).toBeNull();
        await clickButton("Back to Home");
        await screen.findByText("Home Content");
        expectHidden("Details 1");
    });

    it("hides the Back button when headerBackVisible is false", async () => {
        await renderStack({ details: { headerBackVisible: false } });
        await clickButton("Go to details");
        await screen.findByText("Details 1");
        expect(queryBackButton()).toBeNull();
        expect(within(getHeaderBar()).getByText("Details Page")).toBeVisible();
        await pressKeys("Details 1", "{Escape}");
        await screen.findByText("Home Content");
    });

    it("keeps the page on Escape when popOnEscape is false", async () => {
        await renderStack({ navigator: { popOnEscape: false } });
        await clickButton("Go to details");
        await pressKeys("Details 1", "{Escape}");
        expectVisible("Details 1");
        await clickButton("Back");
        await screen.findByText("Home Content");
    });

    it("keeps the page on Escape and hides Back when canPop is false", async () => {
        await renderStack({ details: { canPop: false } });
        await clickButton("Go to details");
        await screen.findByText("Details 1");
        expect(queryBackButton()).toBeNull();
        await pressKeys("Details 1", "{Escape}");
        expectVisible("Details 1");
        await clickButton("Go back");
        await screen.findByText("Home Content");
    });
});
