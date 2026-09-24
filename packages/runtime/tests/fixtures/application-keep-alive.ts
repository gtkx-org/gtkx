import * as Gio from "@gtkx/gi/gio";
import { createApplication, quitApplication, runApplication } from "@gtkx/runtime";

type Mode = "activated" | "service" | "rejected";

const mode = process.argv[2] as Mode | undefined;

if (mode === undefined) {
    throw new Error("The application keep-alive fixture requires a mode");
}

const application = createApplication(Gio.Application, {
    applicationId: `org.gtkx.keepalive.p${String(process.pid)}`,
    flags: Gio.ApplicationFlags.NON_UNIQUE,
});
application.on("activate", (): void => undefined);

if (mode === "rejected") {
    process.exitCode = runApplication(application, ["probe", "--nope"]).exitStatus;
} else {
    const argv = mode === "service" ? ["probe", "--gapplication-service"] : ["probe"];
    const result = runApplication(application, argv);
    process.exitCode = result.exitStatus;
    process.stdout.write("READY\n");
    process.stdin.once("data", () => {
        quitApplication(application);
        process.stdout.write("STOPPED\n");
    });
    process.stdin.unref();
}
