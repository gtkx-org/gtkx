import { t } from "@gtkx/runtime";
import { expect, test } from "vitest";

const glib = "libglib-2.0.so.0";
const date = t.struct("full", { sharedLibrary: glib, freeFnName: "g_date_free" });
const newDate = t.bind(glib, "g_date_new_dmy", [t.uint8, t.int32, t.uint16], date);
const getDay = t.bind(glib, "g_date_get_day", [t.struct()], t.uint8);
const missingCopy = t.struct("full", {
    sharedLibrary: glib,
    copyFnName: "gtkx_missing_callback_date_copy",
    freeFnName: "g_date_free",
});

test("a missing lifecycle operation in a callback return propagates to the enclosing call", () => {
    const copyList = t.bind(
        glib,
        "g_list_copy_deep",
        [
            t.list(t.struct()),
            t.callback([t.struct(), t.buffer], missingCopy, {
                hasUserData: true,
                userDataIndex: 1,
                scope: "call",
            }),
        ],
        t.list(t.struct(), "full"),
    );
    const source = newDate(21, 7, 2000);

    expect(() => copyList([source], () => source)).toThrow("gtkx_missing_callback_date_copy");
    expect(getDay(source)).toBe(21);
});

test("a missing nested lifecycle operation in a callback return preserves its source", () => {
    const copyList = t.bind(
        glib,
        "g_list_copy_deep",
        [
            t.list(t.struct()),
            t.callback([t.struct(), t.buffer], t.list(missingCopy, "full"), {
                hasUserData: true,
                userDataIndex: 1,
                scope: "call",
            }),
        ],
        t.list(t.struct(), "full"),
    );
    const source = newDate(22, 7, 2000);

    expect(() => copyList([source], () => [source])).toThrow("gtkx_missing_callback_date_copy");
    expect(getDay(source)).toBe(22);
});
