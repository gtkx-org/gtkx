import type { AdwAlertDialogProps } from "@gtkx/jsx/adw";
import type { CreditSection } from "@gtkx/react/internal";
import type { ReactElement, ReactNode, RefObject } from "react";
import * as Adw from "@gtkx/gi/adw";
import * as Gdk from "@gtkx/gi/gdk";
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import * as Pango from "@gtkx/gi/pango";
import { AdwAlertDialog, AdwDialog } from "@gtkx/jsx/adw";
import {
    GtkAboutDialog,
    GtkApplication,
    GtkApplicationWindow,
    GtkButton,
    GtkColorDialog,
    GtkColorDialogButton,
    GtkFontDialog,
    GtkFontDialogButton,
    GtkLabel,
} from "@gtkx/jsx/gtk";
import { rootElement } from "@gtkx/react";
import { act, render, screen, userEvent, waitFor, within } from "@gtkx/testing";
import { renderChildren } from "@gtkx/testing/internal";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { expectDialogModalProp, expectDialogTitleTracksProp } from "../helpers/dialog-button-render.js";
import { createAppIdFactory } from "../helpers/unique-name.js";

type ResponseDef = NonNullable<AdwAlertDialogProps["responses"]>[number];
type AlertResponse = { id: string; label: string };
type AlertRef = RefObject<Adw.AlertDialog | null>;

const SECTIONS: CreditSection[] = [
    { sectionName: "Design", people: ["Ada Lovelace"] },
    { sectionName: "Testing", people: ["Grace Hopper", "Margaret Hamilton"] },
];

const TRANSLATIONS: CreditSection[] = [{ sectionName: "Translation", people: ["Alan Turing"] }];
const uniqueAppId = createAppIdFactory("org.gtkx.dialogtest");
const uniqueAppId2 = createAppIdFactory("org.gtkx.alertextrachild");
const RESPONSES: AlertResponse[] = [{ id: "cancel", label: "Cancel" }, { id: "ok", label: "OK" }];
const HEADING = "Alert heading";

const requireWidget = <T extends Gtk.Widget>(ref: RefObject<T | null>, label: string): T => {
    const widget = ref.current;

    if (!widget) {
        throw new Error(`${label} ref was not populated`);
    }

    return widget;
};

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

    await expect(rerender(<CreditedDialog dialogRef={ref} sections={sections} />)).rejects.toThrow();
};

const expectSectionsOnce = (dialog: Gtk.AboutDialog): void => {
    expect(getCreditCount(dialog, "Design")).toBe(1);
    expect(getCreditCount(dialog, "Ada Lovelace")).toBe(1);
    expect(getCreditCount(dialog, "Testing")).toBe(1);
    expect(getCreditCount(dialog, "Grace Hopper")).toBe(1);
    expect(getCreditCount(dialog, "Margaret Hamilton")).toBe(1);
};

const requireDialog = (ref: RefObject<Adw.AlertDialog | null>): Adw.AlertDialog => {
    const dialog = ref.current;

    if (!dialog) {
        throw new Error("Dialog ref was not populated");
    }

    return dialog;
};

const InApp = ({ children }: { children: ReactNode }) => {
    const [appId] = useState(uniqueAppId);

    return (
        <GtkApplication applicationId={appId} flags={Gio.ApplicationFlags.NON_UNIQUE}>
            <GtkApplicationWindow defaultWidth={100} defaultHeight={100}>
                {children}
            </GtkApplicationWindow>
        </GtkApplication>
    );
};

const options = () => ({ container: rootElement });

const buildAlertDialog = (ref: RefObject<Adw.AlertDialog | null>) => (responses: ResponseDef[]) => (
    <AdwAlertDialog ref={ref} heading="Test" responses={responses} />
);

const renderResponses = async (responses: ResponseDef[]): Promise<RefObject<Adw.AlertDialog | null>> => {
    const ref = createRef<Adw.AlertDialog>();
    await render(buildAlertDialog(ref)(responses), options());

    return ref;
};

const InApp2 = ({ children }: { children: ReactNode }) => {
    const [appId] = useState(uniqueAppId2);

    return (
        <GtkApplication applicationId={appId} flags={Gio.ApplicationFlags.NON_UNIQUE}>
            <GtkApplicationWindow defaultWidth={200} defaultHeight={200}>
                {children}
            </GtkApplicationWindow>
        </GtkApplication>
    );
};

