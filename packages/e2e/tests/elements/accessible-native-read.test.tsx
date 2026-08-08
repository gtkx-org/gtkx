import type * as GtkTypes from "@gtkx/gi/gtk";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { render, waitFor } from "@gtkx/testing";
import {
    readAccessibleFlag,
    readAccessibleRelation,
    readAccessibleState,
    readAccessibleString,
} from "@gtkx/testing/internal";
import { createRef, type RefObject } from "react";
import { describe, expect, it } from "vitest";

const accessible = (ref: RefObject<GtkTypes.Label | null>): GtkTypes.Accessible => {
    if (ref.current === null) {
        throw new Error("Expected rendered widget");
    }

    return ref.current;
};

const descendants = (widget: GtkTypes.Widget): GtkTypes.Accessible[] => {
    const found: GtkTypes.Accessible[] = [];
    let child = widget.getFirstChild();

    while (child) {
        found.push(child, ...descendants(child));
        child = child.getNextSibling();
    }

    return found;
};

describe("reading accessible attributes from GTK", () => {
    it("reads a string property back verbatim", async () => {
        const ref = createRef<GtkTypes.Label>();
        await render(<GtkLabel ref={ref} accessibleLabel="Written by React" />);
        expect(readAccessibleString(accessible(ref), Gtk.AccessibleProperty.LABEL)).toBe("Written by React");
    });

    it("reads a boolean state GTK does not maintain itself", async () => {
        const set = createRef<GtkTypes.Label>();
        const unset = createRef<GtkTypes.Label>();

        await render(
            <GtkBox>
                <GtkLabel ref={set} accessibleBusy />
                <GtkLabel ref={unset} />
            </GtkBox>,
        );

        expect(readAccessibleFlag(accessible(set), Gtk.AccessibleState.BUSY)).toBe(true);
        expect(readAccessibleFlag(accessible(unset), Gtk.AccessibleState.BUSY)).toBeNull();
    });

    it("reads a tristate state as its enum member", async () => {
        const ref = createRef<GtkTypes.Label>();
        await render(<GtkLabel ref={ref} accessibleChecked={Gtk.AccessibleTristate.MIXED} />);
        expect(readAccessibleState(accessible(ref), Gtk.AccessibleState.CHECKED)).toBe(Gtk.AccessibleTristate.MIXED);
    });
});

describe("holding accessible props against GTK's own writes", () => {
    it("holds accessibleHidden through the initial map", async () => {
        const ref = createRef<GtkTypes.Label>();
        await render(<GtkLabel ref={ref} accessibleHidden />);

        await waitFor(() => {
            expect(readAccessibleFlag(accessible(ref), Gtk.AccessibleState.HIDDEN)).toBe(true);
        });
    });

    it("holds accessibleHidden across a hide and show cycle", async () => {
        const ref = createRef<GtkTypes.Label>();

        function App({ isShown }: { isShown: boolean }) {
            return <GtkBox visible={isShown}><GtkLabel ref={ref} accessibleHidden /></GtkBox>;
        }

        const { rerender } = await render(<App isShown />);
        await rerender(<App isShown={false} />);
        await rerender(<App isShown />);

        await waitFor(() => {
            expect(readAccessibleFlag(accessible(ref), Gtk.AccessibleState.HIDDEN)).toBe(true);
        });
    });
});

describe("resolving relation targets without reading the print string", () => {
    it("resolves the LABELLED_BY GTK writes on a button to its own label", async () => {
        const ref = createRef<GtkTypes.Button>();
        await render(<GtkButton ref={ref} label="Press me" />);
        const button = ref.current as GtkTypes.Widget;
        const targets = readAccessibleRelation(button, Gtk.AccessibleRelation.LABELLED_BY, descendants(button));
        expect(targets).toHaveLength(1);
        expect(targets[0]).toBeInstanceOf(Gtk.Label);
    });

    it("resolves a relation carrying more than one target", async () => {
        const first = createRef<GtkTypes.Label>();
        const second = createRef<GtkTypes.Label>();
        const subject = createRef<GtkTypes.Box>();

        function App({ labels }: { labels: GtkTypes.Label[] }) {
            return (
                <GtkBox>
                    <GtkLabel ref={first}>First</GtkLabel>
                    <GtkLabel ref={second}>Second</GtkLabel>
                    <GtkBox ref={subject} accessibleLabelledBy={labels} />
                </GtkBox>
            );
        }

        const { rerender } = await render(<App labels={[]} />);
        const both = [first.current as GtkTypes.Label, second.current as GtkTypes.Label];
        await rerender(<App labels={both} />);

        const resolved = readAccessibleRelation(
            subject.current as GtkTypes.Accessible,
            Gtk.AccessibleRelation.LABELLED_BY,
            both,
        );

        expect(resolved).toHaveLength(2);
        expect(resolved).toEqual(expect.arrayContaining(both));
    });
});
