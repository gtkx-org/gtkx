import type { StackHeaderProps } from "@gtkx/navigation";
import type { ReactNode } from "react";
import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { screen, within } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import {
    clickButton,
    expectHidden,
    expectVisible,
    getAncestor,
    renderSplit,
} from "./helpers/split-view-fixtures.js";

const SIDEBAR_ACTIONS = { headerStart: <GtkButton label="New List" />, headerEnd: <GtkLabel>Synced</GtkLabel> };

const SidebarHeader = ({ route, options, back }: StackHeaderProps): ReactNode => (
    <GtkBox orientation={Gtk.Orientation.HORIZONTAL}>
        <GtkLabel>{`Sidebar ${options.title ?? route.name}`}</GtkLabel>
        <GtkLabel>{back === undefined ? "No Back Page" : `Back To ${back.title}`}</GtkLabel>
    </GtkBox>
);

const ContentHeader = ({ route, options, navigation }: StackHeaderProps): ReactNode => (
    <GtkBox orientation={Gtk.Orientation.HORIZONTAL}>
        <GtkLabel>{`Content ${options.title ?? route.name}`}</GtkLabel>
        <GtkButton
            label="Close list"
            onClicked={() => {
                navigation.goBack();
            }}
        />
    </GtkBox>
);

const ThrowingHeader = (): ReactNode => {
    throw new Error("The header renderer failed");
};

const headerBar = (paneText: string): Adw.HeaderBar =>
    within(getAncestor(screen.getByText(paneText), Adw.ToolbarView)).getByRole(Gtk.AccessibleRole.GROUP, {
        as: Adw.HeaderBar,
    });

const queryHeaderBar = (): Gtk.Widget | null => screen.queryByRole(Gtk.AccessibleRole.GROUP, { as: Adw.HeaderBar });

const queryBackButton = (paneText: string): Gtk.Widget | null =>
    within(headerBar(paneText)).queryByRole(Gtk.AccessibleRole.BUTTON, { name: "Back" });

const expectHeaderText = (paneText: string, headerText: string): void => {
    expect(within(headerBar(paneText)).getByText(headerText)).toBeVisible();
};

describe("split view - header", () => {
    it("shows the sidebar title with its header widgets and no Back button", async () => {
        await renderSplit({ lists: SIDEBAR_ACTIONS });
        await screen.findByText("Lists Content");
        const header = within(headerBar("Lists Content"));
        expect(header.getByText("Lists")).toBeVisible();
        expect(header.getByRole(Gtk.AccessibleRole.BUTTON, { name: "New List" })).toBeVisible();
        expect(header.getByText("Synced")).toBeVisible();
        expect(queryBackButton("Lists Content")).toBeNull();
    });

    it("shows a content route's title in the content header", async () => {
        await renderSplit({ tasks: { title: "Task List" } });
        await clickButton("Open personal");
        await screen.findByText("Tasks personal");
        expectHeaderText("Tasks personal", "Task List");
        expectHeaderText("Lists Content", "Lists");
    });

    it("keeps the sidebar free of a Back button as the content stack grows", async () => {
        await renderSplit({ tasks: { title: "Task List" } });
        await clickButton("Open personal");
        await screen.findByText("Tasks personal");
        expect(queryBackButton("Lists Content")).toBeNull();
        await clickButton("Open task");
        await screen.findByText("Task 7");
        expect(queryBackButton("Task 7")).toBeVisible();
        expect(queryBackButton("Lists Content")).toBeNull();
    });

    it("renders the sidebar without a header bar when headerShown is false", async () => {
        await renderSplit({ lists: { headerShown: false } });
        await screen.findByText("Lists Content");
        expect(queryHeaderBar()).toBeNull();
        expectHidden("Lists");
        await clickButton("Open personal");
        await screen.findByText("Tasks personal");
        expectHeaderText("Tasks personal", "Tasks");
    });

    it("renders a content route without a header bar when headerShown is false", async () => {
        await renderSplit({ tasks: { headerShown: false, title: "Task List" } });
        await clickButton("Open personal");
        await screen.findByText("Tasks personal");
        expectHidden("Task List");
        expectHeaderText("Lists Content", "Lists");
        expect(queryBackButton("Lists Content")).toBeNull();
    });

    it("uses a headerTitle string as the content title", async () => {
        await renderSplit({ tasks: { headerTitle: "Custom Title", title: "Task List" } });
        await clickButton("Open personal");
        await screen.findByText("Tasks personal");
        expectHeaderText("Tasks personal", "Custom Title");
        expectHidden("Task List");
    });

    it("uses a headerTitle element as the content title widget", async () => {
        await renderSplit({ tasks: { headerTitle: <GtkLabel>Title Widget</GtkLabel>, title: "Task List" } });
        await clickButton("Open personal");
        await screen.findByText("Tasks personal");
        expectHeaderText("Tasks personal", "Title Widget");
        expectHidden("Task List");
    });

    it("renders a custom header on the sidebar with no back page", async () => {
        await renderSplit({ lists: { header: SidebarHeader } });
        await screen.findByText("Sidebar Lists");
        expectVisible("No Back Page");
        expectVisible("Lists Content");
        expect(queryHeaderBar()).toBeNull();
    });

    it("renders a custom header on a content route", async () => {
        await renderSplit({ tasks: { header: ContentHeader, title: "Task List" } });
        await clickButton("Open personal");
        await screen.findByText("Content Task List");
        expectHeaderText("Lists Content", "Lists");
        await clickButton("Close list");
        await screen.findByText("Nothing Selected");
        expectHidden("Content Task List");
    });

    it("rejects when the sidebar header renderer throws", async () => {
        await expect(renderSplit({ lists: { header: ThrowingHeader } })).rejects.toThrow();
    });
});
