import * as Graphene from "@gtkx/gi/graphene";
import * as Gsk from "@gtkx/gi/gsk";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkFixed, GtkFixedChild, GtkFrame, GtkScrolledWindow } from "@gtkx/jsx/gtk";
import { useCssResource } from "../../use-css-resource.js";
import type { Demo } from "../types.js";
import fixedCss from "./fixed.css?raw";
import sourceCode from "./fixed.tsx?raw";

const FACE_SIZE = 200;

interface CubeFace {
    name: string;
    rotateX: number;
    rotateY: number;
}

const CUBE_FACES: CubeFace[] = [
    { name: "back", rotateX: 0, rotateY: -180 },
    { name: "left", rotateX: 0, rotateY: -90 },
    { name: "bottom", rotateX: -90, rotateY: 0 },
    { name: "right", rotateX: 0, rotateY: 90 },
    { name: "top", rotateX: 90, rotateY: 0 },
    { name: "front", rotateX: 0, rotateY: 0 },
];

let axisX: Graphene.Vec3 | null = null;
let axisY: Graphene.Vec3 | null = null;

function getAxisX(): Graphene.Vec3 {
    if (!axisX) {
        axisX = new Graphene.Vec3();
        axisX.init(1, 0, 0);
    }
    return axisX;
}

function getAxisY(): Graphene.Vec3 {
    if (!axisY) {
        axisY = new Graphene.Vec3();
        axisY.init(0, 1, 0);
    }
    return axisY;
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
    t = t.translate(centerPoint) ?? t;
    t = t.perspective(p) ?? t;
    t = t.rotate3d(-30, getAxisX()) ?? t;
    t = t.rotate3d(135, getAxisY()) ?? t;
    t = t.translate3d(depthAdjust) ?? t;
    t = t.rotate3d(face.rotateX, getAxisX()) ?? t;
    t = t.rotate3d(face.rotateY, getAxisY()) ?? t;
    t = t.translate3d(forwardOffset) ?? t;
    t = t.translate3d(centeringOffset) ?? t;

    return t;
}

const FixedDemo = () => {
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
                <GtkFixedChild x={0} y={0}>
                    <GtkFixed name="inner-fixed" overflow={Gtk.Overflow.VISIBLE}>
                        {faceTransforms.map(({ face, transform }) => (
                            <GtkFixedChild key={face.name} x={0} y={0} transform={transform}>
                                <GtkFrame
                                    name={`cube-face-${face.name}`}
                                    widthRequest={FACE_SIZE}
                                    heightRequest={FACE_SIZE}
                                    cssClasses={[face.name]}
                                />
                            </GtkFixedChild>
                        ))}
                    </GtkFixed>
                </GtkFixedChild>
            </GtkFixed>
        </GtkScrolledWindow>
    );
};

export const fixedDemo: Demo = {
    id: "fixed",
    title: "Fixed Layout / Cube",
    windowTitle: "Fixed Layout ‐ Cube",
    description:
        "GtkFixed is a container that allows placing and transforming widgets manually.\n\nThis demo uses a GtkFixed to create a cube out of child widgets.",
    keywords: ["GtkLayoutManager"],
    component: FixedDemo,
    sourceCode,
    defaultWidth: 600,
    defaultHeight: 400,
};
