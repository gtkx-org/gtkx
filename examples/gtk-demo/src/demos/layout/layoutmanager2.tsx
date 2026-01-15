import * as Gdk from "@gtkx/ffi/gdk";
import * as Graphene from "@gtkx/ffi/graphene";
import * as Gsk from "@gtkx/ffi/gsk";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkFixed, GtkImage, x } from "@gtkx/react";
import { useCallback, useMemo, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./layoutmanager2.tsx?raw";

const THETA_STEPS = 18;
const PHI_STEPS = 36;
const ICON_COUNT = THETA_STEPS * PHI_STEPS;
const RADIUS = 250;
const ICON_SIZE = 32;
const CONTAINER_SIZE = 600;

const DEG_TO_RAD = Math.PI / 180;
const STEP_ANGLE = 10;

const ICON_NAMES = [
    "action-unavailable-symbolic",
    "address-book-new-symbolic",
    "application-exit-symbolic",
    "appointment-new-symbolic",
    "bookmark-new-symbolic",
    "call-start-symbolic",
    "call-stop-symbolic",
    "camera-switch-symbolic",
    "chat-message-new-symbolic",
    "color-select-symbolic",
    "contact-new-symbolic",
    "document-edit-symbolic",
    "document-new-symbolic",
    "document-open-recent-symbolic",
    "document-open-symbolic",
    "document-page-setup-symbolic",
    "document-print-preview-symbolic",
    "document-print-symbolic",
    "document-properties-symbolic",
    "document-revert-symbolic",
    "document-save-as-symbolic",
    "document-save-symbolic",
    "document-send-symbolic",
    "edit-clear-all-symbolic",
    "edit-clear-symbolic",
    "edit-copy-symbolic",
    "edit-cut-symbolic",
    "edit-delete-symbolic",
    "edit-find-replace-symbolic",
    "edit-find-symbolic",
    "edit-paste-symbolic",
    "edit-redo-symbolic",
    "edit-select-all-symbolic",
    "edit-select-symbolic",
    "edit-undo-symbolic",
    "folder-new-symbolic",
    "font-select-symbolic",
    "format-indent-less-symbolic",
    "format-indent-more-symbolic",
    "format-justify-center-symbolic",
    "format-justify-fill-symbolic",
    "format-justify-left-symbolic",
    "format-justify-right-symbolic",
    "format-text-bold-symbolic",
    "format-text-italic-symbolic",
    "format-text-strikethrough-symbolic",
    "format-text-underline-symbolic",
    "go-bottom-symbolic",
    "go-down-symbolic",
    "go-first-symbolic",
    "go-home-symbolic",
    "go-jump-symbolic",
    "go-last-symbolic",
    "go-next-symbolic",
    "go-previous-symbolic",
    "go-top-symbolic",
    "go-up-symbolic",
    "help-about-symbolic",
    "insert-image-symbolic",
    "insert-link-symbolic",
    "insert-object-symbolic",
    "insert-text-symbolic",
    "list-add-symbolic",
    "list-remove-all-symbolic",
    "list-remove-symbolic",
    "mail-forward-symbolic",
    "mail-mark-important-symbolic",
    "mail-message-new-symbolic",
    "mail-reply-all-symbolic",
    "mail-reply-sender-symbolic",
    "mail-send-receive-symbolic",
    "mail-send-symbolic",
    "mark-location-symbolic",
    "media-eject-symbolic",
    "media-playback-pause-symbolic",
    "media-playback-start-symbolic",
    "media-playback-stop-symbolic",
    "media-record-symbolic",
    "media-seek-backward-symbolic",
    "media-seek-forward-symbolic",
    "media-skip-backward-symbolic",
    "media-skip-forward-symbolic",
    "object-flip-horizontal-symbolic",
    "object-flip-vertical-symbolic",
    "object-rotate-left-symbolic",
    "object-rotate-right-symbolic",
    "object-select-symbolic",
    "open-menu-symbolic",
    "process-stop-symbolic",
    "send-to-symbolic",
    "star-new-symbolic",
    "system-log-out-symbolic",
    "system-reboot-symbolic",
    "system-run-symbolic",
    "system-search-symbolic",
    "system-shutdown-symbolic",
    "tab-new-symbolic",
    "view-app-grid-symbolic",
    "view-fullscreen-symbolic",
    "view-grid-symbolic",
    "view-list-symbolic",
    "view-more-symbolic",
    "view-refresh-symbolic",
    "view-restore-symbolic",
    "zoom-fit-best-symbolic",
    "zoom-in-symbolic",
    "zoom-original-symbolic",
    "zoom-out-symbolic",
];

function sphereX(r: number, theta: number, phi: number): number {
    return r * Math.sin(theta) * Math.cos(phi);
}

function sphereY(r: number, theta: number, _phi: number): number {
    return r * Math.cos(theta);
}

function sphereZ(r: number, theta: number, phi: number): number {
    return r * Math.sin(theta) * Math.sin(phi);
}

function mapOffset(offset: number, value: number): number {
    let result = value - offset;
    while (result < 0) result += 360;
    while (result >= 360) result -= 360;
    if (result >= 180) result = 360 - result;
    return result;
}

interface SphereIcon {
    id: number;
    thetaIndex: number;
    phiIndex: number;
    iconName: string;
}

/**
 * Layout Manager/Transformation demo matching the official GTK gtk-demo.
 * Shows how to use transforms with a custom layout manager that places
 * icons on a sphere that can be rotated using arrow keys.
 */
const LayoutManager2Demo = () => {
    const [thetaOffset, setThetaOffset] = useState(70);
    const [phiOffset, setPhiOffset] = useState(0);

    const fixedRef = useRef<Gtk.Fixed | null>(null);

    const centerX = CONTAINER_SIZE / 2;
    const centerY = CONTAINER_SIZE / 2;

    const icons = useMemo<SphereIcon[]>(() => {
        return Array.from({ length: ICON_COUNT }, (_, i) => ({
            id: i,
            thetaIndex: Math.floor(i / PHI_STEPS),
            phiIndex: i % PHI_STEPS,
            iconName: ICON_NAMES[i % ICON_NAMES.length] ?? "folder-symbolic",
        }));
    }, []);

    const getIconTransform = useCallback(
        (thetaIdx: number, phiIdx: number) => {
            const theta1 = mapOffset(thetaOffset, thetaIdx * STEP_ANGLE) * DEG_TO_RAD;
            const theta2 = mapOffset(thetaOffset, (thetaIdx + 1) * STEP_ANGLE) * DEG_TO_RAD;
            const phi1 = mapOffset(phiOffset, phiIdx * STEP_ANGLE) * DEG_TO_RAD;
            const phi2 = mapOffset(phiOffset, (phiIdx + 1) * STEP_ANGLE) * DEG_TO_RAD;

            const z1 = sphereZ(RADIUS, theta1, phi1);
            const z2 = sphereZ(RADIUS, theta2, phi1);
            const z3 = sphereZ(RADIUS, theta1, phi2);
            const z4 = sphereZ(RADIUS, theta2, phi2);

            if (z1 > 0 && z2 > 0 && z3 > 0 && z4 > 0) {
                return null;
            }

            const avgTheta = (theta1 + theta2) / 2;
            const avgPhi = (phi1 + phi2) / 2;

            const sx = sphereX(RADIUS, avgTheta, avgPhi);
            const sy = sphereY(RADIUS, avgTheta, avgPhi);
            const sz = sphereZ(RADIUS, avgTheta, avgPhi);

            const screenX = centerX + sx - ICON_SIZE / 2;
            const screenY = centerY - sy - ICON_SIZE / 2;

            const scale = Math.max(0.3, (RADIUS - sz) / (2 * RADIUS));
            const opacity = Math.max(0.2, Math.min(1, (RADIUS - sz) / RADIUS));

            const scalePoint = new Graphene.Point();
            scalePoint.init(ICON_SIZE / 2, ICON_SIZE / 2);

            let t = new Gsk.Transform();
            t = t.scale(scale, scale) ?? t;

            return { x: screenX, y: screenY, transform: t, opacity, zIndex: Math.round(RADIUS - sz) };
        },
        [centerX, centerY, thetaOffset, phiOffset],
    );

    const visibleIcons = useMemo(() => {
        return icons
            .map((icon) => {
                const result = getIconTransform(icon.thetaIndex, icon.phiIndex);
                if (!result) return null;
                return { ...icon, ...result };
            })
            .filter((icon): icon is NonNullable<typeof icon> => icon !== null)
            .sort((a, b) => a.zIndex - b.zIndex);
    }, [icons, getIconTransform]);

    const handleFixedRef = useCallback((fixed: Gtk.Fixed | null) => {
        fixedRef.current = fixed;
    }, []);

    const handleKeyPressed = useCallback((keyval: number, _keycode: number, _state: Gdk.ModifierType) => {
        const step = 5;
        switch (keyval) {
            case Gdk.KEY_Up:
                setThetaOffset((prev) => Math.max(0, prev - step));
                return true;
            case Gdk.KEY_Down:
                setThetaOffset((prev) => Math.min(180, prev + step));
                return true;
            case Gdk.KEY_Left:
                setPhiOffset((prev) => (prev - step + 360) % 360);
                return true;
            case Gdk.KEY_Right:
                setPhiOffset((prev) => (prev + step) % 360);
                return true;
            default:
                return false;
        }
    }, []);

    return (
        <GtkFixed
            ref={handleFixedRef}
            widthRequest={CONTAINER_SIZE}
            heightRequest={CONTAINER_SIZE}
            halign={Gtk.Align.CENTER}
            valign={Gtk.Align.CENTER}
            focusable
            canFocus
            onKeyPressed={handleKeyPressed}
        >
            {visibleIcons.map((icon) => (
                <x.FixedChild key={icon.id} x={icon.x} y={icon.y} transform={icon.transform}>
                    <GtkImage
                        iconName={icon.iconName}
                        iconSize={Gtk.IconSize.LARGE}
                        opacity={icon.opacity}
                        marginStart={4}
                        marginEnd={4}
                        marginTop={4}
                        marginBottom={4}
                    />
                </x.FixedChild>
            ))}
        </GtkFixed>
    );
};

export const layoutManager2Demo: Demo = {
    id: "layoutmanager2",
    title: "Layout Manager/Transformation",
    description:
        "This demo shows how to use transforms in a nontrivial way with a custom layout manager. The layout manager places icons on a sphere that can be rotated using arrow keys.",
    keywords: ["layout", "GtkLayoutManager", "GskTransform", "sphere", "3D", "transform"],
    component: LayoutManager2Demo,
    sourceCode,
};
