import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkFrame, GtkLabel, GtkScrolledWindow, x } from "@gtkx/react";
import { useEffect, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./listview-clocks.tsx?raw";

interface ClockItem {
    id: string;
    city: string;
    timezone: string;
    offset: number; // Hours offset from UTC
    country: string;
}

const worldClocks: ClockItem[] = [
    { id: "london", city: "London", timezone: "Europe/London", offset: 0, country: "United Kingdom" },
    { id: "paris", city: "Paris", timezone: "Europe/Paris", offset: 1, country: "France" },
    { id: "berlin", city: "Berlin", timezone: "Europe/Berlin", offset: 1, country: "Germany" },
    { id: "moscow", city: "Moscow", timezone: "Europe/Moscow", offset: 3, country: "Russia" },
    { id: "dubai", city: "Dubai", timezone: "Asia/Dubai", offset: 4, country: "UAE" },
    { id: "mumbai", city: "Mumbai", timezone: "Asia/Kolkata", offset: 5.5, country: "India" },
    { id: "bangkok", city: "Bangkok", timezone: "Asia/Bangkok", offset: 7, country: "Thailand" },
    { id: "singapore", city: "Singapore", timezone: "Asia/Singapore", offset: 8, country: "Singapore" },
    { id: "tokyo", city: "Tokyo", timezone: "Asia/Tokyo", offset: 9, country: "Japan" },
    { id: "sydney", city: "Sydney", timezone: "Australia/Sydney", offset: 11, country: "Australia" },
    { id: "auckland", city: "Auckland", timezone: "Pacific/Auckland", offset: 13, country: "New Zealand" },
    { id: "newyork", city: "New York", timezone: "America/New_York", offset: -5, country: "USA" },
    { id: "chicago", city: "Chicago", timezone: "America/Chicago", offset: -6, country: "USA" },
    { id: "denver", city: "Denver", timezone: "America/Denver", offset: -7, country: "USA" },
    { id: "losangeles", city: "Los Angeles", timezone: "America/Los_Angeles", offset: -8, country: "USA" },
    { id: "saopaulo", city: "Sao Paulo", timezone: "America/Sao_Paulo", offset: -3, country: "Brazil" },
];

const formatDate = (date: Date, offset: number): string => {
    const utc = date.getTime() + date.getTimezoneOffset() * 60000;
    const localTime = new Date(utc + offset * 3600000);
    return localTime.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
    });
};

const formatOffset = (offset: number): string => {
    const sign = offset >= 0 ? "+" : "";
    const hours = Math.floor(Math.abs(offset));
    const minutes = (Math.abs(offset) % 1) * 60;
    if (minutes === 0) {
        return `UTC${sign}${offset}`;
    }
    return `UTC${sign}${hours}:${minutes.toString().padStart(2, "0")}`;
};

