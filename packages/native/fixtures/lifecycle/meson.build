project(
  'gtkx-lifecycle',
  'c',
  version: '1.0.0',
  meson_version: '>=1.2',
  default_options: ['c_std=c11', 'warning_level=2', 'werror=true'],
)

gnome = import('gnome')
glib = dependency('glib-2.0', version: '>=2.76')
gobject = dependency('gobject-2.0', version: '>=2.76')
sources = files('gtkx-lifecycle.c', 'gtkx-lifecycle.h')

lifecycle = shared_library(
  'gtkx-lifecycle',
  sources,
  dependencies: [glib, gobject],
  install: false,
)

gnome.generate_gir(
  lifecycle,
  sources: sources,
  namespace: 'GtkxLifecycle',
  nsversion: '1.0',
  identifier_prefix: 'GtkxLifecycle',
  symbol_prefix: 'gtkx_lifecycle',
  includes: ['GObject-2.0'],
  header: 'gtkx-lifecycle.h',
  extra_args: ['--warn-all'],
  install: false,
)
