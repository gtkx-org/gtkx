import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { describe, expect, it } from "vitest";

const EXAMPLE_DIR = join(import.meta.dirname, "..");

const only = (candidates: string[], what: string): string => {
    if (candidates.length !== 1) throw new Error(`expected one ${what}, found ${candidates.length}`);
    return candidates[0];
};

const readLines = (path: string): string[] =>
    readFileSync(join(EXAMPLE_DIR, path), "utf8")
        .split("\n")
        .map((line) => line.trim());

const keyFile = (path: string): Map<string, string> =>
    new Map(
        readLines(path)
            .filter((line) => line.includes("="))
            .map((line): [string, string] => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
    );

const manifestName = only(
    readdirSync(join(EXAMPLE_DIR, "flatpak")).filter((name) => name.endsWith(".yaml")),
    "manifest",
);

const manifest = readLines(join("flatpak", manifestName));

const declaration = (key: string): string => {
    const line = manifest.find((entry) => entry.startsWith(`${key}: `));
    if (line === undefined) throw new Error(`the manifest declares no ${key}`);
    return line.slice(key.length + 2).replaceAll('"', "");
};

const installs = new Map(
    manifest
        .map((line) => line.split(" "))
        .filter((words) => words.length === 5 && words[0] === "-" && words[1] === "install")
        .map((words): [string, string] => [words[4], words[3]]),
);

const sourceOf = (destination: string): string => {
    const source = installs.get(destination);
    if (source === undefined) throw new Error(`the manifest installs nothing at ${destination}`);
    return source;
};

const exportedUnder = (directory: string, extension: string): string[] =>
    [...installs.keys()].filter((path) => path.startsWith(directory) && path.endsWith(extension));

const COMMAND = declaration("command");
const BINARY = `/app/bin/${COMMAND}`;
const DESKTOP_ENTRY = only(exportedUnder("/app/share/applications/", ".desktop"), "exported desktop entry");
const SERVICE = `/app/share/dbus-1/services/${basename(DESKTOP_ENTRY, ".desktop")}.service`;

describe("the flatpak packaging", () => {
    it("installs the binary the manifest's command names", () => {
        expect([...installs.keys()]).toContain(BINARY);
    });

    it("promises D-Bus activation from the desktop entry it exports", () => {
        const entry = keyFile(sourceOf(DESKTOP_ENTRY));

        expect(entry.get("Exec")).toBe(COMMAND);
        expect(entry.get("DBusActivatable")).toBe("true");
    });

    it("exports the service file that promise requires", () => {
        expect([...installs.keys()]).toContain(SERVICE);
    });

    it("activates the installed binary through that service file", () => {
        const path = sourceOf(SERVICE);
        const service = keyFile(path);

        expect(readLines(path)).toContain("[D-BUS Service]");
        expect(service.get("Name")).toBe(basename(SERVICE, ".service"));
        expect(service.get("Exec")).toBe(`${BINARY} --gapplication-service`);
    });

    it("installs only metadata the example ships", () => {
        const shipped = [...installs.values()].filter((path) => path.startsWith("flatpak/") || path.startsWith("data/"));

        expect(shipped.filter((path) => !existsSync(join(EXAMPLE_DIR, path)))).toEqual([]);
    });
});
