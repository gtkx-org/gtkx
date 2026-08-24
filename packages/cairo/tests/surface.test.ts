import {
    Content,
    Context,
    Format,
    ImageSurface,
    Pattern,
    RecordingSurface,
    RectangleInt,
    Status,
    Surface,
    SurfaceType,
} from "@gtkx/cairo";
import { bind as nativeBind } from "@gtkx/native";
import { getHandle, t, wrapHandle } from "@gtkx/runtime";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

type Constructor<T> = abstract new (...args: never[]) => T;

const outputDir = mkdtempSync(join(tmpdir(), "gtkx-cairo-surface-"));

const createImage = (width = 4, height = 4): ImageSurface => new ImageSurface(Format.ARGB32, width, height);

const gcUntil = async (isSatisfied: () => boolean, maxRounds = 100): Promise<void> => {
    if (globalThis.gc === undefined) {
        throw new Error("global.gc is unavailable");
    }

    for (let round = 0; round < maxRounds && !isSatisfied(); round += 1) {
        await new Promise((resolve) => setImmediate(resolve));
        globalThis.gc();
        await new Promise((resolve) => setImmediate(resolve));
    }
};

const asInstance = <T>(value: unknown, cls: Constructor<T>): T => {
    if (value instanceof cls) {
        return value;
    }

    throw new TypeError(`Expected an instance of ${cls.name}`);
};

const dimensions = (surface: Surface): number[] => {
    const image = asInstance(surface, ImageSurface);

    return [image.getWidth(), image.getHeight()];
};

const createMappedContext = (surface: Surface, contexts: Set<Context>): WeakRef<Surface> => {
    const mapped = surface.mapToImage(new RectangleInt({ x: 0, y: 0, width: 4, height: 4 }));
    const context = Context.create(mapped);
    context.setSourceRgb(1, 0, 0);
    context.paint();
    contexts.add(context);

    return new WeakRef(mapped);
};

const createSharedMappedAlias = (surface: Surface): [ImageSurface, WeakRef<Surface>] => {
    const mapped = surface.mapToImage(new RectangleInt({ x: 0, y: 0, width: 4, height: 4 }));

    return [wrapHandle(getHandle(mapped), ImageSurface), new WeakRef(mapped)];
};

const firstValue = <T>(values: Set<T>): T => {
    for (const value of values) {
        return value;
    }

    throw new Error("Expected one retained value");
};

const mapAndUnmapSurface = (): void => {
    const image = createImage(8, 8);
    const sourceAlias = Context.create(image).getTarget();
    const mapped = image.mapToImage(new RectangleInt({ x: 2, y: 2, width: 3, height: 4 }));
    const alias = wrapHandle(getHandle(mapped), ImageSurface);
    const mappedChild = Surface.createForRectangle(mapped, 0, 0, 3, 4);
    const childContext = Context.create(mappedChild);
    childContext.setSourceRgb(1, 0, 0);
    childContext.paint();
    const context = Context.create(mapped);
    context.setSourceRgb(1, 0, 0);
    context.paint();
    const distinct = context.getTarget();
    expect(mapped).toBeInstanceOf(ImageSurface);
    expect(dimensions(mapped)).toEqual([3, 4]);
    sourceAlias.unmapImage(distinct);
    expect(image.status()).toBe(Status.SUCCESS);
    expect(() => Context.create(distinct)).toThrow();
    expect(() => Context.create(mappedChild)).toThrow();
    const data = image.getData();
    const stride = image.getStride();

    const pixelAt = (x: number, y: number): number[] =>
        [...data.slice(y * stride + x * 4, y * stride + x * 4 + 4)];

    expect(pixelAt(0, 0)).toEqual([0, 0, 0, 0]);
    expect(pixelAt(2, 2)).toEqual([0, 0, 255, 255]);
    expect(pixelAt(4, 5)).toEqual([0, 0, 255, 255]);
    expect(pixelAt(5, 5)).toEqual([0, 0, 0, 0]);

    expect(() => {
        mapped.status();
    }).toThrow();

    expect(() => {
        alias.status();
    }).toThrow();
};

