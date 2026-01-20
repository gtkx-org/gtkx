import type * as Gdk from "@gtkx/ffi/gdk";
import type * as GObject from "@gtkx/ffi/gobject";
import type * as Gtk from "@gtkx/ffi/gtk";

export type Container = Gtk.Widget | Gtk.Application;

export type Props = Record<string, unknown>;

export type ContainerClass = typeof Gtk.Widget | typeof Gtk.Application;

/**
 * Props for EventController-based event handlers.
 *
 * These props attach EventControllers to widgets for handling
 * pointer motion, clicks, keyboard events, and drag-and-drop.
 */
export interface EventControllerProps {
    /**
     * Called when the pointer enters the widget.
     * @param x - X coordinate
     * @param y - Y coordinate
     * @param event - The underlying Gdk.Event
     */
    onEnter?: (x: number, y: number, event: Gdk.Event | null) => void;
    /**
     * Called when the pointer leaves the widget.
     * @param event - The underlying Gdk.Event
     */
    onLeave?: (event: Gdk.Event | null) => void;
    /**
     * Called when the pointer moves over the widget.
     * @param x - X coordinate
     * @param y - Y coordinate
     * @param event - The underlying Gdk.Event
     */
    onMotion?: (x: number, y: number, event: Gdk.Event | null) => void;
    /**
     * Called when a mouse button is pressed.
     * @param nPress - The press count (1 for single click, 2 for double click, etc.)
     * @param x - X coordinate of the press
     * @param y - Y coordinate of the press
     * @param event - The underlying Gdk.Event, useful for checking triggersContextMenu()
     */
    onPressed?: (nPress: number, x: number, y: number, event: Gdk.Event | null) => void;
    /**
     * Called when a mouse button is released.
     * @param nPress - The press count
     * @param x - X coordinate of the release
     * @param y - Y coordinate of the release
     * @param event - The underlying Gdk.Event
     */
    onReleased?: (nPress: number, x: number, y: number, event: Gdk.Event | null) => void;
    /**
     * Called when a key is pressed (for focusable widgets).
     * @param keyval - The key value
     * @param keycode - The hardware keycode
     * @param state - Modifier state (Shift, Ctrl, etc.)
     * @param event - The underlying Gdk.Event
     * @returns true if the key press was handled
     */
    onKeyPressed?: (keyval: number, keycode: number, state: Gdk.ModifierType, event: Gdk.Event | null) => boolean;
    /**
     * Called when a key is released.
     * @param keyval - The key value
     * @param keycode - The hardware keycode
     * @param state - Modifier state
     * @param event - The underlying Gdk.Event
     */
    onKeyReleased?: (keyval: number, keycode: number, state: Gdk.ModifierType, event: Gdk.Event | null) => void;
    /**
     * Called when the widget is scrolled.
     * @param dx - Horizontal scroll delta
     * @param dy - Vertical scroll delta
     * @param event - The underlying Gdk.Event
     * @returns true if the scroll was handled
     */
    onScroll?: (dx: number, dy: number, event: Gdk.Event | null) => boolean;
}

/**
 * Props for DragSource controller.
 *
 * Enables dragging content from a widget. Attach a DragSource to make
 * a widget draggable.
 */
export interface DragSourceProps {
    /**
     * Called when a drag is about to start. Return a ContentProvider with the data
     * to be dragged, or null to cancel the drag.
     * @param x - X coordinate where drag started
     * @param y - Y coordinate where drag started
     */
    onDragPrepare?: (x: number, y: number) => Gdk.ContentProvider | null;
    /**
     * Called when the drag operation begins.
     * @param drag - The Gdk.Drag object representing the ongoing drag
     */
    onDragBegin?: (drag: Gdk.Drag) => void;
    /**
     * Called when the drag operation ends.
     * @param drag - The Gdk.Drag object
     * @param deleteData - Whether the data should be deleted (for move operations)
     */
    onDragEnd?: (drag: Gdk.Drag, deleteData: boolean) => void;
    /**
     * Called when the drag operation is cancelled.
     * @param drag - The Gdk.Drag object
     * @param reason - The reason for cancellation
     * @returns true if the cancel was handled
     */
    onDragCancel?: (drag: Gdk.Drag, reason: Gdk.DragCancelReason) => boolean;
    /**
     * The allowed drag actions (COPY, MOVE, LINK, ASK).
     * Defaults to Gdk.DragAction.COPY if not specified.
     */
    dragActions?: Gdk.DragAction;
    /**
     * Paintable to use as the drag icon during DND operations.
     * If null, a default icon is used.
     */
    dragIcon?: Gdk.Paintable | null;
    /**
     * X coordinate of the hotspot relative to the drag icon's top-left corner.
     * Defaults to 0.
     */
    dragIconHotX?: number;
    /**
     * Y coordinate of the hotspot relative to the drag icon's top-left corner.
     * Defaults to 0.
     */
    dragIconHotY?: number;
}

/**
 * Props for DropTarget controller.
 *
 * Enables dropping content onto a widget. Attach a DropTarget to make
 * a widget accept drops.
 */
