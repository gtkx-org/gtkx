/**
 * Shared assertion helpers for the asset-bundling Vite plugin tests
 * (`gsettings` and `gresources`). Both plugins expose a `buildEnd` hook that
 * either stays inert when nothing was tracked or emits a single compiled
 * asset, so the expectations around that hook live here as one source of
 * truth.
 */

import { expect, vi } from "vitest";
import type { BuildEndHook } from "./plugin-hook-types.js";

/**
 * Asserts that invoking the plugin's `buildEnd` hook with no tracked inputs
 * neither throws nor emits any asset.
 */
export const expectBuildEndIsNoop = (buildEnd: BuildEndHook): void => {
    const emitFile = vi.fn();
    expect(() => buildEnd.call({ emitFile })).not.toThrow();
    expect(emitFile).not.toHaveBeenCalled();
};

/**
 * Invokes the plugin's `buildEnd` hook and asserts that it emits exactly one
 * non-empty asset of type `"asset"` with the given file name.
 */
export const expectBuildEndEmitsAsset = (buildEnd: BuildEndHook, fileName: string): void => {
    const emitFile = vi.fn();
    buildEnd.call({ emitFile });

    expect(emitFile).toHaveBeenCalledTimes(1);
    const call = emitFile.mock.calls[0]?.[0];
    expect(call).toBeDefined();
    expect(call?.type).toBe("asset");
    expect(call?.fileName).toBe(fileName);
    expect(Buffer.isBuffer(call?.source)).toBe(true);
    expect(call?.source.length).toBeGreaterThan(0);
};
