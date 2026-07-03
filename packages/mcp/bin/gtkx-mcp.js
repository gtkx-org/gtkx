#!/usr/bin/env node
import { log, main } from "../dist/server.js";

try {
    await main();
} catch (error) {
    log.error("fatal error", error);
    process.exit(1);
}
