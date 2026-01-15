import * as Gtk from "@gtkx/ffi/gtk";
import {
    GtkBox,
    GtkButton,
    GtkDropDown,
    GtkFrame,
    GtkImage,
    GtkLabel,
    GtkScrolledWindow,
    GtkSearchEntry,
    x,
} from "@gtkx/react";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./listview-selections.tsx?raw";

interface FruitItem {
    id: string;
    name: string;
    icon: string;
    color: string;
}

const fruits: FruitItem[] = [
    { id: "apple", name: "Apple", icon: "emoji-food-symbolic", color: "Red" },
    { id: "banana", name: "Banana", icon: "emoji-food-symbolic", color: "Yellow" },
    { id: "cherry", name: "Cherry", icon: "emoji-food-symbolic", color: "Red" },
    { id: "date", name: "Date", icon: "emoji-food-symbolic", color: "Brown" },
    { id: "elderberry", name: "Elderberry", icon: "emoji-food-symbolic", color: "Purple" },
    { id: "fig", name: "Fig", icon: "emoji-food-symbolic", color: "Purple" },
    { id: "grape", name: "Grape", icon: "emoji-food-symbolic", color: "Green" },
    { id: "honeydew", name: "Honeydew", icon: "emoji-food-symbolic", color: "Green" },
    { id: "kiwi", name: "Kiwi", icon: "emoji-food-symbolic", color: "Brown" },
    { id: "lemon", name: "Lemon", icon: "emoji-food-symbolic", color: "Yellow" },
    { id: "mango", name: "Mango", icon: "emoji-food-symbolic", color: "Orange" },
    { id: "nectarine", name: "Nectarine", icon: "emoji-food-symbolic", color: "Orange" },
    { id: "orange", name: "Orange", icon: "emoji-food-symbolic", color: "Orange" },
    { id: "papaya", name: "Papaya", icon: "emoji-food-symbolic", color: "Orange" },
    { id: "quince", name: "Quince", icon: "emoji-food-symbolic", color: "Yellow" },
    { id: "raspberry", name: "Raspberry", icon: "emoji-food-symbolic", color: "Red" },
    { id: "strawberry", name: "Strawberry", icon: "emoji-food-symbolic", color: "Red" },
    { id: "tomato", name: "Tomato", icon: "emoji-food-symbolic", color: "Red" },
    { id: "watermelon", name: "Watermelon", icon: "emoji-food-symbolic", color: "Green" },
];

interface Country {
    id: string;
    name: string;
    code: string;
    continent: string;
}

const countries: Country[] = [
    { id: "ar", name: "Argentina", code: "AR", continent: "South America" },
    { id: "au", name: "Australia", code: "AU", continent: "Oceania" },
    { id: "br", name: "Brazil", code: "BR", continent: "South America" },
    { id: "ca", name: "Canada", code: "CA", continent: "North America" },
    { id: "cn", name: "China", code: "CN", continent: "Asia" },
    { id: "de", name: "Germany", code: "DE", continent: "Europe" },
    { id: "es", name: "Spain", code: "ES", continent: "Europe" },
    { id: "fr", name: "France", code: "FR", continent: "Europe" },
    { id: "gb", name: "United Kingdom", code: "GB", continent: "Europe" },
    { id: "in", name: "India", code: "IN", continent: "Asia" },
    { id: "it", name: "Italy", code: "IT", continent: "Europe" },
    { id: "jp", name: "Japan", code: "JP", continent: "Asia" },
    { id: "kr", name: "South Korea", code: "KR", continent: "Asia" },
    { id: "mx", name: "Mexico", code: "MX", continent: "North America" },
    { id: "nl", name: "Netherlands", code: "NL", continent: "Europe" },
    { id: "nz", name: "New Zealand", code: "NZ", continent: "Oceania" },
    { id: "pl", name: "Poland", code: "PL", continent: "Europe" },
    { id: "pt", name: "Portugal", code: "PT", continent: "Europe" },
    { id: "ru", name: "Russia", code: "RU", continent: "Europe/Asia" },
    { id: "se", name: "Sweden", code: "SE", continent: "Europe" },
    { id: "us", name: "United States", code: "US", continent: "North America" },
    { id: "za", name: "South Africa", code: "ZA", continent: "Africa" },
];

interface IconOption {
    id: string;
    name: string;
    icon: string;
}

