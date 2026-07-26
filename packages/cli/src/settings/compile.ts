import { formatChildProcessError } from "@gtkx/utils";
import { execFileSync } from "node:child_process";
import { resolveCliTool } from "../internal/resolve-cli-tool.js";

const SCHEMA_COMPILER = "glib-compile-schemas";
const SCHEMA_COMPILE_TIMEOUT_MS = 30_000;

const compileSchemas = (dir: string): void => {
    try {
        execFileSync(resolveCliTool(SCHEMA_COMPILER), ["--strict", dir], {
            stdio: ["ignore", "pipe", "pipe"],
            timeout: SCHEMA_COMPILE_TIMEOUT_MS,
            encoding: "utf8",
        });
    } catch (error) {
        const details = formatChildProcessError(error);
        const suffix = details ? `:\n${details}` : "";
        throw new Error(`glib-compile-schemas failed for ${dir}${suffix}`, { cause: error });
    }
};

export { compileSchemas };
