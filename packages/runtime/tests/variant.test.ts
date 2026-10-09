import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
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
    const [options] = (args[5] as GLib.Variant).deepUnpack<"(a{sv})">();
    const seen = Object.entries(options).map(([key, held]) => `${key}=${String(held.deepUnpack<"i">())}`);
    (args[6] as Gio.DBusMethodInvocation).returnValue(new GLib.Variant("(asi)", [seen, seen.length]));
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
        expect(new GLib.Variant("b", true).equal(parse("true"))).toBe(true);
        expect(new GLib.Variant("y", 255).equal(parse("@y 255"))).toBe(true);
        expect(new GLib.Variant("n", -32_768).equal(parse("@n -32768"))).toBe(true);
        expect(new GLib.Variant("q", 65_535).equal(parse("@q 65535"))).toBe(true);
        expect(new GLib.Variant("i", -42).equal(parse("@i -42"))).toBe(true);
        expect(new GLib.Variant("u", 4_294_967_295).equal(parse("@u 4294967295"))).toBe(true);
        expect(new GLib.Variant("d", 1.5).equal(parse("@d 1.5"))).toBe(true);
        expect(new GLib.Variant("x", -9_007_199_254_740_993n).equal(parse("@x -9007199254740993"))).toBe(true);
        expect(new GLib.Variant("t", 18_446_744_073_709_551_615n).equal(parse("@t 18446744073709551615"))).toBe(true);
        expect(new GLib.Variant("s", "hello").equal(parse("'hello'"))).toBe(true);
        expect(new GLib.Variant("o", OBJECT_PATH).equal(parse(`@o '${OBJECT_PATH}'`))).toBe(true);
        expect(new GLib.Variant("g", "a{sv}").equal(parse("@g 'a{sv}'"))).toBe(true);
    });

    it("round trips every basic type back to the value it was packed from", () => {
        expect(new GLib.Variant("b", false).deepUnpack()).toBe(false);
        expect(new GLib.Variant("y", 7).deepUnpack()).toBe(7);
        expect(new GLib.Variant("n", -3).deepUnpack()).toBe(-3);
        expect(new GLib.Variant("q", 3).deepUnpack()).toBe(3);
        expect(new GLib.Variant("i", -2_147_483_648).deepUnpack()).toBe(-2_147_483_648);
        expect(new GLib.Variant("u", 4_294_967_295).deepUnpack()).toBe(4_294_967_295);
        expect(new GLib.Variant("h", 2).deepUnpack()).toBe(2);
        expect(new GLib.Variant("d", -0.25).deepUnpack()).toBe(-0.25);
        expect(new GLib.Variant("x", -9_223_372_036_854_775_808n).deepUnpack()).toBe(-9_223_372_036_854_775_808n);
        expect(new GLib.Variant("t", 18_446_744_073_709_551_615n).deepUnpack()).toBe(18_446_744_073_709_551_615n);
        expect(new GLib.Variant("s", "").deepUnpack()).toBe("");
        expect(new GLib.Variant("o", OBJECT_PATH).deepUnpack()).toBe(OBJECT_PATH);
        expect(new GLib.Variant("g", "(ii)").deepUnpack()).toBe("(ii)");
    });

    it("hands back the variant a boxed variant holds", () => {
        const boxed = new GLib.Variant("v", new GLib.Variant("i", 42));
        expect(boxed.deepUnpack().deepUnpack<"i">()).toBe(42);
    });
});

