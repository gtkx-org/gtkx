import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import * as Pango from "@gtkx/gi/pango";
import {
    GtkBox,
    GtkButton,
    GtkGrid,
    GtkGridLayoutChild,
    GtkImage,
    GtkLabel,
    GtkLinkButton,
    GtkListBox,
    GtkListBoxRow,
    GtkRevealer,
    GtkScrolledWindow,
} from "@gtkx/jsx/gtk";
import { useState } from "react";
import type { Demo } from "../types.js";
import appleRedPath from "../../../data/demos/css/apple-red.png?resource";
import sourceCode from "./listbox.tsx?raw";
import messagesRaw from "./messages.txt?raw";

type Message = {
    id: number;
    senderName: string;
    senderNick: string;
    message: string;
    time: number;
    resentBy: string | null;
    nFavorites: number;
    nReshares: number;
};

type MessageFields = [string, string, string, string, string, string, string, string, string];

type MessageRowProps = {
    message: Message;
    isExpanded: boolean;
    onToggleExpand: (id: number) => void;
    onFavorite: (id: number) => void;
    onReshare: (id: number) => void;
};

type MessageExtraButtonsProps = {
    message: Message;
    isVisible: boolean;
    onFavorite: (id: number) => void;
    onReshare: (id: number) => void;
};

type MessageActionsProps = MessageExtraButtonsProps & {
    isExpanded: boolean;
    onToggleExpand: (id: number) => void;
};

const ALL_MESSAGES = parseMessages(messagesRaw);
const appleRedTexture = Gdk.Texture.newFromResource(appleRedPath);

const boldAttrs = (() => {
    const attrs = Pango.AttrList.new();
    attrs.insert(Pango.attrWeightNew(Pango.Weight.BOLD));

    return attrs;
})();

