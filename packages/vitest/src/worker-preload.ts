import { readHeadlessOptions, resolveHeadlessOptions, startHeadlessDisplay } from "./headless-display.ts";
import { setHeadlessTeardown } from "./headless-globals.ts";

const options = readHeadlessOptions(new URL(import.meta.url).searchParams);
const teardown = await startHeadlessDisplay(resolveHeadlessOptions(options));

process.on("exit", teardown);
setHeadlessTeardown(teardown);
