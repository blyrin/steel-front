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
import {
  MODE_DEFINITIONS,
  applyMapDefinition,
  createCombatSystem,
  createMapDefinition,
  createMode,
  createScoringSystem,
  createSimulation,
} from '#simulation'
import { createCanvasUi } from './ui/canvas-ui.js'
import { createHud } from './ui/hud.js'
import { createMapSystem } from './ui/maps.js'
import { createDeploymentSystem } from './ui/deployment.js'
import { createInputSystem } from './input.js'
import { createModeMenu } from './ui/mode-menu.js'
import { Player } from './entities/player.js'
import { Bot } from './entities/bot.js'
import { Zombie } from './entities/zombie.js'
import * as THREE from 'three'

export function createGame() {
  const state = createGameState()
  const deploy = createDeployState()
  const particles = []
  let runtime = null
  let mode = null
  let objectives = null
  let effects = null
  let deployment = null
  let combat = null
  let scoring = null
  const actorViews = new Map()

  function createEntity(definition, actorMode) {
    if (definition.kind === 'player') {
      return new Player({
        camera: runtime.camera,
        sun: runtime.sun,
        matLib: runtime.matLib,
        audio,
        state,
        deploy,
        input,
        config: CFG,
        hud,
        effects,
        combat,
        scoring,
        deployment,
        mode: actorMode,
      })
    }

    const position = new THREE.Vector3(
      definition.position.x,
      definition.position.y,
      definition.position.z
    )
    let actor
    if (definition.kind === 'soldier') {
      actor = new Bot(definition.team, position, {
        scene: runtime.scene,
        camera: runtime.camera,
        matLib: runtime.matLib,
        audio,
        gameState: state,
        config: CFG,
        effects,
        ai: simulation,
        combat,
        scoring,
        mode: actorMode,
        getRandomSpawn: team => actorMode.getRandomSpawn(team),
      })
    } else {
      actor = new Zombie(position, {
        scene: runtime.scene,
        camera: runtime.camera,
        matLib: runtime.matLib,
        audio,
        gameState: state,
        effects,
        ai: simulation,
        scoring,
        config: CFG,
        enemyConfig: CFG.modes.zombie.enemy,
      })
    }
    actorViews.set(actor.id, actor)
    return actor
  }

  const ui = createCanvasUi({ state, deploy, config: CFG })
  const audio = new AudioSystem(AUDIO_FILES, CFG)
  const simulation = createSimulation({
    state,
    config: CFG,
    getMode: () => mode,
    getCombat: () => combat,
    getEffects: () => effects,
    createEntity,
  })
  ui.bindRuntime(() => mode)
  const hud = createHud({ ui, state, audio, config: CFG, getMode: () => mode })
  const maps = createMapSystem({ ui })
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

  function ensureWorld() {
    if (runtime) return
    runtime = createSceneRuntime(CFG)
    runtime.camera.position.y = CFG.match.initialCameraHeight
    ui.setCamera(runtime.camera)
    audio.setCamera(runtime.camera)
    objectives = createObjectiveSystem({
      scene: runtime.scene,
      matLib: runtime.matLib,
    })
    effects = createEffectsSystem({ scene: runtime.scene, state, particles, audio, config: CFG })
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
    combat = createCombatSystem({
      state,
      effects,
      audio,
      hud,
      config: CFG,
      getMode: () => mode,
    })
    scoring = createScoringSystem({
      state,
      hud,
      onElimination: event => mode.onElimination(event),
      saveRecords,
    })
  }

  function createModeMap(modeId) {
    const definition = createMapDefinition(modeId, CFG)
    applyMapDefinition(state, definition)
    return createMap(modeId, {
      scene: runtime.scene,
      matLib: runtime.matLib,
      state,
      particles,
      definition,
      objectives,
    })
  }

  function initGame() {
    ensureWorld()
    const modeId = modeMenu.getSelectedModeId()
    const map = createModeMap(modeId)
    mode = createMode(modeId, {
      state,
      deploy,
      config: CFG,
      spawnPoints: map.definition.spawnPoints,
    })
    map.buildMap()
    mode.setupMatch()
    simulation.start()
    state.match.startTime = state.simulationTimeMs
    state.running = true
    ui.showGame()
    state.player.weapon.setVisible(false)
    state.player.alive = false
    hud.updateScores()
    deployment.showScreen()
  }

  function finishMode(outcome) {
    recordMatchResult(
      state.records,
      state.match.modeId,
      outcome.playerWon,
      (state.simulationTimeMs - state.match.startTime) / 1000
    )
    hud.showEndScreen(outcome)
  }

  function handleSimulationEvent(event) {
    switch (event.type) {
      case 'set-ambience':
        audio.setAmbience(event.id)
        return
      case 'center-message':
        hud.showCenterMessage(event.text, event.duration, event.big)
        return
      case 'zombie-wave':
        audio.zombieWave()
        return
      case 'zombie-groan':
        audio.zombieGroan(event.position)
        return
      case 'fortress-hit':
        audio.fortressHit(event.position)
        return
      case 'remove-actor': {
        const actor = actorViews.get(event.actorId)
        actor.destroy()
        actorViews.delete(event.actorId)
      }
    }
  }

  async function runBootLoad() {
    const setProgress = (progress, text) => {
      ui.setBoot(progress, text)
    }
    const boot = CFG.boot
    setProgress(boot.initialProgress, LOAD_STEPS[0])
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
      while (simulationAccumulator >= simulationStep && state.running && !state.paused) {
        const step = simulation.update(simulationStep)
        for (const event of step.events) handleSimulationEvent(event)
        if (step.outcome) finishMode(step.outcome)
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
    if (runtime) {
      audio.updateListener()
      runtime.renderer.render(runtime.scene, runtime.camera)
    }
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
    runtime?.resize()
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
