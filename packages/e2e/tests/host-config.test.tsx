import * as Gtk from "@gtkx/gi/gtk";
import {
    GtkAdjustment,
    GtkApplicationWindow,
    GtkBox,
    GtkButton,
    GtkFrame,
    GtkLabel,
    GtkPaned,
    GtkStack,
    GtkStackPage,
} from "@gtkx/jsx/gtk";
import { render, screen, waitFor, within } from "@gtkx/testing";
import { renderChildren } from "@gtkx/testing/internal";
import { createRef, type ReactNode, type RefObject } from "react";
import { describe, expect, it } from "vitest";
import { createApplicationRenderer } from "./helpers/application-render.js";

const TEXT_SEGMENTS = ["First", "Second", "Third"];
const TEXT_RESTRICTION = /must be rendered within a <GtkLabel> or <GtkTextBuffer>/;
const renderApplication = createApplicationRenderer("org.gtkx.hostconfigtest");

const getLabelTexts = (boxRef: RefObject<Gtk.Box | null>): string[] => {
    const box = boxRef.current;

    if (box === null) {
        throw new Error("expected the box ref to be assigned");
    }

    return within(box)
        .getAllByRole(Gtk.AccessibleRole.LABEL, { as: Gtk.Label })
        .map((widget) => widget.getLabel());
};

const titledWindows = (titles: string[]): ReactNode =>
    titles.map((title) => <GtkApplicationWindow key={title} title={title} />);

const verticalBox = (children: ReactNode): ReactNode => (
    <GtkBox orientation={Gtk.Orientation.VERTICAL}>{children}</GtkBox>
);

const renderVerticalBox = (children: ReactNode) => render(verticalBox(children));
const renderLabelBox = (text: string) => renderVerticalBox(<GtkLabel>{text}</GtkLabel>);

const expectRenderToThrow = async (element: ReactNode, expected: RegExp | string): Promise<void> => {
    await expect(render(element)).rejects.toThrow(expected);
};

const buildLabelBox = (boxRef: RefObject<Gtk.Box | null>) => (items: string[]) => (
    <GtkBox ref={boxRef} orientation={Gtk.Orientation.VERTICAL}>
        {items.map((item) => (
            <GtkLabel key={item}>{item}</GtkLabel>
        ))}
    </GtkBox>
);

const renderOrderedLabelBox = async () => {
    const boxRef = createRef<Gtk.Box>();
    const { rerender } = await renderChildren(["A", "B", "C"], buildLabelBox(boxRef));
    expect(getLabelTexts(boxRef)).toEqual(["A", "B", "C"]);

    return { boxRef, rerender };
};

function RemovableChildBox({ shouldShowChild }: { shouldShowChild: boolean }) {
    return verticalBox(shouldShowChild && <GtkLabel>Removable</GtkLabel>);
}

function RemovableChildFrame({ shouldShowChild }: { shouldShowChild: boolean }) {
    return <GtkFrame>{shouldShowChild && <GtkLabel>Child</GtkLabel>}</GtkFrame>;
}

function TextBox({ text }: { text: string }) {
    return verticalBox(<GtkLabel>{text}</GtkLabel>);
}

function OptionalTextBox({ shouldShowText }: { shouldShowText: boolean }) {
    return verticalBox(<GtkLabel>{shouldShowText && "Removable Text"}</GtkLabel>);
}

describe("host-config - children (1)", () => {
    describe("adding children", () => {
        it("appends child to appendable widget (Box)", async () => {
            await renderLabelBox("Child");
            const label = await screen.findByText("Child");
            expect(label).toBeDefined();
        });

        it("sets child on single-child widget", async () => {
            await render(
                <GtkFrame>
                    <GtkLabel>Single Child</GtkLabel>
                </GtkFrame>,
            );

            const label = await screen.findByText("Single Child");
            expect(label).toBeDefined();
        });
    });
});

describe("host-config - children (2)", () => {
    describe("removing children", () => {
        it("removes child from parent", async () => {
            const { rerender } = await render(<RemovableChildBox shouldShowChild={true} />);
            await screen.findByText("Removable");
            await rerender(<RemovableChildBox shouldShowChild={false} />);
            expect(screen.queryByText("Removable")).toBeNull();
        });

        it("clears child on single-child widget", async () => {
            const { rerender } = await render(<RemovableChildFrame shouldShowChild={true} />);
            await screen.findByText("Child");
            await rerender(<RemovableChildFrame shouldShowChild={false} />);
            expect(screen.queryByText("Child")).toBeNull();
        });
    });
});

