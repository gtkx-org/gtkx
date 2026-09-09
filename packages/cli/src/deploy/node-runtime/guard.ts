import type { ElfInfo } from "./elf.js";
import { RUNTIME_SONAMES } from "./sonames.js";

const DOWNLOAD_REMEDY =
    "The packages GTKX generates declare the libraries an official release links against, and this release " +
    "links against more. Report it to GTKX, and pin `deploy.node.version` to a release it already packages.";

const SOURCE_REMEDY = 'Use `deploy.node.source: "download"` to fetch an official self-contained build instead.';

const remedyFor = (source: string): string => (source === "download" ? DOWNLOAD_REMEDY : SOURCE_REMEDY);

const assertPortableNode = (info: ElfInfo, source: string): void => {
    const foreign = info.needed.filter((library) => !RUNTIME_SONAMES.has(library));

    if (foreign.length === 0) {
        return;
    }

    throw new Error(
        `Cannot bundle this Node.js binary: \`deploy.node.source: "${source}"\` picked one linked against ` +
        `${foreign.join(", ")}, which the packages GTKX generates do not require. ${remedyFor(source)}`,
    );
};

export { assertPortableNode };
