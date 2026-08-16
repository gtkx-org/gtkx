import { describe, expect, it } from "vitest";
import { runErrorChannel } from "../helpers/native-error-channel.js";

const RUST_PANIC_LOCATION = /\.rs:\d+:\d+/;
const BENIGN_RECORD = "Gtk-WARNING";

describe("native failures reported to the app", () => {
    it("raises a GLib critical as an uncaught exception", async () => {
        const { exitCode, observed } = await runErrorChannel("critical", "observed");
        expect(observed).toContain("Gtk-CRITICAL");
        expect(exitCode).toBe(0);
    });

    it("raises a panic from a worker thread and names where it panicked", async () => {
        const { exitCode, observed } = await runErrorChannel("panic", "observed");
        expect(observed).toMatch(RUST_PANIC_LOCATION);
        expect(exitCode).toBe(0);
    });

    it("raises nothing for correct widget calls or a warning-level record", async () => {
        const { exitCode, observed, output } = await runErrorChannel("none", "observed");
        expect(output).toContain(BENIGN_RECORD);
        expect(observed).toBeUndefined();
        expect(output).toContain("SURVIVED");
        expect(exitCode).toBe(0);
    });

    it("ends the process when nothing observes the raised failure", async () => {
        const { exitCode } = await runErrorChannel("critical", "ignored");
        expect(exitCode).not.toBe(0);
    });
});
