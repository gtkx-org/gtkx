import { type Arg } from "./arg.js";
import { booleanT, boxedT, bufferT, int32T, int64T, uint32T } from "./descriptors.js";
import { fn } from "./fn.js";
import { LIB } from "./library.js";
import { getHandle } from "./registry.js";

type MatchParams = {
    regex: object;
    subject: string | string[];
    startPosition: number;
    matchOptions: number;
};

const MATCH_ARGS: Arg[] = [
    {
        type: boxedT("GRegex", { ownership: "borrowed", sharedLibrary: LIB, getTypeFnName: "g_regex_get_type" }),
    },
    { type: bufferT },
    { type: int64T },
    { type: int32T },
    { type: uint32T },
    {
        type: boxedT("GMatchInfo", { ownership: "full", sharedLibrary: LIB, getTypeFnName: "g_match_info_get_type" }),
        direction: "out",
    },
];

const gRegexMatchFull = fn(LIB, "g_regex_match_full", { args: MATCH_ARGS, returns: booleanT, canThrow: true });
const gRegexMatchAllFull = fn(LIB, "g_regex_match_all_full", { args: MATCH_ARGS, returns: booleanT, canThrow: true });
/* eslint-disable-next-line sonarjs/no-unused-collection -- keeps each subject's bytes alive alongside its match info */
const subjectBytes: WeakMap<object, Uint8Array> = new WeakMap();
const encoder = new TextEncoder();

const flattenSubject = (subject: string | string[]): string =>
    Array.isArray(subject) ? subject.join("") : subject;

const matchWithSubject = <MatchInfo extends object>(
    boundFn: (...inputs: unknown[]) => unknown,
    { regex, subject, startPosition, matchOptions }: MatchParams,
): [boolean, MatchInfo] => {
    const bytes = encoder.encode(`${flattenSubject(subject)}\0`);

    const result = boundFn(getHandle(regex), bytes, bytes.length - 1, startPosition, matchOptions) as [
        boolean,
        MatchInfo,
    ];

    subjectBytes.set(result[1], bytes);

    return result;
};

/**
 * Scans for a match of a compiled `GRegex` in the subject string, keeping the subject's bytes
 * alive so the returned match info's fetch methods stay valid for as long as it is reachable.
 *
 * @param regex The compiled regex to scan with.
 * @param subject The string to scan for matches.
 * @param startPosition Starting index of the subject to match, in bytes.
 * @param matchOptions Match options to apply.
 * @returns Whether the subject matched, and the match info describing the match.
 */
function matchRegex<MatchInfo extends object>(
    regex: object,
    subject: string | string[],
    startPosition: number,
    matchOptions: number,
): [boolean, MatchInfo] {
    return matchWithSubject(gRegexMatchFull, { regex, subject, startPosition, matchOptions });
}

/**
 * Scans for all possible matches of a compiled `GRegex` in the subject string using the DFA
 * algorithm, including overlapping matches, keeping the subject's bytes alive so the returned
 * match info's fetch methods stay valid for as long as it is reachable.
 *
 * @param regex The compiled regex to scan with.
 * @param subject The string to scan for matches.
 * @param startPosition Starting index of the subject to match, in bytes.
 * @param matchOptions Match options to apply.
 * @returns Whether the subject matched, and the match info describing the matches.
 */
function matchAllRegex<MatchInfo extends object>(
    regex: object,
    subject: string | string[],
    startPosition: number,
    matchOptions: number,
): [boolean, MatchInfo] {
    return matchWithSubject(gRegexMatchAllFull, { regex, subject, startPosition, matchOptions });
}

export { matchAllRegex, matchRegex };
