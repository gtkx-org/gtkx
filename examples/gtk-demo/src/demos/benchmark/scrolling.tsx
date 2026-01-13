import * as Gtk from "@gtkx/ffi/gtk";
import {
    GtkBox,
    GtkButton,
    GtkFrame,
    GtkGrid,
    GtkImage,
    GtkLabel,
    GtkScrolledWindow,
    GtkTextView,
    x,
} from "@gtkx/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./scrolling.tsx?raw";

type ContentType = "icons" | "text" | "grid";

interface ContentConfig {
    type: ContentType;
    label: string;
    description: string;
}

const contentTypes: ContentConfig[] = [
    { type: "icons", label: "Icons Grid", description: "A grid of symbolic icons" },
    { type: "text", label: "Plain Text", description: "Large block of plain text" },
    { type: "grid", label: "Color Grid", description: "Grid of colored boxes" },
];

const iconNames = [
    "document-open-symbolic",
    "document-save-symbolic",
    "edit-copy-symbolic",
    "edit-cut-symbolic",
    "edit-paste-symbolic",
    "edit-delete-symbolic",
    "edit-find-symbolic",
    "view-refresh-symbolic",
    "go-previous-symbolic",
    "go-next-symbolic",
    "list-add-symbolic",
    "list-remove-symbolic",
    "media-playback-start-symbolic",
    "media-playback-pause-symbolic",
    "media-playback-stop-symbolic",
    "folder-symbolic",
    "user-home-symbolic",
    "emblem-system-symbolic",
    "dialog-information-symbolic",
    "dialog-warning-symbolic",
];

const colors = [
    "#e01b24",
    "#ff7800",
    "#f5c211",
    "#33d17a",
    "#3584e4",
    "#9141ac",
    "#c64600",
    "#f66151",
    "#ffbe6f",
    "#8ff0a4",
    "#99c1f1",
    "#dc8add",
];

const loremIpsum =
    `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

Curabitur pretium tincidunt lacus. Nulla gravida orci a odio. Nullam varius, turpis et commodo pharetra, est eros bibendum elit, nec luctus magna felis sollicitudin mauris. Integer in mauris eu nibh euismod gravida. Duis ac tellus et risus vulputate vehicula. Donec lobortis risus a elit. Etiam tempor. Ut ullamcorper, ligula eu tempor congue, eros est euismod turpis, id tincidunt sapien risus a quam. Maecenas fermentum consequat mi. Donec fermentum. Pellentesque malesuada nulla a mi. Duis sapien sem, aliquet sed, vulputate eget, feugiat a, nunc.

Pellentesque dapibus suscipit ligula. Donec posuere augue in quam. Etiam vel tortor sodales tellus ultricies commodo. Suspendisse potenti. Aenean in sem ac leo mollis blandit. Donec neque quam, dignissim in, mollis nec, sagittis eu, wisi. Phasellus lacus. Etiam laoreet quam sed arcu. Phasellus at dui in ligula mollis ultricies. Integer placerat tristique nisl. Praesent augue. Fusce commodo. Vestibulum convallis, lorem a tempus semper, dui dui euismod elit, vitae placerat urna tortor vitae lacus.

`.repeat(20);

const IconsContent = () => {
    const items = useMemo(() => {
        const result = [];
        for (let row = 0; row < 50; row++) {
            for (let col = 0; col < 10; col++) {
                const iconName = iconNames[(row * 10 + col) % iconNames.length];
                result.push({ row, col, iconName });
            }
        }
        return result;
    }, []);

    return (
        <GtkGrid rowSpacing={8} columnSpacing={8} marginTop={12} marginBottom={12} marginStart={12} marginEnd={12}>
            {items.map((item) => (
                <x.GridChild key={`${item.row}-${item.col}`} row={item.row} column={item.col}>
                    <GtkImage iconName={item.iconName} iconSize={Gtk.IconSize.LARGE} />
                </x.GridChild>
            ))}
        </GtkGrid>
    );
};

const TextContent = () => {
    const buffer = useMemo(() => {
        const buf = new Gtk.TextBuffer();
        buf.setText(loremIpsum, -1);
        return buf;
    }, []);

    return <GtkTextView buffer={buffer} editable={false} cursorVisible={false} wrapMode={Gtk.WrapMode.WORD} />;
};

const ColorGridContent = () => {
    const items = useMemo(() => {
        const result = [];
        for (let row = 0; row < 100; row++) {
            for (let col = 0; col < 12; col++) {
                const color = colors[(row + col) % colors.length];
                result.push({ row, col, color });
            }
        }
        return result;
    }, []);

    return (
        <GtkGrid rowSpacing={4} columnSpacing={4} marginTop={12} marginBottom={12} marginStart={12} marginEnd={12}>
            {items.map((item) => (
                <x.GridChild key={`${item.row}-${item.col}`} row={item.row} column={item.col}>
                    <GtkLabel label="" widthRequest={24} heightRequest={24} cssClasses={["card"]} />
                </x.GridChild>
            ))}
        </GtkGrid>
    );
};

