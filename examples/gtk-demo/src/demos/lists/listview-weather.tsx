import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkImage, GtkLabel, GtkListView, GtkScrolledWindow, x } from "@gtkx/react";
import { useMemo } from "react";
import type { Demo } from "../types.js";
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

const WEATHER_TYPES: WeatherType[] = [
    "clear",
    "few-clouds",
    "fog",
    "overcast",
    "showers-scattered",
    "showers",
    "snow",
    "storm",
];

const generateWeatherData = (count: number): WeatherInfo[] => {
    const data: WeatherInfo[] = [];
    const startDate = new Date(2011, 0, 1, 0, 0, 0);

    let currentTemp = 5;
    let currentWeather: WeatherType = "clear";

    for (let i = 0; i < count; i++) {
        const date = new Date(startDate.getTime() + i * 60 * 60 * 1000);
        const hour = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });

        currentTemp += (Math.random() - 0.5) * 2;
        currentTemp = Math.max(-10, Math.min(35, currentTemp));

        if (Math.random() < 0.05) {
            currentWeather = WEATHER_TYPES[Math.floor(Math.random() * WEATHER_TYPES.length)] ?? "clear";
        }

        data.push({
            id: `weather-${i}`,
            hour,
            temperature: Math.round(currentTemp),
            weatherType: currentWeather,
        });
    }

    return data;
};

const ListViewWeatherDemo = () => {
    const weatherData = useMemo(() => generateWeatherData(70000), []);

    return (
        <GtkScrolledWindow vexpand hexpand>
            <GtkListView
                estimatedItemHeight={80}
                orientation={Gtk.Orientation.HORIZONTAL}
                showSeparators
                selectionMode={Gtk.SelectionMode.NONE}
                renderItem={(_item) => {
                    const item = _item as WeatherInfo | null;
                    return (
                        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                            <GtkLabel label={item?.hour ?? ""} widthChars={5} />
                            <GtkImage
                                iconName={item ? WEATHER_ICONS[item.weatherType] : "weather-clear-symbolic"}
                                iconSize={Gtk.IconSize.LARGE}
                            />
                            <GtkLabel
                                label={`${item?.temperature ?? 0}°`}
                                widthChars={4}
                                vexpand
                                valign={Gtk.Align.END}
                            />
                        </GtkBox>
                    );
                }}
            >
                {weatherData.map((info) => (
                    <x.ListItem key={info.id} id={info.id} value={info} />
                ))}
            </GtkListView>
        </GtkScrolledWindow>
    );
};

export const listviewWeatherDemo: Demo = {
    id: "listview-weather",
    title: "Lists/Weather",
    description:
        "This demo shows a few of the rarer features of GtkListView - horizontal orientation and separators. The dataset has 70,000 hourly weather items.",
    keywords: ["listview", "weather", "horizontal", "GtkListView", "separators", "70000"],
    component: ListViewWeatherDemo,
    sourceCode,
};
