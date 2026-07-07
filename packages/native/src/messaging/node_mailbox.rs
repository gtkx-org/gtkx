use std::panic::{self, AssertUnwindSafe};
use std::sync::mpsc;

use napi::Env;
use napi::bindgen_prelude::{
    Function, JsObjectValue, JsValue, JsValuesTupleIntoVec, Object, Unknown,
};
use napi::threadsafe_function::ThreadsafeFunctionCallMode;

use super::{
    LockExt as _, Mailbox, NodeCallback, NodeCallbackResult, NodeTask, WrapperRefOp, send_or_report,
};
use crate::ffi::value::{JsHandle, Value, release_registered_js_ref};
use crate::messaging::panic_handler::format_panic_payload;

struct CallbackArgs(Vec<napi::sys::napi_value>);

impl JsValuesTupleIntoVec for CallbackArgs {
    fn into_vec(self, _env: napi::sys::napi_env) -> napi::Result<Vec<napi::sys::napi_value>> {
        Ok(self.0)
    }
}

fn node_channel_disconnected<R>() -> anyhow::Result<R> {
    Err(anyhow::anyhow!("JS callback channel disconnected"))
}

fn poll_result<R>(rx: &mpsc::Receiver<R>) -> napi::Result<Option<R>> {
    match rx.try_recv() {
        Ok(result) => Ok(Some(result)),
        Err(mpsc::TryRecvError::Disconnected) => Err(napi::Error::new(
            napi::Status::GenericFailure,
            "GLib thread disconnected",
        )),
        Err(mpsc::TryRecvError::Empty) => Ok(None),
    }
}

impl Mailbox {
    pub fn install_wake(&self, env: Env) -> napi::Result<()> {
        let wake_tsfn = super::build_weak_tsfn::<(), _>(env, "gtkx_wake_node", |ctx| {
            Self::global().process_node_pending(*ctx.env);
            Ok(())
        })?;

        let _ = self.wake_node_tsfn.set(wake_tsfn);
        Ok(())
    }

    fn push_node_task(&self, task: NodeTask) {
        self.node_inbox.lock_unpoison().push_back(task);
        self.wake_node.notify();
        self.wake_node_loop();
    }

    fn pop_node_task(&self) -> Option<NodeTask> {
        self.node_inbox.lock_unpoison().pop_front()
    }

    fn wake_node_loop(&self) {
        if let Some(tsfn) = self.wake_node_tsfn.get() {
            tsfn.call((), ThreadsafeFunctionCallMode::NonBlocking);
        }
    }

    pub(crate) fn schedule_js_reference_release(&self, id: u64) {
        self.push_node_task(NodeTask::ReleaseJsRef { id });
    }

    pub(crate) fn schedule_wrapper_ref_delete(&self, napi_ref: usize) {
        self.push_node_task(NodeTask::DeleteWrapperRef { napi_ref });
    }

    pub(crate) fn schedule_wrapper_unref(&self, napi_ref: usize) {
        self.push_node_task(NodeTask::WrapperUnref { napi_ref });
    }

    pub fn invoke_glib_and_wait_napi<R, F>(&self, env: Env, task: F) -> napi::Result<R>
    where
        F: FnOnce() -> R + Send + 'static,
        R: Send + 'static,
    {
        let (tx, rx) = mpsc::channel();
        self.schedule_glib(Box::new(move || {
            let result = panic::catch_unwind(AssertUnwindSafe(task))
                .map_err(|payload| format_panic_payload(&*payload));
            send_or_report(
                &tx,
                result,
                "GLib dispatch completed but result channel was closed",
            );
        }));
        match self.wait_for_glib_result(env, &rx)? {
            Ok(value) => Ok(value),
            Err(message) => Err(napi::Error::new(
                napi::Status::GenericFailure,
                format!("GLib task panicked: {message}"),
            )),
        }
    }

    fn wait_for_glib_result<R>(&self, env: Env, rx: &mpsc::Receiver<R>) -> napi::Result<R> {
        loop {
            if let Some(result) = poll_result(rx)? {
                return Ok(result);
            }

            self.process_node_pending(env);

            if let Some(result) = poll_result(rx)? {
                return Ok(result);
            }
            self.wake_node.wait();
        }
    }