const ListViewClocksDemo = () => {
    const [currentTime, setCurrentTime] = useState(new Date());
    const [is24Hour, setIs24Hour] = useState(false);
    const [selectedClock, setSelectedClock] = useState<ClockItem | null>(null);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const formatTimeDisplay = (date: Date, offset: number): string => {
        const utc = date.getTime() + date.getTimezoneOffset() * 60000;
        const localTime = new Date(utc + offset * 3600000);
        return localTime.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: !is24Hour,
        });
    };

    const handleActivate = (_list: Gtk.ListView, position: number) => {
        const clock = worldClocks[position];
        if (clock) {
            setSelectedClock(clock);
        }
    };

    const isDaytime = (offset: number): boolean => {
        const utc = currentTime.getTime() + currentTime.getTimezoneOffset() * 60000;
        const localTime = new Date(utc + offset * 3600000);
        const hour = localTime.getHours();
        return hour >= 6 && hour < 18;
    };

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={24}
            marginStart={20}
            marginEnd={20}
            marginTop={20}
            marginBottom={20}
        >
            <GtkLabel label="World Clocks" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="ListView with real-time updates using useEffect interval. Demonstrates dynamic data that updates every second to show world clocks across different time zones."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="Current Time">
                <GtkBox
                    spacing={24}
                    marginTop={16}
                    marginBottom={16}
                    marginStart={16}
                    marginEnd={16}
                    halign={Gtk.Align.CENTER}
                >
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4} halign={Gtk.Align.CENTER}>
                        <GtkLabel label="UTC" cssClasses={["dim-label"]} />
                        <GtkLabel label={formatTimeDisplay(currentTime, 0)} cssClasses={["title-1", "monospace"]} />
                        <GtkLabel label={formatDate(currentTime, 0)} cssClasses={["dim-label", "caption"]} />
                    </GtkBox>
                    <GtkButton
                        label={is24Hour ? "12-hour" : "24-hour"}
                        onClicked={() => setIs24Hour(!is24Hour)}
                        cssClasses={["flat"]}
                        valign={Gtk.Align.CENTER}
                    />
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="World Clocks">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkScrolledWindow heightRequest={350} hscrollbarPolicy={Gtk.PolicyType.NEVER}>
                        <x.ListView<ClockItem>
                            estimatedItemHeight={64}
                            showSeparators
                            onActivate={handleActivate}
                            renderItem={(item) => (
                                <GtkBox spacing={16} marginTop={12} marginBottom={12} marginStart={12} marginEnd={12}>
                                    <GtkLabel
                                        label={isDaytime(item?.offset ?? 0) ? "sun" : "moon"}
                                        cssClasses={["dim-label"]}
                                        widthRequest={32}
                                    />

                                    <GtkBox
                                        orientation={Gtk.Orientation.VERTICAL}
                                        spacing={2}
                                        hexpand
                                        valign={Gtk.Align.CENTER}
                                    >
                                        <GtkLabel
                                            label={item?.city ?? ""}
                                            halign={Gtk.Align.START}
                                            cssClasses={["heading"]}
                                        />
                                        <GtkBox spacing={8}>
                                            <GtkLabel
                                                label={item?.country ?? ""}
                                                cssClasses={["dim-label", "caption"]}
                                            />
                                            <GtkLabel
                                                label={formatOffset(item?.offset ?? 0)}
                                                cssClasses={["dim-label", "caption", "monospace"]}
                                            />
                                        </GtkBox>
                                    </GtkBox>

                                    <GtkBox
                                        orientation={Gtk.Orientation.VERTICAL}
                                        spacing={2}
                                        valign={Gtk.Align.CENTER}
                                    >
                                        <GtkLabel
                                            label={formatTimeDisplay(currentTime, item?.offset ?? 0)}
                                            cssClasses={["title-3", "monospace"]}
                                            halign={Gtk.Align.END}
                                        />
                                        <GtkLabel
                                            label={formatDate(currentTime, item?.offset ?? 0)}
                                            cssClasses={["dim-label", "caption"]}
                                            halign={Gtk.Align.END}
                                        />
                                    </GtkBox>
                                </GtkBox>
                            )}
                        >
                            {worldClocks.map((clock) => (
                                <x.ListItem key={clock.id} id={clock.id} value={clock} />
                            ))}
                        </x.ListView>
                    </GtkScrolledWindow>

                    {selectedClock && (
                        <GtkBox
                            orientation={Gtk.Orientation.VERTICAL}
                            spacing={12}
                            cssClasses={["card"]}
                            marginTop={8}
                            marginBottom={8}
                            marginStart={12}
                            marginEnd={12}
                        >
                            <GtkBox spacing={16}>
                                <GtkBox
                                    orientation={Gtk.Orientation.VERTICAL}
                                    spacing={4}
                                    hexpand
                                    valign={Gtk.Align.CENTER}
                                >
                                    <GtkLabel
                                        label={selectedClock.city}
                                        halign={Gtk.Align.START}
                                        cssClasses={["title-2"]}
                                    />
                                    <GtkLabel
                                        label={`${selectedClock.country} (${selectedClock.timezone})`}
                                        cssClasses={["dim-label"]}
                                        halign={Gtk.Align.START}
                                    />
                                </GtkBox>
                                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4} valign={Gtk.Align.CENTER}>
                                    <GtkLabel
                                        label={formatTimeDisplay(currentTime, selectedClock.offset)}
                                        cssClasses={["title-1", "monospace"]}
                                    />
                                    <GtkLabel
                                        label={formatOffset(selectedClock.offset)}
                                        cssClasses={["dim-label", "caption", "monospace"]}
                                    />
                                </GtkBox>
                            </GtkBox>
                            <GtkBox spacing={16} homogeneous>
                                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4} halign={Gtk.Align.CENTER}>
                                    <GtkLabel
                                        label={formatDate(currentTime, selectedClock.offset)}
                                        cssClasses={["heading"]}
                                    />
                                    <GtkLabel label="Date" cssClasses={["dim-label", "caption"]} />
                                </GtkBox>
                                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4} halign={Gtk.Align.CENTER}>
                                    <GtkLabel
                                        label={isDaytime(selectedClock.offset) ? "Daytime" : "Nighttime"}
                                        cssClasses={["heading"]}
                                    />
                                    <GtkLabel label="Period" cssClasses={["dim-label", "caption"]} />
                                </GtkBox>
                            </GtkBox>
                        </GtkBox>
                    )}
                </GtkBox>
            </GtkFrame>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Implementation Notes" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="Uses useEffect with setInterval for real-time updates. The interval is cleaned up on unmount. Each list item receives the current time as a dependency, causing all items to re-render every second for synchronized updates."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
            </GtkBox>
        </GtkBox>
    );
};

export const listviewClocksDemo: Demo = {
    id: "listview-clocks",
    title: "Lists/Clocks",
    description: "ListView with real-time timezone clock updates",
    keywords: ["listview", "clocks", "timezone", "GtkListView", "useEffect", "interval", "realtime"],
    component: ListViewClocksDemo,
    sourceCode,
};
