import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, waitFor, within } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { listviewApplauncherDemo } from "../../../src/demos/lists/listview-applauncher.js";
import { renderDemo } from "../../test-utils.js";

const TEST_APP_IDS = {
    alpha: "org.gtkx.ApplauncherAlpha.desktop",
    beta: "org.gtkx.ApplauncherBeta.desktop",
} as const;

const testAppInfo = (id: string = TEST_APP_IDS.alpha): Gio.AppInfo => {
    const appInfo = Gio.AppInfo.getAll().find((app) => app.getId() === id);

    if (appInfo === undefined) {
        throw new Error("expected the application fixture to be installed");
    }

    return appInfo;
};

const appInfoPrototype = (): Gio.AppInfo => Object.getPrototypeOf(testAppInfo()) as Gio.AppInfo;

const renderListView = async (): Promise<Gtk.ListView> => {
    await renderDemo(listviewApplauncherDemo);
    const listView = await screen.findByName("list-view", { as: Gtk.ListView });

    for (const id of Object.values(TEST_APP_IDS)) {
        await within(listView).findByText(testAppInfo(id).getDisplayName());
    }

    return listView;
};

const activateTestAppAndExpectLaunch = async (launchSpy: ReturnType<typeof vi.spyOn>): Promise<void> => {
    const listView = await renderListView();
    const appName = testAppInfo().getDisplayName();
    const row = within(listView)
        .getAllByRole(Gtk.AccessibleRole.LIST_ITEM)
        .find((candidate) => within(candidate).queryByText(appName) !== null);

    if (row === undefined) {
        throw new Error("expected the application fixture row to be rendered");
    }

    await userEvent.dblClick(row);

    await waitFor(() => {
        expect(launchSpy).toHaveBeenCalled();
    });
};

describe("listviewApplauncherDemo structure", () => {
    it("wraps a single GtkListView inside a scrolled window", async () => {
        const listView = await renderListView();
        const sw = await screen.findByName("scrolled", { as: Gtk.ScrolledWindow });
        expect(screen.getAllByName("list-view")).toHaveLength(1);
        expect(sw).toContainElement(listView);
    });
});

describe("listviewApplauncherDemo rows", () => {
    it("launches the activated app's AppInfo with a launch context", async () => {
        const launchSpy = vi.spyOn(appInfoPrototype(), "launch").mockReturnValue(true);

        try {
            await activateTestAppAndExpectLaunch(launchSpy);
            expect(launchSpy).toHaveBeenCalledWith(null, expect.any(Gio.AppLaunchContext));
            const launchedOn = launchSpy.mock.instances[0] as Gio.AppInfo;
            expect(launchedOn.getId()).toBe(TEST_APP_IDS.alpha);
        } finally {
            launchSpy.mockRestore();
        }
    });

    it("presents an alert dialog when launching throws", async () => {
        const launchSpy = vi.spyOn(appInfoPrototype(), "launch").mockImplementation(() => {
            throw new Error("denied by policy");
        });

        try {
            await activateTestAppAndExpectLaunch(launchSpy);
            expect(await screen.findByRole(Gtk.AccessibleRole.ALERT_DIALOG)).toBeRooted();
        } finally {
            launchSpy.mockRestore();
        }
    });
});
