import {
    ConvertError,
    convertErrorQuark,
    FileError,
    fileErrorFromErrno,
    fileErrorQuark,
    Error as GError,
} from "@gtkx/gi/glib";
import { constants } from "node:os";
import { describe, expect, it } from "vitest";

describe("generated error domains", () => {
    it("exposes enum members matching native error codes", () => {
        expect(fileErrorFromErrno(constants.errno.ENOENT)).toBe(FileError.NOENT);
        expect(fileErrorFromErrno(constants.errno.EACCES)).toBe(FileError.ACCES);
    });

    it("rejects values outside its domain", () => {
        const foreign = GError.newLiteral(convertErrorQuark(), ConvertError.NO_CONVERSION, "conversion failed");
        for (const value of [foreign, new Error("plain"), null, 42]) {
            expect(value).not.toBeInstanceOf(FileError);
        }
    });

    it("matches a generated error-domain enum by its GLib quark", () => {
        const gerror = GError.newLiteral(fileErrorQuark(), FileError.NOENT, "missing file");
        expect(gerror).toBeInstanceOf(FileError);
    });
});
