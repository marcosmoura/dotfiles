import { hyper } from '@/config'

export type TKey = Phoenix.KeyIdentifier
export type TMod = Phoenix.ModifierKey
export type TMods = TMod | TMod[]
export type TEvent = (handler: Key, repeated: boolean) => any
export type Keybinding = [TKey, TMods]
export type Keybindings = { [name: string]: Keybinding }

function onKeyPress(keys: TKey, mod: TMods = hyper, event: TEvent) {
  const modifiers: TMods = Array.isArray(mod) ? mod : [mod]

  Key.on(keys, modifiers, event)
}

export { onKeyPress }
