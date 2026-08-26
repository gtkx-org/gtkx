import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { t } from "@gtkx/i18n";
import { AdwAlertDialog } from "@gtkx/jsx/adw";
import { GtkBox, GtkEntry, GtkToggleButton } from "@gtkx/jsx/gtk";
import { useState } from "react";
import { useStore } from "../store/index.js";
import { listDot } from "../styles.js";

const PALETTE = ["#3584e4", "#2ec27e", "#e66100", "#9141ac", "#e01b24", "#f5c211"];

export const NewListDialog = () => {
    const addList = useStore((state) => state.addList);
    const showDialog = useStore((state) => state.showDialog);
    const [name, setName] = useState("");
    const [color, setColor] = useState("#3584e4");
    const [firstSwatch, setFirstSwatch] = useState<Gtk.ToggleButton | null>(null);

    return (
        <AdwAlertDialog
            heading={t("New List")}
            defaultResponse="add"
            closeResponse="cancel"
            responses={[
                { id: "cancel", label: t("Cancel") },
                { id: "add", label: t("Add"), appearance: Adw.ResponseAppearance.SUGGESTED },
            ]}
            onResponse={(id) => {
                if (id === "add") addList(name, color);
                showDialog("none");
            }}
        >
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={16} marginTop={8}>
                <GtkEntry
                    placeholderText={t("List name")}
                    activatesDefault
                    onChanged={(self) => setName(self.text)}
                />
                <GtkBox spacing={6} halign={Gtk.Align.CENTER}>
                    {PALETTE.map((swatch, index) => (
                        <GtkToggleButton
                            key={swatch}
                            ref={index === 0 ? setFirstSwatch : undefined}
                            group={index === 0 ? undefined : firstSwatch}
                            active={color === swatch}
                            cssClasses={["flat"]}
                            accessibleLabel={t("Color {{color}}", { color: swatch })}
                            onClicked={() => setColor(swatch)}
                        >
                            <GtkBox
                                widthRequest={22}
                                heightRequest={22}
                                cssClasses={[listDot(swatch)]}
                                accessibleRole={Gtk.AccessibleRole.PRESENTATION}
                            />
                        </GtkToggleButton>
                    ))}
                </GtkBox>
            </GtkBox>
        </AdwAlertDialog>
    );
};