export interface DropTargetProps {
    /**
     * Called when content is dropped on the widget.
     * @param value - The dropped value (use value.getTypeName() to check type, then extract)
     * @param x - X coordinate of drop
     * @param y - Y coordinate of drop
     * @returns true if the drop was accepted
     */
    onDrop?: (value: GObject.Value, x: number, y: number) => boolean;
    /**
     * Called when a drag enters the widget bounds.
     * @param x - X coordinate
     * @param y - Y coordinate
     * @returns The preferred action, or 0 to reject
     */
    onDropEnter?: (x: number, y: number) => Gdk.DragAction;
    /**
     * Called when a drag leaves the widget bounds.
     */
    onDropLeave?: () => void;
    /**
     * Called when a drag moves within the widget bounds.
     * @param x - X coordinate
     * @param y - Y coordinate
     * @returns The preferred action, or 0 to reject
     */
    onDropMotion?: (x: number, y: number) => Gdk.DragAction;
    /**
     * The allowed drop actions (COPY, MOVE, LINK, ASK).
     * Defaults to Gdk.DragAction.COPY if not specified.
     */
    dropActions?: Gdk.DragAction;
    /**
     * Array of GTypes that this drop target accepts.
     * Use typeFromName() to get GType values (e.g., typeFromName("gchararray") for strings).
     */
    dropTypes?: number[];
}

/**
 * Props for GestureDrag controller.
 *
 * Enables tracking drag gestures (mouse/touch drag movements) on a widget.
 * Use this for drawing, panning, or any interaction that tracks movement from a start point.
 */
export interface GestureDragProps {
    /**
     * Called when a drag gesture begins.
     * @param startX - X coordinate where the drag started
     * @param startY - Y coordinate where the drag started
     * @param event - The underlying Gdk.Event
     */
    onGestureDragBegin?: (startX: number, startY: number, event: Gdk.Event | null) => void;
    /**
     * Called as the drag gesture continues.
     * @param offsetX - Horizontal offset from the start point
     * @param offsetY - Vertical offset from the start point
     * @param event - The underlying Gdk.Event
     */
    onGestureDragUpdate?: (offsetX: number, offsetY: number, event: Gdk.Event | null) => void;
    /**
     * Called when the drag gesture ends.
     * @param offsetX - Final horizontal offset from the start point
     * @param offsetY - Final vertical offset from the start point
     * @param event - The underlying Gdk.Event
     */
    onGestureDragEnd?: (offsetX: number, offsetY: number, event: Gdk.Event | null) => void;
}

/**
 * Props for GestureStylus controller.
 *
 * Enables handling tablet/stylus input with pressure sensitivity and tilt detection.
 * Use this for drawing applications that need tablet support.
 */
export interface GestureStylusProps {
    /**
     * Called when the stylus touches the surface.
     * @param x - X coordinate
     * @param y - Y coordinate
     * @param pressure - Pressure value (0.0 to 1.0)
     * @param tiltX - Tilt along X axis in degrees
     * @param tiltY - Tilt along Y axis in degrees
     * @param event - The underlying Gdk.Event
     */
    onStylusDown?: (
        x: number,
        y: number,
        pressure: number,
        tiltX: number,
        tiltY: number,
        event: Gdk.Event | null,
    ) => void;
    /**
     * Called when the stylus moves while touching the surface.
     * @param x - X coordinate
     * @param y - Y coordinate
     * @param pressure - Pressure value (0.0 to 1.0)
     * @param tiltX - Tilt along X axis in degrees
     * @param tiltY - Tilt along Y axis in degrees
     * @param event - The underlying Gdk.Event
     */
    onStylusMotion?: (
        x: number,
        y: number,
        pressure: number,
        tiltX: number,
        tiltY: number,
        event: Gdk.Event | null,
    ) => void;
    /**
     * Called when the stylus is lifted from the surface.
     * @param x - X coordinate
     * @param y - Y coordinate
     * @param event - The underlying Gdk.Event
     */
    onStylusUp?: (x: number, y: number, event: Gdk.Event | null) => void;
    /**
     * Called when the stylus enters proximity of the surface (hovering).
     * @param x - X coordinate
     * @param y - Y coordinate
     * @param event - The underlying Gdk.Event
     */
    onStylusProximity?: (x: number, y: number, event: Gdk.Event | null) => void;
}

export interface GestureRotateProps {
    /**
     * Called when the rotation angle changes during a two-finger rotation gesture.
     * @param angle - The absolute rotation angle in radians
     * @param angleDelta - The change in angle since the last event, in radians
     * @param event - The underlying Gdk.Event
     */
    onRotateAngleChanged?: (angle: number, angleDelta: number, event: Gdk.Event | null) => void;
    /**
     * Called when a rotation gesture begins.
     * @param sequence - The event sequence that triggered the gesture
     * @param event - The underlying Gdk.Event
     */
    onRotateBegin?: (sequence: Gdk.EventSequence | null, event: Gdk.Event | null) => void;
    /**
     * Called when a rotation gesture ends.
     * @param sequence - The event sequence that triggered the gesture
     * @param event - The underlying Gdk.Event
     */
    onRotateEnd?: (sequence: Gdk.EventSequence | null, event: Gdk.Event | null) => void;
}
