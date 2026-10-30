import * as Adw from "@gtkx/gi/adw";
import * as Graphene from "@gtkx/gi/graphene";
import * as Gsk from "@gtkx/gi/gsk";
import * as Gtk from "@gtkx/gi/gtk";
import {
    AdwBin,
    AdwClamp,
    AdwComboRow,
    AdwHeaderBar,
    AdwInlineViewSwitcher,
    AdwPreferencesGroup,
    AdwSpinRow,
    AdwSpringAnimation,
    AdwSwitchRow,
    AdwTimedAnimation,
    AdwToolbarView,
    AdwViewStack,
    AdwViewStackPage,
} from "@gtkx/jsx/adw";
import { GtkAdjustment, GtkBox, GtkButton, GtkCustomLayout, GtkLabel, GtkScrolledWindow } from "@gtkx/jsx/gtk";
import { createPortal, rootElement } from "@gtkx/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const easingLabels = [
    "Linear",
    "Ease-in (Quadratic)",
    "Ease-out (Quadratic)",
    "Ease-in-out (Quadratic)",
    "Ease-in (Cubic)",
    "Ease-out (Cubic)",
    "Ease-in-out (Cubic)",
    "Ease-in (Quartic)",
    "Ease-out (Quartic)",
    "Ease-in-out (Quartic)",
    "Ease-in (Quintic)",
    "Ease-out (Quintic)",
    "Ease-in-out (Quintic)",
    "Ease-in (Sine)",
    "Ease-out (Sine)",
    "Ease-in-out (Sine)",
    "Ease-in (Exponential)",
    "Ease-out (Exponential)",
    "Ease-in-out (Exponential)",
    "Ease-in (Circular)",
    "Ease-out (Circular)",
    "Ease-in-out (Circular)",
    "Ease-in (Elastic)",
    "Ease-out (Elastic)",
    "Ease-in-out (Elastic)",
    "Ease-in (Back)",
    "Ease-out (Back)",
    "Ease-in-out (Back)",
    "Ease-in (Bounce)",
    "Ease-out (Bounce)",
    "Ease-in-out (Bounce)",
    "Ease",
    "Ease-in",
    "Ease-out",
    "Ease-in-out",
];

type NumberRowProps = {
    title: string;
    value: number;
    lower: number;
    upper: number;
    step?: number;
    page?: number;
    digits?: number;
    onChange: (value: number) => void;
};

const NumberRow = ({ title, value, lower, upper, step = 1, page = 10, digits = 0, onChange }: NumberRowProps) => (
    <AdwSpinRow
        title={title}
        numeric
        digits={digits}
        value={value}
        onNotifyValue={(next) => {
            if (next !== null) onChange(next);
        }}
        adjustment={
            <GtkAdjustment value={value} lower={lower} upper={upper} stepIncrement={step} pageIncrement={page} />
        }
    />
);

