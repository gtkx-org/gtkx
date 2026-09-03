use napi_derive::napi;

#[napi(catch_unwind)]
pub fn arm_parent_death(expected_parent: u32) -> napi::Result<bool> {
    #[cfg(target_os = "linux")]
    {
        let armed = unsafe { libc::prctl(libc::PR_SET_PDEATHSIG, libc::SIGTERM) };

        if armed != 0 {
            return Err(napi::Error::from_reason(
                std::io::Error::last_os_error().to_string(),
            ));
        }

        let parent = unsafe { libc::getppid() };
        Ok(parent >= 0 && u32::try_from(parent).ok() == Some(expected_parent))
    }

    #[cfg(not(target_os = "linux"))]
    {
        let _ = expected_parent;
        Ok(true)
    }
}
