import * as Gtk from "@gtkx/gi/gtk";
import { screen, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import {
    buildSplit,
    clickButton,
    expectHidden,
    expectVisible,
    pressKeys,
    renderSplit,
} from "./helpers/split-view-fixtures.js";

const queryBackButton = (): Gtk.Widget | null => screen.queryByRole(Gtk.AccessibleRole.BUTTON, { name: "Back" });

describe("split view - collapsing (1)", () => {
    it("shows only the sidebar until a list is selected", async () => {
        await renderSplit({ navigator: { collapsed: true } });
        await screen.findByText("Lists Content");
        expectHidden("Nothing Selected");
        await clickButton("Open personal");
        await screen.findByText("Tasks personal");
        expectHidden("Lists Content");
        expectHidden("Nothing Selected");
    });

    it("returns to the sidebar with one Back press at the content root", async () => {
        await renderSplit({ navigator: { collapsed: true } });
        await clickButton("Open personal");
        await screen.findByText("Tasks personal");
        await clickButton("Back");
        expectHidden("Nothing Selected");
        await screen.findByText("Lists Content");

        await waitFor(() => {
            expectHidden("Tasks personal");
        });

        expectHidden("Nothing Selected");
        expect(queryBackButton()).toBeNull();
    });

    it("returns to the sidebar when Escape is pressed at the content root", async () => {
        await renderSplit({ navigator: { collapsed: true } });
        await clickButton("Open personal");
        await pressKeys("Tasks personal", "{Escape}");
        await screen.findByText("Lists Content");

        await waitFor(() => {
            expectHidden("Tasks personal");
        });

        expectHidden("Nothing Selected");
    });
});

describe("split view - collapsing (2)", () => {
    it("pops the detail with the first Back press and the content pane with the second", async () => {
        await renderSplit({ navigator: { collapsed: true } });
        await clickButton("Open personal");
        await clickButton("Open task");
        await screen.findByText("Task 7");
        await clickButton("Back");
        await screen.findByText("Tasks personal");
        expectHidden("Lists Content");
        await clickButton("Back");
        await screen.findByText("Lists Content");

        await waitFor(() => {
            expectHidden("Tasks personal");
        });
    });

    it("pops only the detail when Escape is pressed at a pushed detail", async () => {
        await renderSplit({ navigator: { collapsed: true } });
        await clickButton("Open personal");
        await clickButton("Open task");
        await pressKeys("Task 7", "{Escape}");
        await screen.findByText("Tasks personal");
        expectHidden("Lists Content");
        expectHidden("Task 7");
    });

    it("keeps the detail page when Escape is pressed with popOnEscape disabled", async () => {
        await renderSplit({ navigator: { collapsed: true, popOnEscape: false } });
        await clickButton("Open personal");
        await clickButton("Open task");
        await pressKeys("Task 7", "{Escape}");

        await waitFor(() => {
            expectVisible("Task 7");
        });

        expectHidden("Tasks personal");
        expectHidden("Lists Content");
    });
});

describe("split view - collapsing (3)", () => {
    it("keeps the open detail when the navigator collapses at runtime", async () => {
        const { rerender } = await renderSplit();
        await clickButton("Open personal");
        await clickButton("Open task");
        await screen.findByText("Task 7");
        await rerender(buildSplit({ navigator: { collapsed: true } }));
        await screen.findByText("Task 7");

        await waitFor(() => {
            expectHidden("Lists Content");
        });
    });

    it("shows both panes with the stack intact when the navigator uncollapses", async () => {
        const { rerender } = await renderSplit({ navigator: { collapsed: true } });
        await clickButton("Open personal");
        await clickButton("Open task");
        await screen.findByText("Task 7");
        await rerender(buildSplit());
        await screen.findByText("Lists Content");
        expectVisible("Task 7");
        await clickButton("Back");
        await screen.findByText("Tasks personal");
        expectVisible("Lists Content");
    });
});
