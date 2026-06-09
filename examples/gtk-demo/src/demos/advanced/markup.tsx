import * as Gtk from "@gtkx/gi/gtk";
import { GtkCheckButton, GtkHeaderBar, GtkScrolledWindow, GtkStack, GtkStackPage, GtkTextView } from "@gtkx/jsx/gtk";
import { createContext, useContext, useRef, useState } from "react";
import type { Demo, DemoProviderProps } from "../types.js";
import sourceCode from "./markup.tsx?raw";
import markupContent from "./markup.txt?raw";

const SAMPLE_MARKUP = markupContent;

const applyMarkupToView = (formattedView: Gtk.TextView | null, markup: string) => {
    if (!formattedView) return;
    const buffer = formattedView.getBuffer();
    if (!buffer) return;

    buffer.beginIrreversibleAction();
    const startIter = buffer.getStartIter();
    const endIter = buffer.getEndIter();
    buffer.delete(startIter, endIter);
    const insertIter = buffer.getStartIter();
    buffer.insertMarkup(insertIter, markup, -1);
    buffer.endIrreversibleAction();
};

const syncMarkupFromSource = (sourceView: Gtk.TextView | null, markupRef: React.RefObject<string>) => {
    if (!sourceView) return;
    const buffer = sourceView.getBuffer();
    if (!buffer) return;
    const startIter = buffer.getStartIter();
    const endIter = buffer.getEndIter();
    markupRef.current = buffer.getText(startIter, endIter, false) ?? "";
};

interface MarkupStackProps {
    showSource: boolean;
    formattedViewRef: React.RefObject<Gtk.TextView | null>;
    sourceViewRef: React.RefObject<Gtk.TextView | null>;
    onFormattedRealized: (self: Gtk.Widget) => void;
}

const MarkupStack = ({ showSource, formattedViewRef, sourceViewRef, onFormattedRealized }: MarkupStackProps) => (
    <GtkStack
        name="markup-stack"
        page={showSource ? "source" : "formatted"}
        vexpand
        hexpand
        transitionType={Gtk.StackTransitionType.NONE}
    >
        <GtkStackPage id="formatted" title="Formatted">
            <GtkScrolledWindow
                vexpand
                hexpand
                hscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
                vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
            >
                <GtkTextView
                    name="formatted-view"
                    ref={formattedViewRef}
                    editable={false}
                    wrapMode={Gtk.WrapMode.WORD_CHAR}
                    leftMargin={10}
                    rightMargin={10}
                    onRealize={onFormattedRealized}
                />
            </GtkScrolledWindow>
        </GtkStackPage>
        <GtkStackPage id="source" title="Source">
            <GtkScrolledWindow
                vexpand
                hexpand
                hscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
                vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
            >
                <GtkTextView
                    name="source-view"
                    ref={sourceViewRef}
                    wrapMode={Gtk.WrapMode.WORD}
                    leftMargin={10}
                    rightMargin={10}
                >
                    {SAMPLE_MARKUP}
                </GtkTextView>
            </GtkScrolledWindow>
        </GtkStackPage>
    </GtkStack>
);

interface MarkupContextValue {
    showSource: boolean;
    handleSourceToggle: (active: boolean) => void;
    applyMarkup: () => void;
    formattedViewRef: React.RefObject<Gtk.TextView | null>;
    sourceViewRef: React.RefObject<Gtk.TextView | null>;
    markupRef: React.RefObject<string>;
}

const MarkupContext = createContext<MarkupContextValue | null>(null);

const useMarkupContext = (): MarkupContextValue => {
    const ctx = useContext(MarkupContext);
    if (!ctx) throw new Error("MarkupContext is missing");
    return ctx;
};

const MarkupProvider = ({ children }: DemoProviderProps) => {
    const formattedViewRef = useRef<Gtk.TextView | null>(null);
    const sourceViewRef = useRef<Gtk.TextView | null>(null);
    const [showSource, setShowSource] = useState(false);
    const markupRef = useRef(SAMPLE_MARKUP);

    const applyMarkup = () => {
        applyMarkupToView(formattedViewRef.current, markupRef.current);
    };

    const handleSourceToggle = (active: boolean) => {
        if (!active && showSource) {
            syncMarkupFromSource(sourceViewRef.current, markupRef);
            applyMarkup();
        }
        setShowSource(active);
    };

    const value = {
        showSource,
        handleSourceToggle,
        applyMarkup,
        formattedViewRef,
        sourceViewRef,
        markupRef,
    };

    return <MarkupContext.Provider value={value}>{children}</MarkupContext.Provider>;
};

const MarkupTitlebar = () => {
    const { showSource, handleSourceToggle } = useMarkupContext();
    return (
        <GtkHeaderBar
            packStart={
                <GtkCheckButton
                    label="Source"
                    active={showSource}
                    valign={Gtk.Align.CENTER}
                    onToggled={(btn) => handleSourceToggle(btn.getActive())}
                />
            }
        />
    );
};

const MarkupDemo = () => {
    const { showSource, formattedViewRef, sourceViewRef, markupRef } = useMarkupContext();
    const onFormattedRealized = (self: Gtk.Widget) => applyMarkupToView(self as Gtk.TextView, markupRef.current);
    return (
        <MarkupStack
            showSource={showSource}
            formattedViewRef={formattedViewRef}
            sourceViewRef={sourceViewRef}
            onFormattedRealized={onFormattedRealized}
        />
    );
};

export const markupDemo: Demo = {
    id: "markup",
    title: "Text View/Markup",
    description:
        "GtkTextBuffer lets you define your own tags that can influence text formatting in a variety of ways. In this example, we show that GtkTextBuffer can load Pango markup and automatically generate suitable tags.",
    keywords: ["GtkTextView"],
    component: MarkupDemo,
    titlebar: MarkupTitlebar,
    provider: MarkupProvider,
    sourceCode,
    defaultWidth: 600,
    defaultHeight: 680,
};
