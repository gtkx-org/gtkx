import type { ReactNode } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { createSplitViewNavigator, NavigationContainer } from "@gtkx/navigation";
import { render, screen, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import {
    clickButton,
    expectHidden,
    expectVisible,
    renderSplit,
    Split,
    splitView,
} from "./helpers/split-view-fixtures.js";

const Loose = createSplitViewNavigator();

const Page = (): ReactNode => <GtkLabel>Page Content</GtkLabel>;

describe("split view - layout (1)", () => {
    it("shows the sidebar beside the placeholder before a content route opens", async () => {
        await renderSplit();
        await screen.findByText("Lists Content");
        expectVisible("Nothing Selected");
        expect(splitView()).toHaveObjectProperty("collapsed", false);
        expect(splitView()).toHaveObjectProperty("show-content", false);
    });

    it("swaps the placeholder for the content route and keeps the sidebar", async () => {
        await renderSplit();
        await screen.findByText("Nothing Selected");
        await clickButton("Open personal");
        await screen.findByText("Tasks personal");
        expectHidden("Nothing Selected");
        expectVisible("Lists Content");
        expect(splitView()).toHaveObjectProperty("show-content", true);
    });

    it("brings the placeholder back once the content stack empties", async () => {
        await renderSplit();
        await clickButton("Open personal");
        await screen.findByText("Tasks personal");
        await clickButton("Go back");
        await screen.findByText("Nothing Selected");
        expectHidden("Tasks personal");
        expectVisible("Lists Content");
        expect(splitView()).toHaveObjectProperty("show-content", false);
    });
});

describe("split view - layout (2)", () => {
    it("places the sidebar at the start by default", async () => {
        await renderSplit();
        await screen.findByText("Lists Content");
        expect(splitView()).toHaveObjectProperty("sidebar-position", Gtk.PackType.START);
    });

    it("places the sidebar at the end when sidebarPosition is end", async () => {
        await renderSplit({ navigator: { sidebarPosition: "end" } });
        await screen.findByText("Lists Content");
        expectVisible("Nothing Selected");
        expect(splitView()).toHaveObjectProperty("sidebar-position", Gtk.PackType.END);
    });

    it("forwards the sidebar width bounds and fraction to the widget", async () => {
        await renderSplit({ navigator: { maxSidebarWidth: 320, minSidebarWidth: 180, sidebarWidthFraction: 0.35 } });
        await screen.findByText("Lists Content");
        expect(splitView()).toHaveObjectProperty("min-sidebar-width", 180);
        expect(splitView()).toHaveObjectProperty("max-sidebar-width", 320);
        expect(splitView()).toHaveObjectProperty("sidebar-width-fraction", 0.35);
    });
});

describe("split view - layout (3)", () => {
    it("leaves the content pane empty when the navigator has no placeholder", async () => {
        await renderSplit({ navigator: { contentPlaceholder: undefined } });
        await screen.findByText("Lists Content");
        expectHidden("Nothing Selected");
        await clickButton("Open personal");
        await screen.findByText("Tasks personal");
        await clickButton("Go back");

        await waitFor(() => {
            expect(screen.queryByText("Tasks personal")).toBeNull();
        });

        expectVisible("Lists Content");
    });

    it("pins the sidebar beside the content when initialRouteName opens a content route", async () => {
        await renderSplit({ navigator: { initialRouteName: "Draft" } });
        await screen.findByText("Draft Content");
        expectVisible("Lists Content");
        expectHidden("Nothing Selected");
        expect(splitView()).toHaveObjectProperty("show-content", true);
    });

    it("shows one pane at a time when collapsed", async () => {
        await renderSplit({ navigator: { collapsed: true } });
        await screen.findByText("Lists Content");
        expectHidden("Nothing Selected");
        expect(splitView()).toHaveObjectProperty("collapsed", true);
        await clickButton("Open personal");
        await screen.findByText("Tasks personal");
        expectHidden("Lists Content");
    });
});

describe("split view - layout (4)", () => {
    it("rejects when the navigator declares no screens", async () => {
        await expect(
            render(
                <NavigationContainer>
                    <Split.Navigator>{null}</Split.Navigator>
                </NavigationContainer>,
            ),
        ).rejects.toThrow();
    });

    it("rejects when initialRouteName names no screen", async () => {
        await expect(
            render(
                <NavigationContainer>
                    <Loose.Navigator initialRouteName="Missing">
                        <Loose.Screen name="Lists" component={Page} />
                    </Loose.Navigator>
                </NavigationContainer>,
            ),
        ).rejects.toThrow();
    });
});
