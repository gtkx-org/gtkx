import { isPathInside, isPathWithin } from "@gtkx/utils";
import { resolve } from "node:path";
import { deployOutDirFor } from "../internal/deploy-out-dir.js";

const REFERENCE_DIR = ".gtkx";

const createWatchIgnore = (root: string, deployOutDir: string | undefined): ((path: string) => boolean) => {
    const projectRoot = resolve(root);
    const generated = [deployOutDirFor(projectRoot, deployOutDir), resolve(projectRoot, REFERENCE_DIR)].filter(
        (directory) => isPathInside(projectRoot, directory),
    );

    return (path) => generated.some((directory) => isPathWithin(directory, resolve(path)));
};

export { createWatchIgnore };
