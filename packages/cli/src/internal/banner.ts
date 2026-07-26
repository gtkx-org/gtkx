import type { Rollup } from "vite";

const prependBanner = (options: Rollup.OutputOptions, banner: string): Rollup.OutputOptions => {
    const existing = options.banner;

    if (typeof existing === "function") {
        return { ...options, banner: async (chunk) => `${banner}\n${await existing(chunk)}` };
    }

    return { ...options, banner: existing ? `${banner}\n${existing}` : banner };
};

export { prependBanner };
