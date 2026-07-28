import { AUDIO_FILES, CFG, LOAD_STEPS } from './config.js'
import {
  createGameState,
  createDeployState,
  saveSettings,
  saveRecords,
  recordMatchResult,
} from './state.js'
import { createSceneRuntime } from './scene.js'
import { AudioSystem } from './audio/audio-system.js'
import { createMap } from './world/maps/registry.js'
import { createObjectiveSystem } from './world/objectives.js'
import { createEffectsSystem } from './combat/effects.js'
import { createAiSystem } from './ai/ai-system.js'
import { createCombatSystem } from './combat/ballistics.js'
import { createScoringSystem } from './combat/scoring.js'
import { createCanvasUi } from './ui/canvas-ui.js'
import { createHud } from './ui/hud.js'
import { createMapSystem } from './ui/maps.js'
import { createDeploymentSystem } from './ui/deployment.js'
import { createInputSystem } from './input.js'
import { MODE_DEFINITIONS, createMode } from './modes/registry.js'
import { createModeMenu } from './ui/mode-menu.js'

export function createGame() {
  const state = createGameState()
  const deploy = createDeployState()
  const runtime = createSceneRuntime(CFG)
  const ui = createCanvasUi({ state, deploy, config: CFG, camera: runtime.camera })
  const audio = new AudioSystem(runtime.camera, AUDIO_FILES, CFG)
  const objectives = createObjectiveSystem({
    scene: runtime.scene,
    matLib: runtime.matLib,
    state,
    config: CFG,
  })
  const effects = createEffectsSystem({ scene: runtime.scene, state, audio, config: CFG })
  let mode = null
  const ai = createAiSystem({ state, config: CFG, getMode: () => mode })
  ui.bindRuntime(() => mode)
  const hud = createHud({ ui, state, audio, config: CFG, getMode: () => mode })
  const maps = createMapSystem({ ui })
  let deployment
  let input

  const modeMenu = createModeMenu({
    ui,
    definitions: MODE_DEFINITIONS,
    onSelect: modeId => hud.renderRecords(modeId),
  })

  async function enterMobilePresentation() {
    // 陀螺仪权限必须尽量在用户手势内先申请
    await input.enableGyro()
    const root = document.documentElement
    try {
      if (!document.fullscreenElement && root.requestFullscreen) {
        await root.requestFullscreen({ navigationUI: 'hide' })
      }
    } catch {
      // 部分浏览器/系统会拒绝全屏，保留竖屏提示降级
    }
    try {
      if (screen.orientation?.lock) await screen.orientation.lock('landscape')
    } catch {
      // iOS 等环境可能不支持 orientation.lock
    }
  }

  function togglePause() {
    if (deploy.phase !== 'none') return
    state.paused = !state.paused
    ui.setPaused(state.paused)
    audio.setAmbienceMuted(state.paused)
    if (state.paused) {
      input.reset()
      hud.setScoreboardVisible(false)
      if (document.pointerLockElement) document.exitPointerLock()
    } else if (!input.isTouchMode()) {
      runtime.renderer.canvas.requestPointerLock()
    }
    input.updateTouchUi()
  }

  input = createInputSystem({ state, deploy, onPause: togglePause, ui, config: CFG })
  deployment = createDeploymentSystem({
    ui,
    state,
    deploy,
    getSpawnPoints: team => mode.getSpawnPoints(team),
    camera: runtime.camera,
    renderer: runtime.renderer,
    audio,
    input,
    hud,
    config: CFG,
    saveSettings,
  })

  const combat = createCombatSystem({
    state,
    effects,
    audio,
    hud,
    config: CFG,
    getMode: () => mode,
  })
  const scoring = createScoringSystem({
    state,
    hud,
    onElimination: event => mode.onElimination(event),
    saveRecords,
  })

  function createModeMap(modeId) {
    return createMap(modeId, {
      scene: runtime.scene,
      matLib: runtime.matLib,
      state,
      config: CFG,
      objectives,
    })
  }

  function initGame() {
    const modeId = modeMenu.getSelectedModeId()
    const map = createModeMap(modeId)
    mode = createMode(modeId, {
      state,
      deploy,
      config: CFG,
      spawnPoints: map.spawnPoints,
      services: {
        scene: runtime.scene,
        camera: runtime.camera,
        sun: runtime.sun,
        matLib: runtime.matLib,
        audio,
        input,
        hud,
        effects,
        ai,
        combat,
        scoring,
        deployment,
        objectives,
        map,
      },
    })
    mode.buildMap()
    mode.setupMatch()
    state.match.startTime = performance.now()
    state.running = true
    ui.showGame()
    state.player.weapon.setVisible(false)
    state.player.alive = false
    ai.start()
    hud.updateScores()
    deployment.showScreen()
  }

  function finishModeIfNeeded() {
    if (!state.running || !mode) return
    const outcome = mode.getOutcome()
    if (!outcome) return
    recordMatchResult(
      state.records,
      state.match.modeId,
      outcome.playerWon,
      (performance.now() - state.match.startTime) / 1000
    )
    hud.showEndScreen(outcome)
  }

  async function runBootLoad() {
    const setProgress = (progress, text) => {
      ui.setBoot(progress, text)
    }
    const boot = CFG.boot
    setProgress(boot.initialProgress, LOAD_STEPS[0])
    runtime.camera.position.y = CFG.match.initialCameraHeight
    setProgress(boot.worldProgress, LOAD_STEPS[1])
    await new Promise(resolve => setTimeout(resolve, boot.initialDelay))
    setProgress(boot.coverProgress, LOAD_STEPS[2])
    await new Promise(resolve => setTimeout(resolve, boot.coverDelay))
    setProgress(boot.botProgress, LOAD_STEPS[3])
    await new Promise(resolve => setTimeout(resolve, boot.coverDelay))
    setProgress(boot.aiProgress, LOAD_STEPS[4])
    setProgress(boot.audioProgress, LOAD_STEPS[5])
    await audio.preload(fraction => {
      setProgress(
        boot.audioProgress + fraction * boot.audioProgressRange,
        `加载战斗音效... ${Math.round(fraction * 100)}%`
      )
    })
    setProgress(100, LOAD_STEPS[6])
    await new Promise(resolve => setTimeout(resolve, boot.readyDelay))
    setTimeout(() => ui.showMenu(), boot.menuFadeDelay)
  }

  const simulationStep = 1 / CFG.match.tickRate
  const minFrameTime = 1 / CFG.match.maxFps
  let simulationAccumulator = 0
  let interfaceAccumulator = 0
  let renderAccumulator = 0
  let lastTime = performance.now()
  function animate() {
    requestAnimationFrame(animate)
    const now = performance.now()
    const elapsed = Math.min(CFG.match.maxFrameDelta, (now - lastTime) / 1000)
    lastTime = now
    if (!state.loading && state.running && !state.paused) {
      simulationAccumulator += elapsed
      while (
        simulationAccumulator >= simulationStep &&
        state.running &&
        !state.paused
      ) {
        state.player.update(simulationStep)
        mode.update(simulationStep)
        ai.update(simulationStep)
        for (const actor of state.actors) actor.update(simulationStep)
        combat.update()
        effects.update(simulationStep)
        finishModeIfNeeded()
        simulationAccumulator -= simulationStep
      }
      interfaceAccumulator += elapsed
      if (interfaceAccumulator >= 0.1) {
        interfaceAccumulator %= 0.1
        hud.updateScores()
        if (deploy.phase === 'none') maps.updateMinimap()
      }
      hud.setScoreboardVisible(input.isKeyDown('Tab'))
    }
    renderAccumulator += elapsed
    if (renderAccumulator < minFrameTime) return
    renderAccumulator %= minFrameTime
    audio.updateListener()
    runtime.renderer.render(runtime.scene, runtime.camera)
    ui.render(now)
  }

  function applyMasterVolume() {
    audio.setMasterVolume(state.settings.masterVolume)
  }

  function applySetting(setting, value) {
    if (setting === 'volume') {
      state.settings.masterVolume = value / 100
      applyMasterVolume()
    } else {
      state.settings.mouseSensitivity = value / 100
    }
    saveSettings(state.settings)
    ui.invalidate()
  }

  applyMasterVolume()

  ui.setHandlers({
    onStart: async () => {
      if (input.isTouchMode()) await enterMobilePresentation()
      await audio.init()
      applyMasterVolume()
      state.loading = false
      initGame()
      input.syncUi()
    },
    onMode: id => modeMenu.select(id),
    onSetting: applySetting,
    onResume: togglePause,
    onRedeploy: () => {
      if (!state.paused || deploy.phase !== 'none' || !state.player?.alive) return
      state.paused = false
      ui.setPaused(false)
      audio.setAmbienceMuted(false)
      input.reset()
      hud.setScoreboardVisible(false)
      if (document.pointerLockElement) document.exitPointerLock()
      input.updateTouchUi()
      state.player.die()
    },
    onQuit: () => location.reload(),
    onRestart: () => location.reload(),
    onLoadout: (kind, id) => deployment.selectLoadout(kind, id),
    onSpawn: index => deployment.startAnimation(index),
  })
  window.addEventListener('resize', () => {
    runtime.resize()
    ui.resize()
    input.syncUi()
  })

  return {
    start() {
      runBootLoad()
      animate()
    },
  }
}
