use std::cell::OnceCell;
use std::ffi::c_void;

use libffi::middle as libffi;

use super::Codec;
use super::prelude::*;
use crate::ffi::library_cache::FfiCache;
use crate::handle::{Handle, Resource, ResourceKind, ResourceReleaseFn, ResourceRollback};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ResourceAction {
    Result,
    End,
}

impl ResourceAction {
    pub(crate) fn parse(action: &str) -> anyhow::Result<Self> {
        match action {
            "result" => Ok(Self::Result),
            "end" => Ok(Self::End),
            _ => anyhow::bail!("Unknown resource action '{action}'"),
        }
    }
}

#[derive(Debug, Clone)]
pub struct ResourceCodec {
    inner_codec: Box<Codec>,
    action: ResourceAction,
    kind: ResourceKind,
    release: OnceCell<ResourceReleaseFn>,
}

pub(crate) struct PreparedResourceResult<'a> {
    storage: &'a ffi::StashStorage,
    kind: ResourceKind,
    release: ResourceReleaseFn,
}

impl PreparedResourceResult<'_> {
    pub(crate) fn arm(self) -> Option<ResourceRollback> {
        let ptr = unsafe { self.storage.ptr().cast::<*mut c_void>().read_unaligned() };
        if ptr.is_null() {
            return None;
        }

        let resource = Resource::new(self.kind, ptr, self.release);
        self.storage
            .set_resource_output(Handle::resource(resource.clone()));

        Some(ResourceRollback::new(resource))
    }
}

impl ResourceCodec {
    pub(crate) fn new(
        inner_codec: Codec,
        action: ResourceAction,
        shared_library: String,
        release_fn_name: String,
    ) -> anyhow::Result<Self> {
        anyhow::ensure!(
            matches!(
                &inner_codec,
                Codec::Boxed(boxed)
                    if boxed.ownership.is_borrowed()
                        && !boxed.caller_allocated
                        && !boxed.inline
            ),
            "A resource action can only wrap a borrowed boxed descriptor"
        );

        Ok(Self {
            inner_codec: Box::new(inner_codec),
            action,
            kind: ResourceKind::new(shared_library, release_fn_name)?,
            release: OnceCell::new(),
        })
    }

    pub(crate) fn inner_codec(&self) -> &Codec {
        &self.inner_codec
    }

    pub(crate) fn action(&self) -> ResourceAction {
        self.action
    }

    pub(crate) fn kind(&self) -> &ResourceKind {
        &self.kind
    }

    fn release_fn(&self) -> anyhow::Result<ResourceReleaseFn> {
        if let Some(release) = self.release.get() {
            return Ok(*release);
        }

        let release = FfiCache::with(|state| unsafe {
            state.resolve_symbol::<ResourceReleaseFn>(
                self.kind.shared_library(),
                self.kind.release_fn_name(),
            )
        })?;
        let _ = self.release.set(release);

        Ok(release)
    }

    pub(crate) fn prepare_result<'a>(
        &self,
        stash: &'a ffi::Stash,
    ) -> anyhow::Result<Option<PreparedResourceResult<'a>>> {
        anyhow::ensure!(
            self.action == ResourceAction::Result,
            "Only a resource result can prepare an output"
        );
        let Some(storage) = stash.as_storage_or_null("Ref<Resource>")? else {
            return Ok(None);
        };
        let ffi::StashData::PtrSlot(_, _) = storage.data() else {
            anyhow::bail!("A resource result was not marshalled as a pointer slot")
        };

        Ok(Some(PreparedResourceResult {
            storage,
            kind: self.kind.clone(),
            release: self.release_fn()?,
        }))
    }

    fn input_handle(value: Unknown<'_>) -> anyhow::Result<Handle> {
        match value.get_type()? {
            ValueType::External => {
                let external: &External<Handle> = value::read_napi(value)?;
                anyhow::ensure!(
                    !external.is_invalidated(),
                    "The resource handle refers to nothing: {}",
                    crate::handle::INVALIDATED_HANDLE
                );
                Ok(Handle::clone(external))
            }
            ValueType::Null | ValueType::Undefined => {
                anyhow::bail!("A resource end value must not be null")
            }
            other => anyhow::bail!("Expected an Object for resource type, got {other:?}"),
        }
    }

    fn end_stash(&self, value: Unknown<'_>) -> anyhow::Result<ffi::Stash> {
        let handle = Self::input_handle(value)?;
        let resource = handle
            .as_resource()
            .ok_or_else(|| anyhow::anyhow!("The value is not an owned resource"))?;
        anyhow::ensure!(
            resource.kind() == &self.kind,
            "The resource belongs to a different release symbol"
        );

        Ok(ffi::Stash::Storage(ffi::StashStorage::retaining_handle(
            resource.as_ptr(),
            handle,
        )))
    }

    fn end_resource(stash: &ffi::Stash) -> anyhow::Result<Resource> {
        let ffi::Stash::Storage(storage) = stash else {
            anyhow::bail!("A resource end argument was not marshalled as retained storage")
        };
        storage
            .retained_handle()
            .and_then(Handle::as_resource)
            .cloned()
            .ok_or_else(|| anyhow::anyhow!("A resource end argument did not retain its resource"))
    }

    pub(crate) fn prepare_end(&self, stash: &ffi::Stash) -> anyhow::Result<Resource> {
        anyhow::ensure!(
            self.action == ResourceAction::End,
            "Only a resource end can prepare a release"
        );
        let resource = Self::end_resource(stash)?;
        anyhow::ensure!(
            resource.kind() == &self.kind,
            "The resource belongs to a different release symbol"
        );

        Ok(resource)
    }

    fn decode_result<'e>(env: &'e Env, stash: &ffi::Stash) -> anyhow::Result<Unknown<'e>> {
        let Some(storage) = stash.as_storage_or_null("Ref<Resource>")? else {
            return Ok(value::js_null(env)?);
        };
        if let Some(handle) = storage.resource_output() {
            return Ok(value::handle_to_unknown(env, handle)?);
        }

        let ptr = unsafe { storage.ptr().cast::<*mut c_void>().read_unaligned() };
        anyhow::ensure!(ptr.is_null(), "A resource output was not armed");
        Ok(value::js_null(env)?)
    }
}

impl Encoder for ResourceCodec {
    fn encode(&self, _env: &Env, value: Unknown<'_>) -> anyhow::Result<ffi::Stash> {
        match self.action {
            ResourceAction::End => self.end_stash(value),
            ResourceAction::Result => {
                anyhow::bail!("A resource result descriptor cannot encode an argument")
            }
        }
    }

    fn libffi_type(&self) -> libffi::Type {
        self.inner_codec.libffi_type()
    }

    fn call_cif(
        &self,
        cif: &libffi::Cif,
        ptr: libffi::CodePtr,
        args: &[libffi::Arg<'_>],
    ) -> anyhow::Result<ffi::Stash> {
        self.inner_codec.call_cif(cif, ptr, args)
    }
}

impl Decoder for ResourceCodec {
    fn decode_call<'e>(&self, env: &'e Env, stash: &ffi::Stash) -> anyhow::Result<Unknown<'e>> {
        match self.action {
            ResourceAction::Result => Self::decode_result(env, stash),
            ResourceAction::End => {
                anyhow::bail!("A resource end descriptor cannot decode a value")
            }
        }
    }
}

impl PtrWriter for ResourceCodec {}
