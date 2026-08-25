import { ComboRow } from "@gtkx/components/adw";
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
        <AdwPreferencesDialog onClosed={onClose} title="Preferences">
            <AdwPreferencesPage title="General" iconName="preferences-system-symbolic">
                <AdwPreferencesGroup title="Appearance">
                    <ComboRow
                        title="Theme"
                        items={[
                            { id: "default", value: "Follow system" },
                            { id: "light", value: "Light" },
                            { id: "dark", value: "Dark" },
                        ]}
                        selectedId={scheme}
                        onSelectionChanged={(id) => {
                            if (isScheme(id)) setScheme(id);
                        }}
                    />
                </AdwPreferencesGroup>
                <AdwPreferencesGroup title="Tasks">
                    <ComboRow
                        title="Sort order"
                        items={[
                            { id: "manual", value: "Manual" },
                            { id: "due-date", value: "Due date" },
                            { id: "title", value: "Title" },
                            { id: "created", value: "Date created" },
                        ]}
                        selectedId={sortOrder}
                        onSelectionChanged={(id) => {
                            if (isSort(id)) setSortOrder(id);
                        }}
                    />
                    <AdwSpinRow
                        title="Reminder lead time"
                        subtitle="Minutes before a task is due"
                        adjustment={<GtkAdjustment value={reminderMinutes} lower={0} upper={1440} stepIncrement={5} />}
                        onNotifyValue={(value) => setReminderMinutes(value ?? 30)}
                    />
                </AdwPreferencesGroup>
            </AdwPreferencesPage>
        </AdwPreferencesDialog>
    );
};
