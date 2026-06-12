/**
 * The widget-gallery manifest: pure data shared by the capture suite
 * (`gallery.test.tsx`), the image post-processing step, and the page
 * generator (`scripts/gallery.ts`). Each entry pairs a fixture component in
 * `fixtures/<slug>.tsx` — the literal snippet shown on the gallery page —
 * with the capture geometry and the upstream documentation link.
 */
export type GalleryCategory = "layout" | "controls" | "lists-navigation" | "adwaita";

export interface GalleryEntry {
    /** Fixture module name under `fixtures/` and image base name. */
    slug: string;
    /** The widget name shown as the entry heading. */
    title: string;
    /** The category page the entry renders on. */
    category: GalleryCategory;
    /** Upstream GTK or Libadwaita class documentation. */
    docUrl: string;
    /** Optional GTKX guide that explains the widget's conventions. */
    guide?: string;
    /** Logical window width for the capture. */
    width: number;
    /** Logical window height for the capture. */
    height: number;
    /** Fixture fills the window content area instead of being centered. */
    fill?: boolean;
}

export const GALLERY_CATEGORIES: Record<GalleryCategory, { title: string; intro: string }> = {
    layout: {
        title: "Layout & containers",
        intro: "The building blocks that arrange other widgets: boxes, grids, panes, frames, and overlays.",
    },
    controls: {
        title: "Controls & input",
        intro: "Buttons, toggles, text entries, and value selectors — the widgets users click and type into.",
    },
    "lists-navigation": {
        title: "Lists, tables & navigation",
        intro: "Virtualized lists and tables driven by the items contract, plus stacks and tabs for moving between views.",
    },
    adwaita: {
        title: "Adwaita & feedback",
        intro: "Libadwaita patterns that make an app feel at home on GNOME: status pages, banners, toasts, and preference rows.",
    },
};

