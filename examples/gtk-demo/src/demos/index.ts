import { advancedDemos } from "./advanced/index.js";
import { buttonsDemos } from "./buttons/index.js";
import { constraintsDemos } from "./constraints/index.js";
import { cssDemos } from "./css/index.js";
import { dialogsDemos } from "./dialogs/index.js";
import { drawingDemos } from "./drawing/index.js";
import { gamesDemos } from "./games/index.js";
import { gesturesDemos } from "./gestures/index.js";
import { inputDemos } from "./input/index.js";
import { layoutDemos } from "./layout/index.js";
import { listsDemos } from "./lists/index.js";
import { mediaDemos } from "./media/index.js";
import { navigationDemos } from "./navigation/index.js";
import { openglDemos } from "./opengl/index.js";
import { pathsDemos } from "./paths/index.js";
import type { Category } from "./types.js";

export const categories: Category[] = [
    {
        id: "buttons",
        title: "Buttons & Sliders",
        icon: "input-dialpad-symbolic",
        demos: buttonsDemos,
    },
    {
        id: "input",
        title: "Text Input",
        icon: "input-keyboard-symbolic",
        demos: inputDemos,
    },
    {
        id: "layout",
        title: "Layout",
        icon: "view-grid-symbolic",
        demos: layoutDemos,
    },
    {
        id: "constraints",
        title: "Constraints",
        icon: "view-pin-symbolic",
        demos: constraintsDemos,
    },
    {
        id: "navigation",
        title: "Navigation",
        icon: "view-paged-symbolic",
        demos: navigationDemos,
    },
    {
        id: "lists",
        title: "Lists & Selections",
        icon: "view-list-symbolic",
        demos: listsDemos,
    },
    {
        id: "dialogs",
        title: "Dialogs",
        icon: "dialog-information-symbolic",
        demos: dialogsDemos,
    },
    {
        id: "drawing",
        title: "Drawing & Images",
        icon: "applications-graphics-symbolic",
        demos: drawingDemos,
    },
    {
        id: "opengl",
        title: "OpenGL",
        icon: "video-display-symbolic",
        demos: openglDemos,
    },
    {
        id: "paths",
        title: "Paths & Vectors",
        icon: "draw-path-symbolic",
        demos: pathsDemos,
    },
    {
        id: "css",
        title: "CSS & Styling",
        icon: "preferences-desktop-appearance-symbolic",
        demos: cssDemos,
    },
    {
        id: "media",
        title: "Media",
        icon: "applications-multimedia-symbolic",
        demos: mediaDemos,
    },
    {
        id: "advanced",
        title: "Advanced",
        icon: "applications-science-symbolic",
        demos: advancedDemos,
    },
    {
        id: "games",
        title: "Games",
        icon: "applications-games-symbolic",
        demos: gamesDemos,
    },
    {
        id: "gestures",
        title: "Gestures & Input",
        icon: "input-touchpad-symbolic",
        demos: gesturesDemos,
    },
];
