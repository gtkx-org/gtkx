import { describe, expect, it } from "vitest";
import { alloc, read, write } from "../../index.js";
import { FLOAT32, GDK_LIB, GTK_LIB, INT32 } from "./utils.js";

describe("alloc", () => {
    it("allocates a zeroed struct for GdkRGBA", () => {
        const rgba = alloc(16, "GdkRGBA", GDK_LIB);

        expect(rgba).toBeDefined();
        expect(typeof rgba).toBe("object");
    });

    it("allocates a zeroed struct for GdkRectangle", () => {
        const rect = alloc(16, "GdkRectangle", GDK_LIB);

        expect(rect).toBeDefined();
        expect(typeof rect).toBe("object");
    });

    it("allocates a zeroed struct for GtkBorder", () => {
        const border = alloc(8, "GtkBorder", GTK_LIB);

        expect(border).toBeDefined();
        expect(typeof border).toBe("object");
    });

    it("initializes memory to zero", () => {
        const rgba = alloc(16, "GdkRGBA", GDK_LIB);

        expect(read(rgba, FLOAT32, 0)).toBe(0.0);
        expect(read(rgba, FLOAT32, 4)).toBe(0.0);
        expect(read(rgba, FLOAT32, 8)).toBe(0.0);
        expect(read(rgba, FLOAT32, 12)).toBe(0.0);
    });

    it("allocates usable memory that can be written to", () => {
        const rect = alloc(16, "GdkRectangle", GDK_LIB);

        write(rect, INT32, 0, 10);
        write(rect, INT32, 4, 20);
        write(rect, INT32, 8, 100);
        write(rect, INT32, 12, 200);

        expect(read(rect, INT32, 0)).toBe(10);
        expect(read(rect, INT32, 4)).toBe(20);
        expect(read(rect, INT32, 8)).toBe(100);
        expect(read(rect, INT32, 12)).toBe(200);
    });

    it("allocates separate memory for each call", () => {
        const rgba1 = alloc(16, "GdkRGBA", GDK_LIB);
        const rgba2 = alloc(16, "GdkRGBA", GDK_LIB);

        write(rgba1, FLOAT32, 0, 1.0);
        write(rgba2, FLOAT32, 0, 0.5);

        expect(read(rgba1, FLOAT32, 0)).toBeCloseTo(1.0);
        expect(read(rgba2, FLOAT32, 0)).toBeCloseTo(0.5);
    });
});
