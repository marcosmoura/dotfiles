import { Keybindings } from './utils/key'

export const hyper: Phoenix.ModifierKey[] = ['command', 'option']
export const hyperAlt: Phoenix.ModifierKey[] = ['command', 'option', 'control']
export const hyperShift: Phoenix.ModifierKey[] = [...hyper, 'shift']
export const hyperAltShift: Phoenix.ModifierKey[] = [...hyperAlt, 'shift']

export const animationDuration: number = 0.25
export const modalDuration: number = 1.25

export const blacklistedWindows = ['Displaperture', 'Console']
export const gapSize = 16
export const margin = gapSize / 2
export const maxGridCells = 3

export const keybindings: Keybindings = {
  moveWindowToNextScreen: ['left', hyperAlt],
  moveWindowToPreviousScreen: ['right', hyperAlt],

  reloadConfig: ['r', hyperAlt],
  reloadSpace: ['l', hyperShift],
  reloadLayout: ['l', hyperAltShift],

  toggleMaximized: ['m', hyperShift],
  toggleGrid: ['g', hyperShift],
  toggleColumn: ['c', hyperShift],
  toggleRow: ['r', hyperShift],

  maximize: ['up', hyperAlt],
  centralize: ['down', hyperAlt],

  alignToTop: ['up', hyper],
  alignToBottom: ['down', hyper],
  alignToRight: ['right', hyper],
  alignToLeft: ['left', hyper],

  lockScreen: ['l', hyperAlt],
}
