use super::prelude::*;

#[derive(Debug, Clone, Copy)]
pub struct BufferCodec;

impl Encoder for BufferCodec {
    fn encode(&self, env: &Env, value: Unknown<'_>) -> anyhow::Result<ffi::Stash> {
        if let Some(view) = value::TypedView::from_unknown(env, value)? {
            return Ok(ffi::Stash::Ptr(view.ptr()));
        }
        match value.get_type()? {
            ValueType::BigInt => {
                let integer = value::read_napi::<BigInt>(value)?;
                let (negative, word, lossless) = integer.get_u64();
                anyhow::ensure!(
                    !negative && lossless,
                    "Pointer address exceeds the unsigned pointer range"
                );
                Ok(ffi::Stash::Ptr(usize::try_from(word)? as *mut c_void))
            }
            ValueType::External => Ok(ffi::Stash::Ptr(value::opaque_ptr(value, "buffer")?)),
            ValueType::Null | ValueType::Undefined => Ok(ffi::Stash::Ptr(std::ptr::null_mut())),
            other => {
                bail_expected!(
                    format!(
                        "a bigint address, ArrayBufferView, native handle, or null, got {other:?}"
                    ),
                    "buffer"
                )
            }
        }
    }

    fn encode_owned(&self, env: &Env, value: Unknown<'_>) -> anyhow::Result<ffi::Stash> {
        match value::TypedView::from_unknown(env, value)? {
            Some(view) => Ok(ffi::Stash::Storage(owned_view_storage(&view))),
            None if value.get_type()? == ValueType::External => {
                let pointer = value::opaque_ptr(value, "buffer")?;
                let handle: &External<crate::handle::Handle> = value::read_napi(value)?;
                if handle.is_process_static() {
                    return Ok(ffi::Stash::Ptr(pointer));
                }
                let retained = handle.retain_owned()?;
                Ok(ffi::Stash::Storage(ffi::StashStorage::new(
                    pointer,
                    ffi::StashData::Handle(retained),
                )))
            }
            None => self.encode(env, value),
        }
    }
}

impl Decoder for BufferCodec {
    fn decode_call<'e>(&self, env: &'e Env, stash: &ffi::Stash) -> anyhow::Result<Unknown<'e>> {
        unsafe {
            self.read_value(
                env,
                stash.as_ptr("pointer return")?,
                "pointer return",
                Ownership::Borrowed,
            )
        }
    }

    unsafe fn read_value<'e>(
        &self,
        env: &'e Env,
        ptr: *mut c_void,
        _context: &str,
        _transfer: Ownership,
    ) -> anyhow::Result<Unknown<'e>> {
        if ptr.is_null() {
            return Ok(value::js_null(env)?);
        }
        Ok(BigInt::from(ptr as u64).into_unknown(env)?)
    }
}

impl PtrWriter for BufferCodec {
    fn write_value_to_ptr(
        &self,
        env: &Env,
        slot: ffi::Slot,
        value: Unknown<'_>,
        _init: SlotInit,
    ) -> anyhow::Result<Option<ffi::PendingTransfer>> {
        let encoded = self.encode(env, value)?;
        unsafe { slot.store(encoded.as_ptr("pointer value")?) };
        Ok(None)
    }

    fn write_return_to_ptr(
        &self,
        env: &Env,
        ret: ffi::Slot,
        value: &std::result::Result<Unknown<'_>, ()>,
    ) {
        let pointer = match value {
            Ok(value) => self
                .encode(env, *value)
                .and_then(|encoded| encoded.as_ptr("pointer return"))
                .unwrap_or_else(|error| {
                    reject_callback_return(*env, &error);
                    std::ptr::null_mut()
                }),
            Err(()) => std::ptr::null_mut(),
        };
        unsafe { ret.store(pointer) };
    }
}
