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

const FILE_DEFAULTS = {
    [DEFAULT_VALUE_ONE]: "{{count}} file",
    [DEFAULT_VALUE_OTHER]: "{{count}} files",
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
    expect(gtkxI18n).toMatchObject(reactI18next);
    expect(getI18n().isInitialized).toBe(true);
    expect(getI18n().hasLoadedNamespace("translation")).toBe(true);
    expect(getI18n().modules.backend?.type).toBe("backend");
    expect(init).toBe(getI18n().init);
    expect(t).toBe(getI18n().t);
    expect(t("Hello, {{name}}!", { name: "Ada" })).toBe("Bonjour, Ada !");

    expect(t("greeting", { defaultValue: "Welcome, {{name}}!", name: "Ada" })).toBe(
        "Bienvenue, Ada !",
    );
};

const expectEdgeCases = (): void => {
    expect(t("{{count}} file", { count: 3, ...FILE_DEFAULTS })).toBe("3 fichiers");
    expect(t("Open", { context: "menu" })).toBe("Ouvrir");

    expect(
        t("{{count}} apple", {
            context: "fruit",
            count: 2,
            [DEFAULT_VALUE_ONE]: "{{count}} apple",
            [DEFAULT_VALUE_OTHER]: "{{count}} apples",
        }),
    ).toBe("2 pommes");

    expect(t("Hook message", { context: "missing" })).toBe("Message du hook");

    expect(
        getI18n().getFixedT(getI18n().language, "translation", "account")("title", {
            defaultValue: "Account title",
        }),
    ).toBe("Titre du compte");
};

const expectUnsupportedCountsToThrow = (): void => {
    expect(() => t("{{count}} file", { count: -1, ...FILE_DEFAULTS })).toThrow();
    expect(() => t("{{count}} file", { count: 1, ordinal: true, ...FILE_DEFAULTS })).toThrow();
};

describe("react-i18next gettext backend", () => {
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
