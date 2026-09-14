import { ComboRow } from "@gtkx/components";
import { t } from "@gtkx/i18n";
import { AdwPreferencesDialog, AdwPreferencesGroup, AdwPreferencesPage, AdwSpinRow } from "@gtkx/jsx/adw";
import { GtkAdjustment } from "@gtkx/jsx/gtk";
import { useSetting } from "@gtkx/react";
import { useAppSettings } from "./settings.js";
import schema from "../../data/com.gtkx.tutorial.gschema.xml";
import { useSortOrder } from "../hooks/use-sort-order.js";
import { colorSchemeItems, type SortOrder, sortOrderItems } from "../settings.js";

export const Preferences = ({ onClose }: { onClose: () => void }) => {
    const settings = useAppSettings();
    const [scheme, setScheme] = useSetting(settings, schema, "color-scheme");
    const [sortOrder, setSortOrder] = useSortOrder();
    const [reminderMinutes, setReminderMinutes] = useSetting(settings, schema, "reminder-minutes");

    return (
        <AdwPreferencesDialog onClosed={onClose} title={t("Preferences")}>
            <AdwPreferencesPage title={t("General")} iconName="preferences-system-symbolic">
                <AdwPreferencesGroup title={t("Appearance")}>
                    <ComboRow
                        title={t("Theme")}
                        items={colorSchemeItems()}
                        selectedId={scheme}
                        onSelectionChanged={(id) => setScheme(id as string)}
                    />
                </AdwPreferencesGroup>
                <AdwPreferencesGroup title={t("Tasks")}>
                    <ComboRow
                        title={t("Sort order")}
                        items={sortOrderItems()}
                        selectedId={sortOrder}
                        onSelectionChanged={(id) => setSortOrder(id as SortOrder)}
                    />
                    <AdwSpinRow
                        title={t("Reminder lead time")}
                        subtitle={t("Minutes before a task is due")}
                        adjustment={<GtkAdjustment value={reminderMinutes} lower={0} upper={1440} stepIncrement={5} />}
                        onNotifyValue={(value) => setReminderMinutes(value as number)}
                    />
                </AdwPreferencesGroup>
            </AdwPreferencesPage>
        </AdwPreferencesDialog>
    );
};
