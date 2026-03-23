use std::sync::mpsc;

use neon::prelude::*;

use super::handler::{JsThreadCommand, execute_js_command};
use crate::gtk_dispatch;

struct FreezeCommand;

impl JsThreadCommand for FreezeCommand {
    fn from_js(_cx: &mut FunctionContext) -> NeonResult<Self> {
        Ok(Self)
    }

    fn execute<'a>(self, cx: &mut FunctionContext<'a>) -> JsResult<'a, JsValue> {
        let dispatcher = gtk_dispatch::GtkDispatcher::global();

        if !dispatcher.is_started() {
            return cx.throw_error("GTK application has not been started. Call start() first.");
        }

        let is_outermost = dispatcher.freeze();

        if is_outermost {
            let (tx, rx) = mpsc::channel::<()>();

            dispatcher.enter_js_wait();
            dispatcher.schedule(move || {
                let _ = tx.send(());
                let d = gtk_dispatch::GtkDispatcher::global();
                d.wake.notify();
                d.run_freeze_loop();
            });

            dispatcher
                .wait_for_gtk_result(cx, &rx)
                .or_else(|err| cx.throw_error(err.to_string()))?;
        }

        Ok(cx.undefined().upcast())
    }
}

struct UnfreezeCommand;

impl JsThreadCommand for UnfreezeCommand {
    fn from_js(_cx: &mut FunctionContext) -> NeonResult<Self> {
        Ok(Self)
    }

    fn execute<'a>(self, cx: &mut FunctionContext<'a>) -> JsResult<'a, JsValue> {
        gtk_dispatch::GtkDispatcher::global().unfreeze();
        Ok(cx.undefined().upcast())
    }
}

pub fn freeze(mut cx: FunctionContext) -> JsResult<JsValue> {
    execute_js_command::<FreezeCommand>(&mut cx)
}

pub fn unfreeze(mut cx: FunctionContext) -> JsResult<JsValue> {
    execute_js_command::<UnfreezeCommand>(&mut cx)
}
