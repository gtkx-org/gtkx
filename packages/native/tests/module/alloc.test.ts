import { describe, expect, it } from "vitest";
import { alloc, read, write } from "../../index.js";
import {
    allocRectangle,
    allocRgba,
    expectRectangleFields,
    readRgbaChannels,
    writeRectangleFields,
} from "./call-boxed-alloc-helpers.js";
import { FLOAT32, GTK_LIB } from "./utils.js";

describe("alloc", () => {
    it("allocates a zeroed struct for GdkRGBA", () => {
        const rgba = allocRgba();

        expect(rgba).toBeDefined();
        expect(typeof rgba).toBe("object");
    });

    it("allocates a zeroed struct for GdkRectangle", () => {
        const rect = allocRectangle();

        expect(rect).toBeDefined();
        expect(typeof rect).toBe("object");
    });

    it("allocates a zeroed struct for GtkBorder", () => {
        const border = alloc(8, "GtkBorder", GTK_LIB);

        expect(border).toBeDefined();
        expect(typeof border).toBe("object");
    });

    it("initializes memory to zero", () => {
        const rgba = allocRgba();
        const channels = readRgbaChannels(rgba);

        expect(channels.red).toBe(0.0);
        expect(channels.green).toBe(0.0);
        expect(channels.blue).toBe(0.0);
        expect(channels.alpha).toBe(0.0);
    });

    it("allocates usable memory that can be written to", () => {
        const rect = allocRectangle();

        writeRectangleFields(rect, { x: 10, y: 20, width: 100, height: 200 });

        expectRectangleFields(rect, { x: 10, y: 20, width: 100, height: 200 });
    });

    it("allocates separate memory for each call", () => {
        const rgba1 = allocRgba();
        const rgba2 = allocRgba();

        write(rgba1, FLOAT32, 0, 1.0);
        write(rgba2, FLOAT32, 0, 0.5);

        expect(read(rgba1, FLOAT32, 0)).toBeCloseTo(1.0);
        expect(read(rgba2, FLOAT32, 0)).toBeCloseTo(0.5);
    });
});
