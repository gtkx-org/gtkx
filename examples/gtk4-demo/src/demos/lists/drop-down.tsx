import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkDropDown, GtkLabel, SimpleListItem } from "@gtkx/react";
import { useState } from "react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

interface Country {
    id: string;
    name: string;
    capital: string;
}

const countries: Country[] = [
    { id: "us", name: "United States", capital: "Washington D.C." },
    { id: "uk", name: "United Kingdom", capital: "London" },
    { id: "fr", name: "France", capital: "Paris" },
    { id: "de", name: "Germany", capital: "Berlin" },
    { id: "jp", name: "Japan", capital: "Tokyo" },
    { id: "au", name: "Australia", capital: "Canberra" },
    { id: "br", name: "Brazil", capital: "Brasília" },
    { id: "ca", name: "Canada", capital: "Ottawa" },
];

const DropDownDemo = () => {
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const selectedCountry = selectedId ? (countries.find((c) => c.id === selectedId) ?? null) : null;

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <GtkLabel label="Drop Down" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="About DropDown" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="GtkDropDown is a modern replacement for combo boxes. It displays a single selected item and reveals a list of options when clicked."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Country Selector" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkDropDown onSelectionChanged={(id) => setSelectedId(id)}>
                    {countries.map((country) => (
                        <SimpleListItem key={country.id} id={country.id} value={country.name} />
                    ))}
                </GtkDropDown>
                {selectedCountry && (
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4} cssClasses={["card"]} marginTop={8}>
                        <GtkBox
                            orientation={Gtk.Orientation.VERTICAL}
                            spacing={4}
                            marginStart={12}
                            marginEnd={12}
                            marginTop={12}
                            marginBottom={12}
                        >
                            <GtkLabel label="Selected Country" cssClasses={["heading"]} halign={Gtk.Align.START} />
                            <GtkLabel label={selectedCountry.name} halign={Gtk.Align.START} />
                            <GtkLabel
                                label={`Capital: ${selectedCountry.capital}`}
                                halign={Gtk.Align.START}
                                cssClasses={["dim-label"]}
                            />
                        </GtkBox>
                    </GtkBox>
                )}
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Features" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="DropDown supports custom item rendering, search/filter, and keyboard navigation. Use GtkDropDown with SimpleListItem children."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </GtkBox>
        </GtkBox>
    );
};

export const dropDownDemo: Demo = {
    id: "dropdown",
    title: "Drop Down",
    description: "Modern replacement for combo boxes with custom items.",
    keywords: ["dropdown", "combo", "select", "list", "GtkDropDown"],
    component: DropDownDemo,
    sourcePath: getSourcePath(import.meta.url, "drop-down.tsx"),
};
