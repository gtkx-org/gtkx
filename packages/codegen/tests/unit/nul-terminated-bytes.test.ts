import { describe, expect, it } from "vitest";
import type { GirFunction } from "../../src/gir/function.js";
import { nulTerminatedByteParams } from "../../src/analysis/nul-terminated-bytes.js";
import { library, locateCallable } from "../helpers/library.js";

type Expectation = [cIdentifier: string, truncatingParams: string[]];

const EXPECTATIONS: Expectation[] = [
    ["g_variant_new_bytestring", ["string"]],
    ["g_strsplit_set", ["delimiters"]],
    ["g_variant_new_from_bytes", []],
    ["g_variant_new_string", []],
    ["g_base64_decode_inplace", []],
    ["g_bytes_new", []],
    ["g_compute_checksum_for_data", []],
];

const locate = (cIdentifier: string): GirFunction | undefined => locateCallable(cIdentifier)?.callable;

describe("nulTerminatedByteParams", () => {
    it.each(EXPECTATIONS)("names the truncating parameters of %s", (cIdentifier, truncatingParams) => {
        const callable = locate(cIdentifier);
        expect(callable).toBeDefined();
        expect(nulTerminatedByteParams(library, callable as GirFunction).map((p) => p.name)).toEqual(truncatingParams);
    });

    it("matches a gchar pointer c:type, not only a bare char pointer", () => {
        const callable = locate("g_variant_new_bytestring");
        const parameter = nulTerminatedByteParams(library, callable as GirFunction)[0];
        const ref = parameter?.type;
        const type = ref === undefined ? undefined : library.typeFor(ref);
        expect(type?.kind).toBe("carray");
        expect(type?.kind === "carray" ? type.arrayCType : undefined).toBe("const gchar*");
    });
});
