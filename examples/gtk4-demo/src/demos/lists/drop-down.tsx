import * as Gtk from "@gtkx/ffi/gtk";
import { Box, DropDown, Label } from "@gtkx/react";
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
    const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);

    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <Label.Root label="Drop Down" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="About DropDown" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label.Root
                    label="GtkDropDown is a modern replacement for combo boxes. It displays a single selected item and reveals a list of options when clicked."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Country Selector" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <DropDown.Root
                    itemLabel={(item: Country) => item.name}
                    onSelectionChanged={(item: Country) => setSelectedCountry(item)}
                >
                    {countries.map((country) => (
                        <DropDown.Item key={country.id} item={country} />
                    ))}
                </DropDown.Root>
                {selectedCountry && (
                    <Box orientation={Gtk.Orientation.VERTICAL} spacing={4} cssClasses={["card"]} marginTop={8}>
                        <Box
                            orientation={Gtk.Orientation.VERTICAL}
                            spacing={4}
                            marginStart={12}
                            marginEnd={12}
                            marginTop={12}
                            marginBottom={12}
                        >
                            <Label.Root label="Selected Country" cssClasses={["heading"]} halign={Gtk.Align.START} />
                            <Label.Root label={selectedCountry.name} halign={Gtk.Align.START} />
                            <Label.Root
                                label={`Capital: ${selectedCountry.capital}`}
                                halign={Gtk.Align.START}
                                cssClasses={["dim-label"]}
                            />
                        </Box>
                    </Box>
                )}
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Features" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label.Root
                    label="DropDown supports custom item rendering, search/filter, and keyboard navigation. Use DropDown.Root with DropDown.Item children."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </Box>
        </Box>
    );
};

export const dropDownDemo: Demo = {
    id: "dropdown",
    title: "Drop Down",
    description: "Modern replacement for combo boxes with custom items.",
    keywords: ["dropdown", "combo", "select", "list", "GtkDropDown"],
    component: DropDownDemo,
    sourcePath: getSourcePath(import.meta.url, "dropdown.tsx"),
};
