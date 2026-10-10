import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { collectOutput, waitForMarker } from "./helpers/child-output.js";

test("losing the owner shuts down the child runtime", async () => {
    const fixture = fileURLToPath(new URL("./fixtures/parent-death.ts", import.meta.url));
    const loader = new URL("../../../scripts/register-workspace-loader.ts", import.meta.url).href;
    const owner = spawn(process.execPath, ["--import", loader, fixture, "owner"], {
        stdio: ["ignore", "pipe", "pipe"],
    });
    const read = collectOutput(owner);
    const closed = new Promise<void>((resolve) => {
        owner.once("close", () => resolve());
    });

    try {
        await waitForMarker({
            child: owner,
            read,
            marker: "CHILD ARMED",
            subject: "parent death fixture",
            timeoutMs: 10_000,
        });
        owner.kill("SIGKILL");
        await closed;
        expect(read()).toContain("CHILD EXITED");
    } finally {
        owner.kill("SIGKILL");
    }
}, 15_000);
