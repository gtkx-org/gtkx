import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createCliProject, STORE_LIBRARIES } from "./cli-project.js";

const APPLICATION_ID = "com.gtkx.clirelativeroot";
const APP_DIR = "app";
const TEST_FILE = "bindings.test.ts";
const RUN_TIMEOUT = 300_000;
const VITEST_ENTRY = fileURLToPath(new URL("../../../node_modules/vitest/vitest.mjs", import.meta.url));
const VITEST_PLUGIN_MODULE = new URL("../dist/vitest-plugin.js", import.meta.url).href;
const FONT_FAMILY = "Red Hat Mono";
const NESTED_FONT_FAMILY = "Red Hat Text";
const PACKAGE_FONT_FAMILY = "Red Hat Display";
const FONT_ASSET = join("data", "probe.woff2");
const NESTED_FONT_ASSET = join("data", "probe.otf");
const PACKAGE_DIR = join("node_modules", "probe-fonts");
const NESTED_MODULE = join("src", "nested-font.ts");
const OUTSIDE_MODULE = join("outside", "fonts.ts");
const OUTSIDE_FONT_ASSET = join("outside", "probe.ttc");
const DUPLICATE_FONT_ASSET = join("extra", "probe.otf");
const DUPLICATE_MODULE = join("src", "duplicate-font.ts");

const fontFixture = (name: string): Buffer =>
    readFileSync(fileURLToPath(new URL(`fixtures/${name}`, import.meta.url)));

const PACKAGE_MANIFEST = `${JSON.stringify({
    name: "probe-fonts",
    version: "1.0.0",
    exports: { "./probe.woff": "./probe.woff" },
}, null, 4)}\n`;

const NESTED_SOURCE =
    'export { default as nestedFontFamily } from "../data/probe.otf?font";\n';

const DUPLICATE_SOURCE =
    'export { default as duplicateFontFamily } from "../extra/probe.otf?font";\n';

const OUTSIDE_SOURCE =
    'export { default as outsideFontFamily } from "./probe.ttc?font";\n';

const CONFIG =
    `export default { applicationId: "${APPLICATION_ID}", libraries: ${JSON.stringify(STORE_LIBRARIES)} };\n`;

const VITEST_CONFIG = `import gtkx from ${JSON.stringify(VITEST_PLUGIN_MODULE)};

export default { plugins: [gtkx()], test: { include: [${JSON.stringify(TEST_FILE)}], maxWorkers: 1 } };
`;

const TEST_SOURCE = `import * as GLib from "@gtkx/gi/glib";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import fontFamily from "./data/probe.woff2?font";
import packageFontFamily from "probe-fonts/probe.woff?font";
import { nestedFontFamily } from "./src/nested-font.js";
import { duplicateFontFamily } from "./src/duplicate-font.js";

const stagedFonts = (process.env.XDG_DATA_DIRS ?? "")
    .split(":")
    .filter(Boolean)
    .map((directory) => join(directory, "fonts"))
    .filter((directory) => existsSync(directory))
    .flatMap((directory) => readdirSync(directory))
    .filter((name) => name.startsWith("probe-"));

it("imports the generated bindings", () => {
    expect(GLib.MAJOR_VERSION).toBe(2);
});

it("reads a bundled font family and stages the file where fontconfig looks", () => {
    expect(fontFamily).toBe(${JSON.stringify(FONT_FAMILY)});
    expect(nestedFontFamily).toBe(${JSON.stringify(NESTED_FONT_FAMILY)});
    expect(packageFontFamily).toBe(${JSON.stringify(PACKAGE_FONT_FAMILY)});
    expect(duplicateFontFamily).toBe(${JSON.stringify(NESTED_FONT_FAMILY)});
    expect(stagedFonts).toHaveLength(3);
});

it("rejects a font import the staging scan cannot reach", async () => {
    await expect(import("../outside/fonts.js")).rejects.toThrow();
});
`;

describe("gtkx vitest plugin (a root given relative to the working directory)", () => {
    it("completes the run", () => {
        using project = createCliProject({
            prefix: "gtkx-cli-relative-root-",
            config: CONFIG,
            hasStore: true,
            files: {
                [join(APP_DIR, "gtkx.config.ts")]: CONFIG,
                [join(APP_DIR, "vitest.config.ts")]: VITEST_CONFIG,
                [join(APP_DIR, FONT_ASSET)]: fontFixture("probe.woff2"),
                [join(APP_DIR, NESTED_FONT_ASSET)]: fontFixture("probe.otf"),
                [join(APP_DIR, NESTED_MODULE)]: NESTED_SOURCE,
                [join(APP_DIR, DUPLICATE_FONT_ASSET)]: fontFixture("probe.otf"),
                [join(APP_DIR, DUPLICATE_MODULE)]: DUPLICATE_SOURCE,
                [OUTSIDE_FONT_ASSET]: fontFixture("probe.ttc"),
                [OUTSIDE_MODULE]: OUTSIDE_SOURCE,
                [join(PACKAGE_DIR, "package.json")]: PACKAGE_MANIFEST,
                [join(PACKAGE_DIR, "probe.woff")]: fontFixture("probe.woff"),
                [join(APP_DIR, TEST_FILE)]: TEST_SOURCE,
            },
        });
        const result = spawnSync(process.execPath, [VITEST_ENTRY, "run", "--root", APP_DIR], {
            cwd: project.root,
            encoding: "utf8",
            env: process.env,
            killSignal: "SIGKILL",
            timeout: RUN_TIMEOUT,
        });

        expect(result.signal).toBeNull();
        expect(result.status, `${result.stdout}${result.stderr}`).toBe(0);
    });
});
