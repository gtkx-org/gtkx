import { describe, expect, it } from "vitest";
import { alloc, read, write } from "../../index.js";
import { GDK_LIB } from "./utils.js";

describe("read and write", () => {
    describe("float fields", () => {
        it("writes and reads float values at offset 0", () => {
            const rgba = alloc(16, "GdkRGBA", GDK_LIB);

            write(rgba, { type: "float", size: 32 }, 0, 0.75);
            const result = read(rgba, { type: "float", size: 32 }, 0);

            expect(result).toBeCloseTo(0.75);
        });

        it("writes and reads float values at different offsets", () => {
            const rgba = alloc(16, "GdkRGBA", GDK_LIB);

            write(rgba, { type: "float", size: 32 }, 0, 1.0);
            write(rgba, { type: "float", size: 32 }, 4, 0.5);
            write(rgba, { type: "float", size: 32 }, 8, 0.25);
            write(rgba, { type: "float", size: 32 }, 12, 0.8);

            expect(read(rgba, { type: "float", size: 32 }, 0)).toBeCloseTo(1.0);
            expect(read(rgba, { type: "float", size: 32 }, 4)).toBeCloseTo(0.5);
            expect(read(rgba, { type: "float", size: 32 }, 8)).toBeCloseTo(0.25);
            expect(read(rgba, { type: "float", size: 32 }, 12)).toBeCloseTo(0.8);
        });

        it("handles zero float values", () => {
            const rgba = alloc(16, "GdkRGBA", GDK_LIB);

            write(rgba, { type: "float", size: 32 }, 0, 0.0);
            const result = read(rgba, { type: "float", size: 32 }, 0);

            expect(result).toBe(0.0);
        });
    });

    describe("integer fields", () => {
        it("writes and reads int32 values", () => {
            const rect = alloc(16, "GdkRectangle", GDK_LIB);

            write(rect, { type: "int", size: 32, unsigned: false }, 0, 100);
            const result = read(rect, { type: "int", size: 32, unsigned: false }, 0);

            expect(result).toBe(100);
        });

        it("writes and reads multiple int32 fields at different offsets", () => {
            const rect = alloc(16, "GdkRectangle", GDK_LIB);

            write(rect, { type: "int", size: 32, unsigned: false }, 0, 10);
            write(rect, { type: "int", size: 32, unsigned: false }, 4, 20);
            write(rect, { type: "int", size: 32, unsigned: false }, 8, 640);
            write(rect, { type: "int", size: 32, unsigned: false }, 12, 480);

            expect(read(rect, { type: "int", size: 32, unsigned: false }, 0)).toBe(10);
            expect(read(rect, { type: "int", size: 32, unsigned: false }, 4)).toBe(20);
            expect(read(rect, { type: "int", size: 32, unsigned: false }, 8)).toBe(640);
            expect(read(rect, { type: "int", size: 32, unsigned: false }, 12)).toBe(480);
        });

        it("handles negative int32 values", () => {
            const rect = alloc(16, "GdkRectangle", GDK_LIB);

            write(rect, { type: "int", size: 32, unsigned: false }, 0, -50);
            const result = read(rect, { type: "int", size: 32, unsigned: false }, 0);

            expect(result).toBe(-50);
        });

        it("handles zero int32 values", () => {
            const rect = alloc(16, "GdkRectangle", GDK_LIB);

            write(rect, { type: "int", size: 32, unsigned: false }, 0, 0);
            const result = read(rect, { type: "int", size: 32, unsigned: false }, 0);

            expect(result).toBe(0);
        });
    });

    describe("edge cases", () => {
        it("overwrites existing values", () => {
            const rgba = alloc(16, "GdkRGBA", GDK_LIB);

            write(rgba, { type: "float", size: 32 }, 0, 1.0);
            expect(read(rgba, { type: "float", size: 32 }, 0)).toBeCloseTo(1.0);

            write(rgba, { type: "float", size: 32 }, 0, 0.5);
            expect(read(rgba, { type: "float", size: 32 }, 0)).toBeCloseTo(0.5);
        });

        it("reads default zero value from allocated struct", () => {
            const rgba = alloc(16, "GdkRGBA", GDK_LIB);

            const result = read(rgba, { type: "float", size: 32 }, 0);

            expect(result).toBe(0.0);
        });
    });
});
