import type { Rollup } from "vite";
import { posix } from "node:path";

type Banner = string | Rollup.AddonFunction;

const renderBanner = async (banner: Banner, chunk: Rollup.RenderedChunk): Promise<string> =>
    typeof banner === "function" ? banner(chunk) : banner;

const prependBanner = (options: Rollup.OutputOptions, banner: Banner): Rollup.OutputOptions => {
    const existing = options.banner;

    return {
        ...options,
        banner: async (chunk) => {
            const prefix = await renderBanner(banner, chunk);
            const suffix = existing === undefined ? "" : await renderBanner(existing, chunk);

            return suffix.length === 0 ? prefix : `${prefix}\n${suffix}`;
        },
    };
};

const outputRootUrlExpression = (chunk: Rollup.RenderedChunk): string => {
    const relativeRoot = posix.relative(posix.dirname(chunk.fileName), ".");
    const specifier = relativeRoot.length === 0 ? "./" : `${relativeRoot}/`;

    return `decodeURIComponent(new URL(${JSON.stringify(specifier)}, import.meta.url).pathname)`;
};

export { outputRootUrlExpression, prependBanner };