describe("a value packed for a container type", () => {
    it("builds the same arrays, tuples, dictionaries and maybes GLib parses from their own text", () => {
        expect(new GLib.Variant("as", ["a", "b"]).equal(parse("@as ['a', 'b']"))).toBe(true);
        expect(new GLib.Variant("(si)", ["a", 1]).equal(parse("@(si) ('a', 1)"))).toBe(true);
        expect(new GLib.Variant("a{ss}", { k: "v" }).equal(parse("@a{ss} {'k': 'v'}"))).toBe(true);
        expect(new GLib.Variant("ms", "x").equal(parse("@ms 'x'"))).toBe(true);
        expect(new GLib.Variant("ms", null).equal(parse("@ms nothing"))).toBe(true);
        expect(new GLib.Variant("aai", [[1], []]).equal(parse("@aai [[1], []]"))).toBe(true);
    });

    it("unpacks what GLib parsed back into the shape the type describes", () => {
        expect(parse("@as ['a', 'b']").deepUnpack<"as">()).toEqual(["a", "b"]);
        expect(parse("@(si) ('a', 1)").deepUnpack<"(si)">()).toEqual(["a", 1]);
        expect(parse("@a{ss} {'k': 'v'}").deepUnpack<"a{ss}">()).toEqual({ k: "v" });
        expect(parse("@ms nothing").deepUnpack<"ms">()).toBeNull();
        const held = Object.entries(parse("@a{sv} {'answer': <42>}").deepUnpack<"a{sv}">());
        expect(held.map(([key]) => key)).toEqual(["answer"]);
        expect(held.map(([, value]) => value.deepUnpack<"i">())).toEqual([42]);
    });

    it("round trips a shape nesting arrays, tuples and dictionaries", () => {
        const value: [string, Record<string, string[]>][] = [
            ["one", { a: ["b", "c"] }],
            ["two", {}],
        ];
        expect(new GLib.Variant("a(sa{sas})", value).deepUnpack()).toEqual(value);
    });

    it("unpacks dictionaries with string and numeric keys into records", () => {
        expect(new GLib.Variant("a{si}", { a: 1 }).deepUnpack()).toEqual({ a: 1 });
        expect(new GLib.Variant("a{os}", { [OBJECT_PATH]: "v" }).deepUnpack()).toEqual({ [OBJECT_PATH]: "v" });
        const keyedByNumbers = new GLib.Variant("a{is}", { 1: "a" }).deepUnpack();
        expect(keyedByNumbers).toEqual({ 1: "a" });
        expect(parse("@a{bs} {true: 'a', false: 'b'}").deepUnpack()).toEqual({ true: "a", false: "b" });
    });

    it("unpacks a standalone dictionary entry into a key and value pair", () => {
        expect(new GLib.Variant("{ss}", ["k", "v"]).deepUnpack()).toEqual(["k", "v"]);
    });
});

describe("a container holding nothing", () => {
    it("keeps the type it was packed for", () => {
        expect(new GLib.Variant("as", []).getTypeString()).toBe("as");
        expect(new GLib.Variant("a{sv}", {}).getTypeString()).toBe("a{sv}");
        expect(new GLib.Variant("()", []).getTypeString()).toBe("()");
        expect(new GLib.Variant("ms", null).getTypeString()).toBe("ms");
    });

    it("round trips back to the empty value", () => {
        expect(new GLib.Variant("as", []).deepUnpack()).toEqual([]);
        expect(new GLib.Variant("a{ss}", {}).deepUnpack()).toEqual({});
        expect(new GLib.Variant("()", []).deepUnpack()).toEqual([]);
        expect(new GLib.Variant("a{is}", {}).deepUnpack()).toEqual({});
    });
});

describe("a maybe type", () => {
    it("carries a present and an absent value through the same type", () => {
        expect(new GLib.Variant("ms", "x").deepUnpack()).toBe("x");
        expect(new GLib.Variant("ms", null).deepUnpack()).toBeNull();
    });

    it("carries both inside a container", () => {
        expect(new GLib.Variant("ams", ["a", null]).deepUnpack()).toEqual(["a", null]);
        expect(new GLib.Variant("mas", null).deepUnpack()).toBeNull();
        expect(new GLib.Variant("mas", []).deepUnpack()).toEqual([]);
    });
});

describe("a type string that is not one complete GVariant type", () => {
    it("is refused instead of building a variant", () => {
        expect(() => new GLib.Variant("", null)).toThrow();
        expect(() => new GLib.Variant("z", 1)).toThrow();
        expect(() => new GLib.Variant("ss", "a")).toThrow();
        expect(() => new GLib.Variant("a", [])).toThrow();
        expect(() => new GLib.Variant("(si", ["a", 1])).toThrow();
        expect(() => new GLib.Variant("{sv", ["a", 1])).toThrow();
        expect(() => new GLib.Variant("{vs}", ["a", "b"])).toThrow();
        expect(() => new GLib.Variant("{as}", [["a"], "b"])).toThrow();
    });
});

