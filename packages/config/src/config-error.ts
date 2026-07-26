import type { z } from "zod";

export const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

type IssuePath = (string | number)[];

export const rawIssue = (input: unknown, path: IssuePath, message: string, standalone = false) => ({
    code: "custom" as const,
    input,
    path,
    message,
    continue: true as const,
    ...(standalone && { params: { standalone: true } }),
});

const CONFIG_PREFIX = "gtkx.config.ts:";

const dottedPath = (segments: PropertyKey[]): string => {
    let path = "";
    for (const segment of segments) {
        if (typeof segment === "number") {
            path += `[${segment}]`;
        } else {
            path = path === "" ? String(segment) : `${path}.${String(segment)}`;
        }
    }
    return path;
};

const isStandaloneIssue = (issue: z.core.$ZodIssue): boolean =>
    "params" in issue && isRecord(issue.params) && issue.params.standalone === true;

const formatIssue = (issue: z.core.$ZodIssue, fullPath: PropertyKey[]): string => {
    if (issue.code === "unrecognized_keys") {
        const [key] = issue.keys;
        const path = dottedPath(key === undefined ? fullPath : [...fullPath, key]);
        return `${CONFIG_PREFIX} \`${path}\` is not a recognized key`;
    }
    if (isStandaloneIssue(issue)) return `${CONFIG_PREFIX} ${issue.message}`;
    const path = dottedPath(fullPath);
    return path === "" ? `${CONFIG_PREFIX} ${issue.message}` : `${CONFIG_PREFIX} \`${path}\` ${issue.message}`;
};

export const configError = (error: z.ZodError): Error => {
    const issue = error.issues[0];
    if (issue === undefined) return new Error(`${CONFIG_PREFIX} invalid configuration`);
    return new Error(formatIssue(issue, issue.path));
};
