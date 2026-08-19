import * as Gdk from "@gtkx/gi/gdk";
import * as GLib from "@gtkx/gi/glib";
import * as Graphene from "@gtkx/gi/graphene";
import * as HarfBuzz from "@gtkx/gi/harfbuzz";
import { t } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

const point3d = (x: number, y: number, z: number): Graphene.Point3D => {
    const point = new Graphene.Point3D();
    point.init(x, y, z);

    return point;
};

const boxFrom = (min: Graphene.Point3D, max: Graphene.Point3D): Graphene.Box => {
    const box = new Graphene.Box();
    box.init(min, max);

    return box;
};

const whiteSquareDownloader = (side: number): Gdk.TextureDownloader => {
    const data = new Uint8Array(side * side * 4).fill(255);
    const texture = Gdk.MemoryTexture.new(side, side, Gdk.MemoryFormat.R8G8B8A8, GLib.Bytes.new(data), side * 4);
    const downloader = Gdk.TextureDownloader.new(texture);
    downloader.setFormat(Gdk.MemoryFormat.R8G8B8A8);

    return downloader;
};

describe("caller-allocated fixed-size array out parameters", () => {
    it("round-trips a matrix through the caller's float buffer", () => {
        const values = [2, 0, 0, 0, 0, 3, 0, 0, 0, 0, 4, 0, 5, 6, 7, 1];
        const matrix = new Graphene.Matrix();
        matrix.initFromFloat(values);
        expect(matrix.toFloat()).toEqual(values);
    });

    it("decodes the vertices a box writes as struct elements at their stride", () => {
        const vertices = boxFrom(point3d(0, 0, 0), point3d(1, 2, 3)).getVertices();
        expect(vertices).toHaveLength(8);
        expect(vertices.every((vertex) => vertex instanceof Graphene.Vec3)).toBe(true);

        expect(vertices.map((vertex) => vertex.toFloat())).toEqual([
            [0, 0, 0],
            [0, 0, 3],
            [0, 2, 0],
            [0, 2, 3],
            [1, 0, 0],
            [1, 0, 3],
            [1, 2, 0],
            [1, 2, 3],
        ]);
    });

    it("returns each frustum plane as its own wrapper", () => {
        const projection = new Graphene.Matrix();
        projection.initPerspective(60, 1, 1, 100);
        const frustum = new Graphene.Frustum();
        frustum.initFromMatrix(projection);
        const planes = frustum.getPlanes();
        expect(planes).toHaveLength(6);
        expect(planes.every((plane) => plane instanceof Graphene.Plane)).toBe(true);
        expect(planes.every((plane) => Number.isFinite(plane.getConstant()))).toBe(true);
    });

    it("packs both caller-allocated plane arrays after the downloaded bytes", () => {
        const side = 2;
        const [bytes, offsets, strides] = whiteSquareDownloader(side).downloadBytesWithPlanes();
        expect(bytes.getSize()).toBe(side * side * 4);
        expect(offsets).toHaveLength(4);
        expect(strides).toHaveLength(4);
        expect(offsets[0]).toBe(0);
        expect(strides[0]).toBe(side * 4);
    });
});

describe("caller-allocated fixed-size array edge cases", () => {
    it("reads an identity matrix back unchanged", () => {
        const matrix = new Graphene.Matrix();
        matrix.initIdentity();
        expect(matrix.toFloat()).toEqual(IDENTITY);
    });

    it("collapses a zero-size box to eight identical vertices", () => {
        const corner = point3d(5, 5, 5);
        const vertices = boxFrom(corner, corner).getVertices();
        expect(vertices).toHaveLength(8);
        expect(vertices.map((vertex) => vertex.toFloat())).toEqual(Array.from({ length: 8 }, () => [5, 5, 5]));
    });

    it("fills the smallest fixed arrays from the vector types", () => {
        const vec2 = new Graphene.Vec2();
        vec2.init(5, 6);
        const vec3 = new Graphene.Vec3();
        vec3.init(1, 2, 3);
        const vec4 = new Graphene.Vec4();
        vec4.init(1, 2, 3, 4);
        const rect = new Graphene.Rect();
        rect.init(0, 0, 10, 20);
        expect(vec2.toFloat()).toEqual([5, 6]);
        expect(vec3.toFloat()).toEqual([1, 2, 3]);
        expect(vec4.toFloat()).toEqual([1, 2, 3, 4]);

        expect(rect.getVertices().map((vertex) => vertex.toFloat())).toEqual([
            [0, 0],
            [10, 0],
            [10, 20],
            [0, 20],
        ]);
    });

    it("decodes a byte-flavored fixed array to a Uint8Array", () => {
        const tag = HarfBuzz.tagFromString(new TextEncoder().encode("latn"));
        const decoded = HarfBuzz.tagToString(tag);
        expect(decoded).toBeInstanceOf(Uint8Array);
        expect(new TextDecoder().decode(decoded)).toBe("latn");
    });
});

describe("caller-allocated fixed-size array error paths", () => {
    it("throws when binding a caller-allocated array without a fixed size", () => {
        expect(() =>
            t.fn("libgraphene-1.0.so.0", "graphene_matrix_to_float", {
                args: [
                    { type: t.biguint64 },
                    { type: t.sizedArray(t.float32, 0, "borrowed", { isCallerAllocated: true }), direction: "out" },
                ],
                returns: t.void,
            }),
        ).toThrow();
    });

    it("throws when binding a caller-allocated fixed array of an unsupported element", () => {
        expect(() =>
            t.fn("libgraphene-1.0.so.0", "graphene_matrix_to_float", {
                args: [
                    { type: t.biguint64 },
                    {
                        type: t.fixedArray(t.callback([], t.void), 16, "borrowed", { isCallerAllocated: true }),
                        direction: "out",
                    },
                ],
                returns: t.void,
            }),
        ).toThrow();
    });

    it("throws when reading the buffer through a detached receiver", () => {
        expect(() => Graphene.Matrix.prototype.toFloat.call(undefined)).toThrow();
    });
});
