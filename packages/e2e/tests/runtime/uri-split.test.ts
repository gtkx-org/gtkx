import * as GLib from "@gtkx/gi/glib";
import { describe, expect, it } from "vitest";

describe("GLib.Uri.split", () => {
    it("returns only the components the signature declares", () => {
        expect(GLib.Uri.split("https://example.com/p", GLib.UriFlags.NONE)).toEqual([
            "https",
            null,
            "example.com",
            -1,
            "/p",
            null,
            null,
        ]);
    });

    it("binds each component to the declared type", () => {
        const [scheme, userinfo, host, port, path, query, fragment] = GLib.Uri.split(
            "https://user@example.com:8080/p?q#f",
            GLib.UriFlags.NONE,
        );

        expect(scheme).toBe("https");
        expect(userinfo).toBe("user");
        expect(host).toBe("example.com");
        expect(port + 1).toBe(8081);
        expect(path).toBe("/p");
        expect(query).toBe("q");
        expect(fragment).toBe("f");
    });
});

describe("GLib.Uri.splitNetwork", () => {
    it("returns only the components the signature declares", () => {
        expect(GLib.Uri.splitNetwork("https://example.com/p", GLib.UriFlags.NONE)).toEqual([
            "https",
            "example.com",
            -1,
        ]);
    });
});

describe("GLib.Uri.splitWithUser", () => {
    it("returns only the components the signature declares", () => {
        expect(GLib.Uri.splitWithUser("https://example.com/p", GLib.UriFlags.NONE)).toEqual([
            "https",
            null,
            null,
            null,
            "example.com",
            -1,
            "/p",
            null,
            null,
        ]);
    });
});
