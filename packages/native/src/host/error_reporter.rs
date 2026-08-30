use super::node_env;

pub(crate) fn report(error: &anyhow::Error) {
    report_str(&format!("{error:#}"));
}

pub(crate) fn report_str(message: &str) {
    eprintln!("gtkx: {message}");
    if node_env::is_installed_on_current_thread() {
        node_env::raise_fatal(message);
    } else {
        let message = message.to_owned();
        node_env::invoke_on_install_thread("fatal error report", move || {
            node_env::raise_fatal(&message);
        });
    }
}

pub(crate) trait ReportErr<T> {
    fn report_err<C>(self, context: C) -> Option<T>
    where
        C: std::fmt::Display + Send + Sync + 'static;
}

impl<T> ReportErr<T> for anyhow::Result<T> {
    fn report_err<C>(self, context: C) -> Option<T>
    where
        C: std::fmt::Display + Send + Sync + 'static,
    {
        match self {
            Ok(value) => Some(value),
            Err(error) => {
                report(&error.context(context));
                None
            }
        }
    }
}
