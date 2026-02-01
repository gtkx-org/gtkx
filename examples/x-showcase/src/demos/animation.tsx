import * as Adw from "@gtkx/ffi/adw";
import * as Gtk from "@gtkx/ffi/gtk";
import {
    AdwPreferencesGroup,
    GtkBox,
    GtkButton,
    GtkFrame,
    GtkGestureClick,
    GtkGestureDrag,
    GtkGestureLongPress,
    GtkGestureSwipe,
    GtkLabel,
    GtkScale,
    x,
} from "@gtkx/react";
import { useState } from "react";

type TransformState = "initial" | "translateX" | "translateY" | "scale" | "rotate";

const EASING_DEMOS = [
    { name: "LINEAR", easing: Adw.Easing.LINEAR },
    { name: "EASE_OUT_QUAD", easing: Adw.Easing.EASE_OUT_QUAD },
    { name: "EASE_OUT_CUBIC", easing: Adw.Easing.EASE_OUT_CUBIC },
    { name: "EASE_OUT_ELASTIC", easing: Adw.Easing.EASE_OUT_ELASTIC },
    { name: "EASE_OUT_BOUNCE", easing: Adw.Easing.EASE_OUT_BOUNCE },
    { name: "EASE_OUT_BACK", easing: Adw.Easing.EASE_OUT_BACK },
];

const BasicFadeDemo = () => (
    <AdwPreferencesGroup title="Basic Timed Animation" description="Fade-in on mount using animateOnMount">
        <GtkFrame marginTop={12}>
            <GtkBox
                orientation={Gtk.Orientation.VERTICAL}
                spacing={12}
                marginTop={24}
                marginBottom={24}
                marginStart={24}
                marginEnd={24}
                halign={Gtk.Align.CENTER}
            >
                <x.Animation
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ mode: "timed", duration: 800 }}
                    animateOnMount
                >
                    <GtkLabel label="I faded in on mount" cssClasses={["title-2"]} />
                </x.Animation>
            </GtkBox>
        </GtkFrame>
    </AdwPreferencesGroup>
);

const TransformDemo = () => {
    const [state, setState] = useState<TransformState>("initial");

    const getAnimateProps = () => {
        switch (state) {
            case "translateX":
                return { translateX: 100 };
            case "translateY":
                return { translateY: 50 };
            case "scale":
                return { scale: 1.5 };
            case "rotate":
                return { rotate: 180 };
            default:
                return { translateX: 0, translateY: 0, scale: 1, rotate: 0 };
        }
    };

    return (
        <AdwPreferencesGroup title="Transform Animations" description="Click buttons to trigger different transforms">
            <GtkFrame marginTop={12}>
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={16}
                    marginTop={24}
                    marginBottom={24}
                    marginStart={24}
                    marginEnd={24}
                >
                    <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={8} halign={Gtk.Align.CENTER}>
                        <GtkButton label="Reset" onClicked={() => setState("initial")} />
                        <GtkButton label="Translate X" onClicked={() => setState("translateX")} />
                        <GtkButton label="Translate Y" onClicked={() => setState("translateY")} />
                        <GtkButton label="Scale" onClicked={() => setState("scale")} />
                        <GtkButton label="Rotate" onClicked={() => setState("rotate")} />
                    </GtkBox>
                    <GtkBox halign={Gtk.Align.CENTER} heightRequest={100} valign={Gtk.Align.CENTER}>
                        <x.Animation
                            initial={false}
                            animate={getAnimateProps()}
                            transition={{ mode: "timed", duration: 400, easing: Adw.Easing.EASE_OUT_CUBIC }}
                        >
                            <GtkFrame widthRequest={80} heightRequest={80}>
                                <GtkLabel label="Target" halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} />
                            </GtkFrame>
                        </x.Animation>
                    </GtkBox>
                    <GtkLabel
                        label={`Current transform: ${state === "initial" ? "none" : state}`}
                        cssClasses={["dim-label"]}
                        halign={Gtk.Align.CENTER}
                    />
                </GtkBox>
            </GtkFrame>
        </AdwPreferencesGroup>
    );
};

