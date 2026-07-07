import * as Gtk from "@gtkx/gi/gtk";
import {
    GtkAdjustment,
    GtkBox,
    GtkButton,
    GtkEntry,
    GtkLabel,
    GtkLevelBar,
    GtkProgressBar,
    GtkScale,
} from "@gtkx/jsx/gtk";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { getByLabelText, queryAllByRole, queryByRole, render } from "../src/index.js";

const VBox = ({ children }: { children: ReactNode }) => (
    <GtkBox orientation={Gtk.Orientation.VERTICAL}>{children}</GtkBox>
);

describe("getByRole busy", () => {
    it("filters by busy state", async () => {
        const { container } = await render(
            <VBox>
                <GtkButton label="Idle" />
                <GtkButton label="Working" accessibleBusy />
            </VBox>,
        );
        const busy = queryByRole(container, Gtk.AccessibleRole.BUTTON, { busy: true });
        expect((busy as Gtk.Button).getLabel()).toBe("Working");
        expect(queryAllByRole(container, Gtk.AccessibleRole.BUTTON, { busy: false })).toHaveLength(1);
    });
});

describe("getByRole description", () => {
    it("filters by accessible description", async () => {
        const { container } = await render(
            <VBox>
                <GtkButton label="Save" accessibleDescription="Persist changes" />
                <GtkButton label="Cancel" accessibleDescription="Discard changes" />
            </VBox>,
        );
        const save = queryByRole(container, Gtk.AccessibleRole.BUTTON, { description: "Persist changes" });
        expect((save as Gtk.Button).getLabel()).toBe("Save");
        const discard = queryByRole(container, Gtk.AccessibleRole.BUTTON, { description: /discard/i });
        expect((discard as Gtk.Button).getLabel()).toBe("Cancel");
    });
});

describe("getByRole value", () => {
    it("filters a slider by its live adjustment value now/min/max", async () => {
        const { container } = await render(
            <VBox>
                <GtkScale adjustment={<GtkAdjustment value={25} lower={0} upper={100} />} />
                <GtkScale adjustment={<GtkAdjustment value={75} lower={0} upper={100} />} />
            </VBox>,
        );
        expect(queryByRole(container, Gtk.AccessibleRole.SLIDER, { value: { now: 25 } })).not.toBeNull();
        expect(queryAllByRole(container, Gtk.AccessibleRole.SLIDER, { value: { min: 0, max: 100 } })).toHaveLength(2);
        expect(queryByRole(container, Gtk.AccessibleRole.SLIDER, { value: { now: 999 } })).toBeNull();
    });

    it("filters a progress bar by its live fraction", async () => {
        const { container } = await render(
            <VBox>
                <GtkProgressBar fraction={0.25} />
                <GtkProgressBar fraction={0.75} />
            </VBox>,
        );
        expect(queryByRole(container, Gtk.AccessibleRole.PROGRESS_BAR, { value: { now: 0.25 } })).not.toBeNull();
        expect(queryAllByRole(container, Gtk.AccessibleRole.PROGRESS_BAR, { value: { min: 0, max: 1 } })).toHaveLength(
            2,
        );
        expect(queryByRole(container, Gtk.AccessibleRole.PROGRESS_BAR, { value: { now: 0.99 } })).toBeNull();
    });

    it("filters a level bar by its live value/min/max", async () => {
        const { container } = await render(<GtkLevelBar value={0.3} />);
        expect(
            queryByRole(container, Gtk.AccessibleRole.METER, { value: { now: 0.3, min: 0, max: 1 } }),
        ).not.toBeNull();
        expect(queryByRole(container, Gtk.AccessibleRole.METER, { value: { now: 0.9 } })).toBeNull();
    });

    it("falls back to author-supplied accessibleValueText alongside a live value", async () => {
        const { container } = await render(
            <GtkScale adjustment={<GtkAdjustment value={10} lower={0} upper={100} />} accessibleValueText="Loading" />,
        );
        expect(queryByRole(container, Gtk.AccessibleRole.SLIDER, { value: { text: "Loading" } })).not.toBeNull();
        expect(queryByRole(container, Gtk.AccessibleRole.SLIDER, { value: { text: "Done" } })).toBeNull();
    });
});

describe("getByRole hidden", () => {
    const expectHiddenButtonExcludedByDefault = async (hiddenButton: ReactNode) => {
        const { container } = await render(
            <VBox>
                <GtkButton label="Shown" />
                {hiddenButton}
            </VBox>,
        );
        expect(queryAllByRole(container, Gtk.AccessibleRole.BUTTON)).toHaveLength(1);
        expect(queryAllByRole(container, Gtk.AccessibleRole.BUTTON, { hidden: true })).toHaveLength(2);
    };

    it("excludes accessibility-hidden widgets by default", async () => {
        await expectHiddenButtonExcludedByDefault(<GtkButton label="Hidden" accessibleHidden />);
    });

    it("excludes not-visible widgets by default", async () => {
        await expectHiddenButtonExcludedByDefault(<GtkButton label="Gone" visible={false} />);
    });
});

describe("getByLabelText accessible-label and accessible-labelledby", () => {
    it("matches a widget by its own accessibleLabel", async () => {
        const { container } = await render(<GtkEntry accessibleLabel="Email address" />);
        expect(getByLabelText(container, "Email address")).toBeInstanceOf(Gtk.Entry);
    });

    it("matches a widget labeled by accessibleLabelledBy", async () => {
        const labelRef = { current: null as Gtk.Label | null };
        const Form = () => (
            <VBox>
                <GtkLabel
                    label="Full name"
                    ref={(el) => {
                        labelRef.current = el;
                    }}
                />
                <GtkEntry accessibleLabelledBy={labelRef.current ? [labelRef.current] : []} />
            </VBox>
        );

        const { container, rerender } = await render(<Form />);
        await rerender(<Form />);

        expect(getByLabelText(container, "Full name")).toBeInstanceOf(Gtk.Entry);
    });
});