const collectMappedImage = async (): Promise<void> => {
    const surface = new RecordingSurface(Content.COLOR_ALPHA, { x: 0, y: 0, width: 4, height: 4 });
    const before = surface.getReferenceCount();
    const contexts: Set<Context> = new Set();
    const weak = createMappedContext(surface, contexts);
    expect(surface.getReferenceCount()).toBe(before + 1);
    await gcUntil(() => weak.deref() === undefined && surface.getReferenceCount() === before);
    expect(surface.getReferenceCount()).toBe(before);
    expect(weak.deref()).toBeUndefined();
    expect(surface.inkExtents()).toEqual({ x0: 0, y0: 0, width: 4, height: 4 });
    const context = firstValue(contexts);

    expect(() => {
        context.paint();
    }).toThrow();

    const remapped = surface.mapToImage(new RectangleInt({ x: 0, y: 0, width: 1, height: 1 }));
    surface.unmapImage(remapped);
};

const collectMappedWrapperWithLiveAlias = async (): Promise<void> => {
    const surface = new RecordingSurface(Content.COLOR_ALPHA, { x: 0, y: 0, width: 4, height: 4 });
    const before = surface.getReferenceCount();
    const [alias, weak] = createSharedMappedAlias(surface);
    expect(surface.getReferenceCount()).toBe(before + 1);
    await gcUntil(() => weak.deref() === undefined);
    expect(weak.deref()).toBeUndefined();
    expect(surface.getReferenceCount()).toBe(before + 1);
    expect(alias.status()).toBe(Status.SUCCESS);
    surface.unmapImage(alias);
    expect(surface.getReferenceCount()).toBe(before);
};

const expectMappedOwnerUsesToThrow = (
    image: ImageSurface,
    sourceContext: Context,
    sourcePattern: Pattern,
    otherContext: Context,
): void => {
    expect(() => Context.create(image)).toThrow();
    expect(() => Pattern.createForSurface(image)).toThrow();

    expect(() => {
        sourceContext.paint();
    }).toThrow();

    expect(() => {
        otherContext.setSource(sourcePattern);
    }).toThrow();

    expect(() => {
        otherContext.setSourceSurface(image, 0, 0);
    }).toThrow();

    expect(() => {
        otherContext.mask(sourcePattern);
    }).toThrow();

    expect(() => {
        otherContext.maskSurface(image, 0, 0);
    }).toThrow();

    expect(() => image.writeToPng(join(outputDir, "mapped-owner.png"))).toThrow();
    expect(() => image.getData()).toThrow();
};

const expectMappedRelatedUsesToThrow = (
    related: Surface,
    relatedContext: Context,
    relatedPattern: Pattern,
    otherContext: Context,
): void => {
    expect(() => related.mapToImage(new RectangleInt({ x: 0, y: 0, width: 1, height: 1 }))).toThrow();

    expect(() => {
        relatedContext.paint();
    }).toThrow();

    expect(() => {
        otherContext.setSource(relatedPattern);
    }).toThrow();
};

const expectInvalidMappingOperandsToThrow = (): void => {
    expect(() => createImage().mapToImage(undefined as never)).toThrow();
    const finished = createImage();
    finished.finish();
    expect(() => finished.mapToImage(new RectangleInt({ x: 0, y: 0, width: 1, height: 1 }))).toThrow();

    expect(() => {
        createImage().unmapImage(undefined as never);
    }).toThrow();
};

