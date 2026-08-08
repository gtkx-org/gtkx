import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../src/index.js";
import {
    buildQueries,
    computeHeadingLevel,
    createEvent,
    fireEvent,
    getElementError,
    getQueriesForElement,
    isInaccessible,
    prettyFormat,
    prettyWidget,
    queryAllByObjectProperty,
    queryByObjectProperty,
    queryHelpers,
    render,
    screen,
    userEvent,
    within,
} from "../src/index.js";
import { VBox } from "./widget-fixtures.js";

function queryAllByTooltip(container: Container, text: string): Gtk.Widget[] {
    return queryAllByObjectProperty("tooltip-text", container, text);
}

async function renderTooltipped(first: string, second?: string): Promise<Gtk.Widget> {
    const { container } = await render(
        <VBox>
            <GtkButton label="One" tooltipText={first} />
            {second === undefined ? <GtkLabel label="Two" /> : <GtkButton label="Two" tooltipText={second} />}
        </VBox>,
    );

    return container;
}

describe("createEvent", () => {
    it("records an emission without delivering it", async () => {
        const clicked = vi.fn();
        await render(<GtkButton label="Recorded" onClicked={clicked} />);
        const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON);
        const event = createEvent(button, "clicked");
        expect(event.target).toBe(button);
        expect(event.signalName).toBe("clicked");
        expect(event.args).toEqual([]);
        expect(clicked).not.toHaveBeenCalled();
        await fireEvent(event);
        expect(clicked).toHaveBeenCalledTimes(1);
    });

    it("keeps the arguments it was given", async () => {
        await render(<GtkButton label="Args" />);
        const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON);

        expect(createEvent(button, "state-flags-changed", Gtk.StateFlags.ACTIVE).args).toEqual([
            Gtk.StateFlags.ACTIVE,
        ]);
    });

    it("rejects a target without a signal name", async () => {
        await render(<GtkButton label="Nameless" />);
        const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON);

        expect(() => {
            Reflect.apply(fireEvent, undefined, [button]);
        }).toThrow(/pass a signal name/);
    });
});

describe("buildQueries", () => {
    it("derives the five variants from a queryAllBy function", async () => {
        const [queryByTooltip, getAllByTooltip, getByTooltip, findAllByTooltip, findByTooltip] = buildQueries(
            queryAllByTooltip,
            (container, matches, text) =>
                getElementError(`Found ${String(matches.length)} widgets tooltipped '${text}'`, container),
            (container, text) => getElementError(`No widget is tooltipped '${text}'`, container),
        );

        const container = await renderTooltipped("only");
        expect(getByTooltip(container, "only")).toBeDefined();
        expect(getAllByTooltip(container, "only")).toHaveLength(1);
        expect(queryByTooltip(container, "absent")).toBeNull();
        await expect(findByTooltip(container, "only")).resolves.toBeDefined();
        await expect(findAllByTooltip(container, "only")).resolves.toHaveLength(1);
        expect(() => getByTooltip(container, "absent")).toThrow(/No widget is tooltipped 'absent'/);
    });

    it("reports every match through the multiple-error builder", async () => {
        const getByTooltip = buildQueries(
            queryAllByTooltip,
            (container, matches) => getElementError(`Saw ${String(matches.length)} matches`, container),
            (container) => getElementError("none", container),
        )[2];

        const container = await renderTooltipped("shared", "shared");
        expect(() => getByTooltip(container, "shared")).toThrow(/Saw 2 matches/);
    });
});

describe("queryHelpers", () => {
    it("bundles the query-building helpers", () => {
        expect(queryHelpers.buildQueries).toBe(buildQueries);
        expect(queryHelpers.getElementError).toBe(getElementError);
        expect(queryHelpers.queryAllByObjectProperty).toBe(queryAllByObjectProperty);
        expect(queryHelpers.queryByObjectProperty).toBe(queryByObjectProperty);
    });

    it("matches widgets on a GObject property", async () => {
        const { container } = await render(
            <VBox>
                <GtkButton label="Save" tooltipText="Stores the file" />
                <GtkButton label="Quit" />
            </VBox>,
        );

        expect(queryByObjectProperty("tooltip-text", container, "Stores the file")).toBeDefined();
        expect(queryByObjectProperty("tooltipText", container, "Stores the file")).toBeDefined();
        expect(queryByObjectProperty("tooltip-text", container, "Missing")).toBeNull();
        expect(queryAllByObjectProperty("label", container, "Quit")).toHaveLength(2);
        expect(queryAllByObjectProperty("label", container, "Quit", { as: Gtk.Button })).toHaveLength(1);
    });

    it("throws when more than one widget carries the value", async () => {
        const { container } = await render(
            <VBox>
                <GtkButton label="Same" />
                <GtkButton label="Same" />
            </VBox>,
        );

        expect(() => queryByObjectProperty("label", container, "Same", { as: Gtk.Button })).toThrow(
            /Found 2 elements with the 'label' property/,
        );
    });
});

