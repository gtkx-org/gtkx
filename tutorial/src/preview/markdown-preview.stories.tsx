import type { Meta, StoryObj } from "@gtkx/storybook";
import { MarkdownPreview } from "./markdown-preview.js";

const meta = {
    title: "Preview/Markdown",
    component: MarkdownPreview,
    args: {
        text: "",
        tags: [],
        onActivateLink: () => true,
    },
    argTypes: {
        text: { control: false },
        tags: { control: false },
        onActivateLink: { action: "activate-link", control: false },
    },
} satisfies Meta<typeof MarkdownPreview>;

type Story = StoryObj<typeof meta>;

const Headings = {
    args: {
        text: "# Heading 1\n\n## Heading 2\n\n### Heading 3\n\n#### Heading 4\n\n##### Heading 5\n\n###### Heading 6\n",
    },
} satisfies Story;

const Formatting = {
    args: {
        text: "Text can be **bold**, *italic* or `inline code`.",
    },
    argTypes: {
        text: { control: "text" },
    },
} satisfies Story;

const Links = {
    args: {
        text: "[Reading list](<Reading list.md>) links to another note.\n\n[GTKX](https://gtkx.dev) links to a website.\n",
    },
} satisfies Story;

const Lists = {
    args: {
        text: [
            "- Oat milk",
            "- Coffee beans",
            "  - Whole, not ground",
            "- Lemons",
            "",
            "1. Preheat the oven",
            "2. Mix the dough",
            "3. Bake for 20 minutes",
        ].join("\n"),
    },
} satisfies Story;

const Blocks = {
    args: {
        text: [
            "> Simplicity is prerequisite for reliability.",
            ">",
            "> Edsger W. Dijkstra",
            "",
            "```ts",
            'const greeting = "Hello";',
            "console.log(greeting);",
            "```",
            "",
            "---",
            "",
            "After the rule.",
        ].join("\n"),
    },
} satisfies Story;

const Tagged = {
    args: {
        text: "# Ideas\n\nA notes app over **plain files**.\n",
        tags: ["work", "ideas"],
    },
} satisfies Story;

export default meta;
export { Blocks, Formatting, Headings, Links, Lists, Tagged };