const EasingBox = ({ name, easing, trigger }: { name: string; easing: Adw.Easing; trigger: number }) => (
    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4} widthRequest={120}>
        <x.Animation
            initial={false}
            animate={{ translateX: trigger % 2 === 0 ? 0 : 60 }}
            transition={{ mode: "timed", duration: 800, easing }}
        >
            <GtkFrame widthRequest={40} heightRequest={40}>
                <GtkLabel label="" />
            </GtkFrame>
        </x.Animation>
        <GtkLabel label={name} cssClasses={["caption", "dim-label"]} />
    </GtkBox>
);

const EasingComparisonDemo = () => {
    const [trigger, setTrigger] = useState(0);

    return (
        <AdwPreferencesGroup title="Easing Comparison" description="Compare different easing functions side by side">
            <GtkFrame marginTop={12}>
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={16}
                    marginTop={24}
                    marginBottom={24}
                    marginStart={24}
                    marginEnd={24}
                >
                    <GtkButton
                        label="Replay All"
                        onClicked={() => setTrigger((t) => t + 1)}
                        halign={Gtk.Align.CENTER}
                    />
                    <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12} halign={Gtk.Align.CENTER} homogeneous>
                        {EASING_DEMOS.map(({ name, easing }) => (
                            <EasingBox key={name} name={name} easing={easing} trigger={trigger} />
                        ))}
                    </GtkBox>
                </GtkBox>
            </GtkFrame>
        </AdwPreferencesGroup>
    );
};

const SpringDemo = () => {
    const [damping, setDamping] = useState(0.7);
    const [stiffness, setStiffness] = useState(100);
    const [mass, setMass] = useState(1);
    const [trigger, setTrigger] = useState(0);

    return (
        <AdwPreferencesGroup title="Spring Physics" description="Adjust parameters to see different spring behaviors">
            <GtkFrame marginTop={12}>
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={16}
                    marginTop={24}
                    marginBottom={24}
                    marginStart={24}
                    marginEnd={24}
                >
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                        <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={8}>
                            <GtkLabel
                                label={`Damping: ${damping.toFixed(2)}`}
                                widthRequest={120}
                                halign={Gtk.Align.START}
                            />
                            <GtkScale
                                hexpand
                                value={damping}
                                lower={0.1}
                                upper={2}
                                stepIncrement={0.1}
                                pageIncrement={0.2}
                                onValueChanged={setDamping}
                            />
                        </GtkBox>
                        <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={8}>
                            <GtkLabel
                                label={`Stiffness: ${stiffness.toFixed(0)}`}
                                widthRequest={120}
                                halign={Gtk.Align.START}
                            />
                            <GtkScale
                                hexpand
                                value={stiffness}
                                lower={10}
                                upper={500}
                                stepIncrement={10}
                                pageIncrement={50}
                                onValueChanged={setStiffness}
                            />
                        </GtkBox>
                        <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={8}>
                            <GtkLabel label={`Mass: ${mass.toFixed(1)}`} widthRequest={120} halign={Gtk.Align.START} />
                            <GtkScale
                                hexpand
                                value={mass}
                                lower={0.1}
                                upper={5}
                                stepIncrement={0.1}
                                pageIncrement={0.5}
                                onValueChanged={setMass}
                            />
                        </GtkBox>
                    </GtkBox>
                    <GtkButton label="Bounce" onClicked={() => setTrigger((t) => t + 1)} halign={Gtk.Align.CENTER} />
                    <GtkBox halign={Gtk.Align.CENTER} heightRequest={80} valign={Gtk.Align.CENTER}>
                        <x.Animation
                            initial={false}
                            animate={{ translateX: trigger % 2 === 0 ? 0 : 150 }}
                            transition={{ mode: "spring", damping, stiffness, mass }}
                        >
                            <GtkFrame widthRequest={60} heightRequest={60} cssClasses={["card"]}>
                                <GtkLabel label="" />
                            </GtkFrame>
                        </x.Animation>
                    </GtkBox>
                </GtkBox>
            </GtkFrame>
        </AdwPreferencesGroup>
    );
};

const ListItem = ({ id, onRemove }: { id: number; onRemove: () => void }) => (
    <x.Animation
        initial={{ opacity: 0, translateX: -20 }}
        animate={{ opacity: 1, translateX: 0 }}
        exit={{ opacity: 0, translateX: 20 }}
        transition={{ mode: "timed", duration: 250 }}
        animateOnMount
    >
        <GtkBox
            orientation={Gtk.Orientation.HORIZONTAL}
            spacing={12}
            marginTop={4}
            marginBottom={4}
            marginStart={12}
            marginEnd={12}
        >
            <GtkLabel label={`Item ${id}`} hexpand halign={Gtk.Align.START} />
            <GtkButton iconName="window-close-symbolic" cssClasses={["flat", "circular"]} onClicked={onRemove} />
        </GtkBox>
    </x.Animation>
);

