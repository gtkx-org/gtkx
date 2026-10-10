import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { expect, test } from "vitest";

const run = promisify(execFile);
const fixture = fileURLToPath(new URL("./fixtures/bootstrap.ts", import.meta.url));
const loader = new URL("../../../scripts/register-workspace-loader.ts", import.meta.url).href;

const importBeforeWorker = async (target: string): Promise<unknown> => {
    const result = await run(process.execPath, ["--import", loader, fixture, target], { timeout: 10_000 });

    return JSON.parse(result.stdout);
};

test.each(["@gtkx/native", "@gtkx/native/internal", "@gtkx/native/internal/binding"])(
    "importing %s leaves the main context available to the runtime thread",
    async (target) => {
        expect(await importBeforeWorker(target)).toEqual({ typeName: "gint" });
    },
);

test.each(["@gtkx/runtime", "@gtkx/runtime/internal", "leaf"])(
    "importing %s initializes the runtime before module-level bindings execute",
    async (target) => {
        expect(await importBeforeWorker(target)).toHaveProperty(
            "error",
            expect.stringContaining("GTKX is already running on another thread"),
        );
    },
);
