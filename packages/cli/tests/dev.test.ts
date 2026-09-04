import type { ChildProcess } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
    type CliProject,
    createCliProject,
    type DisposableCliProject,
    removeCliProject,
    runCli,
    startCli,
    STORE_LIBRARIES,
} from "./cli-project.js";
import { isRunning, processEntries, type ProcessEntry, waitUntil } from "./process-probe.js";

type DevSession = { output: () => string; isRunning: () => boolean; stop: () => Promise<boolean> };
type DevState = { project: CliProject; session: DevSession };
type InactiveResourceIcon = { mode: "inactive" };
type ResourceIconSource = string | null | false | InactiveResourceIcon;

const INACTIVE_RESOURCE_ICON: InactiveResourceIcon = { mode: "inactive" };
const APPLICATION_ID = "com.gtkx.clidev";
const READY_MARKER = "dev-ready";
const HEADLESS_MARKER = "dev-headless-runtime";
const HEADLESS_APPLICATION_ID = "com.gtkx.clidev.headless";
const POLL_INTERVAL = 200;
const START_TIMEOUT = 120_000;
const RELOAD_TIMEOUT = 120_000;
const STOP_TIMEOUT = 15_000;
const SETTLE_DELAY = POLL_INTERVAL * 10;
const FULL_RESTART = "Full restart (process restart)";
const CATALOG_CHANGED = "Translation catalog changed";
const APPLICATION_ERROR = "Application error";
const APP_MODULE = join("src", "app.tsx");
const ENTRY_MODULE = join("src", "index.tsx");
const MESSAGES_MODULE = join("src", "messages.ts");
const RESOURCE_ICON_MODULE = join("src", "resource-icon.ts");
const FIRST_ASSET = join("data", "first.data");
const SECOND_ASSET = join("data", "second.data");
const LINGUAS = join("po", "LINGUAS");
const IT_CATALOG = join("po", "it.po");
const FR_CATALOG = join("po", "fr.po");
const POT = join("po", `${APPLICATION_ID}.pot`);
const GENERATED_I18N_RESOURCES = join("node_modules", ".gtkx", "i18n-resources.d.ts");
const ICON_ASSET = join("data", "icons", "hicolor", "scalable", "apps", `${APPLICATION_ID}.svg`);
const RESOURCE_ICON_NAME = "gtkx-dev-probe-symbolic";
const RESOURCE_ICON_PATH = `/com/gtkx/clidev/icons/scalable/actions/${RESOURCE_ICON_NAME}.svg`;

const RESOURCE_ICON_DIR = join(
    "data",
    "assets",
    "icons",
    "hicolor",
    "scalable",
    "actions",
);

const FIRST_RESOURCE_ICON_ASSET = join(RESOURCE_ICON_DIR, "first.svg");
const SECOND_RESOURCE_ICON_ASSET = join(RESOURCE_ICON_DIR, "second.svg");
const FIRST_RESOURCE_PATH = "/com/gtkx/clidev/data/first.data";

const FIRST_RESOURCE_ICON_SOURCE =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">' +
    '<title>icon-one</title><rect width="16" height="16"/></svg>\n';

const SECOND_RESOURCE_ICON_SOURCE =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">' +
    '<title>icon-two</title><rect width="16" height="16"/></svg>\n';

const RESOURCE_ICON_MODULE_SOURCE =
    "export type ResourceIconMarker = string;\n" +
    "export { default as resourceIconName } from " +
    `"../data/assets/icons/hicolor/scalable/actions/first.svg?icon=${RESOURCE_ICON_NAME}";\n`;

const ENTRY_SOURCE = `import { createRoot } from "@gtkx/react";
import { App } from "./app.js";

createRoot().render(<App />);
`;

const HEADLESS_ENTRY_SOURCE = String.raw`const runtimeDir = process.env.XDG_RUNTIME_DIR;
process.stdout.write("${HEADLESS_MARKER} " + runtimeDir + "\n");
setInterval(() => {}, 1000);
`;

const MESSAGES_SOURCE = `import { t } from "@gtkx/i18n";

export const translatedMessage = (): string => t("Plain module message");
`;

const INVALID_MESSAGES_SOURCE = `import { t } from "@gtkx/i18n";

export const translatedMessage = (key = "Plain module message"): string => t(key);
`;

const SECOND_MESSAGES_SOURCE = `import { t } from "@gtkx/i18n";

export const translatedMessage = (): string => t("Second module message");
`;

const MALFORMED_CATALOG = 'msgid "translation"\nmsgstr "translation-broken"\nmsgstr "twice"\n';

