import { describe, expect, it } from "vitest";
import { Output, type OutputStream } from "../../src/internal/log.js";

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

describe("Output level labels", () => {
    it("writes info with the prefix and no level label", () => {
        const stream = captureStream();
        new Output(stream, false).info("hello");
        expect(stream.written).toEqual(["[gtkx] hello\n"]);
    });

    it("prefixes warn with a warn level label", () => {
        const stream = captureStream();
        new Output(stream, false).warn("careful");
        expect(stream.written).toEqual(["[gtkx] warn careful\n"]);
    });

    it("prefixes error with an error level label", () => {
        const stream = captureStream();
        new Output(stream, false).error("boom");
        expect(stream.written).toEqual(["[gtkx] error boom\n"]);
    });

    it("appends formatted rest arguments after the message", () => {
        const stream = captureStream();
        new Output(stream, false).error("boom", { code: 1 });
        expect(stream.written).toEqual(['[gtkx] error boom {"code":1}\n']);
    });
});

describe("Output debug gating", () => {
    it("suppresses debug when the debug flag is off", () => {
        const stream = captureStream();
        new Output(stream, false).debug("trace");
        expect(stream.written).toEqual([]);
    });

    it("writes debug when the debug flag is on", () => {
        const stream = captureStream();
        new Output(stream, true).debug("trace");
        expect(stream.written).toEqual(["[gtkx] trace\n"]);
    });
});

describe("Output coloring", () => {
    it("leaves the level label uncolored on a non-TTY stream", () => {
        const stream = captureStream(false);
        new Output(stream, false).error("boom");
        expect(stream.written[0]).toBe("[gtkx] error boom\n");
    });
});
