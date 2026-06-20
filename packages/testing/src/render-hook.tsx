import { createRootElement } from "@gtkx/react";
import { useRef } from "react";
import { render } from "./render.js";
import type { RenderHookOptions, RenderHookResult } from "./types.js";

export function renderHook<Result>(
    callback: () => Result,
    options?: RenderHookOptions<undefined>,
): Promise<RenderHookResult<Result, undefined>>;
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
        const ref = useRef(resultRef);
        ref.current.current = result;
        return null;
    };

    const renderResult = await render(<TestComponent props={currentProps} />, {
        container: createRootElement(),
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