describe("host-config - children (3)", () => {
    describe("inserting children", () => {
        it("inserts child before sibling", async () => {
            const boxRef = createRef<Gtk.Box>();
            const { rerender } = await renderChildren(["A", "C"], buildLabelBox(boxRef));
            expect(getLabelTexts(boxRef)).toEqual(["A", "C"]);
            await rerender(["A", "B", "C"]);
            expect(getLabelTexts(boxRef)).toEqual(["A", "B", "C"]);
        });

        it("falls back to append when before not found", async () => {
            const boxRef = createRef<Gtk.Box>();
            const { rerender } = await renderChildren(["A", "B"], buildLabelBox(boxRef));
            await rerender(["A", "B", "C"]);
            expect(getLabelTexts(boxRef)).toEqual(["A", "B", "C"]);
        });
    });
});

describe("host-config - children (4)", () => {
    describe("root level widgets", () => {
        it("renders root level window", async () => {
            await renderApplication(<GtkApplicationWindow title="Root Container" />);
            expect(await screen.findByRole(Gtk.AccessibleRole.WINDOW, { name: "Root Container" })).toBeDefined();
        });

        it("removes root level window", async () => {
            const { rerender } = await renderApplication(<GtkApplicationWindow title="Window" />);
            expect(await screen.findByRole(Gtk.AccessibleRole.WINDOW, { name: "Window" })).toBeDefined();
            await rerender(null);

            await waitFor(() => {
                expect(screen.queryByRole(Gtk.AccessibleRole.WINDOW, { name: "Window" })).toBeNull();
            });
        });

        it("inserts root level window before sibling", async () => {
            const { rerender } = await renderApplication(titledWindows(["First"]));
            await rerender(titledWindows(["Second", "First"]));
            expect(await screen.findAllByRole(Gtk.AccessibleRole.WINDOW)).toHaveLength(2);
        });
    });
});

describe("host-config - children (5)", () => {
    describe("child ordering", () => {
        it("maintains correct order after multiple operations", async () => {
            const { boxRef, rerender } = await renderOrderedLabelBox();
            await rerender(["A", "D", "B", "C"]);
            expect(getLabelTexts(boxRef)).toEqual(["A", "D", "B", "C"]);
            await rerender(["D", "C"]);
            expect(getLabelTexts(boxRef)).toEqual(["D", "C"]);
        });

        it("handles reordering via key changes", async () => {
            const { boxRef, rerender } = await renderOrderedLabelBox();
            await rerender(["C", "B", "A"]);
            expect(getLabelTexts(boxRef)).toEqual(["C", "B", "A"]);
        });
    });
});

describe("host-config - children (6)", () => {
    describe("scoped queries with within (1)", () => {
        it("queries within a specific container", async () => {
            const containerRef = createRef<Gtk.Box>();

            await renderVerticalBox(
                <>
                    <GtkBox ref={containerRef}>
                        <GtkButton label="Inner Button" />
                        <GtkLabel>Inner Label</GtkLabel>
                    </GtkBox>
                    <GtkButton label="Outer Button" />
                </>,
            );

            const container = containerRef.current as Gtk.Box;
            const withinContainer = within(container);
            const innerButton = await withinContainer.findByRole(Gtk.AccessibleRole.BUTTON);
            expect(innerButton).toBeDefined();
            const buttons = await screen.findAllByRole(Gtk.AccessibleRole.BUTTON);
            expect(buttons).toHaveLength(2);
            const innerButtons = await withinContainer.findAllByRole(Gtk.AccessibleRole.BUTTON);
            expect(innerButtons).toHaveLength(1);
        });
    });
});

describe("host-config - children (7)", () => {
    describe("scoped queries with within (2)", () => {
        it("finds text within specific parent", async () => {
            const section1Ref = createRef<Gtk.Box>();
            const section2Ref = createRef<Gtk.Box>();

            await renderVerticalBox(
                <>
                    <GtkBox ref={section1Ref} orientation={Gtk.Orientation.VERTICAL}>
                        <GtkButton label="Title" />
                        <GtkButton label="Section 1 Content" />
                    </GtkBox>
                    <GtkBox ref={section2Ref} orientation={Gtk.Orientation.VERTICAL}>
                        <GtkButton label="Title" />
                        <GtkButton label="Section 2 Content" />
                    </GtkBox>
                </>,
            );

            const section1 = within(section1Ref.current as Gtk.Box);
            const section2 = within(section2Ref.current as Gtk.Box);
            const s1Content = await section1.findByText("Section 1 Content");
            expect(s1Content).toBeDefined();
            const s2Content = await section2.findByText("Section 2 Content");
            expect(s2Content).toBeDefined();
            const allTitles = await screen.findAllByText("Title");
            expect(allTitles).toHaveLength(2);
        });
    });
});

