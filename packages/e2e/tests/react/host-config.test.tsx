import type { ReactNode, RefObject } from "react";
import * as Adw from "@gtkx/gi/adw";
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwCarousel, AdwPreferencesGroup, AdwSwitchRow, AdwTabPage, AdwTabView } from "@gtkx/jsx/adw";
import {
    GtkAdjustment,
    GtkApplication,
    GtkApplicationWindow,
    GtkBox,
    GtkButton,
    GtkFrame,
    GtkLabel,
    GtkPaned,
    GtkStack,
    GtkStackPage,
} from "@gtkx/jsx/gtk";
import { rootElement } from "@gtkx/react";
import { getWidgetText, render, screen, waitFor, within } from "@gtkx/testing";
import { renderChildren } from "@gtkx/testing/internal";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { createApplicationRenderer } from "../helpers/application-render.js";
import { buildPlainNotebook } from "../helpers/notebook-render.js";

type ReorderCase<Container> = {
    build: (ref: RefObject<Container | null>) => (items: string[]) => ReactNode;
    read: (container: Container) => string[];
};

const TEXT_SEGMENTS = ["First", "Second", "Third"];
const TEXT_RESTRICTION = /must be rendered within a <GtkLabel> or <GtkTextBuffer>/;
const renderApplication = createApplicationRenderer("org.gtkx.hostconfigtest");
const CAROUSEL_CASE: ReorderCase<Adw.Carousel> = { build: buildCarousel, read: carouselLabels };
const NOTEBOOK_CASE: ReorderCase<Gtk.Notebook> = { build: buildPlainNotebook, read: tabLabels };
const TAB_VIEW_CASE: ReorderCase<Adw.TabView> = { build: buildTabView, read: tabViewTitles };

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

function carouselLabels(carousel: Adw.Carousel): string[] {
    const labels: string[] = [];

    for (let index = 0; index < carousel.getNPages(); index += 1) {
        const page = carousel.getNthPage(index);

        if (page instanceof Gtk.Label) {
            labels.push(page.getText());
        }
    }

    return labels;
}

function buildCarousel(ref: RefObject<Adw.Carousel | null>) {
    return (items: string[]) => (
        <AdwCarousel ref={ref}>
            {items.map((text) => (
                <GtkLabel key={text}>{text}</GtkLabel>
            ))}
        </AdwCarousel>
    );
}

function tabLabels(notebook: Gtk.Notebook): string[] {
    return within(notebook)
        .getAllByRole(Gtk.AccessibleRole.TAB)
        .map((tab) => getWidgetText(within(tab).getByRole(Gtk.AccessibleRole.LABEL)) ?? "");
}

function tabViewTitles(view: Adw.TabView): string[] {
    const titles: string[] = [];

    for (let index = 0; index < view.getNPages(); index += 1) {
        titles.push(view.getNthPage(index).getTitle());
    }

    return titles;
}

function buildTabView(ref: RefObject<Adw.TabView | null>) {
    return (items: string[]) => (
        <AdwTabView ref={ref}>
            {items.map((title) => (
                <AdwTabPage key={title} title={title}>
                    <GtkLabel>{title}</GtkLabel>
                </AdwTabPage>
            ))}
        </AdwTabView>
    );
}

async function reorderAndRead<Container>(
    { build, read }: ReorderCase<Container>,
    initial: string[],
    next: string[],
): Promise<string[]> {
    const ref = createRef<Container>();
    const { rerender } = await renderChildren(initial, build(ref));
    await rerender(next);

    return read(ref.current as Container);
}

function* walk(widget: Gtk.Widget): IterableIterator<Gtk.Widget> {
    let child = widget.getFirstChild();

    while (child) {
        yield child;
        yield* walk(child);
        child = child.getNextSibling();
    }
}

