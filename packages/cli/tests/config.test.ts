import { describe, expect, it } from "vitest";
import { defineConfig, isValidAppId } from "../src/config.js";
import { isValidProjectName } from "../src/create/options.js";

describe("defineConfig", () => {
    it("returns the config unchanged when valid", () => {
        const config = { libraries: ["Gtk-4.0", "Adw-1"] };
        expect(defineConfig(config)).toBe(config);
    });

    it("accepts a girPath array", () => {
        const config = { libraries: ["Gtk-4.0"], girPath: ["/usr/share/gir-1.0"] };
        expect(defineConfig(config)).toBe(config);
    });

    it("rejects an empty libraries array", () => {
        expect(() => defineConfig({ libraries: [] })).toThrow(
            '`libraries` must be "*", a non-empty string array, or omitted',
        );
    });

    it("rejects a non-array, non-wildcard libraries field", () => {
        expect(() => defineConfig({ libraries: "Gtk-4.0" as unknown as string[] })).toThrow(
            '`libraries` must be "*", a non-empty string array, or omitted',
        );
    });

    it('accepts the "*" wildcard', () => {
        expect(defineConfig({ libraries: "*" }).libraries).toBe("*");
    });

    it("accepts a config that omits libraries", () => {
        expect(() => defineConfig({})).not.toThrow();
        expect(() => defineConfig({ girPath: ["/usr/share/gir-1.0"] })).not.toThrow();
    });

    it('rejects "*" used as an array entry and hints at the bare-string form', () => {
        expect(() => defineConfig({ libraries: ["*"] })).toThrow(
            'set `libraries: "*"` as a bare string, not an array entry',
        );
    });

    it("rejects a library identifier without a version suffix", () => {
        expect(() => defineConfig({ libraries: ["Gtk"] })).toThrow(/invalid library identifier/);
    });

    it("rejects a library identifier that starts with a digit", () => {
        expect(() => defineConfig({ libraries: ["4Gtk-1.0"] })).toThrow(/invalid library identifier/);
    });

    it("accepts multi-component versions", () => {
        expect(() => defineConfig({ libraries: ["Glib-2.0.1"] })).not.toThrow();
    });

    it("rejects a non-string library entry", () => {
        expect(() => defineConfig({ libraries: [123 as unknown as string] })).toThrow(/invalid library identifier/);
    });

    it("rejects a non-array girPath", () => {
        expect(() =>
            defineConfig({ libraries: ["Gtk-4.0"], girPath: "/usr/share/gir-1.0" as unknown as string[] }),
        ).toThrow(/`girPath` must be an array of strings if provided/);
    });
});

describe("defineConfig (applicationId)", () => {
    it("accepts a valid applicationId", () => {
        expect(defineConfig({ applicationId: "org.gtk.Demo4" }).applicationId).toBe("org.gtk.Demo4");
    });

    it("rejects an invalid applicationId", () => {
        expect(() => defineConfig({ applicationId: "not valid" })).toThrow(/invalid `applicationId`/);
        expect(() => defineConfig({ applicationId: "singletoken" })).toThrow(/invalid `applicationId`/);
    });

    it("rejects a non-string applicationId", () => {
        expect(() => defineConfig({ applicationId: 123 as unknown as string })).toThrow(/invalid `applicationId`/);
    });

    it("accepts a config that omits applicationId", () => {
        expect(() => defineConfig({ libraries: ["Gtk-4.0"] })).not.toThrow();
        expect(defineConfig({ libraries: ["Gtk-4.0"] }).applicationId).toBeUndefined();
    });
});

