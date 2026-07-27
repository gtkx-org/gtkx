import type { Plugin } from "vite";
import { expect, vi } from "vitest";

type BannerFunction = (chunk: Record<string, unknown>) => string | Promise<string>;

const callOutputOptions = (
    plugin: Plugin,
    options: Record<string, unknown>,
): Record<string, unknown> | undefined => {
    const hook = plugin.outputOptions;
    const handler = typeof hook === "function" ? hook : hook?.handler;

    if (!handler) {
        return undefined;
    }

    return (Reflect.apply(handler, {}, [options]) ?? undefined) as Record<string, unknown> | undefined;
};

const callBannerFunction = async (
    result: Record<string, unknown> | undefined,
    chunk: Record<string, unknown>,
): Promise<string> => {
    const banner = result?.banner;

    if (typeof banner !== "function") {
        throw new TypeError(`Expected a function banner, got ${typeof banner}`);
    }

    return await (banner as BannerFunction)(chunk);
};

const expectComposedBanner = async (plugin: Plugin, marker: string): Promise<void> => {
    const original = vi.fn(() => "original;");
    const chunk = { name: "index" };
    const combined = await callBannerFunction(callOutputOptions(plugin, { banner: original }), chunk);
    expect(combined).toContain(marker);
    expect(combined.endsWith("original;")).toBe(true);
    expect(original).toHaveBeenCalledWith(chunk);
};

const expectComposedAsyncBanner = async (plugin: Plugin, marker: string): Promise<void> => {
    const result = callOutputOptions(plugin, { banner: () => Promise.resolve("async-original;") });
    const combined = await callBannerFunction(result, { name: "index" });
    expect(combined).toContain(marker);
    expect(combined.endsWith("async-original;")).toBe(true);
};

export { callOutputOptions, expectComposedBanner, expectComposedAsyncBanner };
