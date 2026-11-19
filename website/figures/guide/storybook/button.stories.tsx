import type { Meta, StoryObj } from "@gtkx/storybook";
import { Button } from "./button.js";

const meta = {
    title: "Components/Button",
    component: Button,
    args: { label: "Save", enabled: true },
    argTypes: {
        label: { control: "text" },
        enabled: { control: "boolean" },
        onClicked: { action: "clicked" },
    },
} satisfies Meta<typeof Button>;

type Story = StoryObj<typeof meta>;

const Default = {} satisfies Story;
const Disabled = { args: { enabled: false } } satisfies Story;

export default meta;
export { Default, Disabled };
