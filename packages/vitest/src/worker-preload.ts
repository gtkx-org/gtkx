import { readHeadlessOptions, resolveHeadlessOptions, startHeadlessDisplay } from "./headless-display.js";
import { setHeadlessTeardown } from "./headless-globals.js";

const options = readHeadlessOptions(new URL(import.meta.url).searchParams);
const teardown = await startHeadlessDisplay(resolveHeadlessOptions(options));

process.on("exit", teardown);
setHeadlessTeardown(teardown);
