import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkFrame, GtkImage, GtkLabel, GtkScrolledWindow, x } from "@gtkx/react";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./listview-weather.tsx?raw";

interface WeatherDay {
    id: string;
    day: string;
    date: string;
    icon: string;
    condition: string;
    high: number;
    low: number;
    precipitation: number;
    humidity: number;
    wind: string;
}

const generateWeatherData = (): WeatherDay[] => {
    const conditions = [
        { icon: "weather-clear-symbolic", condition: "Sunny" },
        { icon: "weather-few-clouds-symbolic", condition: "Partly Cloudy" },
        { icon: "weather-overcast-symbolic", condition: "Cloudy" },
        { icon: "weather-showers-symbolic", condition: "Rain" },
        { icon: "weather-storm-symbolic", condition: "Thunderstorm" },
        { icon: "weather-snow-symbolic", condition: "Snow" },
        { icon: "weather-fog-symbolic", condition: "Foggy" },
    ];

    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const today = new Date();

    return Array.from({ length: 14 }, (_, i) => {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        const dayOfWeek = days[date.getDay()] ?? "Unknown";
        const monthDay = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

        const weatherIndex = Math.floor(Math.random() * conditions.length);
        const weather = conditions[weatherIndex] ??
            conditions[0] ?? { icon: "weather-clear-symbolic", condition: "Sunny" };
        const baseTemp = 15 + Math.random() * 20;

        return {
            id: `day-${i}`,
            day: i === 0 ? "Today" : i === 1 ? "Tomorrow" : dayOfWeek,
            date: monthDay,
            icon: weather.icon,
            condition: weather.condition,
            high: Math.round(baseTemp + 5 + Math.random() * 5),
            low: Math.round(baseTemp - 5 + Math.random() * 5),
            precipitation: Math.round(Math.random() * 100),
            humidity: Math.round(50 + Math.random() * 40),
            wind: `${Math.round(5 + Math.random() * 25)} km/h`,
        };
    });
};

