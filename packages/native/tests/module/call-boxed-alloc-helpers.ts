import { expect } from "vitest";
import { alloc, type Handle, read, write } from "../../index.js";
import { FLOAT32, INT32 } from "./utils.js";

const BOXED_SIZE = 16;

export type RectangleFields = {
    x: number;
    y: number;
    width: number;
    height: number;
};

export type RgbaChannels = {
    red: number;
    green: number;
    blue: number;
    alpha: number;
};

export function allocRectangle(): Handle {
    return alloc(BOXED_SIZE, "GdkRectangle");
}

export function allocRgba(): Handle {
    return alloc(BOXED_SIZE, "GdkRGBA");
}

export function writeRectangleFields(rect: Handle, fields: RectangleFields): void {
    write(rect, INT32, 0, fields.x);
    write(rect, INT32, 4, fields.y);
    write(rect, INT32, 8, fields.width);
    write(rect, INT32, 12, fields.height);
}

export function readRectangleFields(rect: Handle): RectangleFields {
    return {
        x: read(rect, INT32, 0) as number,
        y: read(rect, INT32, 4) as number,
        width: read(rect, INT32, 8) as number,
        height: read(rect, INT32, 12) as number,
    };
}

export function expectRectangleFields(rect: Handle, expected: RectangleFields): void {
    const fields = readRectangleFields(rect);

    expect(fields.x).toBe(expected.x);
    expect(fields.y).toBe(expected.y);
    expect(fields.width).toBe(expected.width);
    expect(fields.height).toBe(expected.height);
}

export function writeRgbaChannels(rgba: Handle, channels: RgbaChannels): void {
    write(rgba, FLOAT32, 0, channels.red);
    write(rgba, FLOAT32, 4, channels.green);
    write(rgba, FLOAT32, 8, channels.blue);
    write(rgba, FLOAT32, 12, channels.alpha);
}

export function readRgbaChannels(rgba: Handle): RgbaChannels {
    return {
        red: read(rgba, FLOAT32, 0) as number,
        green: read(rgba, FLOAT32, 4) as number,
        blue: read(rgba, FLOAT32, 8) as number,
        alpha: read(rgba, FLOAT32, 12) as number,
    };
}