const EnterExitDemo = () => {
    const [items, setItems] = useState([1, 2, 3]);
    const [nextId, setNextId] = useState(4);

    const addItem = () => {
        setItems([...items, nextId]);
        setNextId(nextId + 1);
    };

    const removeItem = (id: number) => {
        setItems(items.filter((item) => item !== id));
    };

    return (
        <AdwPreferencesGroup title="Enter/Exit Animations" description="Items animate in and out of the list">
            <GtkFrame marginTop={12}>
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={8}
                    marginTop={16}
                    marginBottom={16}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkButton label="Add Item" onClicked={addItem} halign={Gtk.Align.CENTER} />
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4}>
                        {items.map((id) => (
                            <ListItem key={id} id={id} onRemove={() => removeItem(id)} />
                        ))}
                    </GtkBox>
                    {items.length === 0 && (
                        <GtkLabel
                            label="No items - click Add Item"
                            cssClasses={["dim-label"]}
                            halign={Gtk.Align.CENTER}
                        />
                    )}
                </GtkBox>
            </GtkFrame>
        </AdwPreferencesGroup>
    );
};

const RepeatingDemo = () => (
    <AdwPreferencesGroup
        title="Repeating and Alternating"
        description="Continuous animations with repeat and alternate"
    >
        <GtkFrame marginTop={12}>
            <GtkBox
                orientation={Gtk.Orientation.HORIZONTAL}
                spacing={48}
                marginTop={24}
                marginBottom={24}
                marginStart={24}
                marginEnd={24}
                halign={Gtk.Align.CENTER}
            >
                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8} halign={Gtk.Align.CENTER}>
                    <x.Animation
                        initial={{ scale: 0.8, opacity: 0.5 }}
                        animate={{ scale: 1.2, opacity: 1 }}
                        transition={{ mode: "timed", duration: 800, repeat: -1, alternate: true, easing: Adw.Easing.EASE_IN_OUT }}
                        animateOnMount
                    >
                        <GtkFrame widthRequest={60} heightRequest={60} cssClasses={["card"]}>
                            <GtkLabel label="" />
                        </GtkFrame>
                    </x.Animation>
                    <GtkLabel label="Pulse" cssClasses={["caption", "dim-label"]} />
                </GtkBox>
                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8} halign={Gtk.Align.CENTER}>
                    <x.Animation
                        initial={{ rotate: 0 }}
                        animate={{ rotate: 360 }}
                        transition={{ mode: "timed", duration: 1500, repeat: -1, easing: Adw.Easing.LINEAR }}
                        animateOnMount
                    >
                        <GtkFrame widthRequest={60} heightRequest={60} cssClasses={["card"]}>
                            <GtkLabel
                                label="⟳"
                                cssClasses={["title-1"]}
                                halign={Gtk.Align.CENTER}
                                valign={Gtk.Align.CENTER}
                            />
                        </GtkFrame>
                    </x.Animation>
                    <GtkLabel label="Spinner" cssClasses={["caption", "dim-label"]} />
                </GtkBox>
                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8} halign={Gtk.Align.CENTER}>
                    <x.Animation
                        initial={{ translateY: 0 }}
                        animate={{ translateY: -20 }}
                        transition={{ mode: "timed", duration: 600, repeat: -1, alternate: true, easing: Adw.Easing.EASE_IN_OUT_QUAD }}
                        animateOnMount
                    >
                        <GtkFrame widthRequest={60} heightRequest={60} cssClasses={["card"]}>
                            <GtkLabel label="" />
                        </GtkFrame>
                    </x.Animation>
                    <GtkLabel label="Bounce" cssClasses={["caption", "dim-label"]} />
                </GtkBox>
            </GtkBox>
        </GtkFrame>
    </AdwPreferencesGroup>
);