    pub fn invoke_node_and_wait_with_refs(
        &self,
        callback: &JsHandle,
        args: Vec<Value>,
        capture_result: bool,
        ref_indices: Vec<usize>,
    ) -> anyhow::Result<super::NodeCallbackResult> {
        let callback = callback.clone();
        self.invoke_node_task_and_wait(move |result_tx, glib_initiated| {
            NodeTask::Callback(NodeCallback {
                callback,
                args,
                capture_result,
                ref_indices,
                result_tx,
                glib_initiated,
            })
        })
    }

    pub(crate) fn apply_wrapper_ref_op_and_wait(
        &self,
        napi_ref: usize,
        op: WrapperRefOp,
    ) -> anyhow::Result<()> {
        self.invoke_node_task_and_wait(|result_tx, glib_initiated| NodeTask::WrapperRefOp {
            napi_ref,
            op,
            result_tx,
            glib_initiated,
        })
    }

    fn invoke_node_task_and_wait<R>(
        &self,
        build: impl FnOnce(mpsc::Sender<anyhow::Result<R>>, bool) -> NodeTask,
    ) -> anyhow::Result<R> {
        let (glib_initiated, wait_depth) = self.node_wait_setup();
        let (tx, rx) = mpsc::channel();

        self.push_node_task(build(tx, glib_initiated));

        self.wait_node(&rx, wait_depth)
    }

    fn node_wait_setup(&self) -> (bool, Option<usize>) {
        let glib_initiated = glib::MainContext::default().is_owner();
        let wait_depth = glib_initiated.then(|| {
            self.callback_depth
                .load(std::sync::atomic::Ordering::Acquire)
                + 1
        });
        (glib_initiated, wait_depth)
    }

    fn wait_node<R>(
        &self,
        rx: &mpsc::Receiver<anyhow::Result<R>>,
        wait_depth: Option<usize>,
    ) -> anyhow::Result<R> {
        let Some(wait_depth) = wait_depth else {
            return rx.recv().unwrap_or_else(|_| node_channel_disconnected());
        };
        self.wait_for_node_result(rx, wait_depth)
    }

    fn wait_for_node_result<R>(
        &self,
        rx: &mpsc::Receiver<anyhow::Result<R>>,
        wait_depth: usize,
    ) -> anyhow::Result<R> {
        loop {
            self.process_glib_pending_from_depth(wait_depth);

            match rx.try_recv() {
                Ok(result) => return result,
                Err(mpsc::TryRecvError::Disconnected) => return node_channel_disconnected(),
                Err(mpsc::TryRecvError::Empty) => self.wake_glib.wait(),
            }
        }
    }

    pub fn process_node_pending(&self, env: Env) {
        while let Some(task) = self.pop_node_task() {
            match task {
                NodeTask::Callback(pending) => {
                    let NodeCallback {
                        callback,
                        args,
                        capture_result,
                        ref_indices,
                        result_tx,
                        glib_initiated,
                    } = pending;
                    self.run_glib_initiated(
                        glib_initiated,
                        &result_tx,
                        "Node callback completed but result channel was closed",
                        || {
                            Self::execute_callback(
                                env,
                                &callback,
                                args,
                                capture_result,
                                &ref_indices,
                            )
                        },
                    );
                }
                NodeTask::ReleaseJsRef { id } => release_registered_js_ref(id),
                NodeTask::DeleteWrapperRef { napi_ref } => {
                    let raw_ref = napi_ref as napi::sys::napi_ref;
                    let status = unsafe { napi::sys::napi_delete_reference(env.raw(), raw_ref) };
                    debug_assert_eq!(status, napi::sys::Status::napi_ok);
                }
                NodeTask::WrapperRefOp {
                    napi_ref,
                    op,
                    result_tx,
                    glib_initiated,
                } => {
                    self.run_glib_initiated(
                        glib_initiated,
                        &result_tx,
                        "Wrapper reference operation completed but result channel was closed",
                        || {
                            op.apply(&env, napi_ref);
                            Ok(())
                        },
                    );
                }
                NodeTask::WrapperUnref { napi_ref } => WrapperRefOp::Unref.apply(&env, napi_ref),
            }
        }
    }

