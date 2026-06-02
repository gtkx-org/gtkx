/**
 * Exit code emitted by the dev runner when a non-boundary file change requires
 * a fresh process. The CLI supervisor watches for this code and respawns the
 * runner — a Node-side analogue of the browser's "full page reload."
 */
export const RELOAD_EXIT_CODE = 75;
