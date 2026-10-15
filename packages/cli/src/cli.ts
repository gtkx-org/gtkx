import { assertSupportedNodeVersion } from "@gtkx/config/internal";
import { runMain } from "citty";
import { createCommand } from "./command.js";
import { splitApplicationArgs } from "./internal/application-args.js";
import { printError } from "./internal/errors.js";

try {
    assertSupportedNodeVersion();
} catch (error) {
    printError(error);
}

const { cliArgs, applicationArgs } = splitApplicationArgs(process.argv.slice(2));
await runMain(createCommand({ applicationArgs, onError: printError }), { rawArgs: cliArgs });