const CombinedDemo = () => {
    const [active, setActive] = useState(false);

    return (
        <AdwPreferencesGroup title="Combined Properties" description="Multiple properties animated together">
            <GtkFrame marginTop={12}>
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={16}
                    marginTop={24}
                    marginBottom={24}
                    marginStart={24}
                    marginEnd={24}
                >
                    <GtkButton
                        label={active ? "Reset" : "Animate"}
                        onClicked={() => setActive(!active)}
                        halign={Gtk.Align.CENTER}
                    />
                    <GtkBox halign={Gtk.Align.CENTER} heightRequest={120} valign={Gtk.Align.CENTER}>
                        <x.Animation
                            initial={false}
                            animate={
                                active
                                    ? { opacity: 1, scale: 1.3, rotate: 180, translateY: -20 }
                                    : { opacity: 0.5, scale: 1, rotate: 0, translateY: 0 }
                            }
                            transition={{ mode: "timed", duration: 600, easing: Adw.Easing.EASE_OUT_BACK }}
                        >
                            <GtkFrame widthRequest={80} heightRequest={80} cssClasses={["card"]}>
                                <GtkLabel label="Multi" halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} />
                            </GtkFrame>
                        </x.Animation>
                    </GtkBox>
                    <GtkLabel
                        label="Animates: opacity, scale, rotate, translateY"
                        cssClasses={["caption", "dim-label"]}
                        halign={Gtk.Align.CENTER}
                    />
                </GtkBox>
            </GtkFrame>
        </AdwPreferencesGroup>
    );
};

const DragDemo = () => {
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);

    return (
        <AdwPreferencesGroup title="Drag Gesture" description="Drag the card to move it, release to spring back">
            <GtkFrame marginTop={12}>
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={16}
                    marginTop={24}
                    marginBottom={24}
                    marginStart={24}
                    marginEnd={24}
                >
                    <GtkBox halign={Gtk.Align.CENTER} heightRequest={150} valign={Gtk.Align.CENTER}>
                        <x.Animation
                            initial={false}
                            animate={
                                isDragging
                                    ? { translateX: offset.x, translateY: offset.y }
                                    : { translateX: 0, translateY: 0 }
                            }
                            transition={{ mode: "spring", damping: 0.7, stiffness: 150, mass: 1 }}
                        >
                            <GtkFrame widthRequest={100} heightRequest={100} cssClasses={["card"]}>
                                <GtkGestureDrag
                                    onDragBegin={() => setIsDragging(true)}
                                    onDragUpdate={(offsetX, offsetY) => setOffset({ x: offsetX, y: offsetY })}
                                    onDragEnd={() => {
                                        setIsDragging(false);
                                        setOffset({ x: 0, y: 0 });
                                    }}
                                />
                                <GtkLabel label="Drag me" halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} />
                            </GtkFrame>
                        </x.Animation>
                    </GtkBox>
                    <GtkLabel
                        label={
                            isDragging
                                ? `Offset: (${Math.round(offset.x)}, ${Math.round(offset.y)})`
                                : "Drag and release"
                        }
                        cssClasses={["caption", "dim-label"]}
                        halign={Gtk.Align.CENTER}
                    />
                </GtkBox>
            </GtkFrame>
        </AdwPreferencesGroup>
    );
};

const PressScaleDemo = () => {
    const [isPressed, setIsPressed] = useState(false);

    return (
        <AdwPreferencesGroup title="Press Gesture" description="Press and hold to scale down, release to spring back">
            <GtkFrame marginTop={12}>
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={16}
                    marginTop={24}
                    marginBottom={24}
                    marginStart={24}
                    marginEnd={24}
                >
                    <GtkBox halign={Gtk.Align.CENTER} heightRequest={120} valign={Gtk.Align.CENTER}>
                        <x.Animation
                            initial={false}
                            animate={isPressed ? { scale: 0.85, opacity: 0.7 } : { scale: 1, opacity: 1 }}
                            transition={{ mode: "spring", damping: 0.6, stiffness: 300, mass: 0.8 }}
                        >
                            <GtkFrame widthRequest={100} heightRequest={100} cssClasses={["card"]}>
                                <GtkGestureClick
                                    onPressed={() => setIsPressed(true)}
                                    onReleased={() => setIsPressed(false)}
                                    onStopped={() => setIsPressed(false)}
                                />
                                <GtkLabel label="Press" halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} />
                            </GtkFrame>
                        </x.Animation>
                    </GtkBox>
                    <GtkLabel
                        label={isPressed ? "Pressed!" : "Press and hold the card"}
                        cssClasses={["caption", "dim-label"]}
                        halign={Gtk.Align.CENTER}
                    />
                </GtkBox>
            </GtkFrame>
        </AdwPreferencesGroup>
    );
};

