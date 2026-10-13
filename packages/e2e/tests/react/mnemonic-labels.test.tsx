import * as Gtk from "@gtkx/gi/gtk";
import { GtkCheckButton, GtkLabel } from "@gtkx/jsx/gtk";
import { render, screen } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

describe("check button mnemonic labels", () => {
    it("sets its native accessible name independently of constructor prop order", async () => {
        const { rerender } = await render(<GtkCheckButton key="label-first" label="_Read Only" useUnderline />);
        expect(screen.getByRole(Gtk.AccessibleRole.CHECKBOX)).toHaveAccessibleName("Read Only");
        await rerender(<GtkCheckButton key="underline-first" useUnderline label="_Read Only" />);
        expect(screen.getByRole(Gtk.AccessibleRole.CHECKBOX)).toHaveAccessibleName("Read Only");
    });

    it("refreshes its accessible name when mnemonic handling changes or is removed", async () => {
        const app = (useUnderline: boolean | undefined) => (
            <GtkCheckButton label="_Export __ Range" useUnderline={useUnderline} />
        );
        const { rerender } = await render(app(false));
        const button = screen.getByRole(Gtk.AccessibleRole.CHECKBOX);
        expect(button).toHaveAccessibleName("_Export __ Range");
        await rerender(app(true));
        expect(button).toHaveAccessibleName("Export _ Range");
        await rerender(app(false));
        expect(button).toHaveAccessibleName("_Export __ Range");
        await rerender(app(true));
        await rerender(app(undefined));
        expect(button).toHaveAccessibleName("_Export __ Range");
    });

    it("preserves an unchanged authored accessible label across mnemonic updates", async () => {
        const app = (useUnderline: boolean | undefined) => (
            <GtkCheckButton label="_Read Only" useUnderline={useUnderline} accessibleLabel="_Author label" />
        );
        const { rerender } = await render(app(true));
        const button = screen.getByRole(Gtk.AccessibleRole.CHECKBOX);
        expect(button).toHaveAccessibleName("_Author label");
        await rerender(app(false));
        expect(button).toHaveAccessibleName("_Author label");
        await rerender(app(true));
        expect(button).toHaveAccessibleName("_Author label");
        await rerender(app(undefined));
        expect(button).toHaveAccessibleName("_Author label");
    });

    it("preserves a custom child when mnemonic handling changes", async () => {
        const ref = createRef<Gtk.CheckButton>();
        const childRef = createRef<Gtk.Label>();
        const app = (useUnderline: boolean) => (
            <GtkCheckButton ref={ref} useUnderline={useUnderline}>
                <GtkLabel ref={childRef}>Custom content</GtkLabel>
            </GtkCheckButton>
        );
        const { rerender } = await render(app(false));
        const child = childRef.current;
        await rerender(app(true));
        expect(ref.current?.getChild()).toBe(child);
        expect(child).toBeRooted();
        expect(ref.current?.getLabel()).toBeNull();
        await rerender(app(false));
        expect(ref.current?.getChild()).toBe(child);
        expect(child).toBeRooted();
    });
});
