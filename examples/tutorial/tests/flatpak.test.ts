import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const APPLICATION_ID = "com.gtkx.tutorial";
const COMMAND = "gtkx-tutorial";
const SERVICE_FILE = `${APPLICATION_ID}.service`;
const FLATPAK_DIR = join(import.meta.dirname, "..", "flatpak");
const SERVICE_INSTALL = `- install -Dm644 flatpak/${SERVICE_FILE} /app/share/dbus-1/services/${SERVICE_FILE}`;

const readLines = (name: string): string[] =>
    readFileSync(join(FLATPAK_DIR, name), "utf8").split("\n").map((line) => line.trim());

describe("the flatpak packaging", () => {
    it("promises D-Bus activation in the desktop entry", () => {
        expect(readLines(`${APPLICATION_ID}.desktop`)).toContain("DBusActivatable=true");
    });

    it("ships the D-Bus service file that promise requires", () => {
        const lines = readLines(SERVICE_FILE);
        expect(lines).toContain("[D-BUS Service]");
        expect(lines).toContain(`Name=${APPLICATION_ID}`);
        expect(lines).toContain(`Exec=/app/bin/${COMMAND} --gapplication-service`);
    });

    it("installs the service file where flatpak build-export looks for it", () => {
        expect(readLines(`${APPLICATION_ID}.yaml`)).toContain(SERVICE_INSTALL);
    });
});
