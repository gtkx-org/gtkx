import {
    type AsyncResult,
    Controller,
    type ControllerUpdate,
    Globals,
    type SpringProps,
    type SpringUpdate,
    SpringValue,
} from "@react-spring/core";
import { is } from "@react-spring/shared";

type LoopingUpdate = { loop?: Loop | undefined };
type LoopFunction = () => boolean | LoopingUpdate;
type Loop = boolean | LoopingUpdate | LoopFunction;

const isLoopFunction = (loop: Loop): loop is LoopFunction => typeof loop === "function";

const resolveLoop = (loop: Loop): boolean | LoopingUpdate => (isLoopFunction(loop) ? loop() : loop);

const guardLoop = <T extends LoopingUpdate>(update: T): T => {
    const { loop } = update;

    if (!loop) {
        return update;
    }

    return {
        ...update,
        loop: () => {
            if (Globals.skipAnimation) {
                return false;
            }

            const resolved = resolveLoop(loop);

            return typeof resolved === "object" ? guardLoop(resolved) : resolved;
        },
    };
};

/* TODO: End each `loop` at the pass that finds animations skipped until React Spring stops restarting loops
 * synchronously under `skipAnimation`, which GTKX derives from `gtk-enable-animations`.
 * https://github.com/pmndrs/react-spring/issues/2409
 */
/* eslint-disable @typescript-eslint/unbound-method -- the overrides call the originals on their own instance */
const startController = Controller.prototype.start;
const startSpringValue: (this: SpringValue, props?: SpringUpdate) => AsyncResult<SpringValue> =
    SpringValue.prototype.start;
/* eslint-enable @typescript-eslint/unbound-method */

Controller.prototype.start = function start(this: Controller, props?: ControllerUpdate | ControllerUpdate[] | null) {
    if (!props) {
        this.queue = this.queue.map(guardLoop);

        return startController.call(this);
    }

    return startController.call(this, is.arr(props) ? props.map(guardLoop) : guardLoop(props));
};

SpringValue.prototype.start = function start(this: SpringValue, to?: unknown, props?: SpringProps) {
    if (to === undefined) {
        if (this.queue) {
            this.queue = this.queue.map(guardLoop);
        }

        return startSpringValue.call(this);
    }

    return startSpringValue.call(this, guardLoop(is.obj(to) ? to : { ...props, to }));
};