const listboxDemo: Demo = {
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

function parseMessage(line: string): Message {
    const [id, senderName, senderNick, message, time, , resentBy, nFavorites, nReshares] =
        line.split("|") as MessageFields;

    return {
        id: Number(id),
        senderName,
        senderNick,
        message,
        time: Number(time),
        resentBy: resentBy.length > 0 ? resentBy : null,
        nFavorites: Number(nFavorites),
        nReshares: Number(nReshares),
    };
}

function parseMessages(raw: string): Message[] {
    return raw
        .split("\n")
        .filter((line) => line.length > 0)
        .map((line) => parseMessage(line));
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
    const year = String(date.getUTCFullYear());

    return `${time} - ${day} ${month} ${year}`;
}

function toggleExpandedId(ids: Set<number>, id: number): Set<number> {
    const next = new Set(ids);

    if (next.has(id)) {
        next.delete(id);
    } else {
        next.add(id);
    }

    return next;
}

function incrementFavorites(message: Message, id: number): Message {
    return message.id === id ? { ...message, nFavorites: message.nFavorites + 1 } : message;
}

function incrementReshares(message: Message, id: number): Message {
    return message.id === id ? { ...message, nReshares: message.nReshares + 1 } : message;
}

const MessageAvatar = ({ message }: { message: Message }) => (
    <GtkGridLayoutChild column={0} row={0} rowSpan={5}>
        <GtkImage
            {...(message.senderNick === "GTKtoolkit" ? { iconName: "org.gtk.Demo4" } : { paintable: appleRedTexture })}
            iconSize={Gtk.IconSize.LARGE}
            widthRequest={32}
            heightRequest={32}
            halign={Gtk.Align.CENTER}
            valign={Gtk.Align.START}
            accessibleRole={Gtk.AccessibleRole.PRESENTATION}
            marginTop={8}
            marginBottom={8}
            marginStart={8}
            marginEnd={8}
        />
    </GtkGridLayoutChild>
);

const MessageHeader = ({ message }: { message: Message }) => (
    <GtkGridLayoutChild column={1} row={0}>
        <GtkBox hexpand baselinePosition={Gtk.BaselinePosition.TOP}>
            <GtkLabel valign={Gtk.Align.BASELINE_FILL} attributes={boldAttrs}>
                {message.senderName}
            </GtkLabel>
            <GtkLabel valign={Gtk.Align.BASELINE_FILL} cssClasses={["dim-label"]}>
                {message.senderNick}
            </GtkLabel>
            <GtkLabel hexpand xalign={1} valign={Gtk.Align.BASELINE_FILL} cssClasses={["dim-label"]}>
                {formatShortTime(message.time)}
            </GtkLabel>
        </GtkBox>
    </GtkGridLayoutChild>
);

const MessageBody = ({ message }: { message: Message }) => (
    <GtkGridLayoutChild column={1} row={1}>
        <GtkLabel halign={Gtk.Align.START} valign={Gtk.Align.START} xalign={0} yalign={0} wrap>
            {message.message}
        </GtkLabel>
    </GtkGridLayoutChild>
);

function MessageResentBy({ message }: { message: Message }) {
    if (message.resentBy === null) {
        return null;
    }

    return (
        <GtkGridLayoutChild column={1} row={2}>
            <GtkBox>
                <GtkImage iconName="media-playlist-repeat" accessibleRole={Gtk.AccessibleRole.PRESENTATION} />
                <GtkLabel>Resent by</GtkLabel>
                <GtkLinkButton label={message.resentBy} receivesDefault hasFrame={false} uri="https://www.gtk.org" />
            </GtkBox>
        </GtkGridLayoutChild>
    );
}

const MessageExtraButtons = ({ message, isVisible, onFavorite, onReshare }: MessageExtraButtonsProps) => (
    <GtkBox spacing={6} visible={isVisible}>
        <GtkButton
            label="Reshare"
            receivesDefault
            hasFrame={false}
            onClicked={() => {
                onReshare(message.id);
            }}
        />
        <GtkButton
            label="Favorite"
            receivesDefault
            hasFrame={false}
            onClicked={() => {
                onFavorite(message.id);
            }}
        />
    </GtkBox>
);

const MessageActions = ({
    message,
    isExpanded,
    isVisible,
    onToggleExpand,
    onFavorite,
    onReshare,
}: MessageActionsProps) => (
    <GtkGridLayoutChild column={1} row={3}>
        <GtkBox spacing={6}>
            <GtkButton
                name="expand-button"
                label={isExpanded ? "Hide" : "Expand"}
                receivesDefault
                hasFrame={false}
                onClicked={() => {
                    onToggleExpand(message.id);
                }}
            />
            <MessageExtraButtons
                message={message}
                isVisible={isVisible}
                onFavorite={onFavorite}
                onReshare={onReshare}
            />
        </GtkBox>
    </GtkGridLayoutChild>
);

const MessageDetails = ({ message, isExpanded }: { message: Message; isExpanded: boolean }) => (
    <GtkGridLayoutChild column={1} row={4}>
        <GtkRevealer name="details-revealer" revealChild={isExpanded}>
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkBox marginTop={2} marginBottom={2} spacing={8}>
                    <GtkLabel visible={message.nReshares !== 0} useMarkup>
                        {`<b>${String(message.nReshares)}</b>\nReshares`}
                    </GtkLabel>
                    <GtkLabel visible={message.nFavorites !== 0} useMarkup>
                        {`<b>${String(message.nFavorites)}</b>\nFavorites`}
                    </GtkLabel>
                </GtkBox>
                <GtkBox>
                    <GtkLabel cssClasses={["dim-label"]}>{formatDetailedTime(message.time)}</GtkLabel>
                </GtkBox>
            </GtkBox>
        </GtkRevealer>
    </GtkGridLayoutChild>
);

const MessageRow = ({ message, isExpanded, onToggleExpand, onFavorite, onReshare }: MessageRowProps) => {
    const [areExtraButtonsVisible, setAreExtraButtonsVisible] = useState(false);

    const handleStateFlagsChanged = (_previousFlags: Gtk.StateFlags, row: Gtk.Widget) => {
        const flags = row.getStateFlags();
        setAreExtraButtonsVisible(
            (flags & Gtk.StateFlags.PRELIGHT) !== 0 || (flags & Gtk.StateFlags.SELECTED) !== 0,
        );
    };

    return (
        <GtkListBoxRow onStateFlagsChanged={handleStateFlagsChanged}>
            <GtkGrid hexpand>
                <MessageAvatar message={message} />
                <MessageHeader message={message} />
                <MessageBody message={message} />
                <MessageResentBy message={message} />
                <MessageActions
                    message={message}
                    isExpanded={isExpanded}
                    isVisible={areExtraButtonsVisible || isExpanded}
                    onToggleExpand={onToggleExpand}
                    onFavorite={onFavorite}
                    onReshare={onReshare}
                />
                <MessageDetails message={message} isExpanded={isExpanded} />
            </GtkGrid>
        </GtkListBoxRow>
    );
};

function ListBoxDemo() {
    const [messages, setMessages] = useState(ALL_MESSAGES);
    const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
    const sortedMessages = messages.toSorted((a, b) => b.time - a.time);

    const handleToggleExpand = (id: number) => {
        setExpandedIds((previous) => toggleExpandedId(previous, id));
    };

    const handleFavorite = (id: number) => {
        setMessages((previous) => previous.map((message) => incrementFavorites(message, id)));
    };

    const handleReshare = (id: number) => {
        setMessages((previous) => previous.map((message) => incrementReshares(message, id)));
    };

    const handleRowActivated = (row: Gtk.ListBoxRow) => {
        const message = sortedMessages[row.getIndex()];

        if (message) {
            handleToggleExpand(message.id);
        }
    };

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
            <GtkLabel>Messages from GTK and friends</GtkLabel>
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
                            isExpanded={expandedIds.has(message.id)}
                            onToggleExpand={handleToggleExpand}
                            onFavorite={handleFavorite}
                            onReshare={handleReshare}
                        />
                    ))}
                </GtkListBox>
            </GtkScrolledWindow>
        </GtkBox>
    );
}

export { listboxDemo };
