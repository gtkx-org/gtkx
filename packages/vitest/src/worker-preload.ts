import { installGracefulShutdown, watchParentProcess } from "@gtkx/utils";
import { readHeadlessOptions, resolveHeadlessOptions, startHeadlessDisplay } from "./headless-display.ts";

watchParentProcess();

const options = readHeadlessOptions(new URL(import.meta.url).searchParams);
const teardown = await startHeadlessDisplay(resolveHeadlessOptions(options));

process.on("exit", teardown);
installGracefulShutdown({ onSignal: teardown });