const getRowTitles = (ref: RefObject<Adw.PreferencesGroup | null>): string[] => {
    const group = ref.current;

    if (group === null) {
        throw new Error("expected the preferences group ref to be assigned");
    }

    const titles: string[] = [];

    for (const widget of walk(group)) {
        if (widget instanceof Adw.PreferencesRow) {
            titles.push(widget.getTitle());
        }
    }

    return titles;
};

const buildGroup = (ref: RefObject<Adw.PreferencesGroup | null>) => (items: string[]) => (
    <AdwPreferencesGroup ref={ref}>
        {items.map((title) => (
            <AdwSwitchRow key={title} title={title} />
        ))}
    </AdwPreferencesGroup>
);

const expectRebuiltTitles = async (initial: string[], rebuilt: string[]): Promise<void> => {
    const ref = createRef<Adw.PreferencesGroup>();
    const { rerender } = await renderChildren(initial, buildGroup(ref));
    await rerender(rebuilt);
    expect(getRowTitles(ref)).toEqual(rebuilt);
};

describe("host-config - children (1)", () => {
    describe("adding children", () => {
        it("appends child to appendable widget (Box)", async () => {
            await renderLabelBox("Child");
            const label = await screen.findByText("Child");
            expect(label).toBeRooted();
        });

        it("sets child on single-child widget", async () => {
            await render(
                <GtkFrame>
                    <GtkLabel>Single Child</GtkLabel>
                </GtkFrame>,
            );

            const label = await screen.findByText("Single Child");
            expect(label).toBeRooted();
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
            await screen.findByRole(Gtk.AccessibleRole.WINDOW, { name: "Root Container" });
            expect(await screen.findAllByRole(Gtk.AccessibleRole.WINDOW)).toHaveLength(1);
        });

        it("removes root level window", async () => {
            const { rerender } = await renderApplication(<GtkApplicationWindow title="Window" />);
            await screen.findByRole(Gtk.AccessibleRole.WINDOW, { name: "Window" });
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
            expect(innerButton).toHaveTextContent("Inner Button");
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
            const s2Content = await section2.findByText("Section 2 Content");
            expect(s1Content).toAppearBefore(s2Content);
            const allTitles = await screen.findAllByText("Title");
            expect(allTitles).toHaveLength(2);
        });
    });
});

