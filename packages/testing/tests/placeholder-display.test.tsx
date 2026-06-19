import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkEntry, GtkSearchEntry } from "@gtkx/jsx/gtk";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import {
    findAllByDisplayValue,
    findAllByPlaceholderText,
    findByDisplayValue,
    findByPlaceholderText,
    getAllByDisplayValue,
    getAllByPlaceholderText,
    getByDisplayValue,
    getByPlaceholderText,
    queryAllByDisplayValue,
    queryAllByPlaceholderText,
    queryByDisplayValue,
    queryByPlaceholderText,
    render,
} from "../src/index.js";

const VBox = ({ children }: { children: ReactNode }) => (
    <GtkBox orientation={Gtk.Orientation.VERTICAL}>{children}</GtkBox>
);

describe("ByPlaceholderText", () => {
    it("queries an entry by its placeholder text", async () => {
        const { container } = await render(<GtkEntry placeholderText="Email address" />);
        const entry = queryByPlaceholderText(container, "Email address");
        expect(entry).toBeInstanceOf(Gtk.Entry);
    });

    it("returns null when no placeholder matches", async () => {
        const { container } = await render(<GtkEntry placeholderText="Email address" />);
        expect(queryByPlaceholderText(container, "Phone number")).toBeNull();
    });

    it("matches a search entry placeholder", async () => {
        const { container } = await render(<GtkSearchEntry placeholderText="Search notes" />);
        expect(getByPlaceholderText(container, "Search notes")).toBeInstanceOf(Gtk.SearchEntry);
    });

    it("supports substring matching with exact false", async () => {
        const { container } = await render(<GtkEntry placeholderText="Enter your email" />);
        expect(getByPlaceholderText(container, "your email", { exact: false })).toBeInstanceOf(Gtk.Entry);
    });

    it("supports regex matching", async () => {
        const { container } = await render(<GtkEntry placeholderText="Enter your email" />);
        expect(getByPlaceholderText(container, /email$/)).toBeInstanceOf(Gtk.Entry);
    });

    it("returns every matching entry", async () => {
        const { container } = await render(
            <VBox>
                <GtkEntry placeholderText="Field" />
                <GtkEntry placeholderText="Field" />
            </VBox>,
        );
        expect(getAllByPlaceholderText(container, "Field")).toHaveLength(2);
        expect(queryAllByPlaceholderText(container, "Missing")).toEqual([]);
    });

    it("finds an entry asynchronously", async () => {
        const { container } = await render(<GtkEntry placeholderText="Username" />);
        await expect(findByPlaceholderText(container, "Username")).resolves.toBeInstanceOf(Gtk.Entry);
        await expect(findAllByPlaceholderText(container, "Username")).resolves.toHaveLength(1);
    });

    it("throws a placeholder-formatted error when none match", async () => {
        const { container } = await render(<GtkEntry placeholderText="Present" />);
        expect(() => getByPlaceholderText(container, "Absent")).toThrow(
            /Unable to find an element with placeholder text 'Absent'/,
        );
    });
});

describe("ByDisplayValue", () => {
    it("queries an entry by its current text", async () => {
        const { container } = await render(<GtkEntry text="hello world" />);
        expect(queryByDisplayValue(container, "hello world")).toBeInstanceOf(Gtk.Entry);
    });

    it("returns null when no value matches", async () => {
        const { container } = await render(<GtkEntry text="hello world" />);
        expect(queryByDisplayValue(container, "goodbye")).toBeNull();
    });

    it("does not confuse placeholder text with display value", async () => {
        const { container } = await render(<GtkEntry placeholderText="Type here" text="actual" />);
        expect(queryByDisplayValue(container, "Type here")).toBeNull();
        expect(queryByDisplayValue(container, "actual")).toBeInstanceOf(Gtk.Entry);
    });

    it("matches a search entry value", async () => {
        const { container } = await render(<GtkSearchEntry text="query" />);
        expect(getByDisplayValue(container, "query")).toBeInstanceOf(Gtk.SearchEntry);
    });

    it("supports regex matching", async () => {
        const { container } = await render(<GtkEntry text="order-1234" />);
        expect(getByDisplayValue(container, /^order-\d+$/)).toBeInstanceOf(Gtk.Entry);
    });

    it("returns every matching widget", async () => {
        const { container } = await render(
            <VBox>
                <GtkEntry text="same" />
                <GtkEntry text="same" />
            </VBox>,
        );
        expect(getAllByDisplayValue(container, "same")).toHaveLength(2);
        expect(queryAllByDisplayValue(container, "missing")).toEqual([]);
    });

    it("finds a widget asynchronously", async () => {
        const { container } = await render(<GtkEntry text="async" />);
        await expect(findByDisplayValue(container, "async")).resolves.toBeInstanceOf(Gtk.Entry);
        await expect(findAllByDisplayValue(container, "async")).resolves.toHaveLength(1);
    });

    it("throws a display-value-formatted error when none match", async () => {
        const { container } = await render(<GtkEntry text="present" />);
        expect(() => getByDisplayValue(container, "absent")).toThrow(
            /Unable to find an element with display value 'absent'/,
        );
    });
});
