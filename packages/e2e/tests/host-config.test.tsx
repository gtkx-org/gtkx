import * as Gtk from "@gtkx/gi/gtk";
import { GtkApplicationWindow, GtkBox, GtkButton, GtkFrame, GtkLabel } from "@gtkx/jsx/gtk";
import { render, screen, waitFor, within } from "@gtkx/testing";
import { renderChildren } from "@gtkx/testing/internal";
import { createRef, type ReactNode, type RefObject } from "react";
import { describe, expect, it } from "vitest";
import { createApplicationRenderer } from "./helpers/application-render.js";

const TEXT_SEGMENTS = ["First", "Second", "Third"];
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

const renderLabelBox = (text: string) =>
    render(
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkLabel>{text}</GtkLabel>
        </GtkBox>,
    );

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
    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>{shouldShowChild && <GtkLabel>Removable</GtkLabel>}</GtkBox>
    );
}

function RemovableChildFrame({ shouldShowChild }: { shouldShowChild: boolean }) {
    return <GtkFrame>{shouldShowChild && <GtkLabel>Child</GtkLabel>}</GtkFrame>;
}

function TextBox({ text }: { text: string }) {
    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkLabel>{text}</GtkLabel>
        </GtkBox>
    );
}

function OptionalTextBox({ shouldShowText }: { shouldShowText: boolean }) {
    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkLabel>{shouldShowText && "Removable Text"}</GtkLabel>
        </GtkBox>
    );
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

            await render(
                <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                    <GtkBox ref={containerRef}>
                        <GtkButton label="Inner Button" />
                        <GtkLabel>Inner Label</GtkLabel>
                    </GtkBox>
                    <GtkButton label="Outer Button" />
                </GtkBox>,
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

            await render(
                <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                    <GtkBox ref={section1Ref} orientation={Gtk.Orientation.VERTICAL}>
                        <GtkButton label="Title" />
                        <GtkButton label="Section 1 Content" />
                    </GtkBox>
                    <GtkBox ref={section2Ref} orientation={Gtk.Orientation.VERTICAL}>
                        <GtkButton label="Title" />
                        <GtkButton label="Section 2 Content" />
                    </GtkBox>
                </GtkBox>,
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
        await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkBox>
                    <GtkLabel>Error: File not found</GtkLabel>
                </GtkBox>
                <GtkBox>
                    <GtkLabel>Warning: Low memory</GtkLabel>
                </GtkBox>
                <GtkBox>
                    <GtkLabel>Info: Process complete</GtkLabel>
                </GtkBox>
            </GtkBox>,
        );

        const errorMessage = await screen.findByText(/^Error:/);
        expect(errorMessage).toBeDefined();
        const warningMessage = await screen.findByText(/^Warning:/);
        expect(warningMessage).toBeDefined();
        const allMessages = await screen.findAllByText(/Error:|Warning:|Info:/);
        expect(allMessages).toHaveLength(3);
    });
});

describe("host-config - text restrictions", () => {
    it("throws for text outside a label or text buffer", async () => {
        await expect(render(<GtkBox orientation={Gtk.Orientation.VERTICAL}>nope</GtkBox>)).rejects.toThrow(
            /must be rendered within a <GtkLabel> or <GtkTextBuffer>/,
        );
    });

    it("throws for text under a single-child widget", async () => {
        await expect(render(<GtkFrame>nope</GtkFrame>)).rejects.toThrow(
            /must be rendered within a <GtkLabel> or <GtkTextBuffer>/,
        );
    });
});
