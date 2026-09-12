import * as Gtk from "@gtkx/gi/gtk";
import { AdwActionRow, AdwPreferencesGroup } from "@gtkx/jsx/adw";
import { GtkButton } from "@gtkx/jsx/gtk";
import { type ReactNode, useState } from "react";

type CounterCardProps = {
    label: string;
    step: number;
    enabled: boolean;
    unit: "tasks" | "pages" | "minutes";
    onIncrement?: (count: number) => void;
};

const CounterCard = ({ label, step, enabled, unit, onIncrement }: CounterCardProps): ReactNode => {
    const [count, setCount] = useState(0);

    if (!Number.isFinite(step) || step <= 0) {
        throw new RangeError("The counter step must be positive and finite");
    }

    const increment = (): void => {
        const nextCount = count + step;
        setCount(nextCount);
        onIncrement?.(nextCount);
    };

    return (
        <AdwPreferencesGroup title="Daily progress" description="Track a little progress at a time.">
            <AdwActionRow
                title={`${String(count)} ${count === 1 ? unit.slice(0, -1) : unit}`}
                subtitle={`Add ${String(step)} with each click`}
                useMarkup={false}
                suffix={(
                    <GtkButton
                        label={label}
                        sensitive={enabled}
                        valign={Gtk.Align.CENTER}
                        cssClasses={["suggested-action"]}
                        onClicked={increment}
                    />
                )}
            />
        </AdwPreferencesGroup>
    );
};

export { CounterCard };
