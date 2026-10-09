import {
    errorCode,
    errorMessage,
    exitCodeForSignal,
    formatChildProcessError,
    installGracefulShutdown,
    isPathInside,
    isPathWithin,
    Logger,
    normalizeError,
    toPosixPath,
} from "@gtkx/utils";
import { describe, expect, it } from "vitest";

describe("errors", () => {
    it("preserves errors and normalizes message-bearing values", () => {
        const original = Object.assign(new Error("missing"), { code: "ENOENT" });
        expect(normalizeError(original)).toBe(original);
        expect(errorCode(original)).toBe("ENOENT");
        expect(errorCode({ code: "ENOENT" })).toBeUndefined();
        expect(normalizeError({ message: "failed", code: "CUSTOM" })).toMatchObject({
            message: "failed",
            code: "CUSTOM",
        });
        expect(errorMessage(null)).toBe("null");
    });

    it("formats child output with diagnostics before standard output", () => {
        expect(formatChildProcessError({ stderr: Buffer.from("failed"), stdout: "details\n" })).toBe("failed\ndetails");
        expect(formatChildProcessError({ stderr: "", stdout: "" })).toBeUndefined();
        expect(formatChildProcessError(null)).toBeUndefined();
    });

    it("maps process signals to shell exit codes", () => {
        expect(exitCodeForSignal(null)).toBe(0);
        expect(exitCodeForSignal("SIGINT")).toBe(130);
        expect(exitCodeForSignal("SIGTERM")).toBe(143);
    });
});

describe("paths", () => {
    it.each([
        ["/app", false, true],
        ["/app/src", true, true],
        ["/application", false, false],
        ["/app/../outside", false, false],
    ])("checks containment of %s", (candidate, inside, within) => {
        expect(isPathInside("/app", candidate)).toBe(inside);
        expect(isPathWithin("/app", candidate)).toBe(within);
    });

    it("normalizes backslashes for module paths", () => {
        expect(toPosixPath("src\\nested\\index.ts")).toBe("src/nested/index.ts");
    });
});

describe("Logger", () => {
    it("writes namespaced messages and respects explicit debug settings", () => {
        const output: string[] = [];
        const stream = {
            write: (message: string): void => {
                output.push(message);
            },
        };
        const quiet = new Logger({ namespace: "test", stream, isDebugEnabled: false });
        quiet.info("loaded", { count: 2 });
        quiet.warn("warning");
        quiet.error("failed");
        quiet.debug("hidden");
        new Logger({ namespace: "test", stream, isDebugEnabled: true }).debug("visible");
        expect(output).toEqual([
            '[gtkx:test] loaded {"count":2}\n',
            "[gtkx:test] warn warning\n",
            "[gtkx:test] error failed\n",
            "[gtkx:test] visible\n",
        ]);
    });
});

it("disposes shutdown handling without removing other signal subscribers", () => {
    let shutdowns = 0;
    let notifications = 0;
    const subscriber = (): void => {
        notifications += 1;
    };
    process.on("SIGHUP", subscriber);
    const dispose = installGracefulShutdown({
        onSignal: () => {
            shutdowns += 1;
        },
    });

    try {
        dispose();
        dispose();
        process.emit("SIGHUP");
        expect(shutdowns).toBe(0);
        expect(notifications).toBe(1);
    } finally {
        dispose();
        process.off("SIGHUP", subscriber);
    }
});
