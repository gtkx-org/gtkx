import { AccessibleRole } from "@gtkx/ffi/gtk";
import { cleanup, render, screen, userEvent, waitFor } from "@gtkx/testing";
import { afterEach, describe, expect, it } from "vitest";
import { boxDemo } from "../src/demos/layout/box.js";
import { centerBoxDemo } from "../src/demos/layout/center-box.js";
import { framesDemo } from "../src/demos/layout/frames.js";
import { gridDemo } from "../src/demos/layout/grid.js";
import { overlayDemo } from "../src/demos/layout/overlay.js";
import { panesDemo } from "../src/demos/layout/panes.js";
import { stackDemo } from "../src/demos/layout/stack.js";

describe("Layout Demos", () => {
    afterEach(async () => {
        await cleanup();
    });

    describe("box demo", () => {
        const BoxDemo = boxDemo.component;

        it("renders box layout title", async () => {
            await render(<BoxDemo />);

            const title = await screen.findByText("Box Layout");
            expect(title).toBeDefined();
        });

        it("renders horizontal box section", async () => {
            await render(<BoxDemo />);

            const heading = await screen.findByText("Horizontal Box");
            expect(heading).toBeDefined();
        });

        it("renders vertical box section", async () => {
            await render(<BoxDemo />);

            const heading = await screen.findByText("Vertical Box");
            expect(heading).toBeDefined();
        });

        it("renders buttons in horizontal box", async () => {
            await render(<BoxDemo />);

            const firstBtn = await screen.findByRole(AccessibleRole.BUTTON, { name: "First" });
            const secondBtn = await screen.findByRole(AccessibleRole.BUTTON, { name: "Second" });
            const thirdBtn = await screen.findByRole(AccessibleRole.BUTTON, { name: "Third" });

            expect(firstBtn).toBeDefined();
            expect(secondBtn).toBeDefined();
            expect(thirdBtn).toBeDefined();
        });

        it("renders buttons in vertical box", async () => {
            await render(<BoxDemo />);

            const topBtn = await screen.findByRole(AccessibleRole.BUTTON, { name: "Top" });
            const middleBtn = await screen.findByRole(AccessibleRole.BUTTON, { name: "Middle" });
            const bottomBtn = await screen.findByRole(AccessibleRole.BUTTON, { name: "Bottom" });

            expect(topBtn).toBeDefined();
            expect(middleBtn).toBeDefined();
            expect(bottomBtn).toBeDefined();
        });

        it("renders expand and fill section", async () => {
            await render(<BoxDemo />);

            const heading = await screen.findByText("Expand and Fill");
            const expandBtn = await screen.findByRole(AccessibleRole.BUTTON, { name: "Expand" });

            expect(heading).toBeDefined();
            expect(expandBtn).toBeDefined();
        });

        it("renders alignment section with multiple buttons", async () => {
            await render(<BoxDemo />);

            const heading = await screen.findByText("Alignment");
            const startBtn = await screen.findByRole(AccessibleRole.BUTTON, { name: "Start" });
            const centerBtn = await screen.findByRole(AccessibleRole.BUTTON, { name: "Center" });
            const endBtn = await screen.findByRole(AccessibleRole.BUTTON, { name: "End" });
            const fillBtn = await screen.findByRole(AccessibleRole.BUTTON, { name: "Fill" });

            expect(heading).toBeDefined();
            expect(startBtn).toBeDefined();
            expect(centerBtn).toBeDefined();
            expect(endBtn).toBeDefined();
            expect(fillBtn).toBeDefined();
        });

        it("renders homogeneous section", async () => {
            await render(<BoxDemo />);

            const heading = await screen.findByText("Homogeneous");
            const description = await screen.findByText("When homogeneous is true, all children get the same size.");

            expect(heading).toBeDefined();
            expect(description).toBeDefined();
        });

        it("renders homogeneous buttons with varying labels", async () => {
            await render(<BoxDemo />);

            const shortBtn = await screen.findByRole(AccessibleRole.BUTTON, { name: "Short" });
            const mediumBtn = await screen.findByRole(AccessibleRole.BUTTON, { name: "Medium Text" });
            const longBtn = await screen.findByRole(AccessibleRole.BUTTON, { name: "Longer Button Text" });

            expect(shortBtn).toBeDefined();
            expect(mediumBtn).toBeDefined();
            expect(longBtn).toBeDefined();
        });
    });

    describe("center box demo", () => {
        const CenterBoxDemo = centerBoxDemo.component;

        it("renders center box title", async () => {
            await render(<CenterBoxDemo />);

            const title = await screen.findByText("Center Box");
            expect(title).toBeDefined();
        });

        it("renders horizontal center box section", async () => {
            await render(<CenterBoxDemo />);

            const heading = await screen.findByText("Horizontal CenterBox");
            const description = await screen.findByText(
                "CenterBox has three slots: start, center, and end. The center widget is always centered.",
            );

            expect(heading).toBeDefined();
            expect(description).toBeDefined();
        });

        it("renders start, center, and end widgets", async () => {
            await render(<CenterBoxDemo />);

            const startBtn = await screen.findByRole(AccessibleRole.BUTTON, { name: "Start" });
            const centerLabel = await screen.findByText("Center");
            const endBtn = await screen.findByRole(AccessibleRole.BUTTON, { name: "End" });

            expect(startBtn).toBeDefined();
            expect(centerLabel).toBeDefined();
            expect(endBtn).toBeDefined();
        });

        it("renders toolbar example", async () => {
            await render(<CenterBoxDemo />);

            const heading = await screen.findByText("Toolbar Example");
            const docTitle = await screen.findByText("Document.txt");
            const backBtn = await screen.findByRole(AccessibleRole.BUTTON, { name: "Back" });
            const forwardBtn = await screen.findByRole(AccessibleRole.BUTTON, { name: "Forward" });
            const shareBtn = await screen.findByRole(AccessibleRole.BUTTON, { name: "Share" });
            const menuBtn = await screen.findByRole(AccessibleRole.BUTTON, { name: "Menu" });

            expect(heading).toBeDefined();
            expect(docTitle).toBeDefined();
            expect(backBtn).toBeDefined();
            expect(forwardBtn).toBeDefined();
            expect(shareBtn).toBeDefined();
            expect(menuBtn).toBeDefined();
        });

        it("renders vertical center box section", async () => {
            await render(<CenterBoxDemo />);

            const heading = await screen.findByText("Vertical CenterBox");
            const topLabel = await screen.findByText("Top");
            const bottomLabel = await screen.findByText("Bottom");
            const centeredBtn = await screen.findByRole(AccessibleRole.BUTTON, { name: "Centered Content" });

            expect(heading).toBeDefined();
            expect(topLabel).toBeDefined();
            expect(bottomLabel).toBeDefined();
            expect(centeredBtn).toBeDefined();
        });
    });

    describe("grid demo", () => {
        const GridDemo = gridDemo.component;

        it("renders grid layout title", async () => {
            await render(<GridDemo />);

            const title = await screen.findByText("Grid Layout");
            expect(title).toBeDefined();
        });

        it("renders basic grid section", async () => {
            await render(<GridDemo />);

            const heading = await screen.findByText("Basic Grid");
            const description = await screen.findByText(
                "Grid arranges widgets in rows and columns. Use Grid.Child to specify position and span.",
            );

            expect(heading).toBeDefined();
            expect(description).toBeDefined();
        });

        it("renders grid position buttons", async () => {
            await render(<GridDemo />);

            const positions = ["(0,0)", "(1,0)", "(2,0)", "(2,1)"];
            for (const pos of positions) {
                const btn = await screen.findByRole(AccessibleRole.BUTTON, { name: pos });
                expect(btn).toBeDefined();
            }

            const duplicatePositions = ["(0,1)", "(1,1)"];
            for (const pos of duplicatePositions) {
                const btns = await screen.findAllByRole(AccessibleRole.BUTTON, { name: pos });
                expect(btns.length).toBeGreaterThanOrEqual(1);
            }
        });

        it("renders column and row spanning section", async () => {
            await render(<GridDemo />);

            const heading = await screen.findByText("Column and Row Spanning");
            const description = await screen.findByText(
                "Widgets can span multiple columns or rows using columnSpan and rowSpan props.",
            );

            expect(heading).toBeDefined();
            expect(description).toBeDefined();
        });

        it("renders spanning buttons", async () => {
            await render(<GridDemo />);

            const colSpanBtn = await screen.findByRole(AccessibleRole.BUTTON, { name: "Spans 2 columns" });
            const rowSpanBtn = await screen.findByRole(AccessibleRole.BUTTON, { name: "Spans 2 rows" });

            expect(colSpanBtn).toBeDefined();
            expect(rowSpanBtn).toBeDefined();
        });

        it("renders form layout section", async () => {
            await render(<GridDemo />);

            const heading = await screen.findByText("Form Layout");
            const description = await screen.findByText(
                "Grid is great for form layouts with labels and inputs aligned.",
            );
            const nameLabel = await screen.findByText("Name:");
            const emailLabel = await screen.findByText("Email:");
            const submitBtn = await screen.findByRole(AccessibleRole.BUTTON, { name: "Submit" });

            expect(heading).toBeDefined();
            expect(description).toBeDefined();
            expect(nameLabel).toBeDefined();
            expect(emailLabel).toBeDefined();
            expect(submitBtn).toBeDefined();
        });
    });

    describe("overlay demo", () => {
        const OverlayDemo = overlayDemo.component;

        it("renders overlay title", async () => {
            await render(<OverlayDemo />);

            const title = await screen.findByText("Overlay");
            expect(title).toBeDefined();
        });

        it("renders about overlay description", async () => {
            await render(<OverlayDemo />);

            const description = await screen.findByText(
                "Overlay stacks widgets on top of each other. The first child is the main content, and subsequent children are overlaid on top.",
            );
            expect(description).toBeDefined();
        });

        it("renders badge example with initial count", async () => {
            await render(<OverlayDemo />);

            const heading = await screen.findByText("Badge Example");
            const notificationsBtn = await screen.findByRole(AccessibleRole.BUTTON, { name: "Notifications" });
            const badgeLabel = await screen.findByText("3");

            expect(heading).toBeDefined();
            expect(notificationsBtn).toBeDefined();
            expect(badgeLabel).toBeDefined();
        });

        it("increments badge count when + is clicked", async () => {
            await render(<OverlayDemo />);

            const plusBtn = await screen.findByRole(AccessibleRole.BUTTON, { name: "+" });
            await userEvent.click(plusBtn);

            const newBadge = await screen.findByText("4");
            expect(newBadge).toBeDefined();
        });

        it("decrements badge count when - is clicked", async () => {
            await render(<OverlayDemo />);

            const minusBtn = await screen.findByRole(AccessibleRole.BUTTON, { name: "-" });
            await userEvent.click(minusBtn);

            const newBadge = await screen.findByText("2");
            expect(newBadge).toBeDefined();
        });

        it("does not go below 0 when decrementing", async () => {
            await render(<OverlayDemo />);

            const minusBtn = await screen.findByRole(AccessibleRole.BUTTON, { name: "-" });
            for (let i = 0; i < 5; i++) {
                await userEvent.click(minusBtn);
            }

            const zeroBadge = await screen.findByText("0");
            expect(zeroBadge).toBeDefined();
        });

        it("renders corner labels example", async () => {
            await render(<OverlayDemo />);

            const heading = await screen.findByText("Corner Labels");
            const mainContent = await screen.findByText("Main Content");
            const tl = await screen.findByText("TL");
            const tr = await screen.findByText("TR");
            const bl = await screen.findByText("BL");
            const br = await screen.findByText("BR");

            expect(heading).toBeDefined();
            expect(mainContent).toBeDefined();
            expect(tl).toBeDefined();
            expect(tr).toBeDefined();
            expect(bl).toBeDefined();
            expect(br).toBeDefined();
        });

        it("renders usage section", async () => {
            await render(<OverlayDemo />);

            const heading = await screen.findByText("Usage");
            const description = await screen.findByText(
                "Use halign and valign props on overlay children to position them. The first child becomes the base layer.",
            );

            expect(heading).toBeDefined();
            expect(description).toBeDefined();
        });
    });

    describe("panes demo", () => {
        const PanesDemo = panesDemo.component;

        it("renders paned container title", async () => {
            await render(<PanesDemo />);

            const title = await screen.findByText("Paned Container");
            expect(title).toBeDefined();
        });

        it("renders horizontal paned section", async () => {
            await render(<PanesDemo />);

            const heading = await screen.findByText("Horizontal Paned");
            const description = await screen.findByText("Drag the handle between panes to resize them.");
            const leftPane = await screen.findByText("Left Pane");
            const rightPane = await screen.findByText("Right Pane");

            expect(heading).toBeDefined();
            expect(description).toBeDefined();
            expect(leftPane).toBeDefined();
            expect(rightPane).toBeDefined();
        });

        it("renders pane content descriptions", async () => {
            await render(<PanesDemo />);

            const startDesc = await screen.findByText("This is the start child of the paned container.");
            const endDesc = await screen.findByText("This is the end child of the paned container.");

            expect(startDesc).toBeDefined();
            expect(endDesc).toBeDefined();
        });

        it("renders vertical paned section", async () => {
            await render(<PanesDemo />);

            const heading = await screen.findByText("Vertical Paned");
            const topPane = await screen.findByText("Top Pane");
            const bottomPane = await screen.findByText("Bottom Pane");

            expect(heading).toBeDefined();
            expect(topPane).toBeDefined();
            expect(bottomPane).toBeDefined();
        });

        it("renders nested panes section", async () => {
            await render(<PanesDemo />);

            const heading = await screen.findByText("Nested Panes");
            const sidebar = await screen.findByText("Sidebar");
            const mainContent = await screen.findByText("Main Content");
            const detailsPanel = await screen.findByText("Details Panel");

            expect(heading).toBeDefined();
            expect(sidebar).toBeDefined();
            expect(mainContent).toBeDefined();
            expect(detailsPanel).toBeDefined();
        });
    });

    describe("stack demo", () => {
        const StackDemo = stackDemo.component;

        it("renders stack container title", async () => {
            await render(<StackDemo />);

            const title = await screen.findByText("Stack Container");
            expect(title).toBeDefined();
        });

        it("renders stack with stack switcher section", async () => {
            await render(<StackDemo />);

            const heading = await screen.findByText("Stack with StackSwitcher");
            const description = await screen.findByText(
                "Stack shows one child at a time with animated transitions. Use StackSwitcher for navigation.",
            );

            expect(heading).toBeDefined();
            expect(description).toBeDefined();
        });

        it("renders stack pages content", async () => {
            await render(<StackDemo />);

            const firstPage = await screen.findByText("First Page");
            expect(firstPage).toBeDefined();
        });

        it("renders stack with sidebar section", async () => {
            await render(<StackDemo />);

            const heading = await screen.findByText("Stack with StackSidebar");
            expect(heading).toBeDefined();
        });

        it("renders sidebar page content", async () => {
            await render(<StackDemo />);

            const homePages = await screen.findAllByText("Home");
            const homeDesc = await screen.findByText("Welcome to the home page.");

            expect(homePages.length).toBeGreaterThanOrEqual(1);
            expect(homeDesc).toBeDefined();
        });

        it("renders programmatic control section", async () => {
            await render(<StackDemo />);

            const heading = await screen.findByText("Programmatic Control");
            const description = await screen.findByText("Control the visible page with React state.");

            expect(heading).toBeDefined();
            expect(description).toBeDefined();
        });

        it("renders page control buttons", async () => {
            await render(<StackDemo />);

            const page1Btn = await screen.findByRole(AccessibleRole.BUTTON, { name: "Page 1" });
            const page2Btn = await screen.findByRole(AccessibleRole.BUTTON, { name: "Page 2" });
            const page3Btn = await screen.findByRole(AccessibleRole.BUTTON, { name: "Page 3" });

            expect(page1Btn).toBeDefined();
            expect(page2Btn).toBeDefined();
            expect(page3Btn).toBeDefined();
        });

        it("shows Page 1 by default in programmatic control", async () => {
            await render(<StackDemo />);

            const page1Labels = await screen.findAllByText("Page 1");
            expect(page1Labels.length).toBeGreaterThanOrEqual(1);
        });

        it("switches to Page 2 when button clicked", async () => {
            await render(<StackDemo />);

            const page2Btn = await screen.findByRole(AccessibleRole.BUTTON, { name: "Page 2" });
            await userEvent.click(page2Btn);

            const page2Labels = await screen.findAllByText("Page 2");
            expect(page2Labels.length).toBeGreaterThanOrEqual(1);
        });

        it("switches to Page 3 when button clicked", async () => {
            await render(<StackDemo />);

            const page3Btn = await screen.findByRole(AccessibleRole.BUTTON, { name: "Page 3" });
            await userEvent.click(page3Btn);

            const page3Labels = await screen.findAllByText("Page 3");
            expect(page3Labels.length).toBeGreaterThanOrEqual(1);
        });

        it("can switch between pages multiple times", async () => {
            await render(<StackDemo />);

            const page2Btn = await screen.findByRole(AccessibleRole.BUTTON, { name: "Page 2" });
            const page1Btn = await screen.findByRole(AccessibleRole.BUTTON, { name: "Page 1" });

            await userEvent.click(page2Btn);
            await waitFor(async () => {
                const page2Labels = await screen.findAllByText("Page 2");
                expect(page2Labels.length).toBeGreaterThanOrEqual(1);
            });

            await userEvent.click(page1Btn);
            await waitFor(async () => {
                const page1Labels = await screen.findAllByText("Page 1");
                expect(page1Labels.length).toBeGreaterThanOrEqual(1);
            });
        });
    });

    describe("frames demo", () => {
        const FramesDemo = framesDemo.component;

        it("renders frames title", async () => {
            await render(<FramesDemo />);

            const title = await screen.findByText("Frames");
            expect(title).toBeDefined();
        });

        it("renders basic frame section", async () => {
            await render(<FramesDemo />);

            const heading = await screen.findByText("Basic Frame");
            const frameLabels = await screen.findAllByText("Section Title");
            const content = await screen.findByText("This content is inside a frame.");

            expect(heading).toBeDefined();
            expect(frameLabels.length).toBeGreaterThanOrEqual(1);
            expect(content).toBeDefined();
        });

        it("renders frame description", async () => {
            await render(<FramesDemo />);

            const description = await screen.findByText("Frames provide visual grouping with an optional label.");
            expect(description).toBeDefined();
        });

        it("renders frame without label section", async () => {
            await render(<FramesDemo />);

            const heading = await screen.findByText("Frame without Label");
            const content = await screen.findByText("Frames can also be used without a label.");
            const borderDesc = await screen.findByText("They still provide visual grouping and a border.");

            expect(heading).toBeDefined();
            expect(content).toBeDefined();
            expect(borderDesc).toBeDefined();
        });

        it("renders custom label widget section", async () => {
            await render(<FramesDemo />);

            const heading = await screen.findByText("Custom Label Widget");
            const customHeader = await screen.findByText("Custom Header");
            const actionBtn = await screen.findByRole(AccessibleRole.BUTTON, { name: "Action" });

            expect(heading).toBeDefined();
            expect(customHeader).toBeDefined();
            expect(actionBtn).toBeDefined();
        });

        it("renders custom label widget content", async () => {
            await render(<FramesDemo />);

            const content = await screen.findByText("You can use any widget as the frame label.");
            const interactiveDesc = await screen.findByText("This allows for interactive headers.");

            expect(content).toBeDefined();
            expect(interactiveDesc).toBeDefined();
        });

        it("renders multiple frames section", async () => {
            await render(<FramesDemo />);

            const heading = await screen.findByText("Multiple Frames");
            const optionALabels = await screen.findAllByText("Option A");
            const optionBLabels = await screen.findAllByText("Option B");
            const optionCLabels = await screen.findAllByText("Option C");

            expect(heading).toBeDefined();
            expect(optionALabels.length).toBeGreaterThanOrEqual(1);
            expect(optionBLabels.length).toBeGreaterThanOrEqual(1);
            expect(optionCLabels.length).toBeGreaterThanOrEqual(1);
        });

        it("renders select buttons in multiple frames", async () => {
            await render(<FramesDemo />);

            const selectA = await screen.findByRole(AccessibleRole.BUTTON, { name: "Select A" });
            const selectB = await screen.findByRole(AccessibleRole.BUTTON, { name: "Select B" });
            const selectC = await screen.findByRole(AccessibleRole.BUTTON, { name: "Select C" });

            expect(selectA).toBeDefined();
            expect(selectB).toBeDefined();
            expect(selectC).toBeDefined();
        });
    });
});
