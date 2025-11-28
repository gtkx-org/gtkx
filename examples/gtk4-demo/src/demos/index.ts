import { buttonsDemos } from "./buttons/index.js";
import { cssDemos } from "./css/index.js";
import { dialogsDemos } from "./dialogs/index.js";
import { displayDemos } from "./display/index.js";
import { drawingDemos } from "./drawing/index.js";
import { gamesDemos } from "./games/index.js";
import { gettingStartedDemos } from "./getting-started/index.js";
import { glShadersDemos } from "./gl-shaders/index.js";
import { inputDemos } from "./input/index.js";
import { layoutDemos } from "./layout/index.js";
import { listsDemos } from "./lists/index.js";
import { menusDemos } from "./menus/index.js";
import { miscDemos } from "./misc/index.js";
import { pathDemos } from "./path/index.js";
import { printDemos } from "./print/index.js";
import { textDemos } from "./text/index.js";
import type { Category } from "./types.js";
import { windowsDemos } from "./windows/index.js";

export const categories: Category[] = [
    { id: "getting-started", title: "Getting Started", demos: gettingStartedDemos },
    { id: "buttons", title: "Buttons", demos: buttonsDemos },
    { id: "input", title: "Input", demos: inputDemos },
    { id: "dialogs", title: "Dialogs", demos: dialogsDemos },
    { id: "layout", title: "Layout", demos: layoutDemos },
    { id: "windows", title: "Windows", demos: windowsDemos },
    { id: "display", title: "Display", demos: displayDemos },
    { id: "lists", title: "Lists", demos: listsDemos },
    { id: "css", title: "CSS Styling", demos: cssDemos },
    { id: "menus", title: "Menus", demos: menusDemos },
    { id: "text", title: "Text", demos: textDemos },
    { id: "games", title: "Games", demos: gamesDemos },
    { id: "misc", title: "Miscellaneous", demos: miscDemos },
    { id: "drawing", title: "Drawing", demos: drawingDemos },
    { id: "path", title: "Path", demos: pathDemos },
    { id: "gl-shaders", title: "GL & Shaders", demos: glShadersDemos },
    { id: "print", title: "Printing", demos: printDemos },
];
