import { animated, config, to, useSpring } from "@gtkx/animated";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton } from "@gtkx/jsx/gtk";
import type { Demo } from "./types.js";

const SOURCE = { duration: 1200 };

const interpolationDemo: Demo = {
    id: "interpolation",
    title: "Interpolation",
    description:
        "One useSpring value drives several outputs at once through value.to(): formatted label text, a progress " +
        "bar fraction, and the width of a colored bar. The standalone to() combinator merges two springs into a " +
        "single label.",
    component: InterpolationDemo,
};

const formatCount = (current: number): string => String(Math.round(current));

const formatCombined = (current: number, extra: number): string =>
    `${formatCount(current)} + ${formatCount(extra)} bonus`;

function InterpolationDemo() {
    const [{ value }, valueApi] = useSpring(() => ({ from: { value: 0 }, to: { value: 100 }, config: SOURCE }));
    const [{ bonus }, bonusApi] = useSpring(() => ({ from: { bonus: 0 }, to: { bonus: 20 }, config: config.wobbly }));

    const replay = (): void => {
        void Promise.all(valueApi.start({ from: { value: 0 }, to: { value: 100 } }));
        void Promise.all(bonusApi.start({ from: { bonus: 0 }, to: { bonus: 20 } }));
    };

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
            <animated.GtkLabel cssClasses={["title-4"]} halign={Gtk.Align.START}>
                {value.to(formatCount)}
                {" items"}
            </animated.GtkLabel>
            <animated.GtkProgressBar
                name="interpolation-progress"
                hexpand
                fraction={value.to((current) => current / 100)}
            />
            <animated.GtkBox
                name="interpolation-bar"
                cssClasses={["osd"]}
                halign={Gtk.Align.START}
                heightRequest={24}
                widthRequest={value.to((current) => 40 + current * 2)}
            />
            <animated.GtkLabel halign={Gtk.Align.START} label={to([value, bonus], formatCombined)} />
            <GtkButton label="Replay" halign={Gtk.Align.START} onClicked={replay} />
        </GtkBox>
    );
}

export { interpolationDemo };
