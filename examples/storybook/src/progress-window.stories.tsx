import type { Meta, StoryObj } from "@gtkx/storybook";
import { AdwHeaderBar, AdwToolbarView, AdwWindow } from "@gtkx/jsx/adw";
import { GtkBox } from "@gtkx/jsx/gtk";
import { CounterCard } from "./counter-card.js";

const meta = {
    title: "Windows/Progress",
    parameters: { gtkx: { preview: "window" } },
    render: () => (
        <AdwWindow title="Daily Progress" defaultWidth={480} defaultHeight={240}>
            <AdwToolbarView topBar={<AdwHeaderBar />}>
                <GtkBox marginTop={24} marginBottom={24} marginStart={24} marginEnd={24}>
                    <CounterCard label="Complete task" step={1} unit="tasks" enabled />
                </GtkBox>
            </AdwToolbarView>
        </AdwWindow>
    ),
} satisfies Meta;

type Story = StoryObj<typeof meta>;

const Default = {} satisfies Story;

export default meta;
export { Default };
