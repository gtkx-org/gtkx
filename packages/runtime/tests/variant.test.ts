import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import { fromVariant, toVariant } from "@gtkx/runtime";
import { afterEach, describe, expect, it } from "vitest";

const OBJECT_PATH = "/com/example/VariantProbe";
const INTERFACE_NAME = "com.example.VariantProbe";
const CALL_TIMEOUT_MS = 5000;

const INTERFACE_XML =
    "<node><interface name='com.example.VariantProbe'>" +
    "<method name='Echo'><arg type='a{sv}' name='options' direction='in'/>" +
    "<arg type='as' name='seen' direction='out'/><arg type='i' name='count' direction='out'/>" +
    "</method></interface></node>";

const registrations: { connection: Gio.DBusConnection; id: number }[] = [];

const parse = (text: string): GLib.Variant => GLib.Variant.parse(null, text, null, null);

const getInterfaceInfo = (): Gio.DBusInterfaceInfo => {
    const info = Gio.DBusNodeInfo.newForXml(INTERFACE_XML).lookupInterface(INTERFACE_NAME);

    if (info === null) {
        throw new Error(`missing interface info for ${INTERFACE_NAME}`);
    }

    return info;
};

const echoOptions = (...args: unknown[]): void => {
    const [options] = fromVariant("(a{sv})", args[5] as GLib.Variant);
    const seen = Object.entries(options).map(([key, held]) => `${key}=${String(fromVariant("i", held))}`);
    (args[6] as Gio.DBusMethodInvocation).returnValue(toVariant("(asi)", [seen, seen.length]));
};

const registerProbe = (connection: Gio.DBusConnection): void => {
    const id = connection.registerObjectWithClosures2(OBJECT_PATH, getInterfaceInfo(), echoOptions, null, null);
    registrations.push({ connection, id });
};

afterEach(() => {
    for (const { connection, id } of registrations) {
        connection.unregisterObject(id);
    }

    registrations.length = 0;
});

describe("a value packed for a basic GVariant type", () => {
    it("builds the same variant GLib parses from its own text", () => {
        expect(toVariant("b", true).equal(parse("true"))).toBe(true);
        expect(toVariant("y", 255).equal(parse("@y 255"))).toBe(true);
        expect(toVariant("n", -32_768).equal(parse("@n -32768"))).toBe(true);
        expect(toVariant("q", 65_535).equal(parse("@q 65535"))).toBe(true);
        expect(toVariant("i", -42).equal(parse("@i -42"))).toBe(true);
        expect(toVariant("u", 4_294_967_295).equal(parse("@u 4294967295"))).toBe(true);
        expect(toVariant("d", 1.5).equal(parse("@d 1.5"))).toBe(true);
        expect(toVariant("x", -9_007_199_254_740_993n).equal(parse("@x -9007199254740993"))).toBe(true);
        expect(toVariant("t", 18_446_744_073_709_551_615n).equal(parse("@t 18446744073709551615"))).toBe(true);
        expect(toVariant("s", "hello").equal(parse("'hello'"))).toBe(true);
        expect(toVariant("o", OBJECT_PATH).equal(parse(`@o '${OBJECT_PATH}'`))).toBe(true);
        expect(toVariant("g", "a{sv}").equal(parse("@g 'a{sv}'"))).toBe(true);
    });

    it("round trips every basic type back to the value it was packed from", () => {
        expect(fromVariant("b", toVariant("b", false))).toBe(false);
        expect(fromVariant("y", toVariant("y", 7))).toBe(7);
        expect(fromVariant("n", toVariant("n", -3))).toBe(-3);
        expect(fromVariant("q", toVariant("q", 3))).toBe(3);
        expect(fromVariant("i", toVariant("i", -2_147_483_648))).toBe(-2_147_483_648);
        expect(fromVariant("u", toVariant("u", 4_294_967_295))).toBe(4_294_967_295);
        expect(fromVariant("h", toVariant("h", 2))).toBe(2);
        expect(fromVariant("d", toVariant("d", -0.25))).toBe(-0.25);
        expect(fromVariant("x", toVariant("x", -9_223_372_036_854_775_808n))).toBe(-9_223_372_036_854_775_808n);
        expect(fromVariant("t", toVariant("t", 18_446_744_073_709_551_615n))).toBe(18_446_744_073_709_551_615n);
        expect(fromVariant("s", toVariant("s", ""))).toBe("");
        expect(fromVariant("o", toVariant("o", OBJECT_PATH))).toBe(OBJECT_PATH);
        expect(fromVariant("g", toVariant("g", "(ii)"))).toBe("(ii)");
    });

    it("hands back the variant a boxed variant holds", () => {
        const boxed = toVariant("v", toVariant("i", 42));
        expect(fromVariant("i", fromVariant("v", boxed))).toBe(42);
    });
});

