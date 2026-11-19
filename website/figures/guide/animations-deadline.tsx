import { animated, useSpring } from "@gtkx/animated";
import { GtkLabel } from "@gtkx/jsx/gtk";

const AnimatedLabel = animated(GtkLabel);

const overdueColor = (value: number) => ({
    color: `mix(var(--window-fg-color), var(--error-color), ${value})`,
});

export const Deadline = ({ isOverdue }: { isOverdue: boolean }) => {
    const { level } = useSpring({ level: isOverdue ? 1 : 0 });

    return <AnimatedLabel label="Due today" style={level.to(overdueColor)} />;
};
