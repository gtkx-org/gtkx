import { installGracefulShutdown } from "@gtkx/utils";
import { isMainThread } from "node:worker_threads";
import { readHeadlessOptions, resolveHeadlessOptions, startHeadlessDisplay } from "./headless-display.ts";

if (isMainThread) {
    const exit = process.exit.bind(process);
    const options = readHeadlessOptions(new URL(import.meta.url).searchParams);
    const teardown = await startHeadlessDisplay(resolveHeadlessOptions(options));

    process.on("exit", teardown);
    installGracefulShutdown({ onSignal: teardown, exit });
}
