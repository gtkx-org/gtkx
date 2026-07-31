import type * as Gio from "@gtkx/gi/gio";
import type * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkConstraint, GtkConstraintGuide, GtkConstraintLayout } from "@gtkx/jsx/gtk";
import { render } from "@gtkx/testing";
import { createRef, type ReactNode, type RefObject, useMemo, useState } from "react";
import { describe, expect, it } from "vitest";

type Constructor<T> = abstract new (...args: never[]) => T;

type ConstrainedBoxProps = {
    boxRef: RefObject<Gtk.Box | null>;
    build: (button: Gtk.Button) => ReactNode;
    guides?: ReactNode;
};

const A = Gtk.ConstraintAttribute;
const R = Gtk.ConstraintRelation;
const S = Gtk.ConstraintStrength;
const VFL_LINES = ["H:|-[a(==b)]-12-[b]-|", "V:|-[a]-|"];
const WIDER_VFL_LINES = [...VFL_LINES, "V:|-[b]-|"];

const layoutFrom = (boxRef: RefObject<Gtk.Box | null>): Gtk.ConstraintLayout =>
    boxRef.current?.getLayoutManager() as Gtk.ConstraintLayout;

const collectItems = <T extends GObject.Object>(model: Gio.ListModel, Type: Constructor<T>): T[] => {
    const items: T[] = [];

    for (let index = 0; index < model.getNItems(); index++) {
        const item = model.getItem(index);

        if (item instanceof Type) {
            items.push(item);
        }
    }

    return items;
};

const collectConstraints = (layout: Gtk.ConstraintLayout): Gtk.Constraint[] =>
    collectItems(layout.observeConstraints(), Gtk.Constraint);

const collectGuides = (layout: Gtk.ConstraintLayout): Gtk.ConstraintGuide[] =>
    collectItems(layout.observeGuides(), Gtk.ConstraintGuide);

const renderEmptyLayout = async (): Promise<RefObject<Gtk.Box | null>> => {
    const boxRef = createRef<Gtk.Box>();
    await render(<GtkBox ref={boxRef} layoutManager={<GtkConstraintLayout />} />);

    return boxRef;
};

const onlyConstraint = (boxRef: RefObject<Gtk.Box | null>): Gtk.Constraint => {
    const constraints = collectConstraints(layoutFrom(boxRef));
    expect(constraints).toHaveLength(1);
    const [constraint] = constraints;

    if (!constraint) {
        throw new Error("expected exactly one constraint");
    }

    return constraint;
};

const widthConstraint = (button: Gtk.Button, constant: number): ReactNode => (
    <GtkConstraint key={constant} target={button} targetAttribute={A.WIDTH} relation={R.LE} constant={constant} />
);

const startConstraint = (button: Gtk.Button): ReactNode => (
    <GtkConstraint
        target={button}
        targetAttribute={A.START}
        sourceAttribute={A.START}
        constant={8}
        strength={S.STRONG}
    />
);

const guideSourceConstraint = (button: Gtk.Button, guide: Gtk.ConstraintGuide): ReactNode => (
    <GtkConstraint target={button} targetAttribute={A.END} source={guide} sourceAttribute={A.START} />
);

function ConstrainedBox({ boxRef, build, guides }: ConstrainedBoxProps) {
    const [button, setButton] = useState<Gtk.Button | null>(null);

    return (
        <GtkBox
            ref={boxRef}
            layoutManager={<GtkConstraintLayout guides={guides} constraints={button && build(button)} />}
        >
            <GtkButton ref={setButton} label="A" />
        </GtkBox>
    );
}

function WidthBox({ boxRef, constant }: { boxRef: RefObject<Gtk.Box | null>; constant: number }) {
    return <ConstrainedBox boxRef={boxRef} build={(button) => widthConstraint(button, constant)} />;
}

function ToggledConstraintBox({ boxRef, isShown }: { boxRef: RefObject<Gtk.Box | null>; isShown: boolean }) {
    return <ConstrainedBox boxRef={boxRef} build={(button) => isShown && startConstraint(button)} />;
}

function GuideSourceBox({ boxRef }: { boxRef: RefObject<Gtk.Box | null> }) {
    const [guide, setGuide] = useState<Gtk.ConstraintGuide | null>(null);

    return (
        <ConstrainedBox
            boxRef={boxRef}
            guides={<GtkConstraintGuide ref={setGuide} name="divider" minWidth={0} natWidth={0} maxWidth={0} />}
            build={(button) => guide && guideSourceConstraint(button, guide)}
        />
    );
}

function GuideBox({ boxRef, isShown }: { boxRef: RefObject<Gtk.Box | null>; isShown: boolean }) {
    return (
        <GtkBox
            ref={boxRef}
            layoutManager={(
                <GtkConstraintLayout
                    guides={isShown && (
                        <GtkConstraintGuide
                            name="space"
                            minWidth={10}
                            minHeight={10}
                            natWidth={100}
                            natHeight={20}
                            maxWidth={200}
                            maxHeight={30}
                            strength={S.STRONG}
                        />
                    )}
                />
            )}
        />
    );
}

function VflBox({ boxRef, lines }: { boxRef: RefObject<Gtk.Box | null>; lines: string[] }) {
    const [a, setA] = useState<Gtk.Button | null>(null);
    const [b, setB] = useState<Gtk.Button | null>(null);

    const views = useMemo(
        () => (a === null || b === null ? null : new Map<string, Gtk.ConstraintTarget>([["a", a], ["b", b]])),
        [a, b],
    );

    return (
        <GtkBox
            ref={boxRef}
            layoutManager={<GtkConstraintLayout vfl={views && [{ lines, hspacing: 8, vspacing: 8, views }]} />}
        >
            <GtkButton ref={setA} label="A" />
            <GtkButton ref={setB} label="B" />
        </GtkBox>
    );
}

