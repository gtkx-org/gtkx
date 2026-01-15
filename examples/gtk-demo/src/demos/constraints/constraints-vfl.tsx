import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkFrame, GtkLabel, GtkTextView, x } from "@gtkx/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./constraints-vfl.tsx?raw";

const DEFAULT_VFL = `H:|-8-[button1(==button2)]-12-[button2]-8-|
H:|-8-[button3]-8-|
V:|-8-[button1]-12-[button3]-8-|
V:|-8-[button2]-12-[button3]-8-|`;

const ConstraintsVflDemo = () => {
    const containerRef = useRef<Gtk.Box | null>(null);
    const button1Ref = useRef<Gtk.Button | null>(null);
    const button2Ref = useRef<Gtk.Button | null>(null);
    const button3Ref = useRef<Gtk.Button | null>(null);
    const layoutRef = useRef<Gtk.ConstraintLayout | null>(null);
    const [vflText, setVflText] = useState(DEFAULT_VFL);
    const [error, setError] = useState<string | null>(null);
    const [constraintCount, setConstraintCount] = useState(0);

    const applyConstraints = useCallback(() => {
        const container = containerRef.current;
        const button1 = button1Ref.current;
        const button2 = button2Ref.current;
        const button3 = button3Ref.current;

        if (!container || !button1 || !button2 || !button3) return;

        if (!layoutRef.current) {
            layoutRef.current = new Gtk.ConstraintLayout();
            container.setLayoutManager(layoutRef.current);
        }

        const layout = layoutRef.current;
        layout.removeAllConstraints();
        setError(null);

        const views = new Map<string, Gtk.ConstraintTarget>([
            ["button1", button1 as unknown as Gtk.ConstraintTarget],
            ["button2", button2 as unknown as Gtk.ConstraintTarget],
            ["button3", button3 as unknown as Gtk.ConstraintTarget],
        ]);

        const lines = vflText.split("\n").filter((line) => line.trim().length > 0);

        if (lines.length === 0) {
            setError("No VFL constraints to apply");
            setConstraintCount(0);
            return;
        }

        try {
            const constraints = layout.addConstraintsFromDescriptionv(lines, lines.length, 8, 8, views);
            setConstraintCount(constraints.length);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
            setConstraintCount(0);
        }
    }, [vflText]);

    useEffect(() => {
        applyConstraints();
    }, [applyConstraints]);

    const handleTextChanged = useCallback((text: string) => {
        setVflText(text);
    }, []);

    const handleReset = useCallback(() => {
        setVflText(DEFAULT_VFL);
    }, []);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12} marginStart={12} marginEnd={12} marginTop={12} marginBottom={12}>
            <GtkLabel label="Visual Format Language (VFL)" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="VFL allows defining constraints using a compact syntax. Edit the VFL below and see the layout update in real-time. The '|' character represents the parent container edges."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="VFL Definition">
                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8} marginTop={8} marginBottom={8} marginStart={8} marginEnd={8}>
                    <GtkTextView
                        heightRequest={120}
                        monospace
                        wrapMode={Gtk.WrapMode.WORD_CHAR}
                        topMargin={8}
                        bottomMargin={8}
                        leftMargin={8}
                        rightMargin={8}
                    >
                        <x.TextBuffer onTextChanged={handleTextChanged}>{vflText}</x.TextBuffer>
                    </GtkTextView>

                    <GtkBox spacing={12}>
                        <GtkButton label="Reset to Default" onClicked={handleReset} />
                        <GtkLabel
                            label={constraintCount > 0 ? `${constraintCount} constraints applied` : "No constraints"}
                            cssClasses={["dim-label"]}
                            hexpand
                            halign={Gtk.Align.END}
                        />
                    </GtkBox>

                    {error && (
                        <GtkLabel label={`Error: ${error}`} cssClasses={["error"]} wrap halign={Gtk.Align.START} />
                    )}
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Result">
                <GtkBox ref={containerRef} hexpand heightRequest={200}>
                    <GtkButton ref={button1Ref} label="button1" />
                    <GtkButton ref={button2Ref} label="button2" />
                    <GtkButton ref={button3Ref} label="button3" />
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="VFL Syntax Reference">
                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4} marginTop={8} marginBottom={8} marginStart={8} marginEnd={8}>
                    <GtkLabel
                        label="<b>Orientation:</b> H: (horizontal), V: (vertical)"
                        useMarkup
                        halign={Gtk.Align.START}
                    />
                    <GtkLabel
                        label="<b>Superview:</b> | represents parent edges"
                        useMarkup
                        halign={Gtk.Align.START}
                    />
                    <GtkLabel
                        label="<b>Views:</b> [viewName] or [viewName(predicate)]"
                        useMarkup
                        halign={Gtk.Align.START}
                    />
                    <GtkLabel
                        label="<b>Spacing:</b> -N- (N pixels) or - (default spacing)"
                        useMarkup
                        halign={Gtk.Align.START}
                    />
                    <GtkLabel
                        label="<b>Predicates:</b> (==100), (>=50), (==otherView), (<=200@strong)"
                        useMarkup
                        halign={Gtk.Align.START}
                    />
                    <GtkLabel
                        label="<b>Attributes:</b> .width, .height, .top, .bottom, .left, .right, .start, .end"
                        useMarkup
                        halign={Gtk.Align.START}
                    />
                </GtkBox>
            </GtkFrame>
        </GtkBox>
    );
};

export const constraintsVflDemo: Demo = {
    id: "constraints-vfl",
    title: "Constraints/VFL",
    description:
        "GtkConstraintLayout allows defining constraints using Visual Format Language (VFL). This demo shows live VFL parsing with the addConstraintsFromDescriptionv API.",
    keywords: ["constraint", "VFL", "visual format language", "GtkConstraintLayout", "layout", "parser"],
    component: ConstraintsVflDemo,
    sourceCode,
};