describe("a value packed for a container type", () => {
    it("builds the same arrays, tuples, dictionaries and maybes GLib parses from their own text", () => {
        expect(toVariant("as", ["a", "b"]).equal(parse("@as ['a', 'b']"))).toBe(true);
        expect(toVariant("(si)", ["a", 1]).equal(parse("@(si) ('a', 1)"))).toBe(true);
        expect(toVariant("a{ss}", { k: "v" }).equal(parse("@a{ss} {'k': 'v'}"))).toBe(true);
        expect(toVariant("ms", "x").equal(parse("@ms 'x'"))).toBe(true);
        expect(toVariant("ms", null).equal(parse("@ms nothing"))).toBe(true);
        expect(toVariant("aai", [[1], []]).equal(parse("@aai [[1], []]"))).toBe(true);
    });

    it("unpacks what GLib parsed back into the shape the type describes", () => {
        expect(fromVariant("as", parse("@as ['a', 'b']"))).toEqual(["a", "b"]);
        expect(fromVariant("(si)", parse("@(si) ('a', 1)"))).toEqual(["a", 1]);
        expect(fromVariant("a{ss}", parse("@a{ss} {'k': 'v'}"))).toEqual({ k: "v" });
        expect(fromVariant("ms", parse("@ms nothing"))).toBeNull();
        const held = Object.entries(fromVariant("a{sv}", parse("@a{sv} {'answer': <42>}")));
        expect(held.map(([key]) => key)).toEqual(["answer"]);
        expect(held.map(([, value]) => fromVariant("i", value))).toEqual([42]);
    });

    it("round trips a shape nesting arrays, tuples and dictionaries", () => {
        const value: [string, Record<string, string[]>][] = [["one", { a: ["b", "c"] }], ["two", {}]];
        expect(fromVariant("a(sa{sas})", toVariant("a(sa{sas})", value))).toEqual(value);
    });

    it("unpacks a dictionary keyed by strings into a record and one keyed by anything else into a map", () => {
        expect(fromVariant("a{si}", toVariant("a{si}", { a: 1 }))).toEqual({ a: 1 });
        expect(fromVariant("a{os}", toVariant("a{os}", { [OBJECT_PATH]: "v" }))).toEqual({ [OBJECT_PATH]: "v" });
        const keyedByNumbers = fromVariant("a{is}", toVariant("a{is}", new Map([[1, "a"]])));
        expect(keyedByNumbers).toBeInstanceOf(Map);
        expect([...keyedByNumbers]).toEqual([[1, "a"]]);
        const keyedByBooleans = fromVariant("a{bs}", toVariant("a{bs}", new Map([[true, "a"]])));
        expect([...keyedByBooleans]).toEqual([[true, "a"]]);
    });

    it("unpacks a standalone dictionary entry into a key and value pair", () => {
        expect(fromVariant("{ss}", toVariant("{ss}", ["k", "v"]))).toEqual(["k", "v"]);
    });
});

describe("a container holding nothing", () => {
    it("keeps the type it was packed for", () => {
        expect(toVariant("as", []).getTypeString()).toBe("as");
        expect(toVariant("a{sv}", {}).getTypeString()).toBe("a{sv}");
        expect(toVariant("()", []).getTypeString()).toBe("()");
        expect(toVariant("ms", null).getTypeString()).toBe("ms");
    });

    it("round trips back to the empty value", () => {
        expect(fromVariant("as", toVariant("as", []))).toEqual([]);
        expect(fromVariant("a{ss}", toVariant("a{ss}", {}))).toEqual({});
        expect(fromVariant("()", toVariant("()", []))).toEqual([]);
        const empty: Map<number, string> = new Map();
        expect([...fromVariant("a{is}", toVariant("a{is}", empty))]).toEqual([]);
    });
});

describe("a maybe type", () => {
    it("carries a present and an absent value through the same type", () => {
        expect(fromVariant("ms", toVariant("ms", "x"))).toBe("x");
        expect(fromVariant("ms", toVariant("ms", null))).toBeNull();
    });

    it("carries both inside a container", () => {
        expect(fromVariant("ams", toVariant("ams", ["a", null]))).toEqual(["a", null]);
        expect(fromVariant("mas", toVariant("mas", null))).toBeNull();
        expect(fromVariant("mas", toVariant("mas", []))).toEqual([]);
    });
});

describe("a type string that is not one complete GVariant type", () => {
    it("is refused instead of building a variant", () => {
        expect(() => toVariant("", null)).toThrow();
        expect(() => toVariant("z", 1)).toThrow();
        expect(() => toVariant("ss", "a")).toThrow();
        expect(() => toVariant("a", [])).toThrow();
        expect(() => toVariant("(si", ["a", 1])).toThrow();
        expect(() => toVariant("{sv", ["a", 1])).toThrow();
        expect(() => toVariant("{vs}", ["a", "b"])).toThrow();
        expect(() => toVariant("{as}", [["a"], "b"])).toThrow();
    });

    it("is refused when reading a variant too", () => {
        expect(() => fromVariant("qq", toVariant("q", 1))).toThrow();
        expect(() => fromVariant("m", toVariant("q", 1))).toThrow();
    });
});

describe("a string packed where an object path or a type signature belongs", () => {
    it("is refused when it is not one", () => {
        expect(() => toVariant("o", "not a path")).toThrow();
        expect(() => toVariant("g", "not a signature")).toThrow();
        expect(() => toVariant("a{os}", { "not a path": "v" })).toThrow();
    });
});