const LongPressDemo = () => {
    const [triggered, setTriggered] = useState(false);
    const [isPressing, setIsPressing] = useState(false);

    return (
        <AdwPreferencesGroup title="Long Press Gesture" description="Hold for a moment to trigger the animation">
            <GtkFrame marginTop={12}>
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={16}
                    marginTop={24}
                    marginBottom={24}
                    marginStart={24}
                    marginEnd={24}
                >
                    <GtkBox halign={Gtk.Align.CENTER} heightRequest={120} valign={Gtk.Align.CENTER}>
                        <x.Animation
                            initial={false}
                            animate={
                                triggered
                                    ? { scale: 1.2, rotate: 360 }
                                    : isPressing
                                      ? { scale: 0.95 }
                                      : { scale: 1, rotate: 0 }
                            }
                            transition={{ mode: "spring", damping: 0.5, stiffness: 100, mass: 1 }}
                            onAnimationComplete={() => {
                                if (triggered) {
                                    setTimeout(() => setTriggered(false), 500);
                                }
                            }}
                        >
                            <GtkFrame widthRequest={100} heightRequest={100} cssClasses={["card"]}>
                                <GtkGestureLongPress
                                    onPressed={() => {
                                        setTriggered(true);
                                        setIsPressing(false);
                                    }}
                                    onCancelled={() => setIsPressing(false)}
                                />
                                <GtkGestureClick
                                    onPressed={() => setIsPressing(true)}
                                    onReleased={() => setIsPressing(false)}
                                    onStopped={() => setIsPressing(false)}
                                />
                                <GtkLabel label="Hold" halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} />
                            </GtkFrame>
                        </x.Animation>
                    </GtkBox>
                    <GtkLabel
                        label={triggered ? "Triggered!" : isPressing ? "Keep holding..." : "Long press the card"}
                        cssClasses={["caption", "dim-label"]}
                        halign={Gtk.Align.CENTER}
                    />
                </GtkBox>
            </GtkFrame>
        </AdwPreferencesGroup>
    );
};

type SwipeCard = { id: number; dismissed: boolean; direction: "left" | "right" | null };

const SwipeCardItem = ({
    card,
    onDismiss,
}: {
    card: SwipeCard;
    onDismiss: (id: number, direction: "left" | "right") => void;
}) => {
    const [swipeOffset, setSwipeOffset] = useState(0);
    const [isDismissing, setIsDismissing] = useState(false);

    if (card.dismissed) {
        return null;
    }

    const threshold = 100;
    const rotation = swipeOffset * 0.1;

    return (
        <x.Animation
            initial={false}
            animate={
                isDismissing
                    ? {
                          translateX: card.direction === "left" ? -300 : 300,
                          opacity: 0,
                          rotate: card.direction === "left" ? -30 : 30,
                      }
                    : { translateX: swipeOffset, rotate: rotation, opacity: 1 }
            }
            transition={{ mode: "spring", damping: 0.8, stiffness: 200, mass: 1 }}
            onAnimationComplete={() => {
                if (isDismissing && card.direction) {
                    onDismiss(card.id, card.direction);
                }
            }}
        >
            <GtkFrame widthRequest={200} heightRequest={80} cssClasses={["card"]} marginTop={4} marginBottom={4}>
                <GtkGestureSwipe
                    onSwipe={(velocityX) => {
                        if (Math.abs(swipeOffset) > threshold || Math.abs(velocityX) > 500) {
                            const direction = swipeOffset > 0 || velocityX > 0 ? "right" : "left";
                            card.direction = direction;
                            setIsDismissing(true);
                        } else {
                            setSwipeOffset(0);
                        }
                    }}
                />
                <GtkGestureDrag
                    onDragUpdate={(offsetX) => setSwipeOffset(offsetX)}
                    onDragEnd={() => {
                        if (Math.abs(swipeOffset) <= threshold) {
                            setSwipeOffset(0);
                        }
                    }}
                />
                <GtkLabel label={`Card ${card.id}`} halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} />
            </GtkFrame>
        </x.Animation>
    );
};

