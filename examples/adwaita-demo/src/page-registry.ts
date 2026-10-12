import type { ComponentType } from "react";
import { WelcomePage } from "./pages/welcome.js";
import { NavigationViewPage } from "./pages/navigation-view.js";
import { SplitViewsPage } from "./pages/split-views.js";
import { ViewSwitcherPage } from "./pages/view-switcher.js";
import { TabViewPage } from "./pages/tab-view.js";
import { BottomSheetsPage } from "./pages/bottom-sheets.js";
import { CarouselPage } from "./pages/carousel.js";
import { ListsPage } from "./pages/lists.js";
import { TogglesPage } from "./pages/toggles.js";
import { ButtonsPage } from "./pages/buttons.js";
import { BannersPage } from "./pages/banners.js";
import { ToastsPage } from "./pages/toasts.js";
import { SpinnerPage } from "./pages/spinner.js";
import { AvatarPage } from "./pages/avatar.js";
import { AlertsPage } from "./pages/alerts.js";
import { AboutPage } from "./pages/about.js";
import { ClampPage } from "./pages/clamp.js";
import { WrapBoxPage } from "./pages/wrap-box.js";
import { MultiLayoutPage } from "./pages/multi-layout.js";
import { StylesPage } from "./pages/styles.js";
import { AnimationsPage } from "./pages/animations.js";

type DemoPage = { id: string; title: string; section: string; icon: string; component: ComponentType };

const sections = ["", "Navigation", "Controls", "Display", "Dialogs", "Layout", "Miscellaneous"];

const pages: DemoPage[] = [
    { id: "welcome", title: "Welcome", section: "", icon: "welcome-symbolic", component: WelcomePage },
    {
        id: "navigation-view",
        title: "Navigation View",
        section: "Navigation",
        icon: "widget-navigation-view-symbolic",
        component: NavigationViewPage,
    },
    {
        id: "split-views",
        title: "Split Views",
        section: "Navigation",
        icon: "widget-split-views-symbolic",
        component: SplitViewsPage,
    },
    {
        id: "view-switcher",
        title: "View Switcher",
        section: "Navigation",
        icon: "widget-view-switcher-symbolic",
        component: ViewSwitcherPage,
    },
    {
        id: "tab-view",
        title: "Tab View",
        section: "Navigation",
        icon: "widget-tab-view-symbolic",
        component: TabViewPage,
    },
    {
        id: "bottom-sheets",
        title: "Bottom Sheet",
        section: "Navigation",
        icon: "widget-bottom-sheet-symbolic",
        component: BottomSheetsPage,
    },
    {
        id: "carousel",
        title: "Carousel",
        section: "Navigation",
        icon: "widget-carousel-symbolic",
        component: CarouselPage,
    },
    { id: "lists", title: "Boxed Lists", section: "Controls", icon: "widget-list-symbolic", component: ListsPage },
    {
        id: "toggles",
        title: "Toggle Groups",
        section: "Controls",
        icon: "widget-toggle-group-symbolic",
        component: TogglesPage,
    },
    { id: "buttons", title: "Buttons", section: "Controls", icon: "widget-buttons-symbolic", component: ButtonsPage },
    { id: "banners", title: "Banner", section: "Display", icon: "widget-banner-symbolic", component: BannersPage },
    { id: "toasts", title: "Toasts", section: "Display", icon: "widget-toast-symbolic", component: ToastsPage },
    { id: "spinner", title: "Spinner", section: "Display", icon: "", component: SpinnerPage },
    { id: "avatar", title: "Avatar", section: "Display", icon: "adw-avatar-default-symbolic", component: AvatarPage },
    { id: "alerts", title: "Alert Dialog", section: "Dialogs", icon: "widget-dialog-symbolic", component: AlertsPage },
    { id: "about", title: "About Dialog", section: "Dialogs", icon: "widget-about-symbolic", component: AboutPage },
    { id: "clamp", title: "Clamp", section: "Layout", icon: "widget-clamp-symbolic", component: ClampPage },
    { id: "wrap-box", title: "Wrap Box", section: "Layout", icon: "widget-wrap-box-symbolic", component: WrapBoxPage },
    {
        id: "multi-layout",
        title: "Multi-Layout View",
        section: "Layout",
        icon: "widget-multi-layout-symbolic",
        component: MultiLayoutPage,
    },
    {
        id: "styles",
        title: "Style Classes",
        section: "Miscellaneous",
        icon: "style-classes-symbolic",
        component: StylesPage,
    },
    {
        id: "animations",
        title: "Animations",
        section: "Miscellaneous",
        icon: "animations-symbolic",
        component: AnimationsPage,
    },
];

export { pages, sections };
