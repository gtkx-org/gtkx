import * as Gtk from "@gtkx/ffi/gtk";
import { GtkGrid, GtkLabel, GtkScale, x } from "@gtkx/react";
import type { Demo } from "../types.js";
import sourceCode from "./scale.tsx?raw";

const ScaleDemo = () => {
    return (
        <GtkGrid
            rowSpacing={10}
            columnSpacing={10}
            marginStart={20}
            marginEnd={20}
            marginTop={20}
            marginBottom={20}
        >
            <x.GridChild column={0} row={0}>
                <GtkLabel label="Plain" xalign={0} />
            </x.GridChild>
            <x.GridChild column={1} row={0}>
                <GtkScale widthRequest={200} drawValue={false} hexpand>
                    <x.Adjustment value={2} lower={0} upper={4} stepIncrement={0.1} pageIncrement={1} />
                </GtkScale>
            </x.GridChild>

            <x.GridChild column={0} row={1}>
                <GtkLabel label="Marks" xalign={0} />
            </x.GridChild>
            <x.GridChild column={1} row={1}>
                <GtkScale widthRequest={200} drawValue={false} hexpand>
                    <x.Adjustment value={2} lower={0} upper={4} stepIncrement={0.1} pageIncrement={1} />
                    <x.ScaleMark value={0} position={Gtk.PositionType.BOTTOM} />
                    <x.ScaleMark value={1} position={Gtk.PositionType.BOTTOM} />
                    <x.ScaleMark value={2} position={Gtk.PositionType.BOTTOM} />
                    <x.ScaleMark value={3} position={Gtk.PositionType.BOTTOM} />
                    <x.ScaleMark value={4} position={Gtk.PositionType.BOTTOM} />
                </GtkScale>
            </x.GridChild>

            <x.GridChild column={0} row={2}>
                <GtkLabel label="Discrete" xalign={0} />
            </x.GridChild>
            <x.GridChild column={1} row={2}>
                <GtkScale widthRequest={200} roundDigits={0} drawValue={false} hexpand>
                    <x.Adjustment value={2} lower={0} upper={4} stepIncrement={0.1} pageIncrement={1} />
                    <x.ScaleMark value={0} position={Gtk.PositionType.BOTTOM} />
                    <x.ScaleMark value={1} position={Gtk.PositionType.BOTTOM} />
                    <x.ScaleMark value={2} position={Gtk.PositionType.BOTTOM} />
                    <x.ScaleMark value={3} position={Gtk.PositionType.BOTTOM} />
                    <x.ScaleMark value={4} position={Gtk.PositionType.BOTTOM} />
                </GtkScale>
            </x.GridChild>
        </GtkGrid>
    );
};

export const scaleDemo: Demo = {
    id: "scale",
    title: "Scales",
    description:
        "GtkScale is a way to select a value from a range. Scales can have marks to help pick special values, and they can also restrict the values that can be chosen.",
    keywords: ["scale", "slider", "range", "GtkScale", "marks", "discrete", "plain"],
    component: ScaleDemo,
    sourceCode,
};
