// Marks an element with data-pressed while a pointer is down on it, so CSS
// can show hover styles on touch. :active can't do this: on touch, browsers
// hold it back until they're sure the gesture isn't a scroll.
const release = (e) => {
  delete e.currentTarget.dataset.pressed;
};

export const pressHandlers = {
  onPointerDown: (e) => {
    e.currentTarget.dataset.pressed = "";
  },
  onPointerUp: release,
  onPointerCancel: release,
  onPointerLeave: release,
};
