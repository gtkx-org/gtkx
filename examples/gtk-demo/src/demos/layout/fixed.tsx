import * as Graphene from "@gtkx/gi/graphene";
import * as Gsk from "@gtkx/gi/gsk";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkFixed, GtkFixedLayoutChild, GtkFrame, GtkScrolledWindow } from "@gtkx/jsx/gtk";
import type { Demo } from "../types.js";
import { at } from "../../transform.js";
import { useCssResource } from "../../use-css-resource.js";
import fixedCss from "./fixed.css?raw";
import sourceCode from "./fixed.tsx?raw";

type CubeFace = {
    name: string;
    rotateX: number;
    rotateY: number;
};

const FACE_SIZE = 200;

const CUBE_FACES: CubeFace[] = [
    { name: "back", rotateX: 0, rotateY: -180 },
    { name: "left", rotateX: 0, rotateY: -90 },
    { name: "bottom", rotateX: -90, rotateY: 0 },
    { name: "right", rotateX: 0, rotateY: 90 },
    { name: "top", rotateX: 90, rotateY: 0 },
    { name: "front", rotateX: 0, rotateY: 0 },
];

const AXIS_X = createAxis(1, 0, 0);
const AXIS_Y = createAxis(0, 1, 0);

const fixedDemo: Demo = {
    id: "fixed",
    title: "Fixed Layout / Cube",
    windowTitle: "Fixed Layout ‐ Cube",
    description:
        "GtkFixed is a container that allows placing and transforming widgets manually.\n\n" +
        "This demo uses a GtkFixed to create a cube out of child widgets.",
    keywords: ["GtkLayoutManager"],
    component: FixedDemo,
    sourceCode,
    defaultWidth: 600,
    defaultHeight: 400,
};

function createAxis(x: number, y: number, z: number): Graphene.Vec3 {
    const axis = new Graphene.Vec3();
    axis.init(x, y, z);

    return axis;
}

function chainTransform(current: Gsk.Transform, next: Gsk.Transform | null): Gsk.Transform {
    return next ?? current;
}

function createFaceTransform(face: CubeFace): Gsk.Transform {
    const w = FACE_SIZE / 2;
    const h = FACE_SIZE / 2;
    const d = FACE_SIZE / 2;
    const p = FACE_SIZE * 3;
    const centerPoint = new Graphene.Point();
    centerPoint.init(w, h);
    const depthAdjust = new Graphene.Point3D();
    depthAdjust.init(0, 0, -FACE_SIZE / 6);
    const forwardOffset = new Graphene.Point3D();
    forwardOffset.init(0, 0, d);
    const centeringOffset = new Graphene.Point3D();
    centeringOffset.init(-w, -h, 0);
    let t = Gsk.Transform.new();
    t = chainTransform(t, t.translate(centerPoint));
    t = t.perspective(p);
    t = chainTransform(t, t.rotate3d(-30, AXIS_X));
    t = chainTransform(t, t.rotate3d(135, AXIS_Y));
    t = chainTransform(t, t.translate3d(depthAdjust));
    t = chainTransform(t, t.rotate3d(face.rotateX, AXIS_X));
    t = chainTransform(t, t.rotate3d(face.rotateY, AXIS_Y));
    t = chainTransform(t, t.translate3d(forwardOffset));
    t = chainTransform(t, t.translate3d(centeringOffset));

    return t;
}

function FixedDemo() {
    useCssResource(fixedCss);

    const faceTransforms = CUBE_FACES.map((face) => ({
        face,
        transform: createFaceTransform(face),
    }));

    return (
        <GtkScrolledWindow name="scrolled">
            <GtkFixed
                name="outer-fixed"
                halign={Gtk.Align.CENTER}
                valign={Gtk.Align.CENTER}
                overflow={Gtk.Overflow.VISIBLE}
            >
                <GtkFixedLayoutChild transform={at(0, 0)}>
                    <GtkFixed name="inner-fixed" overflow={Gtk.Overflow.VISIBLE}>
                        {faceTransforms.map(({ face, transform }) => (
                            <GtkFixedLayoutChild key={face.name} transform={at(0, 0, transform)}>
                                <GtkFrame
                                    name={`cube-face-${face.name}`}
                                    widthRequest={FACE_SIZE}
                                    heightRequest={FACE_SIZE}
                                    cssClasses={[face.name]}
                                />
                            </GtkFixedLayoutChild>
                        ))}
                    </GtkFixed>
                </GtkFixedLayoutChild>
            </GtkFixed>
        </GtkScrolledWindow>
    );
}

export { fixedDemo };
