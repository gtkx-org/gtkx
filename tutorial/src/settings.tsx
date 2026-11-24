import * as Adw from "@gtkx/gi/adw";
import { t } from "@gtkx/i18n";
import schema from "../data/dev.gtkx.Notes.gschema.xml";

type ColorScheme = (typeof schema.values)["color-scheme"][number];

const COLOR_SCHEMES: Record<ColorScheme, { label: () => string; value: Adw.ColorScheme }> = {
    default: { label: () => t("Follow System"), value: Adw.ColorScheme.DEFAULT },
    light: { label: () => t("Light"), value: Adw.ColorScheme.FORCE_LIGHT },
    dark: { label: () => t("Dark"), value: Adw.ColorScheme.FORCE_DARK },
};

const colorSchemeItems = (): { id: ColorScheme; value: string }[] =>
    schema.values["color-scheme"].map((id) => ({ id, value: COLOR_SCHEMES[id].label() }));

const toColorScheme = (id: string | null): ColorScheme | undefined =>
    schema.values["color-scheme"].find((scheme) => scheme === id);

export { COLOR_SCHEMES, type ColorScheme, colorSchemeItems, schema, toColorScheme };
