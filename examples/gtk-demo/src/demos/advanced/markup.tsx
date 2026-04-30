import * as Gtk from "@gtkx/ffi/gtk";
import { GtkCheckButton, GtkHeaderBar, GtkScrolledWindow, GtkStack, GtkTextView } from "@gtkx/react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./markup.tsx?raw";
import markupContent from "./markup.txt?raw";

const Slot = "Slot" as const;
const SAMPLE_MARKUP = markupContent;

const MarkupDemo = () => {
    const formattedViewRef = useRef<Gtk.TextView | null>(null);
    const sourceViewRef = useRef<Gtk.TextView | null>(null);
    const [showSource, setShowSource] = useState(false);
    const markupRef = useRef(SAMPLE_MARKUP);

    const applyMarkup = useCallback(() => {
        const formattedView = formattedViewRef.current;
        if (!formattedView) return;

        const buffer = formattedView.getBuffer();
        if (!buffer) return;

        buffer.beginIrreversibleAction();

        const startIter = buffer.getStartIter();
        const endIter = buffer.getEndIter();
        buffer.delete(startIter, endIter);

        const insertIter = buffer.getStartIter();
        buffer.insertMarkup(insertIter, markupRef.current, -1);

        buffer.endIrreversibleAction();
    }, []);

    useLayoutEffect(() => {
        const sourceView = sourceViewRef.current;
        if (sourceView) {
            const buffer = sourceView.getBuffer();
            if (buffer) {
                buffer.setText(SAMPLE_MARKUP, -1);
            }
        }

        applyMarkup();
    }, [applyMarkup]);

    const handleSourceToggle = useCallback(
        (active: boolean) => {
            if (!active && showSource) {
                const sourceView = sourceViewRef.current;
                if (sourceView) {
                    const buffer = sourceView.getBuffer();
                    if (buffer) {
                        const startIter = buffer.getStartIter();
                        const endIter = buffer.getEndIter();
                        markupRef.current = buffer.getText(startIter, endIter, false);
                    }
                }
                applyMarkup();
            }
            setShowSource(active);
        },
        [showSource, applyMarkup],
    );

    return (
        <>
            <Slot id="titlebar">
                <GtkHeaderBar>
                    <GtkHeaderBar.PackStart>
                        <GtkCheckButton
                            label="Source"
                            active={showSource}
                            valign={Gtk.Align.CENTER}
                            onToggled={(btn) => handleSourceToggle(btn.getActive())}
                        />
                    </GtkHeaderBar.PackStart>
                </GtkHeaderBar>
            </Slot>
            <GtkStack
                page={showSource ? "source" : "formatted"}
                vexpand
                hexpand
                transitionType={Gtk.StackTransitionType.NONE}
            >
                <GtkStack.Page id="formatted" title="Formatted">
                    <GtkScrolledWindow
                        vexpand
                        hexpand
                        hscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
                        vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
                    >
                        <GtkTextView
                            ref={formattedViewRef}
                            editable={false}
                            wrapMode={Gtk.WrapMode.WORD_CHAR}
                            leftMargin={10}
                            rightMargin={10}
                        />
                    </GtkScrolledWindow>
                </GtkStack.Page>
                <GtkStack.Page id="source" title="Source">
                    <GtkScrolledWindow
                        vexpand
                        hexpand
                        hscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
                        vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
                    >
                        <GtkTextView
                            ref={sourceViewRef}
                            wrapMode={Gtk.WrapMode.WORD}
                            leftMargin={10}
                            rightMargin={10}
                        />
                    </GtkScrolledWindow>
                </GtkStack.Page>
            </GtkStack>
        </>
    );
};

export const markupDemo: Demo = {
    id: "markup",
    title: "Text View/Markup",
    description: "Rich text formatting with Pango markup",
    keywords: ["pango", "markup", "text", "formatting", "rich text", "html", "label", "styled"],
    component: MarkupDemo,
    sourceCode,
    defaultWidth: 600,
    defaultHeight: 680,
};
