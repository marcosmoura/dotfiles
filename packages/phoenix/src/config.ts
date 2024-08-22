import { Keybindings } from './utils/key'

export const hyper: Phoenix.ModifierKey[] = ['command', 'option']
export const hyperAlt: Phoenix.ModifierKey[] = [...hyper, 'control']
export const hyperShift: Phoenix.ModifierKey[] = [...hyper, 'shift']
export const hyperAltShift: Phoenix.ModifierKey[] = [...hyperAlt, 'shift']

export const modalDuration = 1.25

export const blacklistedWindows = ['Displaperture', 'Console']
export const gapSize = 16
export const margin = gapSize / 2
export const maxGridCells = 3

export const keybindings: Keybindings = {
  reloadConfig: ['r', hyperAlt],
  reloadSpace: ['l', hyperShift],
  reloadLayout: ['l', hyperAltShift],

  centralize: ['down', hyperAlt],
}
