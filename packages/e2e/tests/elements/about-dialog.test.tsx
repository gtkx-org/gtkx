import type { CreditSection } from "@gtkx/react/internal";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkAboutDialog } from "@gtkx/jsx/gtk";
import { rootElement } from "@gtkx/react";
import { render, userEvent, within } from "@gtkx/testing";
import { createRef, type ReactNode, type RefObject } from "react";
import { describe, expect, it } from "vitest";

const SECTIONS: CreditSection[] = [
    { sectionName: "Design", people: ["Ada Lovelace"] },
    { sectionName: "Testing", people: ["Grace Hopper", "Margaret Hamilton"] },
];

const TRANSLATIONS: CreditSection[] = [{ sectionName: "Translation", people: ["Alan Turing"] }];

const CreditedDialog = ({
    dialogRef,
    sections,
}: {
    dialogRef: RefObject<Gtk.AboutDialog | null>;
    sections?: CreditSection[] | undefined;
}): ReactNode => <GtkAboutDialog ref={dialogRef} programName="GTKX" creditSections={sections} visible />;

const renderDialog = async (
    dialogRef: RefObject<Gtk.AboutDialog | null>,
    sections?: CreditSection[],
): Promise<(node: ReactNode) => Promise<void>> => {
    const { rerender } = await render(<CreditedDialog dialogRef={dialogRef} sections={sections} />, {
        container: rootElement,
    });

    return rerender;
};

const getDialog = (dialogRef: RefObject<Gtk.AboutDialog | null>): Gtk.AboutDialog => {
    if (!dialogRef.current) {
        throw new Error("Expected an AboutDialog instance");
    }

    return dialogRef.current;
};

const showCredits = async (dialog: Gtk.AboutDialog): Promise<void> => {
    await userEvent.click(within(dialog).getByRole(Gtk.AccessibleRole.TAB, { name: "Credits" }));
};

const getCreditCount = (dialog: Gtk.AboutDialog, text: string): number =>
    within(dialog).queryAllByText(text, { exact: false }).length;

const expectRejectedSections = async (sections?: CreditSection[]): Promise<void> => {
    const ref = createRef<Gtk.AboutDialog>();
    const rerender = await renderDialog(ref, SECTIONS);

    await expect(rerender(<CreditedDialog dialogRef={ref} sections={sections} />)).rejects.toThrow(
        /Cannot change the construct-only prop 'creditSections' of <GtkAboutDialog>/,
    );
};

const expectSectionsOnce = (dialog: Gtk.AboutDialog): void => {
    expect(getCreditCount(dialog, "Design")).toBe(1);
    expect(getCreditCount(dialog, "Ada Lovelace")).toBe(1);
    expect(getCreditCount(dialog, "Testing")).toBe(1);
    expect(getCreditCount(dialog, "Grace Hopper")).toBe(1);
    expect(getCreditCount(dialog, "Margaret Hamilton")).toBe(1);
};

describe("render - AboutDialog credit sections", () => {
    it("lists every section and person on the credits page", async () => {
        const ref = createRef<Gtk.AboutDialog>();
        await renderDialog(ref, SECTIONS);
        const dialog = getDialog(ref);
        await showCredits(dialog);
        expectSectionsOnce(dialog);
    });

    it("throws when the sections change after they are applied", async () => {
        await expectRejectedSections(TRANSLATIONS);
    });

    it("throws when the sections are taken away", async () => {
        await expectRejectedSections();
    });

    it("accepts an equal array built again on the next render", async () => {
        const ref = createRef<Gtk.AboutDialog>();
        const rerender = await renderDialog(ref, SECTIONS);

        await rerender(
            <CreditedDialog
                dialogRef={ref}
                sections={[
                    { sectionName: "Design", people: ["Ada Lovelace"] },
                    { sectionName: "Testing", people: ["Grace Hopper", "Margaret Hamilton"] },
                ]}
            />,
        );

        const dialog = getDialog(ref);
        await showCredits(dialog);
        expectSectionsOnce(dialog);
    });

    it("applies sections provided after mount only once", async () => {
        const ref = createRef<Gtk.AboutDialog>();
        const rerender = await renderDialog(ref);
        await rerender(<CreditedDialog dialogRef={ref} sections={SECTIONS} />);
        const dialog = getDialog(ref);
        await showCredits(dialog);
        expectSectionsOnce(dialog);
    });
});
