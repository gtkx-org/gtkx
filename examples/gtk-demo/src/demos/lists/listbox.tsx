import { Grid, Menu } from "@gtkx/components";
import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import * as Pango from "@gtkx/gi/pango";
import { GSimpleAction, GSimpleActionGroup } from "@gtkx/jsx/gio";
import {
    GtkBox,
    GtkButton,
    GtkImage,
    GtkLabel,
    GtkLinkButton,
    GtkListBox,
    GtkListBoxRow,
    GtkMenuButton,
    GtkRevealer,
    GtkScrolledWindow,
} from "@gtkx/jsx/gtk";
import { useRef, useState } from "react";
import { path as appleRedPath } from "#data/demos/css/apple-red.png";
import type { Demo } from "../types.js";
import sourceCode from "./listbox.tsx?raw";
import messagesRaw from "./messages.txt?raw";

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

function parseMessages(raw: string): Message[] {
    const lines = raw.split("\n").filter((line) => line.length > 0);
    return lines.map((line) => {
        const parts = line.split("|");
        return {
            id: Number.parseInt(parts[0] ?? "0", 10),
            senderName: parts[1] ?? "",
            senderNick: parts[2] ?? "",
            message: parts[3] ?? "",
            time: Number.parseInt(parts[4] ?? "0", 10),
            replyTo: Number.parseInt(parts[5] ?? "0", 10),
            resentBy: parts[6] && parts[6].length > 0 ? parts[6] : null,
            nFavorites: Number.parseInt(parts[7] ?? "0", 10),
            nReshares: Number.parseInt(parts[8] ?? "0", 10),
        };
    });
}

const ALL_MESSAGES = parseMessages(messagesRaw);

const appleRedTexture = Gdk.Texture.newFromResource(appleRedPath);

const boldAttrs = (() => {
    const attrs = Pango.AttrList.new();
    attrs.insert(Pango.attrWeightNew(Pango.Weight.BOLD));
    return attrs;
})();

function formatShortTime(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    const day = String(date.getUTCDate()).padStart(2, " ");
    const month = date.toLocaleString(undefined, { month: "short", timeZone: "UTC" });
    const year = String(date.getUTCFullYear()).slice(-2);
    return `${day} ${month} ${year}`;
}

function formatDetailedTime(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    const time = date.toLocaleTimeString(undefined, { timeZone: "UTC" });
    const day = String(date.getUTCDate()).padStart(2, " ");
    const month = date.toLocaleString(undefined, { month: "short", timeZone: "UTC" });
    const year = date.getUTCFullYear();
    return `${time} - ${day} ${month} ${year}`;
}

interface MessageRowProps {
    message: Message;
    expanded: boolean;
    onToggleExpand: (id: number) => void;
    onFavorite: (id: number) => void;
    onReshare: (id: number) => void;
}

const MessageAvatar = ({ message }: { message: Message }) => (
    <Grid.Child column={0} row={0} rowSpan={5}>
        {(ref) => (
            <GtkImage
                ref={ref}
                {...(message.senderNick === "GTKtoolkit"
                    ? { iconName: "org.gtk.Demo4" }
                    : { paintable: appleRedTexture })}
                iconSize={Gtk.IconSize.LARGE}
                widthRequest={32}
                heightRequest={32}
                halign={Gtk.Align.CENTER}
                valign={Gtk.Align.START}
                marginTop={8}
                marginBottom={8}
                marginStart={8}
                marginEnd={8}
            />
        )}
    </Grid.Child>
);

const MessageHeader = ({ message }: { message: Message }) => (
    <Grid.Child column={1} row={0}>
        {(ref) => (
            <GtkBox ref={ref} hexpand baselinePosition={Gtk.BaselinePosition.TOP}>
                <GtkButton receivesDefault hasFrame={false} valign={Gtk.Align.BASELINE}>
                    <GtkLabel label={message.senderName} valign={Gtk.Align.BASELINE} attributes={boldAttrs} />
                </GtkButton>
                <GtkLabel label={message.senderNick} valign={Gtk.Align.BASELINE} cssClasses={["dim-label"]} />
                <GtkLabel
                    label={formatShortTime(message.time)}
                    hexpand
                    xalign={1}
                    valign={Gtk.Align.BASELINE}
                    cssClasses={["dim-label"]}
                />
            </GtkBox>
        )}
    </Grid.Child>
);

const MessageBody = ({ message }: { message: Message }) => (
    <Grid.Child column={1} row={1}>
        {(ref) => (
            <GtkLabel
                ref={ref}
                label={message.message}
                halign={Gtk.Align.START}
                valign={Gtk.Align.START}
                xalign={0}
                yalign={0}
                wrap
            />
        )}
    </Grid.Child>
);

const MessageResentBy = ({ message }: { message: Message }) => (
    <Grid.Child column={1} row={2}>
        {(ref) => (
            <GtkBox ref={ref} visible={message.resentBy !== null}>
                <GtkImage iconName="media-playlist-repeat" />
                <GtkLabel label="Resent by" />
                <GtkLinkButton
                    label={message.resentBy ?? ""}
                    receivesDefault
                    hasFrame={false}
                    uri="https://www.gtk.org"
                />
            </GtkBox>
        )}
    </Grid.Child>
);

interface MessageActionsProps {
    message: Message;
    expanded: boolean;
    extraButtonsRef: React.RefObject<Gtk.Box | null>;
    onToggleExpand: (id: number) => void;
    onFavorite: (id: number) => void;
    onReshare: (id: number) => void;
}