const AnimationsPage = () => {
    const [sample, setSample] = useState<Adw.Bin | null>(null);
    const [target, setTarget] = useState<Adw.CallbackAnimationTarget | null>(null);
    const [stack, setStack] = useState<Adw.ViewStack | null>(null);
    const [kind, setKind] = useState("Timed");
    const [timedState, setTimedState] = useState(Adw.AnimationState.IDLE);
    const [springState, setSpringState] = useState(Adw.AnimationState.IDLE);
    const [easing, setEasing] = useState<Adw.Easing>(Adw.Easing.EASE_IN_OUT_CUBIC);
    const [duration, setDuration] = useState(500);
    const [repeatCount, setRepeatCount] = useState(1);
    const [reverse, setReverse] = useState(false);
    const [alternate, setAlternate] = useState(false);
    const [velocity, setVelocity] = useState(0);
    const [damping, setDamping] = useState(10);
    const [mass, setMass] = useState(1);
    const [stiffness, setStiffness] = useState(100);
    const [epsilon, setEpsilon] = useState(0.001);
    const [clamp, setClamp] = useState(false);
    const timed = useRef<Adw.TimedAnimation | null>(null);
    const spring = useRef<Adw.SpringAnimation | null>(null);
    const [easingModel] = useState(() => Gtk.StringList.new(easingLabels));
    const progress = useRef(0);
    const params = useMemo(() => Adw.SpringParams.newFull(damping, mass, stiffness), [damping, mass, stiffness]);
    const attachSample = useCallback((widget: Adw.Bin | null) => {
        setSample(widget);
        setTarget(
            widget === null
                ? null
                : Adw.CallbackAnimationTarget.new((value) => {
                      progress.current = value;
                      widget.queueAllocate();
                  }),
        );
    }, []);

    useEffect(
        () => () => {
            timed.current?.pause();
            spring.current?.pause();
        },
        [],
    );

    const reset = () => {
        timed.current?.reset();
        spring.current?.reset();
    };
    const playing = timedState === Adw.AnimationState.PLAYING || springState === Adw.AnimationState.PLAYING;
    const playPause = () => {
        const animation = kind === "Timed" ? timed.current : spring.current;
        if (animation?.getState() === Adw.AnimationState.PLAYING) {
            animation.pause();
        } else if (animation?.getState() === Adw.AnimationState.PAUSED) {
            animation.resume();
        } else {
            animation?.play();
        }
    };

    return (
        <>
            {sample &&
                target &&
                createPortal(
                    <>
                        <AdwTimedAnimation
                            ref={timed}
                            widget={sample}
                            target={target}
                            valueFrom={0}
                            valueTo={1}
                            duration={duration}
                            easing={easing}
                            repeatCount={repeatCount}
                            reverse={reverse}
                            alternate={alternate}
                            followEnableAnimationsSetting={false}
                            onNotifyState={(state) => setTimedState(state ?? Adw.AnimationState.IDLE)}
                        />
                        <AdwSpringAnimation
                            ref={spring}
                            widget={sample}
                            target={target}
                            valueFrom={0}
                            valueTo={1}
                            springParams={params}
                            initialVelocity={velocity}
                            epsilon={epsilon}
                            clamp={clamp}
                            followEnableAnimationsSetting={false}
                            onNotifyState={(state) => setSpringState(state ?? Adw.AnimationState.IDLE)}
                        />
                    </>,
                    rootElement,
                )}
            <AdwToolbarView top={<AdwHeaderBar showTitle={false} />}>
                <GtkScrolledWindow hscrollbarPolicy={Gtk.PolicyType.NEVER}>
                    <GtkBox
                        orientation={Gtk.Orientation.VERTICAL}
                        valign={Gtk.Align.CENTER}
                        cssClasses={["timed-animation-page"]}
                    >
                        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                            <AdwClamp maximumSize={400} tighteningThreshold={300}>
                                <AdwBin
                                    ref={attachSample}
                                    marginBottom={36}
                                    layoutManager={
                                        <GtkCustomLayout
                                            measure={(widget, orientation, forSize) =>
                                                widget.getFirstChild()?.measure(orientation, forSize) ?? [0, 0, -1, -1]
                                            }
                                            allocate={(widget, width, height, baseline) => {
                                                const child = widget.getFirstChild();
                                                if (child === null) return;
                                                const [childWidth] = child.measure(Gtk.Orientation.HORIZONTAL, -1);
                                                const offset = Math.trunc(
                                                    (width - childWidth) * (progress.current - 0.5),
                                                );
                                                child.allocate(
                                                    width,
                                                    height,
                                                    baseline,
                                                    Gsk.Transform.new().translate(
                                                        new Graphene.Point({ x: offset, y: 0 }),
                                                    ),
                                                );
                                            }}
                                        />
                                    }
                                >
                                    <AdwBin
                                        halign={Gtk.Align.CENTER}
                                        valign={Gtk.Align.CENTER}
                                        name="animation-sample"
                                    />
                                </AdwBin>
                            </AdwClamp>
                            <GtkLabel wrap justify={Gtk.Justification.CENTER} cssClasses={["title", "title-1"]}>
                                Animations
                            </GtkLabel>
                            <GtkLabel wrap justify={Gtk.Justification.CENTER} cssClasses={["body", "description"]}>
                                Simple transitions
                            </GtkLabel>
                        </GtkBox>
                        <GtkBox
                            textDirection={Gtk.TextDirection.LTR}
                            valign={Gtk.Align.CENTER}
                            halign={Gtk.Align.CENTER}
                            marginTop={30}
                            marginBottom={30}
                            spacing={18}
                        >
                            <GtkButton
                                iconName="media-skip-backward-symbolic"
                                accessibleLabel="Reset animation"
                                tooltipText="Reset"
                                valign={Gtk.Align.CENTER}
                                cssClasses={["circular", "flat"]}
                                onClicked={reset}
                                sensitive={
                                    timedState !== Adw.AnimationState.IDLE || springState !== Adw.AnimationState.IDLE
                                }
                            />
                            <GtkButton
                                iconName={playing ? "media-playback-pause-symbolic" : "media-playback-start-symbolic"}
                                accessibleLabel={playing ? "Pause animation" : "Play animation"}
                                onClicked={playPause}
                                widthRequest={48}
                                heightRequest={48}
                                cssClasses={["circular", "suggested-action"]}
                            />
                            <GtkButton
                                iconName="media-skip-forward-symbolic"
                                accessibleLabel="Skip animation"
                                tooltipText="Skip"
                                valign={Gtk.Align.CENTER}
                                cssClasses={["circular", "flat"]}
                                sensitive={
                                    timedState !== Adw.AnimationState.FINISHED &&
                                    springState !== Adw.AnimationState.FINISHED
                                }
                                onClicked={() => {
                                    timed.current?.skip();
                                    spring.current?.skip();
                                }}
                            />
                        </GtkBox>
                        <AdwPreferencesGroup>
                            {stack && (
                                <AdwInlineViewSwitcher
                                    stack={stack}
                                    homogeneous
                                    halign={Gtk.Align.CENTER}
                                    widthRequest={250}
                                    marginBottom={32}
                                />
                            )}
                        </AdwPreferencesGroup>
                        <AdwClamp maximumSize={400} tighteningThreshold={300}>
                            <AdwViewStack
                                ref={setStack}
                                vhomogeneous={false}
                                enableTransitions
                                visibleChildName={kind}
                                onNotifyVisibleChildName={(name) => {
                                    if (name) {
                                        setKind(name);
                                        reset();
                                    }
                                }}
                            >
                                <AdwViewStackPage title="Timed" name="Timed">
                                    <AdwPreferencesGroup valign={Gtk.Align.START}>
                                        <AdwComboRow
                                            title="Easing"
                                            model={easingModel}
                                            selected={easing}
                                            onNotifySelected={(next) => {
                                                if (next !== null) setEasing(next);
                                            }}
                                        />
                                        <NumberRow
                                            title="Duration"
                                            value={duration}
                                            lower={100}
                                            upper={4000}
                                            step={50}
                                            page={100}
                                            onChange={setDuration}
                                        />
                                        <NumberRow
                                            title="Repeat Count"
                                            value={repeatCount}
                                            lower={0}
                                            upper={10}
                                            page={1}
                                            onChange={setRepeatCount}
                                        />
                                        <AdwSwitchRow
                                            title="Reverse"
                                            active={reverse}
                                            onNotifyActive={(active) => setReverse(active ?? false)}
                                        />
                                        <AdwSwitchRow
                                            title="Alternate"
                                            active={alternate}
                                            onNotifyActive={(active) => setAlternate(active ?? false)}
                                        />
                                    </AdwPreferencesGroup>
                                </AdwViewStackPage>
                                <AdwViewStackPage title="Spring" name="Spring">
                                    <AdwPreferencesGroup valign={Gtk.Align.START}>
                                        <NumberRow
                                            title="Initial Velocity"
                                            value={velocity}
                                            lower={-1000}
                                            upper={1000}
                                            onChange={setVelocity}
                                        />
                                        <NumberRow
                                            title="Damping"
                                            value={damping}
                                            lower={0}
                                            upper={1000}
                                            onChange={setDamping}
                                        />
                                        <NumberRow title="Mass" value={mass} lower={1} upper={100} onChange={setMass} />
                                        <NumberRow
                                            title="Stiffness"
                                            value={stiffness}
                                            lower={1}
                                            upper={1000}
                                            onChange={setStiffness}
                                        />
                                        <NumberRow
                                            title="Epsilon"
                                            value={epsilon}
                                            lower={0.0001}
                                            upper={0.01}
                                            step={0.001}
                                            page={0.001}
                                            digits={5}
                                            onChange={setEpsilon}
                                        />
                                        <AdwSwitchRow
                                            title="Clamp"
                                            active={clamp}
                                            onNotifyActive={(active) => setClamp(active ?? false)}
                                        />
                                    </AdwPreferencesGroup>
                                </AdwViewStackPage>
                            </AdwViewStack>
                        </AdwClamp>
                    </GtkBox>
                </GtkScrolledWindow>
            </AdwToolbarView>
        </>
    );
};

export { AnimationsPage };
