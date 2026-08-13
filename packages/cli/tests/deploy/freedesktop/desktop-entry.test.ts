import { describe, expect, it } from "vitest";
import { renderDesktopEntry } from "../../../src/deploy/freedesktop/desktop-entry.js";
import { tutorialSettings } from "../fixtures/settings.js";

const TUTORIAL_ENTRY = [
    "[Desktop Entry]",
    "Type=Application",
    "Name=Tasks",
    "GenericName=Task Manager",
    "Comment=Manage your tasks and to-dos",
    "Exec=gtkx-tutorial",
    "Icon=com.gtkx.tutorial",
    "Terminal=false",
    "Categories=Office;ProjectManagement;",
    "Keywords=Task;Todo;",
    "StartupNotify=true",
    "StartupWMClass=com.gtkx.tutorial",
    "",
];

const lines = (settings = tutorialSettings()): string[] => renderDesktopEntry(settings).split("\n");

describe("renderDesktopEntry", () => {
    it("writes the whole entry for the tutorial", () => {
        expect(lines()).toEqual(TUTORIAL_ENTRY);
    });

    it("never writes a Version key, which names the spec rather than the app", () => {
        expect(lines().some((line) => line.startsWith("Version="))).toBe(false);
    });

    it("appends the exec token and arguments to Exec", () => {
        const settings = tutorialSettings({ execArgs: ["--flag"], execToken: "%U" });
        expect(lines(settings)).toContain("Exec=gtkx-tutorial --flag %U");
    });

    it("lists mime types when the app declares any", () => {
        expect(lines(tutorialSettings({ mimeTypes: ["text/plain", "x-scheme-handler/tasks"] })))
            .toContain("MimeType=text/plain;x-scheme-handler/tasks;");
    });

    it("marks the entry as D-Bus activatable when configured", () => {
        expect(lines(tutorialSettings({ isDbusActivatable: true }))).toContain("DBusActivatable=true");
    });

    it("lets desktopEntry add keys", () => {
        const settings = tutorialSettings({ desktopEntry: { "X-GNOME-UsesNotifications": "true" } });
        expect(lines(settings)).toContain("X-GNOME-UsesNotifications=true");
    });

    it("lets desktopEntry override a derived key rather than duplicating it", () => {
        const rendered = lines(tutorialSettings({ desktopEntry: { Name: "Renamed" } }));
        expect(rendered).toContain("Name=Renamed");
        expect(rendered.filter((line) => line.startsWith("Name="))).toHaveLength(1);
    });

    it("rejects a desktopEntry key that deploy writes itself", () => {
        expect(() => renderDesktopEntry(tutorialSettings({ desktopEntry: { DBusActivatable: "true" } })))
            .toThrow("deploy.isDbusActivatable");
    });

    it("writes one group per desktop action, after the main group", () => {
        const settings = tutorialSettings({
            desktopActions: [{ id: "new-task", name: "New Task", args: ["--new"], icon: "list-add" }],
        });

        const rendered = lines(settings);
        expect(rendered).toContain("Actions=new-task;");
        expect(rendered).toContain("[Desktop Action new-task]");
        expect(rendered).toContain("Exec=gtkx-tutorial --new");
        expect(rendered).toContain("Icon=list-add");
        expect(rendered.indexOf("[Desktop Action new-task]")).toBeGreaterThan(rendered.indexOf("Actions=new-task;"));
    });

    it("rejects a value containing a line break", () => {
        expect(() => renderDesktopEntry(tutorialSettings({ name: "Two\nLines" }))).toThrow("line break");
    });
});
