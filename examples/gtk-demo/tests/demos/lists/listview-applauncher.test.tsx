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

const renderListView = async (): Promise<Gtk.ListView> => {
    await renderDemo(listviewApplauncherDemo);

    return await screen.findByName("list-view", { as: Gtk.ListView });
};

const activateFirstRowAndExpectLaunch = async (launchSpy: ReturnType<typeof vi.spyOn>): Promise<void> => {
    const listView = await renderListView();
    await fireEvent(listView, "activate", 0);

    await waitFor(() => {
        expect(launchSpy).toHaveBeenCalled();
    });
};

describe("listviewApplauncherDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(listviewApplauncherDemo.id).toBe("listview-applauncher");
        expect(listviewApplauncherDemo.title).toBe("Lists/Application launcher");
        expect(listviewApplauncherDemo.description).toContain("GtkListView widget as a fancy application launcher");
        expect(listviewApplauncherDemo.keywords).toEqual(["GtkListItemFactory", "GListModel"]);
        expect(listviewApplauncherDemo.sourceCode).toContain("const listviewApplauncherDemo: Demo = {");
        expect(listviewApplauncherDemo.defaultWidth).toBe(640);
        expect(listviewApplauncherDemo.defaultHeight).toBe(320);
        expect(listviewApplauncherDemo.component).toBeTypeOf("function");
    });
});

describe("listviewApplauncherDemo structure", () => {
    it("wraps a single GtkListView inside a scrolled window", async () => {
        await renderDemo(listviewApplauncherDemo);
        const sw = await screen.findByName("scrolled", { as: Gtk.ScrolledWindow });
        const listView = await screen.findByName("list-view", { as: Gtk.ListView });
        expect(screen.getAllByName("list-view")).toHaveLength(1);
        expect(sw).toContainElement(listView);
    });

    it("uses single selection mode on the list view", async () => {
        const listView = await renderListView();
        const model = listView.getModel();
        expect(model).toBeInstanceOf(Gtk.SingleSelection);
    });

    it("moves the single selection to whichever row is chosen", async () => {
        const listView = await renderListView();
        const model = listView.getModel() as Gtk.SingleSelection;
        await userEvent.selectOptions(listView, 0);
        expect(model).toHaveObjectProperty("selected", 0);
        await userEvent.selectOptions(listView, 1);
        expect(model).toHaveObjectProperty("selected", 1);
    });
});

describe("listviewApplauncherDemo rows", () => {
    it("renders one row per application returned by Gio.AppInfo.getAll", async () => {
        const listView = await renderListView();
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
            const [heading] = await screen.findAllByText(`Could not launch ${firstAppInfo().getDisplayName()}`);
            expect(heading).toBeRooted();
        } finally {
            launchSpy.mockRestore();
        }
    });

    it("renders exactly one icon per label row through the list view factory", async () => {
        const listView = await renderListView();
        const images = within(listView).getAllByRole(Gtk.AccessibleRole.IMG);
        const labels = within(listView).getAllByRole(Gtk.AccessibleRole.LABEL);
        expect(images.length).toBeGreaterThan(0);
        expect(images).toHaveLength(labels.length);
        await within(listView).findByText(firstAppInfo().getDisplayName());
        expect(within(listView).getAllByText(firstAppInfo().getDisplayName())).toHaveLength(1);
    });
});
