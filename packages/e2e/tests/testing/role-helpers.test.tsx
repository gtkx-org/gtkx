import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkCheckButton, GtkLabel } from "@gtkx/jsx/gtk";
import {
    getByName,
    getByRole,
    getByText,
    getRoles,
    getSuggestedQuery,
    getWidgetText,
    prettyRoles,
    render,
    screen,
} from "@gtkx/testing";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
    vi.restoreAllMocks();
});

describe("getRoles", () => {
    it("maps every role of the tree to the widgets that carry it", async () => {
        const { container } = await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkButton label="Submit" />
                <GtkButton label="Cancel" />
                <GtkLabel>Hello</GtkLabel>
            </GtkBox>,
        );

        const roles = getRoles(container);
        expect(roles.get("button")?.map((widget) => getWidgetText(widget))).toEqual(["Submit", "Cancel"]);
        expect(roles.has("label")).toBe(true);
        expect(getWidgetText(getByRole(container, Gtk.AccessibleRole.BUTTON, { name: "Submit" }))).toBe("Submit");
    });

    it("reports no button role for a tree that holds none", async () => {
        const { container } = await render(<GtkBox orientation={Gtk.Orientation.VERTICAL} />);
        expect(getRoles(container).has("button")).toBe(false);
    });
});

describe("prettyRoles", () => {
    it("formats every role of the tree next to the names it holds", async () => {
        const { container } = await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkButton label="Submit" />
                <GtkCheckButton label="Remember" />
            </GtkBox>,
        );

        const output = prettyRoles(container);
        expect(output).toContain("button:");
        expect(output).toContain("Submit");
        expect(output).toContain("checkbox:");
        expect(output).toContain("Remember");
        expect(prettyRoles(container)).toContain("generic:");
    });

    it("logs the same report through the screen", async () => {
        const log = vi.spyOn(console, "log").mockImplementation(vi.fn());
        await render(<GtkButton label="Test" />);
        screen.logRoles();
        expect(log.mock.calls[0]?.[0]).toContain("button:");
    });
});

describe("getSuggestedQuery", () => {
    it("suggests a role query with the accessible name, in the requested variant", async () => {
        const { container } = await render(<GtkButton label="Save" name="cta" />);
        const button = getByRole(container, Gtk.AccessibleRole.BUTTON);
        const suggestion = getSuggestedQuery(button);
        expect(suggestion?.queryName).toBe("Role");
        expect(suggestion?.queryMethod).toBe("getByRole");
        expect(suggestion?.toString()).toBe("getByRole(Gtk.AccessibleRole.BUTTON, { name: 'Save' })");

        expect(getSuggestedQuery(button, "find")?.toString()).toBe(
            "findByRole(Gtk.AccessibleRole.BUTTON, { name: 'Save' })",
        );
    });

    it("suggests a text query for a bare label", async () => {
        const { container } = await render(<GtkLabel>Just text</GtkLabel>);
        const suggestion = getSuggestedQuery(getByText(container, "Just text"), "query", "Text");
        expect(suggestion?.queryName).toBe("Text");
        expect(suggestion?.toString()).toBe("queryByText('Just text')");
    });

    it("falls back to a name query for a widget with no semantic content", async () => {
        const { container } = await render(<GtkBox name="my-box" orientation={Gtk.Orientation.VERTICAL} />);
        const suggestion = getSuggestedQuery(getByName(container, "my-box"));
        expect(suggestion?.queryName).toBe("Name");
        expect(suggestion?.toString()).toBe("getByName('my-box')");
    });
});

describe("accessible name computation", () => {
    it("prefers a label, falls back to the tooltip, and drops the mnemonic marker", async () => {
        await render(<GtkButton tooltipText="Search" iconName="edit-find-symbolic" />);
        expect(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Search" })).toHaveAccessibleName("Search");
        await render(<GtkButton label="Save" tooltipText="Save the file" />);
        expect(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Save" })).toHaveAccessibleName("Save");
        await render(<GtkButton label="_Add Connection" useUnderline />);
        const underlined = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Add Connection" });
        expect(getWidgetText(underlined)).toBe("Add Connection");
    });

    it("keeps an underscore that no underline consumes and collapses a doubled one", async () => {
        await render(<GtkButton label="_Add Connection" />);
        const literal = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "_Add Connection" });
        expect(literal).toHaveAccessibleName("_Add Connection");
        await render(<GtkButton label="_Export __ Range" useUnderline />);
        const doubled = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Export _ Range" });
        expect(doubled).toHaveAccessibleName("Export _ Range");
    });

    it("drops the mnemonic marker from a check button too", async () => {
        await render(<GtkCheckButton label="_Read Only" useUnderline />);
        const check = await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, { name: "Read Only" });
        expect(check).toHaveAccessibleName("Read Only");
    });
});
