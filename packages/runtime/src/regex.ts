import type { AnyClass } from "@gtkx/utils";
import { alloc, type ExternalObject, type Handle } from "./native.js";
import { type Arg } from "./arg.js";
import { bind } from "./bind.js";
import {
    booleanT,
    boxedT,
    bufferT,
    callbackT,
    int32T,
    int64T,
    matchInfoT,
    stringT,
    uint32T,
    uint64T,
} from "./descriptors.js";
import { fn } from "./fn.js";
import { LIB } from "./library.js";
import { getHandle } from "./registry.js";

type MatchParams = {
    regex: object;
    subject: string | string[] | Uint8Array | number[];
    startPosition: number;
    matchOptions: number;
};

type Subject = {
    data: ExternalObject<Handle>;
    length: number;
};

type RegexEvaluator = (info: never, result: never) => boolean;
type RegexMatch<MatchInfo extends object> = (
    regex: object,
    subject: MatchParams["subject"],
    startPosition: number,
    matchOptions: number,
) => [boolean, MatchInfo];
type RegexBindings<MatchInfo extends object> = {
    matchRegex: RegexMatch<MatchInfo>;
    matchAllRegex: RegexMatch<MatchInfo>;
    replaceRegexEval: (params: MatchParams, shouldStop: RegexEvaluator) => string;
};

const encoder = new TextEncoder();
const memcpy = bind("libc.so.6", "memcpy", [bufferT, bufferT, uint64T], bufferT);

const encodeSubject = (subject: MatchParams["subject"]): Uint8Array => {
    if (typeof subject === "string") {
        return encoder.encode(subject);
    }
    if (Array.isArray(subject) && subject.every((part) => typeof part === "string")) {
        return encoder.encode(subject.join(""));
    }
    const encoded = new Uint8Array(subject.length);
    encoded.set(subject);

    return encoded;
};

const createSubject = (subject: MatchParams["subject"]): Subject => {
    const encoded = encodeSubject(subject);
    const data = alloc(encoded.length + 1);
    if (encoded.length > 0) {
        memcpy(data, encoded, encoded.length);
    }
    return { data, length: encoded.length };
};

const matchWithSubject =
    <MatchInfo extends object>(boundFn: (...inputs: unknown[]) => unknown): RegexMatch<MatchInfo> =>
    (regex, subject, startPosition, matchOptions) => {
        const input = createSubject(subject);
        return boundFn(getHandle(regex), input.data, input.length, startPosition, matchOptions) as [boolean, MatchInfo];
    };

/** Binds regex operations while retaining the generated MatchInfo wrapper and each searched subject. */
function createRegexBindings<MatchInfo extends object>(cls: AnyClass<MatchInfo>): RegexBindings<MatchInfo> {
    const fallbackClass = (): AnyClass<MatchInfo> => cls;
    const matchArgs: Arg[] = [
        {
            type: boxedT("GRegex", { ownership: "borrowed", sharedLibrary: LIB, getTypeFnName: "g_regex_get_type" }),
        },
        { type: bufferT },
        { type: int64T },
        { type: int32T },
        { type: uint32T },
        { type: matchInfoT("full", 1, fallbackClass), direction: "out" },
    ];
    const gRegexMatchFull = fn(LIB, "g_regex_match_full", { args: matchArgs, returns: booleanT, canThrow: true });
    const gRegexMatchAllFull = fn(LIB, "g_regex_match_all_full", {
        args: matchArgs,
        returns: booleanT,
        canThrow: true,
    });
    const gRegexReplaceEval = fn(LIB, "g_regex_replace_eval", {
        args: [
            ...matchArgs.slice(0, 5),
            {
                type: callbackT(
                    [
                        matchInfoT("borrowed", 1, fallbackClass),
                        boxedT("GString", {
                            ownership: "borrowed",
                            sharedLibrary: LIB,
                            getTypeFnName: "g_gstring_get_type",
                        }),
                        bufferT,
                    ],
                    booleanT,
                    { hasUserData: true, userDataIndex: 2, scope: "call" },
                ),
                isRequired: true,
            },
        ],
        returns: stringT("full"),
        canThrow: true,
    });

    return {
        matchRegex: matchWithSubject<MatchInfo>(gRegexMatchFull),
        matchAllRegex: matchWithSubject<MatchInfo>(gRegexMatchAllFull),
        replaceRegexEval({ regex, subject, startPosition, matchOptions }, shouldStop) {
            const input = createSubject(subject);
            return gRegexReplaceEval(
                getHandle(regex),
                input.data,
                input.length,
                startPosition,
                matchOptions,
                shouldStop,
            ) as string;
        },
    };
}

export { createRegexBindings };
