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

const KEY = /^([\w.-]+):(?:\s+(.*))?$/;

const QUOTED = /^"([^"]*)"$|^'([^']*)'$/;

type Value = Map<string, Value> | Value[] | string;

interface Line {
    indent: number;
    text: string;
}

interface Packaging {
    command: string;
    id: string;
    installs: Map<string, string>;
}

const read = (path: string): string => readFileSync(join(EXAMPLE_DIR, path), "utf8");

const lines = (path: string): string[] =>
    read(path)
        .split("\n")
        .map((line) => line.trim());

const unquoted = (text: string): string => {
    const value = text.trim();
    const match = QUOTED.exec(value);

    return match === null ? value : (match[1] ?? match[2]);
};

const words = (command: string): string[] => (command.match(/"[^"]*"|'[^']*'|\S+/g) ?? []).map(unquoted);

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

const readYaml = (source: string): Value => {
    const document: Line[] = source
        .split("\n")
        .filter((line) => line.trim() !== "" && !line.trim().startsWith("#"))
        .map((line) => ({ indent: line.length - line.trimStart().length, text: line.trim() }));

    let cursor = 0;

    const readBlock = (indent: number): Value =>
        document[cursor].text.startsWith("- ") ? readSequence(indent) : readMapping(indent);

    const at = (indent: number, sequence: boolean): boolean =>
        cursor < document.length &&
        document[cursor].indent === indent &&
        document[cursor].text.startsWith("- ") === sequence;

    const readChild = (indent: number): Value => {
        const next: Line | undefined = document[cursor];

        if (next === undefined) return "";
        if (next.indent > indent) return readBlock(next.indent);
        if (next.indent === indent && next.text.startsWith("- ")) return readSequence(indent);

        return "";
    };

    const readMapping = (indent: number): Map<string, Value> => {
        const entries = new Map<string, Value>();

        while (at(indent, false)) {
            const match = KEY.exec(document[cursor].text);

            if (match === null) throw new Error(`cannot read this manifest line: ${document[cursor].text}`);

            cursor += 1;
            entries.set(match[1], match[2] === undefined ? readChild(indent) : unquoted(match[2]));
        }

        return entries;
    };

    const readSequence = (indent: number): Value[] => {
        const items: Value[] = [];

        while (at(indent, true)) {
            const { text } = document[cursor];
            const content = text.slice(2).trimStart();

            if (KEY.test(content)) {
                document[cursor] = { indent: indent + text.length - content.length, text: content };
                items.push(readMapping(document[cursor].indent));
            } else {
                items.push(unquoted(content));
                cursor += 1;
            }
        }

        return items;
    };

    if (document.length === 0) throw new Error("the manifest is empty");

    const value = readBlock(document[0].indent);

    if (cursor < document.length) throw new Error(`cannot read this manifest line: ${document[cursor].text}`);

    return value;
};

const scalarsIn = (value: Value): string[] => {
    if (typeof value === "string") return [value];
    if (Array.isArray(value)) return value.flatMap(scalarsIn);
    throw new Error("a build command is not a scalar");
};

const commandsIn = (value: Value): string[] => {
    if (typeof value === "string") return [];
    if (Array.isArray(value)) return value.flatMap(commandsIn);

    return [...value].flatMap(([key, nested]) => (key === "build-commands" ? scalarsIn(nested) : commandsIn(nested)));
};

const installedBy = (commands: string[]): Map<string, string> => {
    const installs = new Map<string, string>();

    for (const command of commands) {
        const argv = words(command);

        if (argv[0] !== "install") continue;

        const operands: string[] = [];
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
                operands.push(argument);
            }
        }

        if (makesDirectories) continue;

        if (directory === "") {
            const destination = operands.pop() ?? "";

            if (operands.length === 1 && !destination.endsWith("/")) {
                installs.set(destination, operands[0]);
                continue;
            }

            directory = destination;
        }

        if (directory === "" || operands.length === 0) throw new Error(`cannot read this install command: ${command}`);

        for (const source of operands) installs.set(posix.join(directory, posix.basename(source)), source);
    }

    return installs;
};

const packagingOf = (source: string): Packaging => {
    const document = readYaml(source);

    if (!(document instanceof Map)) throw new Error("the manifest is not a mapping");

    const declaration = (key: string): string => {
        const value = document.get(key);
        if (typeof value !== "string") throw new Error(`the manifest declares no ${key}`);
        return value;
    };

    return { command: declaration("command"), id: declaration("id"), installs: installedBy(commandsIn(document)) };
};

const exportedBy = (installs: Map<string, string>): string[] =>
    [...installs.keys()].filter((path) => EXPORTED_DIRECTORIES.some((directory) => path.startsWith(directory)));

const misnamedIn = ({ id, installs }: Packaging): string[] =>
    exportedBy(installs)
        .map((path) => posix.basename(path))
        .filter((name) => name !== id && !name.startsWith(`${id}.`) && !name.startsWith(`${id}-`));

const manifests = readdirSync(join(EXAMPLE_DIR, "flatpak")).filter((name) => name.endsWith(".yaml"));

if (manifests.length !== 1) throw new Error(`expected one manifest under flatpak/, found ${manifests.length}`);

