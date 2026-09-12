import type { Meta, StoryObj } from "@gtkx/storybook";
import { CounterCard } from "./counter-card.js";

const meta = {
    title: "Components/Counter card",
    component: CounterCard,
    args: { label: "Add progress", step: 1, enabled: true, unit: "tasks" },
    argTypes: {
        label: { control: "text" },
        step: { control: { type: "number", min: 1, max: 100, step: 1 } },
        enabled: { control: "boolean" },
        unit: { control: "select", options: ["tasks", "pages", "minutes"] },
        onIncrement: { action: "incremented", control: false },
    },
} satisfies Meta<typeof CounterCard>;

type Story = StoryObj<typeof meta>;

const Default = {} satisfies Story;

const ByFive = {
    name: "Read five pages",
    args: { label: "Read five pages", step: 5, unit: "pages" },
} satisfies Story;

const Disabled = {
    args: { enabled: false },
} satisfies Story;

const InvalidStep = {
    name: "Recover from an invalid step",
    args: { step: 0 },
} satisfies Story;

export default meta;
export { Default, ByFive, Disabled, InvalidStep };
