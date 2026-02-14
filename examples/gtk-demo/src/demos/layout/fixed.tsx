import { css } from "@gtkx/css";
import * as Graphene from "@gtkx/ffi/graphene";
import * as Gsk from "@gtkx/ffi/gsk";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkFixed, GtkFrame, GtkScrolledWindow, x } from "@gtkx/react";
import { useMemo } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./fixed.tsx?raw";

const frontBackStyle = css`
    frame& {
        border: 2px solid white;
        background-color: rgba(228, 0, 0, 0.8);
    }
`;

const leftRightStyle = css`
    frame& {
        border: 2px solid white;
        background-color: rgba(127, 231, 25, 0.8);
    }
`;

const topBottomStyle = css`
    frame& {
        border: 2px solid white;
        background-color: rgba(114, 159, 207, 0.8);
    }
`;

const FACE_SIZE = 200;

interface CubeFace {
    name: string;
    style: string;
    rotateX: number;
    rotateY: number;
}

const CUBE_FACES: CubeFace[] = [
    { name: "back", style: frontBackStyle, rotateX: 0, rotateY: -180 },
    { name: "left", style: leftRightStyle, rotateX: 0, rotateY: -90 },
    { name: "bottom", style: topBottomStyle, rotateX: -90, rotateY: 0 },
    { name: "right", style: leftRightStyle, rotateX: 0, rotateY: 90 },
    { name: "top", style: topBottomStyle, rotateX: 90, rotateY: 0 },
    { name: "front", style: frontBackStyle, rotateX: 0, rotateY: 0 },
];

let AXIS_X: Graphene.Vec3 | null = null;
let AXIS_Y: Graphene.Vec3 | null = null;

function getAxisX(): Graphene.Vec3 {
    if (!AXIS_X) {
        AXIS_X = new Graphene.Vec3();
        AXIS_X.init(1, 0, 0);
    }
    return AXIS_X;
}

function getAxisY(): Graphene.Vec3 {
    if (!AXIS_Y) {
        AXIS_Y = new Graphene.Vec3();
        AXIS_Y.init(0, 1, 0);
    }
    return AXIS_Y;
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

    let t = new Gsk.Transform();
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

/**
 * Fixed Layout / Cube demo matching the official GTK gtk-demo.
 * GtkFixed is a container that allows placing and transforming widgets manually.
 * This demo uses a GtkFixed to create a cube out of child widgets.
 */
const FixedDemo = () => {
    const faceTransforms = useMemo(() => {
        return CUBE_FACES.map((face) => ({
            face,
            transform: createFaceTransform(face),
        }));
    }, []);

    return (
        <GtkScrolledWindow>
            <GtkFixed halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} overflow={Gtk.Overflow.VISIBLE}>
                <x.FixedChild x={0} y={0}>
                    <GtkFixed overflow={Gtk.Overflow.VISIBLE}>
                        {faceTransforms.map(({ face, transform }) => (
                            <x.FixedChild key={face.name} x={0} y={0} transform={transform}>
                                <GtkFrame
                                    widthRequest={FACE_SIZE}
                                    heightRequest={FACE_SIZE}
                                    cssClasses={[face.style]}
                                />
                            </x.FixedChild>
                        ))}
                    </GtkFixed>
                </x.FixedChild>
            </GtkFixed>
        </GtkScrolledWindow>
    );
};

export const fixedDemo: Demo = {
    id: "fixed",
    title: "Fixed Layout / Cube",
    description:
        "GtkFixed is a container that allows placing and transforming widgets manually. This demo uses a GtkFixed to create a cube out of child widgets.",
    keywords: ["fixed", "GtkFixed", "GtkLayoutManager", "cube", "transform", "3D"],
    component: FixedDemo,
    sourceCode,
    defaultWidth: 600,
    defaultHeight: 400,
};
