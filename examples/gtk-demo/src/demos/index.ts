import type { Demo } from "./types.js";
import { fontFeaturesDemo } from "./advanced/font-features.js";
import { fontRenderingDemo } from "./advanced/fontrendering.js";
import { markupDemo } from "./advanced/markup.js";
import { textmaskDemo } from "./advanced/textmask.js";
import { framesDemo } from "./benchmark/frames.js";
import { themesDemo } from "./benchmark/themes.js";
import { expanderDemo } from "./buttons/expander.js";
import { scaleDemo } from "./buttons/scale.js";
import { spinbuttonDemo } from "./buttons/spinbutton.js";
import { spinnerDemo } from "./buttons/spinner.js";
import { constraintsInteractiveDemo } from "./constraints/constraints-interactive.js";
import { constraintsVflDemo } from "./constraints/constraints-vfl.js";
import { constraintsDemo } from "./constraints/constraints.js";
import { cssAccordionDemo } from "./css/css-accordion.js";
import { cssBasicsDemo } from "./css/css-basics.js";
import { cssBlendmodesDemo } from "./css/css-blendmodes.js";
import { cssMultiplebgsDemo } from "./css/css-multiplebgs.js";
import { cssPixbufsDemo } from "./css/css-pixbufs.js";
import { cssShadowsDemo } from "./css/css-shadows.js";
import { errorstatesDemo } from "./css/errorstates.js";
import { themingStyleClassesDemo } from "./css/theming-style-classes.js";
import { dialogDemo } from "./dialogs/dialog.js";
import { pageSetupDemo } from "./dialogs/pagesetup.js";
import { pickersDemo } from "./dialogs/pickers.js";
import { printingDemo } from "./dialogs/printing.js";
import { drawingAreaDemo } from "./drawing/drawingarea.js";
import { imagesDemo } from "./drawing/images.js";
import { paintableSvgDemo } from "./drawing/paintable-svg.js";
import { listviewMinesweeperDemo } from "./games/listview-minesweeper.js";
import { clipboardDemo } from "./gestures/clipboard.js";
import { cursorsDemo } from "./gestures/cursors.js";
import { dndDemo } from "./gestures/dnd.js";
import { gesturesDemo } from "./gestures/gestures.js";
import { linksDemo } from "./gestures/links.js";
import { shortcutTriggersDemo } from "./gestures/shortcut-triggers.js";
import { entryUndoDemo } from "./input/entry-undo.js";
import { hypertextDemo } from "./input/hypertext.js";
import { passwordEntryDemo } from "./input/password-entry.js";
import { searchEntryDemo } from "./input/search-entry.js";
import { tabsDemo } from "./input/tabs.js";
import { textscrollDemo } from "./input/textscroll.js";
import { textundoDemo } from "./input/textundo.js";
import { textviewDemo } from "./input/textview.js";
import { fixed2Demo } from "./layout/fixed2.js";
import { fixedDemo } from "./layout/fixed.js";
import { flowboxDemo } from "./layout/flowbox.js";
import { headerbarDemo } from "./layout/headerbar.js";
import { overlayDecorativeDemo } from "./layout/overlay-decorative.js";
import { overlayDemo } from "./layout/overlay.js";
import { panesDemo } from "./layout/panes.js";
import { sizegroupDemo } from "./layout/sizegroup.js";
import { listboxControlsDemo } from "./lists/listbox-controls.js";
import { listboxDemo } from "./lists/listbox.js";
import { listviewApplauncherDemo } from "./lists/listview-applauncher.js";
import { listviewColorsDemo } from "./lists/listview-colors.js";
import { listviewFilebrowserDemo } from "./lists/listview-filebrowser.js";
import { listviewSelectionsDemo } from "./lists/listview-selections.js";
import { listviewSettings2Demo } from "./lists/listview-settings2.js";
import { listviewSettingsDemo } from "./lists/listview-settings.js";
import { listviewUcdDemo } from "./lists/listview-ucd.js";
import { listviewWeatherDemo } from "./lists/listview-weather.js";
import { listviewWordsDemo } from "./lists/listview-words.js";
import { videoPlayerDemo } from "./media/video-player.js";
import { revealerDemo } from "./navigation/revealer.js";
import { sidebarDemo } from "./navigation/sidebar.js";
import { stackDemo } from "./navigation/stack.js";
import { gearsDemo } from "./opengl/gears.js";
import { glareaDemo } from "./opengl/glarea.js";
import { shadertoyDemo } from "./opengl/shadertoy.js";

const introDemo: Demo = {
    id: "intro",
    title: "GTK Demo",
    description:
        "GTK Demo is a collection of useful examples to demonstrate GTK4 widgets and features using GTKX, " +
        "an Adwaita-first framework for building native GNOME applications with React and TypeScript.\n\n" +
        "You can select examples in the sidebar or search for them by typing a search term. " +
        'Double-clicking or hitting the "Run" button will run the demo. ' +
        "The source code used in the demo is shown in the Source tab.\n\n" +
        "You can also use the GTK Inspector, available from the menu on the top right, " +
        "to poke at the running demos, and see how they are put together.",
    keywords: [],
};

const demos: Demo[] = [
    introDemo,
    clipboardDemo,
    constraintsDemo,
    constraintsInteractiveDemo,
    constraintsVflDemo,
    cssAccordionDemo,
    cssBasicsDemo,
    cssBlendmodesDemo,
    cssMultiplebgsDemo,
    cssPixbufsDemo,
    cssShadowsDemo,
    cursorsDemo,
    dialogDemo,
    dndDemo,
    drawingAreaDemo,
    entryUndoDemo,
    errorstatesDemo,
    expanderDemo,
    fixedDemo,
    fixed2Demo,
    flowboxDemo,
    fontRenderingDemo,
    fontFeaturesDemo,
    framesDemo,
    gearsDemo,
    gesturesDemo,
    glareaDemo,
    headerbarDemo,
    hypertextDemo,
    imagesDemo,
    linksDemo,
    listboxDemo,
    listboxControlsDemo,
    listviewApplauncherDemo,
    listviewColorsDemo,
    listviewFilebrowserDemo,
    listviewMinesweeperDemo,
    listviewSelectionsDemo,
    listviewSettingsDemo,
    listviewSettings2Demo,
    listviewUcdDemo,
    listviewWeatherDemo,
    listviewWordsDemo,
    markupDemo,
    overlayDemo,
    overlayDecorativeDemo,
    paintableSvgDemo,
    panesDemo,
    passwordEntryDemo,
    pickersDemo,
    printingDemo,
    pageSetupDemo,
    revealerDemo,
    scaleDemo,
    searchEntryDemo,
    shadertoyDemo,
    shortcutTriggersDemo,
    sidebarDemo,
    sizegroupDemo,
    spinbuttonDemo,
    spinnerDemo,
    stackDemo,
    tabsDemo,
    textmaskDemo,
    textundoDemo,
    textviewDemo,
    textscrollDemo,
    themesDemo,
    themingStyleClassesDemo,
    videoPlayerDemo,
];

export { demos };