describe("a string packed where an object path or a type signature belongs", () => {
    it("is refused when it is not one", () => {
        expect(() => new GLib.Variant("o", "not a path")).toThrow();
        expect(() => new GLib.Variant("g", "not a signature")).toThrow();
        expect(() => new GLib.Variant("a{os}", { "not a path": "v" })).toThrow();
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
            new GLib.Variant("(a{sv})", [{ first: new GLib.Variant("i", 1), second: new GLib.Variant("i", 2) }]),
            null,
            Gio.DBusCallFlags.NONE,
            CALL_TIMEOUT_MS,
            null,
        );

        const [seen, count] = reply.deepUnpack<"(asi)">();
        expect(seen).toEqual(["first=1", "second=2"]);
        expect(count).toBe(2);
    });
});

describe("a byte array type", () => {
    it("packs a Uint8Array and an array of byte values into the same variant GLib parses from its own text", () => {
        const packed = new GLib.Variant("ay", new Uint8Array([1, 2, 3]));
        expect(packed.equal(parse("@ay [1, 2, 3]"))).toBe(true);
        expect(new GLib.Variant("ay", [1, 2, 3]).equal(packed)).toBe(true);
        expect(packed.getTypeString()).toBe("ay");
        const bytes = new GLib.Variant("ay", [7, 8]).deepUnpack();
        expect(bytes).toBeInstanceOf(Uint8Array);
        expect(bytes).toEqual(new Uint8Array([7, 8]));
    });

    it("carries empty and nested byte arrays through containers", () => {
        const empty = new Uint8Array();
        expect(new GLib.Variant("ay", empty).deepUnpack()).toEqual(empty);
        expect(new GLib.Variant("ay", []).deepUnpack()).toEqual(empty);
        const nested = new GLib.Variant("aay", [new Uint8Array([1]), [2, 3]]);
        expect(nested.deepUnpack()).toEqual([new Uint8Array([1]), new Uint8Array([2, 3])]);
        const present = new GLib.Variant("may", new Uint8Array([4]));
        expect(present.deepUnpack()).toEqual(new Uint8Array([4]));
        expect(new GLib.Variant("may", null).deepUnpack()).toBeNull();
    });

    it("is refused when packed from anything else", () => {
        const byteArrayType = "ay" as string;
        expect(() => new GLib.Variant(byteArrayType, 7)).toThrow();
        expect(() => new GLib.Variant(byteArrayType, null)).toThrow();
        expect(() => new GLib.Variant(byteArrayType, { 0: 1 })).toThrow();
    });
});

describe("a variant read without a type string", () => {
    it("derives the shape from the variant's own type", () => {
        expect(new GLib.Variant("i", -3).deepUnpack()).toBe(-3);
        expect(new GLib.Variant("(si)", ["a", 1]).deepUnpack()).toEqual(["a", 1]);
        expect(new GLib.Variant("a{ss}", { k: "v" }).deepUnpack()).toEqual({ k: "v" });
        const bytes = new GLib.Variant("ay", new Uint8Array([9]));
        expect(bytes.deepUnpack()).toEqual(new Uint8Array([9]));
    });

    it("keeps a nested variant boxed and reads empty containers", () => {
        const boxed = new GLib.Variant("v", new GLib.Variant("i", 5));
        expect(boxed.deepUnpack()).toBeInstanceOf(GLib.Variant);
        expect(new GLib.Variant("as", []).deepUnpack()).toEqual([]);
        expect(new GLib.Variant("ms", null).deepUnpack()).toBeNull();
    });
});

describe("a variant unpacked recursively", () => {
    it("unwraps the variants a dictionary boxes its values in", () => {
        const bytes = new GLib.Variant("ay", new Uint8Array([1, 2]));

        const packed = new GLib.Variant("a{sv}", {
            count: new GLib.Variant("i", 5),
            data: new GLib.Variant("v", bytes),
            name: new GLib.Variant("s", "hi"),
        });

        const expected = { count: 5, data: new Uint8Array([1, 2]), name: "hi" };
        expect(packed.recursiveUnpack()).toEqual(expected);
    });

    it("reads a variant boxed inside another all the way down", () => {
        const doubled = new GLib.Variant("v", new GLib.Variant("v", new GLib.Variant("i", 8)));
        expect(doubled.recursiveUnpack()).toBe(8);
        expect(doubled.deepUnpack()).toBeInstanceOf(GLib.Variant);
        expect(new GLib.Variant("(si)", ["a", 1]).recursiveUnpack()).toEqual(["a", 1]);
        expect(new GLib.Variant("mv", null).recursiveUnpack()).toBeNull();
    });
});
