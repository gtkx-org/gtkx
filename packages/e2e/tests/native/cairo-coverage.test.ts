import * as Regress from "@gtkx/gi/regress";
import { expect, test } from "vitest";
import { drainGC } from "./helpers/memory.js";

test("caller-allocated Cairo matrices own independent writable storage", () => {
    const matrix = Regress.testCairoMatrixOutCallerAllocates();
    expect(matrix.transformPoint(2, 3)).toEqual({ x: 2, y: 3 });
    Regress.testCairoMatrixNoneIn(matrix);
    matrix.translate(4, 5);
    expect(matrix.transformPoint(2, 3)).toEqual({ x: 6, y: 8 });
    const other = Regress.testCairoMatrixOutCallerAllocates();
    expect(other.transformPoint(2, 3)).toEqual({ x: 2, y: 3 });
    expect(matrix.transformPoint(2, 3)).toEqual({ x: 6, y: 8 });
});

test("owned Cairo paths preserve copied segments and remain usable after collection", async () => {
    const context = Regress.testCairoContextNoneReturn();
    context.newPath();
    try {
        context.moveTo(1, 2);
        context.lineTo(3, 4);
        const path = Regress.testCairoPathFullReturn();
        context.newPath();
        const transferred = Regress.testCairoPathFullInFullReturn(path);
        expect(transferred).not.toBe(path);
        await drainGC();
        expect(path.toData()).toEqual([
            { type: "moveTo", x: 1, y: 2 },
            { type: "lineTo", x: 3, y: 4 },
        ]);
        expect(transferred.toData()).toEqual(path.toData());
        Regress.testCairoPathNoneIn(path);
        Regress.testCairoPathNoneIn(transferred);
    } finally {
        context.newPath();
    }
});