describe("a dictionary packed for a D-Bus call", () => {
    it("carries the arguments the remote method unpacks and the reply the caller reads back", async () => {
        const connection = Gio.busGetSync(Gio.BusType.SESSION, null);
        registerProbe(connection);

        const reply = await connection.call(
            connection.getUniqueName(),
            OBJECT_PATH,
            INTERFACE_NAME,
            "Echo",
            toVariant("(a{sv})", [{ first: toVariant("i", 1), second: toVariant("i", 2) }]),
            null,
            Gio.DBusCallFlags.NONE,
            CALL_TIMEOUT_MS,
            null,
        );

        const [seen, count] = fromVariant("(asi)", reply);
        expect(seen).toEqual(["first=1", "second=2"]);
        expect(count).toBe(2);
    });
});

describe("a byte array type", () => {
    it("packs a Uint8Array and an array of byte values into the same variant GLib parses from its own text", () => {
        const packed = toVariant("ay", new Uint8Array([1, 2, 3]));
        expect(packed.equal(parse("@ay [1, 2, 3]"))).toBe(true);
        expect(toVariant("ay", [1, 2, 3]).equal(packed)).toBe(true);
        expect(packed.getTypeString()).toBe("ay");
        const bytes = fromVariant("ay", toVariant("ay", [7, 8]));
        expect(bytes).toBeInstanceOf(Uint8Array);
        expect(bytes).toEqual(new Uint8Array([7, 8]));
    });

    it("carries empty and nested byte arrays through containers", () => {
        const empty = new Uint8Array();
        expect(fromVariant("ay", toVariant("ay", empty))).toEqual(empty);
        expect(fromVariant("ay", toVariant("ay", []))).toEqual(empty);
        const nested = toVariant("aay", [new Uint8Array([1]), [2, 3]]);
        expect(fromVariant("aay", nested)).toEqual([new Uint8Array([1]), new Uint8Array([2, 3])]);
        const present = toVariant("may", new Uint8Array([4]));
        expect(fromVariant("may", present)).toEqual(new Uint8Array([4]));
        expect(fromVariant("may", toVariant("may", null))).toBeNull();
    });

    it("is refused when packed from anything else", () => {
        const byteArrayType = "ay" as string;
        expect(() => toVariant(byteArrayType, "bytes")).toThrow();
        expect(() => toVariant(byteArrayType, 7)).toThrow();
        expect(() => toVariant(byteArrayType, null)).toThrow();
        expect(() => toVariant(byteArrayType, { 0: 1 })).toThrow();
    });
});

describe("a variant read without a type string", () => {
    it("derives the shape from the variant's own type", () => {
        expect(fromVariant(toVariant("i", -3))).toBe(-3);
        expect(fromVariant(toVariant("(si)", ["a", 1]))).toEqual(["a", 1]);
        expect(fromVariant(toVariant("a{ss}", { k: "v" }))).toEqual({ k: "v" });
        const bytes = toVariant("ay", new Uint8Array([9]));
        expect(fromVariant(bytes)).toEqual(new Uint8Array([9]));
    });

    it("keeps a nested variant boxed and reads empty containers", () => {
        const boxed = toVariant("v", toVariant("i", 5));
        expect(fromVariant(boxed)).toBeInstanceOf(GLib.Variant);
        expect(fromVariant(toVariant("as", []))).toEqual([]);
        expect(fromVariant(toVariant("ms", null))).toBeNull();
    });

    it("is refused when what it reads is not a variant", () => {
        expect(() => fromVariant({} as GLib.Variant)).toThrow();
    });
});

describe("a variant unpacked recursively", () => {
    it("unwraps the variants a dictionary boxes its values in", () => {
        const bytes = toVariant("ay", new Uint8Array([1, 2]));

        const packed = toVariant("a{sv}", {
            count: toVariant("i", 5),
            data: toVariant("v", bytes),
            name: toVariant("s", "hi"),
        });

        const expected = { count: 5, data: new Uint8Array([1, 2]), name: "hi" };
        expect(fromVariant("a{sv}", packed, { recursive: true })).toEqual(expected);
        expect(fromVariant(packed, { recursive: true })).toEqual(expected);
    });

    it("reads a variant boxed inside another all the way down", () => {
        const doubled = toVariant("v", toVariant("v", toVariant("i", 8)));
        expect(fromVariant("v", doubled, { recursive: true })).toBe(8);
        expect(fromVariant("v", doubled, { recursive: false })).toBeInstanceOf(GLib.Variant);
        expect(fromVariant("(si)", toVariant("(si)", ["a", 1]), { recursive: true })).toEqual(["a", 1]);
        expect(fromVariant("mv", toVariant("mv", null), { recursive: true })).toBeNull();
    });

    it("is refused when the type string is not one complete GVariant type", () => {
        expect(() => fromVariant("m", toVariant("q", 1), { recursive: true })).toThrow();
        expect(() => fromVariant("qq", toVariant("q", 1), { recursive: true })).toThrow();
    });
});
