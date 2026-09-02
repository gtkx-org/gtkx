import { ComboRow } from "@gtkx/components";
import { t } from "@gtkx/i18n";
import { AdwPreferencesDialog, AdwPreferencesGroup, AdwPreferencesPage, AdwSpinRow } from "@gtkx/jsx/adw";
import { GtkAdjustment } from "@gtkx/jsx/gtk";
import { useSetting } from "@gtkx/react";
import schema from "../../data/com.gtkx.tutorial.gschema.xml";
import { useSortOrder } from "../hooks/use-sort-order.js";

type Scheme = "default" | "light" | "dark";
type Sort = "manual" | "due-date" | "title" | "created";

const isScheme = (value: string): value is Scheme => value === "default" || value === "light" || value === "dark";
const isSort = (value: string): value is Sort =>
    value === "manual" || value === "due-date" || value === "title" || value === "created";

export const Preferences = ({ onClose }: { onClose: () => void }) => {
    const [scheme, setScheme] = useSetting(schema, "color-scheme");
    const [sortOrder, setSortOrder] = useSortOrder();
    const [reminderMinutes, setReminderMinutes] = useSetting(schema, "reminder-minutes");

    return (
        <AdwPreferencesDialog onClosed={onClose} title={t("Preferences")}>
            <AdwPreferencesPage title={t("General")} iconName="preferences-system-symbolic">
                <AdwPreferencesGroup title={t("Appearance")}>
                    <ComboRow
                        title={t("Theme")}
                        items={[
                            { id: "default", value: t("Follow system") },
                            { id: "light", value: t("Light") },
                            { id: "dark", value: t("Dark") },
                        ]}
                        selectedId={scheme}
                        onSelectionChanged={(id) => {
                            if (isScheme(id)) setScheme(id);
                        }}
                    />
                </AdwPreferencesGroup>
                <AdwPreferencesGroup title={t("Tasks")}>
                    <ComboRow
                        title={t("Sort order")}
                        items={[
                            { id: "manual", value: t("Manual") },
                            { id: "due-date", value: t("Due date") },
                            { id: "title", value: t("Title") },
                            { id: "created", value: t("Date created") },
                        ]}
                        selectedId={sortOrder}
                        onSelectionChanged={(id) => {
                            if (isSort(id)) setSortOrder(id);
                        }}
                    />
                    <AdwSpinRow
                        title={t("Reminder lead time")}
                        subtitle={t("Minutes before a task is due")}
                        adjustment={<GtkAdjustment value={reminderMinutes} lower={0} upper={1440} stepIncrement={5} />}
                        onNotifyValue={(value) => setReminderMinutes(value ?? 30)}
                    />
                </AdwPreferencesGroup>
            </AdwPreferencesPage>
        </AdwPreferencesDialog>
    );
};
