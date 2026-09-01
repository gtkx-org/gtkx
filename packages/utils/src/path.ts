import { isAbsolute, relative, sep } from "node:path";

const isOutsidePath = (path: string): boolean =>
    path === ".." || path.startsWith(`..${sep}`) || isAbsolute(path);

const isPathInside = (parent: string, candidate: string): boolean => {
    const path = relative(parent, candidate);

    return path !== "" && !isOutsidePath(path);
};

const isPathWithin = (parent: string, candidate: string): boolean =>
    !isOutsidePath(relative(parent, candidate));

const toPosixPath = (path: string): string => path.replaceAll("\\", "/");

export { isPathInside, isPathWithin, toPosixPath };
