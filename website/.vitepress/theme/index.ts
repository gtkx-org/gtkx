import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";
import Layout from "./Layout.vue";
import "./styles/index.css";

export default {
    extends: DefaultTheme,
    Layout,
} satisfies Theme;