describe("defineConfig slotProps validation", () => {
    it("accepts a slotProps map", () => {
        const config = { libraries: ["Gtk-4.0"], slotProps: { MyAppFooBar: ["content"] } };
        expect(defineConfig(config)).toBe(config);
    });

    it("rejects a slotProps value that is not an object", () => {
        expect(() => defineConfig({ slotProps: "nope" as unknown as Record<string, string[]> })).toThrow(
            /`slotProps` must be an object/,
        );
    });

    it("rejects a slotProps array", () => {
        expect(() => defineConfig({ slotProps: [] as unknown as Record<string, string[]> })).toThrow(
            /`slotProps` must be an object/,
        );
    });

    it("rejects a slotProps key that is not PascalCase", () => {
        expect(() => defineConfig({ slotProps: { "kebab-name": ["content"] } })).toThrow(
            /invalid `slotProps` key "kebab-name"/,
        );
    });

    it("rejects a slotProps entry with an empty array", () => {
        expect(() => defineConfig({ slotProps: { MyAppFooBar: [] } })).toThrow(
            /`slotProps\.MyAppFooBar` must be a non-empty array/,
        );
    });

    it("rejects a slotProps entry that is not an array", () => {
        expect(() => defineConfig({ slotProps: { MyAppFooBar: "content" as unknown as string[] } })).toThrow(
            /`slotProps\.MyAppFooBar` must be a non-empty array/,
        );
    });

    it("rejects a slotProps prop name that is not camelCase", () => {
        expect(() => defineConfig({ slotProps: { MyAppFooBar: ["Content"] } })).toThrow(
            /invalid `slotProps\.MyAppFooBar` entry "Content"/,
        );
    });
});

describe("isValidAppId", () => {
    it("accepts a standard reverse-DNS application ID", () => {
        expect(isValidAppId("com.example.MyApp")).toBe(true);
    });

    it("accepts hyphens and underscores within elements", () => {
        expect(isValidAppId("com.example.my-app_v2")).toBe(true);
    });

    it("rejects an ID with no dots", () => {
        expect(isValidAppId("singletoken")).toBe(false);
    });

    it("rejects an empty string", () => {
        expect(isValidAppId("")).toBe(false);
    });

    it("rejects an ID exceeding 255 characters", () => {
        const long = `${"a".repeat(252)}.${"b".repeat(3)}`;
        expect(long.length).toBe(256);
        expect(isValidAppId(long)).toBe(false);
    });

    it("rejects an element starting with a digit", () => {
        expect(isValidAppId("com.4example.app")).toBe(false);
    });

    it("rejects whitespace and disallowed characters", () => {
        expect(isValidAppId("com.example.my app")).toBe(false);
        expect(isValidAppId("com.example.my$app")).toBe(false);
    });

    it("rejects trailing or leading dots", () => {
        expect(isValidAppId(".com.example")).toBe(false);
        expect(isValidAppId("com.example.")).toBe(false);
    });

    it("accepts a two-segment ID", () => {
        expect(isValidAppId("org.app")).toBe(true);
    });

    it("accepts single-character segments", () => {
        expect(isValidAppId("a.b")).toBe(true);
    });

    it("accepts a deeply nested ID", () => {
        expect(isValidAppId("com.example.sub.category.app")).toBe(true);
    });

    it("accepts elements containing digits after the first character", () => {
        expect(isValidAppId("org.gtkx123.app456")).toBe(true);
    });

    it("rejects an ID with consecutive dots", () => {
        expect(isValidAppId("com..app")).toBe(false);
    });

    it("rejects a segment starting with a hyphen", () => {
        expect(isValidAppId("com.-app.test")).toBe(false);
    });
});

describe("isValidProjectName", () => {
    it("accepts lowercase letters, digits, and hyphens", () => {
        expect(isValidProjectName("my-cool-app-123")).toBe(true);
    });

    it("rejects uppercase letters", () => {
        expect(isValidProjectName("MyApp")).toBe(false);
    });

    it("rejects underscores", () => {
        expect(isValidProjectName("my_app")).toBe(false);
    });

    it("rejects dots", () => {
        expect(isValidProjectName("my.app")).toBe(false);
    });

    it("rejects empty strings", () => {
        expect(isValidProjectName("")).toBe(false);
    });
});
