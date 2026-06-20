import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const execFileSyncMock = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", async (importOriginal) => {
    const actual = (await importOriginal()) as typeof import("node:child_process");
    return { ...actual, execFileSync: execFileSyncMock };
});

const { resolveGirPath } = await import("../../src/codegen/gir-resolver.js");

let originalGirPath: string | undefined;

const setGirPath = (value: string | undefined): void => {
    if (value === undefined) {
        delete process.env["GTKX_GIR_PATH"];
    } else {
        process.env["GTKX_GIR_PATH"] = value;
    }
};

const enoentError = (): NodeJS.ErrnoException => {
    const error = new Error("spawn pkg-config ENOENT") as NodeJS.ErrnoException;
    error.code = "ENOENT";
    return error;
};

describe("resolveGirPath", () => {
    beforeEach(() => {
        originalGirPath = process.env["GTKX_GIR_PATH"];
        execFileSyncMock.mockReset();
        execFileSyncMock.mockImplementation(() => {
            throw enoentError();
        });
    });

    afterEach(() => {
        setGirPath(originalGirPath);
    });

    it("returns the configured paths when provided", () => {
        const result = resolveGirPath(["/custom/gir"]);
        expect(result).toContain("/custom/gir");
        expect(result.indexOf("/custom/gir")).toBe(0);
    });

    it("returns an array even when no config is given", () => {
        const result = resolveGirPath(undefined);
        expect(Array.isArray(result)).toBe(true);
    });

    it("includes paths from GTKX_GIR_PATH environment variable", () => {
        setGirPath("/env/gir1:/env/gir2");
        const result = resolveGirPath(undefined);
        expect(result).toContain("/env/gir1");
        expect(result).toContain("/env/gir2");
    });

    it("filters out empty entries from GTKX_GIR_PATH", () => {
        setGirPath("/env/gir1::/env/gir2:");
        const result = resolveGirPath(undefined);
        expect(result).not.toContain("");
        expect(result).toContain("/env/gir1");
        expect(result).toContain("/env/gir2");
    });

    it("ignores GTKX_GIR_PATH when unset", () => {
        setGirPath(undefined);
        const result = resolveGirPath(["/cfg"]);
        expect(result).toEqual(expect.arrayContaining(["/cfg"]));
    });

    it("deduplicates overlapping entries across sources", () => {
        setGirPath("/dup/path");
        const result = resolveGirPath(["/dup/path"]);
        const occurrences = result.filter((p) => p === "/dup/path").length;
        expect(occurrences).toBe(1);
    });

    it("preserves config priority over environment variable", () => {
        setGirPath("/env");
        const result = resolveGirPath(["/cfg"]);
        expect(result.indexOf("/cfg")).toBeLessThan(result.indexOf("/env"));
    });
});

describe("resolveGirPath — pkg-config invocation", () => {
    beforeEach(() => {
        originalGirPath = process.env["GTKX_GIR_PATH"];
        setGirPath(undefined);
        execFileSyncMock.mockReset();
    });

    afterEach(() => {
        setGirPath(originalGirPath);
    });

    it("ignores pkg-config when the binary is missing (ENOENT)", () => {
        execFileSyncMock.mockImplementation(() => {
            throw enoentError();
        });

        expect(() => resolveGirPath(undefined)).not.toThrow();
    });

    it("surfaces pkg-config failures with stderr included", () => {
        execFileSyncMock.mockImplementation(() => {
            const error = new Error("Command failed") as NodeJS.ErrnoException & { stderr: Buffer };
            error.code = "1";
            error.stderr = Buffer.from("Package gobject-introspection-1.0 was not found");
            throw error;
        });

        expect(() => resolveGirPath(undefined)).toThrow(/pkg-config failed/);
        expect(() => resolveGirPath(undefined)).toThrow(/gobject-introspection-1.0 was not found/);
    });
});