const ListViewWeatherDemo = () => {
    const [weatherData, setWeatherData] = useState<WeatherDay[]>(generateWeatherData);
    const [selectedDay, setSelectedDay] = useState<WeatherDay | null>(null);
    const [unit, setUnit] = useState<"C" | "F">("C");

    const toFahrenheit = (celsius: number) => Math.round((celsius * 9) / 5 + 32);

    const formatTemp = (celsius: number) => {
        const temp = unit === "C" ? celsius : toFahrenheit(celsius);
        return `${temp}°${unit}`;
    };

    const refreshData = () => {
        setWeatherData(generateWeatherData());
        setSelectedDay(null);
    };

    const handleActivate = (_list: Gtk.ListView, position: number) => {
        setSelectedDay(weatherData[position] ?? null);
    };

    const currentWeather = weatherData[0];
    if (!currentWeather) return null;

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={24}
            marginStart={20}
            marginEnd={20}
            marginTop={20}
            marginBottom={20}
        >
            <GtkLabel label="Weather Forecast" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="ListView with rich content showing a 14-day weather forecast. Demonstrates custom item rendering with multiple data points per row."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="Current Weather">
                <GtkBox spacing={24} marginTop={16} marginBottom={16} marginStart={16} marginEnd={16}>
                    <GtkImage iconName={currentWeather.icon} pixelSize={64} />
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4} valign={Gtk.Align.CENTER} hexpand>
                        <GtkLabel label={currentWeather.condition} halign={Gtk.Align.START} cssClasses={["title-3"]} />
                        <GtkBox spacing={16}>
                            <GtkLabel label={`High: ${formatTemp(currentWeather.high)}`} cssClasses={["heading"]} />
                            <GtkLabel label={`Low: ${formatTemp(currentWeather.low)}`} cssClasses={["dim-label"]} />
                        </GtkBox>
                        <GtkLabel
                            label={`Humidity: ${currentWeather.humidity}% | Wind: ${currentWeather.wind}`}
                            cssClasses={["dim-label", "caption"]}
                            halign={Gtk.Align.START}
                        />
                    </GtkBox>
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8} valign={Gtk.Align.CENTER}>
                        <GtkButton
                            label={`${unit === "C" ? "°F" : "°C"}`}
                            onClicked={() => setUnit(unit === "C" ? "F" : "C")}
                            cssClasses={["flat"]}
                        />
                        <GtkButton
                            iconName="view-refresh-symbolic"
                            onClicked={refreshData}
                            cssClasses={["flat", "circular"]}
                            tooltipText="Refresh forecast"
                        />
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="14-Day Forecast">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkScrolledWindow heightRequest={350} hscrollbarPolicy={Gtk.PolicyType.NEVER}>
                        <x.ListView<WeatherDay>
                            estimatedItemHeight={64}
                            showSeparators
                            onActivate={handleActivate}
                            renderItem={(item) => (
                                <GtkBox spacing={12} marginTop={12} marginBottom={12} marginStart={12} marginEnd={12}>
                                    <GtkBox
                                        orientation={Gtk.Orientation.VERTICAL}
                                        spacing={4}
                                        widthRequest={80}
                                        valign={Gtk.Align.CENTER}
                                    >
                                        <GtkLabel
                                            label={item?.day ?? ""}
                                            halign={Gtk.Align.START}
                                            cssClasses={item?.id === "day-0" ? ["heading"] : []}
                                        />
                                        <GtkLabel
                                            label={item?.date ?? ""}
                                            cssClasses={["dim-label", "caption"]}
                                            halign={Gtk.Align.START}
                                        />
                                    </GtkBox>

                                    <GtkBox spacing={8} hexpand>
                                        <GtkImage iconName={item?.icon ?? ""} pixelSize={32} />
                                        <GtkLabel
                                            label={item?.condition ?? ""}
                                            valign={Gtk.Align.CENTER}
                                            widthRequest={100}
                                            halign={Gtk.Align.START}
                                        />
                                    </GtkBox>

                                    <GtkBox
                                        orientation={Gtk.Orientation.VERTICAL}
                                        spacing={4}
                                        widthRequest={60}
                                        valign={Gtk.Align.CENTER}
                                    >
                                        <GtkLabel label={`${item?.precipitation ?? 0}%`} cssClasses={["caption"]} />
                                        <GtkLabel label="Precip" cssClasses={["dim-label", "caption"]} />
                                    </GtkBox>

                                    <GtkBox spacing={8} valign={Gtk.Align.CENTER}>
                                        <GtkLabel
                                            label={formatTemp(item?.high ?? 0)}
                                            cssClasses={["heading"]}
                                            widthRequest={45}
                                        />
                                        <GtkLabel
                                            label={formatTemp(item?.low ?? 0)}
                                            cssClasses={["dim-label"]}
                                            widthRequest={45}
                                        />
                                    </GtkBox>
                                </GtkBox>
                            )}
                        >
                            {weatherData.map((day) => (
                                <x.ListItem key={day.id} id={day.id} value={day} />
                            ))}
                        </x.ListView>
                    </GtkScrolledWindow>

                    {selectedDay && (
                        <GtkBox
                            orientation={Gtk.Orientation.VERTICAL}
                            spacing={8}
                            cssClasses={["card"]}
                            marginTop={8}
                            marginBottom={8}
                            marginStart={12}
                            marginEnd={12}
                        >
                            <GtkBox spacing={16}>
                                <GtkImage iconName={selectedDay.icon} pixelSize={48} />
                                <GtkBox
                                    orientation={Gtk.Orientation.VERTICAL}
                                    spacing={4}
                                    hexpand
                                    valign={Gtk.Align.CENTER}
                                >
                                    <GtkLabel
                                        label={`${selectedDay.day}, ${selectedDay.date}`}
                                        halign={Gtk.Align.START}
                                        cssClasses={["heading"]}
                                    />
                                    <GtkLabel
                                        label={selectedDay.condition}
                                        cssClasses={["dim-label"]}
                                        halign={Gtk.Align.START}
                                    />
                                </GtkBox>
                            </GtkBox>
                            <GtkBox spacing={24} homogeneous>
                                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4} halign={Gtk.Align.CENTER}>
                                    <GtkLabel label={formatTemp(selectedDay.high)} cssClasses={["title-3"]} />
                                    <GtkLabel label="High" cssClasses={["dim-label", "caption"]} />
                                </GtkBox>
                                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4} halign={Gtk.Align.CENTER}>
                                    <GtkLabel label={formatTemp(selectedDay.low)} cssClasses={["title-3"]} />
                                    <GtkLabel label="Low" cssClasses={["dim-label", "caption"]} />
                                </GtkBox>
                                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4} halign={Gtk.Align.CENTER}>
                                    <GtkLabel label={`${selectedDay.precipitation}%`} cssClasses={["title-3"]} />
                                    <GtkLabel label="Precipitation" cssClasses={["dim-label", "caption"]} />
                                </GtkBox>
                                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4} halign={Gtk.Align.CENTER}>
                                    <GtkLabel label={`${selectedDay.humidity}%`} cssClasses={["title-3"]} />
                                    <GtkLabel label="Humidity" cssClasses={["dim-label", "caption"]} />
                                </GtkBox>
                                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4} halign={Gtk.Align.CENTER}>
                                    <GtkLabel label={selectedDay.wind} cssClasses={["title-3"]} />
                                    <GtkLabel label="Wind" cssClasses={["dim-label", "caption"]} />
                                </GtkBox>
                            </GtkBox>
                        </GtkBox>
                    )}
                </GtkBox>
            </GtkFrame>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Key Patterns" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="Use renderItem to create complex row layouts with multiple columns. Combine ListView with state management for interactive selection. The virtualized rendering handles long lists efficiently without performance issues."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
            </GtkBox>
        </GtkBox>
    );
};

export const listviewWeatherDemo: Demo = {
    id: "listview-weather",
    title: "Lists/Weather",
    description: "ListView showing a weather forecast with rich row content",
    keywords: ["listview", "weather", "forecast", "GtkListView", "data", "rows"],
    component: ListViewWeatherDemo,
    sourceCode,
};
