import { ListView } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkImage, GtkLabel, GtkScrolledWindow } from "@gtkx/jsx/gtk";
import type { Demo } from "../types.js";
import sourceCode from "./listview-weather.tsx?raw";
import rawWeatherData from "./listview_weather.txt?raw";

type WeatherType = "clear" | "few-clouds" | "fog" | "overcast" | "showers-scattered" | "showers" | "snow" | "storm";

type WeatherInfo = {
    id: string;
    hour: string;
    temperature: number;
    weatherType: WeatherType;
};

type WeatherCode = {
    code: string;
    weatherType: WeatherType;
};

type WeatherState = {
    data: WeatherInfo[];
    timestamp: number;
    temperature: number;
    weatherType: WeatherType;
};

const WEATHER_ICONS: Record<WeatherType, string> = {
    clear: "weather-clear-symbolic",
    "few-clouds": "weather-few-clouds-symbolic",
    fog: "weather-fog-symbolic",
    overcast: "weather-overcast-symbolic",
    "showers-scattered": "weather-showers-scattered-symbolic",
    showers: "weather-showers-symbolic",
    snow: "weather-snow-symbolic",
    storm: "weather-storm-symbolic",
};

const PRECIPITATION_CODES: WeatherCode[] = [
    { code: "SN", weatherType: "snow" },
    { code: "TS", weatherType: "storm" },
    { code: "DZ", weatherType: "showers-scattered" },
    { code: "SH", weatherType: "showers" },
    { code: "RA", weatherType: "showers" },
    { code: "FG", weatherType: "fog" },
];

const CLOUD_CODES: WeatherCode[] = [
    { code: "OVC", weatherType: "overcast" },
    { code: "BKN", weatherType: "few-clouds" },
    { code: "SCT", weatherType: "few-clouds" },
    { code: "VV", weatherType: "fog" },
];

const THIRTY_MINUTES_MS = 30 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

const listviewWeatherDemo: Demo = {
    id: "listview-weather",
    title: "Lists/Weather",
    description:
        "This demo shows a few of the rarer features of GtkListView and how they can be used to display " +
        "weather information.\n\nThe hourly weather info uses a horizontal listview. This is easy to achieve " +
        "because GtkListView implements the GtkOrientable interface. To make the items in the list stand out " +
        "more, the listview uses separators.\n\nA GtkNoSelectionModel is used to make sure no item in the list " +
        "can be selected. All other interactions with the items is still possible.\n\nThe dataset used here " +
        "has 70 000 items.",
    keywords: [],
    component: ListViewWeatherDemo,
    sourceCode,
    defaultWidth: 600,
    defaultHeight: 400,
};

function matchWeatherCode(source: string, codes: WeatherCode[]): WeatherType | null {
    for (const { code, weatherType } of codes) {
        if (source.includes(code)) {
            return weatherType;
        }
    }

    return null;
}

function parseWeatherType(clouds: string, precip: string, fallback: WeatherType): WeatherType {
    const precipitation = matchWeatherCode(precip, PRECIPITATION_CODES);

    if (precipitation !== null) {
        return precipitation;
    }

    if (clouds === "M" || clouds === "") {
        return fallback;
    }

    return matchWeatherCode(clouds, CLOUD_CODES) ?? "clear";
}

function parseTimestamp(dateStr: string): number {
    const withSeconds = `${dateStr}:00`;

    return new Date(`${withSeconds.replace(" ", "T")}Z`).getTime();
}

function formatHour(timestamp: number): string {
    const date = new Date(timestamp);
    const hours = date.getUTCHours().toString().padStart(2, "0");
    const minutes = date.getUTCMinutes().toString().padStart(2, "0");

    return `${hours}:${minutes}`;
}

function parseTemperature(field: string, fallback: number): number {
    const value = Number(field);

    if (field.trim() === "" || Number.isNaN(value)) {
        return fallback;
    }

    return value;
}

function pushWeatherEntry(state: WeatherState) {
    state.data.push({
        id: `weather-${String(state.data.length)}`,
        hour: formatHour(state.timestamp),
        temperature: state.temperature,
        weatherType: state.weatherType,
    });
}

function fillWeatherGap(state: WeatherState, dateMs: number) {
    while (dateMs - state.timestamp > THIRTY_MINUTES_MS) {
        state.timestamp += ONE_HOUR_MS;
        pushWeatherEntry(state);
    }
}

function updateLastWeatherEntry(state: WeatherState) {
    const last = state.data.at(-1);

    if (last) {
        last.temperature = state.temperature;
        last.weatherType = state.weatherType;
    }
}

function applyWeatherLine(state: WeatherState, line: string) {
    const fields = line.split(",");

    if (fields.length < 4) {
        return;
    }

    const [dateField = "", temperatureField = "", cloudField = "", precipitationField = ""] = fields;
    fillWeatherGap(state, parseTimestamp(dateField));
    state.temperature = parseTemperature(temperatureField, state.temperature);
    state.weatherType = parseWeatherType(cloudField, precipitationField, state.weatherType);
    updateLastWeatherEntry(state);
}

function parseWeatherData(): WeatherInfo[] {
    const state: WeatherState = {
        data: [],
        timestamp: Date.UTC(2011, 0, 1, 0, 0, 0),
        temperature: 0,
        weatherType: "clear",
    };

    pushWeatherEntry(state);

    for (const line of rawWeatherData.split("\n")) {
        applyWeatherLine(state, line);
    }

    return state.data;
}

function renderWeatherItem({ item }: { item: WeatherInfo }) {
    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} vexpand>
            <GtkLabel widthChars={5} valign={Gtk.Align.START}>
                {item.hour}
            </GtkLabel>
            <GtkImage
                iconName={WEATHER_ICONS[item.weatherType]}
                iconSize={Gtk.IconSize.LARGE}
                valign={Gtk.Align.START}
            />
            <GtkLabel widthChars={4} vexpand valign={Gtk.Align.END}>
                {`${String(Math.round(item.temperature))}°`}
            </GtkLabel>
        </GtkBox>
    );
}

function ListViewWeatherDemo() {
    const weatherData = parseWeatherData();

    return (
        <GtkScrolledWindow name="scrolled" vexpand hexpand>
            <ListView
                name="list-view"
                estimatedItemWidth={56}
                estimatedItemHeight={80}
                orientation={Gtk.Orientation.HORIZONTAL}
                showSeparators
                selectionMode={Gtk.SelectionMode.NONE}
                renderItem={renderWeatherItem}
                items={weatherData.map((info) => ({ id: info.id, value: info }))}
            />
        </GtkScrolledWindow>
    );
}

export { listviewWeatherDemo };
