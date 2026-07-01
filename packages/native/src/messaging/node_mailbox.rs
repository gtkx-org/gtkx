use std::panic::{self, AssertUnwindSafe};
use std::sync::{Arc, mpsc};

use napi::Env;
use napi::bindgen_prelude::{FromNapiValue, JsObjectValue, JsValue, Object, Unknown};
use napi::threadsafe_function::ThreadsafeFunctionCallMode;

use super::{
    GlibInvokeError, JsRefDeletion, Mailbox, NodeCallback, NodeCallbackResult, NodeTask,
    WakeNodeTsfn, send_or_report,
};
use crate::ffi::value::{JsRef, Value};
use crate::handle::wrapper::WrapperRefOp;
use crate::messaging::panic_handler::format_panic_payload;

fn node_channel_disconnected<R>() -> anyhow::Result<R> {
    Err(anyhow::anyhow!("JS callback channel disconnected"))
}

#[derive(Debug)]
pub struct ReadySignal {
    tx: mpsc::Sender<()>,
}

impl ReadySignal {
    pub fn signal(self) {
        send_or_report(
            &self.tx,
            (),
            "Long-lived GLib task ready signal channel was closed",
        );
        Mailbox::global().wake_node.notify();
    }
}

fn poll_result<R>(rx: &mpsc::Receiver<R>) -> Result<Option<R>, GlibInvokeError> {
    match rx.try_recv() {
        Ok(result) => Ok(Some(result)),
        Err(mpsc::TryRecvError::Disconnected) => Err(GlibInvokeError::disconnected()),
        Err(mpsc::TryRecvError::Empty) => Ok(None),
    }
}

impl Mailbox {
    fn set_wake_tsfn(&self, tsfn: Arc<WakeNodeTsfn>) {
        let _ = self.wake_node_tsfn.set(tsfn);
    }

    pub fn install_wake(&self, env: Env) -> napi::Result<()> {
        let wake_node_fn =
            env.create_function_from_closure::<(), _, _>("gtkx_wake_node", |ctx| {
                Self::global().process_node_pending(*ctx.env);
                Ok(())
            })?;

        let wake_tsfn: WakeNodeTsfn = wake_node_fn
            .build_threadsafe_function::<()>()
            .weak::<true>()
            .callee_handled::<false>()
            .build()?;

        self.set_wake_tsfn(Arc::new(wake_tsfn));
        Ok(())
    }

    fn push_node_task(&self, task: NodeTask) {
        self.node_inbox.lock().push_back(task);
        self.wake_node.notify();
    }

    fn pop_node_task(&self) -> Option<NodeTask> {
        self.node_inbox.lock().pop_front()
    }

    fn wake_node_loop(&self) {
        if let Some(tsfn) = self.wake_node_tsfn.get() {
            tsfn.call((), ThreadsafeFunctionCallMode::NonBlocking);
        }
    }

    pub(crate) fn schedule_js_reference_delete(&self, reference: JsRefDeletion) {
        self.push_node_task(NodeTask::DeleteReference(reference));
        self.wake_node_loop();
    }

    fn invoke_glib_and_wait<R, F>(&self, env: Env, task: F) -> Result<R, GlibInvokeError>
    where
        F: FnOnce() -> R + Send + 'static,
        R: Send + 'static,
    {
        let (tx, rx) = mpsc::channel();
        self.schedule_glib(Box::new(move || {
            let outcome = panic::catch_unwind(AssertUnwindSafe(task))
                .map_err(|payload| format_panic_payload(&*payload));
            send_or_report(
                &tx,
                outcome,
                "GLib dispatch completed but result channel was closed",
            );
        }));
        self.wait_for_glib_result(env, &rx)?
            .map_err(|message| GlibInvokeError::task_panicked(&message))
    }

    pub fn invoke_glib_and_wait_napi<R, F>(&self, env: Env, task: F) -> napi::Result<R>
    where
        F: FnOnce() -> R + Send + 'static,
        R: Send + 'static,
    {
        self.invoke_glib_and_wait(env, task)
            .map_err(|e| napi::Error::new(napi::Status::GenericFailure, e.to_string()))
    }

    pub fn invoke_long_lived_glib_task<F>(&self, env: Env, task: F) -> napi::Result<()>
    where
        F: FnOnce(ReadySignal) + Send + 'static,
    {
        let (tx, rx) = mpsc::channel::<()>();
        self.schedule_glib(Box::new(move || task(ReadySignal { tx })));
        self.wait_for_glib_result(env, &rx)
            .map_err(|e| napi::Error::new(napi::Status::GenericFailure, e.to_string()))
    }

