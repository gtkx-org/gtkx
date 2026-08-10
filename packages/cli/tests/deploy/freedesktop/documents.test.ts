import { describe, expect, it } from "vitest";
import { renderCopyright } from "../../../src/deploy/freedesktop/copyright.js";
import { renderDbusService } from "../../../src/deploy/freedesktop/dbus-service.js";
import { renderMimePackage } from "../../../src/deploy/freedesktop/mime-package.js";
import { tutorialSettings } from "../fixtures/settings.js";

describe("renderDbusService", () => {
    it("writes an absolute Exec for the installation prefix", () => {
        expect(renderDbusService(tutorialSettings(), "/usr")).toBe(
            ["[D-BUS Service]", "Name=com.gtkx.tutorial", "Exec=/usr/bin/gtkx-tutorial --gapplication-service", ""]
                .join("\n"),
        );
    });

    it("points at the flatpak prefix when packaging a flatpak", () => {
        expect(renderDbusService(tutorialSettings(), "/app")).toContain("Exec=/app/bin/gtkx-tutorial");
    });
});

describe("renderMimePackage", () => {
    it("writes nothing when the app claims no file types", () => {
        expect(renderMimePackage(tutorialSettings())).toBeNull();
    });

    it("writes one mime-type per association, with its glob", () => {
        const settings = tutorialSettings({
            fileAssociations: [{ extension: "tasks", mimeType: "application/x-tasks", description: "Task list" }],
        });

        const rendered = renderMimePackage(settings) ?? "";
        expect(rendered).toContain('<mime-info xmlns="http://www.freedesktop.org/standards/shared-mime-info">');
        expect(rendered).toContain('<mime-type type="application/x-tasks">');
        expect(rendered).toContain("<comment>Task list</comment>");
        expect(rendered).toContain('<glob pattern="*.tasks"/>');
    });
});

describe("renderCopyright", () => {
    it("writes a machine-readable Debian copyright stanza", () => {
        expect(renderCopyright(tutorialSettings())).toBe(
            [
                "Format: https://www.debian.org/doc/packaging-manuals/copyright-format/1.0/",
                "Upstream-Name: Tasks",
                "Source: https://gtkx.dev",
                "",
                "Files: *",
                "Copyright: Copyright © 2026 GTKX",
                "License: MPL-2.0",
                "",
            ].join("\n"),
        );
    });

    it("omits the source field when the app has no homepage", () => {
        expect(renderCopyright(tutorialSettings({ homepage: null }))).not.toContain("Source:");
    });
});
