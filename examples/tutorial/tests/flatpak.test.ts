import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, posix } from "node:path";
import { describe, expect, it } from "vitest";

const EXAMPLE_DIR = join(import.meta.dirname, "..");

const EXPORTED_DIRECTORIES = ["applications", "dbus-1/services", "icons", "metainfo"].map(
    (directory) => `/app/share/${directory}/`,
);

const INSTALL = /^install -Dm[0-7]{3} (\S+) (\S+)$/;

const read = (path: string): string => readFileSync(join(EXAMPLE_DIR, path), "utf8");

const lines = (path: string): string[] =>
    read(path)
        .split("\n")
        .map((line) => line.trim());

const keyFile = (path: string): Map<string, string> =>
    new Map(
        lines(path)
            .filter((line) => line.includes("="))
            .map((line): [string, string] => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
    );

const element = (path: string, tag: string): string => {
    const match = new RegExp(`<${tag}(?: [^>]*)?>([^<]*)</${tag}>`).exec(read(path));
    if (match === null) throw new Error(`${path} declares no <${tag}>`);
    return match[1].trim();
};

const manifests = readdirSync(join(EXAMPLE_DIR, "flatpak")).filter((name) => name.endsWith(".yaml"));

if (manifests.length !== 1) throw new Error(`expected one manifest under flatpak/, found ${manifests.length}`);

const manifest = lines(join("flatpak", manifests[0]));

const declaration = (key: string): string => {
    const line = manifest.find((entry) => entry.startsWith(`${key}: `));
    if (line === undefined) throw new Error(`the manifest declares no ${key}`);
    return line.slice(key.length + 2);
};

const installs = new Map(
    manifest
        .filter((line) => line.startsWith("- install "))
        .map((line): [string, string] => {
            const command = line.slice(2);
            const match = INSTALL.exec(command);
            if (match === null) throw new Error(`cannot read this install command: ${command}`);
            return [match[2], match[1]];
        }),
);

const sourceOf = (destination: string): string => {
    const source = installs.get(destination);
    if (source === undefined) throw new Error(`the manifest installs nothing at ${destination}`);
    return source;
};

const ID = declaration("id");
const COMMAND = declaration("command");
const BINARY = `/app/bin/${COMMAND}`;
const DESKTOP_ENTRY = `/app/share/applications/${ID}.desktop`;
const SERVICE = `/app/share/dbus-1/services/${ID}.service`;
const METAINFO = `/app/share/metainfo/${ID}.metainfo.xml`;
const SCHEMA = `/app/share/glib-2.0/schemas/${ID}.gschema.xml`;

describe("the flatpak packaging", () => {
    it("installs the binary the manifest's command names", () => {
        expect([...installs.keys()]).toContain(BINARY);
    });

    it("promises D-Bus activation from the desktop entry named after the id", () => {
        const entry = keyFile(sourceOf(DESKTOP_ENTRY));

        expect(entry.get("Exec")).toBe(COMMAND);
        expect(entry.get("Icon")).toBe(ID);
        expect(entry.get("DBusActivatable")).toBe("true");
    });

    it("exports the service file that promise requires", () => {
        expect([...installs.keys()]).toContain(SERVICE);
    });

    it("activates the installed binary through that service file", () => {
        const path = sourceOf(SERVICE);
        const service = keyFile(path);

        expect(lines(path)).toContain("[D-BUS Service]");
        expect(service.get("Name")).toBe(ID);
        expect(service.get("Exec")).toBe(`${BINARY} --gapplication-service`);
    });

    it("names every exported file after the id, since flatpak drops the rest", () => {
        const exported = [...installs.keys()].filter((path) =>
            EXPORTED_DIRECTORIES.some((directory) => path.startsWith(directory)),
        );
        const misnamed = exported
            .map((path) => posix.basename(path))
            .filter((name) => name !== ID && !name.startsWith(`${ID}.`) && !name.startsWith(`${ID}-`));

        expect(exported.length).toBeGreaterThan(0);
        expect(misnamed).toEqual([]);
    });

    it("describes that same application in the metainfo", () => {
        const path = sourceOf(METAINFO);

        expect(element(path, "id")).toBe(ID);
        expect(element(path, "launchable")).toBe(`${ID}.desktop`);
        expect(element(path, "binary")).toBe(COMMAND);
    });

    it("installs the settings schema the application reads", () => {
        expect(read(sourceOf(SCHEMA))).toContain(`<schema id="${ID}"`);
    });

    it("registers that same id when the application runs", () => {
        expect(read("gtkx.config.ts")).toContain(`applicationId: "${ID}"`);
    });

    it("installs only files the example ships", () => {
        const shipped = [...installs.values()].filter((path) => path.startsWith("flatpak/") || path.startsWith("data/"));

        expect(shipped.filter((path) => !existsSync(join(EXAMPLE_DIR, path)))).toEqual([]);
    });
});
