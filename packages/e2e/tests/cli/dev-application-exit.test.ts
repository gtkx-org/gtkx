import { once } from "node:events";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { collectOutput } from "../helpers/child-output.js";
import { createCliProject, startCli } from "./cli-project.js";

const QUIT_COMMAND = "node_modules/quit-command";
const ENTRY = `import assert from "node:assert/strict";
import { watch } from "node:fs";
import { Application, ApplicationFlags } from "@gtkx/gi/gio";
import { registerClass } from "@gtkx/runtime";

class StatusApplication extends Application {
    protected override vfuncLocalCommandLine(argv: string[]): [boolean, string[], number] {
        const [handled, remaining] = super.vfuncLocalCommandLine(argv);
        return [handled, remaining, 7];
    }
}

registerClass(StatusApplication, { typeName: "GtkxDevExitStatusApplication" });
const application = new StatusApplication({
    applicationId: "org.gtkx.devexitstatus",
    flags: ApplicationFlags.NON_UNIQUE,
});
application.on("activate", () => {});
application.hold();
const watcher = watch("${QUIT_COMMAND}", () => {
    watcher.close();
    application.quit();
});
void application.runAsync(["status-probe"]).then((status) => {
    application.release();
    assert.equal(application.getIsRegistered(), false);
    assert.equal(Application.getDefault(), null);
    process.exitCode = status;
    process.stdout.write("application-completed\\n");
}).catch((cause) => {
    process.stderr.write(String(cause));
    process.exit(1);
});
`;

const reactEntry = (hasWindow: boolean): string => `import type { ApplicationWindow } from "@gtkx/gi/adw";
import { watch } from "node:fs";
import { AdwApplication, AdwApplicationWindow } from "@gtkx/jsx/adw";
import { createRoot, useApplication } from "@gtkx/react";
import { useEffect, useRef } from "react";

const hasWindow = ${String(hasWindow)};
const Work = () => {
    const application = useApplication();
    const window = useRef<ApplicationWindow | null>(null);

    useEffect(() => {
        if (!hasWindow) application.hold();

        const watcher = watch("${QUIT_COMMAND}", () => {
            watcher.close();

            if (hasWindow) window.current?.close();
            else application.release();
        });
        process.stdout.write("application-ready\\n");

        return () => {
            watcher.close();
            process.stdout.write("react-cleaned\\n");
        };
    }, [application]);

    return hasWindow ? <AdwApplicationWindow ref={window} title="Automatic exit" /> : null;
};

createRoot().render(<AdwApplication><Work /></AdwApplication>);
`;

const WINDOWLESS_ENTRY = `import { AdwApplication } from "@gtkx/jsx/adw";
import { createRoot } from "@gtkx/react";
import { useEffect } from "react";

const Work = () => {
    useEffect(() => () => process.stdout.write("react-cleaned\\n"), []);

    return null;
};

createRoot().render(<AdwApplication><Work /></AdwApplication>);
`;

it("preserves the exit status resolved after a managed application shuts down", async () => {
    using project = createCliProject({
        prefix: "gtkx-dev-application-exit-",
        config: 'export default { applicationId: "org.gtkx.devexitstatus", codegen: false };',
        hasStore: true,
        shouldShareStore: true,
        files: { "src/index.ts": ENTRY, [QUIT_COMMAND]: "" },
    });
    const child = startCli(project, ["dev"]);
    const closed = once(child, "close");
    const output = collectOutput(child);

    try {
        await expect.poll(output, { timeout: 60_000 }).toContain("HMR enabled - watching for changes...");
        writeFileSync(join(project.root, QUIT_COMMAND), "quit");
        expect(await closed).toEqual([7, null]);
        expect(output()).toContain("application-completed");
    } finally {
        child.kill("SIGTERM");
        await closed;
    }
});

it.each([
    { reason: "its last window closes", hasWindow: true },
    { reason: "its last background hold is released", hasWindow: false },
])("runs React cleanup before exiting when $reason", async ({ hasWindow }) => {
    using project = createCliProject({
        prefix: "gtkx-dev-automatic-exit-",
        config: 'export default { applicationId: "org.gtkx.devautomaticexit", codegen: false };',
        hasStore: true,
        shouldShareStore: true,
        files: { "src/index.tsx": reactEntry(hasWindow), [QUIT_COMMAND]: "" },
    });
    const child = startCli(project, ["dev"]);
    const closed = once(child, "close");
    const output = collectOutput(child);

    try {
        await expect.poll(output, { timeout: 60_000 }).toContain("HMR enabled - watching for changes...");
        await expect.poll(output, { timeout: 60_000 }).toContain("application-ready");
        expect(child.exitCode).toBeNull();
        writeFileSync(join(project.root, QUIT_COMMAND), "finish");
        expect(await closed).toEqual([0, null]);
        expect(output().match(/react-cleaned/gu)).toHaveLength(1);
    } finally {
        child.kill("SIGTERM");
        await closed;
    }
});

it("exits when a React application initially has no windows or holds", async () => {
    using project = createCliProject({
        prefix: "gtkx-dev-windowless-exit-",
        config: 'export default { applicationId: "org.gtkx.devwindowlessexit", codegen: false };',
        hasStore: true,
        files: { "src/index.tsx": WINDOWLESS_ENTRY },
    });
    const child = startCli(project, ["dev"]);
    const closed = once(child, "close");
    const output = collectOutput(child);

    try {
        await expect.poll(output, { timeout: 60_000 }).toContain("react-cleaned");
        await expect.poll(() => child.exitCode, { timeout: 5_000 }).toBe(0);
        expect(await closed).toEqual([0, null]);
        expect(output()).not.toContain("Entry did not mount an application");
    } finally {
        child.kill("SIGTERM");
        await closed;
    }
});
