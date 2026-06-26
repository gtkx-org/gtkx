import { ListView } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkImage, GtkLabel, GtkScrolledWindow } from "@gtkx/jsx/gtk";
import type { Demo } from "../types.js";
import rawWeatherData from "./listview_weather.txt?raw";
import sourceCode from "./listview-weather.tsx?raw";

type WeatherType = "clear" | "few-clouds" | "fog" | "overcast" | "showers-scattered" | "showers" | "snow" | "storm";

interface WeatherInfo {
    id: string;
    hour: string;
    temperature: number;
    weatherType: WeatherType;
}

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

const THIRTY_MINUTES_MS = 30 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

const parseWeatherType = (clouds: string, precip: string, fallback: WeatherType): WeatherType => {
    if (precip.includes("SN")) return "snow";
    if (precip.includes("TS")) return "storm";
    if (precip.includes("DZ")) return "showers-scattered";
    if (precip.includes("SH") || precip.includes("RA")) return "showers";
    if (precip.includes("FG")) return "fog";

    if (clouds === "M" || clouds === "") return fallback;

    if (clouds.includes("OVC")) return "overcast";
    if (clouds.includes("BKN")) return "few-clouds";
    if (clouds.includes("SCT")) return "few-clouds";
    if (clouds.includes("VV")) return "fog";

    return "clear";
};

const parseTimestamp = (dateStr: string): number => {
    const withSeconds = `${dateStr}:00`;
    return new Date(`${withSeconds.replace(" ", "T")}Z`).getTime();
};

const formatHour = (timestamp: number): string => {
    const date = new Date(timestamp);
    const hours = date.getUTCHours().toString().padStart(2, "0");
    const minutes = date.getUTCMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
};

const parseTemperature = (s: string, fallback: number): number => {
    const value = Number.parseFloat(s);
    if (Number.isNaN(value)) return fallback;
    return value;
};

const parseWeatherData = (): WeatherInfo[] => {
    const data: WeatherInfo[] = [];
    const lines = rawWeatherData.split("\n");

    let currentTimestamp = Date.UTC(2011, 0, 1, 0, 0, 0);
    let currentTemp = 0;
    let currentWeather: WeatherType = "clear";
    let idx = 0;

    data.push({
        id: `weather-${idx++}`,
        hour: formatHour(currentTimestamp),
        temperature: currentTemp,
        weatherType: currentWeather,
    });

    for (const line of lines) {
        if (line.trim() === "") continue;

        const fields = line.split(",");
        if (fields.length < 4) continue;

        const dateMs = parseTimestamp(fields[0] ?? "");

        while (dateMs - currentTimestamp > THIRTY_MINUTES_MS) {
            currentTimestamp += ONE_HOUR_MS;
            data.push({
                id: `weather-${idx++}`,
                hour: formatHour(currentTimestamp),
                temperature: currentTemp,
                weatherType: currentWeather,
            });
        }

        currentTemp = parseTemperature(fields[1] ?? "", currentTemp);
        currentWeather = parseWeatherType(fields[2] ?? "", fields[3] ?? "", currentWeather);

        const last = data.at(-1);
        if (last) {
            last.temperature = currentTemp;
            last.weatherType = currentWeather;
        }
    }

    return data;
};

const ListViewWeatherDemo = () => {
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
                renderItem={({ item }: { item: WeatherInfo }) => (
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} vexpand>
                        <GtkLabel label={item.hour} widthChars={5} valign={Gtk.Align.START} />
                        <GtkImage
                            iconName={WEATHER_ICONS[item.weatherType]}
                            iconSize={Gtk.IconSize.LARGE}
                            valign={Gtk.Align.START}
                        />
                        <GtkLabel
                            label={`${Math.round(item.temperature)}°`}
                            widthChars={4}
                            vexpand
                            valign={Gtk.Align.END}
                        />
                    </GtkBox>
                )}
                items={weatherData.map((info) => ({ id: info.id, value: info }))}
            />
        </GtkScrolledWindow>
    );
};

export const listviewWeatherDemo: Demo = {
    id: "listview-weather",
    title: "Lists/Weather",
    description:
        "This demo shows a few of the rarer features of GtkListView and how they can be used to display weather information.\n\nThe hourly weather info uses a horizontal listview. This is easy to achieve because GtkListView implements the GtkOrientable interface. To make the items in the list stand out more, the listview uses separators.\n\nA GtkNoSelectionModel is used to make sure no item in the list can be selected. All other interactions with the items is still possible.\n\nThe dataset used here has 70 000 items.",
    keywords: [],
    component: ListViewWeatherDemo,
    sourceCode,
    defaultWidth: 600,
    defaultHeight: 400,
};
