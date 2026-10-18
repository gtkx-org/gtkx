use super::prelude::*;
use crate::ffi::match_info;
use crate::handle::Handle;

#[derive(Debug, Clone, Copy)]
pub struct MatchInfoCodec {
    pub ownership: Ownership,
    pub subject_arg_index: Option<usize>,
}

impl Encoder for MatchInfoCodec {
    fn check_instance(&self, handle: &Handle) -> anyhow::Result<()> {
        anyhow::ensure!(
            handle.boxed_type() == Some(match_info::type_()),
            "Expected a boxed GtkxMatchInfo handle"
        );
        Ok(())
    }

    fn checked_handle_ptr<C>(
        &self,
        value: Unknown<'_>,
        context: &str,
        check: C,
    ) -> anyhow::Result<*mut c_void>
    where
        C: FnOnce(&Handle) -> anyhow::Result<()>,
    {
        let mut pointer = std::ptr::null_mut();
        value::handle_ptr_checked(value, context, |handle| {
            self.check_instance(handle)?;
            check(handle)?;
            pointer = match_info::project(handle)?;
            Ok(())
        })?;
        Ok(pointer)
    }

    fn encode(&self, _env: &Env, value: Unknown<'_>) -> anyhow::Result<ffi::Stash> {
        anyhow::ensure!(
            self.ownership.is_borrowed(),
            "MatchInfo cannot transfer a raw native pointer without its subject owner"
        );
        let pointer = self.checked_handle_ptr(value, "MatchInfo input", |_| Ok(()))?;
        if pointer.is_null() {
            return Ok(ffi::Stash::Ptr(pointer));
        }
        let holder: &External<Handle> = value::read_napi(value)?;
        Ok(ffi::Stash::Storage(ffi::StashStorage::new(
            pointer,
            ffi::StashData::Handle((**holder).clone()),
        )))
    }

    fn owned_release(&self) -> anyhow::Result<Option<ffi::ReleaseKind>> {
        Ok(self
            .ownership
            .is_full()
            .then_some(ffi::ReleaseKind::Function(match_info::unref)))
    }

    unsafe fn ref_for_transfer(&self, pointer: *mut c_void) -> anyhow::Result<*mut c_void> {
        anyhow::ensure!(
            self.ownership.is_borrowed(),
            "MatchInfo cannot transfer a raw native pointer without its subject owner"
        );
        Ok(pointer)
    }
}

impl Decoder for MatchInfoCodec {
    fn decode_call<'e>(&self, env: &'e Env, stash: &ffi::Stash) -> anyhow::Result<Unknown<'e>> {
        self.decode_call_non_null(env, stash, "MatchInfo", |pointer| {
            let holder = unsafe { match_info::own(pointer, self.ownership) }?;
            Ok(value::handle_to_unknown(env, holder)?)
        })
    }

    read_value_non_null!(|self, env, pointer, transfer| {
        let holder = unsafe { match_info::own(pointer, transfer) }?;
        Ok(value::handle_to_unknown(env, holder)?)
    });
}

impl PtrWriter for MatchInfoCodec {
    fn write_return_to_ptr(
        &self,
        env: &Env,
        ret: ffi::Slot,
        value: &std::result::Result<Unknown<'_>, ()>,
    ) {
        if value.is_ok() {
            reject_callback_return(
                *env,
                &anyhow::anyhow!(
                    "MatchInfo cannot return a raw native pointer without its subject owner"
                ),
            );
        }
        unsafe { ret.store(std::ptr::null_mut()) };
    }

    fn write_value_to_ptr(
        &self,
        _env: &Env,
        _slot: ffi::Slot,
        _value: Unknown<'_>,
        _init: SlotInit,
    ) -> anyhow::Result<Option<ffi::PendingTransfer>> {
        anyhow::bail!("MatchInfo cannot write a raw native pointer without its subject owner")
    }
}