const BROKEN_SOURCE = `import { Absent } from "./absent.js";

const App = () => <Absent />;

export { App };
`;

const APP_HEAD_START = `import * as Gdk from "@gtkx/gi/gdk";
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { t } from "@gtkx/i18n";
import { GtkApplication, GtkApplicationWindow, GtkLabel } from "@gtkx/jsx/gtk";
import { readFileSync } from "node:fs";
import { useEffect } from "react";
import firstResourcePath from "../data/first.data?resource";
import firstFile from "../data/first.data?url";
import { translatedMessage } from "./messages.js";
import secondResourcePath from "../data/second.data?resource";
`;

const appBody = (translationKey: string): string => String.raw`;
const resourceText = (path: string) => Buffer.from(
    Gio.resourcesLookupData(path, Gio.ResourceLookupFlags.NONE).getData() ?? [],
).toString("utf8").trim();

const App = () => {
    useEffect(() => {
        const display = Gdk.Display.getDefault();
        const hasIcon = display !== null && Gtk.IconTheme.getForDisplay(display).hasIcon("${APPLICATION_ID}");
        let resourceIconRevision = "missing";

        try {
            resourceIconRevision = resourceText("${RESOURCE_ICON_PATH}").includes("icon-two")
                ? "icon-two"
                : "icon-one";
        } catch {}

        const hasResourceIcon = resourceIconRevision !== "missing" && display !== null &&
            Gtk.IconTheme.getForDisplay(display).hasIcon(resourceIconName);
        process.stdout.write(
            "${READY_MARKER} " + REVISION + " " + firstResourcePath + " " + resourceText(firstResourcePath) +
            " " + resourceText(secondResourcePath) + " " + readFileSync(firstFile, "utf8").trim() + " " +
            String(hasIcon) + " " + resourceIconName + " " + String(hasResourceIcon) + " " +
            resourceIconRevision + " " + t(${JSON.stringify(translationKey)}) + " " + translatedMessage() + "\n",
        );
    });

    return (
        <GtkApplication>
            <GtkApplicationWindow title="Probe">
                <GtkLabel label="probe" />
            </GtkApplicationWindow>
        </GtkApplication>
    );
};

export { App };
`;

const iconImportSource = (iconFile: ResourceIconSource): string => {
    if (iconFile !== null && typeof iconFile === "object") {
        return `if (false) void import("./resource-icon.js");\nconst resourceIconName = "${RESOURCE_ICON_NAME}";`;
    }

    if (iconFile === false) {
        return `const resourceIconName = "${RESOURCE_ICON_NAME}";`;
    }

    if (iconFile === null) {
        return 'import { resourceIconName } from "./resource-icon.js";';
    }

    return 'import type { ResourceIconMarker } from "./resource-icon.js";\n' +
        "import importedResourceIconName from " +
        `"../data/assets/icons/hicolor/scalable/actions/${iconFile}?icon=${RESOURCE_ICON_NAME}";\n` +
        "const resourceIconName: ResourceIconMarker = importedResourceIconName;";
};

const appHead = (iconFile: ResourceIconSource): string => {
    const iconImport = iconImportSource(iconFile);

    return `${APP_HEAD_START}${iconImport}\n\nconst REVISION = `;
};

const appSource = (
    revision: string,
    iconFile: ResourceIconSource = null,
    translationKey = "translation",
): string => `${appHead(iconFile)}${JSON.stringify(revision)}${appBody(translationKey)}`;

const config = (): string =>
    `export default { applicationId: "${APPLICATION_ID}", libraries: ${JSON.stringify(STORE_LIBRARIES)}, ` +
    'applicationIcon: "data/icons" };\n';

const italianCatalog = (translation: string): string => String.raw`msgid ""
msgstr ""
"Project-Id-Version: gtkx-cli-dev\n"
"PO-Revision-Date: 2026-08-26 00:00+0000\n"
"Last-Translator: GTKX Tests <tests@gtkx.dev>\n"
"Language: it\n"
"Language-Team: Italian\n"
"MIME-Version: 1.0\n"
"Content-Type: text/plain; charset=UTF-8\n"
"Content-Transfer-Encoding: 8bit\n"
"Plural-Forms: nplurals=2; plural=(n != 1);\n"

msgid "translation"
msgstr "${translation}"
`;

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const writeApp = (project: CliProject, source: string): void => {
    writeFileSync(join(project.root, APP_MODULE), source);
};

const writeAsset = (project: CliProject, source: string): void => {
    writeFileSync(join(project.root, FIRST_ASSET), source);
};

