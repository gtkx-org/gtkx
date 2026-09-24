import { spawnWithParentDeathSignal } from "@gtkx/utils";
import { mkdtempDisposableSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const FIXTURE = fileURLToPath(new URL("fixtures/quit-cleanup.ts", import.meta.url));
const CASES = [
    {
        title: "quits an otherwise held runtime without registered cleanup",
        mode: "empty",
        events: ["returned", "repeated"],
    },
    {
        title: "runs cleanup in registration order only once across repeated quits",
        mode: "ordered",
        events: ["first", "second", "third", "returned", "repeated"],
    },
    {
        title: "allows a cleanup callback to quit again without recursion",
        mode: "reentrant",
        events: ["first", "reentered", "second", "third", "returned", "repeated"],
    },
    {
        title: "finishes cleanup and native teardown when one callback throws",
        mode: "single-error",
        events: ["first", "second", "third", "thrown", "repeated"],
    },
    {
        title: "finishes cleanup and native teardown when multiple callbacks throw",
        mode: "multiple-errors",
        events: ["first", "second", "third", "thrown", "repeated"],
    },
];

const runFixture = async (mode: string, artifact: string): Promise<number | null> => {
    const child = spawnWithParentDeathSignal(process.execPath, [
        "--conditions=source", "--import", "tsx", FIXTURE, mode, artifact,
    ], { stdio: "ignore" });
    const closed: Promise<number | null> = new Promise((resolve, reject) => {
        child.once("error", reject);
        child.once("close", (code) => {
            resolve(code);
        });
    });
    const timeout = setTimeout(() => {
        child.kill("SIGKILL");
    }, 20_000);

    try {
        return await closed;
    } finally {
        clearTimeout(timeout);
        child.kill("SIGKILL");
    }
};

describe("public runtime quit cleanup", () => {
    it.each(CASES)("$title", async ({ mode, events }) => {
        using directory = mkdtempDisposableSync(join(tmpdir(), "gtkx-quit-cleanup-"));
        const artifact = join(directory.path, "events.json");
        expect(await runFixture(mode, artifact)).toBe(0);
        const recorded: unknown = JSON.parse(readFileSync(artifact, "utf8"));
        expect(recorded).toEqual(events);
    }, 30_000);
});
