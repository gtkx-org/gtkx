import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";
import "./styles/vars.css";
import "./styles/home.css";
import "./styles/demo.css";

export default {
    extends: DefaultTheme,
} satisfies Theme;
