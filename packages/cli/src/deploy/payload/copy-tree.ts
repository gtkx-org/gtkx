import { isPathInside } from "@gtkx/utils";
import { chmodSync, copyFileSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { StagedFile } from "../types.js";
import { listFilesRecursive } from "../../internal/list-files.js";

const EXECUTABLE_MODE = 0o755;
const READABLE_MODE = 0o644;
const EXECUTABLE_SUFFIXES = [".node", ".so"];
const MODE_MASK = 0o7777;
const EXECUTE_MASK = 0o111;

const modeFor = (rel: string): number => {
    const name = rel.split("/").at(-1) ?? rel;

    return EXECUTABLE_SUFFIXES.some((suffix) => name.endsWith(suffix)) ? EXECUTABLE_MODE : READABLE_MODE;
};

const assertInsideRoot = (root: string, rel: string, abs: string): void => {
    if (!isPathInside(root, abs)) {
        throw new Error(`Cannot stage "${rel}": it resolves outside the staging directory`);
    }
};

const placeFile = (root: string, rel: string, mode: number, write: (target: string) => void): StagedFile => {
    const abs = join(root, rel);
    assertInsideRoot(root, rel, abs);
    mkdirSync(dirname(abs), { recursive: true });
    write(abs);
    chmodSync(abs, mode);

    return { rel, abs, mode };
};

const copyInto = (root: string, rel: string, source: string, mode = modeFor(rel)): StagedFile =>
    placeFile(root, rel, mode, (target) => {
        copyFileSync(source, target);
    });

const writeInto = (root: string, rel: string, contents: string, mode = READABLE_MODE): StagedFile =>
    placeFile(root, rel, mode, (target) => {
        writeFileSync(target, contents);
    });

const sourceMode = (path: string): number => statSync(path).mode & MODE_MASK;

const executableModeFor = (path: string): number =>
    (sourceMode(path) & EXECUTE_MASK) === 0 ? READABLE_MODE : EXECUTABLE_MODE;

const copyTree = (root: string, relBase: string, sourceDir: string): StagedFile[] =>
    listFilesRecursive(sourceDir)
        .map((file) => copyInto(root, join(relBase, file.rel), file.absPath, sourceMode(file.absPath)));

export { copyInto, copyTree, EXECUTABLE_MODE, executableModeFor, writeInto };
