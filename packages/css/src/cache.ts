import type { EmotionCache } from "@emotion/cache";
import createCache from "@emotion/cache";
import { Stylesheet } from "./stylesheet.js";

const CACHE_KEY = "gtkx";

let cache: EmotionCache | null = null;
let stylesheet: Stylesheet | null = null;

export const getCache = (): EmotionCache => (cache ??= createCache({ key: CACHE_KEY, container: null }));

/**
 * The GTK stylesheet generated rules are inserted into.
 *
 * Deliberately separate from {@link EmotionCache.sheet}: that field is the
 * DOM-coupled `@emotion/sheet` whose `HTMLStyleElement`/`Node` members have no
 * GTK equivalent, and {@link getCache} is used only for serialization hashing,
 * `registered` composition, and insertion dedup — never its sheet.
 */
export const getStylesheet = (): Stylesheet => (stylesheet ??= new Stylesheet());
