#!/usr/bin/env node
import { enableToolchainCompileCache } from "../dist/internal/compile-cache.js";

enableToolchainCompileCache();

const { main } = await import("../dist/dev/runner-main.js");

try {
    await main();
} catch (error) {
    console.error("[gtkx] Fatal:", error);
    process.exit(1);
}
