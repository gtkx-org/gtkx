export GDK_BACKEND=wayland
export GSK_RENDERER=cairo
export GDK_DEBUG=no-vsync
export LIBGL_ALWAYS_SOFTWARE=1
export GDK_DISABLE=vulkan
export ALSOFT_DRIVERS=null
export ALSOFT_LOGLEVEL=0
export G_DEBUG=fatal-criticals
export GTKX_PLAYGROUND=/home/eugenio/gtkx-playground
export GTKX_WORKTREE=/home/eugenio/gtkx-bughunt

gtkx_headless() {
    wlheadless-run -c weston -- "$@"
}
