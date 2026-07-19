import * as THREE from 'three'
import { AUDIO_FILES, CFG, LOAD_STEPS, SPAWN_POINTS } from './config.js'
import { createGameState, createDeployState, saveSettings } from './state.js'
import { createSceneRuntime } from './scene.js'
import { AudioSystem } from './audio/audio-system.js'
import { createWorldSystem } from './world/world.js'
import { createEffectsSystem } from './combat/effects.js'
import { createCombatSystem } from './combat/ballistics.js'
import { Player } from './entities/player.js'
import { Bot } from './entities/bot.js'
import { getDom } from './ui/dom.js'
import { createHud } from './ui/hud.js'
import { createMapSystem } from './ui/maps.js'
import { createDeploymentSystem } from './ui/deployment.js'
import { createInputSystem } from './input.js'

export function createGame() {
  const dom = getDom()
  const state = createGameState()
  const deploy = createDeployState()
  const runtime = createSceneRuntime()
  const audio = new AudioSystem(runtime.camera, AUDIO_FILES)
  const world = createWorldSystem({
    scene: runtime.scene,
    matLib: runtime.matLib,
    state,
    config: CFG,
  })
  const effects = createEffectsSystem({ scene: runtime.scene, state, audio })
  const hud = createHud({ dom, state, deploy, audio })
  const maps = createMapSystem({ dom, state, config: CFG })
  let deployment
  let input

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
    dom.pauseScreen.classList.toggle('show', state.paused)
    audio.setAmbienceMuted(state.paused)
    if (state.paused) {
      input.reset()
      hud.setScoreboardVisible(false)
      if (document.pointerLockElement) document.exitPointerLock()
    } else if (!input.isTouchMode()) {
      runtime.renderer.domElement.requestPointerLock()
    }
    input.updateTouchUi()
  }

  input = createInputSystem({ state, deploy, onPause: togglePause, dom })
  deployment = createDeploymentSystem({
    dom,
    state,
    deploy,
    spawnPoints: SPAWN_POINTS,
    camera: runtime.camera,
    renderer: runtime.renderer,
    audio,
    input,
    config: CFG,
  })

  const combat = createCombatSystem({ state, effects, audio, hud })

  function getRandomSpawn(team) {
    const points = SPAWN_POINTS[team]
    const spawn = points[Math.floor(Math.random() * points.length)]
    return new THREE.Vector3(
      spawn.x + (Math.random() - 0.5) * 4,
      0,
      spawn.z + (Math.random() - 0.5) * 4
    )
  }

  function checkVictory() {
    if (state.alliesScore >= CFG.killTarget) hud.showEndScreen(true)
    else if (state.axisScore >= CFG.killTarget) hud.showEndScreen(false)
  }

  function initGame() {
    state.player = new Player({
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
      deployment,
    })
    const botServices = {
      scene: runtime.scene,
      camera: runtime.camera,
      matLib: runtime.matLib,
      audio,
      gameState: state,
      config: CFG,
      hud,
      effects,
      combat,
      getRandomSpawn,
      checkVictory,
    }
    for (let i = 0; i < CFG.teamSize - 1; i++) {
      state.bots.push(new Bot('allies', getRandomSpawn('allies'), botServices))
    }
    for (let i = 0; i < CFG.teamSize; i++) {
      state.bots.push(new Bot('axis', getRandomSpawn('axis'), botServices))
    }
    state.startTime = performance.now()
    state.running = true
    dom.hud.classList.add('show')
    dom.targetKill.textContent = `达到 ${CFG.killTarget} 杀`
    state.player.weapon.setVisible(false)
    state.player.alive = false
    deployment.showScreen()
  }

  async function runBootLoad() {
    const setProgress = (progress, text) => {
      dom.bar.style.width = `${Math.min(100, Math.max(0, progress))}%`
      if (text) dom.loadStatus.textContent = text
    }
    setProgress(4, LOAD_STEPS[0])
    world.buildWorld()
    runtime.camera.position.y = 4
    setProgress(18, LOAD_STEPS[1])
    await new Promise(resolve => setTimeout(resolve, 40))
    setProgress(28, LOAD_STEPS[2])
    await new Promise(resolve => setTimeout(resolve, 20))
    setProgress(36, LOAD_STEPS[3])
    await new Promise(resolve => setTimeout(resolve, 20))
    setProgress(42, LOAD_STEPS[4])
    setProgress(45, LOAD_STEPS[5])
    await audio.preload(fraction => {
      setProgress(45 + fraction * 51, `加载战斗音效... ${Math.round(fraction * 100)}%`)
    })
    setProgress(100, LOAD_STEPS[6])
    await new Promise(resolve => setTimeout(resolve, 280))
    dom.loader.style.opacity = 0
    setTimeout(() => {
      dom.loader.style.display = 'none'
      dom.menu.classList.add('show')
    }, 800)
  }

  let lastTime = performance.now()
  function animate() {
    requestAnimationFrame(animate)
    const now = performance.now()
    const dt = Math.min(0.05, (now - lastTime) / 1000)
    lastTime = now
    if (!state.loading && state.running && !state.paused) {
      state.player.update(dt)
      for (const bot of state.bots) bot.update(dt)
      effects.update(dt)
      if (deploy.phase === 'none') {
        maps.updateMinimap()
      }
      hud.setScoreboardVisible(input.isKeyDown('Tab'))
    }
    audio.updateListener()
    runtime.renderer.render(runtime.scene, runtime.camera)
  }

  function syncSettingsUi() {
    const volume = Math.round(state.settings.masterVolume * 100)
    const sens = Math.round(state.settings.mouseSensitivity * 100)
    dom.menuVolume.value = String(volume)
    dom.pauseVolume.value = String(volume)
    dom.menuSens.value = String(sens)
    dom.pauseSens.value = String(sens)
  }

  function applyMasterVolume() {
    audio.setMasterVolume(state.settings.masterVolume)
  }

  function bindSettings(volumeEl, sensEl) {
    volumeEl.addEventListener('input', () => {
      state.settings.masterVolume = Number(volumeEl.value) / 100
      applyMasterVolume()
      syncSettingsUi()
      saveSettings(state.settings)
    })
    sensEl.addEventListener('input', () => {
      state.settings.mouseSensitivity = Number(sensEl.value) / 100
      syncSettingsUi()
      saveSettings(state.settings)
    })
  }

  bindSettings(dom.menuVolume, dom.menuSens)
  bindSettings(dom.pauseVolume, dom.pauseSens)
  syncSettingsUi()
  applyMasterVolume()

  dom.startBtn.addEventListener('click', async () => {
    if (input.isTouchMode()) await enterMobilePresentation()
    await audio.init()
    applyMasterVolume()
    dom.menu.classList.remove('show')
    state.loading = false
    initGame()
    input.syncUi()
  })
  dom.resumeBtn.addEventListener('click', togglePause)
  dom.quitBtn.addEventListener('click', () => location.reload())
  dom.restartBtn.addEventListener('click', () => location.reload())
  window.addEventListener('resize', () => {
    runtime.resize()
    input.syncUi()
  })

  return {
    start() {
      runBootLoad()
      animate()
    },
  }
}