const PACKAGING = packagingOf(read(join("flatpak", manifests[0])));

const ID = PACKAGING.id;
const COMMAND = PACKAGING.command;
const BINARY = `/app/bin/${COMMAND}`;
const DESKTOP_ENTRY = `/app/share/applications/${ID}.desktop`;
const SERVICE = `/app/share/dbus-1/services/${ID}.service`;
const METAINFO = `/app/share/metainfo/${ID}.metainfo.xml`;
const SCHEMA = `/app/share/glib-2.0/schemas/${ID}.gschema.xml`;

const sourceOf = (destination: string): string => {
    const source = PACKAGING.installs.get(destination);
    if (source === undefined) throw new Error(`the manifest installs nothing at ${destination}`);
    return source;
};

describe("the flatpak packaging", () => {
    it("installs the binary the manifest's command names", () => {
        expect([...PACKAGING.installs.keys()]).toContain(BINARY);
    });

    it("promises D-Bus activation from the desktop entry named after the id", () => {
        const entry = keyFile(sourceOf(DESKTOP_ENTRY));

        expect(entry.get("Exec")).toBe(COMMAND);
        expect(entry.get("Icon")).toBe(ID);
        expect(entry.get("DBusActivatable")).toBe("true");
    });

    it("exports the service file that promise requires", () => {
        expect([...PACKAGING.installs.keys()]).toContain(SERVICE);
    });

    it("activates the installed binary through that service file", () => {
        const path = sourceOf(SERVICE);
        const service = keyFile(path);

        expect(lines(path)).toContain("[D-BUS Service]");
        expect(service.get("Name")).toBe(ID);
        expect(service.get("Exec")).toBe(`${BINARY} --gapplication-service`);
    });

    it("names every exported file after the id, since flatpak drops the rest", () => {
        expect(exportedBy(PACKAGING.installs).length).toBeGreaterThan(0);
        expect(misnamedIn(PACKAGING)).toEqual([]);
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
        const shipped = [...PACKAGING.installs.values()].filter(
            (path) => path.startsWith("flatpak/") || path.startsWith("data/"),
        );

        expect(shipped.filter((path) => !existsSync(join(EXAMPLE_DIR, path)))).toEqual([]);
    });
});

describe("reading a manifest", () => {
    const manifestWith = (commands: string[]): string =>
        [
            'id: "com.gtkx.example"',
            "command: 'example'",
            "modules:",
            "  - name: example",
            "    build-commands:",
            ...commands.map((command) => `      - ${command}`),
            "    sources:",
            "      - type: dir",
            "        path: ..",
            "        id: com.gtkx.nested",
            "        command: nested",
        ].join("\n");

    const REWRITTEN = manifestWith([
        '"install -Dm755 app /app/bin/example"',
        "install -Dm644 -t /app/share/dbus-1/services flatpak/com.gtkx.example.service",
        "install  -D  -m 644   flatpak/com.gtkx.example.desktop   /app/share/applications/com.gtkx.example.desktop",
        "install -Dm644 --target-directory=/app/share/metainfo flatpak/com.gtkx.example.metainfo.xml",
        "install -Dm644 data/com.gtkx.example.svg data/com.gtkx.example-symbolic.svg /app/share/icons/",
        "install -d /app/share/empty",
    ]);

    it("takes the id and the command from the top level, however the manifest quotes and nests them", () => {
        const packaging = packagingOf(REWRITTEN);

        expect(packaging.id).toBe("com.gtkx.example");
        expect(packaging.command).toBe("example");
    });

    it("reads an install command whichever way the manifest writes it", () => {
        expect([...packagingOf(REWRITTEN).installs]).toEqual([
            ["/app/bin/example", "app"],
            ["/app/share/dbus-1/services/com.gtkx.example.service", "flatpak/com.gtkx.example.service"],
            ["/app/share/applications/com.gtkx.example.desktop", "flatpak/com.gtkx.example.desktop"],
            ["/app/share/metainfo/com.gtkx.example.metainfo.xml", "flatpak/com.gtkx.example.metainfo.xml"],
            ["/app/share/icons/com.gtkx.example.svg", "data/com.gtkx.example.svg"],
            ["/app/share/icons/com.gtkx.example-symbolic.svg", "data/com.gtkx.example-symbolic.svg"],
        ]);
    });

    it("accepts that rewritten manifest as correctly named", () => {
        expect(misnamedIn(packagingOf(REWRITTEN))).toEqual([]);
    });

    it.each(EXPORTED_DIRECTORIES)("catches a file left on the old id under %s", (directory) => {
        const packaging = packagingOf(manifestWith([`install -Dm644 data/old.xml ${directory}com.gtkx.old.xml`]));

        expect(misnamedIn(packaging)).toEqual(["com.gtkx.old.xml"]);
    });

    it("refuses an install command it cannot read", () => {
        const manifest = manifestWith(['"install -Dm644 flatpak/com.gtkx.example.desktop"']);

        expect(() => packagingOf(manifest)).toThrow(/cannot read this install command/);
    });

    it("refuses a manifest line it cannot read", () => {
        expect(() => packagingOf("id: com.gtkx.example\nthis is not yaml\n")).toThrow(/cannot read this manifest line/);
    });
});
