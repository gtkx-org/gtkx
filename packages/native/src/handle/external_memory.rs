use std::cell::Cell;

use crate::host::node_env;

/// Native memory a handle keeps alive beyond its own allocation, counted toward the garbage
/// collector's external memory until the handle is released.
#[derive(Default)]
pub(super) struct ExternalMemory {
    bytes: Cell<i64>,
}

impl ExternalMemory {
    pub(super) fn add(&self, bytes: i64) -> napi::Result<()> {
        node_env::env().adjust_external_memory(bytes)?;
        self.bytes.set(self.bytes.get() + bytes);

        Ok(())
    }
}

impl Drop for ExternalMemory {
    fn drop(&mut self) {
        let bytes = self.bytes.get();

        if bytes == 0 {
            return;
        }

        if let Some(env) = node_env::try_env() {
            let _ = env.adjust_external_memory(-bytes);
        }
    }
}
