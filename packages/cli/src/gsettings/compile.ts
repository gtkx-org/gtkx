import { execFileSync } from "node:child_process";
import { formatChildProcessError } from "@gtkx/utils";
import { resolveCliTool } from "../internal/resolve-cli-tool.js";

const SCHEMA_COMPILER = "glib-compile-schemas";
const SCHEMA_COMPILE_TIMEOUT_MS = 30_000;

export const compileSchemas = (dir: string): void => {
    try {
        execFileSync(resolveCliTool(SCHEMA_COMPILER), [dir], {
            stdio: ["ignore", "pipe", "pipe"],
            timeout: SCHEMA_COMPILE_TIMEOUT_MS,
            encoding: "utf-8",
        });
    } catch (error) {
        const details = formatChildProcessError(error);
        throw new Error(`glib-compile-schemas failed for ${dir}${details ? `:\n${details}` : ""}`, { cause: error });
    }
};
