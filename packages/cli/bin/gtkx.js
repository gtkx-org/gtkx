#!/usr/bin/env node
import { enableToolchainCompileCache } from "../dist/internal/compile-cache.js";

enableToolchainCompileCache();

await import("../dist/cli.js");
