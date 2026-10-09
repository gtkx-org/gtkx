import { onExit } from "@gtkx/runtime";
import { armParentDeath, keepAlive } from "@gtkx/runtime/internal";
import { spawn } from "node:child_process";

if (process.argv[2] === "owner") {
    const child = spawn(process.execPath, [...process.execArgv, import.meta.filename, "child"], {
        stdio: ["ignore", "inherit", "inherit"],
    });
    child.on("error", (error) => { throw error; });
    setInterval(() => undefined, 1000);
} else {
    if (!armParentDeath(process.ppid)) {
        throw new Error("The owner exited before monitoring was armed");
    }

    onExit(() => { process.stdout.write("CHILD EXITED\n"); });
    keepAlive(true);
    process.stdout.write("CHILD ARMED\n");
}
