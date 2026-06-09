import * as Gtk from "@gtkx/gi/gtk";
import { GtkConstraintLayout } from "@gtkx/react";
import { GtkBox } from "@gtkx/react-gi/gtk";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import {
    ButtonMarker,
    collectConstraints,
    collectGuides,
    firstConstraint,
    LabelMarker,
    layoutFrom,
    onlyConstraint,
} from "../helpers/constraint-layout-cases.js";

const A = Gtk.ConstraintAttribute;
const R = Gtk.ConstraintRelation;
const S = Gtk.ConstraintStrength;

describe("render - GtkConstraintLayout attach", () => {
    it("attaches a ConstraintLayout to the host widget", async () => {
        const boxRef = createRef<Gtk.Box>();

        await render(
            <GtkBox ref={boxRef}>
                <GtkConstraintLayout />
            </GtkBox>,
        );

        expect(boxRef.current?.getLayoutManager()).toBeInstanceOf(Gtk.ConstraintLayout);
    });

    it("accepts an empty <GtkConstraintLayout> without errors", async () => {
        const boxRef = createRef<Gtk.Box>();

        await render(
            <GtkBox ref={boxRef}>
                <GtkConstraintLayout />
            </GtkBox>,
        );

        const layout = layoutFrom(boxRef);
        expect(collectConstraints(layout)).toHaveLength(0);
        expect(collectGuides(layout)).toHaveLength(0);
    });
});

describe("render - GtkConstraintLayout.Widget registration (a)", () => {
    it("registers wrapped widgets so Constraint markers can resolve them", async () => {
        const boxRef = createRef<Gtk.Box>();
        const labelARef = createRef<Gtk.Label>();
        const labelBRef = createRef<Gtk.Label>();

        await render(
            <GtkBox ref={boxRef}>
                <GtkConstraintLayout>
                    <GtkConstraintLayout.Constraint
                        target="a"
                        targetAttribute={A.WIDTH}
                        source="b"
                        sourceAttribute={A.WIDTH}
                    />
                </GtkConstraintLayout>
                <LabelMarker id="a" label="A" labelRef={labelARef} />
                <LabelMarker id="b" label="B" labelRef={labelBRef} />
            </GtkBox>,
        );

        const c = onlyConstraint(boxRef);
        expect(c.getTarget()).toBe(labelARef.current);
        expect(c.getSource()).toBe(labelBRef.current);
        expect(c.getTargetAttribute()).toBe(A.WIDTH);
        expect(c.getSourceAttribute()).toBe(A.WIDTH);
    });
});

describe("render - GtkConstraintLayout.Widget registration (b)", () => {
    it("attaches the wrapped widget to the host widget (transparent in the GTK tree)", async () => {
        const boxRef = createRef<Gtk.Box>();
        const labelRef = createRef<Gtk.Label>();

        await render(
            <GtkBox ref={boxRef}>
                <GtkConstraintLayout />
                <LabelMarker id="a" label="Inside" labelRef={labelRef} />
            </GtkBox>,
        );

        expect(labelRef.current?.getParent()).toBe(boxRef.current);
    });

    it("treats `super` (or omitted source) as the layout-owning widget", async () => {
        const boxRef = createRef<Gtk.Box>();
        const labelRef = createRef<Gtk.Label>();

        await render(
            <GtkBox ref={boxRef}>
                <GtkConstraintLayout>
                    <GtkConstraintLayout.Constraint
                        target="a"
                        targetAttribute={A.START}
                        sourceAttribute={A.START}
                        constant={8}
                    />
                </GtkConstraintLayout>
                <LabelMarker id="a" label="A" labelRef={labelRef} />
            </GtkBox>,
        );

        const c = onlyConstraint(boxRef);
        expect(c.getTarget()).toBe(labelRef.current);
        expect(c.getSource()).toBeNull();
        expect(c.getConstant()).toBe(8);
    });

    it("throws a clear error when a Constraint references an unknown id", async () => {
        await expect(
            render(
                <GtkBox>
                    <GtkConstraintLayout>
                        <GtkConstraintLayout.Constraint target="ghost" targetAttribute={A.WIDTH} constant={100} />
                    </GtkConstraintLayout>
                </GtkBox>,
            ),
        ).rejects.toThrow(/unknown id 'ghost'/);
    });
});

describe("render - GtkConstraintLayout.Guide (construction)", () => {
    it("adds a guide with size and strength props", async () => {
        const boxRef = createRef<Gtk.Box>();

        await render(
            <GtkBox ref={boxRef}>
                <GtkConstraintLayout>
                    <GtkConstraintLayout.Guide
                        id="space"
                        minWidth={10}
                        minHeight={10}
                        natWidth={100}
                        natHeight={20}
                        maxWidth={200}
                        maxHeight={30}
                        strength={S.STRONG}
                    />
                </GtkConstraintLayout>
            </GtkBox>,
        );

        const layout = layoutFrom(boxRef);
        const guides = collectGuides(layout);
        expect(guides).toHaveLength(1);
        const guide = guides[0] as Gtk.ConstraintGuide;
        expect(guide.getName()).toBe("space");
        const [minW, minH] = guide.getMinSize();
        const [natW, natH] = guide.getNatSize();
        const [maxW, maxH] = guide.getMaxSize();
        expect(minW).toBe(10);
        expect(minH).toBe(10);
        expect(natW).toBe(100);
        expect(natH).toBe(20);
        expect(maxW).toBe(200);
        expect(maxH).toBe(30);
        expect(guide.getStrength()).toBe(S.STRONG);
    });
});