describe("host-config - text instances (1)", () => {
    it("renders text inside a label", async () => {
        await renderLabelBox("Hello World");
        const label = await screen.findByText("Hello World");
        expect(label).toBeRooted();
    });

    it("updates label text when string changes", async () => {
        const { rerender } = await render(<TextBox text="Initial" />);
        expect(await screen.findByText("Initial")).toHaveTextContent(/^Initial$/);
        await rerender(<TextBox text="Updated" />);
        expect(await screen.findByText("Updated")).toHaveTextContent(/^Updated$/);
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
        expect(unicodeLabel).toHaveTextContent("你好世界 🌍 مرحبا");
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

        expect(await screen.findByText("FirstSecondThird")).toHaveTextContent(/^FirstSecondThird$/);
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
        expect(errorMessage).toHaveTextContent("Error: File not found");
        const warningMessage = await screen.findByText(/^Warning:/);
        expect(warningMessage).toHaveTextContent("Warning: Low memory");
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

describe("reorder op - containers with native index reorder (1)", () => {
    describe("AdwCarousel", () => {
        it("moves a child to the front", async () => {
            expect(await reorderAndRead(CAROUSEL_CASE, ["A", "B", "C"], ["C", "A", "B"])).toEqual(["C", "A", "B"]);
        });

        it("moves a child to the back", async () => {
            expect(await reorderAndRead(CAROUSEL_CASE, ["A", "B", "C"], ["B", "C", "A"])).toEqual(["B", "C", "A"]);
        });

        it("reverses order", async () => {
            expect(await reorderAndRead(CAROUSEL_CASE, ["A", "B", "C", "D"], ["D", "C", "B", "A"])).toEqual([
                "D",
                "C",
                "B",
                "A",
            ]);
        });

        it("preserves the child instance across a reorder", async () => {
            const ref = createRef<Adw.Carousel>();
            const { rerender } = await renderChildren(["A", "B", "C"], buildCarousel(ref));
            const carousel = ref.current as Adw.Carousel;
            const before = carousel.getNthPage(0);
            await rerender(["B", "C", "A"]);
            const moved = carouselLabels(carousel).indexOf("A");
            expect(carousel.getNthPage(moved)).toBe(before);
        });
    });
});

describe("reorder op - containers with native index reorder (2)", () => {
    describe("GtkNotebook", () => {
        it("moves a page to the front", async () => {
            expect(await reorderAndRead(NOTEBOOK_CASE, ["A", "B", "C"], ["C", "A", "B"])).toEqual(["C", "A", "B"]);
        });

        it("moves a page to the back", async () => {
            expect(await reorderAndRead(NOTEBOOK_CASE, ["A", "B", "C"], ["B", "C", "A"])).toEqual(["B", "C", "A"]);
        });

        it("reverses order", async () => {
            expect(await reorderAndRead(NOTEBOOK_CASE, ["A", "B", "C", "D"], ["D", "C", "B", "A"])).toEqual([
                "D",
                "C",
                "B",
                "A",
            ]);
        });
    });
});

describe("reorder op - containers with native index reorder (3)", () => {
    describe("AdwTabView (page-based reorder via adopted arg)", () => {
        it("moves a page to the front", async () => {
            expect(await reorderAndRead(TAB_VIEW_CASE, ["A", "B", "C"], ["C", "A", "B"])).toEqual(["C", "A", "B"]);
        });

        it("reverses order", async () => {
            expect(await reorderAndRead(TAB_VIEW_CASE, ["A", "B", "C", "D"], ["D", "C", "B", "A"])).toEqual([
                "D",
                "C",
                "B",
                "A",
            ]);
        });

        it("removes a middle page via closePage", async () => {
            expect(await reorderAndRead(TAB_VIEW_CASE, ["A", "B", "C"], ["A", "C"])).toEqual(["A", "C"]);
        });

        it("reorders and removes together", async () => {
            expect(await reorderAndRead(TAB_VIEW_CASE, ["A", "B", "C", "D"], ["D", "A", "C"])).toEqual([
                "D",
                "A",
                "C",
            ]);
        });
    });
});

describe("reinsert fallback - add/remove container without insert", () => {
    it("removes a middle row", async () => {
        await expectRebuiltTitles(["A", "B", "C"], ["A", "C"]);
    });

    it("inserts a row in the middle via full rebuild", async () => {
        await expectRebuiltTitles(["A", "B", "C"], ["A", "X", "B", "C"]);
    });

    it("reverses row order via full rebuild", async () => {
        await expectRebuiltTitles(["A", "B", "C"], ["C", "B", "A"]);
    });

    it("removes and reorders together via full rebuild", async () => {
        await expectRebuiltTitles(["A", "B", "C", "D"], ["D", "A", "C"]);
    });
});

describe("Root.unmount", () => {
    it("shuts the application down when the unmounted tree contains the application component", async () => {
        const appRef = createRef<Gtk.Application>();

        const { unmount } = await render(
            <GtkApplication
                ref={appRef}
                applicationId="org.gtkx.render-unmount"
                flags={Gio.ApplicationFlags.NON_UNIQUE}
            >
                <GtkApplicationWindow defaultWidth={50} defaultHeight={50} />
            </GtkApplication>,
            { container: rootElement },
        );

        const app = appRef.current;

        if (!app) {
            throw new Error("application was not captured");
        }

        const shutdownHandler = vi.fn();
        app.on("shutdown", shutdownHandler);
        expect(app.getIsRegistered()).toBe(true);
        await unmount();
        expect(shutdownHandler).toHaveBeenCalledTimes(1);
        expect(app.getIsRegistered()).toBe(false);
    });
});
