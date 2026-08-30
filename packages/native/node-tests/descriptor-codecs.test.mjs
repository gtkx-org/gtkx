import * as GdkPixbuf from "@gtkx/gi/gdkpixbuf";
import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import * as GObject from "@gtkx/gi/gobject";
import * as Graphene from "@gtkx/gi/graphene";
import * as Lifecycle from "@gtkx/gi/gtkxlifecycle";
import * as Pango from "@gtkx/gi/pango";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { bind, call } from "../main.js";
import { assertBalanced, collect, snapshot } from "./lifecycle-ledger.mjs";

const INVENTORY = fileURLToPath(
    new URL("../../../build/native-tests/lifecycle/descriptors.json", import.meta.url),
);
const CERTIFICATE = fileURLToPath(
    new URL("../fixtures/lifecycle/descriptor.pem", import.meta.url),
);
const GLIB_LIBRARY = "libglib-2.0.so.0";
const checksumDescriptor = bind(
    GLIB_LIBRARY,
    "g_compute_checksum_for_data",
    [{ kind: "int32" }, { kind: "buffer" }, { kind: "uint64" }],
    { kind: "string", ownership: "full" },
);
const gArrayDescriptor = {
    kind: "array",
    itemDescriptor: { kind: "int32" },
    arrayKind: "garray",
    ownership: "borrowed",
};
const copyGArrayDescriptor = bind(
    GLIB_LIBRARY,
    "g_array_ref",
    [gArrayDescriptor],
    { ...gArrayDescriptor, ownership: "full" },
);
const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const certificatePem = await readFile(CERTIFICATE, "utf8");
const checksumBuffer = (...values) => call(checksumDescriptor, values);
const copyGArray = (values) => call(copyGArrayDescriptor, [values]);

const probes = [
    {
        descriptors: [
            "bigint64",
            "biguint64",
            "boolean",
            "float64",
            "fundamental",
            "int16",
            "int32",
            "int64",
            "int8",
            "uint16",
            "uint32",
            "uint64",
        ],
        run: () => {
            const values = [
                [GLib.Variant.newInt16(-2), "getInt16", -2],
                [GLib.Variant.newUint16(2), "getUint16", 2],
                [GLib.Variant.newInt32(-3), "getInt32", -3],
                [GLib.Variant.newUint32(3), "getUint32", 3],
                [GLib.Variant.newInt64(-4n), "getInt64", -4n],
                [GLib.Variant.newUint64(4n), "getUint64", 4n],
                [GLib.Variant.newByte(255), "getByte", 255],
                [GLib.Variant.newDouble(1.25), "getDouble", 1.25],
            ];

            for (const [value, method, expected] of values) {
                assert.equal(value[method](), expected);
            }

            assert.equal(GLib.Variant.newBoolean(true).getBoolean(), true);
            assert.equal(GLib.asciiToupper(97), 65);
            assert.equal(GLib.utf8Strup("mixed", -1), "MIXED");
            assert.equal(GLib.utf8TruncateMiddle("abcdef", 5), "ab…ef");
        },
    },
    {
        descriptors: ["enum", "flags", "gtype", "string", "unichar"],
        run: () => {
            assert.notEqual(GObject.typeFromName("GObject"), 0n);
            assert.equal(GLib.unicharGetScript("A"), GLib.UnicodeScript.LATIN);
            assert.ok(GLib.formatSizeFull(1024n, GLib.FormatSizeFlags.IEC_UNITS).endsWith("KiB"));
        },
    },
    {
        descriptors: ["boxed", "fixedArray", "float32", "void"],
        run: () => {
            const matrix = Graphene.Matrix.alloc().initFromFloat(identity);

            assert.deepEqual(matrix.toFloat(), identity);
        },
    },
    {
        descriptors: ["struct"],
        run: () => {
            const rectangle = new Pango.Rectangle({ x: 1024, y: 1024, width: 2048, height: 3072 });

            assert.equal(Pango.extentsToPixels(rectangle), undefined);
            assert.deepEqual(
                [rectangle.x, rectangle.y, rectangle.width, rectangle.height],
                [1, 1, 2, 3],
            );
        },
    },
    {
        descriptors: ["array", "object", "ref", "sizedArray", "uint8"],
        run: () => {
            const icon = Gio.ThemedIcon.newFromNames(["one", "two"]);
            const pixbuf = GdkPixbuf.Pixbuf.new(GdkPixbuf.Colorspace.RGB, true, 8, 1, 1);
            const chunks = [];

            assert.deepEqual(icon.getNames().slice(0, 2), ["one", "two"]);
            assert.equal(GLib.strvContains(["one", "two"], "two"), true);
            assert.equal(pixbuf.getNChannels(), 4);
            assert.equal(pixbuf.saveToCallbackv((bytes) => {
                chunks.push(bytes);

                return [true, null];
            }, "png", null, null), true);
            assert.deepEqual(
                chunks[0].slice(0, 8),
                new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
            );
            assert.equal(Lifecycle.watchObject(icon), true);
            assert.equal(Lifecycle.watchObject(pixbuf), true);
        },
    },
    {
        descriptors: ["cursorArray"],
        run: () => {
            const [valid, remainder] = GLib.utf8Validate(new Uint8Array([104, 105]));

            assert.equal(valid, true);
            assert.deepEqual(remainder, new Uint8Array());
        },
    },
    {
        descriptors: ["byteArray", "hashTable", "list", "slist"],
        run: () => {
            const bytes = GLib.ByteArray.append(GLib.ByteArray.new(), new Uint8Array([1, 2, 3]));
            const params = GLib.Uri.parseParams("a=1&b=two", -1, "&", 0);
            const contentTypes = Gio.contentTypesGetRegistered();
            const formats = GdkPixbuf.Pixbuf.getFormats();

            assert.deepEqual(bytes, new Uint8Array([1, 2, 3]));
            assert.equal(params.get("a"), "1");
            assert.equal(params.get("b"), "two");
            assert.ok(contentTypes.includes("text/plain"));
            assert.ok(formats.some((format) => format.getName() === "png"));
        },
    },
    {
        descriptors: ["gArray", "ptrArray"],
        run: () => {
            const first = Lifecycle.Object.new("first");
            const second = Lifecycle.Object.new("second");
            const certificate = Gio.TlsCertificate.newFromPem(certificatePem, -1);
            const addresses = certificate.getIpAddresses();

            assert.deepEqual(copyGArray([11, 22]), [11, 22]);
            assert.deepEqual([first.getValue(), second.getValue()], ["first", "second"]);
            assert.deepEqual(addresses.map((address) => address.toString()), ["127.0.0.1"]);
            assert.equal(Lifecycle.watchObject(first), true);
            assert.equal(Lifecycle.watchObject(second), true);
            assert.equal(Lifecycle.watchObject(certificate), true);
        },
    },
    {
        descriptors: ["callback"],
        run: () => {
            let invocations = 0;

            Lifecycle.callbackRegister(() => {
                invocations += 1;
            });
            Lifecycle.callbacksInvoke();
            Lifecycle.callbacksRelease();
            assert.equal(invocations, 1);
        },
    },
    {
        descriptors: ["buffer"],
        run: () => {
            assert.equal(
                checksumBuffer(GLib.ChecksumType.SHA256, new Uint8Array([97, 98, 99]), 3),
                "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
            );
        },
    },
];

