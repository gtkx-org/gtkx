#!/usr/bin/env node
import { main } from "../dist/server.js";

try {
    await main();
} catch (error) {
    console.error("[gtkx] Fatal error:", error);
    process.exit(1);
}