const MessageActions = ({
    message,
    expanded,
    extraButtonsRef,
    onToggleExpand,
    onFavorite,
    onReshare,
}: MessageActionsProps) => (
    <Grid.Child column={1} row={3}>
        {(ref) => (
            <GtkBox ref={ref} spacing={6}>
                <GtkButton
                    name="expand-button"
                    label={expanded ? "Hide" : "Expand"}
                    receivesDefault
                    hasFrame={false}
                    onClicked={() => onToggleExpand(message.id)}
                />
                <GtkBox ref={extraButtonsRef} spacing={6} visible={false}>
                    <GtkButton label="Reply" receivesDefault hasFrame={false} />
                    <GtkButton
                        label="Reshare"
                        receivesDefault
                        hasFrame={false}
                        onClicked={() => onReshare(message.id)}
                    />
                    <GtkButton
                        label="Favorite"
                        receivesDefault
                        hasFrame={false}
                        onClicked={() => onFavorite(message.id)}
                    />
                    <GtkMenuButton
                        receivesDefault
                        hasFrame={false}
                        label="More..."
                        menuModel={
                            <Menu
                                items={[
                                    {
                                        section: [
                                            { label: "Email message", action: "msg.email" },
                                            { label: "Embed message", action: "msg.embed" },
                                        ],
                                    },
                                ]}
                            />
                        }
                        actionGroups={
                            <GSimpleActionGroup prefix="msg">
                                <GSimpleAction name="email" onActivate={() => {}} />
                                <GSimpleAction name="embed" onActivate={() => {}} />
                            </GSimpleActionGroup>
                        }
                    />
                </GtkBox>
            </GtkBox>
        )}
    </Grid.Child>
);

const MessageDetails = ({ message, expanded }: { message: Message; expanded: boolean }) => (
    <Grid.Child column={1} row={4}>
        {(ref) => (
            <GtkRevealer ref={ref} name="details-revealer" revealChild={expanded}>
                <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                    <GtkBox marginTop={2} marginBottom={2} spacing={8}>
                        <GtkLabel
                            visible={message.nReshares !== 0}
                            useMarkup
                            label={`<b>${message.nReshares}</b>\nReshares`}
                        />
                        <GtkLabel
                            visible={message.nFavorites !== 0}
                            useMarkup
                            label={`<b>${message.nFavorites}</b>\nFavorites`}
                        />
                    </GtkBox>
                    <GtkBox>
                        <GtkLabel label={formatDetailedTime(message.time)} cssClasses={["dim-label"]} />
                        <GtkButton label="Details" receivesDefault hasFrame={false} cssClasses={["dim-label"]} />
                    </GtkBox>
                </GtkBox>
            </GtkRevealer>
        )}
    </Grid.Child>
);

const MessageRow = ({ message, expanded, onToggleExpand, onFavorite, onReshare }: MessageRowProps) => {
    const extraButtonsRef = useRef<Gtk.Box>(null);

    const handleStateFlagsChanged = (_previousFlags: Gtk.StateFlags, row: Gtk.Widget) => {
        const flags = row.getStateFlags();
        const visible = (flags & Gtk.StateFlags.PRELIGHT) !== 0 || (flags & Gtk.StateFlags.SELECTED) !== 0;
        extraButtonsRef.current?.setVisible(visible);
    };

    return (
        <GtkListBoxRow onStateFlagsChanged={handleStateFlagsChanged}>
            <Grid hexpand>
                <MessageAvatar message={message} />
                <MessageHeader message={message} />
                <MessageBody message={message} />
                <MessageResentBy message={message} />
                <MessageActions
                    message={message}
                    expanded={expanded}
                    extraButtonsRef={extraButtonsRef}
                    onToggleExpand={onToggleExpand}
                    onFavorite={onFavorite}
                    onReshare={onReshare}
                />
                <MessageDetails message={message} expanded={expanded} />
            </Grid>
        </GtkListBoxRow>
    );
};

const ListBoxDemo = () => {
    const [messages, setMessages] = useState(ALL_MESSAGES);
    const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

    const sortedMessages = [...messages].sort((a, b) => b.time - a.time);

    const handleToggleExpand = (id: number) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleFavorite = (id: number) => {
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, nFavorites: m.nFavorites + 1 } : m)));
    };

    const handleReshare = (id: number) => {
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, nReshares: m.nReshares + 1 } : m)));
    };

    const handleRowActivated = (row: Gtk.ListBoxRow) => {
        const msg = sortedMessages[row.getIndex()];
        if (msg) handleToggleExpand(msg.id);
    };

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
            <GtkLabel label="Messages from GTK and friends" />
            <GtkScrolledWindow
                name="scrolled"
                hscrollbarPolicy={Gtk.PolicyType.NEVER}
                vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
                vexpand
            >
                <GtkListBox name="list-box" activateOnSingleClick={false} onRowActivated={handleRowActivated}>
                    {sortedMessages.map((message) => (
                        <MessageRow
                            key={message.id}
                            message={message}
                            expanded={expandedIds.has(message.id)}
                            onToggleExpand={handleToggleExpand}
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
    description:
        "GtkListBox allows lists with complicated layouts, using regular widgets supporting sorting and filtering.",
    keywords: [],
    component: ListBoxDemo,
    sourceCode,
    defaultWidth: 400,
    defaultHeight: 600,
    windowTitle: "List Box — Complex",
};
