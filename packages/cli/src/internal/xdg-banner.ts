import type { Rollup } from "vite";
import { outputRootUrlExpression } from "./banner.js";
import { XDG_DATA_DIRS_DEFAULT } from "./xdg-data-dirs.js";

const xdgDataDirsBanner = (chunk: Rollup.RenderedChunk): string => [
    "globalThis.process.env.XDG_DATA_DIRS = (() => {",
    `    const root = ${outputRootUrlExpression(chunk)};`,
    `    const dirs = globalThis.process.env.XDG_DATA_DIRS || ${JSON.stringify(XDG_DATA_DIRS_DEFAULT)};`,
    "    return dirs.split(\":\").includes(root) ? dirs : `${root}:${dirs}`;",
    "})();",
].join("\n");

export { xdgDataDirsBanner };
