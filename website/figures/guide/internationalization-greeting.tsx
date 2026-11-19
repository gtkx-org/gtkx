import { useTranslation } from "@gtkx/i18n";
import { GtkLabel } from "@gtkx/jsx/gtk";

export function Greeting({ name }: { name: string }) {
    const { t } = useTranslation();

    return <GtkLabel label={t("Hello, {{name}}!", { name })} />;
}