const SwipeDemo = () => {
    const [cards, setCards] = useState<SwipeCard[]>([
        { id: 1, dismissed: false, direction: null },
        { id: 2, dismissed: false, direction: null },
        { id: 3, dismissed: false, direction: null },
    ]);
    const [nextId, setNextId] = useState(4);
    const [lastDismissed, setLastDismissed] = useState<{ id: number; direction: string } | null>(null);

    const handleDismiss = (id: number, direction: "left" | "right") => {
        setCards((prev) => prev.map((c) => (c.id === id ? { ...c, dismissed: true } : c)));
        setLastDismissed({ id, direction });
    };

    const addCard = () => {
        setCards((prev) => [...prev, { id: nextId, dismissed: false, direction: null }]);
        setNextId((id) => id + 1);
    };

    const activeCards = cards.filter((c) => !c.dismissed);

    return (
        <AdwPreferencesGroup title="Swipe Gesture" description="Swipe cards left or right to dismiss them">
            <GtkFrame marginTop={12}>
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={16}
                    marginBottom={16}
                    marginStart={24}
                    marginEnd={24}
                >
                    <GtkButton label="Add Card" onClicked={addCard} halign={Gtk.Align.CENTER} />
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} halign={Gtk.Align.CENTER} heightRequest={120}>
                        {activeCards.map((card) => (
                            <SwipeCardItem key={card.id} card={card} onDismiss={handleDismiss} />
                        ))}
                        {activeCards.length === 0 && (
                            <GtkLabel
                                label="No cards - add some!"
                                cssClasses={["dim-label"]}
                                valign={Gtk.Align.CENTER}
                            />
                        )}
                    </GtkBox>
                    <GtkLabel
                        label={
                            lastDismissed
                                ? `Card ${lastDismissed.id} swiped ${lastDismissed.direction}`
                                : "Swipe to dismiss"
                        }
                        cssClasses={["caption", "dim-label"]}
                        halign={Gtk.Align.CENTER}
                    />
                </GtkBox>
            </GtkFrame>
        </AdwPreferencesGroup>
    );
};

const DoubleTapDemo = () => {
    const [scale, setScale] = useState(1);

    return (
        <AdwPreferencesGroup title="Double Tap Gesture" description="Double-tap to toggle zoom">
            <GtkFrame marginTop={12}>
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={16}
                    marginTop={24}
                    marginBottom={24}
                    marginStart={24}
                    marginEnd={24}
                >
                    <GtkBox halign={Gtk.Align.CENTER} heightRequest={150} valign={Gtk.Align.CENTER}>
                        <x.Animation
                            initial={false}
                            animate={{ scale }}
                            transition={{ mode: "spring", damping: 0.6, stiffness: 150, mass: 1 }}
                        >
                            <GtkFrame widthRequest={100} heightRequest={100} cssClasses={["card"]}>
                                <GtkGestureClick
                                    onPressed={(nPress) => {
                                        if (nPress === 2) {
                                            setScale((s) => (s === 1 ? 1.5 : 1));
                                        }
                                    }}
                                />
                                <GtkLabel label="2x Tap" halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} />
                            </GtkFrame>
                        </x.Animation>
                    </GtkBox>
                    <GtkLabel
                        label={scale === 1 ? "Double-tap to zoom in" : "Double-tap to zoom out"}
                        cssClasses={["caption", "dim-label"]}
                        halign={Gtk.Align.CENTER}
                    />
                </GtkBox>
            </GtkFrame>
        </AdwPreferencesGroup>
    );
};

export const AnimationDemo = () => (
    <GtkBox
        orientation={Gtk.Orientation.VERTICAL}
        spacing={24}
        marginTop={24}
        marginBottom={24}
        marginStart={24}
        marginEnd={24}
    >
        <GtkLabel label="Animation" cssClasses={["title-1"]} halign={Gtk.Align.START} />
        <BasicFadeDemo />
        <TransformDemo />
        <EasingComparisonDemo />
        <SpringDemo />
        <EnterExitDemo />
        <RepeatingDemo />
        <CombinedDemo />
        <GtkLabel label="Gesture-Driven Animation" cssClasses={["title-1"]} halign={Gtk.Align.START} marginTop={24} />
        <DragDemo />
        <PressScaleDemo />
        <LongPressDemo />
        <SwipeDemo />
        <DoubleTapDemo />
    </GtkBox>
);