const ScrollingDemo = () => {
    const [contentIndex, setContentIndex] = useState(0);
    const [isScrolling, setIsScrolling] = useState(false);
    const [fps, setFps] = useState(0);
    const scrollSpeed = 5;
    const scrollWindowRef = useRef<Gtk.ScrolledWindow | null>(null);
    const frameCountRef = useRef(0);
    const lastTimeRef = useRef(Date.now());
    const scrollDirectionRef = useRef(1);

    useEffect(() => {
        if (!isScrolling || !scrollWindowRef.current) return;

        const interval = setInterval(() => {
            const scrollWindow = scrollWindowRef.current;
            if (!scrollWindow) return;

            const vadj = scrollWindow.getVadjustment();
            if (!vadj) return;

            const value = vadj.getValue();
            const lower = vadj.getLower();
            const upper = vadj.getUpper();
            const pageSize = vadj.getPageSize();

            if (value + scrollSpeed >= upper - pageSize) {
                scrollDirectionRef.current = -1;
            } else if (value + scrollSpeed <= lower) {
                scrollDirectionRef.current = 1;
            }

            vadj.setValue(value + scrollSpeed * scrollDirectionRef.current);

            frameCountRef.current++;
            const now = Date.now();
            const elapsed = now - lastTimeRef.current;
            if (elapsed >= 1000) {
                setFps(Math.round((frameCountRef.current * 1000) / elapsed));
                frameCountRef.current = 0;
                lastTimeRef.current = now;
            }
        }, 16);

        return () => clearInterval(interval);
    }, [isScrolling]);

    const currentContent = contentTypes[contentIndex];

    const handleNext = () => {
        setContentIndex((prev) => (prev + 1) % contentTypes.length);
        scrollDirectionRef.current = 1;
    };

    const handlePrev = () => {
        setContentIndex((prev) => (prev - 1 + contentTypes.length) % contentTypes.length);
        scrollDirectionRef.current = 1;
    };

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={24}>
            <GtkLabel label="Benchmark: Scrolling" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="This benchmark tests scrolling performance with different content types. The content automatically scrolls back and forth while measuring FPS."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="Controls">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkBox spacing={12}>
                        <GtkButton iconName="go-previous-symbolic" onClicked={handlePrev} />
                        <GtkLabel label={currentContent?.label ?? ""} hexpand halign={Gtk.Align.CENTER} />
                        <GtkButton iconName="go-next-symbolic" onClicked={handleNext} />
                    </GtkBox>

                    <GtkLabel label={currentContent?.description ?? ""} cssClasses={["dim-label"]} />

                    <GtkBox spacing={12}>
                        <GtkButton
                            label={isScrolling ? "Stop" : "Start Scrolling"}
                            onClicked={() => setIsScrolling(!isScrolling)}
                            cssClasses={[isScrolling ? "destructive-action" : "suggested-action"]}
                        />
                        <GtkLabel label={`FPS: ${fps}`} cssClasses={["monospace"]} valign={Gtk.Align.CENTER} />
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Scroll Content">
                <GtkScrolledWindow
                    ref={scrollWindowRef}
                    heightRequest={300}
                    hscrollbarPolicy={Gtk.PolicyType.NEVER}
                    vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
                >
                    {currentContent?.type === "icons" && <IconsContent />}
                    {currentContent?.type === "text" && <TextContent />}
                    {currentContent?.type === "grid" && <ColorGridContent />}
                </GtkScrolledWindow>
            </GtkFrame>

            <GtkFrame label="About This Benchmark">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={8}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="This benchmark measures how efficiently GTK can scroll different types of content. Higher FPS indicates better scrolling performance."
                        wrap
                        halign={Gtk.Align.START}
                    />
                    <GtkLabel
                        label="The benchmark tests: icon grids (many small images), plain text (text rendering), and color grids (many simple widgets)."
                        wrap
                        halign={Gtk.Align.START}
                        marginTop={8}
                        cssClasses={["dim-label"]}
                    />
                </GtkBox>
            </GtkFrame>
        </GtkBox>
    );
};

export const scrollingDemo: Demo = {
    id: "scrolling",
    title: "Benchmark/Scrolling",
    description: "Stress test scrolling performance with various content types",
    keywords: ["benchmark", "scrolling", "performance", "fps", "stress test", "GtkScrolledWindow"],
    component: ScrollingDemo,
    sourceCode,
};
