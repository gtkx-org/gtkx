import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { expect, test } from "vitest";

const run = promisify(execFile);
const fixture = fileURLToPath(new URL("./fixtures/scheduling.ts", import.meta.url));
const loader = new URL("../../../scripts/register-workspace-loader.ts", import.meta.url).href;

const runFixture = async (mode: string, ...args: string[]): Promise<string> => {
    const result = await run(process.execPath, ["--import", loader, fixture, mode, ...args], { timeout: 10_000 });
    return result.stdout;
};

test("runtime-supplied dispatch budgets yield to JavaScript timers under continuously ready GLib work", async () => {
    const short: unknown = JSON.parse(await runFixture("budget", "0.1"));
    const long: unknown = JSON.parse(await runFixture("budget", "12"));

    expect(short).toEqual({ firstTurnCalls: 1, timers: 3 });
    expect(long).toHaveProperty("firstTurnCalls", expect.any(Number));
    expect(long).toHaveProperty("timers", 3);
    if (typeof long !== "object" || long === null || !("firstTurnCalls" in long)) {
        throw new Error("The scheduler fixture did not return a dispatch count");
    }
    expect(long.firstTurnCalls).toBeGreaterThan(1);
}, 20_000);

test.each([
    { mode: "timeout", title: "dispatches idle and delayed GLib sources", output: '["idle","timeout"]' },
    { mode: "quit", title: "quits safely from inside a GLib dispatch", output: "QUIT" },
    {
        mode: "descriptors",
        title: "tracks removed, reused, closed, and unwatchable descriptors",
        output: '["first","reused","closed","unwatchable"]',
    },
    {
        mode: "workers",
        title: "rejects competing workers and reacquires the context after termination",
        output: "REACQUIRED",
    },
    { mode: "invalid-budget", title: "rejects invalid budgets before acquiring the context", output: "REJECTED" },
])(
    "the scheduler $title",
    async ({ mode, output }) => {
        expect(await runFixture(mode)).toBe(output);
    },
    15_000,
);
