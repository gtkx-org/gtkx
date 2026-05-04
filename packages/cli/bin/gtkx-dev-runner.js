#!/usr/bin/env node
import { main } from "../dist/dev-runner.js";

try {
    await main();
} catch (error) {
    console.error("[gtkx-dev-runner] Fatal:", error);
    process.exit(1);
}
