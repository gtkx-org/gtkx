import { _, gettext, i18n, ngettext, npgettext, pgettext, useTranslation } from "@gtkx/i18n";
import { renderHook } from "@gtkx/testing";
import { describe, expect, it } from "vitest";

describe("gettext integration", () => {
    it("translates point lookups and the React hook through the real catalog", async () => {
        expect(gettext("Hello, {{name}}!", { name: "Ada" })).toBe("Bonjour, Ada !");
        expect(_("Hello, {{name}}!", { name: "Grace" })).toBe("Bonjour, Grace !");
        expect(i18n.isInitialized).toBe(true);
        const { result } = await renderHook(() => useTranslation());
        expect(result.current.ready).toBe(true);
        expect(result.current.t("Hook message")).toBe("Message du hook");
    });

    it("uses catalog plural rules and contexts while preserving missing-message fallbacks", () => {
        expect(ngettext("{{count}} file", "{{count}} files", 1)).toBe("1 fichier");
        expect(ngettext("{{count}} file", "{{count}} files", 3)).toBe("3 fichiers");
        expect(pgettext("menu", "Open")).toBe("Ouvrir");
        expect(npgettext("fruit", "{{count}} apple", "{{count}} apples", 2)).toBe("2 pommes");
        expect(pgettext("missing context", "Untranslated")).toBe("Untranslated");
        expect(npgettext("missing context", "One item", "Many items", 2)).toBe("Many items");
    });

    it("throws when gettext cannot represent the requested count", () => {
        expect(() => ngettext("One", "Many", 1.5)).toThrow();
        expect(() => ngettext("One", "Many", -1)).toThrow();
        expect(() => npgettext("items", "One", "Many", -1n)).toThrow();
    });
});