    fn run_glib_initiated<R>(
        &self,
        glib_initiated: bool,
        result_tx: &mpsc::Sender<anyhow::Result<R>>,
        message: &'static str,
        op: impl FnOnce() -> anyhow::Result<R>,
    ) {
        if glib_initiated {
            self.enter_glib_callback();
        }
        let result = op();
        if glib_initiated {
            self.leave_glib_callback();
        }
        send_or_report(result_tx, result, message);
        self.wake_glib.notify();
    }

    fn wrap_ref<'env>(env: &'env Env, value: Unknown<'env>) -> napi::Result<Unknown<'env>> {
        let mut ref_obj: Object<'env> = Object::new(env)?;
        ref_obj.set_named_property("value", value)?;
        Ok(ref_obj.to_unknown())
    }

    fn read_refs(
        env: &Env,
        js_args: &[Unknown<'_>],
        ref_indices: &[usize],
    ) -> napi::Result<Vec<(usize, Value)>> {
        let mut refs = Vec::with_capacity(ref_indices.len());
        for &index in ref_indices {
            let Some(arg) = js_args.get(index) else {
                continue;
            };
            let ref_obj = Object::from_raw(env.raw(), arg.raw());
            let inner: Unknown<'_> = ref_obj.get_named_property("value")?;
            refs.push((index, Value::from_js_value(env, inner)?));
        }
        Ok(refs)
    }

    fn execute_callback(
        env: Env,
        callback: &JsHandle,
        args: Vec<Value>,
        capture_result: bool,
        ref_indices: &[usize],
    ) -> anyhow::Result<NodeCallbackResult> {
        let js_args: Vec<Unknown<'_>> = args
            .into_iter()
            .enumerate()
            .map(|(index, v)| {
                let converted = v
                    .to_js_value(&env)
                    .map_err(|e| anyhow::anyhow!("converting callback arg: {e}"))?;
                if ref_indices.contains(&index) {
                    Self::wrap_ref(&env, converted)
                        .map_err(|e| anyhow::anyhow!("wrapping ref arg: {e}"))
                } else {
                    Ok(converted)
                }
            })
            .collect::<anyhow::Result<Vec<_>>>()?;

        let raw_args: Vec<_> = js_args.iter().map(napi::JsValue::raw).collect();

        let function: Function<CallbackArgs, Unknown> = callback
            .get(&env)
            .map_err(|e| anyhow::anyhow!("retrieving callback function: {e}"))?;
        let return_value = function
            .call(CallbackArgs(raw_args))
            .map_err(|e| anyhow::anyhow!("{}", e.reason))?;

        let refs = Self::read_refs(&env, &js_args, ref_indices)
            .map_err(|e| anyhow::anyhow!("reading ref args: {e}"))?;

        let value = if capture_result {
            Value::from_js_value(&env, return_value)
                .map_err(|e| anyhow::anyhow!("converting callback result: {e}"))?
        } else {
            Value::Undefined
        };
        Ok((value, refs))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn poll_result_yields_the_pending_value() {
        let (tx, rx) = mpsc::channel();
        tx.send(7u32).expect("send should succeed");
        assert_eq!(poll_result(&rx).expect("poll should succeed"), Some(7));
    }

    #[test]
    fn poll_result_is_none_while_empty() {
        let (_tx, rx) = mpsc::channel::<u32>();
        assert_eq!(poll_result(&rx).expect("poll should succeed"), None);
    }

    #[test]
    fn poll_result_errors_once_the_sender_is_dropped() {
        let (tx, rx) = mpsc::channel::<u32>();
        drop(tx);
        assert!(poll_result(&rx).is_err());
    }

    #[test]
    fn node_channel_disconnected_is_always_an_error() {
        assert!(node_channel_disconnected::<()>().is_err());
    }
}
