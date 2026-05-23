import * as Gdk from "@gtkx/ffi/gdk";
import * as Gtk from "@gtkx/ffi/gtk";
import * as Pango from "@gtkx/ffi/pango";
import {
    GtkBox,
    GtkButton,
    GtkGrid,
    GtkImage,
    GtkLabel,
    GtkLinkButton,
    GtkListBox,
    GtkListBoxRow,
    GtkMenuButton,
    GtkRevealer,
    GtkScrolledWindow,
} from "@gtkx/react";
import { useCallback, useMemo, useRef, useState } from "react";
import appleRedPath from "../css/apple-red.png";
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

let appleRedTexture: Gdk.Texture | undefined;
function getAppleRedTexture() {
    if (!appleRedTexture) {
        appleRedTexture = Gdk.Texture.newFromFilename(appleRedPath);
    }
    return appleRedTexture;
}

let boldAttrs: Pango.AttrList | undefined;
function getBoldAttrs() {
    if (!boldAttrs) {
        boldAttrs = Pango.AttrList.new();
        boldAttrs.insert(Pango.attrWeightNew(Pango.Weight.BOLD));
    }
    return boldAttrs;
}

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
    <GtkGrid.Child column={0} row={0} rowSpan={5}>
        <GtkImage
            {...(message.senderNick === "GTKtoolkit"
                ? { iconName: "org.gtk.Demo4" }
                : { paintable: getAppleRedTexture() })}
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
    </GtkGrid.Child>
);

const MessageHeader = ({ message }: { message: Message }) => (
    <GtkGrid.Child column={1} row={0}>
        <GtkBox hexpand baselinePosition={Gtk.BaselinePosition.TOP}>
            <GtkButton receivesDefault hasFrame={false} valign={Gtk.Align.BASELINE}>
                <GtkLabel label={message.senderName} valign={Gtk.Align.BASELINE} attributes={getBoldAttrs()} />
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
    </GtkGrid.Child>
);

const MessageBody = ({ message }: { message: Message }) => (
    <GtkGrid.Child column={1} row={1}>
        <GtkLabel
            label={message.message}
            halign={Gtk.Align.START}
            valign={Gtk.Align.START}
            xalign={0}
            yalign={0}
            wrap
        />
    </GtkGrid.Child>
);

const MessageResentBy = ({ message }: { message: Message }) => (
    <GtkGrid.Child column={1} row={2}>
        <GtkBox visible={message.resentBy !== null}>
            <GtkImage iconName="media-playlist-repeat" />
            <GtkLabel label="Resent by" />
            <GtkLinkButton label={message.resentBy ?? ""} receivesDefault hasFrame={false} uri="https://www.gtk.org" />
        </GtkBox>
    </GtkGrid.Child>
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
    <GtkGrid.Child column={1} row={3}>
        <GtkBox spacing={6}>
            <GtkButton
                name="expand-button"
                label={expanded ? "Hide" : "Expand"}
                receivesDefault
                hasFrame={false}
                onClicked={() => onToggleExpand(message.id)}
            />
            <GtkBox ref={extraButtonsRef} spacing={6} visible={false}>
                <GtkButton label="Reply" receivesDefault hasFrame={false} />
                <GtkButton label="Reshare" receivesDefault hasFrame={false} onClicked={() => onReshare(message.id)} />
                <GtkButton label="Favorite" receivesDefault hasFrame={false} onClicked={() => onFavorite(message.id)} />
                <GtkMenuButton receivesDefault hasFrame={false} label="More...">
                    <GtkMenuButton.MenuSection>
                        <GtkMenuButton.MenuItem id="email-msg" label="Email message" onActivate={() => {}} />
                        <GtkMenuButton.MenuItem id="embed-msg" label="Embed message" onActivate={() => {}} />
                    </GtkMenuButton.MenuSection>
                </GtkMenuButton>
            </GtkBox>
        </GtkBox>
    </GtkGrid.Child>
);

const MessageDetails = ({ message, expanded }: { message: Message; expanded: boolean }) => (
    <GtkGrid.Child column={1} row={4}>
        <GtkRevealer name="details-revealer" revealChild={expanded}>
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
    </GtkGrid.Child>
);

const MessageRow = ({ message, expanded, onToggleExpand, onFavorite, onReshare }: MessageRowProps) => {
    const extraButtonsRef = useRef<Gtk.Box>(null);
    const rowRef = useRef<Gtk.ListBoxRow>(null);

    const handleStateFlagsChanged = useCallback((_previousFlags: number) => {
        const row = rowRef.current;
        if (!row) return;
        const flags = row.getStateFlags();
        const visible = (flags & Gtk.StateFlags.PRELIGHT) !== 0 || (flags & Gtk.StateFlags.SELECTED) !== 0;
        extraButtonsRef.current?.setVisible(visible);
    }, []);

    return (
        <GtkListBoxRow ref={rowRef} onStateFlagsChanged={handleStateFlagsChanged}>
            <GtkGrid hexpand>
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
            </GtkGrid>
        </GtkListBoxRow>
    );
};

const ListBoxDemo = () => {
    const [messages, setMessages] = useState(ALL_MESSAGES);
    const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

    const sortedMessages = useMemo(() => [...messages].sort((a, b) => b.time - a.time), [messages]);

    const handleToggleExpand = useCallback((id: number) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const handleFavorite = useCallback((id: number) => {
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, nFavorites: m.nFavorites + 1 } : m)));
    }, []);

    const handleReshare = useCallback((id: number) => {
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, nReshares: m.nReshares + 1 } : m)));
    }, []);

    const handleRowActivated = useCallback(
        (row: Gtk.ListBoxRow) => {
            const msg = sortedMessages[row.getIndex()];
            if (msg) handleToggleExpand(msg.id);
        },
        [sortedMessages, handleToggleExpand],
    );

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
