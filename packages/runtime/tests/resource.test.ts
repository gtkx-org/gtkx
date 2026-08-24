import { type ExternalObject, type Handle, t } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";

type Pointer = ExternalObject<Handle>;
type PointerRef = { value: Pointer | null };
type ResourceFactory = ReturnType<typeof t.resource>;
type BoundFunction = ReturnType<typeof t.bind>;

type UriParts = {
    scheme: PointerRef;
    userinfo: PointerRef;
    host: PointerRef;
    path: PointerRef;
    query: PointerRef;
    fragment: PointerRef;
};

const GLIB = "libglib-2.0.so.0";
const RESOURCE = t.resource(GLIB, "g_free");
const CHAR_POINTER = t.boxed("gchar*", { ownership: "borrowed", sharedLibrary: GLIB });

const ERROR_POINTER = t.boxed("GError", {
    ownership: "full",
    sharedLibrary: GLIB,
    getTypeFnName: "g_error_get_type",
});

const BYTE = t.fieldAt(t.uint8);
const split = bindUriSplit(RESOURCE);
const free = t.bind(GLIB, "g_free", [RESOURCE.end(CHAR_POINTER)], t.void);

function bindUriSplit(resource: ResourceFactory): BoundFunction {
    return t.bind(
        GLIB,
        "g_uri_split",
        [
            t.string(),
            t.uint32,
            t.ref(resource.result(CHAR_POINTER)),
            t.ref(resource.result(CHAR_POINTER)),
            t.ref(resource.result(CHAR_POINTER)),
            t.ref(t.int32),
            t.ref(resource.result(CHAR_POINTER)),
            t.ref(resource.result(CHAR_POINTER)),
            t.ref(resource.result(CHAR_POINTER)),
            t.ref(ERROR_POINTER),
        ],
        t.boolean,
    );
}

const pointerRef = (): PointerRef => ({ value: null });

const uriParts = (fragment: PointerRef = pointerRef()): UriParts => ({
    scheme: pointerRef(),
    userinfo: pointerRef(),
    host: pointerRef(),
    path: pointerRef(),
    query: pointerRef(),
    fragment,
});

const getRefs = (parts: UriParts): PointerRef[] => [
    parts.scheme,
    parts.userinfo,
    parts.host,
    parts.path,
    parts.query,
    parts.fragment,
];

const splitUriWith = (bound: BoundFunction, uri: string, parts: UriParts): { ok: boolean; port: number } => {
    const port = { value: 0 };

    const isSuccessful = bound(
        uri,
        0,
        parts.scheme,
        parts.userinfo,
        parts.host,
        port,
        parts.path,
        parts.query,
        parts.fragment,
        null,
    ) as boolean;

    return { ok: isSuccessful, port: port.value };
};

const splitUri = (uri: string, parts: UriParts): { ok: boolean; port: number } => splitUriWith(split, uri, parts);

const readString = (pointer: Pointer): string => {
    const bytes: number[] = [];

    for (let offset = 0; offset < 256; offset++) {
        const byte = BYTE.read(pointer, offset) as number;

        if (byte === 0) {
            return String.fromCodePoint(...bytes);
        }

        bytes.push(byte);
    }

    throw new RangeError("URI component exceeded its maximum expected length");
};

const readPart = (ref: PointerRef): string | null => (ref.value === null ? null : readString(ref.value));

const releaseRefs = (refs: PointerRef[]): void => {
    for (const ref of refs) {
        if (ref.value !== null) {
            free(ref.value);
        }
    }
};

const releaseParts = (parts: UriParts): void => {
    releaseRefs(getRefs(parts));
};

const getPointer = (ref: PointerRef): Pointer => {
    if (ref.value === null) {
        throw new Error("Expected a native pointer output");
    }

    return ref.value;
};

const rejectingRef = (): PointerRef => ({
    get value() {
        return null;
    },
    set value(_value: Pointer | null) {
        throw new Error("Reject the resource output");
    },
});

const readInstalledResourceAfterFailure = (parts: UriParts): void => {
    try {
        splitUri("https://user@example.com:8080/path?query#fragment", parts);
    } catch {
        if (parts.scheme.value !== null) {
            BYTE.read(parts.scheme.value, 0);
        }
    }
};

describe("unary resource descriptors", () => {
    it("adopts and explicitly releases native output buffers", () => {
        const parts = uriParts();

        try {
            expect(splitUri("https://user@example.com:8080/path?query#fragment", parts)).toEqual({
                ok: true,
                port: 8080,
            });

            expect(getRefs(parts).map((ref) => readPart(ref))).toEqual([
                "https",
                "user",
                "example.com",
                "/path",
                "query",
                "fragment",
            ]);
        } finally {
            releaseParts(parts);
        }
    });
});

describe("unary resource descriptor edge cases", () => {
    it("leaves URI components the native call omits as null", () => {
        const parts = uriParts();

        try {
            expect(splitUri("https://example.com", parts)).toEqual({ ok: true, port: -1 });

            expect(getRefs(parts).map((ref) => readPart(ref))).toEqual([
                "https",
                null,
                "example.com",
                "",
                null,
                null,
            ]);
        } finally {
            releaseParts(parts);
        }

        const port = { value: 0 };

        expect(
            split("https://example.com", 0, null, null, null, port, null, null, null, null),
        ).toBe(true);

        expect(port.value).toBe(-1);
    });
});

describe("unary resource descriptor errors", () => {
    it("rejects invalid lifecycles and rolls back a failed ref write", () => {
        const endedParts = uriParts();
        splitUri("https://example.com", endedParts);
        const sharedAlias = getPointer(endedParts.scheme);

        try {
            free(getPointer(endedParts.scheme));

            expect(() => {
                BYTE.read(sharedAlias, 0);
            }).toThrow();

            expect(() => {
                free(sharedAlias);
            }).toThrow();
        } finally {
            releaseRefs(getRefs(endedParts).slice(1));
        }

        expect(() => t.bind(GLIB, "g_strfreev", [RESOURCE.end(CHAR_POINTER)], t.void)).toThrow();
        expect(() => t.bind(GLIB, "g_free", [RESOURCE.end(CHAR_POINTER), t.uint32], t.void)).toThrow();
        expect(() => t.bind(GLIB, "g_free", [RESOURCE.end(CHAR_POINTER)], t.int32)).toThrow();
        const unavailable = t.resource(GLIB, "gtkx_missing_resource_release");
        const unavailableProducer = bindUriSplit(unavailable);
        const unavailableParts = uriParts();

        expect(() => {
            splitUriWith(unavailableProducer, "https://example.com", unavailableParts);
        }).toThrow();

        const rollbackParts = uriParts(rejectingRef());

        expect(() => {
            readInstalledResourceAfterFailure(rollbackParts);
        }).toThrow();
    });
});
