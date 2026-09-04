import type * as Adw from "@gtkx/gi/adw";
import type * as Gio from "@gtkx/gi/gio";
import type { Container, MatcherOptions } from "@gtkx/testing";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
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
} from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { VBox } from "./widget-fixtures.js";

type QueryWidgetType = NonNullable<MatcherOptions["as"]>;
type ObjectOnlyConstructor = abstract new (...args: never[]) => { __type__: bigint };

const acceptsActionRow: typeof Adw.ActionRow extends QueryWidgetType ? true : false = true;
const rejectsFileIcon: typeof Gio.FileIcon extends QueryWidgetType ? false : true = true;
const rejectsObjectShape: ObjectOnlyConstructor extends QueryWidgetType ? false : true = true;

const queryAllByTooltip = (container: Container, text: string): Gtk.Widget[] =>
    queryAllByObjectProperty("tooltip-text", container, text);

const renderTooltipped = async (first: string, second?: string): Promise<Gtk.Widget> => {
    const { container } = await render(
        <VBox>
            <GtkButton label="One" tooltipText={first} />
            {second === undefined ? <GtkLabel label="Two" /> : <GtkButton label="Two" tooltipText={second} />}
        </VBox>,
    );

    return container;
};

describe("createEvent", () => {
    it("records an emission with its arguments without delivering it", async () => {
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
        expect(createEvent(button, "state-flags-changed", Gtk.StateFlags.ACTIVE).args).toEqual([Gtk.StateFlags.ACTIVE]);
    });

    it("throws when a target is fired without a signal name", async () => {
        await render(<GtkButton label="Nameless" />);
        const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON);

        expect(() => {
            Reflect.apply(fireEvent, undefined, [button]);
        }).toThrow();
    });
});

describe("buildQueries", () => {
    it("limits narrowed results to accessible classes", () => {
        expect([acceptsActionRow, rejectsFileIcon, rejectsObjectShape]).toEqual([true, true, true]);
    });

    it("derives the five variants from a queryAllBy function", async () => {
        const [queryByTooltip, getAllByTooltip, getByTooltip, findAllByTooltip, findByTooltip] = buildQueries(
            queryAllByTooltip,
            (container, matches, text) =>
                getElementError(`Found ${String(matches.length)} widgets tooltipped '${text}'`, container),
            (container, text) => getElementError(`No widget is tooltipped '${text}'`, container),
        );

        const container = await renderTooltipped("only");
        expect(getByTooltip(container, "only")).toHaveTextContent("One");
        expect(getAllByTooltip(container, "only")).toHaveLength(1);
        expect(queryByTooltip(container, "absent")).toBeNull();
        await expect(findByTooltip(container, "only")).resolves.toHaveTextContent("One");
        await expect(findAllByTooltip(container, "only")).resolves.toHaveLength(1);
        expect(() => getByTooltip(container, "absent")).toThrow();
        const shared = await renderTooltipped("shared", "shared");
        expect(() => getByTooltip(shared, "shared")).toThrow();
    });
});

describe("queryHelpers", () => {
    it("bundles the query-building helpers", () => {
        expect(queryHelpers.buildQueries).toBe(buildQueries);
        expect(queryHelpers.getElementError).toBe(getElementError);
        expect(queryHelpers.queryAllByObjectProperty).toBe(queryAllByObjectProperty);
        expect(queryHelpers.queryByObjectProperty).toBe(queryByObjectProperty);
    });

    it("match widgets on a GObject property, by camel or kebab case, narrowed by class", async () => {
        const { container } = await render(
            <VBox>
                <GtkButton label="Save" tooltipText="Stores the file" />
                <GtkButton label="Quit" />
            </VBox>,
        );

        expect(queryByObjectProperty("tooltip-text", container, "Stores the file")).toHaveTextContent("Save");
        expect(queryByObjectProperty("tooltipText", container, "Stores the file")).toHaveTextContent("Save");
        expect(queryByObjectProperty("tooltip-text", container, "Missing")).toBeNull();
        expect(queryAllByObjectProperty("label", container, "Quit")).toHaveLength(2);
        expect(queryAllByObjectProperty("label", container, "Quit", { as: Gtk.Button })).toHaveLength(1);
        expect(queryAllByObjectProperty("hasFocus", container, /^(?:true|false)$/, { as: Gtk.Button })).toHaveLength(2);
    });

    it("throws when more than one widget carries the value", async () => {
        const { container } = await render(
            <VBox>
                <GtkButton label="Same" />
                <GtkButton label="Same" />
            </VBox>,
        );

        expect(() => queryByObjectProperty("label", container, "Same", { as: Gtk.Button })).toThrow();
    });
});

describe("library-facing helpers", () => {
    it("exposes within under its library name", async () => {
        expect(getQueriesForElement).toBe(within);

        const { container } = await render(
            <GtkBox>
                <GtkButton label="Scoped" />
            </GtkBox>,
        );

        expect(getQueriesForElement(container).getByRole(Gtk.AccessibleRole.BUTTON)).toHaveTextContent("Scoped");
    });

    it("read the heading level GTK reports and whether a widget is excluded from the tree", async () => {
        const { container } = await render(
            <VBox>
                <GtkLabel label="Title" accessibleRole={Gtk.AccessibleRole.HEADING} accessibleLevel={2} />
                <GtkButton label="Shown" />
                <GtkButton label="Excluded" accessibleHidden />
            </VBox>,
        );

        expect(computeHeadingLevel(await screen.findByRole(Gtk.AccessibleRole.HEADING))).toBe(2);
        const [shown] = queryAllByObjectProperty("label", container, "Shown");
        const [excluded] = queryAllByObjectProperty("label", container, "Excluded");
        expect(shown && computeHeadingLevel(shown)).toBeUndefined();
        expect(shown && isInaccessible(shown)).toBe(false);
        expect(excluded && isInaccessible(excluded)).toBe(true);
    });
});

describe("prettyFormat", () => {
    it("exposes the pretty-format entry points and forwards its options through prettyWidget", async () => {
        expect(typeof prettyFormat.format).toBe("function");
        expect(typeof prettyFormat.plugins.DOMCollection).toBe("object");

        const { container } = await render(
            <VBox>
                <GtkButton label="Indented" />
            </VBox>,
        );

        const wide = prettyWidget(container, { shouldHighlight: false, prettyFormatOptions: { indent: 6 } });
        const narrow = prettyWidget(container, { shouldHighlight: false, prettyFormatOptions: { indent: 1 } });
        expect(wide).toContain("\n      <");
        expect(narrow).toContain("\n <");

        expect(prettyWidget(container, { shouldHighlight: false, prettyFormatOptions: { min: true } })).not.toContain(
            "\n",
        );
    });
});

describe("userEvent.setup", () => {
    it("returns an independent instance, nests, and waits the configured delay", async () => {
        await render(<GtkButton label="Session" />);
        const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON);
        const session = userEvent.setup({ delay: 25 });
        const child = session.setup({ delay: null });
        expect(session).not.toBe(userEvent);
        expect(child).not.toBe(session);
        expect(typeof child.keyboard).toBe("function");
        const startedAt = Date.now();
        await session.click(button);
        expect(Date.now() - startedAt).toBeGreaterThanOrEqual(20);
    });
});
