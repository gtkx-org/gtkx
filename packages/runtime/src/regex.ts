import type { AnyClass } from "@gtkx/utils";
import { type ExternalObject, getMatchInfoBase, getMatchInfoType, type Handle, ownMatchInfo } from "@gtkx/native";
import { type Arg } from "./arg.js";
import { bind } from "./bind.js";
import {
    booleanT,
    boxedT,
    bufferT,
    callbackT,
    int32T,
    int64T,
    stringT,
    structT,
    uint32T,
    uint64T,
} from "./descriptors.js";
import { fn } from "./fn.js";
import { LIB } from "./library.js";
import { getHandle, getWrapperClass, registerWrapperClass, wrapHandle } from "./registry.js";

type MatchParams = {
    regex: object;
    subject: string | string[] | Uint8Array | number[];
    startPosition: number;
    matchOptions: number;
};

type Subject = {
    bytes: ExternalObject<Handle>;
    data: ExternalObject<Handle>;
    length: number;
};

type RegexEvaluator = (info: never, result: never) => boolean;
type RegexEvalArgs = [
    subject: string | string[] | Uint8Array | number[],
    startPosition: number,
    matchOptions: number,
    shouldStop: RegexEvaluator,
];

type MatchInfoMethod = (this: object, ...args: unknown[]) => unknown;

const MATCH_INFO = boxedT("GMatchInfo", {
    ownership: "borrowed", sharedLibrary: LIB, getTypeFnName: "g_match_info_get_type",
});
const OWNED_MATCH_INFO = boxedT("GMatchInfo", {
    ownership: "full", sharedLibrary: LIB, getTypeFnName: "g_match_info_get_type",
});
const BYTES = boxedT("GBytes", { ownership: "borrowed", sharedLibrary: LIB, getTypeFnName: "g_bytes_get_type" });
const gBytesNew = bind(LIB, "g_bytes_new", [bufferT, uint64T], boxedT("GBytes", {
    ownership: "full", sharedLibrary: LIB, getTypeFnName: "g_bytes_get_type",
}));
const gBytesGetData = bind(LIB, "g_bytes_get_data", [BYTES, bufferT], structT());
const gMatchInfoRef = bind(LIB, "g_match_info_ref", [MATCH_INFO], OWNED_MATCH_INFO);

const MATCH_ARGS: Arg[] = [
    {
        type: boxedT("GRegex", { ownership: "borrowed", sharedLibrary: LIB, getTypeFnName: "g_regex_get_type" }),
    },
    { type: bufferT },
    { type: int64T },
    { type: int32T },
    { type: uint32T },
    {
        type: OWNED_MATCH_INFO,
        direction: "out",
    },
];

const gRegexMatchFull = fn(LIB, "g_regex_match_full", { args: MATCH_ARGS, returns: booleanT, canThrow: true });
const gRegexMatchAllFull = fn(LIB, "g_regex_match_all_full", { args: MATCH_ARGS, returns: booleanT, canThrow: true });
const gRegexReplaceEval = fn(LIB, "g_regex_replace_eval", {
    args: [
        ...MATCH_ARGS.slice(0, 5),
        { type: callbackT([
            MATCH_INFO,
            boxedT("GString", { ownership: "borrowed", sharedLibrary: LIB, getTypeFnName: "g_gstring_get_type" }),
            bufferT,
        ], booleanT, { hasUserData: true, userDataIndex: 2, scope: "call" }), isRequired: true },
    ],
    returns: stringT("full"),
    canThrow: true,
});
const encoder = new TextEncoder();

const encodeSubject = (subject: MatchParams["subject"]): Uint8Array => {
    if (typeof subject === "string") {
        return encoder.encode(`${subject}\0`);
    }
    if (Array.isArray(subject) && subject.every((part) => typeof part === "string")) {
        return encoder.encode(`${subject.join("")}\0`);
    }
    const encoded = new Uint8Array(subject.length + 1);
    encoded.set(subject);

    return encoded;
};

const createSubject = (subject: MatchParams["subject"]): Subject => {
    const encoded = encodeSubject(subject);
    const bytes = gBytesNew(encoded, encoded.length) as ExternalObject<Handle>;
    const data = gBytesGetData(bytes, null) as ExternalObject<Handle>;

    return { bytes, data, length: encoded.length - 1 };
};

const managedMatchInfo = (raw: ExternalObject<Handle>, subject: Subject): object =>
    wrapHandle(ownMatchInfo(raw, subject.bytes), getWrapperClass(getMatchInfoType()));

const matchWithSubject = <MatchInfo extends object>(
    boundFn: (...inputs: unknown[]) => unknown,
    { regex, subject, startPosition, matchOptions }: MatchParams,
): [boolean, MatchInfo] => {
    const input = createSubject(subject);
    const [matched, info] = boundFn(getHandle(regex), input.data, input.length, startPosition, matchOptions) as [
        boolean,
        object,
    ];

    return [matched, managedMatchInfo(getHandle(info), input) as MatchInfo];
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
    subject: string | string[] | Uint8Array | number[],
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
    subject: string | string[] | Uint8Array | number[],
    startPosition: number,
    matchOptions: number,
): [boolean, MatchInfo] {
    return matchWithSubject(gRegexMatchAllFull, { regex, subject, startPosition, matchOptions });
}

function replaceRegexEval(
    { regex, subject, startPosition, matchOptions }: MatchParams,
    shouldStop: RegexEvaluator,
): string {
    const input = createSubject(subject);
    const shouldStopWithOwnedMatch = shouldStop as (info: object, result: object) => boolean;
    const isLastMatch = (info: object, result: object): boolean => {
        const raw = gMatchInfoRef(getHandle(info)) as ExternalObject<Handle>;

        return shouldStopWithOwnedMatch(managedMatchInfo(raw, input), result);
    };

    return gRegexReplaceEval(
        getHandle(regex), input.data, input.length, startPosition, matchOptions, isLastMatch,
    ) as string;
}

function installMatchInfo(cls: AnyClass, rawClass: AnyClass): void {
    registerWrapperClass(cls, getMatchInfoType());

    const methods = Object.entries(Object.getOwnPropertyDescriptors(rawClass.prototype));

    for (const [name, descriptor] of methods) {
        if (name === "constructor" || typeof descriptor.value !== "function") {
            continue;
        }
        const method = descriptor.value as MatchInfoMethod;

        Object.defineProperty(cls.prototype, name, {
            ...descriptor,
            value(this: object, ...args: unknown[]): unknown {
                const base = getMatchInfoBase(getHandle(this));

                return method.apply(wrapHandle(base, rawClass), args);
            },
        });
    }
}

export { installMatchInfo, matchAllRegex, matchRegex, type RegexEvalArgs, replaceRegexEval };
