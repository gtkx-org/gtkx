import type { ErrorDomain } from "@gtkx/runtime";
import { Error as GLibError, type Quark } from "../glib.js";

declare module "../glib.js" {
    interface Error {
        /**
         * Returns `true` if `this` matches `domain` and `code`, `false` otherwise.
         *
         * As in GJS, `domain` may be a generated error domain such as `Gio.IOErrorEnum`
         * instead of its quark.
         *
         * @param domain an error domain, or its quark
         * @param code an error code
         * @returns whether `this` has `domain` and `code`
         */
        matches(domain: Quark | ErrorDomain<Record<string, number>>, code: number): boolean;
    }
}

GLibError.prototype.matches = function (
    this: GLibError,
    domain: Quark | ErrorDomain<Record<string, number>>,
    code: number,
): boolean {
    return this.domain === Number(domain) && this.code === code;
};
