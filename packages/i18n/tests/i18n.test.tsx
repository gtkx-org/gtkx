import type { ReactNode } from "react";
import * as gtkxI18n from "@gtkx/i18n";
import {
    getI18n,
    init,
    t,
    Trans,
    Translation,
    useTranslation,
    withTranslation,
    type WithTranslation,
} from "@gtkx/i18n";
import { GtkBox, GtkLabel } from "@gtkx/jsx/gtk";
import { render, screen } from "@gtkx/testing";
import * as reactI18next from "react-i18next";
import { describe, expect, it } from "vitest";

const DEFAULT_VALUE_ONE = "defaultValue_one";
const DEFAULT_VALUE_OTHER = "defaultValue_other";
const DEFAULT_VALUE_ZERO = "defaultValue_zero";

const WrappedLabel = withTranslation()(({ t: translate }: WithTranslation): ReactNode => (
    <GtkLabel>{translate("Hook message")}</GtkLabel>
));

const ReactApiProbe = (): ReactNode => (
    <GtkBox>
        <HookLabel />
        <WrappedLabel />
        <Translation>{(translate) => <GtkLabel>{translate("Hook message")}</GtkLabel>}</Translation>
        <GtkLabel>
            <Trans i18nKey="Hook message" />
        </GtkLabel>
    </GtkBox>
);

const HookLabel = (): ReactNode => {
    const { t: translate } = useTranslation();

    return <GtkLabel>{translate("Hook message")}</GtkLabel>;
};

const expectPublicApi = (): void => {
    expect(gtkxI18n).toMatchObject(reactI18next);

    expect(Object.keys(gtkxI18n).toSorted((left, right) => left.localeCompare(right))).toEqual(
        [...new Set([...Object.keys(reactI18next), "init", "t"])].toSorted((left, right) =>
            left.localeCompare(right),
        ),
    );
};

const expectConfiguredBackend = (): void => {
    expect(getI18n().isInitialized).toBe(true);
    expect(getI18n().hasLoadedNamespace("translation")).toBe(true);
    expect(getI18n().modules.backend?.type).toBe("backend");
    expect(init).toBe(getI18n().init);
    expect(t).toBe(getI18n().t);
    expect(t("Hello, {{name}}!", { name: "Ada" })).toBe("Bonjour, Ada !");

    expect(t("stable greeting", { defaultValue: "Welcome, {{name}}!", name: "Ada" })).toBe(
        "Bienvenue, Ada !",
    );
};

describe("react-i18next gettext backend", () => {
    it("shares the configured singleton across the direct and React APIs", async () => {
        expectPublicApi();
        expectConfiguredBackend();
        await render(<ReactApiProbe />);
        expect(screen.getAllByText("Message du hook")).toHaveLength(4);
    });

    it("uses GNU plural and context rules while preserving i18next fallbacks", () => {
        expect(t("{{count}} file", { count: 1 })).toBe("1 fichier");
        expect(t("{{count}} file", "{{count}} files", { count: 3 })).toBe("3 fichiers");

        expect(
            t("standard files", {
                count: 2,
                [DEFAULT_VALUE_ONE]: "{{count}} standard file",
                [DEFAULT_VALUE_OTHER]: "{{count}} standard files",
            }),
        ).toBe("2 fichiers standards");

        expect(t("Open", { context: "menu" })).toBe("Ouvrir");
        expect(t("{{count}} apple", "{{count}} apples", { context: "fruit", count: 2 })).toBe("2 pommes");
        expect(t("Hook message", { context: "missing" })).toBe("Message du hook");

        expect(t("{{count}} file", "{{count}} files", { context: "missing", count: 2 })).toBe(
            "2 fichiers",
        );

        expect(t("Missing options fallback", { defaultValue: "Welcome, {{name}}", name: "Ada" })).toBe(
            "Welcome, Ada",
        );

        expect(t("Missing positional fallback", "Hello, {{name}}", { name: "Grace" })).toBe("Hello, Grace");
        expect(t("Missing contextual message", { context: "menu" })).toBe("Missing contextual message");
        expect(t("One missing item", "Many missing items", { count: 2 })).toBe("Many missing items");

        expect(
            getI18n().getFixedT(getI18n().language, "translation", "account")("title", {
                defaultValue: "Account title",
            }),
        ).toBe("Titre du compte");
    });

    it("throws for counts that GNU gettext cannot represent", () => {
        expect(() => t("One", { count: 1.5 })).toThrow();
        expect(() => t("One", { count: -1 })).toThrow();
        expect(() => t("One", "Many", { count: Number.MAX_SAFE_INTEGER + 1 })).toThrow();
        expect(() => t("First", { count: 1, ordinal: true })).toThrow();
        expect(() => t("None", { count: 0, [DEFAULT_VALUE_ZERO]: "No items" })).toThrow();
    });
});
