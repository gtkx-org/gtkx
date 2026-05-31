import { expect } from "vitest";
import { alloc, type NativeHandle, read, write } from "../../index.js";
import { FLOAT32, GDK_LIB, INT32 } from "./utils.js";

const BOXED_SIZE = 16;

/**
 * The four signed 32-bit fields of a `GdkRectangle`.
 */
export interface RectangleFields {
    x: number;
    y: number;
    width: number;
    height: number;
}

/**
 * The four 32-bit floating-point channels of a `GdkRGBA`.
 */
export interface RgbaChannels {
    red: number;
    green: number;
    blue: number;
    alpha: number;
}

/**
 * Allocates a zeroed `GdkRectangle` boxed value backed by GDK memory.
 */
export function allocRectangle(): NativeHandle {
    return alloc(BOXED_SIZE, "GdkRectangle", GDK_LIB);
}

/**
 * Allocates a zeroed `GdkRGBA` boxed value backed by GDK memory.
 */
export function allocRgba(): NativeHandle {
    return alloc(BOXED_SIZE, "GdkRGBA", GDK_LIB);
}

/**
 * Writes the four signed 32-bit `GdkRectangle` fields from `fields`.
 */
export function writeRectangleFields(rect: NativeHandle, fields: RectangleFields): void {
    write(rect, INT32, 0, fields.x);
    write(rect, INT32, 4, fields.y);
    write(rect, INT32, 8, fields.width);
    write(rect, INT32, 12, fields.height);
}

/**
 * Reads the four signed 32-bit `GdkRectangle` fields back as an object.
 */
export function readRectangleFields(rect: NativeHandle): RectangleFields {
    return {
        x: read(rect, INT32, 0) as number,
        y: read(rect, INT32, 4) as number,
        width: read(rect, INT32, 8) as number,
        height: read(rect, INT32, 12) as number,
    };
}

/**
 * Reads the four `GdkRectangle` fields and asserts each one equals the matching
 * value in `expected`.
 */
export function expectRectangleFields(rect: NativeHandle, expected: RectangleFields): void {
    const fields = readRectangleFields(rect);

    expect(fields.x).toBe(expected.x);
    expect(fields.y).toBe(expected.y);
    expect(fields.width).toBe(expected.width);
    expect(fields.height).toBe(expected.height);
}

/**
 * Writes the four 32-bit floating-point `GdkRGBA` channels from `channels`.
 */
export function writeRgbaChannels(rgba: NativeHandle, channels: RgbaChannels): void {
    write(rgba, FLOAT32, 0, channels.red);
    write(rgba, FLOAT32, 4, channels.green);
    write(rgba, FLOAT32, 8, channels.blue);
    write(rgba, FLOAT32, 12, channels.alpha);
}

/**
 * Reads the four 32-bit floating-point `GdkRGBA` channels back as an object.
 */
export function readRgbaChannels(rgba: NativeHandle): RgbaChannels {
    return {
        red: read(rgba, FLOAT32, 0) as number,
        green: read(rgba, FLOAT32, 4) as number,
        blue: read(rgba, FLOAT32, 8) as number,
        alpha: read(rgba, FLOAT32, 12) as number,
    };
}
