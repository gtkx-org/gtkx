import { Grid } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkAdjustment, GtkLabel, GtkScale } from "@gtkx/jsx/gtk";
import type { Demo } from "../types.js";
import sourceCode from "./scale.tsx?raw";

const INTEGER_MARKS = [0, 1, 2, 3, 4].map((value) => ({ value, position: Gtk.PositionType.BOTTOM }));

interface ScaleRowProps {
    label: string;
    row: number;
    scaleProps?: Partial<React.ComponentProps<typeof GtkScale>>;
}

const ScaleRow = ({ label, row, scaleProps }: ScaleRowProps) => (
    <>
        <Grid.Child column={0} row={row}>
            {(ref) => <GtkLabel ref={ref} label={label} xalign={0} />}
        </Grid.Child>
        <Grid.Child column={1} row={row}>
            {(ref) => (
                <GtkScale
                    ref={ref}
                    widthRequest={200}
                    drawValue={false}
                    hexpand
                    adjustment={<GtkAdjustment value={2} upper={4} stepIncrement={0.1} pageIncrement={1} />}
                    {...scaleProps}
                />
            )}
        </Grid.Child>
    </>
);

const ScaleDemo = () => (
    <Grid rowSpacing={10} columnSpacing={10} marginStart={20} marginEnd={20} marginTop={20} marginBottom={20}>
        <ScaleRow label="Plain" row={0} />
        <ScaleRow label="Marks" row={1} scaleProps={{ marks: INTEGER_MARKS }} />
        <ScaleRow label="Discrete" row={2} scaleProps={{ roundDigits: 0, marks: INTEGER_MARKS }} />
    </Grid>
);

export const scaleDemo: Demo = {
    id: "scale",
    title: "Scales",
    description:
        "GtkScale is a way to select a value from a range. Scales can have marks to help pick special values, and they can also restrict the values that can be chosen.",
    keywords: ["gtkscale"],
    component: ScaleDemo,
    sourceCode,
    resizable: false,
};
