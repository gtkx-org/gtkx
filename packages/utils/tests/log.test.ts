import { afterEach, describe, expect, it } from "vitest";
import { createLogger, Logger, type OutputStream } from "../src/log/index.js";

type Capture = OutputStream & { written: string[] };

const captureStream = (isTTY?: boolean): Capture => {
    const written: string[] = [];

    return {
        isTTY,
        written,
        write(chunk: string) {
            written.push(chunk);

            return true;
        },
    };
};

describe("Logger prefixing", () => {
    it("uses the bare [gtkx] prefix without a namespace", () => {
        const stream = captureStream();
        new Logger({ stream, isDebugEnabled: false }).info("hello");
        expect(stream.written).toEqual(["[gtkx] hello\n"]);
    });

    it("appends the namespace to the prefix", () => {
        const stream = captureStream();
        new Logger({ stream, namespace: "react", isDebugEnabled: false }).info("hello");
        expect(stream.written).toEqual(["[gtkx:react] hello\n"]);
    });

    it("creates namespaced loggers via createLogger", () => {
        const stream = captureStream();
        createLogger("runtime", { stream, isDebugEnabled: false }).info("hello");
        expect(stream.written).toEqual(["[gtkx:runtime] hello\n"]);
    });
});

describe("Logger level labels", () => {
    it("writes info with the prefix and no level label", () => {
        const stream = captureStream();
        new Logger({ stream, isDebugEnabled: false }).info("hello");
        expect(stream.written).toEqual(["[gtkx] hello\n"]);
    });

    it("prefixes warn with a warn level label", () => {
        const stream = captureStream();
        new Logger({ stream, isDebugEnabled: false }).warn("careful");
        expect(stream.written).toEqual(["[gtkx] warn careful\n"]);
    });

    it("prefixes error with an error level label", () => {
        const stream = captureStream();
        new Logger({ stream, isDebugEnabled: false }).error("boom");
        expect(stream.written).toEqual(["[gtkx] error boom\n"]);
    });

    it("appends formatted rest arguments after the message", () => {
        const stream = captureStream();
        new Logger({ stream, isDebugEnabled: false }).error("boom", { code: 1 });
        expect(stream.written).toEqual(['[gtkx] error boom {"code":1}\n']);
    });
});

describe("Logger debug gating", () => {
    it("suppresses debug when the debug flag is off", () => {
        const stream = captureStream();
        new Logger({ stream, isDebugEnabled: false }).debug("trace");
        expect(stream.written).toEqual([]);
    });

    it("writes debug when the debug flag is on", () => {
        const stream = captureStream();
        new Logger({ stream, isDebugEnabled: true }).debug("trace");
        expect(stream.written).toEqual(["[gtkx] trace\n"]);
    });
});

describe("Logger debug resolution from the environment", () => {
    const original = process.env.GTKX_DEBUG;

    afterEach(() => {
        if (original === undefined) {
            delete process.env.GTKX_DEBUG;
        } else {
            process.env.GTKX_DEBUG = original;
        }
    });

    it("enables debug for every namespace when GTKX_DEBUG=1", () => {
        process.env.GTKX_DEBUG = "1";
        const stream = captureStream();
        createLogger("react", { stream }).debug("trace");
        expect(stream.written).toEqual(["[gtkx:react] trace\n"]);
    });

    it("enables debug only for the listed namespaces", () => {
        process.env.GTKX_DEBUG = "runtime,react";
        const enabled = captureStream();
        const disabled = captureStream();
        createLogger("react", { stream: enabled }).debug("trace");
        createLogger("css", { stream: disabled }).debug("trace");
        expect(enabled.written).toEqual(["[gtkx:react] trace\n"]);
        expect(disabled.written).toEqual([]);
    });

    it("keeps debug off when GTKX_DEBUG is unset", () => {
        delete process.env.GTKX_DEBUG;
        const stream = captureStream();
        createLogger("react", { stream }).debug("trace");
        expect(stream.written).toEqual([]);
    });
});

describe("Logger coloring", () => {
    it("leaves the level label uncolored on a non-TTY stream", () => {
        const stream = captureStream(false);
        new Logger({ stream, isDebugEnabled: false }).error("boom");
        expect(stream.written[0]).toBe("[gtkx] error boom\n");
    });
});
