import { lstatSync, type Stats } from "node:fs";
import { isAbsolute, join, relative, sep } from "node:path";

type ProjectPathRequest = {
    root: string;
    candidate: string;
    configured: string;
    subject: string;
};

const isProjectDescendant = (root: string, candidate: string): boolean => {
    const rel = relative(root, candidate);

    return rel.length > 0 && rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
};

const refusal = ({ root, configured, subject }: ProjectPathRequest, reason: string): Error =>
    new Error(`Cannot use "${configured}" as the ${subject}: ${reason} ${root}`);

const inspectSegment = (request: ProjectPathRequest, path: string): Stats | undefined => {
    const stats = lstatSync(path, { throwIfNoEntry: false });

    if (stats?.isSymbolicLink() === true) {
        throw refusal(request, "it crosses a symbolic link below");
    }

    return stats;
};

const inspectProjectPath = (request: ProjectPathRequest): Stats | undefined => {
    const { root, candidate } = request;

    if (!isProjectDescendant(root, candidate)) {
        throw refusal(request, "it is outside");
    }

    const segments = relative(root, candidate).split(sep);
    let current = root;
    let result: Stats | undefined;

    for (const segment of segments) {
        current = join(current, segment);
        result = inspectSegment(request, current);

        if (result === undefined) {
            return undefined;
        }
    }

    return result;
};

const requireProjectFile = (request: ProjectPathRequest): string => {
    const stats = inspectProjectPath(request);

    if (stats?.isFile() !== true) {
        throw refusal(request, "it is not a regular file below");
    }

    return request.candidate;
};

export { inspectProjectPath, isProjectDescendant, requireProjectFile };