const expectMappedDirectUsesToThrow = (): void => {
    const image = createImage();
    const sourceContext = Context.create(image);
    const sourceAlias = sourceContext.getTarget();
    const sourcePattern = Pattern.createForSurface(image);
    const otherContext = Context.create(createImage());
    const mapped = image.mapToImage(new RectangleInt({ x: 0, y: 0, width: 1, height: 1 }));
    expect(() => image.mapToImage(new RectangleInt({ x: 0, y: 0, width: 1, height: 1 }))).toThrow();
    expect(() => sourceAlias.mapToImage(new RectangleInt({ x: 0, y: 0, width: 1, height: 1 }))).toThrow();
    expect(() => mapped.mapToImage(new RectangleInt({ x: 0, y: 0, width: 1, height: 1 }))).toThrow();
    expectMappedOwnerUsesToThrow(image, sourceContext, sourcePattern, otherContext);

    expect(() => {
        mapped.finish();
    }).toThrow();

    expect(() => {
        image.finish();
    }).toThrow();

    expect(() => {
        mapped.setDeviceOffset(1, 1);
    }).toThrow();

    expect(() => {
        image.setDeviceScale(2, 2);
    }).toThrow();

    expect(() => {
        createImage().unmapImage(mapped);
    }).toThrow();

    expect(() => {
        image.unmapImage(createImage());
    }).toThrow();

    expect(() => {
        image.unmapImage(image);
    }).toThrow();

    image.unmapImage(mapped);

    expect(() => {
        sourceContext.paint();
    }).not.toThrow();

    expect(() => {
        image.unmapImage(mapped);
    }).toThrow();
};

const expectMappedParentRelationsToThrow = (): void => {
    const image = createImage();
    const child = Surface.createForRectangle(image, 0, 0, 2, 2);
    const nested = Surface.createForRectangle(child, 0, 0, 1, 1);
    const childContext = Context.create(child);
    const nestedContext = Context.create(nested);
    const childPattern = Pattern.createForSurface(child);
    const otherContext = Context.create(createImage());
    const mapped = image.mapToImage(new RectangleInt({ x: 0, y: 0, width: 1, height: 1 }));
    expectMappedRelatedUsesToThrow(child, childContext, childPattern, otherContext);

    expect(() => {
        nestedContext.paint();
    }).toThrow();

    image.unmapImage(mapped);

    expect(() => {
        nestedContext.paint();
    }).not.toThrow();
};

const expectMappedChildRelationsToThrow = (): void => {
    const image = createImage();
    const child = Surface.createForRectangle(image, 0, 0, 2, 2);
    const sibling = Surface.createForRectangle(image, 2, 2, 1, 1);
    const sourceContext = Context.create(image);
    const sourcePattern = Pattern.createForSurface(image);
    const otherContext = Context.create(createImage());
    const siblingContext = Context.create(sibling);
    const mapped = child.mapToImage(new RectangleInt({ x: 0, y: 0, width: 1, height: 1 }));
    expectMappedRelatedUsesToThrow(image, sourceContext, sourcePattern, otherContext);

    expect(() => {
        siblingContext.paint();
    }).toThrow();

    child.unmapImage(mapped);

    expect(() => {
        siblingContext.paint();
    }).not.toThrow();
};

const expectMappedGroupRelationsToThrow = (): void => {
    const context = Context.create(createImage());
    context.pushGroup();
    const group = context.getGroupTarget();
    const mapped = group.mapToImage(new RectangleInt({ x: 0, y: 0, width: 1, height: 1 }));
    expect(() => context.popGroup()).toThrow();

    expect(() => {
        context.popGroupToSource();
    }).toThrow();

    group.unmapImage(mapped);

    expect(() => {
        context.popGroupToSource();
    }).not.toThrow();
};

afterAll(() => {
    rmSync(outputDir, { recursive: true, force: true });
});