const alertDialog = (ref: AlertRef, children?: ReactNode) => (
    <AdwAlertDialog ref={ref} heading={HEADING} responses={RESPONSES}>
        {children}
    </AdwAlertDialog>
);

const ToggledAlert = ({ dialogRef, isOpen }: { dialogRef: AlertRef; isOpen: boolean }) => (
    <InApp2>{isOpen ? alertDialog(dialogRef, <GtkLabel>Extra content</GtkLabel>) : null}</InApp2>
);

const SwappedAlert = ({ dialogRef, isButton }: { dialogRef: AlertRef; isButton: boolean }) => (
    <InApp2>{alertDialog(dialogRef, isButton ? <GtkButton label="Second" /> : <GtkLabel>First</GtkLabel>)}</InApp2>
);

const OptionalChildAlert = ({ dialogRef, hasChildren }: { dialogRef: AlertRef; hasChildren: boolean }) => (
    <InApp2>{alertDialog(dialogRef, hasChildren ? <GtkLabel>Extra content</GtkLabel> : null)}</InApp2>
);

const renderAlertDialog = async (children?: ReactNode): Promise<Adw.AlertDialog> => {
    const ref = createRef<Adw.AlertDialog>();
    await render(<InApp2>{alertDialog(ref, children)}</InApp2>);

    return requireWidget(ref, "Alert dialog");
};

const expectButton = async (dialog: Adw.AlertDialog, name: string): Promise<void> => {
    const button = await within(dialog).findByRole(Gtk.AccessibleRole.BUTTON, { name, hidden: true });
    expect(button).toHaveTextContent(name);
};

const renderDialogSlot = async (dialog: ReactElement): Promise<Gtk.ColorDialog | null> => {
    const ref = createRef<Gtk.ColorDialogButton>();
    await render(<GtkColorDialogButton ref={ref} dialog={dialog} />);
    expect(ref.current).not.toBeNull();

    return ref.current?.getDialog() ?? null;
};

const makeRgba = (red: number, green: number, blue: number, alpha: number): Gdk.RGBA =>
    Object.assign(new Gdk.RGBA(), { red, green, blue, alpha });

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

