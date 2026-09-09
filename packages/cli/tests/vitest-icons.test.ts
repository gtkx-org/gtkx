import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { type CliProject, createCliProject, STORE_LIBRARIES } from "./cli-project.js";

type VitestRun = { status: number | null; stderr: string; stdout: string };
type IconExpectation = { name: string; present: boolean };

const APPLICATION_ID = "com.gtkx.cliviteicons";
const DEFAULT_APPLICATION_ID = "com.gtkx.cliviteiconsdefault";
const UNUSABLE_APPLICATION_ID = "com.gtkx.cliviteiconsbad";
const CONFIG_FILE = "gtkx.config.ts";
const VITEST_CONFIG_FILE = "vitest.config.ts";
const TEST_FILE = "icons.test.ts";
const RUN_TIMEOUT = 240_000;
const VITEST_ENTRY = fileURLToPath(new URL("../../../node_modules/vitest/vitest.mjs", import.meta.url));
const VITEST_PLUGIN_MODULE = new URL("../dist/vitest-plugin.js", import.meta.url).href;
const FONT_ASSET = join("data", "probe.woff2");
const ICON_ASSET = join("data", "application.svg");
const UNUSABLE_ICON_ASSET = join("data", "application.txt");
const THEME_DIR = join("data", "icons");
const THEME_APPS_DIR = join(THEME_DIR, "hicolor", "scalable", "apps");
const THEME_PROBE_ICON = "gtkx-icon-theme-probe";
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"/>\n';

const testProject = (name: string): string =>
    `        { plugins: [gtkx()], test: { name: ${JSON.stringify(name)}, include: [${JSON.stringify(TEST_FILE)}] } },`;

const VITEST_CONFIG = `import gtkx from ${JSON.stringify(VITEST_PLUGIN_MODULE)};

export default {
    test: {
        maxWorkers: 1,
        projects: [
${testProject("first")}
${testProject("second")}
        ],
    },
};
`;

const fontFixture = (name: string): Buffer =>
    readFileSync(fileURLToPath(new URL(`fixtures/${name}`, import.meta.url)));

const config = (applicationId: string, applicationIcon: string | null): string =>
    `export default { applicationId: "${applicationId}", libraries: ${JSON.stringify(STORE_LIBRARIES)}` +
    (applicationIcon === null ? "" : `, applicationIcon: ${JSON.stringify(applicationIcon)}`) +
    " };\n";

const iconAssertion = ({ name, present }: IconExpectation): string =>
    `    expect(iconTheme().hasIcon(${JSON.stringify(name)})).toBe(${String(present)});`;

const testSource = (title: string, expectations: IconExpectation[]): string => `import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import "./data/probe.woff2?font";

Gtk.init();

const iconTheme = (): Gtk.IconTheme => {
    const display = Gdk.Display.getDefault();

    if (display === null) {
        throw new Error("Expected a default GdkDisplay");
    }

    return Gtk.IconTheme.getForDisplay(display);
};

const stagedFontCount = (): number =>
    (process.env.XDG_DATA_DIRS ?? "")
        .split(":")
        .filter(Boolean)
        .map((directory) => join(directory, "fonts"))
        .filter((directory) => existsSync(directory))
        .flatMap((directory) => readdirSync(directory))
        .filter((name) => name.startsWith("probe-")).length;

it(${JSON.stringify(title)}, () => {
${expectations.map((entry) => iconAssertion(entry)).join("\n")}
    expect(stagedFontCount()).toBe(1);
});
`;

const runVitest = (project: CliProject): VitestRun => {
    const result = spawnSync(process.execPath, [VITEST_ENTRY, "run"], {
        cwd: project.root,
        encoding: "utf8",
        env: process.env,
        killSignal: "SIGKILL",
        timeout: RUN_TIMEOUT,
    });

    return { status: result.status, stderr: result.stderr, stdout: result.stdout };
};

const expectVitestSuccess = (run: VitestRun): void => {
    expect(run.status, `${run.stdout}${run.stderr}`).toBe(0);
};

const expectVitestFailure = (run: VitestRun): void => {
    expect(run.status, `${run.stdout}${run.stderr}`).toBe(1);
};

describe("gtkx vitest plugin (application icons)", () => {
    it("stages a configured icon file and a configured icon theme for the test workers", () => {
        using project = createCliProject({
            prefix: "gtkx-cli-vitest-icons-",
            config: config(APPLICATION_ID, ICON_ASSET),
            hasStore: true,
            files: {
                [VITEST_CONFIG_FILE]: VITEST_CONFIG,
                [ICON_ASSET]: SVG,
                [join(THEME_APPS_DIR, `${APPLICATION_ID}.svg`)]: SVG,
                [join(THEME_APPS_DIR, `${THEME_PROBE_ICON}.svg`)]: SVG,
                [FONT_ASSET]: fontFixture("probe.woff2"),
                [TEST_FILE]: testSource("finds the configured icon file by application ID", [
                    { name: APPLICATION_ID, present: true },
                ]),
            },
        });

        expectVitestSuccess(runVitest(project));

        writeFileSync(join(project.root, CONFIG_FILE), config(APPLICATION_ID, THEME_DIR));
        writeFileSync(
            join(project.root, TEST_FILE),
            testSource("finds every icon in the configured theme directory", [
                { name: APPLICATION_ID, present: true },
                { name: THEME_PROBE_ICON, present: true },
            ]),
        );

        expectVitestSuccess(runVitest(project));
    });

    it("stages the conventional icon and contributes nothing without one", () => {
        using project = createCliProject({
            prefix: "gtkx-cli-vitest-icons-default-",
            config: config(DEFAULT_APPLICATION_ID, null),
            hasStore: true,
            files: {
                [VITEST_CONFIG_FILE]: VITEST_CONFIG,
                [FONT_ASSET]: fontFixture("probe.woff2"),
                [TEST_FILE]: testSource("leaves the icon theme without an application icon", [
                    { name: DEFAULT_APPLICATION_ID, present: false },
                ]),
            },
        });

        expectVitestSuccess(runVitest(project));

        writeFileSync(join(project.root, `${DEFAULT_APPLICATION_ID}.svg`), SVG);
        writeFileSync(
            join(project.root, TEST_FILE),
            testSource("finds the conventional icon by application ID", [
                { name: DEFAULT_APPLICATION_ID, present: true },
            ]),
        );

        expectVitestSuccess(runVitest(project));
    });

    it("fails the run when the configured icon cannot be used", () => {
        using project = createCliProject({
            prefix: "gtkx-cli-vitest-icons-unusable-",
            config: config(UNUSABLE_APPLICATION_ID, UNUSABLE_ICON_ASSET),
            hasStore: true,
            files: {
                [VITEST_CONFIG_FILE]: VITEST_CONFIG,
                [UNUSABLE_ICON_ASSET]: "not an icon\n",
                [FONT_ASSET]: fontFixture("probe.woff2"),
                [TEST_FILE]: testSource("does not run without a usable icon", [
                    { name: UNUSABLE_APPLICATION_ID, present: false },
                ]),
            },
        });

        expectVitestFailure(runVitest(project));
    });
});
