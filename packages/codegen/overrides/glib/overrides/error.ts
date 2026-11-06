import type { ErrorDomain } from "@gtkx/runtime";
import { Error as GeneratedError, type Quark } from "../glib.js";

/** An error domain: a generated domain such as `Gio.IOErrorEnum`, or its quark. */
type ErrorDomainInput = Quark | ErrorDomain<Record<never, number>>;

type Error = GeneratedError;

type ErrorStatics = Omit<typeof GeneratedError, "newLiteral"> & {
    /**
     * Creates a new `GError`; unlike `g_error_new()`, `message` is not a `printf()`-style format string.
     * As in GJS, `domain` may be a generated error domain such as `Gio.IOErrorEnum` instead of its quark.
     *
     * @param domain an error domain, or its quark
     * @param code an error code
     * @param message an error message
     * @returns a new `GError`
     */
    newLiteral: (domain: ErrorDomainInput, code: number, message: string) => Error;
};

/** The native error class with GJS-compatible construction and its existing native factory methods. */
type ErrorConstructor = ErrorStatics & {
    /**
     * Creates a new `GError`, as `GLib.Error.newLiteral()` does. As in GJS, `domain` may be a generated
     * error domain such as `Gio.IOErrorEnum` instead of its quark.
     */
    new (domain: ErrorDomainInput, code: number, message: string): Error;
};

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
        matches(domain: ErrorDomainInput, code: number): boolean;
    }
}

GeneratedError.prototype.matches = function (this: GeneratedError, domain: ErrorDomainInput, code: number): boolean {
    return this.domain === Number(domain) && this.code === code;
};

const quarkOf = (domain: unknown): Quark => {
    const quark = typeof domain === "number" || typeof domain === "object" ? Number(domain) : Number.NaN;

    if (!Number.isInteger(quark) || quark <= 0) {
        throw new TypeError("GLib.Error requires an error domain, such as Gio.IOErrorEnum, or its quark");
    }

    return quark;
};

const newLiteral = (domain: ErrorDomainInput, code: number, message: string): Error =>
    GeneratedError.newLiteral(quarkOf(domain), code, message);

/**
 * Creates errors as GJS does, with `new GLib.Error(Gio.IOErrorEnum, Gio.IOErrorEnum.FAILED, message)`, a shorthand
 * for `GLib.Error.newLiteral()`. Throw the result from a virtual function or pass it to a function such as
 * `Gio.Task.returnError()`.
 */
const Error: ErrorConstructor = /* @__PURE__ */ (() =>
    new Proxy(GeneratedError, {
        get(target, property, receiver): unknown {
            if (property === "newLiteral") {
                return newLiteral;
            }

            const value: unknown = Reflect.get(target, property, receiver);

            return value;
        },
        construct(_target, args: unknown[]): Error {
            const [domain, code, message] = args;

            if (typeof code !== "number" || typeof message !== "string") {
                throw new TypeError("GLib.Error requires an error domain, a numeric code and a message");
            }

            return GeneratedError.newLiteral(quarkOf(domain), code, message);
        },
    }) as typeof GeneratedError & ErrorConstructor)();

export { Error, type ErrorConstructor };