describe("Dialog - render prop and lifecycle", () => {
    it("attaches the provided ref to the dialog widget and presents it", async () => {
        const dialogRef = createRef<Adw.AlertDialog>();

        await render(
            <InApp>
                <AdwAlertDialog
                    ref={(widget) => {
                        dialogRef.current = widget;
                    }}
                    heading="Presented"
                />
            </InApp>,
        );

        const dialog = requireDialog(dialogRef);
        expect(dialog).toBeRooted();
    });

    it("fires onClose when the user closes the dialog", async () => {
        const dialogRef = createRef<Adw.AlertDialog>();
        const onClose = vi.fn();

        await render(
            <InApp>
                <AdwAlertDialog
                    onClosed={onClose}
                    ref={(widget) => {
                        dialogRef.current = widget;
                    }}
                    heading="Closable"
                />
            </InApp>,
        );

        await act(() => {
            requireDialog(dialogRef).emit("closed");
        });

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("does not fire onClose when React unmounts the dialog", async () => {
        const onClose = vi.fn();

        const App = ({ isOpen }: { isOpen: boolean }) => (
            <InApp>{isOpen ? <AdwAlertDialog onClosed={onClose} heading="Unmounted" /> : null}</InApp>
        );

        const { rerender } = await render(<App isOpen={true} />);
        await rerender(<App isOpen={false} />);
        expect(onClose).not.toHaveBeenCalled();
    });
});

describe("render - AlertDialog responses", () => {
    it("creates AlertDialog without responses", async () => {
        const ref = createRef<Adw.AlertDialog>();
        await render(<AdwAlertDialog ref={ref} heading="Test" />, options());
        expect(ref.current).not.toBeNull();
        expect(ref.current?.hasResponse("any")).toBe(false);
    });

    it("creates AlertDialog with responses", async () => {
        const ref = await renderResponses([
            { id: "cancel", label: "Cancel" },
            { id: "confirm", label: "Confirm" },
        ]);

        expect(ref.current?.hasResponse("cancel")).toBe(true);
        expect(ref.current?.hasResponse("confirm")).toBe(true);
    });

    it("sets response label", async () => {
        const ref = await renderResponses([{ id: "ok", label: "OK Button" }]);
        expect(ref.current?.getResponseLabel("ok")).toBe("OK Button");
    });

    it("renders children as the extra child alongside responses", async () => {
        const ref = createRef<Adw.AlertDialog>();

        await render(
            <AdwAlertDialog ref={ref} heading="Test" responses={[{ id: "ok", label: "OK" }]}>
                <GtkLabel>Body content</GtkLabel>
            </AdwAlertDialog>,
            options(),
        );

        expect(ref.current?.hasResponse("ok")).toBe(true);
        expect(ref.current?.getHeading()).toBe("Test");
        expect(ref.current?.getExtraChild()).toHaveTextContent("Body content");
        expect(ref.current?.getChild()).not.toBe(ref.current?.getExtraChild());
    });

    it("sets response appearance", async () => {
        const ref = await renderResponses([
            { id: "default", label: "Default" },
            { id: "suggested", label: "Suggested", appearance: Adw.ResponseAppearance.SUGGESTED },
            { id: "destructive", label: "Delete", appearance: Adw.ResponseAppearance.DESTRUCTIVE },
        ]);

        expect(ref.current?.getResponseAppearance("default")).toBe(Adw.ResponseAppearance.DEFAULT);
        expect(ref.current?.getResponseAppearance("suggested")).toBe(Adw.ResponseAppearance.SUGGESTED);
        expect(ref.current?.getResponseAppearance("destructive")).toBe(Adw.ResponseAppearance.DESTRUCTIVE);
    });

    it("sets response enabled state", async () => {
        const ref = await renderResponses([
            { id: "enabled", label: "Enabled" },
            { id: "disabled", label: "Disabled", isEnabled: false },
        ]);

        expect(ref.current?.getResponseEnabled("enabled")).toBe(true);
        expect(ref.current?.getResponseEnabled("disabled")).toBe(false);
    });

    it("updates response label", async () => {
        const ref = createRef<Adw.AlertDialog>();

        function App({ label }: { label: string }) {
            return <AdwAlertDialog ref={ref} heading="Test" responses={[{ id: "test", label }]} />;
        }

        await render(<App label="Initial" />, options());
        expect(ref.current?.getResponseLabel("test")).toBe("Initial");
        await render(<App label="Updated" />, options());
        expect(ref.current?.getResponseLabel("test")).toBe("Updated");
    });

    it("updates response appearance", async () => {
        const ref = createRef<Adw.AlertDialog>();

        function App({ appearance }: { appearance: Adw.ResponseAppearance }) {
            return <AdwAlertDialog ref={ref} heading="Test" responses={[{ id: "test", label: "Test", appearance }]} />;
        }

        await render(<App appearance={Adw.ResponseAppearance.DEFAULT} />, options());
        expect(ref.current?.getResponseAppearance("test")).toBe(Adw.ResponseAppearance.DEFAULT);
        await render(<App appearance={Adw.ResponseAppearance.DESTRUCTIVE} />, options());
        expect(ref.current?.getResponseAppearance("test")).toBe(Adw.ResponseAppearance.DESTRUCTIVE);
    });

    it("updates response enabled state", async () => {
        const ref = createRef<Adw.AlertDialog>();

        function App({ isEnabled }: { isEnabled: boolean }) {
            return <AdwAlertDialog ref={ref} heading="Test" responses={[{ id: "test", label: "Test", isEnabled }]} />;
        }

        await render(<App isEnabled={true} />, options());
        expect(ref.current?.getResponseEnabled("test")).toBe(true);
        await render(<App isEnabled={false} />, options());
        expect(ref.current?.getResponseEnabled("test")).toBe(false);
    });

    it("removes responses when list shrinks", async () => {
        const ref = createRef<Adw.AlertDialog>();

        const { rerender } = await renderChildren(
            [
                { id: "always", label: "Always" },
                { id: "extra", label: "Extra" },
            ],
            buildAlertDialog(ref),
            options(),
        );

        expect(ref.current?.hasResponse("always")).toBe(true);
        expect(ref.current?.hasResponse("extra")).toBe(true);
        await rerender([{ id: "always", label: "Always" }]);
        expect(ref.current?.hasResponse("always")).toBe(true);
        expect(ref.current?.hasResponse("extra")).toBe(false);
    });

    it("handles inserting responses dynamically", async () => {
        const ref = createRef<Adw.AlertDialog>();

        const { rerender } = await renderChildren(
            [
                { id: "first", label: "First" },
                { id: "last", label: "Last" },
            ],
            buildAlertDialog(ref),
            options(),
        );

        expect(ref.current?.hasResponse("first")).toBe(true);
        expect(ref.current?.hasResponse("middle")).toBe(false);
        expect(ref.current?.hasResponse("last")).toBe(true);

        await rerender([
            { id: "first", label: "First" },
            { id: "middle", label: "Middle" },
            { id: "last", label: "Last" },
        ]);

        expect(ref.current?.hasResponse("first")).toBe(true);
        expect(ref.current?.hasResponse("middle")).toBe(true);
        expect(ref.current?.hasResponse("last")).toBe(true);
    });
});

describe("AlertDialog extra child", () => {
    it("exposes its response buttons when it has no children", async () => {
        const dialog = await renderAlertDialog();
        expect(dialog.hasResponse("cancel")).toBe(true);
        expect(dialog.hasResponse("ok")).toBe(true);
        expect(dialog.getExtraChild()).toBeNull();
        await expectButton(dialog, "Cancel");
        await expectButton(dialog, "OK");
    });

    it("keeps its heading and response buttons when it has children", async () => {
        const dialog = await renderAlertDialog(<GtkLabel>Extra content</GtkLabel>);
        expect(dialog.hasResponse("cancel")).toBe(true);
        expect(dialog.hasResponse("ok")).toBe(true);
        expect(dialog.getHeading()).toBe(HEADING);
        expect(within(dialog).getByText(HEADING)).toBeRooted();
        await expectButton(dialog, "Cancel");
        await expectButton(dialog, "OK");
    });

    it("routes its children to the extra child rather than the dialog child", async () => {
        const dialog = await renderAlertDialog(<GtkLabel>Extra content</GtkLabel>);
        const extraChild = dialog.getExtraChild();
        expect(dialog.getChild()).not.toBe(extraChild);
        expect(within(dialog).getByText("Extra content")).toBe(extraChild);
    });

    it("clears the extra child and closes when React unmounts the dialog", async () => {
        const ref = createRef<Adw.AlertDialog>();
        const { rerender } = await render(<ToggledAlert dialogRef={ref} isOpen={true} />);
        expect(screen.getByText("Extra content")).toBeRooted();
        await rerender(<ToggledAlert dialogRef={ref} isOpen={false} />);

        await waitFor(() => {
            expect(screen.queryByText("Extra content")).toBeNull();
            expect(screen.queryByText(HEADING)).toBeNull();
        });
    });

    it("swaps the extra child when the child element type changes", async () => {
        const ref = createRef<Adw.AlertDialog>();
        const { rerender } = await render(<SwappedAlert dialogRef={ref} isButton={false} />);
        const dialog = requireWidget(ref, "Alert dialog");
        const first = dialog.getExtraChild();
        expect(within(dialog).getByText("First")).toBe(first);
        await rerender(<SwappedAlert dialogRef={ref} isButton={true} />);
        const second = dialog.getExtraChild();
        expect(second).toBeInstanceOf(Gtk.Button);
        expect(second).not.toBe(first);
        expect(within(dialog).queryByText("First")).toBeNull();
        expect(within(dialog).getByText(HEADING)).toBeRooted();
        expect(dialog.hasResponse("ok")).toBe(true);
    });

    it("clears the extra child when the children go away and restores it when they return", async () => {
        const ref = createRef<Adw.AlertDialog>();
        const { rerender } = await render(<OptionalChildAlert dialogRef={ref} hasChildren={true} />);
        const dialog = requireWidget(ref, "Alert dialog");
        expect(dialog.getExtraChild()).toHaveTextContent("Extra content");
        await rerender(<OptionalChildAlert dialogRef={ref} hasChildren={false} />);
        expect(dialog.getExtraChild()).toBeNull();
        expect(within(dialog).getByText(HEADING)).toBeRooted();
        await expectButton(dialog, "OK");
        await rerender(<OptionalChildAlert dialogRef={ref} hasChildren={true} />);
        expect(within(dialog).getByText("Extra content")).toBe(dialog.getExtraChild());
    });

    it("leaves a plain AdwDialog setting its child from its children", async () => {
        const ref = createRef<Adw.Dialog>();

        await render(
            <InApp2>
                <AdwDialog ref={ref} title="Plain">
                    <GtkLabel>Plain content</GtkLabel>
                </AdwDialog>
            </InApp2>,
        );

        const dialog = requireWidget(ref, "Dialog");
        expect(within(dialog).getByText("Plain content")).toBe(dialog.getChild());
    });
});

describe("render - ColorDialogButton", () => {
    it("creates ColorDialogButton widget", async () => {
        const dialog = await renderDialogSlot(<GtkColorDialog />);
        expect(dialog).not.toBeNull();
        expect(dialog).toHaveObjectProperty("withAlpha", true);
    });

    it("creates ColorDialogButton with initial rgba", async () => {
        const ref = createRef<Gtk.ColorDialogButton>();
        const rgba = makeRgba(1, 0.5, 0.25, 1);
        await render(<GtkColorDialogButton ref={ref} rgba={rgba} />);
        expect(ref.current).not.toBeNull();
        const currentRgba = ref.current?.getRgba();
        expect(currentRgba?.red).toBeCloseTo(1);
        expect(currentRgba?.green).toBeCloseTo(0.5);
        expect(currentRgba?.blue).toBeCloseTo(0.25);
        expect(currentRgba?.alpha).toBeCloseTo(1);
    });

    it("updates rgba when prop changes", async () => {
        const ref = createRef<Gtk.ColorDialogButton>();

        function App({ color }: { color: Gdk.RGBA }) {
            return <GtkColorDialogButton ref={ref} rgba={color} />;
        }

        const initialColor = makeRgba(1, 0, 0, 1);
        await render(<App color={initialColor} />);
        const rgba1 = ref.current?.getRgba();
        expect(rgba1?.red).toBeCloseTo(1);
        expect(rgba1?.green).toBeCloseTo(0);
        const newColor = makeRgba(0, 1, 0, 1);
        await render(<App color={newColor} />);
        const rgba2 = ref.current?.getRgba();
        expect(rgba2?.red).toBeCloseTo(0);
        expect(rgba2?.green).toBeCloseTo(1);
    });

    it("sets dialog title", async () => {
        const dialog = await renderDialogSlot(<GtkColorDialog title="Pick a Color" />);
        expect(dialog).toHaveObjectProperty("title", "Pick a Color");
    });

    it("updates dialog title when the slot element changes", async () => {
        await expectDialogTitleTracksProp<Gtk.ColorDialogButton>((ref, dialogProps) => (
            <GtkColorDialogButton ref={ref} dialog={<GtkColorDialog {...dialogProps} />} />
        ));
    });

    it("sets dialog modal property", async () => {
        await expectDialogModalProp<Gtk.ColorDialogButton>((ref, dialogProps) => (
            <GtkColorDialogButton ref={ref} dialog={<GtkColorDialog {...dialogProps} />} />
        ));
    });

    it("sets dialog withAlpha property", async () => {
        const dialog = await renderDialogSlot(<GtkColorDialog withAlpha={false} />);
        expect(dialog).toHaveObjectProperty("withAlpha", false);
    });

    it("updates withAlpha when the slot element changes", async () => {
        const ref = createRef<Gtk.ColorDialogButton>();

        function App({ hasAlpha }: { hasAlpha: boolean }) {
            return <GtkColorDialogButton ref={ref} dialog={<GtkColorDialog withAlpha={hasAlpha} />} />;
        }

        await render(<App hasAlpha={true} />);
        expect(ref.current?.getDialog()).toHaveObjectProperty("withAlpha", true);
        await render(<App hasAlpha={false} />);
        expect(ref.current?.getDialog()).toHaveObjectProperty("withAlpha", false);
    });
});

describe("render - FontDialogButton", () => {
    it("creates FontDialogButton widget", async () => {
        const ref = createRef<Gtk.FontDialogButton>();
        await render(<GtkFontDialogButton ref={ref} dialog={<GtkFontDialog />} />);
        expect(ref.current?.getDialog()).not.toBeNull();
        expect(ref.current).toHaveObjectProperty("level", Gtk.FontLevel.FONT);
    });

    it("creates FontDialogButton with initial fontDesc", async () => {
        const ref = createRef<Gtk.FontDialogButton>();
        const fontDesc = Pango.FontDescription.fromString("Sans Bold 12");
        await render(<GtkFontDialogButton ref={ref} fontDesc={fontDesc} />);
        expect(ref.current).not.toBeNull();
        const currentFontDesc = ref.current?.getFontDesc();
        expect(currentFontDesc?.toString()).toBe("Sans Bold 12");
    });

    it("updates fontDesc when prop changes", async () => {
        const ref = createRef<Gtk.FontDialogButton>();

        function App({ font }: { font: Pango.FontDescription }) {
            return <GtkFontDialogButton ref={ref} fontDesc={font} />;
        }

        const initialFont = Pango.FontDescription.fromString("Sans 10");
        await render(<App font={initialFont} />);
        const fontDesc1 = ref.current?.getFontDesc();
        expect(fontDesc1?.toString()).toBe("Sans 10");
        const newFont = Pango.FontDescription.fromString("Serif Bold 14");
        await render(<App font={newFont} />);
        const fontDesc2 = ref.current?.getFontDesc();
        expect(fontDesc2?.toString()).toBe("Serif Bold 14");
    });

    it("sets dialog title", async () => {
        const ref = createRef<Gtk.FontDialogButton>();
        await render(<GtkFontDialogButton ref={ref} dialog={<GtkFontDialog title="Select Font" />} />);
        expect(ref.current).not.toBeNull();
        const dialog = ref.current?.getDialog();
        expect(dialog).toHaveObjectProperty("title", "Select Font");
    });

    it("updates dialog title when the slot element changes", async () => {
        await expectDialogTitleTracksProp<Gtk.FontDialogButton>((ref, dialogProps) => (
            <GtkFontDialogButton ref={ref} dialog={<GtkFontDialog {...dialogProps} />} />
        ));
    });

    it("sets dialog modal property", async () => {
        await expectDialogModalProp<Gtk.FontDialogButton>((ref, dialogProps) => (
            <GtkFontDialogButton ref={ref} dialog={<GtkFontDialog {...dialogProps} />} />
        ));
    });

    it("sets useFont property", async () => {
        const ref = createRef<Gtk.FontDialogButton>();
        await render(<GtkFontDialogButton ref={ref} useFont={true} />);
        expect(ref.current).not.toBeNull();
        expect(ref.current).toHaveObjectProperty("useFont", true);
    });

    it("updates useFont when prop changes", async () => {
        const ref = createRef<Gtk.FontDialogButton>();

        function App({ shouldUseFont }: { shouldUseFont: boolean }) {
            return <GtkFontDialogButton ref={ref} useFont={shouldUseFont} />;
        }

        await render(<App shouldUseFont={false} />);
        expect(ref.current).toHaveObjectProperty("useFont", false);
        await render(<App shouldUseFont={true} />);
        expect(ref.current).toHaveObjectProperty("useFont", true);
    });

    it("sets useSize property", async () => {
        const ref = createRef<Gtk.FontDialogButton>();
        await render(<GtkFontDialogButton ref={ref} useSize={true} />);
        expect(ref.current).not.toBeNull();
        expect(ref.current).toHaveObjectProperty("useSize", true);
    });

    it("updates useSize when prop changes", async () => {
        const ref = createRef<Gtk.FontDialogButton>();

        function App({ shouldUseSize }: { shouldUseSize: boolean }) {
            return <GtkFontDialogButton ref={ref} useSize={shouldUseSize} />;
        }

        await render(<App shouldUseSize={false} />);
        expect(ref.current).toHaveObjectProperty("useSize", false);
        await render(<App shouldUseSize={true} />);
        expect(ref.current).toHaveObjectProperty("useSize", true);
    });

    it("sets level property", async () => {
        const ref = createRef<Gtk.FontDialogButton>();
        await render(<GtkFontDialogButton ref={ref} level={Gtk.FontLevel.FAMILY} />);
        expect(ref.current).not.toBeNull();
        expect(ref.current).toHaveObjectProperty("level", Gtk.FontLevel.FAMILY);
    });

    it("updates level when prop changes", async () => {
        const ref = createRef<Gtk.FontDialogButton>();

        function App({ level }: { level: Gtk.FontLevel }) {
            return <GtkFontDialogButton ref={ref} level={level} />;
        }

        await render(<App level={Gtk.FontLevel.FONT} />);
        expect(ref.current).toHaveObjectProperty("level", Gtk.FontLevel.FONT);
        await render(<App level={Gtk.FontLevel.FEATURES} />);
        expect(ref.current).toHaveObjectProperty("level", Gtk.FontLevel.FEATURES);
    });
});