describe("render - GtkConstraintLayout.Guide (references)", () => {
    it("lets Constraint markers reference a Guide by id", async () => {
        const boxRef = createRef<Gtk.Box>();
        const labelRef = createRef<Gtk.Label>();

        await render(
            <GtkBox ref={boxRef}>
                <GtkConstraintLayout>
                    <GtkConstraintLayout.Guide id="divider" minWidth={0} natWidth={0} maxWidth={0} />
                    <GtkConstraintLayout.Constraint
                        target="a"
                        targetAttribute={A.END}
                        source="divider"
                        sourceAttribute={A.START}
                    />
                </GtkConstraintLayout>
                <LabelMarker id="a" label="A" labelRef={labelRef} />
            </GtkBox>,
        );

        const guide = collectGuides(layoutFrom(boxRef))[0];
        const c = firstConstraint(boxRef);
        expect(c.getSource()).toBe(guide);
        expect(c.getTarget()).toBe(labelRef.current);
    });

    it("removes the guide from the layout when unmounted", async () => {
        const boxRef = createRef<Gtk.Box>();

        function App({ show }: { show: boolean }) {
            return (
                <GtkBox ref={boxRef}>
                    <GtkConstraintLayout>{show && <GtkConstraintLayout.Guide id="g" />}</GtkConstraintLayout>
                </GtkBox>
            );
        }

        const { rerender } = await render(<App show={true} />);
        let layout = layoutFrom(boxRef);
        expect(collectGuides(layout)).toHaveLength(1);

        await rerender(<App show={false} />);
        layout = layoutFrom(boxRef);
        expect(collectGuides(layout)).toHaveLength(0);
    });
});

describe("render - GtkConstraintLayout.Constraint updates", () => {
    it("recreates the constraint when a prop changes (constant value)", async () => {
        const boxRef = createRef<Gtk.Box>();

        function App({ constant }: { constant: number }) {
            return (
                <GtkBox ref={boxRef}>
                    <GtkConstraintLayout>
                        <GtkConstraintLayout.Constraint
                            target="a"
                            targetAttribute={A.LEFT}
                            sourceAttribute={A.LEFT}
                            constant={constant}
                        />
                    </GtkConstraintLayout>
                    <ButtonMarker id="a" label="A" />
                </GtkBox>
            );
        }

        const { rerender } = await render(<App constant={10} />);
        let layout = layoutFrom(boxRef);
        let constraints = collectConstraints(layout);
        expect(constraints).toHaveLength(1);
        expect((constraints[0] as Gtk.Constraint).getConstant()).toBe(10);

        await rerender(<App constant={50} />);
        layout = layoutFrom(boxRef);
        constraints = collectConstraints(layout);
        expect(constraints).toHaveLength(1);
        expect((constraints[0] as Gtk.Constraint).getConstant()).toBe(50);
    });

    it("removes the constraint when the marker is unmounted", async () => {
        const boxRef = createRef<Gtk.Box>();

        function App({ show }: { show: boolean }) {
            return (
                <GtkBox ref={boxRef}>
                    <GtkConstraintLayout>
                        {show && (
                            <GtkConstraintLayout.Constraint
                                target="a"
                                targetAttribute={A.LEFT}
                                sourceAttribute={A.LEFT}
                                constant={5}
                            />
                        )}
                    </GtkConstraintLayout>
                    <ButtonMarker id="a" label="A" />
                </GtkBox>
            );
        }

        const { rerender } = await render(<App show={true} />);
        let layout = layoutFrom(boxRef);
        expect(collectConstraints(layout)).toHaveLength(1);

        await rerender(<App show={false} />);
        layout = layoutFrom(boxRef);
        expect(collectConstraints(layout)).toHaveLength(0);
    });
});

describe("render - GtkConstraintLayout.Constraint props", () => {
    it("forwards the relation prop to the underlying Gtk.Constraint", async () => {
        const boxRef = createRef<Gtk.Box>();

        await render(
            <GtkBox ref={boxRef}>
                <GtkConstraintLayout>
                    <GtkConstraintLayout.Constraint
                        target="a"
                        targetAttribute={A.WIDTH}
                        relation={R.LE}
                        sourceAttribute={A.NONE}
                        constant={200}
                    />
                </GtkConstraintLayout>
                <ButtonMarker id="a" label="A" />
            </GtkBox>,
        );

        const c = firstConstraint(boxRef);
        expect(c.getRelation()).toBe(R.LE);
        expect(c.getConstant()).toBe(200);
    });

    it("forwards the strength prop to the underlying Gtk.Constraint", async () => {
        const boxRef = createRef<Gtk.Box>();

        await render(
            <GtkBox ref={boxRef}>
                <GtkConstraintLayout>
                    <GtkConstraintLayout.Constraint
                        target="a"
                        targetAttribute={A.LEFT}
                        sourceAttribute={A.LEFT}
                        constant={4}
                        strength={S.STRONG}
                    />
                </GtkConstraintLayout>
                <ButtonMarker id="a" label="A" />
            </GtkBox>,
        );

        const c = firstConstraint(boxRef);
        expect(c.getStrength()).toBe(S.STRONG);
    });
});

