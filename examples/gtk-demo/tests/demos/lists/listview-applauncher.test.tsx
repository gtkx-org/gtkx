import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { fireEvent, screen, userEvent, waitFor, within } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { listviewApplauncherDemo } from "../../../src/demos/lists/listview-applauncher.js";
import { renderDemo } from "../../test-utils.js";

const firstAppInfo = (): Gio.AppInfo => {
    const [first] = Gio.AppInfo.getAll();

    if (first === undefined) {
        throw new Error("expected at least one installed application");
    }

    return first;
};

const appInfoPrototype = (): Gio.AppInfo => Object.getPrototypeOf(firstAppInfo()) as Gio.AppInfo;

const activateFirstRowAndExpectLaunch = async (launchSpy: ReturnType<typeof vi.spyOn>): Promise<void> => {
    await renderDemo(listviewApplauncherDemo);
    const listView = await screen.findByName("list-view", { as: Gtk.ListView });
    await fireEvent(listView, "activate", 0);

    await waitFor(() => {
        expect(launchSpy).toHaveBeenCalled();
    });
};

describe("listviewApplauncherDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(listviewApplauncherDemo.id).toBe("listview-applauncher");
        expect(listviewApplauncherDemo.title).toBe("Lists/Application launcher");
        expect(listviewApplauncherDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(listviewApplauncherDemo.keywords)).toBe(true);
        expect(typeof listviewApplauncherDemo.sourceCode).toBe("string");
        expect(listviewApplauncherDemo.defaultWidth).toBe(640);
        expect(listviewApplauncherDemo.defaultHeight).toBe(320);
        expect(listviewApplauncherDemo.component).toBeTypeOf("function");
    });
});

describe("listviewApplauncherDemo structure", () => {
    it("wraps a single GtkListView inside a scrolled window", async () => {
        await renderDemo(listviewApplauncherDemo);
        const sw = await screen.findByName("scrolled");
        expect(sw).toBeInstanceOf(Gtk.ScrolledWindow);
        const listView = await screen.findByName("list-view");
        expect(listView).toBeInstanceOf(Gtk.ListView);
    });

    it("uses single selection mode on the list view", async () => {
        await renderDemo(listviewApplauncherDemo);
        const listView = await screen.findByName("list-view", { as: Gtk.ListView });
        const model = listView.getModel();
        expect(model).toBeInstanceOf(Gtk.SingleSelection);
    });

    it("moves the single selection to whichever row is chosen", async () => {
        await renderDemo(listviewApplauncherDemo);
        const listView = await screen.findByName("list-view", { as: Gtk.ListView });
        const model = listView.getModel() as Gtk.SingleSelection;
        await userEvent.selectOptions(listView, 0);
        expect(model).toHaveObjectProperty("selected", 0);
        await userEvent.selectOptions(listView, 1);
        expect(model).toHaveObjectProperty("selected", 1);
    });
});

describe("listviewApplauncherDemo rows", () => {
    it("renders one row per application returned by Gio.AppInfo.getAll", async () => {
        await renderDemo(listviewApplauncherDemo);
        const listView = await screen.findByName("list-view", { as: Gtk.ListView });
        const model = listView.getModel();
        expect(model).not.toBeNull();
        const expectedCount = Gio.AppInfo.getAll().length;
        expect(model).toHaveObjectProperty("nItems", expectedCount);
    });

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

    it("presents an alert dialog naming the failed app when launching throws", async () => {
        const launchSpy = vi.spyOn(appInfoPrototype(), "launch").mockImplementation(() => {
            throw new Error("denied by policy");
        });

        try {
            await activateFirstRowAndExpectLaunch(launchSpy);
            await screen.findByText("denied by policy");
            const headings = await screen.findAllByText(`Could not launch ${firstAppInfo().getDisplayName()}`);
            expect(headings.length).toBeGreaterThan(0);
        } finally {
            launchSpy.mockRestore();
        }
    });

    it("renders exactly one icon per label row through the list view factory", async () => {
        await renderDemo(listviewApplauncherDemo);
        const listView = await screen.findByName("list-view", { as: Gtk.ListView });
        const images = within(listView).getAllByRole(Gtk.AccessibleRole.IMG);
        const labels = within(listView).getAllByRole(Gtk.AccessibleRole.LABEL);
        expect(images.length).toBeGreaterThan(0);
        expect(images).toHaveLength(labels.length);
        const firstAppName = firstAppInfo().getDisplayName();
        expect(firstAppName).toBeTypeOf("string");
        expect(await within(listView).findByText(firstAppName)).toBeInstanceOf(Gtk.Label);
    });
});
