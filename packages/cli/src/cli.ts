import { assertSupportedNodeVersion } from "@gtkx/config/internal";
import { runMain } from "citty";
import { createCommand } from "./command.js";
import { splitApplicationArgs } from "./internal/application-args.js";
import { printError } from "./internal/errors.js";
import { getInitialProcessGroupOwner, initialParentId } from "./internal/parent-process.js";

try {
    assertSupportedNodeVersion();
} catch (error) {
    printError(error);
}

const { cliArgs, applicationArgs } = splitApplicationArgs(process.argv.slice(2));
if (cliArgs[0] === "dev" || cliArgs[0] === "storybook") {
    const { armParentDeath } = await import("@gtkx/runtime/internal");
    const owner = getInitialProcessGroupOwner();
    if (!armParentDeath(initialParentId, owner?.pid, owner?.startTime)) {
        printError(new Error("The process that launched gtkx exited during startup"));
    }
}
await runMain(createCommand({ applicationArgs, onError: printError }), { rawArgs: cliArgs });
