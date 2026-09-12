import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme-without-fonts";
import VersionSelect from "./components/VersionSelect.vue";
import VersionsTable from "./components/VersionsTable.vue";
import Layout from "./Layout.vue";
import "./styles/index.css";

export default {
    extends: DefaultTheme,
    Layout,
    enhanceApp({ app }) {
        app.component("VersionSelect", VersionSelect);
        app.component("VersionsTable", VersionsTable);
    },
} satisfies Theme;
