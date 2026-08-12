import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, posix } from "node:path";
import { describe, expect, it } from "vitest";

const EXAMPLE_DIR = join(import.meta.dirname, "..");

const EXPORTED_DIRECTORIES = [
    "applications",
    "appdata",
    "dbus-1/services",
    "dbus-1/system-services",
    "gnome-shell/search-providers",
    "icons",
    "metainfo",
    "mime/packages",
].map((directory) => `/app/share/${directory}/`);

const TAKES_A_VALUE = new Set(["-g", "-m", "-o", "-t", "--group", "--mode", "--owner", "--target-directory"]);

const read = (path: string): string => readFileSync(join(EXAMPLE_DIR, path), "utf8");

const lines = (path: string): string[] =>
    read(path)
        .split("\n")
        .map((line) => line.trim());

const only = (candidates: string[], what: string): string => {
    if (candidates.length !== 1) throw new Error(`expected one ${what}, found ${candidates.length}`);
    return candidates[0];
};

const unquoted = (word: string): string => (/^(".*"|'.*')$/.test(word) ? word.slice(1, -1) : word);

const words = (command: string): string[] => (command.match(/"[^"]*"|'[^']*'|\S+/g) ?? []).map(unquoted);

const installedBy = (commands: string[]): Map<string, string> => {
    const installs = new Map<string, string>();

    for (const command of commands) {
        const argv = words(command);

        if (argv[0] !== "install") continue;

        const sources: string[] = [];
        let directory = "";
        let makesDirectories = false;

        for (let index = 1; index < argv.length; index += 1) {
            const argument = argv[index];

            if (TAKES_A_VALUE.has(argument)) {
                if (argument === "-t" || argument === "--target-directory") directory = argv[index + 1] ?? "";
                index += 1;
            } else if (argument.startsWith("--target-directory=")) {
                directory = argument.slice(argument.indexOf("=") + 1);
            } else if (argument === "-d" || argument === "--directory") {
                makesDirectories = true;
            } else if (!argument.startsWith("-")) {
                sources.push(argument);
            }
        }

        if (makesDirectories) continue;

        if (directory === "" && sources.length > 1) {
            const destination = sources.pop() ?? "";

            if (sources.length === 1 && !destination.endsWith("/")) {
                installs.set(destination, sources[0]);
                continue;
            }

            directory = destination;
        }

        if (directory === "" || sources.length === 0) throw new Error(`cannot read this install command: ${command}`);

        for (const source of sources) installs.set(posix.join(directory, posix.basename(source)), source);
    }

    return installs;
};

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

const manifestName = only(
    readdirSync(join(EXAMPLE_DIR, "flatpak")).filter((name) => name.endsWith(".yaml")),
    "manifest under flatpak/",
);

const manifest = read(join("flatpak", manifestName)).split("\n");

const declaration = (key: string): string => {
    const line = manifest.find((entry) => entry.startsWith(`${key}: `));
    if (line === undefined) throw new Error(`the manifest declares no ${key}`);
    return unquoted(line.slice(key.length + 2).trim());
};

const installs = installedBy(
    manifest
        .map((line) => line.trim())
        .filter((line) => line.startsWith("- "))
        .map((line) => unquoted(line.slice(2).trim())),
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

    it("reads an install command whichever way it is written", () => {
        const rewritten = installedBy([
            "install  -D  -m 644   flatpak/app.desktop   /app/share/applications/app.desktop",
            "install -Dm644 -t /app/share/dbus-1/services flatpak/app.service",
            'install -Dm644 flatpak/app.metainfo.xml "/app/share/metainfo/app.metainfo.xml"',
            "install -Dm644 data/one.svg data/two.svg /app/share/icons/",
            "install -d /app/share/nothing",
        ]);

        expect([...rewritten]).toEqual([
            ["/app/share/applications/app.desktop", "flatpak/app.desktop"],
            ["/app/share/dbus-1/services/app.service", "flatpak/app.service"],
            ["/app/share/metainfo/app.metainfo.xml", "flatpak/app.metainfo.xml"],
            ["/app/share/icons/one.svg", "data/one.svg"],
            ["/app/share/icons/two.svg", "data/two.svg"],
        ]);
    });

    it("refuses an install command it cannot read", () => {
        expect(() => installedBy(["install -Dm644 flatpak/app.desktop"])).toThrow(/cannot read this install command/);
    });
});
