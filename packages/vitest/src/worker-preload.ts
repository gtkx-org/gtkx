import { readHeadlessOptions, resolveHeadlessOptions, startHeadlessDisplay } from "./headless-display.js";

const options = readHeadlessOptions(new URL(import.meta.url).searchParams);
const teardown = await startHeadlessDisplay(resolveHeadlessOptions(options));

process.on("exit", teardown);
globalThis.gtkxHeadlessTeardown = teardown;
