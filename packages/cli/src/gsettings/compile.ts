import { execFileSync } from "node:child_process";
import { resolveCliTool } from "../internal/resolve-cli-tool.js";

const SCHEMA_COMPILER = "glib-compile-schemas";
const SCHEMA_COMPILE_TIMEOUT_MS = 30_000;

/**
 * Compiles every GSettings schema in `dir` into `gschemas.compiled` with
 * `glib-compile-schemas`, surfacing the compiler's output on failure.
 *
 * @param dir - Directory holding the `.gschema.xml` files to compile
 */
export const compileSchemas = (dir: string): void => {
    try {
        execFileSync(resolveCliTool(SCHEMA_COMPILER), [dir], {
            stdio: ["ignore", "pipe", "pipe"],
            timeout: SCHEMA_COMPILE_TIMEOUT_MS,
            encoding: "utf-8",
        });
    } catch (error) {
        const stderr = (error as { stderr?: string }).stderr ?? "";
        const stdout = (error as { stdout?: string }).stdout ?? "";
        const details = [stderr, stdout].filter(Boolean).join("\n").trim();
        throw new Error(`glib-compile-schemas failed for ${dir}${details ? `:\n${details}` : ""}`, { cause: error });
    }
};
