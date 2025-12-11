import { AccessibleRole } from "@gtkx/ffi/gtk";
import { cleanup, render, screen, userEvent } from "@gtkx/testing";
import { afterEach, describe, expect, it } from "vitest";
import { dropDownDemo } from "../src/demos/lists/drop-down.js";
import { listBoxDemo } from "../src/demos/lists/list-box.js";

describe("Lists Demos", () => {
    afterEach(async () => {
        await cleanup();
    });

    describe("list box demo", () => {
        const ListBoxDemo = listBoxDemo.component;

        it("renders list box title", async () => {
            await render(<ListBoxDemo />);

            const title = await screen.findByText("List Box");
            expect(title).toBeDefined();
        });

        it("renders list items", async () => {
            await render(<ListBoxDemo />);

            const inbox = await screen.findByText("Inbox");
            const starred = await screen.findByText("Starred");
            const sent = await screen.findByText("Sent");
            const drafts = await screen.findByText("Drafts");
            const archive = await screen.findByText("Archive");

            expect(inbox).toBeDefined();
            expect(starred).toBeDefined();
            expect(sent).toBeDefined();
            expect(drafts).toBeDefined();
            expect(archive).toBeDefined();
        });

        it("shows item subtitles", async () => {
            await render(<ListBoxDemo />);

            const unreadMessages = await screen.findByText("23 unread messages");
            const starredItems = await screen.findByText("5 starred items");

            expect(unreadMessages).toBeDefined();
            expect(starredItems).toBeDefined();
        });

        it("shows selection info after activating item", async () => {
            await render(<ListBoxDemo />);

            const listRows = await screen.findAllByRole(AccessibleRole.LIST_ITEM);
            if (listRows.length === 0) throw new Error("No list items found");

            const firstRow = listRows[0];
            if (!firstRow) throw new Error("First row not found");

            await userEvent.activate(firstRow);

            const selectedLabel = await screen.findByText(/Selected:/);
            expect(selectedLabel).toBeDefined();
        });

        it("shows Inbox when first row is activated", async () => {
            await render(<ListBoxDemo />);

            const listRows = await screen.findAllByRole(AccessibleRole.LIST_ITEM);
            if (listRows.length === 0) throw new Error("No list items found");

            const firstRow = listRows[0];
            if (!firstRow) throw new Error("First row not found");

            await userEvent.activate(firstRow);

            const selectedLabel = await screen.findByText("Selected: Inbox");
            expect(selectedLabel).toBeDefined();
        });

        it("can select different items", async () => {
            await render(<ListBoxDemo />);

            const listRows = await screen.findAllByRole(AccessibleRole.LIST_ITEM);
            if (listRows.length < 2) throw new Error("Not enough list items found");

            const secondRow = listRows[1];
            if (!secondRow) throw new Error("Second row not found");

            await userEvent.activate(secondRow);

            const selectedLabel = await screen.findByText("Selected: Starred");
            expect(selectedLabel).toBeDefined();
        });

        it("can change selection between items", async () => {
            await render(<ListBoxDemo />);

            const listRows = await screen.findAllByRole(AccessibleRole.LIST_ITEM);
            if (listRows.length < 3) throw new Error("Not enough list items found");

            const firstRow = listRows[0];
            const thirdRow = listRows[2];

            if (!firstRow || !thirdRow) throw new Error("Rows not found");

            await userEvent.activate(firstRow);
            const inboxSelected = await screen.findByText("Selected: Inbox");
            expect(inboxSelected).toBeDefined();

            await userEvent.activate(thirdRow);
            const sentSelected = await screen.findByText("Selected: Sent");
            expect(sentSelected).toBeDefined();
        });

        it("describes selection modes", async () => {
            await render(<ListBoxDemo />);

            const selectionModes = await screen.findByText(/NONE, SINGLE, BROWSE, and MULTIPLE/);
            expect(selectionModes).toBeDefined();
        });
    });

    describe("drop down demo", () => {
        const DropDownDemo = dropDownDemo.component;

        it("renders drop down title", async () => {
            await render(<DropDownDemo />);

            const title = await screen.findByText("Drop Down");
            expect(title).toBeDefined();
        });

        it("renders description about DropDown", async () => {
            await render(<DropDownDemo />);

            const description = await screen.findByText(/GtkDropDown is a modern replacement for combo boxes/);
            expect(description).toBeDefined();
        });

        it("renders country selector dropdown", async () => {
            await render(<DropDownDemo />);

            const dropdown = await screen.findByRole(AccessibleRole.COMBO_BOX);
            expect(dropdown).toBeDefined();
        });

        it("renders country selector section", async () => {
            await render(<DropDownDemo />);

            const selectorLabel = await screen.findByText("Country Selector");
            expect(selectorLabel).toBeDefined();
        });

        it("describes DropDown features", async () => {
            await render(<DropDownDemo />);

            const featuresDescription = await screen.findByText(/custom item rendering, search\/filter/);
            expect(featuresDescription).toBeDefined();
        });
    });
});
