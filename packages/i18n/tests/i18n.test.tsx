import type { ReactNode } from "react";
import {
    getI18n,
    t,
    Trans,
    Translation,
    useTranslation,
    withTranslation,
    type WithTranslation,
} from "@gtkx/i18n";
import { GtkBox, GtkLabel } from "@gtkx/jsx/gtk";
import { render, screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";

const FILE_DEFAULTS = {
    defaultValue_one: "{{count}} file",
    defaultValue_other: "{{count}} files",
};

const WrappedLabel = withTranslation()(({ t: translate }: WithTranslation): ReactNode => (
    <GtkLabel>{translate("Hook message")}</GtkLabel>
));

const ReactApiProbe = (): ReactNode => {
    const { t: translate } = useTranslation();

    return (
        <GtkBox>
            <GtkLabel>{translate("Hook message")}</GtkLabel>
            <WrappedLabel />
            <Translation>{(renderT) => <GtkLabel>{renderT("Hook message")}</GtkLabel>}</Translation>
            <GtkLabel>
                <Trans i18nKey="Hook message" />
            </GtkLabel>
        </GtkBox>
    );
};

const expectDirectApi = (): void => {
    expect(t("Hello, {{name}}!", { name: "Ada" })).toBe("Bonjour, Ada !");

    expect(t("greeting", { defaultValue: "Welcome, {{name}}!", name: "Ada" })).toBe(
        "Bienvenue, Ada !",
    );
};

const expectEdgeCases = (): void => {
    expect(t("{{count}} file", { count: 0, ...FILE_DEFAULTS })).toBe("0 fichier");
    expect(t("{{count}} file", { count: 1, ...FILE_DEFAULTS })).toBe("1 fichier");
    expect(t("{{count}} file", { count: 3, ...FILE_DEFAULTS })).toBe("3 fichiers");
    expect(t("Open", { context: "menu" })).toBe("Ouvrir");

    expect(
        t("{{count}} apple", {
            context: "fruit",
            count: 2,
            defaultValue_one: "{{count}} apple",
            defaultValue_other: "{{count}} apples",
        }),
    ).toBe("2 pommes");

    expect(t("Hook message", { context: "missing" })).toBe("Message du hook");
    expect(t("{{count}} file", { context: "missing", count: 2, ...FILE_DEFAULTS })).toBe("2 fichiers");
    expect(t("Missing message", { defaultValue: "Fallback message" })).toBe("Fallback message");

    expect(
        getI18n().getFixedT(getI18n().language, "translation", "account")("title", {
            defaultValue: "Account title",
        }),
    ).toBe("Titre du compte");
};

const expectUnsupportedCountsToThrow = (): void => {
    expect(() => t("{{count}} file", { count: -1, ...FILE_DEFAULTS })).toThrow();
    expect(() => t("{{count}} file", { count: 0.5, ...FILE_DEFAULTS })).toThrow();
    expect(() => t("{{count}} file", { count: 1, ordinal: true, ...FILE_DEFAULTS })).toThrow();
};

describe("react-i18next gettext backend", () => {
    it("preserves contextual translations that intentionally match the source", async () => {
        await render(
            <GtkBox>
                <GtkLabel>{t("Open", { context: "technical" })}</GtkLabel>
                <GtkLabel>
                    {t("{{count}} item", {
                        context: "technical",
                        count: 2,
                        defaultValue_one: "{{count}} item",
                        defaultValue_other: "{{count}} items",
                    })}
                </GtkLabel>
            </GtkBox>,
        );
        expect(screen.getByText("Open")).toBeDefined();
        expect(screen.getByText("2 items")).toBeDefined();
    });

    it("formats interpolated numbers in the selected locale", async () => {
        await render(<GtkLabel>{t("Total {{amount, number}}", { amount: 1234.5 })}</GtkLabel>);
        expect(screen.getByText("Total 1\u{202F}234,5")).toBeDefined();
    });

    it("shares the configured singleton across the direct and React APIs", async () => {
        expectDirectApi();
        await render(<ReactApiProbe />);
        expect(screen.getAllByText("Message du hook")).toHaveLength(4);
    });

    it("uses GNU plural and context rules with upstream i18next options", () => {
        expectEdgeCases();
    });

    it("throws for counts that GNU gettext cannot represent", () => {
        expectUnsupportedCountsToThrow();
    });
});
