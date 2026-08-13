import type { z } from "zod";

type IssuePath = (string | number)[];

const CONFIG_PREFIX = "gtkx.config.ts:";
const UNRECOGNIZED_KEY_REASON = "is not a recognized key";

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const rawIssue = (input: unknown, path: IssuePath, message: string, isStandalone = false) => ({
    code: "custom" as const,
    input,
    path,
    message,
    continue: true as const,
    ...(isStandalone && { params: { standalone: true } }),
});

const appendSegment = (path: string, segment: PropertyKey): string => {
    if (typeof segment === "number") {
        return `${path}[${String(segment)}]`;
    }

    return path === "" ? String(segment) : `${path}.${String(segment)}`;
};

const dottedPath = (segments: PropertyKey[]): string => {
    let path = "";

    for (const segment of segments) {
        path = appendSegment(path, segment);
    }

    return path;
};

const isStandaloneIssue = (issue: z.core.$ZodIssue): boolean =>
    "params" in issue && isRecord(issue.params) && issue.params.standalone === true;

const unrecognizedKeyPath = (issue: z.core.$ZodIssue, fullPath: PropertyKey[]): string | undefined => {
    if (issue.code === "unrecognized_keys") {
        const [key] = issue.keys;

        return dottedPath(key === undefined ? fullPath : [...fullPath, key]);
    }

    return issue.code === "invalid_key" ? dottedPath(fullPath) : undefined;
};

const keyRejectionReason = (issue: z.core.$ZodIssue): string => {
    const nested = issue.code === "invalid_key" ? issue.issues[0] : undefined;

    return nested?.code === "custom" ? nested.message : UNRECOGNIZED_KEY_REASON;
};

const formatIssue = (issue: z.core.$ZodIssue, fullPath: PropertyKey[]): string => {
    const unrecognized = unrecognizedKeyPath(issue, fullPath);

    if (unrecognized !== undefined) {
        return `${CONFIG_PREFIX} \`${unrecognized}\` ${keyRejectionReason(issue)}`;
    }

    if (isStandaloneIssue(issue)) {
        return `${CONFIG_PREFIX} ${issue.message}`;
    }

    const path = dottedPath(fullPath);

    return path === "" ? `${CONFIG_PREFIX} ${issue.message}` : `${CONFIG_PREFIX} \`${path}\` ${issue.message}`;
};

const missingConfigFileError = (cwd: string): Error =>
    new Error(`${CONFIG_PREFIX} no configuration file found in ${cwd}`);

const configError = (error: z.ZodError): Error => {
    const issue = error.issues[0];

    if (issue === undefined) {
        return new Error(`${CONFIG_PREFIX} invalid configuration`);
    }

    return new Error(formatIssue(issue, issue.path));
};

export { isRecord, rawIssue, missingConfigFileError, configError };