    fn wait_for_glib_result<R>(
        &self,
        env: Env,
        rx: &mpsc::Receiver<R>,
    ) -> Result<R, GlibInvokeError> {
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
        callback: &Arc<JsRef>,
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

    pub fn apply_wrapper_ref_op_and_wait(
        &self,
        ref_ptr: usize,
        op: WrapperRefOp,
    ) -> anyhow::Result<()> {
        self.invoke_node_task_and_wait(|result_tx, glib_initiated| NodeTask::WrapperRefOp {
            ref_ptr,
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

        self.wake_node_loop();
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
        let Some(depth) = wait_depth else {
            return rx.recv().unwrap_or_else(|_| node_channel_disconnected());
        };
        self.wait_for_node_result(rx, depth)
    }

    fn wait_for_node_result<R>(
        &self,
        rx: &mpsc::Receiver<anyhow::Result<R>>,
        callback_depth: usize,
    ) -> anyhow::Result<R> {
        loop {
            self.process_glib_pending_from_depth(callback_depth);

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
                NodeTask::DeleteReference(reference) => reference.delete_on_node_thread(),
                NodeTask::WrapperRefOp {
                    ref_ptr,
                    op,
                    result_tx,
                    glib_initiated,
                } => {
                    self.run_glib_initiated(
                        glib_initiated,
                        &result_tx,
                        "Wrapper reference operation completed but result channel was closed",
                        || {
                            op.apply(&env, ref_ptr);
                            Ok(())
                        },
                    );
                }
            }
        }
    }

    fn run_glib_initiated<R>(
        &self,
        glib_initiated: bool,
        result_tx: &mpsc::Sender<anyhow::Result<R>>,
        closed_message: &'static str,
        op: impl FnOnce() -> anyhow::Result<R>,
    ) {
        if glib_initiated {
            self.enter_glib_callback();
        }
        let result = op();
        if glib_initiated {
            self.leave_glib_callback();
        }
        send_or_report(result_tx, result, closed_message);
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
        callback: &Arc<JsRef>,
        args: Vec<Value>,
        capture_result: bool,
        ref_indices: &[usize],
    ) -> anyhow::Result<NodeCallbackResult> {
        use napi::sys;

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

        let raw_args: Vec<sys::napi_value> = js_args.iter().map(napi::JsValue::raw).collect();

        let raw_fn = callback
            .get_raw(&env)
            .map_err(|e| anyhow::anyhow!("retrieving callback function: {e}"))?;

        let mut undef_this = std::ptr::null_mut();
        unsafe {
            sys::napi_get_undefined(env.raw(), &mut undef_this);
        }

        let mut return_value = std::ptr::null_mut();
        let status = unsafe {
            sys::napi_call_function(
                env.raw(),
                undef_this,
                raw_fn,
                raw_args.len(),
                raw_args.as_ptr(),
                &mut return_value,
            )
        };

        if status == sys::Status::napi_pending_exception {
            let mut exception = std::ptr::null_mut();
            unsafe {
                sys::napi_get_and_clear_last_exception(env.raw(), &mut exception);
            }
            let msg = if exception.is_null() {
                "JS callback threw an exception".to_owned()
            } else {
                Self::extract_exception_message(env.raw(), exception)
            };
            return Err(anyhow::anyhow!("{msg}"));
        }
        if status != sys::Status::napi_ok {
            return Err(anyhow::anyhow!("napi_call_function failed: {status:?}"));
        }

        let refs = Self::read_refs(&env, &js_args, ref_indices)
            .map_err(|e| anyhow::anyhow!("reading ref args: {e}"))?;

        let value = if capture_result {
            let unknown = unsafe { Unknown::from_napi_value(env.raw(), return_value)? };
            Value::from_js_value(&env, unknown)
                .map_err(|e| anyhow::anyhow!("converting callback result: {e}"))?
        } else {
            Value::Undefined
        };
        Ok((value, refs))
    }

    fn extract_exception_message(
        env: napi::sys::napi_env,
        exception: napi::sys::napi_value,
    ) -> String {
        use napi::sys;

        let mut value_type = sys::ValueType::napi_undefined;
        unsafe {
            sys::napi_typeof(env, exception, &mut value_type);
        }

        if value_type == sys::ValueType::napi_object {
            let mut message = std::ptr::null_mut();
            unsafe {
                sys::napi_get_named_property(env, exception, c"message".as_ptr(), &mut message);
            }
            if !message.is_null()
                && let Ok(s) = unsafe { String::from_napi_value(env, message) }
            {
                return s;
            }
        } else if value_type == sys::ValueType::napi_string
            && let Ok(s) = unsafe { String::from_napi_value(env, exception) }
        {
            return s;
        }

        "unknown exception".to_owned()
    }
}
