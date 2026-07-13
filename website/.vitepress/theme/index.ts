import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme-without-fonts";
import Layout from "./Layout.vue";
import "./styles/index.css";

export default {
    extends: DefaultTheme,
    Layout,
} satisfies Theme;
