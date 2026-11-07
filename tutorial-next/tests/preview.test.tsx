import * as Gtk from "@gtkx/gi/gtk";
import { composeStories } from "@gtkx/storybook";
import { render, screen, userEvent } from "@gtkx/testing";
import { expect, it } from "vitest";
import * as stories from "../src/preview/markdown-preview.stories.js";

const { Headings, Links, Tagged } = composeStories(stories);

it("renders each Markdown heading as a heading", async () => {
    await render(<Headings />);

    for (const level of [1, 2, 3, 4, 5, 6]) {
        expect(screen.getByRole(Gtk.AccessibleRole.HEADING, { name: `Heading ${level}` })).toBeVisible();
    }
});

it("hands an activated link to its callback", async () => {
    const links: string[] = [];
    await render(
        <Links
            onActivateLink={(uri) => {
                links.push(uri);
                return true;
            }}
        />,
    );

    await userEvent.keyboard(screen.getByText("Reading list links to another note."), "{Enter}");

    expect(links).toEqual(["Reading list.md"]);
});

it("shows tags above the note", async () => {
    await render(<Tagged />);

    expect(screen.getByText("#work")).toBeVisible();
    expect(screen.getByText("#ideas")).toBeVisible();
});
