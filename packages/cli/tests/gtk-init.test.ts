import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type AppProbe, probeAppProject, removeAppProject } from "./app-project.js";

const WORKSPACE_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const BUILD_TIMEOUT = 300_000;
const IMPORT_TIMEOUT = 60_000;
const OUT_DIR = "dist";
const INITIALIZED_PREFIX = "gtk-initialized=";
const INITIALIZING_NAMESPACES = ["gtk", "adw", "gtksource"];

const APP_ENTRY = String.raw`import { isInitialized } from "@gtkx/gi/gtk";
import { createRoot } from "@gtkx/react";

process.stdout.write("${INITIALIZED_PREFIX}" + String(isInitialized()) + "\n");
createRoot();
`;

const displaylessEnvironment = (): NodeJS.ProcessEnv => {
    const environment = { ...process.env };
    delete environment.DISPLAY;
    delete environment.WAYLAND_DISPLAY;

    return environment;
};

const importWithoutDisplay = (namespace: string): number | null =>
    spawnSync(process.execPath, ["--input-type=module", "--eval", `import "@gtkx/gi/${namespace}";`], {
        cwd: WORKSPACE_ROOT,
        encoding: "utf8",
        env: displaylessEnvironment(),
        timeout: IMPORT_TIMEOUT,
    }).status;

describe("the generated gi store (importing without a display)", () => {
    it.each(INITIALIZING_NAMESPACES)("imports the %s namespace where no display can be opened", (namespace) => {
        expect(importWithoutDisplay(namespace)).toBe(0);
    });
});

describe("gtkx build (initializing GTK)", () => {
    let probe: AppProbe;

    beforeAll(async () => {
        probe = await probeAppProject({
            applicationId: "com.gtkx.cliinitprobe",
            entry: APP_ENTRY,
            outDir: OUT_DIR,
            packageType: "module",
            prefix: "gtkx-bundle-init-",
        });
    }, BUILD_TIMEOUT);

    afterAll(() => {
        removeAppProject(probe.project);
    });

    it("has GTK initialized by the time the app entry runs", () => {
        expect(probe.run.stdout).toContain(`${INITIALIZED_PREFIX}true`);
        expect(probe.run.status).toBe(0);
    });
});
