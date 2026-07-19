const BLOCKED_CTRL_KEYS = [
  'KeyW',
  'KeyT',
  'KeyN',
  'KeyR',
  'KeyL',
  'KeyO',
  'KeyP',
  'KeyS',
  'KeyA',
  'KeyF',
  'KeyG',
  'KeyH',
  'KeyJ',
  'KeyK',
  'KeyB',
  'KeyI',
  'KeyU',
  'KeyY',
  'KeyD',
  'KeyE',
  'KeyQ',
  'KeyX',
  'KeyV',
  'KeyZ',
  'KeyC',
  'KeyM',
  'Tab',
  'F1',
  'F2',
  'F3',
  'F4',
  'F5',
  'F6',
  'F7',
  'F8',
  'F9',
  'F10',
  'F11',
  'F12',
]

const CONTROL_KEYS = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'KeyR',
  'KeyF',
  'KeyC',
  'Space',
  'ShiftLeft',
  'ShiftRight',
])

export function createInputSystem({ state, deploy, onPause }) {
  const heldKeys = new Set()
  const pressed = new Set()
  const mouseDown = { left: false, right: false }
  let mouseDeltaX = 0
  let mouseDeltaY = 0

  function blockBrowserShortcut(event) {
    const code = event.code
    if ((event.ctrlKey || event.metaKey) && BLOCKED_CTRL_KEYS.includes(code)) return true
    if (code.startsWith('F') && code.length <= 4) return true
    if (code === 'Tab') return true
    return event.altKey && !code.startsWith('Alt')
  }

  function canControl() {
    return (
      state.running &&
      !state.paused &&
      state.player?.alive &&
      deploy.phase === 'none' &&
      document.pointerLockElement
    )
  }

  function reset() {
    heldKeys.clear()
    pressed.clear()
    mouseDown.left = false
    mouseDown.right = false
    mouseDeltaX = 0
    mouseDeltaY = 0
  }

  document.addEventListener(
    'keydown',
    event => {
      if (blockBrowserShortcut(event)) {
        event.preventDefault()
        event.stopPropagation()
      }
      if (event.code === 'Escape') {
        if (!event.repeat && state.running && deploy.phase === 'none') onPause()
        return
      }
      if (event.code === 'Tab') {
        if (state.running && !state.paused) heldKeys.add('Tab')
        return
      }
      if (!canControl() || !CONTROL_KEYS.has(event.code)) return
      event.preventDefault()
      if (!heldKeys.has(event.code)) pressed.add(event.code)
      heldKeys.add(event.code)
    },
    true
  )

  document.addEventListener(
    'keyup',
    event => {
      if (blockBrowserShortcut(event)) {
        event.preventDefault()
        event.stopPropagation()
      }
      heldKeys.delete(event.code)
    },
    true
  )

  window.addEventListener('beforeunload', event => {
    if (state.running && !state.paused) {
      event.preventDefault()
      event.returnValue = ''
    }
  })

  document.addEventListener('mousemove', event => {
    if (!canControl()) return
    mouseDeltaX += event.movementX
    mouseDeltaY += event.movementY
  })
  document.addEventListener('mousedown', event => {
    if (!canControl()) return
    event.preventDefault()
    if (event.button === 0) {
      if (!mouseDown.left) pressed.add('MouseLeft')
      mouseDown.left = true
    }
    if (event.button === 2) mouseDown.right = true
  })
  document.addEventListener('mouseup', event => {
    if (event.button === 0) mouseDown.left = false
    if (event.button === 2) mouseDown.right = false
  })
  document.addEventListener('contextmenu', event => event.preventDefault())
  document.addEventListener('wheel', event => event.preventDefault(), { passive: false })
  document.addEventListener('dragstart', event => event.preventDefault())
  document.addEventListener('selectstart', event => event.preventDefault())
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement) return
    reset()
    if (state.running && !state.paused && state.player?.alive && deploy.phase === 'none') onPause()
  })
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) reset()
  })
  window.addEventListener('blur', reset)

  return {
    isKeyDown(code) {
      return heldKeys.has(code)
    },
    isMouseDown(button) {
      return mouseDown[button]
    },
    consumePressed(code) {
      return pressed.delete(code)
    },
    consumeLookDelta() {
      const delta = { x: mouseDeltaX, y: mouseDeltaY }
      mouseDeltaX = 0
      mouseDeltaY = 0
      return delta
    },
    reset,
  }
}
