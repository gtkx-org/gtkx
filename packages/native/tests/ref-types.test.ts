import { describe, expect, it } from "vitest";
import { call, createRef } from "../index.js";
import { GDK_LIB, GLIB_LIB, GTK_LIB, setup } from "./integration.js";

setup();

describe("Ref with Primitive Types", () => {
    it("should handle Ref<i32> out parameters", () => {
        const widthRef = createRef(0);
        const heightRef = createRef(0);

        const window = call(GTK_LIB, "gtk_window_new", [], { type: "gobject", borrowed: true });

        call(
            GTK_LIB,
            "gtk_window_set_default_size",
            [
                { type: { type: "gobject" }, value: window },
                { type: { type: "int", size: 32, unsigned: false }, value: 800 },
                { type: { type: "int", size: 32, unsigned: false }, value: 600 },
            ],
            { type: "undefined" },
        );

        call(
            GTK_LIB,
            "gtk_window_get_default_size",
            [
                { type: { type: "gobject" }, value: window },
                {
                    type: { type: "ref", innerType: { type: "int", size: 32, unsigned: false } },
                    value: widthRef,
                },
                {
                    type: { type: "ref", innerType: { type: "int", size: 32, unsigned: false } },
                    value: heightRef,
                },
            ],
            { type: "undefined" },
        );

        expect(widthRef.value).toBe(800);
        expect(heightRef.value).toBe(600);
    });

    it("should handle Ref with negative values", () => {
        const window = call(GTK_LIB, "gtk_window_new", [], { type: "gobject", borrowed: true });

        call(
            GTK_LIB,
            "gtk_window_set_default_size",
            [
                { type: { type: "gobject" }, value: window },
                { type: { type: "int", size: 32, unsigned: false }, value: -1 },
                { type: { type: "int", size: 32, unsigned: false }, value: -1 },
            ],
            { type: "undefined" },
        );

        const widthRef = createRef(0);
        const heightRef = createRef(0);

        call(
            GTK_LIB,
            "gtk_window_get_default_size",
            [
                { type: { type: "gobject" }, value: window },
                { type: { type: "ref", innerType: { type: "int", size: 32, unsigned: false } }, value: widthRef },
                { type: { type: "ref", innerType: { type: "int", size: 32, unsigned: false } }, value: heightRef },
            ],
            { type: "undefined" },
        );

        expect(widthRef.value).toBe(-1);
        expect(heightRef.value).toBe(-1);
    });
});

describe("Ref with GError (pointer-to-pointer)", () => {
    it("should handle GError** out parameters when error occurs", () => {
        const keyFile = call(GLIB_LIB, "g_key_file_new", [], {
            type: "boxed",
            borrowed: true,
            innerType: "GKeyFile",
            lib: GLIB_LIB,
        });

        const errorRef = createRef(null);

        const result = call(
            GLIB_LIB,
            "g_key_file_load_from_file",
            [
                { type: { type: "boxed", innerType: "GKeyFile", lib: GLIB_LIB }, value: keyFile },
                { type: { type: "string" }, value: "/nonexistent/file/that/does/not/exist.ini" },
                { type: { type: "int", size: 32, unsigned: false }, value: 0 },
                {
                    type: {
                        type: "ref",
                        innerType: {
                            type: "boxed",
                            innerType: "GError",
                            lib: GLIB_LIB,
                        },
                    },
                    value: errorRef,
                },
            ],
            { type: "boolean" },
        );

        expect(result).toBe(false);
        expect(errorRef.value).not.toBeNull();
    });

    it("should handle GError** out parameters when no error occurs", () => {
        const keyFile = call(GLIB_LIB, "g_key_file_new", [], {
            type: "boxed",
            borrowed: true,
            innerType: "GKeyFile",
            lib: GLIB_LIB,
        });

        call(
            GLIB_LIB,
            "g_key_file_set_string",
            [
                { type: { type: "boxed", innerType: "GKeyFile", lib: GLIB_LIB }, value: keyFile },
                { type: { type: "string" }, value: "Group" },
                { type: { type: "string" }, value: "Key" },
                { type: { type: "string" }, value: "Value" },
            ],
            { type: "undefined" },
        );

        const errorRef = createRef(null);

        const result = call(
            GLIB_LIB,
            "g_key_file_get_string",
            [
                { type: { type: "boxed", innerType: "GKeyFile", lib: GLIB_LIB }, value: keyFile },
                { type: { type: "string" }, value: "Group" },
                { type: { type: "string" }, value: "Key" },
                {
                    type: {
                        type: "ref",
                        innerType: {
                            type: "boxed",
                            innerType: "GError",
                            lib: GLIB_LIB,
                        },
                    },
                    value: errorRef,
                },
            ],
            { type: "string" },
        );

        expect(result).toBe("Value");
        expect(errorRef.value).toBeNull();
    });
});

describe("Ref with GObject Types", () => {
    it("should handle Ref<GObject> (out parameter returning object)", () => {
        const display = call(GDK_LIB, "gdk_display_get_default", [], {
            type: "gobject",
            borrowed: true,
        });
        expect(display).not.toBeNull();

        const clipboard = call(GDK_LIB, "gdk_display_get_clipboard", [{ type: { type: "gobject" }, value: display }], {
            type: "gobject",
            borrowed: true,
        });
        expect(clipboard).not.toBeNull();
    });
});
