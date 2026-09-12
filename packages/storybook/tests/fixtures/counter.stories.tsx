import type { Meta, StoryObj } from "@gtkx/storybook";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkLabel } from "@gtkx/jsx/gtk";
import { Counter, Decoration } from "./counter.js";

const meta = {
    title: "Components/Counter",
    component: Counter,
    args: { initialCount: 2, label: "Increment", step: 1 },
    argTypes: { step: { control: "number" } },
    parameters: { layout: "meta", metaOnly: true, theme: { density: "compact" } },
    globals: { theme: "dark" },
    decorators: [
        (Story, context) => (
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkLabel name="story-context">
                    {[
                        context.id,
                        context.name,
                        context.args.label,
                        context.parameters.layout,
                        context.globals.theme,
                        context.globals.language,
                    ].map(String).join("|")}
                </GtkLabel>
                <Decoration label="meta">
                    <Story />
                </Decoration>
            </GtkBox>
        ),
    ],
} satisfies Meta<typeof Counter>;

type Story = StoryObj<typeof meta>;

const Default = {} satisfies Story;

const WithStep = {
    args: { step: 3 },
} satisfies Story;

const Named = {
    name: "Count by five!",
    args: { label: "Add five", step: 5 },
} satisfies Story;

const Decorated = {
    args: { initialCount: 4, label: "Story increment" },
    argTypes: { label: { control: "text" } },
    parameters: { layout: "story", theme: { contrast: "high" } },
    globals: { language: "it" },
    decorators: [
        (Story) => (
            <Decoration label="story">
                <Story />
            </Decoration>
        ),
    ],
} satisfies Story;

export default meta;
export { Default, Decorated, Named, WithStep };
