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
  'KeyC',
  'Space',
  'ShiftLeft',
  'ShiftRight',
])

const TOUCH_PRESS_CODES = {
  jump: 'Space',
  crouch: 'KeyC',
  reload: 'KeyR',
  melee: 'KeyF',
  scoreboard: 'Tab',
}

const GYRO_SCREEN_AXIS = new THREE.Vector3(0, 0, 1)
const GYRO_CAMERA_QUATERNION = new THREE.Quaternion(
  -Math.SQRT1_2,
  0,
  0,
  Math.SQRT1_2
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

export function createInputSystem({ state, deploy, onPause, dom, config }) {
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
    if (dom?.touchAim) dom.touchAim.classList.toggle('active', on)
  }

  function clearTouchPointers() {
    activePointers.clear()
    stickPointerId = null
    lookPointerId = null
    moveAxisX = 0
    moveAxisZ = 0
    stickSprint = false
    if (dom?.touchStickKnob) {
      dom.touchStickKnob.style.transform = 'translate(-50%, -50%)'
    }
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
    )
      return
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
      'YXZ'
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
    if (dom?.body) dom.body.classList.toggle('touch-mode', touchMode)
    updateLandscapeState()
    updateTouchUi()
  }

  function updateLandscapeState() {
    landscapeOk = !touchMode || window.innerWidth >= window.innerHeight
    if (dom?.rotateHint) dom.rotateHint.classList.toggle('show', touchMode && state.running && !landscapeOk)
    if (!landscapeOk) clearTouchActions()
  }

  function updateTouchUi() {
    const show =
      touchMode &&
      state.running &&
      !state.paused &&
      state.player?.alive &&
      deploy.phase === 'none' &&
      landscapeOk
    if (dom?.touchControls) dom.touchControls.classList.toggle('show', show)
    if (!show) clearTouchActions()
  }

  function getStickRadius() {
    if (!dom?.touchStickBase) return inputConfig.touchStickRadius
    return Math.max(
      inputConfig.touchStickMinRadius,
      dom.touchStickBase.clientWidth * 0.5
    )
  }

  function setStickVisual(dx, dy) {
    if (!dom?.touchStickKnob) return
    dom.touchStickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`
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

  function bindHoldButton(el, onDown, onUp) {
    if (!el) return
    el.addEventListener('pointerdown', event => {
      if (event.button !== 0 && event.pointerType === 'mouse') return
      event.preventDefault()
      event.stopPropagation()
      el.setPointerCapture(event.pointerId)
      activePointers.set(event.pointerId, { kind: 'button', el, onUp })
      onDown()
    })
  }

  function bindPressButton(el, code) {
    bindHoldButton(
      el,
      () => {
        if (!canControl()) return
        setHeld(code, true)
      },
      () => setHeld(code, false)
    )
  }

  function bindTogglePress(el, code) {
    if (!el) return
    el.addEventListener('pointerdown', event => {
      if (event.button !== 0 && event.pointerType === 'mouse') return
      event.preventDefault()
      event.stopPropagation()
      if (!canControl()) return
      pressed.add(code)
    })
  }

  function onStickDown(event) {
    if (!canControl() || stickPointerId != null) return
    if (event.button !== 0 && event.pointerType === 'mouse') return
    event.preventDefault()
    event.stopPropagation()
    stickPointerId = event.pointerId
    stickRadius = getStickRadius()
    const rect = dom.touchStickBase.getBoundingClientRect()
    stickOriginX = rect.left + rect.width * 0.5
    stickOriginY = rect.top + rect.height * 0.5
    activePointers.set(event.pointerId, { kind: 'stick' })
    dom.touchStickBase.setPointerCapture(event.pointerId)
    updateStick(event.clientX, event.clientY)
  }

  function onLookDown(event) {
    if (!canControl() || lookPointerId != null) return
    if (event.target.closest('[data-touch-action], #touchStick')) return
    if (event.button !== 0 && event.pointerType === 'mouse') return
    event.preventDefault()
    lookPointerId = event.pointerId
    lookLastX = event.clientX
    lookLastY = event.clientY
    activePointers.set(event.pointerId, { kind: 'look' })
    dom.touchLookPad.setPointerCapture(event.pointerId)
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
    if (entry.kind === 'button') {
      entry.onUp?.()
    }
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
    if (touchMode) {
      reset()
      return
    }
    reset()
    if (state.running && !state.paused && state.player?.alive && deploy.phase === 'none') onPause()
  })
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) reset()
    else resetGyroBaseline()
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

  if (dom?.touchStickBase) {
    dom.touchStickBase.addEventListener('pointerdown', onStickDown)
  }
  if (dom?.touchLookPad) {
    dom.touchLookPad.addEventListener('pointerdown', onLookDown)
  }
  document.addEventListener('pointermove', onPointerMove, { passive: false })
  document.addEventListener('pointerup', onPointerEnd)
  document.addEventListener('pointercancel', onPointerEnd)
  document.addEventListener('lostpointercapture', onPointerEnd)

  bindHoldButton(
    dom?.touchFire,
    () => {
      if (!canControl()) return
      if (!mouseDown.left) pressed.add('MouseLeft')
      mouseDown.left = true
    },
    () => {
      mouseDown.left = false
    }
  )
  if (dom?.touchAim) {
    dom.touchAim.addEventListener('pointerdown', event => {
      if (event.button !== 0 && event.pointerType === 'mouse') return
      event.preventDefault()
      event.stopPropagation()
      if (!canControl()) return
      setAimToggled(!aimToggled)
    })
  }
  bindPressButton(dom?.touchJump, TOUCH_PRESS_CODES.jump)
  bindTogglePress(dom?.touchCrouch, TOUCH_PRESS_CODES.crouch)
  bindTogglePress(dom?.touchReload, TOUCH_PRESS_CODES.reload)
  bindTogglePress(dom?.touchMelee, TOUCH_PRESS_CODES.melee)
  bindHoldButton(
    dom?.touchScoreboard,
    () => {
      if (state.running && !state.paused) heldKeys.add('Tab')
    },
    () => heldKeys.delete('Tab')
  )
  if (dom?.touchPause) {
    dom.touchPause.addEventListener('pointerdown', event => {
      event.preventDefault()
      event.stopPropagation()
      if (state.running && deploy.phase === 'none') onPause()
    })
  }

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
    isLandscapeOk() {
      return landscapeOk
    },
    enableGyro,
    syncUi() {
      refreshTouchMode()
    },
    updateTouchUi,
    reset,
  }
}
