import { css } from "@gtkx/css";
import * as Gtk from "@gtkx/ffi/gtk";
import {
    GtkBox,
    GtkButton,
    GtkImage,
    GtkLabel,
    GtkLinkButton,
    GtkListBox,
    GtkListBoxRow,
    GtkRevealer,
    GtkScrolledWindow,
} from "@gtkx/react";
import { useCallback, useMemo, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./listbox.tsx?raw";

interface Message {
    id: number;
    senderName: string;
    senderNick: string;
    message: string;
    time: number;
    replyTo: number;
    resentBy: string | null;
    nFavorites: number;
    nReshares: number;
}

const MESSAGES: Message[] = [
    {
        id: 1,
        senderName: "GTK and friends",
        senderNick: "@GTKtoolkit",
        message: "New features of GtkInspector available in the latest release!",
        time: Date.now() / 1000 - 3600 * 2,
        replyTo: 0,
        resentBy: null,
        nFavorites: 2,
        nReshares: 3,
    },
    {
        id: 2,
        senderName: "Emmanuele Bassi",
        senderNick: "@ebassi",
        message: "OpenGL integration lands in GTK — great progress on the rendering front.",
        time: Date.now() / 1000 - 3600 * 24,
        replyTo: 0,
        resentBy: "GTKtoolkit",
        nFavorites: 0,
        nReshares: 9,
    },
    {
        id: 3,
        senderName: "Matthew Waters",
        senderNick: "@ystreet00",
        message: "GTK + GStreamer integration using the new OpenGL support is looking great!",
        time: Date.now() / 1000 - 3600 * 48,
        replyTo: 0,
        resentBy: "GTKtoolkit",
        nFavorites: 0,
        nReshares: 13,
    },
    {
        id: 4,
        senderName: "Allan Day",
        senderNick: "@allanday",
        message: "New Human Interface Guidelines coming for GNOME and GTK.",
        time: Date.now() / 1000 - 3600 * 72,
        replyTo: 0,
        resentBy: "GTKtoolkit",
        nFavorites: 0,
        nReshares: 12,
    },
    {
        id: 5,
        senderName: "GTK and friends",
        senderNick: "@GTKtoolkit",
        message: "GTK 4 released! Major improvements in rendering, input handling, and accessibility.",
        time: Date.now() / 1000 - 3600 * 96,
        replyTo: 0,
        resentBy: null,
        nFavorites: 5,
        nReshares: 8,
    },
];

const extraButtonsStyle = css`
    opacity: 0;
    transition: opacity 200ms ease;
`;

const extraButtonsVisibleStyle = css`
    opacity: 1;
`;

function formatShortTime(timestamp: number): string {
    const now = Date.now() / 1000;
    const diff = now - timestamp;
    if (diff < 60) return `${Math.floor(diff)}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
}

function formatDetailedTime(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
}

interface MessageRowProps {
    message: Message;
    onFavorite: (id: number) => void;
    onReshare: (id: number) => void;
}

const MessageRow = ({ message, onFavorite, onReshare }: MessageRowProps) => {
    const [expanded, setExpanded] = useState(false);
    const [hovered, setHovered] = useState(false);

    const handleExpand = useCallback(() => {
        setExpanded((prev) => !prev);
    }, []);

    const isGtk = message.senderNick === "@GTKtoolkit";

    return (
        <GtkListBoxRow
            onStateFlagsChanged={(_, flags) => {
                const isHovered = (flags & Gtk.StateFlags.PRELIGHT) !== 0 || (flags & Gtk.StateFlags.SELECTED) !== 0;
                setHovered(isHovered);
            }}
        >
            <GtkBox orientation={Gtk.Orientation.VERTICAL} marginTop={8} marginBottom={8}>
                <GtkBox>
                    <GtkImage
                        iconName={isGtk ? "org.gtk.Demo4" : "avatar-default-symbolic"}
                        pixelSize={32}
                        marginTop={8}
                        marginBottom={8}
                        marginStart={8}
                        marginEnd={8}
                        halign={Gtk.Align.CENTER}
                        valign={Gtk.Align.START}
                    />
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} hexpand>
                        <GtkBox hexpand>
                            <GtkButton hasFrame={false} valign={Gtk.Align.BASELINE}>
                                <GtkLabel label={message.senderName} valign={Gtk.Align.BASELINE} useMarkup>
                                    <GtkLabel label={message.senderName} cssClasses={["heading"]} />
                                </GtkLabel>
                            </GtkButton>
                            <GtkLabel
                                label={message.senderNick}
                                valign={Gtk.Align.BASELINE}
                                cssClasses={["dim-label"]}
                            />
                            <GtkLabel
                                label={formatShortTime(message.time)}
                                hexpand
                                xalign={1}
                                valign={Gtk.Align.BASELINE}
                                cssClasses={["dim-label"]}
                            />
                        </GtkBox>

                        <GtkLabel label={message.message} wrap halign={Gtk.Align.START} xalign={0} yalign={0} />

                        {message.resentBy && (
                            <GtkBox spacing={4}>
                                <GtkImage iconName="media-playlist-repeat-symbolic" />
                                <GtkLabel label="Resent by" />
                                <GtkLinkButton
                                    label={message.resentBy}
                                    uri="https://www.gtk.org"
                                    hasFrame={false}
                                />
                            </GtkBox>
                        )}

                        <GtkBox spacing={6}>
                            <GtkButton label={expanded ? "Hide" : "Expand"} hasFrame={false} onClicked={handleExpand} />
                            <GtkBox
                                spacing={6}
                                cssClasses={[extraButtonsStyle, hovered ? extraButtonsVisibleStyle : ""]}
                            >
                                <GtkButton label="Reply" hasFrame={false} />
                                <GtkButton label="Reshare" hasFrame={false} onClicked={() => onReshare(message.id)} />
                                <GtkButton label="Favorite" hasFrame={false} onClicked={() => onFavorite(message.id)} />
                                <GtkButton label="More..." hasFrame={false} />
                            </GtkBox>
                        </GtkBox>

                        <GtkRevealer revealChild={expanded}>
                            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                                <GtkBox spacing={8} marginTop={2} marginBottom={2}>
                                    {message.nReshares > 0 && (
                                        <GtkLabel useMarkup label={`<b>${message.nReshares}</b>\nReshares`} />
                                    )}
                                    {message.nFavorites > 0 && (
                                        <GtkLabel useMarkup label={`<b>${message.nFavorites}</b>\nFavorites`} />
                                    )}
                                </GtkBox>
                                <GtkBox>
                                    <GtkLabel
                                        label={formatDetailedTime(message.time)}
                                        cssClasses={["dim-label"]}
                                    />
                                    <GtkButton label="Details" hasFrame={false} cssClasses={["dim-label"]} />
                                </GtkBox>
                            </GtkBox>
                        </GtkRevealer>
                    </GtkBox>
                </GtkBox>
            </GtkBox>
        </GtkListBoxRow>
    );
};

const ListBoxDemo = () => {
    const [messages, setMessages] = useState(MESSAGES);

    const sortedMessages = useMemo(() => {
        return [...messages].sort((a, b) => b.time - a.time);
    }, [messages]);

    const handleFavorite = useCallback((id: number) => {
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, nFavorites: m.nFavorites + 1 } : m)));
    }, []);

    const handleReshare = useCallback((id: number) => {
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, nReshares: m.nReshares + 1 } : m)));
    }, []);

    const handleRowActivated = useCallback((_listBox: Gtk.ListBox, _row: Gtk.ListBoxRow) => {
    }, []);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
            <GtkLabel label="Messages from GTK and friends" />
            <GtkScrolledWindow
                hscrollbarPolicy={Gtk.PolicyType.NEVER}
                vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
                vexpand
            >
                <GtkListBox activateOnSingleClick={false} onRowActivated={handleRowActivated}>
                    {sortedMessages.map((message) => (
                        <MessageRow
                            key={message.id}
                            message={message}
                            onFavorite={handleFavorite}
                            onReshare={handleReshare}
                        />
                    ))}
                </GtkListBox>
            </GtkScrolledWindow>
        </GtkBox>
    );
};

export const listboxDemo: Demo = {
    id: "listbox",
    title: "List Box/Complex",
    description: "GtkListBox allows lists with complicated layouts, using regular widgets supporting sorting and filtering.",
    keywords: ["listbox", "list", "rows", "selection", "GtkListBox", "GtkListBoxRow", "messages", "social"],
    component: ListBoxDemo,
    sourceCode,
};
