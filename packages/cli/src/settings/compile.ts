import { runCliTool } from "../internal/run-cli-tool.js";

const SCHEMA_COMPILER = "glib-compile-schemas";
const SCHEMA_COMPILE_TIMEOUT_MS = 30_000;

const compileSchemas = (dir: string): void => {
    runCliTool({
        tool: SCHEMA_COMPILER,
        args: ["--strict", dir],
        target: dir,
        options: {
            stdio: ["ignore", "pipe", "pipe"],
            timeout: SCHEMA_COMPILE_TIMEOUT_MS,
            encoding: "utf8",
        },
    });
};

export { compileSchemas };