const collect = (child: ChildProcess, append: (chunk: string) => void): void => {
    child.stdout?.on("data", (chunk: Buffer) => {
        append(chunk.toString());
    });

    child.stderr?.on("data", (chunk: Buffer) => {
        append(chunk.toString());
    });
};

const exited = (child: ChildProcess): Promise<void> =>
    new Promise((resolve) => {
        child.once("exit", () => {
            resolve();
        });
    });

const startSession = (project: CliProject, args: string[], overrides: NodeJS.ProcessEnv = {}): DevSession => {
    const child = startCli(project, args, overrides);
    let buffer = "";

    collect(child, (chunk) => {
        buffer += chunk;
    });

    const isRunning = (): boolean => child.exitCode === null && child.signalCode === null;

    return {
        output: () => buffer,
        isRunning,
        stop: async () => {
            if (isRunning()) {
                child.kill("SIGTERM");
                await Promise.race([exited(child), delay(STOP_TIMEOUT)]);
            }

            return !isRunning();
        },
    };
};

const startDev = (project: CliProject): DevSession =>
    startSession(project, ["dev"], {
        LANG: "it_IT.UTF-8",
        LANGUAGE: "it",
        LC_ALL: "it_IT.UTF-8",
    });

const headlessRuntimeDir = (session: DevSession): string => {
    const prefix = `${HEADLESS_MARKER} `;
    const line = session.output().split("\n").find((candidate) => candidate.startsWith(prefix));

    if (line === undefined) {
        throw new Error("The headless dev session reported no runtime directory");
    }

    return line.slice(prefix.length).trim();
};

const headlessCompositor = (runtimeDir: string): ProcessEntry => {
    const compositor = processEntries().find((entry) =>
        entry.args[0]?.endsWith("/sway") === true && entry.args.includes(join(runtimeDir, "sway.conf")),
    );

    if (compositor === undefined) {
        throw new Error("The headless dev session has no compositor");
    }

    return compositor;
};

const isRuntimeReferenced = (runtimeDir: string): boolean =>
    processEntries().some((entry) => entry.args.some((argument) => argument.includes(runtimeDir)));

const createHeadlessDevProject = (): DisposableCliProject =>
    createCliProject({
        prefix: "gtkx-cli-dev-headless-",
        config: `export default { applicationId: "${HEADLESS_APPLICATION_ID}", codegen: false };\n`,
        files: { "src/index.ts": HEADLESS_ENTRY_SOURCE },
        hasStore: true,
    });

const waitForOutput = async (session: DevSession, needle: string, timeout: number): Promise<string> => {
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
        if (session.output().includes(needle)) {
            return session.output();
        }

        await delay(POLL_INTERVAL);
    }

    return session.output();
};

const occurrences = (source: string, needle: string): number => source.split(needle).length - 1;

const waitForOccurrences = async (
    session: DevSession,
    needle: string,
    count: number,
    timeout: number,
): Promise<string> => {
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
        if (occurrences(session.output(), needle) >= count) {
            return session.output();
        }

        await delay(POLL_INTERVAL);
    }

    return session.output();
};

const waitForFileContent = async (path: string, needle: string, timeout: number): Promise<string> => {
    const deadline = Date.now() + timeout;
    let content = "";

    while (Date.now() < deadline) {
        content = readFileSync(path, "utf8");

        if (content.includes(needle)) {
            return content;
        }

        await delay(POLL_INTERVAL);
    }

    return content;
};

const expectSingleRestart = async (state: DevState, change: () => void): Promise<string> => {
    const priorOutput = state.session.output();
    const priorRuns = occurrences(priorOutput, READY_MARKER);
    change();
    await waitForOccurrences(state.session, READY_MARKER, priorRuns + 1, RELOAD_TIMEOUT);
    await delay(SETTLE_DELAY);
    const output = state.session.output().slice(priorOutput.length);
    expect(occurrences(output, READY_MARKER)).toBe(1);
    expect(occurrences(output, FULL_RESTART)).toBe(1);
    expect(output).not.toContain(APPLICATION_ERROR);

    return output;
};

const expectCatalogRestarts = async (state: DevState): Promise<void> => {
    expect(state.session.output()).toContain("translation-one");

    const translated = await expectSingleRestart(state, () => {
        writeFileSync(join(state.project.root, IT_CATALOG), italianCatalog("translation-two"));
    });

    expect(translated).toContain(CATALOG_CHANGED);
    expect(translated).toContain("translation-two");

    const refreshed = await expectSingleRestart(state, () => {
        writeFileSync(join(state.project.root, LINGUAS), "it fr # refreshed\n");
    });

    expect(refreshed).toContain("translation-two");
    const frenchPath = join(state.project.root, FR_CATALOG);
    expect(existsSync(frenchPath)).toBe(true);
    expect(readFileSync(frenchPath, "utf8")).toContain(String.raw`"Language: fr\n"`);
};

