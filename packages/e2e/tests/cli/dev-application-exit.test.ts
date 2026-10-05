import { once } from "node:events";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { collectOutput } from "../helpers/child-output.js";
import { createCliProject, startCli } from "./cli-project.js";

const QUIT_COMMAND = "node_modules/quit-command";
const ENTRY = `import assert from "node:assert/strict";
import { watch } from "node:fs";
import { Application, ApplicationFlags, createApplication } from "@gtkx/gi/gio";
import { registerClass } from "@gtkx/runtime";

class StatusApplication extends Application {
    protected override vfuncLocalCommandLine(argv: string[]): [boolean, string[], number] {
        const [handled, remaining] = super.vfuncLocalCommandLine(argv);
        return [handled, remaining, 7];
    }
}

registerClass(StatusApplication, { typeName: "GtkxDevExitStatusApplication" });
const application = createApplication(StatusApplication, {
    applicationId: "org.gtkx.devexitstatus",
    flags: ApplicationFlags.NON_UNIQUE,
});
application.on("activate", () => {});
const watcher = watch("${QUIT_COMMAND}", () => {
    watcher.close();
    application.quit();
});
void application.runAsync(["status-probe"]).then((status) => {
    assert.equal(application.getIsRegistered(), false);
    assert.equal(Application.getDefault(), null);
    process.exitCode = status;
    process.stdout.write("application-completed\\n");
}).catch((cause) => {
    process.stderr.write(String(cause));
    process.exit(1);
});
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
