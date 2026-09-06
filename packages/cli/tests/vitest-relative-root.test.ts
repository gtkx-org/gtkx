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
const FONT_ASSET = join("data", "probe.woff2");
const FONT_FIXTURE = readFileSync(fileURLToPath(new URL("fixtures/probe.woff2", import.meta.url)));

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

const stagedFonts = (process.env.XDG_DATA_DIRS ?? "")
    .split(":")
    .filter(Boolean)
    .map((directory) => join(directory, "fonts"))
    .filter((directory) => existsSync(directory))
    .flatMap((directory) => readdirSync(directory))
    .filter((name) => name.startsWith("probe-") && name.endsWith(".woff2"));

it("imports the generated bindings", () => {
    expect(GLib.MAJOR_VERSION).toBe(2);
});

it("reads a bundled font family and stages the file where fontconfig looks", () => {
    expect(fontFamily).toBe(${JSON.stringify(FONT_FAMILY)});
    expect(stagedFonts).toHaveLength(1);
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
                [join(APP_DIR, FONT_ASSET)]: FONT_FIXTURE,
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
