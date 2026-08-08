import * as Gtk from "@gtkx/gi/gtk";
import {
    GtkCheckButton,
    GtkHeaderBar,
    GtkScrolledWindow,
    GtkStack,
    GtkStackPage,
    GtkTextBuffer,
    GtkTextView,
} from "@gtkx/jsx/gtk";
import { createContext, type ReactNode, useContext, useRef, useState } from "react";
import type { Demo, DemoProviderProps } from "../types.js";
import sourceCode from "./markup.tsx?raw";
import markupContent from "./markup.txt?raw";

type MarkupStackProps = {
    isShowingSource: boolean;
    formattedViewRef: React.RefObject<Gtk.TextView | null>;
    sourceViewRef: React.RefObject<Gtk.TextView | null>;
    onFormattedRealized: (self: Gtk.Widget) => void;
};

type MarkupContextValue = {
    isShowingSource: boolean;
    handleSourceToggle: (isActive: boolean) => void;
    applyMarkup: () => void;
    formattedViewRef: React.RefObject<Gtk.TextView | null>;
    sourceViewRef: React.RefObject<Gtk.TextView | null>;
    markupRef: React.RefObject<string>;
};

const SAMPLE_MARKUP = markupContent;
const MarkupContext = createContext<MarkupContextValue | null>(null);

const markupDemo: Demo = {
    id: "markup",
    title: "Text View/Markup",
    description:
        "GtkTextBuffer lets you define your own tags that can influence text formatting in a variety of ways. " +
        "In this example, we show that GtkTextBuffer can load Pango markup and automatically generate suitable tags.",
    keywords: ["GtkTextView"],
    component: MarkupDemo,
    titlebar: MarkupTitlebar,
    provider: MarkupProvider,
    sourceCode,
    defaultWidth: 600,
    defaultHeight: 680,
};

const applyMarkupToView = (formattedView: Gtk.TextView | null, markup: string) => {
    if (!formattedView) {
        return;
    }

    const buffer = formattedView.getBuffer();
    buffer.beginIrreversibleAction();
    const startIter = buffer.getStartIter();
    const endIter = buffer.getEndIter();
    buffer.delete(startIter, endIter);
    const insertIter = buffer.getStartIter();
    buffer.insertMarkup(insertIter, markup, -1);
    buffer.endIrreversibleAction();
};

const syncMarkupFromSource = (sourceView: Gtk.TextView | null, markupRef: React.RefObject<string>) => {
    if (!sourceView) {
        return;
    }

    const buffer = sourceView.getBuffer();
    const startIter = buffer.getStartIter();
    const endIter = buffer.getEndIter();
    markupRef.current = buffer.getText(startIter, endIter, false);
};

const MarkupScroller = ({ children }: { children: ReactNode }) => (
    <GtkScrolledWindow
        vexpand
        hexpand
        hscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
        vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
    >
        {children}
    </GtkScrolledWindow>
);

const MarkupStack = ({ isShowingSource, formattedViewRef, sourceViewRef, onFormattedRealized }: MarkupStackProps) => (
    <GtkStack
        name="markup-stack"
        visibleChildName={isShowingSource ? "source" : "formatted"}
        vexpand
        hexpand
        transitionType={Gtk.StackTransitionType.NONE}
    >
        <GtkStackPage name="formatted" title="Formatted">
            <MarkupScroller>
                <GtkTextView
                    name="formatted-view"
                    ref={formattedViewRef}
                    editable={false}
                    wrapMode={Gtk.WrapMode.WORD_CHAR}
                    leftMargin={10}
                    rightMargin={10}
                    onRealize={onFormattedRealized}
                />
            </MarkupScroller>
        </GtkStackPage>
        <GtkStackPage name="source" title="Source">
            <MarkupScroller>
                <GtkTextView
                    name="source-view"
                    ref={sourceViewRef}
                    wrapMode={Gtk.WrapMode.WORD}
                    leftMargin={10}
                    rightMargin={10}
                    buffer={<GtkTextBuffer>{SAMPLE_MARKUP}</GtkTextBuffer>}
                />
            </MarkupScroller>
        </GtkStackPage>
    </GtkStack>
);

const useMarkupContext = (): MarkupContextValue => {
    const ctx = useContext(MarkupContext);

    if (!ctx) {
        throw new Error("MarkupContext is missing");
    }

    return ctx;
};

function MarkupProvider({ children }: DemoProviderProps) {
    const formattedViewRef = useRef<Gtk.TextView | null>(null);
    const sourceViewRef = useRef<Gtk.TextView | null>(null);
    const [isShowingSource, setIsShowingSource] = useState(false);
    const markupRef = useRef(SAMPLE_MARKUP);

    const applyMarkup = () => {
        applyMarkupToView(formattedViewRef.current, markupRef.current);
    };

    const handleSourceToggle = (isActive: boolean) => {
        if (!isActive && isShowingSource) {
            syncMarkupFromSource(sourceViewRef.current, markupRef);
            applyMarkup();
        }

        setIsShowingSource(isActive);
    };

    const value = {
        isShowingSource,
        handleSourceToggle,
        applyMarkup,
        formattedViewRef,
        sourceViewRef,
        markupRef,
    };

    return <MarkupContext.Provider value={value}>{children}</MarkupContext.Provider>;
}

function MarkupTitlebar() {
    const { isShowingSource, handleSourceToggle } = useMarkupContext();

    return (
        <GtkHeaderBar
            start={(
                <GtkCheckButton
                    label="Source"
                    active={isShowingSource}
                    valign={Gtk.Align.CENTER}
                    onToggled={(btn) => {
                        handleSourceToggle(btn.getActive());
                    }}
                />
            )}
        />
    );
}

function MarkupDemo() {
    const { isShowingSource, formattedViewRef, sourceViewRef, markupRef } = useMarkupContext();

    const onFormattedRealized = (self: Gtk.Widget) => {
        applyMarkupToView(self as Gtk.TextView, markupRef.current);
    };

    return (
        <MarkupStack
            isShowingSource={isShowingSource}
            formattedViewRef={formattedViewRef}
            sourceViewRef={sourceViewRef}
            onFormattedRealized={onFormattedRealized}
        />
    );
}

export { markupDemo };
