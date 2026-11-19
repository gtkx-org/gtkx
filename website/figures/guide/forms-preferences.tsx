import { ComboRow, EntryRow, useForm } from "@gtkx/forms";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwPreferencesGroup } from "@gtkx/jsx/adw";
import { GtkBox, GtkButton } from "@gtkx/jsx/gtk";

type Preferences = { displayName: string; theme: string };

const themes = [
    { id: "system", value: "Follow system" },
    { id: "light", value: "Light" },
    { id: "dark", value: "Dark" },
];

export const PreferencesForm = ({
    onSave,
}: {
    onSave: (values: Preferences) => void;
}) => {
    const form = useForm<Preferences>({
        defaultValues: { displayName: "", theme: "system" },
    });
    const submit = form.handleSubmit(onSave);

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={18}
            marginTop={24}
            marginBottom={24}
            marginStart={24}
            marginEnd={24}
        >
            <AdwPreferencesGroup title="Preferences">
                <EntryRow
                    control={form.control}
                    name="displayName"
                    title="Display name"
                    rules={{ required: "Enter a display name" }}
                />
                <ComboRow
                    control={form.control}
                    name="theme"
                    title="Theme"
                    items={themes}
                />
            </AdwPreferencesGroup>
            <GtkButton
                label="Save"
                onClicked={() => {
                    void submit();
                }}
            />
        </GtkBox>
    );
};
