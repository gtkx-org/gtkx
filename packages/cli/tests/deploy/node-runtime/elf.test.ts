import { describe, expect, it } from "vitest";
import { maxGlibcFloor, readElfInfo } from "../../../src/deploy/node-runtime/elf.js";
import { assertPortableNode } from "../../../src/deploy/node-runtime/guard.js";

describe("readElfInfo", () => {
    it("reads the shared libraries the running Node.js needs", () => {
        const info = readElfInfo(process.execPath);
        expect(info.needed).toContain("libc.so.6");
        expect(info.needed.length).toBeGreaterThan(1);
    });

    it("derives a plausible glibc floor", () => {
        expect(readElfInfo(process.execPath).glibcFloor).toMatch(/^\d+\.\d+$/);
    });

    it("rejects a file that is not an ELF binary", () => {
        expect(() => readElfInfo(new URL(import.meta.url).pathname)).toThrow("not an ELF binary");
    });
});

describe("maxGlibcFloor", () => {
    it("takes the highest floor across every inspected binary", () => {
        expect(maxGlibcFloor(["2.28", "2.41", null, "2.9"])).toBe("2.41");
    });

    it("compares minor versions numerically rather than as text", () => {
        expect(maxGlibcFloor(["2.9", "2.10"])).toBe("2.10");
    });

    it("returns nothing when no floor could be derived", () => {
        expect(maxGlibcFloor([null, null])).toBeNull();
    });
});

describe("assertPortableNode", () => {
    it("accepts a Node.js linked only against the base system libraries", () => {
        expect(() => {
            assertPortableNode({ needed: ["libc.so.6", "libstdc++.so.6"], glibcFloor: "2.28" }, "host");
        }).not.toThrow();
    });

    it("rejects a distribution Node.js linked against libnode", () => {
        expect(() => {
            assertPortableNode({ needed: ["libc.so.6", "libnode.so.115"], glibcFloor: "2.36" }, "host");
        }).toThrow(/libnode\.so\.115.*download/s);
    });

    it("accepts the running Node.js when it is an official build", () => {
        const info = readElfInfo(process.execPath);
        const isOfficialBuild = info.needed.every((library) => !library.startsWith("libnode"));
        expect(isOfficialBuild).toBe(true);

        expect(() => {
            assertPortableNode(info, "host");
        }).not.toThrow();
    });
});
