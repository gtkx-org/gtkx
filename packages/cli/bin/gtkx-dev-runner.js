#!/usr/bin/env node
import { main } from "../dist/dev/runner-main.js";

try {
    await main();
} catch (error) {
    console.error("[gtkx] Fatal:", error);
    process.exit(1);
}
