import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { collectOutput } from "./helpers/child-output.js";

const fixture = fileURLToPath(new URL("./fixtures/foreign-thread.ts", import.meta.url));
const loader = new URL("../../../scripts/register-workspace-loader.ts", import.meta.url).href;

test("callbacks from other threads are skipped with a warning and the process keeps running", async () => {
    const child = spawn(process.execPath, ["--import", loader, fixture], {
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 30_000,
        killSignal: "SIGKILL",
    });
    const read = collectOutput(child);
    const exit = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
        child.once("error", reject);
        child.once("close", (code, signal) => resolve({ code, signal }));
    });
    const output = read();

    expect(output).not.toContain("HANDLER RAN");
    expect(output).toMatch(/signal 'handoff' on GstIdentity 0x[0-9a-f]+ was called on another thread/);
    expect(output).toMatch(/signal 'handoff' on GstFakeSink 0x[0-9a-f]+ was called on another thread/);
    expect(output).toContain("A JavaScript callback was called on another thread");
    expect(output).toContain("EOS\n");
    expect(output).toContain("THREAD RETURNED null");
    expect(output).toContain("STILL RUNNING");
    expect(exit).toEqual({ code: 0, signal: null });
});
