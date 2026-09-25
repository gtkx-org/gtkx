import * as GIMarshallingTests from "@gtkx/gi/gimarshallingtests";
import * as Regress from "@gtkx/gi/regress";
import { type Descriptor, registerClass, t } from "@gtkx/runtime";
import { expect, test } from "vitest";
import { prepareMemoryChecks } from "./helpers/memory-suite.js";
import {
    didThrow,
    hammer,
    RSS_BUDGET,
    THROWING_RSS_BUDGET,
} from "./helpers/memory.js";

prepareMemoryChecks();

const OWNED_STRING: Descriptor = { kind: "string", ownership: "full" };
const freeStringList = t.bind("libglib-2.0.so.0", "g_list_free_full", [
    { kind: "array", arrayKind: "glist", itemDescriptor: OWNED_STRING, ownership: "full" },
    { kind: "callback", argDescriptors: [OWNED_STRING], returnDescriptor: { kind: "void" }, scope: "call" },
], { kind: "void" });

const receiveString = (text: string): number => text.length;

const failStringCallback = (): never => {
    throw new Error("Callback failure");
};

test("transfer full string returns stay bounded over twenty thousand calls", async () => {
    expect(
        await hammer(20_000, () => {
            GIMarshallingTests.utf8FullReturn();
            GIMarshallingTests.utf8FullOut();
            Regress.testUtf8NonconstReturn();
        }),
    ).toBeLessThan(RSS_BUDGET);
});

test("transfer none string returns stay bounded over twenty thousand calls", async () => {
    expect(
        await hammer(20_000, () => {
            GIMarshallingTests.utf8NoneReturn();
            GIMarshallingTests.utf8NoneOut();
            Regress.testUtf8ConstReturn();
        }),
    ).toBeLessThan(RSS_BUDGET);
});

test("transfer full string arguments stay bounded over twenty thousand calls", async () => {
    expect(
        await hammer(20_000, () => {
            GIMarshallingTests.utf8FullIn("const ♥ utf8");
            GIMarshallingTests.utf8NoneIn("const ♥ utf8");
            Regress.testUtf8ConstIn("const ♥ utf8");
            GIMarshallingTests.filenameCopy("const ♥ utf8");
        }),
    ).toBeLessThan(RSS_BUDGET);
});

test.each([
    { label: "empty", strings: [] },
    { label: "null", strings: null },
    { label: "Unicode and empty strings", strings: ["const ♥ utf8", "", "café"] },
])("transfer full callbacks receive a list of $label strings", ({ strings }) => {
    const received: string[] = [];

    freeStringList(strings, (text: string) => {
        received.push(text);
    });

    expect(received).toEqual(strings ?? []);
});

test("transfer full callback string arguments stay bounded over twenty thousand calls", async () => {
    const strings = ["♥".repeat(16_384)];

    expect(await hammer(20_000, () => freeStringList(strings, receiveString))).toBeLessThan(RSS_BUDGET);
});

test("throwing string callbacks do not accumulate over twenty thousand failures", async () => {
    const strings = ["♥".repeat(16_384)];
    const invoke = (): void => {
        freeStringList(strings, failStringCallback);
    };

    expect(invoke).toThrow();

    expect(await hammer(20_000, () => didThrow(invoke))).toBeLessThan(THROWING_RSS_BUDGET);
});

test("borrowed and full string callback returns stay bounded over twenty thousand calls", async () => {
    const text = "♥".repeat(16_384);

    class StringReturns extends GIMarshallingTests.Object {
        override vfuncMethodStrArgOutRet(value: string): [string, number] {
            return [value, value.length];
        }

        override vfuncVfuncStaticName(): string {
            return text;
        }
    }

    const Registered = registerClass(StringReturns, { typeName: `GtkxMemoryStringReturns${String(process.pid)}` });
    const instance = new Registered({});
    expect(instance.methodStrArgOutRet(text)).toEqual([text, text.length]);
    expect(GIMarshallingTests.Object.vfuncStaticTypedName(Registered)).toBe(text);

    expect(await hammer(20_000, () => {
        instance.methodStrArgOutRet(text);
        GIMarshallingTests.Object.vfuncStaticTypedName(Registered);
    })).toBeLessThan(RSS_BUDGET);
});
