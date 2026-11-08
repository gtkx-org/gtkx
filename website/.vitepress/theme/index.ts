import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme-without-fonts";
import BlogPosts from "./components/BlogPosts.vue";
import VersionsTable from "./components/VersionsTable.vue";
import Layout from "./Layout.vue";
import "virtual:group-icons.css";
import "./styles/index.css";

export default {
    extends: DefaultTheme,
    Layout,
    enhanceApp({ app }) {
        app.component("BlogPosts", BlogPosts);
        app.component("VersionsTable", VersionsTable);
    },
} satisfies Theme;
