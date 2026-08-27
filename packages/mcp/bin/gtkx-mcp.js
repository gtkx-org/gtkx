#!/usr/bin/env node
import process from "node:process";
import { log, main, parseServerArgs } from "../dist/server.js";

try {
    await main(parseServerArgs(process.argv.slice(2)));
} catch (error) {
    log.error("fatal error", error);
    process.exit(1);
}
