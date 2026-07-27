import { expect, vi } from "vitest";
import type { BuildEndHook } from "./plugin-hook-types.js";

type EmitFile = ThisParameterType<BuildEndHook>["emitFile"];

const expectBuildEndIsNoop = (buildEnd: BuildEndHook): void => {
    const emitFile = vi.fn<EmitFile>();

    expect(() => {
        buildEnd.call({ emitFile });
    }).not.toThrow();

    expect(emitFile).not.toHaveBeenCalled();
};

const expectBuildEndEmitsAsset = (buildEnd: BuildEndHook, fileName: string): void => {
    const emitFile = vi.fn<EmitFile>();
    buildEnd.call({ emitFile });
    expect(emitFile).toHaveBeenCalledTimes(1);
    const call = emitFile.mock.calls[0]?.[0];
    expect(call).toBeDefined();
    expect(call?.type).toBe("asset");
    expect(call?.fileName).toBe(fileName);
    expect(Buffer.isBuffer(call?.source)).toBe(true);
    expect(call?.source.length).toBeGreaterThan(0);
};

export { expectBuildEndIsNoop, expectBuildEndEmitsAsset };