describe("render - GtkConstraintLayout.Widget lifecycle", () => {
    it("re-registers when the id prop changes", async () => {
        const boxRef = createRef<Gtk.Box>();
        const labelRef = createRef<Gtk.Label>();

        function App({ id }: { id: string }) {
            return (
                <GtkBox ref={boxRef}>
                    <GtkConstraintLayout>
                        <GtkConstraintLayout.Constraint
                            target={id}
                            targetAttribute={A.LEFT}
                            sourceAttribute={A.LEFT}
                            constant={1}
                        />
                    </GtkConstraintLayout>
                    <LabelMarker id={id} label="L" labelRef={labelRef} />
                </GtkBox>
            );
        }

        const { rerender } = await render(<App id="first" />);
        expect(firstConstraint(boxRef).getTarget()).toBe(labelRef.current);

        await rerender(<App id="second" />);
        expect(firstConstraint(boxRef).getTarget()).toBe(labelRef.current);
    });

    it("unmounts the wrapper cleanly when conditionally removed", async () => {
        const boxRef = createRef<Gtk.Box>();
        const persistRef = createRef<Gtk.Label>();
        const conditionalRef = createRef<Gtk.Label>();

        function App({ show }: { show: boolean }) {
            return (
                <GtkBox ref={boxRef}>
                    <GtkConstraintLayout />
                    <LabelMarker id="persist" label="P" labelRef={persistRef} />
                    {show && <LabelMarker id="cond" label="C" labelRef={conditionalRef} />}
                </GtkBox>
            );
        }

        const { rerender } = await render(<App show={true} />);
        expect(persistRef.current?.getParent()).toBe(boxRef.current);
        expect(conditionalRef.current?.getParent()).toBe(boxRef.current);

        await rerender(<App show={false} />);
        expect(persistRef.current?.getParent()).toBe(boxRef.current);
        expect(conditionalRef.current).toBeNull();
    });

    it("throws when a Widget has no sibling ConstraintLayout", async () => {
        await expect(
            render(
                <GtkBox>
                    <LabelMarker id="orphan" label="Orphan" />
                </GtkBox>,
            ),
        ).rejects.toThrow(/must be a sibling of <GtkConstraintLayout>/);
    });
});

describe("render - GtkConstraintLayout.Vfl", () => {
    it("parses VFL and adds the resulting constraints", async () => {
        const boxRef = createRef<Gtk.Box>();

        await render(
            <GtkBox ref={boxRef}>
                <GtkConstraintLayout>
                    <GtkConstraintLayout.Vfl
                        lines={["H:|-[a(==b)]-12-[b]-|", "V:|-[a]-|", "V:|-[b]-|"]}
                        hspacing={8}
                        vspacing={8}
                    />
                </GtkConstraintLayout>
                <ButtonMarker id="a" label="A" />
                <ButtonMarker id="b" label="B" />
            </GtkBox>,
        );

        const layout = layoutFrom(boxRef);
        const constraints = collectConstraints(layout);
        expect(constraints.length).toBeGreaterThanOrEqual(5);
    });

    it("re-parses VFL when the lines prop changes", async () => {
        const boxRef = createRef<Gtk.Box>();

        function App({ lines }: { lines: string[] }) {
            return (
                <GtkBox ref={boxRef}>
                    <GtkConstraintLayout>
                        <GtkConstraintLayout.Vfl lines={lines} />
                    </GtkConstraintLayout>
                    <ButtonMarker id="a" label="A" />
                </GtkBox>
            );
        }

        const { rerender } = await render(<App lines={["H:|-[a]-|"]} />);
        let layout = layoutFrom(boxRef);
        const initialCount = collectConstraints(layout).length;
        expect(initialCount).toBeGreaterThan(0);

        await rerender(<App lines={["H:|-[a]-|", "V:|-[a]-|"]} />);
        layout = layoutFrom(boxRef);
        const updatedCount = collectConstraints(layout).length;
        expect(updatedCount).toBeGreaterThan(initialCount);
    });

    it("rejects when the VFL description references an unknown view", async () => {
        await expect(
            render(
                <GtkBox>
                    <GtkConstraintLayout>
                        <GtkConstraintLayout.Vfl lines={["H:|-[ghost]-|"]} />
                    </GtkConstraintLayout>
                    <ButtonMarker id="a" label="A" />
                </GtkBox>,
            ),
        ).rejects.toThrow();
    });
});
