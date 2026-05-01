use std::sync::{Mutex, OnceLock};

use neon::event::Channel;
use neon::prelude::*;

#[derive(Debug)]
pub struct NativeErrorReporter {
    channel: Mutex<Option<Channel>>,
}

static REPORTER: OnceLock<NativeErrorReporter> = OnceLock::new();

impl NativeErrorReporter {
    pub fn global() -> &'static Self {
        REPORTER.get_or_init(|| Self {
            channel: Mutex::new(None),
        })
    }

    pub fn initialize(&self, channel: Channel) {
        *self
            .channel
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner) = Some(channel);
    }

    pub fn report(&self, error: &anyhow::Error) {
        self.report_str(&format!("{error:#}"));
    }

    pub fn report_str(&self, message: &str) {
        let channel = self
            .channel
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .clone();

        let Some(channel) = channel else {
            eprintln!("[gtkx] ERROR (not initialized): {message}");
            return;
        };

        let message = message.to_owned();
        channel.send(move |mut cx| {
            cx.throw_error::<_, ()>(message)?;
            Ok(())
        });
    }
}
