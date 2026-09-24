import { t } from "@gtkx/runtime";
import { expect, test } from "vitest";

const missingLibrary = "libgtkx-inline-record-admission-missing.so";
const gvalue = (ownership: "borrowed" | "full") => t.boxed("GValue", {
    ownership,
    sharedLibrary: "libgobject-2.0.so.0",
    getTypeFnName: "g_value_get_type",
    size: 24,
});
const borrowedValues = t.fixedArray(gvalue("borrowed"), 2, "borrowed", { elementSize: 24 });
const fullValues = t.fixedArray(gvalue("full"), 2, "full", { elementSize: 24 });
const ownerBoundValues = t.fixedArray(t.struct("borrowed"), 2, "borrowed", { elementSize: 16 });
const completion = t.callback([t.object(), t.object(), t.biguint64], t.void, {
    hasUserData: true,
    userDataIndex: 2,
    scope: "async",
});

test("safe inline record shapes bind without resolving their symbols", () => {
    const pureValues = t.fixedArray(
        t.struct("full", { size: 16, isValueSafe: true }), 2, "full", { elementSize: 16 },
    );
    const containerValues = t.fixedArray(gvalue("borrowed"), 2, "full", { elementSize: 24 });
    const lentCallback = t.callback([ownerBoundValues], t.void, { scope: "call" });
    const ownedValueArray = t.gArray(gvalue("full"), "full", { elementSize: 24 });
    const containerCallback = t.callback([containerValues], t.void, { scope: "call" });
    const ownedArrayCallback = t.callback([ownedValueArray], t.void, { scope: "call" });

    expect(t.bind(missingLibrary, "borrow_values", [borrowedValues], t.void)).toBeTypeOf("function");
    expect(t.bind(missingLibrary, "return_pure", [], pureValues)).toBeTypeOf("function");
    expect(t.bind(missingLibrary, "return_container", [], containerValues)).toBeTypeOf("function");
    expect(t.bind(missingLibrary, "visit_values", [lentCallback], t.void)).toBeTypeOf("function");
    expect(t.bind(missingLibrary, "visit_container", [containerCallback], t.void)).toBeTypeOf("function");
    expect(t.bind(missingLibrary, "visit_value_array", [ownedArrayCallback], t.void)).toBeTypeOf("function");
    expect(t.bind(missingLibrary, "return_value_array", [], ownedValueArray)).toBeTypeOf("function");
});

test.each([
    {
        name: "full flat input",
        bind: () => t.bind(missingLibrary, "take_values", [fullValues], t.void),
    },
    {
        name: "full GArray input",
        bind: () => t.bind(
            missingLibrary, "take_value_array", [t.gArray(gvalue("full"), "full", { elementSize: 24 })], t.void,
        ),
    },
    {
        name: "full flat return",
        bind: () => t.bind(missingLibrary, "return_values", [], fullValues),
    },
    {
        name: "full flat elements",
        bind: () => t.bind(
            missingLibrary, "return_elements", [],
            t.fixedArray(gvalue("full"), 2, "borrowed", { elementSize: 24 }),
        ),
    },
    {
        name: "owner-bound borrowed return",
        bind: () => t.bind(missingLibrary, "return_owner_bound", [], ownerBoundValues),
    },
    {
        name: "caller-allocated output",
        bind: () => t.fn(missingLibrary, "fill_values", {
            args: [{
                type: t.fixedArray(gvalue("borrowed"), 2, "borrowed", {
                    elementSize: 24,
                    isCallerAllocated: true,
                }),
                direction: "out",
                isCallerAllocated: true,
            }],
            returns: t.void,
        }),
    },
    {
        name: "async-retained borrowed input",
        bind: () => t.bind(missingLibrary, "borrow_values_async", [borrowedValues, completion], t.void),
    },
    {
        name: "full callback input",
        bind: () => t.bind(
            missingLibrary, "visit_full_values", [t.callback([fullValues], t.void, { scope: "call" })], t.void,
        ),
    },
    {
        name: "full callback return",
        bind: () => t.bind(
            missingLibrary, "receive_full_values", [t.callback([], fullValues, { scope: "call" })], t.void,
        ),
    },
    {
        name: "borrowed callback return",
        bind: () => t.bind(
            missingLibrary, "receive_borrowed_values", [t.callback([], borrowedValues, { scope: "call" })], t.void,
        ),
    },
])("$name is rejected while binding", ({ bind }) => {
    expect(bind).toThrow();
});
