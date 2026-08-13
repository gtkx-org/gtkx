import type { ElfInfo } from "./elf.js";

const PORTABLE_LIBRARIES = new Set([
    "ld-linux-aarch64.so.1",
    "ld-linux-x86-64.so.2",
    "libc.so.6",
    "libdl.so.2",
    "libgcc_s.so.1",
    "libm.so.6",
    "libpthread.so.0",
    "librt.so.1",
    "libstdc++.so.6",
]);

const assertPortableNode = (info: ElfInfo, source: string): void => {
    const foreign = info.needed.filter((library) => !PORTABLE_LIBRARIES.has(library));

    if (foreign.length === 0) {
        return;
    }

    throw new Error(
        `Cannot bundle this Node.js binary: \`deploy.node.source: "${source}"\` picked one linked against ` +
        `${foreign.join(", ")}, which the target machine will not have. ` +
        'Use `deploy.node.source: "download"` to fetch an official self-contained build instead.',
    );
};

export { assertPortableNode };