describe("host-config - text instances (1)", () => {
    it("renders text inside a label", async () => {
        await renderLabelBox("Hello World");
        const label = await screen.findByText("Hello World");
        expect(label).toBeDefined();
    });

    it("updates label text when string changes", async () => {
        const { rerender } = await render(<TextBox text="Initial" />);
        expect(await screen.findByText("Initial")).toBeDefined();
        await rerender(<TextBox text="Updated" />);
        expect(await screen.findByText("Updated")).toBeDefined();
    });

    it("handles empty string", async () => {
        const ref = createRef<Gtk.Box>();

        await render(
            <GtkBox ref={ref} orientation={Gtk.Orientation.VERTICAL}>

            </GtkBox>,
        );

        expect(within(ref.current as Gtk.Box).queryByRole(Gtk.AccessibleRole.LABEL)).toBeNull();
    });

    it("handles unicode text", async () => {
        await renderLabelBox("你好世界 🌍 مرحبا");
        const unicodeLabel = await screen.findByText("你好世界 🌍 مرحبا");
        expect(unicodeLabel).toBeDefined();
    });
});

describe("host-config - text instances (2)", () => {
    it("clears label text when text child removed", async () => {
        const { rerender } = await render(<OptionalTextBox shouldShowText={true} />);
        await screen.findByText("Removable Text");
        await rerender(<OptionalTextBox shouldShowText={false} />);
        expect(screen.queryByText("Removable Text")).toBeNull();
    });

    it("concatenates multiple text children in order", async () => {
        await render(
            <GtkLabel>
                {TEXT_SEGMENTS[0]}
                {TEXT_SEGMENTS[1]}
                {TEXT_SEGMENTS[2]}
            </GtkLabel>,
        );

        expect(await screen.findByText("FirstSecondThird")).toBeDefined();
    });

    it("finds text with regex patterns", async () => {
        await renderVerticalBox(
            <>
                <GtkBox>
                    <GtkLabel>Error: File not found</GtkLabel>
                </GtkBox>
                <GtkBox>
                    <GtkLabel>Warning: Low memory</GtkLabel>
                </GtkBox>
                <GtkBox>
                    <GtkLabel>Info: Process complete</GtkLabel>
                </GtkBox>
            </>,
        );

        const errorMessage = await screen.findByText(/^Error:/);
        expect(errorMessage).toBeDefined();
        const warningMessage = await screen.findByText(/^Warning:/);
        expect(warningMessage).toBeDefined();
        const allMessages = await screen.findAllByText(/Error:|Warning:|Info:/);
        expect(allMessages).toHaveLength(3);
    });
});

describe("host-config - child restrictions", () => {
    it("throws for a child no behavior claims", async () => {
        await expectRenderToThrow(
            verticalBox(<GtkAdjustment value={0} lower={0} upper={100} />),
            "<GtkAdjustment> cannot be a child of <GtkBox>",
        );
    });

    it("names every remedy for an unclaimed child", async () => {
        await expectRenderToThrow(
            <GtkFrame>
                <GtkAdjustment value={0} lower={0} upper={100} />
            </GtkFrame>,
            /<GtkFrame> prop that takes it[\s\S]+createPortal[\s\S]+defineElements from "@gtkx\/react\/config"/,
        );
    });

    it("names the unclaimed object rather than the lazy page holding it", async () => {
        await expectRenderToThrow(
            <GtkStack>
                <GtkStackPage name="page">
                    <GtkAdjustment value={0} lower={0} upper={100} />
                </GtkStackPage>
            </GtkStack>,
            "<GtkAdjustment> cannot be a child of <GtkStack>",
        );
    });

    it("throws for a widget a named-slot container takes only through a prop", async () => {
        await expectRenderToThrow(
            <GtkPaned>
                <GtkLabel>Start</GtkLabel>
            </GtkPaned>,
            "<GtkLabel> cannot be a child of <GtkPaned>",
        );
    });

    it("sets a slot prop child no behavior claims as a property", async () => {
        const panedRef = createRef<Gtk.Paned>();
        const labelRef = createRef<Gtk.Label>();
        await render(<GtkPaned ref={panedRef} startChild={<GtkLabel ref={labelRef}>Start</GtkLabel>} />);
        expect(labelRef.current).not.toBeNull();
        expect(panedRef.current?.getStartChild()).toBe(labelRef.current);
    });
});

describe("host-config - text restrictions", () => {
    it("throws for text outside a label or text buffer", async () => {
        await expectRenderToThrow(verticalBox("nope"), TEXT_RESTRICTION);
    });

    it("throws for text under a single-child widget", async () => {
        await expectRenderToThrow(<GtkFrame>nope</GtkFrame>, TEXT_RESTRICTION);
    });
});