describe("Surface (context targets)", () => {
    it("wraps the target of a context as the concrete image surface class", () => {
        const target = Context.create(createImage(4, 6)).getTarget();
        expect(target).toBeInstanceOf(ImageSurface);
        expect(target).toBeInstanceOf(Surface);
        expect(dimensions(target)).toEqual([4, 6]);
        expect(asInstance(target, ImageSurface).getFormat()).toBe(Format.ARGB32);
    });

    it("wraps the target of a context as the concrete recording surface class", () => {
        const ctx = Context.create(new RecordingSurface(Content.COLOR_ALPHA));
        ctx.rectangle(1, 2, 3, 4);
        ctx.fill();
        const target = ctx.getTarget();
        expect(target).toBeInstanceOf(RecordingSurface);
        expect(asInstance(target, RecordingSurface).inkExtents()).toEqual({ x0: 1, y0: 2, width: 3, height: 4 });
    });

    it("wraps the group target of a context as a surface", () => {
        const ctx = Context.create(createImage());
        ctx.pushGroup();
        const group = ctx.getGroupTarget();
        expect(group).toBeInstanceOf(Surface);
        expect(group).not.toBe(ctx.getTarget());
        ctx.popGroupToSource();
        expect(ctx.getGroupTarget()).toBeInstanceOf(ImageSurface);
    });

    it("rejects a missing target", () => {
        expect(() => Context.create(undefined as never)).toThrow();
    });
});

describe("Surface (statics)", () => {
    it("wraps similar surfaces as image surfaces", () => {
        const image = createImage();
        const similar = Surface.createSimilar(image, Content.COLOR_ALPHA, 2, 3);
        const similarImage = Surface.createSimilarImage(image, Format.RGB24, 5, 7);
        expect(similar).toBeInstanceOf(ImageSurface);
        expect(similarImage).toBeInstanceOf(ImageSurface);
        expect(dimensions(similar)).toEqual([2, 3]);
        expect(dimensions(similarImage)).toEqual([5, 7]);
        expect(asInstance(similarImage, ImageSurface).getFormat()).toBe(Format.RGB24);
    });

    it("wraps a sub-surface as the class of the type cairo reports for it", () => {
        const sub = Surface.createForRectangle(createImage(), 1, 1, 2, 3);
        expect(sub).toBeInstanceOf(Surface);
        expect(sub.status()).toBe(Status.SUCCESS);
        expect(sub.getType()).toBe(SurfaceType.IMAGE);
        expect(sub).toBeInstanceOf(ImageSurface);
        expect(sub.getContent()).toBe(Content.COLOR_ALPHA);
    });

    it("rejects a missing surface operand", () => {
        expect(() => Surface.createSimilar(undefined as never, Content.COLOR_ALPHA, 1, 1)).toThrow();
        expect(() => Surface.createSimilarImage(undefined as never, Format.ARGB32, 1, 1)).toThrow();
        expect(() => Surface.createForRectangle(undefined as never, 0, 0, 1, 1)).toThrow();
    });
});

describe("Surface mapping", () => {
    it("maps a rectangle of a surface to an image surface and back", () => {
        expect(mapAndUnmapSurface).not.toThrow();
    });

    it("unmaps an abandoned image while native aliases remain", async () => {
        await expect(collectMappedImage()).resolves.toBeUndefined();
    });

    it("keeps a mapping alive while a shared-handle alias remains", async () => {
        await expect(collectMappedWrapperWithLiveAlias()).resolves.toBeUndefined();
    });
});

describe("Surface mapping descriptor errors", () => {
    it("rejects malformed lease descriptors before calling Cairo", () => {
        const surfaceDescriptor = t.boxed("CairoSurface", {
            ownership: "borrowed",
            sharedLibrary: "libcairo-gobject.so.2",
            getTypeFnName: "cairo_gobject_surface_get_type",
        });

        const lease = t.lease("libcairo.so.2", "cairo_surface_unmap_image");

        expect(() =>
            t.bind(
                "libcairo.so.2",
                "cairo_surface_unmap_image",
                [lease.end(surfaceDescriptor, 1), surfaceDescriptor],
                t.void,
            ),
        ).toThrow();

        expect(() =>
            t.bind(
                "libcairo.so.2",
                "cairo_surface_unmap_image",
                [surfaceDescriptor, lease.end(surfaceDescriptor, 0)],
                t.int32,
            ),
        ).toThrow();

        expect(() =>
            t.bind(
                "libcairo.so.2",
                "cairo_surface_status",
                [t.callback([lease.guard(surfaceDescriptor)], t.void)],
                t.int32,
            ),
        ).toThrow();

        expect(() =>
            nativeBind(
                "libcairo.so.2",
                "cairo_surface_unmap_image",
                [surfaceDescriptor, lease.end(surfaceDescriptor, 0)],
                t.void,
                0,
            ),
        ).toThrow();

        expect(() => t.fieldAt(lease.guard(surfaceDescriptor))).toThrow();
    });
});

