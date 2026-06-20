import type { EmotionCache } from "@emotion/cache";
import createCache from "@emotion/cache";
import { Stylesheet } from "./stylesheet.js";

const CACHE_KEY = "gtkx";

let cache: EmotionCache | null = null;
let stylesheet: Stylesheet | null = null;

export const getCache = (): EmotionCache => (cache ??= createCache({ key: CACHE_KEY, container: null }));

export const getStylesheet = (): Stylesheet => (stylesheet ??= new Stylesheet());
