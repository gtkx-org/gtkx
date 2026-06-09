import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";
import Layout from "./layout.vue";
import "./styles/tokens.css";
import "./styles/fonts.css";
import "./styles/vars.css";
import "./styles/home.css";
import "./styles/custom.css";

export default {
    extends: DefaultTheme,
    Layout,
} satisfies Theme;
