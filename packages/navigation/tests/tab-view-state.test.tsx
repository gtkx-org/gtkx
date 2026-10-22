import type { NavigationState, PartialState } from "@react-navigation/core";
import type { ReactNode } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton } from "@gtkx/jsx/gtk";
import type { TabViewNavigationState } from "@gtkx/navigation";
import { act, render, screen } from "@gtkx/testing";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import {
    clickButton,
    type DocumentParams,
    DocumentsApp,
    focusedTitle,
    pageTitles,
    viewOf,
} from "./helpers/tab-view-fixtures.js";

const restoredState: PartialState<TabViewNavigationState<DocumentParams>> = {
    routes: [
        { key: "parent", name: "Document", params: { title: "Parent" } },
        { key: "pinned", name: "Document", params: { title: "Pinned" } },
        { key: "child", name: "Document", params: { title: "Child" } },
    ],
    index: 1,
    pinnedKeys: ["pinned"],
    parents: { child: "parent" },
};

describe("tab view navigator state", () => {
    it("restores pinned tabs, parents and the selection from an initial state", async () => {
        const states: (NavigationState | undefined)[] = [];
        await render(<DocumentsApp initialState={restoredState} onStateChange={(state) => states.push(state)} />);
        await screen.findByText("Pinned content");
        const view = viewOf("Pinned content");

        expect(pageTitles(view)).toEqual(["Pinned", "Parent", "Child"]);
        expect(view.getNthPage(0).getPinned()).toBe(true);
        expect(view.getSelectedPage()?.getTitle()).toBe("Pinned");

        await act(() => {
            view.setSelectedPage(view.getNthPage(2));
        });
        await clickButton("Close Child");
        expect(pageTitles(view)).toEqual(["Pinned", "Parent"]);
        expect(view.getSelectedPage()?.getTitle()).toBe("Parent");
        expect(focusedTitle(states.at(-1))).toBe("Parent");
    });

    it("starts over when the screen's navigation key changes", async () => {
        const Keyed = (): ReactNode => {
            const [key, setKey] = useState("first");

            return (
                <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                    <GtkButton label="Change key" onClicked={() => setKey("second")} />
                    <DocumentsApp navigationKey={key} />
                </GtkBox>
            );
        };
        await render(<Keyed />);
        await screen.findByText("First content");
        const view = viewOf("First content");
        await clickButton("Open sibling of First");
        await screen.findByText("First sibling content");

        await clickButton("Change key");
        await screen.findByText("First content");
        expect(pageTitles(view)).toEqual(["First"]);
        expect(view.getSelectedPage()?.getTitle()).toBe("First");
    });
});