const expectResourceIconReload = async (
    state: DevState,
    revision: string,
    iconFile: ResourceIconSource,
    iconState: string,
): Promise<void> => {
    writeApp(state.project, appSource(revision, iconFile));

    const expected = `${READY_MARKER} ${revision} ${FIRST_RESOURCE_PATH} asset-three asset-two asset-three true ` +
        `${RESOURCE_ICON_NAME} ${iconState}`;

    expect(await waitForOutput(state.session, expected, RELOAD_TIMEOUT)).toContain(expected);
};

const expectInactiveIconRecovery = async (state: DevState): Promise<void> => {
    rmSync(join(state.project.root, FIRST_RESOURCE_ICON_ASSET));

    try {
        await delay(POLL_INTERVAL * 2);
        await expectResourceIconReload(state, "icon-missing", INACTIVE_RESOURCE_ICON, "false missing");
    } finally {
        writeFileSync(join(state.project.root, FIRST_RESOURCE_ICON_ASSET), FIRST_RESOURCE_ICON_SOURCE);
        await delay(POLL_INTERVAL * 2);
    }

    await expectResourceIconReload(state, "icon-restored", null, "true icon-one");
};

const devProjectFiles = (): Record<string, string> => ({
    [ENTRY_MODULE]: ENTRY_SOURCE,
    [APP_MODULE]: appSource("one"),
    [MESSAGES_MODULE]: MESSAGES_SOURCE,
    [RESOURCE_ICON_MODULE]: RESOURCE_ICON_MODULE_SOURCE,
    [FIRST_ASSET]: "asset-one\n",
    [SECOND_ASSET]: "asset-two\n",
    [ICON_ASSET]: "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"16\" height=\"16\"/>\n",
    [FIRST_RESOURCE_ICON_ASSET]: FIRST_RESOURCE_ICON_SOURCE,
    [SECOND_RESOURCE_ICON_ASSET]: SECOND_RESOURCE_ICON_SOURCE,
    [LINGUAS]: "it\n",
    [IT_CATALOG]: italianCatalog("translation-one"),
});

const createDevProject = (): CliProject =>
    createCliProject({ prefix: "gtkx-cli-dev-", config: config(), files: devProjectFiles(), hasStore: true });

const createDevState = (): DevState => ({
    project: { root: "", nodeModules: "" },
    session: { output: () => "", isRunning: () => false, stop: () => Promise.resolve(true) },
});

