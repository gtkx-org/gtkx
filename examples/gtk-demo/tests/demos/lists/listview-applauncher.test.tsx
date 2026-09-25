import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, waitFor, within } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { listviewApplauncherDemo } from "../../../src/demos/lists/listview-applauncher.js";
import { renderDemo } from "../../test-utils.js";

const firstAppInfo = (): Gio.AppInfo => {
    const [first] = Gio.AppInfo.getAll()
        .filter((app) => app.shouldShow())
        .toSorted((a, b) => a.getDisplayName().localeCompare(b.getDisplayName()));

    if (first === undefined) {
        throw new Error("expected at least one installed application");
    }

    return first;
};

const appInfoPrototype = (): Gio.AppInfo => Object.getPrototypeOf(firstAppInfo()) as Gio.AppInfo;

const renderListView = async (): Promise<Gtk.ListView> => {
    await renderDemo(listviewApplauncherDemo);

    return await screen.findByName("list-view", { as: Gtk.ListView });
};

const activateFirstRowAndExpectLaunch = async (launchSpy: ReturnType<typeof vi.spyOn>): Promise<void> => {
    const listView = await renderListView();
    await within(listView).findByText(firstAppInfo().getDisplayName());
    const [row] = within(listView).getAllByRole(Gtk.AccessibleRole.LIST_ITEM);

    if (row === undefined) {
        throw new Error("expected at least one rendered application row");
    }

    await userEvent.dblClick(row);

    await waitFor(() => {
        expect(launchSpy).toHaveBeenCalled();
    });
};

describe("listviewApplauncherDemo structure", () => {
    it("wraps a single GtkListView inside a scrolled window", async () => {
        await renderDemo(listviewApplauncherDemo);
        const sw = await screen.findByName("scrolled", { as: Gtk.ScrolledWindow });
        const listView = await screen.findByName("list-view", { as: Gtk.ListView });
        expect(screen.getAllByName("list-view")).toHaveLength(1);
        expect(sw).toContainElement(listView);
    });

    it("moves the single selection to whichever row is chosen", async () => {
        const listView = await renderListView();

        await waitFor(() => {
            expect(within(listView).queryAllByRole(Gtk.AccessibleRole.LIST_ITEM).length).toBeGreaterThanOrEqual(2);
        });

        const rows = within(listView).getAllByRole(Gtk.AccessibleRole.LIST_ITEM);
        await userEvent.selectOptions(listView, 0);
        expect(within(listView).getByRole(Gtk.AccessibleRole.LIST_ITEM, { selected: true })).toBe(rows[0]);
        await userEvent.selectOptions(listView, 1);
        expect(within(listView).getByRole(Gtk.AccessibleRole.LIST_ITEM, { selected: true })).toBe(rows[1]);
    });
});

describe("listviewApplauncherDemo rows", () => {
    it("launches the activated app's AppInfo with a launch context", async () => {
        const launchSpy = vi.spyOn(appInfoPrototype(), "launch").mockReturnValue(true);

        try {
            await activateFirstRowAndExpectLaunch(launchSpy);
            expect(launchSpy).toHaveBeenCalledWith(null, expect.any(Gio.AppLaunchContext));
            const launchedOn = launchSpy.mock.instances[0] as Gio.AppInfo;
            expect(launchedOn.getId()).toBe(firstAppInfo().getId());
        } finally {
            launchSpy.mockRestore();
        }
    });

    it("presents an alert dialog when launching throws", async () => {
        const launchSpy = vi.spyOn(appInfoPrototype(), "launch").mockImplementation(() => {
            throw new Error("denied by policy");
        });

        try {
            await activateFirstRowAndExpectLaunch(launchSpy);
            expect(await screen.findByRole(Gtk.AccessibleRole.ALERT_DIALOG)).toBeRooted();
        } finally {
            launchSpy.mockRestore();
        }
    });
});