export const GALLERY_ENTRIES: GalleryEntry[] = [
    {
        slug: "box",
        title: "GtkBox",
        category: "layout",
        docUrl: "https://docs.gtk.org/gtk4/class.Box.html",
        width: 480,
        height: 320,
    },
    {
        slug: "grid",
        title: "GtkGrid",
        category: "layout",
        docUrl: "https://docs.gtk.org/gtk4/class.Grid.html",
        width: 480,
        height: 340,
    },
    {
        slug: "center-box",
        title: "GtkCenterBox",
        category: "layout",
        docUrl: "https://docs.gtk.org/gtk4/class.CenterBox.html",
        width: 520,
        height: 280,
    },
    {
        slug: "paned",
        title: "GtkPaned",
        category: "layout",
        docUrl: "https://docs.gtk.org/gtk4/class.Paned.html",
        width: 560,
        height: 340,
        fill: true,
    },
    {
        slug: "frame",
        title: "GtkFrame",
        category: "layout",
        docUrl: "https://docs.gtk.org/gtk4/class.Frame.html",
        width: 480,
        height: 320,
    },
    {
        slug: "overlay",
        title: "GtkOverlay",
        category: "layout",
        docUrl: "https://docs.gtk.org/gtk4/class.Overlay.html",
        width: 480,
        height: 340,
    },
    {
        slug: "flow-box",
        title: "GtkFlowBox",
        category: "layout",
        docUrl: "https://docs.gtk.org/gtk4/class.FlowBox.html",
        width: 520,
        height: 360,
    },
    {
        slug: "expander",
        title: "GtkExpander",
        category: "layout",
        docUrl: "https://docs.gtk.org/gtk4/class.Expander.html",
        width: 480,
        height: 320,
    },
    {
        slug: "button",
        title: "GtkButton",
        category: "controls",
        docUrl: "https://docs.gtk.org/gtk4/class.Button.html",
        width: 480,
        height: 320,
    },
    {
        slug: "toggle-button",
        title: "GtkToggleButton",
        category: "controls",
        docUrl: "https://docs.gtk.org/gtk4/class.ToggleButton.html",
        width: 480,
        height: 280,
    },
    {
        slug: "check-button",
        title: "GtkCheckButton",
        category: "controls",
        docUrl: "https://docs.gtk.org/gtk4/class.CheckButton.html",
        width: 480,
        height: 320,
    },
    {
        slug: "switch",
        title: "GtkSwitch",
        category: "controls",
        docUrl: "https://docs.gtk.org/gtk4/class.Switch.html",
        width: 480,
        height: 280,
    },
    {
        slug: "entry",
        title: "GtkEntry",
        category: "controls",
        docUrl: "https://docs.gtk.org/gtk4/class.Entry.html",
        width: 500,
        height: 340,
    },
    {
        slug: "spin-button",
        title: "GtkSpinButton",
        category: "controls",
        docUrl: "https://docs.gtk.org/gtk4/class.SpinButton.html",
        width: 480,
        height: 280,
    },
    {
        slug: "scale",
        title: "GtkScale",
        category: "controls",
        docUrl: "https://docs.gtk.org/gtk4/class.Scale.html",
        width: 520,
        height: 320,
    },
    {
        slug: "drop-down",
        title: "GtkDropDown",
        category: "controls",
        docUrl: "https://docs.gtk.org/gtk4/class.DropDown.html",
        guide: "/docs/guides/lists",
        width: 480,
        height: 300,
    },
    {
        slug: "calendar",
        title: "GtkCalendar",
        category: "controls",
        docUrl: "https://docs.gtk.org/gtk4/class.Calendar.html",
        width: 480,
        height: 400,
    },
    {
        slug: "progress",
        title: "Progress & levels",
        category: "controls",
        docUrl: "https://docs.gtk.org/gtk4/class.ProgressBar.html",
        width: 520,
        height: 340,
    },
    {
        slug: "list-view",
        title: "GtkListView",
        category: "lists-navigation",
        docUrl: "https://docs.gtk.org/gtk4/class.ListView.html",
        guide: "/docs/guides/lists",
        width: 520,
        height: 420,
        fill: true,
    },
    {
        slug: "grid-view",
        title: "GtkGridView",
        category: "lists-navigation",
        docUrl: "https://docs.gtk.org/gtk4/class.GridView.html",
        guide: "/docs/guides/lists",
        width: 560,
        height: 420,
        fill: true,
    },
    {
        slug: "column-view",
        title: "GtkColumnView",
        category: "lists-navigation",
        docUrl: "https://docs.gtk.org/gtk4/class.ColumnView.html",
        guide: "/docs/guides/lists",
        width: 600,
        height: 400,
        fill: true,
    },
    {
        slug: "list-box",
        title: "GtkListBox",
        category: "lists-navigation",
        docUrl: "https://docs.gtk.org/gtk4/class.ListBox.html",
        width: 520,
        height: 400,
    },
    {
        slug: "stack",
        title: "GtkStack",
        category: "lists-navigation",
        docUrl: "https://docs.gtk.org/gtk4/class.Stack.html",
        width: 520,
        height: 360,
    },
    {
        slug: "notebook",
        title: "GtkNotebook",
        category: "lists-navigation",
        docUrl: "https://docs.gtk.org/gtk4/class.Notebook.html",
        width: 520,
        height: 360,
        fill: true,
    },
    {
        slug: "status-page",
        title: "AdwStatusPage",
        category: "adwaita",
        docUrl: "https://gnome.pages.gitlab.gnome.org/libadwaita/doc/1-latest/class.StatusPage.html",
        width: 560,
        height: 420,
        fill: true,
    },
    {
        slug: "banner",
        title: "AdwBanner",
        category: "adwaita",
        docUrl: "https://gnome.pages.gitlab.gnome.org/libadwaita/doc/1-latest/class.Banner.html",
        width: 560,
        height: 300,
        fill: true,
    },
    {
        slug: "preference-rows",
        title: "Preference rows",
        category: "adwaita",
        docUrl: "https://gnome.pages.gitlab.gnome.org/libadwaita/doc/1-latest/class.PreferencesGroup.html",
        width: 560,
        height: 460,
    },
    {
        slug: "toast-overlay",
        title: "AdwToastOverlay",
        category: "adwaita",
        docUrl: "https://gnome.pages.gitlab.gnome.org/libadwaita/doc/1-latest/class.ToastOverlay.html",
        width: 560,
        height: 380,
        fill: true,
    },
    {
        slug: "toggle-group",
        title: "AdwToggleGroup",
        category: "adwaita",
        docUrl: "https://gnome.pages.gitlab.gnome.org/libadwaita/doc/1-latest/class.ToggleGroup.html",
        width: 480,
        height: 280,
    },
    {
        slug: "avatar",
        title: "AdwAvatar",
        category: "adwaita",
        docUrl: "https://gnome.pages.gitlab.gnome.org/libadwaita/doc/1-latest/class.Avatar.html",
        width: 480,
        height: 300,
    },
];
