import * as Gtk from "@gtkx/gi/gtk";
import { render } from "./render.js";
import type { RenderHookOptions, RenderHookResult } from "./types.js";

/**
 * Renders a test component that calls the given hook, exposing its latest
 * return value along with rerender and unmount controls.
 *
 * @param callback The hook to run, invoked with the current props.
 * @param options Optional initial props and wrapper component.
 * @returns A result whose `result.current` holds the hook's latest value.
 */
export function renderHook<Result>(
    callback: () => Result,
    options?: RenderHookOptions<undefined>,
): Promise<RenderHookResult<Result, undefined>>;
/**
 * Renders a test component that calls the given hook with props, exposing its
 * latest return value along with rerender and unmount controls.
 *
 * @param callback The hook to run, invoked with the current props.
 * @param options Initial props and optional wrapper component.
 * @returns A result whose `result.current` holds the hook's latest value.
 */
export function renderHook<Result, Props>(
    callback: (props: Props) => Result,
    options: RenderHookOptions<Props>,
): Promise<RenderHookResult<Result, Props>>;
export async function renderHook<Result, Props>(
    callback: (props: Props) => Result,
    options?: RenderHookOptions<Props>,
): Promise<RenderHookResult<Result, Props>> {
    const initialProps = (options as { initialProps?: Props } | undefined)?.initialProps as Props;
    const resultRef: { current: Result | undefined } = { current: undefined };
    let currentProps: Props = initialProps;

    const TestComponent = ({ props }: { props: Props }): null => {
        const result = callback(props);
        resultRef.current = result;
        return null;
    };

    const renderResult = await render(<TestComponent props={currentProps} />, {
        container: new Gtk.Box(),
        wrapper: options?.wrapper,
    });

    return {
        result: resultRef as { current: Result },
        rerender: async (newProps?: Props) => {
            if (newProps !== undefined) {
                currentProps = newProps;
            }
            await renderResult.rerender(<TestComponent props={currentProps} />);
        },
        unmount: renderResult.unmount,
    };
}
