import { installGracefulShutdown } from "@gtkx/utils";
import { isMainThread } from "node:worker_threads";
import { readHeadlessOptions, resolveHeadlessOptions, startHeadlessDisplay } from "./headless-display.ts";

if (isMainThread) {
    const options = readHeadlessOptions(new URL(import.meta.url).searchParams);
    const teardown = await startHeadlessDisplay(resolveHeadlessOptions(options));

    process.on("exit", teardown);
    installGracefulShutdown({ onSignal: teardown });
}
