import assert from "node:assert/strict";
import * as Gio from "@gtkx/gi/gio";
import { createApplication } from "@gtkx/gi/gio";

type Mode = "activated" | "service" | "rejected" | "concurrent";

const mode = process.argv[2] as Mode | undefined;

if (mode === undefined) {
    throw new Error("The application keep-alive fixture requires a mode");
}

const application = createApplication(Gio.Application, {
    applicationId: `org.gtkx.keepalive.p${String(process.pid)}`,
    flags: Gio.ApplicationFlags.NON_UNIQUE,
});
application.on("activate", (): void => undefined);

const firstApplication = mode === "concurrent"
    ? createApplication(Gio.Application, {
        applicationId: `org.gtkx.keepalive.first.p${String(process.pid)}`,
        flags: Gio.ApplicationFlags.NON_UNIQUE,
    })
    : undefined;
firstApplication?.on("activate", (): void => undefined);
const firstCompletion = firstApplication?.runAsync(["probe"]);

const argv = mode === "rejected"
    ? ["probe", "--nope"]
    : mode === "service" ? ["probe", "--gapplication-service"] : ["probe"];
const completion = application.runAsync(argv);

if (firstApplication) {
    firstApplication.quit();
    assert.equal(await firstCompletion, 0);
    assert.equal(firstApplication.getIsRegistered(), false);
    assert.equal(application.getIsRegistered(), true);
    assert.equal(Gio.Application.getDefault(), application);
}

if (mode !== "rejected") {
    setTimeout(() => {
        process.stdout.write("READY\n");
    }, 20).unref();
    process.stdin.once("data", () => {
        application.quit();
    });
    process.stdin.unref();
}

process.exitCode = await completion;

if (mode === "rejected") {
    application.quit();
}

assert.equal(application.getIsRegistered(), false);
assert.equal(Gio.Application.getDefault(), null);

if (mode !== "rejected") {
    process.stdout.write("STOPPED\n");
}
