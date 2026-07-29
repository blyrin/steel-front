import * as THREE from 'three'

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
  'KeyG',
  'KeyH',
  'KeyE',
  'KeyC',
  'Digit1',
  'Digit2',
  'Space',
  'ShiftLeft',
  'ShiftRight',
])

const TOUCH_PRESS_CODES = {
  jump: 'Space',
  crouch: 'KeyC',
  reload: 'KeyR',
  melee: 'KeyF',
  grenade: 'KeyG',
  item: 'KeyH',
  supply: 'KeyE',
  weapon: 'WeaponNext',
  scoreboard: 'Tab',
}

const GYRO_SCREEN_AXIS = new THREE.Vector3(0, 0, 1)
const GYRO_CAMERA_QUATERNION = new THREE.Quaternion(
  -Math.SQRT1_2,
  0,
  0,
  Math.SQRT1_2,
)

function detectTouchMode() {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(pointer: coarse)').matches) return true
  return navigator.maxTouchPoints > 0 && window.matchMedia('(hover: none)').matches
}

function screenAngle() {
  if (screen.orientation?.angle != null) return screen.orientation.angle
  if (typeof window.orientation === 'number') return window.orientation
  return window.innerWidth >= window.innerHeight ? 90 : 0
}

function isAllowedPointer(event) {
  return event.button === 0 || event.pointerType !== 'mouse'
}