describe("getQueriesForElement", () => {
    it("is the library-code name for within", async () => {
        expect(getQueriesForElement).toBe(within);

        const { container } = await render(
            <GtkBox>
                <GtkButton label="Scoped" />
            </GtkBox>,
        );

        expect(getQueriesForElement(container).getByRole(Gtk.AccessibleRole.BUTTON)).toBeDefined();
    });
});

describe("getElementError", () => {
    it("appends the container's widget tree", async () => {
        const { container } = await render(<GtkButton label="Traced" />);
        const error = getElementError("Something went wrong", container);
        expect(error.message).toContain("Something went wrong");
        expect(error.message).toContain("role=\"button\"");
    });

    it("uses the message alone without a container", () => {
        expect(getElementError("Plain").message).toBe("Plain");
    });
});

describe("computeHeadingLevel", () => {
    it("reads the level GTK reports", async () => {
        await render(<GtkLabel label="Title" accessibleRole={Gtk.AccessibleRole.HEADING} accessibleLevel={2} />);
        const heading = await screen.findByRole(Gtk.AccessibleRole.HEADING);
        expect(computeHeadingLevel(heading)).toBe(2);
    });

    it("is undefined when no level is declared", async () => {
        await render(<GtkButton label="Plain" />);
        const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON);
        expect(computeHeadingLevel(button)).toBeUndefined();
    });
});

describe("isInaccessible", () => {
    it("reports widgets hidden from the accessibility tree", async () => {
        const { container } = await render(
            <VBox>
                <GtkButton label="Shown" />
                <GtkButton label="Excluded" accessibleHidden />
            </VBox>,
        );

        const [shown] = queryAllByObjectProperty("label", container, "Shown");
        const [excluded] = queryAllByObjectProperty("label", container, "Excluded");
        expect(shown && isInaccessible(shown)).toBe(false);
        expect(excluded && isInaccessible(excluded)).toBe(true);
    });
});

describe("prettyFormat", () => {
    it("exposes the pretty-format entry points", () => {
        expect(typeof prettyFormat.format).toBe("function");
        expect(typeof prettyFormat.plugins.DOMCollection).toBe("object");
    });

    it("lets prettyWidget forward pretty-format options", async () => {
        const { container } = await render(
            <VBox>
                <GtkButton label="Indented" />
            </VBox>,
        );

        const wide = prettyWidget(container, { shouldHighlight: false, prettyFormatOptions: { indent: 6 } });
        const narrow = prettyWidget(container, { shouldHighlight: false, prettyFormatOptions: { indent: 1 } });
        expect(wide).toContain("\n      <");
        expect(narrow).toContain("\n <");
        expect(wide).not.toBe(narrow);
    });

    it("collapses the tree when minimizing whitespace", async () => {
        const { container } = await render(
            <VBox>
                <GtkButton label="Compact" />
            </VBox>,
        );

        expect(prettyWidget(container, { shouldHighlight: false, prettyFormatOptions: { min: true } })).not.toContain(
            "\n",
        );
    });
});

describe("userEvent.setup", () => {
    it("returns an instance carrying its own keyboard state", async () => {
        await render(<GtkButton label="Session" />);
        const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON);
        const session = userEvent.setup();
        expect(session).not.toBe(userEvent);
        expect(typeof session.click).toBe("function");
        await session.click(button);
    });

    it("keeps sub-instances on the same state as their parent", () => {
        const session = userEvent.setup();
        const child = session.setup({ delay: null });
        expect(child).not.toBe(session);
        expect(typeof child.keyboard).toBe("function");
    });

    it("waits the configured delay after each helper", async () => {
        await render(<GtkButton label="Delayed" />);
        const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON);
        const session = userEvent.setup({ delay: 25 });
        const startedAt = Date.now();
        await session.click(button);
        expect(Date.now() - startedAt).toBeGreaterThanOrEqual(20);
    });
});
