import { action, type Meta, type StoryObj } from "@gtkx/storybook";
import { Confirmation } from "./confirmation.js";

const meta = {
    title: "Patterns/Confirmation",
    component: Confirmation,
    args: { onDiscard: action("draft-discarded") },
    argTypes: { onDiscard: { control: false } },
} satisfies Meta<typeof Confirmation>;

type Story = StoryObj<typeof meta>;

const Default = {} satisfies Story;

export default meta;
export { Default };