describe("gtkx dev", () => {
    const state = createDevState();

    beforeAll(() => {
        state.project = createDevProject();
        state.session = startDev(state.project);
    });

    afterAll(async () => {
        await state.session.stop();
        removeCliProject(state.project);
    });

    it("starts the application, and reloads it when a component changes", async () => {
        expect(await waitForOutput(state.session, `${READY_MARKER} one`, START_TIMEOUT)).toContain(
            `${READY_MARKER} one`,
        );

        writeApp(state.project, appSource("two", null, "Source refresh"));

        expect(await waitForOutput(state.session, `${READY_MARKER} two`, RELOAD_TIMEOUT)).toContain(
            `${READY_MARKER} two`,
        );
        expect(
            await waitForFileContent(
                join(state.project.root, POT),
                'msgid "Source refresh"',
                RELOAD_TIMEOUT,
            ),
        ).toContain('msgid "Source refresh"');
        expect(
            await waitForFileContent(
                join(state.project.root, GENERATED_I18N_RESOURCES),
                "Source refresh",
                RELOAD_TIMEOUT,
            ),
        ).toContain("Source refresh");

        writeApp(state.project, appSource("two-restored"));
        expect(
            await waitForOutput(state.session, `${READY_MARKER} two-restored`, RELOAD_TIMEOUT),
        ).toContain(`${READY_MARKER} two-restored`);
    });

    it("restarts once when a source change rewrites a translation catalog", async () => {
        const output = await expectSingleRestart(state, () => {
            writeFileSync(join(state.project.root, MESSAGES_MODULE), SECOND_MESSAGES_SOURCE);
        });

        expect(output).toContain("Second module message");
        expect(output).not.toContain(CATALOG_CHANGED);
        expect(readFileSync(join(state.project.root, IT_CATALOG), "utf8")).toMatch(/^msgid "Second module message"$/m);
    });

    it("compiles translations, initializes locales, and restarts for catalog changes", async () => {
        await expectCatalogRestarts(state);
    });

    it("loads resource and filesystem assets, then reloads a changed resource", async () => {
        expect(state.session.output()).toContain(
            `${FIRST_RESOURCE_PATH} asset-one asset-two asset-one true ${RESOURCE_ICON_NAME} true icon-one`,
        );

        writeAsset(state.project, "asset-three\n");
        await delay(POLL_INTERVAL * 2);
        await expectResourceIconReload(state, "asset-refresh", "second.svg", "true icon-two");
        await expectResourceIconReload(state, "direct-restored", "first.svg", "true icon-one");
        await expectResourceIconReload(state, "child-cached", null, "true icon-one");
        await expectResourceIconReload(state, "icon-removed", false, "false missing");
        await expectInactiveIconRecovery(state);
    });

    it("stays up when a component stops compiling, and reloads it once it compiles again", async () => {
        writeApp(state.project, BROKEN_SOURCE);
        await delay(POLL_INTERVAL * 5);
        expect(state.session.isRunning()).toBe(true);
        writeApp(state.project, appSource("three"));

        const recovered = `${READY_MARKER} three ${FIRST_RESOURCE_PATH} asset-three asset-two asset-three ` +
            `true ${RESOURCE_ICON_NAME} true icon-one`;

        expect(await waitForOutput(state.session, recovered, RELOAD_TIMEOUT)).toContain(recovered);

        const priorPot = await waitForFileContent(
            join(state.project.root, POT),
            'msgid "translation"',
            RELOAD_TIMEOUT,
        );
        const priorTypes = await waitForFileContent(
            join(state.project.root, GENERATED_I18N_RESOURCES),
            '"translation": "translation"',
            RELOAD_TIMEOUT,
        );
        await expectSingleRestart(state, () => {
            writeFileSync(join(state.project.root, MESSAGES_MODULE), INVALID_MESSAGES_SOURCE);
        });

        expect(state.session.isRunning()).toBe(true);
        expect(readFileSync(join(state.project.root, POT), "utf8")).toBe(priorPot);
        expect(readFileSync(join(state.project.root, GENERATED_I18N_RESOURCES), "utf8")).toBe(priorTypes);

        const restored = await expectSingleRestart(state, () => {
            writeFileSync(join(state.project.root, MESSAGES_MODULE), MESSAGES_SOURCE);
        });

        expect(restored).not.toContain(CATALOG_CHANGED);
        expect(readFileSync(join(state.project.root, IT_CATALOG), "utf8")).toMatch(/^msgid "Plain module message"$/m);
    });

    it("stops the application when it is asked to stop", async () => {
        expect(await state.session.stop()).toBe(true);
    });
});

describe("gtkx dev --headless", () => {
    it("exits and releases its runtime directory when the compositor crashes", async () => {
        using project = createHeadlessDevProject();
        const session = startSession(project, ["dev", "--headless"]);

        try {
            await waitForOutput(session, HEADLESS_MARKER, START_TIMEOUT);
            const runtimeDir = headlessRuntimeDir(session);
            expect(existsSync(join(runtimeDir, "compositor.stderr.log"))).toBe(true);
            const compositor = headlessCompositor(runtimeDir);
            process.kill(compositor.pid, "SIGKILL");
            await waitUntil(() => !isRunning(compositor) && !session.isRunning());
            await waitUntil(() => !existsSync(runtimeDir) && !isRuntimeReferenced(runtimeDir));
            expect(session.isRunning()).toBe(false);
            expect(existsSync(runtimeDir)).toBe(false);
            expect(isRuntimeReferenced(runtimeDir)).toBe(false);
        } finally {
            await session.stop();
        }
    });
});

describe("gtkx dev (projects it refuses to start)", () => {
    it("fails when the project has no entry file", () => {
        using project = createCliProject({ prefix: "gtkx-cli-dev-broken-", config: config(), hasStore: true });

        expect(runCli(project, ["dev"]).status).not.toBe(0);
    });

    it("fails when a translation catalog cannot be merged", () => {
        using project = createCliProject({
            prefix: "gtkx-cli-dev-catalog-",
            config: config(),
            files: { ...devProjectFiles(), [IT_CATALOG]: MALFORMED_CATALOG },
            hasStore: true,
        });

        expect(runCli(project, ["dev"]).status).not.toBe(0);
    });
});
