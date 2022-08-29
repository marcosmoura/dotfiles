type TEvent = Phoenix.Event | Phoenix.Event[]
type TAppEvent = Phoenix.AppEvent | Phoenix.AppEvent[]
type TMouseEvent = Phoenix.MouseEvent | Phoenix.MouseEvent[]
type TWindowEvent = Phoenix.WindowEvent | Phoenix.WindowEvent[]

function addEventListener(event: TEvent, callback: (handler: Event) => void): void
function addEventListener(event: TAppEvent, callback: (target: App, handler: Event) => void): void
function addEventListener(
  event: TMouseEvent,
  callback: (target: MousePoint, handler: Event) => void,
): void
function addEventListener(
  event: TWindowEvent,
  callback: (target: Window, handler: Event) => void,
): void

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addEventListener(event: any, callback: any): void {
  if (Array.isArray(event)) {
    event.forEach((eventName) => Event.on(eventName, callback))
  } else {
    Event.on(event, callback)
  }
}

export { addEventListener }
