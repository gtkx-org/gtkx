import { createRegexBindings } from "@gtkx/runtime/internal";
import { MatchInfo, Regex, type RegexEvalCallback, type RegexMatchFlags } from "../glib.js";

const { matchAllRegex, matchRegex, replaceRegexEval } = createRegexBindings(MatchInfo);

declare module "../glib.js" {
    interface Regex {
        /**
         * Scans for a match in `string` for the pattern in `this`.
         *
         * The returned `MatchInfo` keeps the searched string alive, so its fetch
         * methods stay valid for as long as the `MatchInfo` is reachable.
         *
         * @param string the string to scan for matches
         * @param startPosition starting index of the string to match, in bytes
         * @param matchOptions match options
         * @returns Tuple of:
         *
         * - `result`: `true` if the string matched, `false` otherwise
         * - `matchInfo`: owning match context for fetching matched ranges
         * @throws A `GLib.Error` carrying the failing operation's domain, code, and message.
         * @since 2.14
         */
        matchFull(string: string, startPosition: number, matchOptions: RegexMatchFlags): [boolean, MatchInfo];
        matchFull(string: string[], startPosition: number, matchOptions: RegexMatchFlags): [boolean, MatchInfo];
        matchFull(
            string: Uint8Array | number[],
            startPosition: number,
            matchOptions: RegexMatchFlags,
        ): [boolean, MatchInfo];
        /**
         * Using the DFA algorithm, scans for all the possible matches in `string`,
         * including overlapping ones.
         *
         * The returned `MatchInfo` keeps the searched string alive, so its fetch
         * methods stay valid for as long as the `MatchInfo` is reachable.
         *
         * @param string the string to scan for matches
         * @param startPosition starting index of the string to match, in bytes
         * @param matchOptions match options
         * @returns Tuple of:
         *
         * - `result`: `true` if the string matched, `false` otherwise
         * - `matchInfo`: owning match context for fetching matched ranges
         * @throws A `GLib.Error` carrying the failing operation's domain, code, and message.
         * @since 2.14
         */
        matchAllFull(string: string, startPosition: number, matchOptions: RegexMatchFlags): [boolean, MatchInfo];
        matchAllFull(string: string[], startPosition: number, matchOptions: RegexMatchFlags): [boolean, MatchInfo];
        matchAllFull(
            string: Uint8Array | number[],
            startPosition: number,
            matchOptions: RegexMatchFlags,
        ): [boolean, MatchInfo];
        replaceEval(
            string: string,
            startPosition: number,
            matchOptions: RegexMatchFlags,
            eval_: RegexEvalCallback,
        ): string;
        replaceEval(
            string: string[],
            startPosition: number,
            matchOptions: RegexMatchFlags,
            eval_: RegexEvalCallback,
        ): string;
        replaceEval(
            string: Uint8Array | number[],
            startPosition: number,
            matchOptions: RegexMatchFlags,
            eval_: RegexEvalCallback,
        ): string;
    }
}

Regex.prototype.match = function (this: Regex, subject: string, matchOptions: RegexMatchFlags): [boolean, MatchInfo] {
    return matchRegex(this, subject, 0, matchOptions);
};

Regex.prototype.matchAll = function (
    this: Regex,
    subject: string,
    matchOptions: RegexMatchFlags,
): [boolean, MatchInfo] {
    return matchAllRegex(this, subject, 0, matchOptions);
};

Regex.prototype.matchFull = function (
    this: Regex,
    subject: string | string[] | Uint8Array | number[],
    startPosition: number,
    matchOptions: RegexMatchFlags,
): [boolean, MatchInfo] {
    return matchRegex(this, subject, startPosition, matchOptions);
};

Regex.prototype.matchAllFull = function (
    this: Regex,
    subject: string | string[] | Uint8Array | number[],
    startPosition: number,
    matchOptions: RegexMatchFlags,
): [boolean, MatchInfo] {
    return matchAllRegex(this, subject, startPosition, matchOptions);
};

Regex.prototype.replaceEval = function (
    this: Regex,
    subject: string | string[] | Uint8Array | number[],
    startPosition: number,
    matchOptions: RegexMatchFlags,
    shouldStop: RegexEvalCallback,
): string {
    return replaceRegexEval({ regex: this, subject, startPosition, matchOptions }, shouldStop);
};
