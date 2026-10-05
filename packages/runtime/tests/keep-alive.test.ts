import type { ChildProcess } from "node:child_process";
import * as Gtk from "@gtkx/gi/gtk";
import { spawnWithParentDeathSignal } from "@gtkx/utils";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createApplicationFrom } from "./helpers/application.js";
import { collectOutput, waitForMarker } from "./helpers/child-output.js";

const FIXTURE = fileURLToPath(new URL("fixtures/application-keep-alive.ts", import.meta.url));
const TSX_LOADER = new URL("../../../scripts/tsx.ts", import.meta.url).href;
const FIXTURE_ARGS = ["--import", TSX_LOADER, FIXTURE];
const READY_MARKER = "READY";
const STOPPED_MARKER = "STOPPED";
const TIMEOUT_MS = 20_000;

const waitForClose = (child: ChildProcess): Promise<number | null> =>
    new Promise((resolve, reject) => {
        child.once("error", reject);
        child.once("close", resolve);
    });

const runHeldApplication = async (mode: "activated" | "service" | "concurrent"): Promise<string> => {
    const child = spawnWithParentDeathSignal(process.execPath, [...FIXTURE_ARGS, mode], {
        stdio: ["pipe", "pipe", "pipe"],
    });
    const read = collectOutput(child);
    const closed = waitForClose(child);

    try {
        await waitForMarker({
            child,
            read,
            marker: READY_MARKER,
            subject: "the application keep-alive fixture",
            timeoutMs: TIMEOUT_MS,
        });
        child.stdin?.end("quit\n");
        expect(await closed).toBe(0);

        return read();
    } finally {
        child.kill("SIGTERM");
    }
};

describe("Application.runAsync — holding the native loop alive", () => {
    it("holds an activated application until shutdown", async () => {
        expect(await runHeldApplication("activated")).toContain(STOPPED_MARKER);
    });

    it("holds a registered service before activation", async () => {
        expect(await runHeldApplication("service")).toContain(STOPPED_MARKER);
    });

    it("holds the remaining application after another application shuts down", async () => {
        expect(await runHeldApplication("concurrent")).toContain(STOPPED_MARKER);
    });

    it("exits naturally when command-line handling registers nothing", async () => {
        const child = spawnWithParentDeathSignal(process.execPath, [...FIXTURE_ARGS, "rejected"], {
            stdio: "ignore",
        });
        expect(await waitForClose(child)).toBe(1);
    });
});

describe("Application.quit — windows held by the application", () => {
    it("detaches every window before GLib reaches shutdown", async () => {
        const application = createApplicationFrom(Gtk.Application);
        const completion = application.runAsync(["probe"]);
        const windows = [new Gtk.ApplicationWindow({ application }), new Gtk.ApplicationWindow({ application })];
        expect(application.getWindows()).toEqual(windows);
        let windowsAtShutdown: number | null = null;

        application.on("shutdown", () => {
            windowsAtShutdown = application.getWindows().length;
        });

        application.quit();
        await expect(completion).resolves.toBe(0);
        expect(windowsAtShutdown).toBe(0);
        expect(application.getWindows()).toHaveLength(0);
    });
});