const iconOptions: IconOption[] = [
    { id: "home", name: "Home", icon: "go-home-symbolic" },
    { id: "settings", name: "Settings", icon: "emblem-system-symbolic" },
    { id: "user", name: "User", icon: "avatar-default-symbolic" },
    { id: "folder", name: "Folder", icon: "folder-symbolic" },
    { id: "document", name: "Document", icon: "document-new-symbolic" },
    { id: "music", name: "Music", icon: "audio-x-generic-symbolic" },
    { id: "video", name: "Video", icon: "video-x-generic-symbolic" },
    { id: "image", name: "Image", icon: "image-x-generic-symbolic" },
];

const selectionModes = [
    {
        mode: Gtk.SelectionMode.NONE,
        label: "None",
        description: "No selection allowed",
    },
    {
        mode: Gtk.SelectionMode.SINGLE,
        label: "Single",
        description: "Select one item (click to toggle)",
    },
    {
        mode: Gtk.SelectionMode.BROWSE,
        label: "Browse",
        description: "Always have one item selected",
    },
    {
        mode: Gtk.SelectionMode.MULTIPLE,
        label: "Multiple",
        description: "Select multiple items (Ctrl+click, Shift+click)",
    },
];

const ListViewSelectionsDemo = () => {
    const [selectedFruit, setSelectedFruit] = useState("apple");
    const [selectedCountry, setSelectedCountry] = useState("us");
    const [selectedIcon, setSelectedIcon] = useState("home");
    const [countryFilter, setCountryFilter] = useState("");

    const [selectionMode, setSelectionMode] = useState(Gtk.SelectionMode.SINGLE);
    const [selected, setSelected] = useState<string[]>([]);
    const [lastActivated, setLastActivated] = useState<string | null>(null);

    const handleModeChange = (mode: Gtk.SelectionMode) => {
        setSelectionMode(mode);
        if (mode === Gtk.SelectionMode.NONE) {
            setSelected([]);
        } else if (mode === Gtk.SelectionMode.BROWSE && selected.length === 0) {
            setSelected([fruits[0]?.id ?? ""]);
        } else if (mode === Gtk.SelectionMode.SINGLE && selected.length > 1) {
            setSelected(selected.slice(0, 1));
        }
    };

    const handleActivate = (_list: Gtk.ListView, position: number) => {
        const item = fruits[position];
        if (item) {
            setLastActivated(item.name);
        }
    };

    const selectAll = () => {
        if (selectionMode === Gtk.SelectionMode.MULTIPLE) {
            setSelected(fruits.map((f) => f.id));
        }
    };

    const selectNone = () => {
        if (selectionMode !== Gtk.SelectionMode.BROWSE) {
            setSelected([]);
        }
    };

    const filteredCountries = countries.filter(
        (c) =>
            countryFilter === "" ||
            c.name.toLowerCase().includes(countryFilter.toLowerCase()) ||
            c.code.toLowerCase().includes(countryFilter.toLowerCase()),
    );

    const currentModeInfo = selectionModes.find((m) => m.mode === selectionMode);
    const selectedFruitInfo = fruits.find((f) => f.id === selectedFruit);
    const selectedCountryInfo = countries.find((c) => c.id === selectedCountry);
    const selectedIconInfo = iconOptions.find((i) => i.id === selectedIcon);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={24}>
            <GtkLabel label="Selections" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="GtkDropDown provides a compact way to select from a list of options. This demo shows basic dropdowns, filtered dropdowns, and dropdowns with custom content alongside ListView selection modes."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="Basic Dropdown">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="A simple dropdown using GtkDropDown with string items. Click to open the popup and select an option."
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />
                    <GtkBox spacing={16}>
                        <GtkLabel label="Select a fruit:" halign={Gtk.Align.START} />
                        <GtkDropDown selectedId={selectedFruit} onSelectionChanged={setSelectedFruit} hexpand>
                            {fruits.map((fruit) => (
                                <x.SimpleListItem key={fruit.id} id={fruit.id} value={fruit.name} />
                            ))}
                        </GtkDropDown>
                    </GtkBox>
                    {selectedFruitInfo && (
                        <GtkLabel
                            label={`Selected: ${selectedFruitInfo.name} (${selectedFruitInfo.color})`}
                            cssClasses={["dim-label"]}
                            halign={Gtk.Align.START}
                        />
                    )}
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Dropdown with Search Filter">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="For larger lists, adding a search filter helps users find items quickly. Type to filter the list."
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />
                    <GtkBox spacing={16}>
                        <GtkLabel label="Country:" halign={Gtk.Align.START} />
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8} hexpand>
                            <GtkSearchEntry
                                placeholderText="Search countries..."
                                text={countryFilter}
                                onSearchChanged={(entry) => setCountryFilter(entry.getText())}
                            />
                            <GtkDropDown selectedId={selectedCountry} onSelectionChanged={setSelectedCountry}>
                                {filteredCountries.map((country) => (
                                    <x.SimpleListItem
                                        key={country.id}
                                        id={country.id}
                                        value={`${country.name} (${country.code})`}
                                    />
                                ))}
                            </GtkDropDown>
                        </GtkBox>
                    </GtkBox>
                    {selectedCountryInfo && (
                        <GtkLabel
                            label={`Selected: ${selectedCountryInfo.name} - ${selectedCountryInfo.continent}`}
                            cssClasses={["dim-label"]}
                            halign={Gtk.Align.START}
                        />
                    )}
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Dropdown with Icons">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="Dropdowns can display icons alongside text for better visual identification."
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />
                    <GtkBox spacing={16}>
                        <GtkLabel label="Navigation:" halign={Gtk.Align.START} />
                        <GtkDropDown selectedId={selectedIcon} onSelectionChanged={setSelectedIcon} hexpand>
                            {iconOptions.map((option) => (
                                <x.SimpleListItem key={option.id} id={option.id} value={option.name} />
                            ))}
                        </GtkDropDown>
                    </GtkBox>
                    {selectedIconInfo && (
                        <GtkBox spacing={8} halign={Gtk.Align.START}>
                            <GtkImage iconName={selectedIconInfo.icon} pixelSize={24} />
                            <GtkLabel label={`Selected: ${selectedIconInfo.name}`} cssClasses={["dim-label"]} />
                        </GtkBox>
                    )}
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="ListView Selection Modes">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="ListView supports four selection modes that control how users can select items."
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />
                    <GtkBox spacing={8}>
                        {selectionModes.map((m) => (
                            <GtkButton
                                key={m.mode}
                                label={m.label}
                                onClicked={() => handleModeChange(m.mode)}
                                cssClasses={selectionMode === m.mode ? ["suggested-action"] : ["flat"]}
                            />
                        ))}
                    </GtkBox>
                    <GtkLabel
                        label={currentModeInfo?.description ?? ""}
                        cssClasses={["dim-label"]}
                        halign={Gtk.Align.START}
                    />

                    <GtkBox spacing={8}>
                        <GtkButton
                            label="Select All"
                            onClicked={selectAll}
                            sensitive={selectionMode === Gtk.SelectionMode.MULTIPLE}
                            cssClasses={["flat"]}
                        />
                        <GtkButton
                            label="Select None"
                            onClicked={selectNone}
                            sensitive={
                                selectionMode !== Gtk.SelectionMode.BROWSE && selectionMode !== Gtk.SelectionMode.NONE
                            }
                            cssClasses={["flat"]}
                        />
                        <GtkLabel
                            label={`${selected.length} selected`}
                            cssClasses={["dim-label"]}
                            hexpand
                            halign={Gtk.Align.END}
                        />
                    </GtkBox>

                    <GtkScrolledWindow heightRequest={200} hscrollbarPolicy={Gtk.PolicyType.NEVER}>
                        <x.ListView<FruitItem>
                            estimatedItemHeight={48}
                            showSeparators
                            selectionMode={selectionMode}
                            selected={selected}
                            onSelectionChanged={setSelected}
                            onActivate={handleActivate}
                            renderItem={(item) => (
                                <GtkBox spacing={12} marginTop={8} marginBottom={8} marginStart={12} marginEnd={12}>
                                    <GtkImage iconName={item?.icon ?? ""} pixelSize={24} />
                                    <GtkLabel label={item?.name ?? ""} hexpand halign={Gtk.Align.START} />
                                    <GtkLabel label={item?.color ?? ""} cssClasses={["dim-label", "caption"]} />
                                </GtkBox>
                            )}
                        >
                            {fruits.map((fruit) => (
                                <x.ListItem key={fruit.id} id={fruit.id} value={fruit} />
                            ))}
                        </x.ListView>
                    </GtkScrolledWindow>

                    {lastActivated && (
                        <GtkLabel
                            label={`Last activated: ${lastActivated}`}
                            cssClasses={["dim-label", "caption"]}
                            halign={Gtk.Align.START}
                        />
                    )}
                </GtkBox>
            </GtkFrame>
        </GtkBox>
    );
};

export const listviewSelectionsDemo: Demo = {
    id: "listview-selections",
    title: "Lists/Selections",
    description: "GtkDropDown examples and ListView selection modes",
    keywords: [
        "dropdown",
        "listview",
        "selection",
        "GtkDropDown",
        "GtkListView",
        "single",
        "multiple",
        "browse",
        "none",
        "combo",
    ],
    component: ListViewSelectionsDemo,
    sourceCode,
};
