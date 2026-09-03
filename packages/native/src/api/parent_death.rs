use std::io;
use std::os::fd::{AsRawFd, FromRawFd, OwnedFd};
use std::time::Duration;

use napi_derive::napi;

struct ProcessStat {
    parent: u32,
    start_time: String,
    state: u8,
}

enum OwnerMonitor {
    PidFd(OwnedFd),
    Proc { pid: u32, start_time: String },
}

const PROC_POLL_INTERVAL: Duration = Duration::from_millis(50);

fn process_stat(pid: u32) -> io::Result<ProcessStat> {
    let stat = std::fs::read_to_string(format!("/proc/{pid}/stat"))?;
    let mut fields = stat
        .rsplit_once(") ")
        .map(|(_, fields)| fields)
        .map(str::split_whitespace)
        .ok_or_else(|| io::Error::other(format!("Failed to identify process {pid}")))?;
    let state = fields
        .next()
        .and_then(|value| value.as_bytes().first().copied())
        .ok_or_else(|| io::Error::other(format!("Failed to identify process {pid}")))?;
    let parent = fields
        .next()
        .ok_or_else(|| io::Error::other(format!("Failed to identify process {pid}")))?
        .parse()
        .map_err(|error| io::Error::other(format!("Failed to identify process {pid}: {error}")))?;
    let start_time = fields
        .nth(17)
        .map(str::to_owned)
        .ok_or_else(|| io::Error::other(format!("Failed to identify process {pid}")))?;

    Ok(ProcessStat {
        parent,
        start_time,
        state,
    })
}

fn is_process_ancestor(ancestor: u32, process: u32) -> io::Result<bool> {
    let mut current = process_stat(process)?.parent;

    while current > 1 {
        if current == ancestor {
            return Ok(true);
        }

        current = process_stat(current)?.parent;
    }

    Ok(false)
}

fn open_pidfd(pid: u32) -> io::Result<OwnedFd> {
    let native_pid = libc::pid_t::try_from(pid)
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidInput, error))?;
    let raw_descriptor = unsafe { libc::syscall(libc::SYS_pidfd_open, native_pid, 0) };

    if raw_descriptor < 0 {
        return Err(io::Error::last_os_error());
    }

    let descriptor = i32::try_from(raw_descriptor)
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))?;

    Ok(unsafe { OwnedFd::from_raw_fd(descriptor) })
}

fn did_process_exit(descriptor: &OwnedFd, timeout: libc::c_int) -> io::Result<bool> {
    let mut poll_descriptor = libc::pollfd {
        fd: descriptor.as_raw_fd(),
        events: libc::POLLIN,
        revents: 0,
    };

    loop {
        let result = unsafe { libc::poll(&raw mut poll_descriptor, 1, timeout) };

        if result > 0 {
            if poll_descriptor.revents & (libc::POLLIN | libc::POLLHUP) != 0 {
                return Ok(true);
            }

            return Err(io::Error::other("Process owner poll failed"));
        }

        if result == 0 {
            return Ok(false);
        }

        let error = io::Error::last_os_error();

        if error.kind() != io::ErrorKind::Interrupted {
            return Err(error);
        }
    }
}

fn is_same_live_process(pid: u32, expected_start_time: &str) -> io::Result<bool> {
    let current = process_stat(pid)?;

    Ok(current.start_time == expected_start_time && !matches!(current.state, b'Z' | b'X' | b'x'))
}

fn is_pidfd_fallback(error: &io::Error) -> bool {
    matches!(error.raw_os_error(), Some(libc::ENOSYS | libc::EPERM))
}

fn prepare_owner_monitor(
    owner: u32,
    expected_start_time: &str,
) -> io::Result<Option<OwnerMonitor>> {
    match open_pidfd(owner) {
        Ok(descriptor) => {
            if process_stat(owner)?.start_time != expected_start_time {
                return Ok(None);
            }

            Ok(Some(OwnerMonitor::PidFd(descriptor)))
        }
        Err(error) if is_pidfd_fallback(&error) => {
            if !is_same_live_process(owner, expected_start_time)? {
                return Ok(None);
            }

            Ok(Some(OwnerMonitor::Proc {
                pid: owner,
                start_time: expected_start_time.to_owned(),
            }))
        }
        Err(error) => Err(error),
    }
}

fn did_owner_exit(monitor: &OwnerMonitor) -> io::Result<bool> {
    match monitor {
        OwnerMonitor::PidFd(descriptor) => did_process_exit(descriptor, 0),
        OwnerMonitor::Proc { pid, start_time } => Ok(!is_same_live_process(*pid, start_time)?),
    }
}

fn wait_for_owner_exit(monitor: OwnerMonitor) {
    match monitor {
        OwnerMonitor::PidFd(descriptor) => {
            let _result = did_process_exit(&descriptor, -1);
        }
        OwnerMonitor::Proc { pid, start_time } => {
            while is_same_live_process(pid, &start_time).unwrap_or(false) {
                std::thread::sleep(PROC_POLL_INTERVAL);
            }
        }
    }
}

fn monitor_process_group_owner(owner: u32, expected_start_time: &str) -> io::Result<bool> {
    let current_process = std::process::id();
    let current_group = unsafe { libc::getpgrp() };

    if u32::try_from(current_group).ok() != Some(owner) {
        return Ok(false);
    }

    let Some(monitor) = prepare_owner_monitor(owner, expected_start_time)? else {
        return Ok(false);
    };

    if !is_process_ancestor(owner, current_process)? {
        return Ok(false);
    }

    if did_owner_exit(&monitor)? {
        return Ok(false);
    }

    let signal_target = libc::pid_t::try_from(current_process)
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidInput, error))?;

    std::thread::Builder::new()
        .name("gtkx-parent-death".to_owned())
        .spawn(move || {
            wait_for_owner_exit(monitor);

            unsafe {
                libc::kill(signal_target, libc::SIGTERM);
            }
        })?;

    Ok(true)
}

#[napi(catch_unwind)]
pub fn arm_parent_death(
    expected_parent: u32,
    expected_process_group_owner: Option<u32>,
    expected_process_group_owner_start_time: Option<String>,
) -> napi::Result<bool> {
    let armed = unsafe { libc::prctl(libc::PR_SET_PDEATHSIG, libc::SIGTERM) };

    if armed != 0 {
        return Err(napi::Error::from_reason(
            io::Error::last_os_error().to_string(),
        ));
    }

    let parent = unsafe { libc::getppid() };

    if parent < 0 || u32::try_from(parent).ok() != Some(expected_parent) {
        return Ok(false);
    }

    match (
        expected_process_group_owner,
        expected_process_group_owner_start_time,
    ) {
        (None, None) => Ok(true),
        (Some(owner), Some(start_time)) => monitor_process_group_owner(owner, &start_time)
            .map_err(|error| napi::Error::from_reason(error.to_string())),
        _ => Err(napi::Error::from_reason(
            "Incomplete process group owner identity",
        )),
    }
}
