import { describe, expect, it } from "vitest";
import { call } from "../index.js";
import { GLIB_LIB, GTK_LIB, setup } from "./integration.js";

setup();

describe("Owned Strings", () => {
    it("should handle owned strings", () => {
        const result = call(GLIB_LIB, "g_strdup", [{ type: { type: "string" }, value: "owned-test" }], {
            type: "string",
        });
        expect(result).toBe("owned-test");
    });

    it("should handle empty strings", () => {
        const result = call(GLIB_LIB, "g_strdup", [{ type: { type: "string" }, value: "" }], { type: "string" });
        expect(result).toBe("");
    });

    it("should handle very long strings", () => {
        const longString = "a".repeat(10000);
        const result = call(GLIB_LIB, "g_strdup", [{ type: { type: "string" }, value: longString }], {
            type: "string",
        });
        expect(result).toBe(longString);
    });

    it("should handle strings with special characters", () => {
        const result = call(
            GLIB_LIB,
            "g_strdup",
            [{ type: { type: "string" }, value: "tab\there\nnewline\r\nwindows" }],
            { type: "string" },
        );
        expect(result).toBe("tab\there\nnewline\r\nwindows");
    });
});

describe("Borrowed Strings", () => {
    it("should handle borrowed strings from quark", () => {
        const quark = call(
            GLIB_LIB,
            "g_quark_from_string",
            [{ type: { type: "string" }, value: "borrowed-string-test" }],
            { type: "int", size: 32, unsigned: true },
        ) as number;

        const result = call(
            GLIB_LIB,
            "g_quark_to_string",
            [{ type: { type: "int", size: 32, unsigned: true }, value: quark }],
            { type: "string", borrowed: true },
        );
        expect(result).toBe("borrowed-string-test");
    });

    it("should handle borrowed string from widget", () => {
        const label = call(GTK_LIB, "gtk_label_new", [{ type: { type: "string" }, value: "Label Text" }], {
            type: "gobject",
            borrowed: true,
        });

        const text = call(GTK_LIB, "gtk_label_get_label", [{ type: { type: "gobject" }, value: label }], {
            type: "string",
            borrowed: true,
        });
        expect(text).toBe("Label Text");
    });
});

describe("Unicode Strings", () => {
    it("should handle Chinese characters", () => {
        const result = call(GLIB_LIB, "g_strdup", [{ type: { type: "string" }, value: "Hello 世界 🌍" }], {
            type: "string",
        });
        expect(result).toBe("Hello 世界 🌍");
    });

    it("should handle Arabic characters", () => {
        const result = call(GLIB_LIB, "g_strdup", [{ type: { type: "string" }, value: "مرحبا بالعالم" }], {
            type: "string",
        });
        expect(result).toBe("مرحبا بالعالم");
    });

    it("should handle emoji", () => {
        const result = call(GLIB_LIB, "g_strdup", [{ type: { type: "string" }, value: "Hello 🌍🎉🚀" }], {
            type: "string",
        });
        expect(result).toBe("Hello 🌍🎉🚀");
    });

    it("should handle mixed scripts", () => {
        const mixed = "Hello 世界 مرحبا 🌍 Привет";
        const result = call(GLIB_LIB, "g_strdup", [{ type: { type: "string" }, value: mixed }], {
            type: "string",
        });
        expect(result).toBe(mixed);
    });
});
