import * as Gtk from "@gtkx/gi/gtk";
import { screen, screenshot, userEvent, waitFor, within } from "@gtkx/testing";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listviewFilebrowserDemo } from "../../../src/demos/lists/listview-filebrowser.js";
import { renderDemo } from "../../test-utils.js";

const originalCwd = process.cwd();
const fixture = mkdtempSync(join(tmpdir(), "gtkx-filebrowser-"));
const directory = join(fixture, "files");
const restricted = join(directory, "restricted");

const renderFiles = async (): Promise<Gtk.GridView> => {
    await renderDemo(listviewFilebrowserDemo);
    await screen.findByText("zeta.txt");

    return screen.findByName("files-grid", { as: Gtk.GridView });
};

const openDirectory = async (name: string): Promise<void> => {
    await userEvent.dblClick(await screen.findByText(name));
};

beforeAll(() => {
    mkdirSync(join(directory, "alpha"), { recursive: true });
    mkdirSync(join(directory, "empty"));
    mkdirSync(restricted, { mode: 0o000 });
    writeFileSync(join(directory, "alpha", "inside.txt"), "child");
    writeFileSync(join(directory, "alpha.txt"), "first");
    writeFileSync(join(directory, "zeta.txt"), "last");
    process.chdir(directory);
});

afterAll(() => {
    process.chdir(originalCwd);
    chmodSync(restricted, 0o700);
    rmSync(fixture, { recursive: true });
});

describe("listviewFilebrowserDemo", () => {
    it("lists directories before files and sorts each group by name", async () => {
        const grid = await renderFiles();
        const names = within(grid).getAllByRole(Gtk.AccessibleRole.LABEL, { as: Gtk.Label })
            .map((label) => label.getText());
        expect(names).toEqual(["alpha", "empty", "restricted", "alpha.txt", "zeta.txt"]);
        expect(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Parent directory" })).toBeEnabled();
    });

    it("changes the rendered layout and shows file details through the view selector", async () => {
        const grid = await renderFiles();
        const list = await screenshot(grid);
        const switcher = await screen.findByName("view-switcher", { as: Gtk.ListView });
        await userEvent.selectOptions(switcher, 1);
        await waitFor(async () => {
            const image = await screenshot(grid);
            expect(image.data).not.toBe(list.data);
        });
        await userEvent.selectOptions(switcher, 2);
        expect(await within(grid).findByText("5 bytes")).toBeVisible();
        expect(within(grid).getAllByText("folder")).toHaveLength(3);
    });

    it("keeps the selected file while switching layouts", async () => {
        const grid = await renderFiles();
        const switcher = await screen.findByName("view-switcher", { as: Gtk.ListView });
        await userEvent.selectOptions(grid, 4);
        await waitFor(() => {
            expect(within(grid).getByRole(Gtk.AccessibleRole.GRID_CELL, { selected: true })).toHaveTextContent(
                "zeta.txt",
            );
        });
        await userEvent.selectOptions(switcher, 1);

        await waitFor(() => {
            expect(within(grid).getByRole(Gtk.AccessibleRole.GRID_CELL, { selected: true })).toHaveTextContent(
                "zeta.txt",
            );
        });
    });

    it("replaces directory contents when entering a child and returning to its parent", async () => {
        await renderFiles();
        await openDirectory("alpha");
        expect(await screen.findByText("inside.txt")).toBeVisible();
        expect(screen.queryByText("zeta.txt")).toBeNull();
        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Parent directory" }));
        expect(await screen.findByText("zeta.txt")).toBeVisible();
        expect(screen.queryByText("inside.txt")).toBeNull();
    });

    it("shows an empty directory without retaining the previous rows", async () => {
        await renderFiles();
        await openDirectory("empty");
        expect(await screen.findByText("This directory is empty")).toBeVisible();
        expect(screen.queryByName("files-grid")).toBeNull();
    });

    it("shows an error for an unreadable directory and can navigate back", async () => {
        await renderFiles();
        await openDirectory("restricted");
        expect(await screen.findByRole(Gtk.AccessibleRole.ALERT)).toBeVisible();
        expect(screen.queryByName("files-grid")).toBeNull();
        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Parent directory" }));
        expect(await screen.findByText("zeta.txt")).toBeVisible();
        expect(screen.queryByRole(Gtk.AccessibleRole.ALERT)).toBeNull();
    });

    it("disables parent navigation at the filesystem root", async () => {
        process.chdir("/");

        try {
            await renderDemo(listviewFilebrowserDemo);
            expect(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Parent directory" })).toBeDisabled();
        } finally {
            process.chdir(directory);
        }
    });
});
