import type * as Gtk from "@gtkx/gi/gtk";
import { GtkAboutDialog } from "@gtkx/jsx/gtk";
import { rootElement } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

type CreditSection = { sectionName: string; people: string[] };

const SECTIONS: CreditSection[] = [
    { sectionName: "Design", people: ["Ada Lovelace"] },
    { sectionName: "Testing", people: ["Grace Hopper", "Margaret Hamilton"] },
];

describe("render - AboutDialog credit sections", () => {
    it("creates AboutDialog with credit sections", async () => {
        const ref = createRef<Gtk.AboutDialog>();

        await render(<GtkAboutDialog ref={ref} programName="GTKX" creditSections={SECTIONS} />, {
            container: rootElement,
        });

        expect(ref.current?.getProgramName()).toBe("GTKX");
    });

    it("keeps the initial sections when the prop changes", async () => {
        const ref = createRef<Gtk.AboutDialog>();

        const { rerender } = await render(<GtkAboutDialog ref={ref} programName="GTKX" creditSections={SECTIONS} />, {
            container: rootElement,
        });

        await rerender(
            <GtkAboutDialog
                ref={ref}
                programName="GTKX"
                creditSections={[{ sectionName: "Translation", people: ["Alan Turing"] }]}
            />,
        );

        expect(ref.current?.getProgramName()).toBe("GTKX");
    });

    it("applies sections provided after mount only once", async () => {
        const ref = createRef<Gtk.AboutDialog>();

        const { rerender } = await render(<GtkAboutDialog ref={ref} programName="GTKX" />, {
            container: rootElement,
        });

        await rerender(<GtkAboutDialog ref={ref} programName="GTKX" creditSections={SECTIONS} />);
        expect(ref.current?.getProgramName()).toBe("GTKX");
    });
});