describe("Surface mapping errors", () => {
    it("rejects invalid mapping lifecycles", () => {
        expectInvalidMappingOperandsToThrow();
        expectMappedDirectUsesToThrow();
        expectMappedParentRelationsToThrow();
        expectMappedChildRelationsToThrow();
        expectMappedGroupRelationsToThrow();
    });
});

describe("ImageSurface", () => {
    it("round-trips an image through a PNG file", () => {
        const path = join(outputDir, "round-trip.png");
        const image = createImage(3, 2);
        const ctx = Context.create(image);
        ctx.setSourceRgb(0, 1, 0);
        ctx.paint();
        expect(image.writeToPng(path)).toBe(Status.SUCCESS);
        const loaded = ImageSurface.createFromPng(path);
        expect(loaded).toBeInstanceOf(ImageSurface);
        expect(loaded.status()).toBe(Status.SUCCESS);
        expect(dimensions(loaded)).toEqual([3, 2]);
        const [blue, green, red] = loaded.getData();
        expect([red, green, blue]).toEqual([0, 255, 0]);
    });

    it("exposes device offset, scale and fallback resolution", () => {
        const image = ImageSurface.create(Format.ARGB32, 2, 2);
        image.setDeviceOffset(1.5, 2.5);
        image.setDeviceScale(2, 3);
        image.setFallbackResolution(72, 96);
        expect(image.getDeviceOffset()).toEqual({ xOffset: 1.5, yOffset: 2.5 });
        expect(image.getDeviceScale()).toEqual({ xScale: 2, yScale: 3 });
        expect(image.getFallbackResolution()).toEqual({ xPixelsPerInch: 72, yPixelsPerInch: 96 });
    });

    it("throws when loading a missing PNG file", () => {
        expect(() => ImageSurface.createFromPng(join(outputDir, "missing.png"))).toThrow();
    });

    it("returns no data for an empty image surface", () => {
        expect(createImage(0, 0).getData()).toHaveLength(0);
    });

    it("rejects a non-string file name", () => {
        expect(() => ImageSurface.createFromPng(123 as never)).toThrow();
    });
});

describe("RecordingSurface", () => {
    it("creates recording surfaces through the constructor and the static", () => {
        const bounded = RecordingSurface.create(Content.COLOR, { x: 1, y: 2, width: 30, height: 40 });
        expect(bounded).toBeInstanceOf(RecordingSurface);
        expect(bounded.getExtents()).toEqual({ x: 1, y: 2, width: 30, height: 40 });
        expect(bounded.getContent()).toBe(Content.COLOR);
        expect(new RecordingSurface(Content.ALPHA).getType()).toBe(SurfaceType.RECORDING);
    });

    it("reports no extents for an unbounded recording surface", () => {
        const unbounded = new RecordingSurface(Content.COLOR_ALPHA);
        expect(unbounded.getExtents()).toBeNull();
        expect(unbounded.inkExtents()).toEqual({ x0: 0, y0: 0, width: 0, height: 0 });
    });

    it("rejects malformed extents", () => {
        expect(() => new RecordingSurface(Content.COLOR_ALPHA, { x: "a" } as never)).toThrow();
    });
});