export function createInputSystem({ state, deploy, onPause, ui, config }) {
  const inputConfig = config.input
  const heldKeys = new Set()
  const pressed = new Set()
  const mouseDown = { left: false, right: false }
  let mouseDeltaX = 0
  let mouseDeltaY = 0
  let gyroPendingX = 0
  let gyroPendingY = 0
  let gyroSmoothX = 0
  let gyroSmoothY = 0
  let touchMode = detectTouchMode()
  let moveAxisX = 0
  let moveAxisZ = 0
  let stickSprint = false
  let aimToggled = false
  let landscapeOk = true
  let gyroEnabled = false
  let gyroListening = false
  let gyroHasPrevious = false
  let ignorePointerUnlock = false

  const gyroEuler = new THREE.Euler()
  const gyroCurrent = new THREE.Quaternion()
  const gyroPrevious = new THREE.Quaternion()
  const gyroDelta = new THREE.Quaternion()
  const gyroScreen = new THREE.Quaternion()

  const activePointers = new Map()
  let stickPointerId = null
  let lookPointerId = null
  let stickOriginX = 0
  let stickOriginY = 0
  let stickRadius = inputConfig.touchStickRadius
  let lookLastX = 0
  let lookLastY = 0

  function blockBrowserShortcut(event) {
    const code = event.code
    if ((event.ctrlKey || event.metaKey) && BLOCKED_CTRL_KEYS.includes(code)) return true
    if (code.startsWith('F') && code.length <= 4) return true
    if (code === 'Tab') return true
    return event.altKey && !code.startsWith('Alt')
  }

  function canControl() {
    if (!state.running || state.paused || !state.player?.alive || deploy.phase !== 'none') return false
    if (touchMode) return landscapeOk
    return !!document.pointerLockElement
  }

  function setAimToggled(on) {
    aimToggled = on
    mouseDown.right = on
    ui.setTouchActive('aim', on)
  }

  function clearTouchPointers() {
    activePointers.clear()
    stickPointerId = null
    lookPointerId = null
    moveAxisX = 0
    moveAxisZ = 0
    stickSprint = false
    ui.setStickOffset(0, 0)
  }

  function clearTouchActions() {
    clearTouchPointers()
    mouseDown.left = false
    setAimToggled(false)
    heldKeys.delete('Tab')
    heldKeys.delete('Space')
  }

  function resetGyroBaseline() {
    gyroHasPrevious = false
    gyroPendingX = 0
    gyroPendingY = 0
    gyroSmoothX = 0
    gyroSmoothY = 0
  }

  function reset() {
    heldKeys.clear()
    pressed.clear()
    mouseDown.left = false
    mouseDeltaX = 0
    mouseDeltaY = 0
    setAimToggled(false)
    clearTouchPointers()
    resetGyroBaseline()
  }

  function applyGyroLook(yaw, pitch) {
    if (!canControl()) return
    if (
      Math.abs(yaw) < inputConfig.gyroDeadzone &&
      Math.abs(pitch) < inputConfig.gyroDeadzone
    ) {
      return
    }
    gyroPendingX +=
      THREE.MathUtils.clamp(yaw, -inputConfig.gyroMaxStep, inputConfig.gyroMaxStep) *
      inputConfig.gyroLookScale
    gyroPendingY +=
      THREE.MathUtils.clamp(pitch, -inputConfig.gyroMaxStep, inputConfig.gyroMaxStep) *
      inputConfig.gyroLookScale
  }

  function onDeviceOrientation(event) {
    if (!gyroEnabled || !touchMode) return
    if (event.alpha == null || event.beta == null || event.gamma == null) return

    gyroEuler.set(
      THREE.MathUtils.degToRad(event.beta),
      THREE.MathUtils.degToRad(event.alpha),
      THREE.MathUtils.degToRad(-event.gamma),
      'YXZ',
    )
    gyroCurrent.setFromEuler(gyroEuler)
    gyroCurrent.multiply(GYRO_CAMERA_QUATERNION)
    gyroScreen.setFromAxisAngle(GYRO_SCREEN_AXIS, -THREE.MathUtils.degToRad(screenAngle()))
    gyroCurrent.multiply(gyroScreen)

    if (!gyroHasPrevious) {
      gyroPrevious.copy(gyroCurrent)
      gyroHasPrevious = true
      return
    }
    if (!canControl()) {
      gyroPrevious.copy(gyroCurrent)
      return
    }

    gyroDelta.copy(gyroPrevious).invert().multiply(gyroCurrent)
    gyroPrevious.copy(gyroCurrent)
    const deltaEuler = gyroEuler.setFromQuaternion(gyroDelta, 'YXZ')
    applyGyroLook(-deltaEuler.y, -deltaEuler.x)
  }

  function bindGyroListeners() {
    if (gyroListening) return
    gyroListening = true
    window.addEventListener('deviceorientation', onDeviceOrientation)
  }

  async function enableGyro() {
    if (!touchMode) return false
    try {
      if (
        typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function'
      ) {
        const orient = await DeviceOrientationEvent.requestPermission()
        if (orient !== 'granted') return false
      }
      if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        await DeviceMotionEvent.requestPermission().catch(() => 'denied')
      }
    } catch {
      return false
    }
    gyroEnabled = true
    resetGyroBaseline()
    bindGyroListeners()
    return true
  }

  function setHeld(code, down) {
    if (down) {
      if (!heldKeys.has(code)) pressed.add(code)
      heldKeys.add(code)
      return
    }
    heldKeys.delete(code)
  }

  function refreshTouchMode() {
    touchMode = detectTouchMode()
    ui.setTouchMode(touchMode)
    updateLandscapeState()
    updateTouchUi()
  }

  function updateLandscapeState() {
    landscapeOk = !touchMode || window.innerWidth >= window.innerHeight
    ui.setRotateVisible(touchMode && !landscapeOk)
    if (!landscapeOk) clearTouchActions()
  }

  function updateTouchActionLabels() {
    const player = state.player
    if (!player) return
    const onC4 = player.activeSlot === 2 && player.secondaryData?.kind === 'c4'
    const onRpg = player.activeSlot === 2 && player.secondaryData?.kind === 'rpg'

    ui.setTouchLabel('aim', onC4 ? '投C4' : '瞄准')
    if (onC4 && aimToggled) setAimToggled(false)

    let fireLabel = '开火'
    if (onC4) {
      fireLabel = '引爆'
    } else if (onRpg) {
      fireLabel = '发射'
    }
    ui.setTouchLabel('fire', fireLabel)
    ui.setTouchLabel('reload', onRpg ? '上弹' : '装弹')
    ui.setTouchLabel('weapon', player.activeSlot === 1 ? '副' : '主')
  }

  function updateTouchUi() {
    const show =
      touchMode &&
      state.running &&
      !state.paused &&
      state.player?.alive &&
      deploy.phase === 'none' &&
      landscapeOk
    ui.setTouchVisible(show)
    if (!touchMode) return
    if (!show) {
      clearTouchActions()
    } else {
      updateTouchActionLabels()
    }
  }

  function getStickRadius() {
    return Math.max(inputConfig.touchStickMinRadius, ui.getTouchStickRect().width * 0.5)
  }

  function setStickVisual(dx, dy) {
    ui.setStickOffset(dx, dy)
  }

  function updateStick(clientX, clientY) {
    const dx = clientX - stickOriginX
    const dy = clientY - stickOriginY
    const len = Math.hypot(dx, dy)
    const radius = stickRadius
    const clamped = len > radius && len > 0 ? radius / len : 1
    const cx = dx * clamped
    const cy = dy * clamped
    setStickVisual(cx, cy)
    const nx = cx / radius
    const nz = cy / radius
    const dead = inputConfig.touchStickDeadzone
    const mag = Math.hypot(nx, nz)
    if (mag < dead) {
      moveAxisX = 0
      moveAxisZ = 0
      stickSprint = false
      return
    }
    const scale = Math.min(1, (mag - dead) / (1 - dead))
    moveAxisX = (nx / mag) * scale
    moveAxisZ = (nz / mag) * scale
    stickSprint = scale >= inputConfig.touchSprintThreshold
  }

  function onStickDown(event) {
    if (!canControl() || stickPointerId != null) return
    if (!isAllowedPointer(event)) return
    event.preventDefault()
    event.stopPropagation()
    stickPointerId = event.pointerId
    stickRadius = getStickRadius()
    const rect = ui.getTouchStickRect()
    stickOriginX = rect.left + rect.width * 0.5
    stickOriginY = rect.top + rect.height * 0.5
    activePointers.set(event.pointerId, { kind: 'stick' })
    updateStick(event.clientX, event.clientY)
  }

  function onLookDown(event) {
    if (!canControl() || lookPointerId != null) return
    if (!isAllowedPointer(event)) return
    event.preventDefault()
    lookPointerId = event.pointerId
    lookLastX = event.clientX
    lookLastY = event.clientY
    activePointers.set(event.pointerId, { kind: 'look' })
  }

  function onTouchDown(action, event) {
    if (action === 'stick') return onStickDown(event)
    if (action === 'look') return onLookDown(event)
    if (action === 'pause') {
      if (state.running && deploy.phase === 'none') onPause()
      return
    }
    if (!canControl()) return
    if (action === 'fire') {
      if (!mouseDown.left) pressed.add('MouseLeft')
      mouseDown.left = true
      activePointers.set(event.pointerId, {
        kind: 'fire',
        lastX: event.clientX,
        lastY: event.clientY,
      })
      return
    }
    if (action === 'aim') {
      const player = state.player
      if (player?.activeSlot === 2 && player.secondaryData?.kind === 'c4') {
        setAimToggled(false)
        pressed.add('MouseRight')
      } else {
        setAimToggled(!aimToggled)
      }
      return
    }
    const code = TOUCH_PRESS_CODES[action]
    if (action === 'jump' || action === 'scoreboard') {
      setHeld(code, true)
      activePointers.set(event.pointerId, { kind: 'held', code })
    } else {
      pressed.add(code)
    }
  }

  function onPointerMove(event) {
    const entry = activePointers.get(event.pointerId)
    if (!entry) return
    event.preventDefault()
    if (entry.kind === 'stick' && event.pointerId === stickPointerId) {
      updateStick(event.clientX, event.clientY)
      return
    }
    if (entry.kind === 'look' && event.pointerId === lookPointerId) {
      if (!canControl()) return
      mouseDeltaX += (event.clientX - lookLastX) * inputConfig.touchLookScale
      mouseDeltaY += (event.clientY - lookLastY) * inputConfig.touchLookScale
      lookLastX = event.clientX
      lookLastY = event.clientY
      return
    }
    if (entry.kind === 'fire') {
      if (!canControl()) return
      if (lookPointerId == null) {
        mouseDeltaX += (event.clientX - entry.lastX) * inputConfig.touchLookScale
        mouseDeltaY += (event.clientY - entry.lastY) * inputConfig.touchLookScale
      }
      entry.lastX = event.clientX
      entry.lastY = event.clientY
    }
  }

  function onPointerEnd(event) {
    const entry = activePointers.get(event.pointerId)
    if (!entry) return
    activePointers.delete(event.pointerId)
    if (entry.kind === 'stick' && event.pointerId === stickPointerId) {
      stickPointerId = null
      moveAxisX = 0
      moveAxisZ = 0
      stickSprint = false
      setStickVisual(0, 0)
      return
    }
    if (entry.kind === 'look' && event.pointerId === lookPointerId) {
      lookPointerId = null
      return
    }
    if (entry.kind === 'fire') mouseDown.left = false
    if (entry.kind === 'held') setHeld(entry.code, false)
  }

  document.addEventListener(
    'keydown',
    event => {
      if (event.target instanceof HTMLInputElement) return
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
    true,
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
    true,
  )

  window.addEventListener('beforeunload', event => {
    if (state.running && !state.paused) {
      event.preventDefault()
      event.returnValue = ''
    }
  })

  document.addEventListener('mousemove', event => {
    if (touchMode || !canControl()) return
    mouseDeltaX += event.movementX
    mouseDeltaY += event.movementY
  })
  document.addEventListener('mousedown', event => {
    if (touchMode || !canControl()) return
    event.preventDefault()
    if (event.button === 0) {
      if (!mouseDown.left) pressed.add('MouseLeft')
      mouseDown.left = true
    }
    if (event.button === 2) {
      if (!mouseDown.right) pressed.add('MouseRight')
      mouseDown.right = true
    }
  })
  document.addEventListener('mouseup', event => {
    if (event.button === 0) mouseDown.left = false
    if (event.button === 2) mouseDown.right = false
  })
  document.addEventListener('contextmenu', event => event.preventDefault())
  document.addEventListener(
    'wheel',
    event => {
      event.preventDefault()
      if (!canControl()) return
      if (event.deltaY > 0) {
        pressed.add('WeaponNext')
      } else if (event.deltaY < 0) pressed.add('WeaponPrev')
    },
    { passive: false },
  )
  document.addEventListener('dragstart', event => event.preventDefault())
  document.addEventListener('selectstart', event => event.preventDefault())
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement) return
    if (touchMode) {
      reset()
      return
    }
    reset()
    if (ignorePointerUnlock) {
      ignorePointerUnlock = false
      return
    }
    if (state.running && !state.paused && state.player?.alive && deploy.phase === 'none') onPause()
  })
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      reset()
    } else {
      resetGyroBaseline()
    }
  })
  window.addEventListener('blur', reset)
  window.addEventListener('resize', () => {
    updateLandscapeState()
    updateTouchUi()
    resetGyroBaseline()
  })
  window.addEventListener('orientationchange', () => {
    updateLandscapeState()
    updateTouchUi()
    resetGyroBaseline()
  })

  ui.setTouchHandlers({ down: onTouchDown, move: onPointerMove, up: onPointerEnd })

  refreshTouchMode()

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
      gyroSmoothX += (gyroPendingX - gyroSmoothX) * inputConfig.gyroSmoothing
      gyroSmoothY += (gyroPendingY - gyroSmoothY) * inputConfig.gyroSmoothing
      const delta = { x: mouseDeltaX + gyroSmoothX, y: mouseDeltaY + gyroSmoothY }
      mouseDeltaX = 0
      mouseDeltaY = 0
      gyroPendingX = 0
      gyroPendingY = 0
      if (Math.abs(gyroSmoothX) < inputConfig.inputEpsilon) gyroSmoothX = 0
      if (Math.abs(gyroSmoothY) < inputConfig.inputEpsilon) gyroSmoothY = 0
      return delta
    },
    getMoveAxis() {
      if (
        Math.abs(moveAxisX) > inputConfig.inputEpsilon ||
        Math.abs(moveAxisZ) > inputConfig.inputEpsilon
      ) {
        return { x: moveAxisX, z: moveAxisZ }
      }
      let x = 0
      let z = 0
      if (heldKeys.has('KeyD')) x += 1
      if (heldKeys.has('KeyA')) x -= 1
      if (heldKeys.has('KeyS')) z += 1
      if (heldKeys.has('KeyW')) z -= 1
      if (x !== 0 || z !== 0) {
        const len = Math.hypot(x, z)
        return { x: x / len, z: z / len }
      }
      return { x: 0, z: 0 }
    },
    isStickSprint() {
      return stickSprint
    },
    isTouchMode() {
      return touchMode
    },
    ignoreNextPointerUnlock() {
      ignorePointerUnlock = true
    },
    enableGyro,
    syncUi() {
      refreshTouchMode()
    },
    updateTouchUi,
    reset,
  }
}
