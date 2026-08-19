import { type ExternalObject, getHandle, type Handle, read, t } from "@gtkx/runtime";
import type { PathData } from "./types.js";
import { PathDataType } from "./enums.js";

type PathBuffer = ExternalObject<Handle>;
type Point = { x: number; y: number };
type SegmentReader = (data: PathBuffer, base: number) => PathData;

const ELEMENT_SIZE = 16;
const DATA_OFFSET = 8;
const NUM_DATA_OFFSET = 16;

const readPoint = (data: PathBuffer, base: number): Point => ({
    x: read(data, t.float64, base) as number,
    y: read(data, t.float64, base + 8) as number,
});

const readMoveTo: SegmentReader = (data, base) => ({ type: "moveTo", ...readPoint(data, base + ELEMENT_SIZE) });
const readLineTo: SegmentReader = (data, base) => ({ type: "lineTo", ...readPoint(data, base + ELEMENT_SIZE) });

const readCurveTo: SegmentReader = (data, base) => {
    const first = readPoint(data, base + ELEMENT_SIZE);
    const second = readPoint(data, base + ELEMENT_SIZE * 2);
    const third = readPoint(data, base + ELEMENT_SIZE * 3);

    return { type: "curveTo", x1: first.x, y1: first.y, x2: second.x, y2: second.y, x3: third.x, y3: third.y };
};

const readClosePath: SegmentReader = () => ({ type: "closePath" });

const segmentReaderFor = (headerType: PathDataType): SegmentReader => {
    switch (headerType) {
        case PathDataType.MOVE_TO: {
            return readMoveTo;
        }
        case PathDataType.LINE_TO: {
            return readLineTo;
        }
        case PathDataType.CURVE_TO: {
            return readCurveTo;
        }
        case PathDataType.CLOSE_PATH: {
            return readClosePath;
        }
    }
};

const parsePath = (pathHandle: PathBuffer): PathData[] => {
    const numData = read(pathHandle, t.int32, NUM_DATA_OFFSET) as number;

    if (numData === 0) {
        return [];
    }

    const data = read(pathHandle, t.struct("borrowed", { size: numData * ELEMENT_SIZE }), DATA_OFFSET) as PathBuffer;
    const segments: PathData[] = [];
    let index = 0;

    while (index < numData) {
        const base = index * ELEMENT_SIZE;
        segments.push(segmentReaderFor(read(data, t.int32, base) as PathDataType)(data, base));
        index += read(data, t.int32, base + 4) as number;
    }

    return segments;
};

/**
 * A cairo path (`cairo_path_t`). Instances come from the bindings that hand one back, and the bindings that take
 * one, such as `Gsk.PathBuilder.addCairoPath`, accept it as is.
 */
abstract class Path {
    /** Reads the segments of the path in drawing order. */
    toData(): PathData[] {
        return parsePath(getHandle(this));
    }
}

export { parsePath, Path };
