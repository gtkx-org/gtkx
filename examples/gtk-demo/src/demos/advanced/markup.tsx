import * as Gtk from "@gtkx/ffi/gtk";
import { GtkCheckButton, GtkHeaderBar, GtkScrolledWindow, GtkStack, GtkTextView } from "@gtkx/react";
import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from "react";
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
}

const MarkupStack = ({ showSource, formattedViewRef, sourceViewRef }: MarkupStackProps) => (
    <GtkStack page={showSource ? "source" : "formatted"} vexpand hexpand transitionType={Gtk.StackTransitionType.NONE}>
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
                <GtkTextView ref={sourceViewRef} wrapMode={Gtk.WrapMode.WORD} leftMargin={10} rightMargin={10} />
            </GtkScrolledWindow>
        </GtkStack.Page>
    </GtkStack>
);

interface MarkupContextValue {
    showSource: boolean;
    handleSourceToggle: (active: boolean) => void;
    applyMarkup: () => void;
    formattedViewRef: React.RefObject<Gtk.TextView | null>;
    sourceViewRef: React.RefObject<Gtk.TextView | null>;
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

    const applyMarkup = useCallback(() => {
        applyMarkupToView(formattedViewRef.current, markupRef.current);
    }, []);

    const handleSourceToggle = useCallback(
        (active: boolean) => {
            if (!active && showSource) {
                syncMarkupFromSource(sourceViewRef.current, markupRef);
                applyMarkup();
            }
            setShowSource(active);
        },
        [showSource, applyMarkup],
    );

    const value = useMemo<MarkupContextValue>(
        () => ({ showSource, handleSourceToggle, applyMarkup, formattedViewRef, sourceViewRef }),
        [showSource, handleSourceToggle, applyMarkup],
    );

    return <MarkupContext.Provider value={value}>{children}</MarkupContext.Provider>;
};

const MarkupTitlebar = () => {
    const { showSource, handleSourceToggle } = useMarkupContext();
    return (
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
    );
};

const MarkupDemo = () => {
    const { showSource, formattedViewRef, sourceViewRef, applyMarkup } = useMarkupContext();

    useLayoutEffect(() => {
        const sourceView = sourceViewRef.current;
        if (sourceView) {
            const buffer = sourceView.getBuffer();
            if (buffer) {
                buffer.setText(SAMPLE_MARKUP, -1);
            }
        }
        applyMarkup();
    }, [applyMarkup, sourceViewRef]);

    return <MarkupStack showSource={showSource} formattedViewRef={formattedViewRef} sourceViewRef={sourceViewRef} />;
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