describe("render - GtkConstraintLayout attach", () => {
    it("installs the layout manager on the host widget", async () => {
        const boxRef = await renderEmptyLayout();
        expect(boxRef.current?.getLayoutManager()).toBeInstanceOf(Gtk.ConstraintLayout);
    });

    it("accepts a layout with no constraints or guides", async () => {
        const layout = layoutFrom(await renderEmptyLayout());
        expect(collectConstraints(layout)).toHaveLength(0);
        expect(collectGuides(layout)).toHaveLength(0);
    });
});

describe("render - GtkConstraint props", () => {
    it("builds a constraint from a widget reference", async () => {
        const boxRef = createRef<Gtk.Box>();
        await render(<WidthBox boxRef={boxRef} constant={100} />);
        const constraint = onlyConstraint(boxRef);
        expect(constraint).toHaveObjectProperty("target", boxRef.current?.getFirstChild());
        expect(constraint).toHaveObjectProperty("targetAttribute", A.WIDTH);
        expect(constraint).toHaveObjectProperty("relation", R.LE);
        expect(constraint).toHaveObjectProperty("constant", 100);
        expect(constraint).toHaveObjectProperty("multiplier", 1);
        expect(constraint).toHaveObjectProperty("strength", S.REQUIRED);
    });

    it("leaves an omitted source as the layout's own widget", async () => {
        const boxRef = createRef<Gtk.Box>();
        await render(<ToggledConstraintBox boxRef={boxRef} isShown={true} />);
        const constraint = onlyConstraint(boxRef);
        expect(constraint.getSource()).toBeNull();
        expect(constraint).toHaveObjectProperty("sourceAttribute", A.START);
        expect(constraint).toHaveObjectProperty("constant", 8);
        expect(constraint).toHaveObjectProperty("strength", S.STRONG);
    });
});

describe("render - GtkConstraint lifecycle", () => {
    it("recreates the constraint when its key changes with a construct-only prop", async () => {
        const boxRef = createRef<Gtk.Box>();
        const { rerender } = await render(<WidthBox boxRef={boxRef} constant={100} />);
        expect(onlyConstraint(boxRef)).toHaveObjectProperty("constant", 100);
        await rerender(<WidthBox boxRef={boxRef} constant={50} />);
        expect(onlyConstraint(boxRef)).toHaveObjectProperty("constant", 50);
    });

    it("removes the constraint from the layout when it unmounts", async () => {
        const boxRef = createRef<Gtk.Box>();
        const { rerender } = await render(<ToggledConstraintBox boxRef={boxRef} isShown={true} />);
        expect(collectConstraints(layoutFrom(boxRef))).toHaveLength(1);
        await rerender(<ToggledConstraintBox boxRef={boxRef} isShown={false} />);
        expect(collectConstraints(layoutFrom(boxRef))).toHaveLength(0);
    });
});

describe("render - GtkConstraintGuide", () => {
    it("adds a guide with its size and strength props", async () => {
        const boxRef = createRef<Gtk.Box>();
        await render(<GuideBox boxRef={boxRef} isShown={true} />);
        const guides = collectGuides(layoutFrom(boxRef));
        expect(guides).toHaveLength(1);
        const guide = guides[0] as Gtk.ConstraintGuide;
        expect(guide).toHaveObjectProperty("name", "space");
        expect(guide.getMinSize()).toEqual([10, 10]);
        expect(guide.getNatSize()).toEqual([100, 20]);
        expect(guide.getMaxSize()).toEqual([200, 30]);
        expect(guide).toHaveObjectProperty("strength", S.STRONG);
    });

    it("removes the guide from the layout when it unmounts", async () => {
        const boxRef = createRef<Gtk.Box>();
        const { rerender } = await render(<GuideBox boxRef={boxRef} isShown={true} />);
        expect(collectGuides(layoutFrom(boxRef))).toHaveLength(1);
        await rerender(<GuideBox boxRef={boxRef} isShown={false} />);
        expect(collectGuides(layoutFrom(boxRef))).toHaveLength(0);
    });

    it("resolves a guide passed as a constraint source", async () => {
        const boxRef = createRef<Gtk.Box>();
        await render(<GuideSourceBox boxRef={boxRef} />);
        const [guide] = collectGuides(layoutFrom(boxRef));
        const constraint = onlyConstraint(boxRef);
        expect(constraint).toHaveObjectProperty("source", guide);
        expect(constraint).toHaveObjectProperty("target", boxRef.current?.getFirstChild());
    });
});

describe("render - GtkConstraintLayout vfl", () => {
    it("adds the constraints a VFL description expands to", async () => {
        const boxRef = createRef<Gtk.Box>();
        await render(<VflBox boxRef={boxRef} lines={VFL_LINES} />);
        expect(collectConstraints(layoutFrom(boxRef)).length).toBeGreaterThanOrEqual(5);
    });

    it("re-parses the description when the lines change", async () => {
        const boxRef = createRef<Gtk.Box>();
        const { rerender } = await render(<VflBox boxRef={boxRef} lines={VFL_LINES} />);
        const initial = collectConstraints(layoutFrom(boxRef)).length;
        expect(initial).toBeGreaterThan(0);
        await rerender(<VflBox boxRef={boxRef} lines={WIDER_VFL_LINES} />);
        expect(collectConstraints(layoutFrom(boxRef)).length).toBeGreaterThan(initial);
    });

    it("rejects a description that names an unknown view", async () => {
        const boxRef = createRef<Gtk.Box>();
        await expect(render(<VflBox boxRef={boxRef} lines={["H:|-[ghost]-|"]} />)).rejects.toThrow();
    });
});