const compareDescriptors = (left, right) => left.localeCompare(right);
const coveredDescriptors = probes.flatMap(({ descriptors }) => descriptors).toSorted(compareDescriptors);
const inventory = JSON.parse(await readFile(INVENTORY, "utf8"));
const generatedDescriptors = inventory.descriptors.map(({ name }) => name).toSorted(compareDescriptors);

test("generated descriptor codecs cover the happy path", async () => {
    assert.equal(new Set(coveredDescriptors).size, coveredDescriptors.length);
    assert.deepEqual(coveredDescriptors, generatedDescriptors);

    for (const probe of probes) {
        Lifecycle.reset();
        probe.run();
        await collect();

        assertBalanced(snapshot());
    }
});

test("generated descriptor codecs cover edge cases", async () => {
    Lifecycle.reset();
    assert.deepEqual(copyGArray([]), []);
    assert.deepEqual(GLib.ByteArray.append(GLib.ByteArray.new(), new Uint8Array()), new Uint8Array());
    assert.equal(GLib.Uri.parseParams("", 0, "&", 0).size, 0);
    assert.deepEqual(
        GLib.utf8Validate(new Uint8Array([65, 255, 66])),
        [false, new Uint8Array([255, 66])],
    );
    assert.equal(
        checksumBuffer(GLib.ChecksumType.SHA256, new Uint8Array(), 0),
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );

    await collect();
    assertBalanced(snapshot());
});

test("generated descriptor codecs cover error paths", async () => {
    Lifecycle.reset();
    assert.throws(() => GLib.Variant.newInt16(32_768));
    assert.throws(() => Graphene.Matrix.alloc().initFromFloat([1]));
    assert.throws(() => GLib.utf8Validate("invalid"));
    assert.throws(() => checksumBuffer(GLib.ChecksumType.SHA256, "invalid", 7));

    await collect();
    assertBalanced(snapshot());
});
