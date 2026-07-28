import * as THREE from 'three'

function smoothstep(edge0, edge1, value) {
  const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

function bezier2(out, p0, p1, p2, t) {
  const u = 1 - t
  out.set(
    u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
    u * u * p0.z + 2 * u * t * p1.z + t * t * p2.z
  )
}

function lerpAngle(a, b, t) {
  let delta = b - a
  while (delta > Math.PI) delta -= Math.PI * 2
  while (delta < -Math.PI) delta += Math.PI * 2
  return a + delta * t
}

export function createDeploymentSystem({
  ui,
  state,
  deploy,
  getSpawnPoints,
  camera,
  renderer,
  audio,
  input,
  hud,
  config,
  saveSettings,
}) {
  const project = new THREE.Vector3()
  const startPos = new THREE.Vector3()
  const midPos = new THREE.Vector3()
  const endPos = new THREE.Vector3()
  const camPos = new THREE.Vector3()
  const godPos = new THREE.Vector3()
  const worldUp = new THREE.Vector3(0, 1, 0)
  let landed = false
  let endYaw = 0
  let startPitch = 0
  let startYaw = 0
  let startRoll = 0
  let screenAnimTime = 0

  function isContested(spawn) {
    let enemyNear = 0
    for (const actor of state.actors) {
      if (actor.team === state.player.team || !actor.alive) continue
      if (Math.hypot(actor.position.x - spawn.x, actor.position.z - spawn.z) < config.deployment.contestedRadius)
        enemyNear++
    }
    return enemyNear >= config.deployment.contestedEnemyCount
  }

  function getGodHeight() {
    const half = state.mapSize * 0.5
    const vFov = THREE.MathUtils.degToRad(camera.fov)
    const scale = state.mapId === 'zombie'
      ? config.deployment.zombieCameraHeightScale
      : config.deployment.cameraHeightScale
    const margin = config.deployment.cameraMargin
    return Math.max(
      (half * margin) / Math.tan(vFov / 2),
      (half * margin) / (Math.tan(vFov / 2) * camera.aspect)
    ) * scale
  }

  function setGodCamera() {
    godPos.set(0, getGodHeight(), 0)
    camera.up.copy(worldUp)
    camera.position.copy(godPos)
    camera.rotation.order = 'YXZ'
    camera.rotation.set(-Math.PI / 2, 0, 0)
  }

  function loadoutGroups() {
    const groups = [
      ['weapon', '主武器', config.weapons],
      ['secondary', '副武器', config.secondaries],
      ['grenade', '手雷', config.grenades],
      ['item', '道具', config.items],
    ]
    return groups.map(([kind, label, entries]) => ({
      kind,
      label,
      items: Object.entries(entries).map(([id, data]) => ({
        id,
        name: data.name,
        selected: state.settings.loadout[kind] === id,
      })),
    }))
  }

  function refreshScreen() {
    if (deploy.phase !== 'deploy_screen') return
    const markers = getSpawnPoints(state.player.team).map(spawn => {
      project.set(spawn.x, state.groundHeightAt(spawn.x, spawn.z) + 0.5, spawn.z).project(camera)
      return {
        id: spawn.id,
        name: spawn.name,
        contested: isContested(spawn),
        x: (project.x * 0.5 + 0.5) * innerWidth,
        y: (-project.y * 0.5 + 0.5) * innerHeight,
      }
    })
    ui.setDeployment({ visible: true, loadoutGroups: loadoutGroups(), markers })
  }

  function enterDeployUi() {
    deploy.phase = 'deploy_screen'
    setGodCamera()
    refreshScreen()
  }

  function showScreen() {
    input.reset()
    input.updateTouchUi?.()
    if (document.pointerLockElement) document.exitPointerLock()
    ui.setDeployment(null)
    startPos.copy(camera.position)
    camera.rotation.order = 'YXZ'
    startPitch = camera.rotation.x
    startYaw = Math.atan2(Math.sin(camera.rotation.y), Math.cos(camera.rotation.y))
    startRoll = camera.rotation.z
    godPos.set(0, getGodHeight(), 0)
    midPos.set(
      startPos.x * config.deployment.toScreenMidPositionRatio,
      Math.max(startPos.y + config.deployment.toScreenMidHeightOffset, godPos.y * config.deployment.toScreenMidHeightRatio),
      startPos.z * config.deployment.toScreenMidPositionRatio
    )
    screenAnimTime = 0
    deploy.phase = 'to_deploy'
  }

  function updateToScreen(dt) {
    screenAnimTime += dt
    const progress = Math.min(1, screenAnimTime / config.deployment.toScreenDuration)
    const t = smoothstep(0, 1, progress)
    bezier2(camPos, startPos, midPos, godPos, t)
    camera.up.copy(worldUp)
    camera.position.copy(camPos)
    camera.rotation.order = 'YXZ'
    camera.rotation.set(
      THREE.MathUtils.lerp(startPitch, -Math.PI / 2, smoothstep(0, config.deployment.toScreenPitchResetStart, progress)),
      lerpAngle(startYaw, 0, smoothstep(0, config.deployment.toScreenPitchResetStart, progress)),
      THREE.MathUtils.lerp(startRoll, 0, smoothstep(0, config.deployment.toScreenRollResetStart, progress))
    )
    if (progress >= 1) enterDeployUi()
  }

  function selectLoadout(kind, id) {
    if (deploy.phase !== 'deploy_screen') return
    state.settings.loadout[kind] = id
    state.player.applyLoadout(state.settings.loadout)
    hud.updateAmmo()
    saveSettings(state.settings)
    refreshScreen()
  }

  function startAnimation(index) {
    if (!state.running || deploy.phase !== 'deploy_screen') return
    const spawn = getSpawnPoints(state.player.team)[index]
    deploy.phase = 'deploying'
    deploy.animTime = 0
    deploy.spawnPoint = spawn
    landed = false
    endYaw = Math.atan2(spawn.x, spawn.z)
    state.player.yaw = endYaw
    ui.setDeployment(null)
    startPos.copy(camera.position)
    midPos.set(spawn.x, Math.min(startPos.y * config.deployment.deployMidHeightRatio, config.deployment.deployMidHeightMax), spawn.z)
    endPos.set(spawn.x, state.groundHeightAt(spawn.x, spawn.z) + config.player.standHeight, spawn.z)
    state.player.weapon.setVisible(false)
    audio.whoosh()
  }

  function update(dt) {
    deploy.animTime += dt
    const progress = Math.min(1, deploy.animTime / config.deployment.deployDuration)
    const spawn = deploy.spawnPoint
    bezier2(camPos, startPos, midPos, endPos, smoothstep(0, 1, progress))
    camera.up.copy(worldUp)
    camera.position.copy(camPos)
    camera.rotation.order = 'YXZ'
    camera.rotation.set(
      THREE.MathUtils.lerp(-Math.PI / 2, 0, smoothstep(config.deployment.deployPitchResetStart, config.deployment.deployPitchResetEnd, progress)),
      lerpAngle(0, endYaw, smoothstep(config.deployment.deployYawResetStart, config.deployment.deployYawResetEnd, progress)),
      0
    )
    if (!landed && progress > config.deployment.landingImpactStart) {
      landed = true
      audio.impact()
      state.player.addShake(0.4)
    }
    if (progress < 1) return

    const player = state.player
    player.yaw = endYaw
    player.pitch = 0
    player.viewRecoilPitch = 0
    player.viewRecoilYaw = 0
    player.viewRecoilRoll = 0
    player.lookSwayPitch = 0
    player.lookSwayYaw = 0
    player.lookSwayRoll = 0
    player.moveLean = 0
    camera.up.copy(worldUp)
    camera.rotation.order = 'YXZ'
    camera.rotation.set(0, endYaw, 0)
    camera.position.copy(endPos)
    deploy.phase = 'none'
    player.applyLoadout(state.settings.loadout, false)
    hud.updateHealth()
    hud.updateAmmo()
    player.alive = true
    player.position.set(spawn.x, state.groundHeightAt(spawn.x, spawn.z) + config.player.standHeight, spawn.z)
    player.velocity.set(0, 0, 0)
    player.weapon.setVisible(true)
    if (input.isTouchMode?.()) input.updateTouchUi?.()
    else renderer.canvas.requestPointerLock()
  }

  function updateScreenCamera() {
    setGodCamera()
    refreshScreen()
  }

  return {
    showScreen,
    startAnimation,
    selectLoadout,
    update,
    updateToScreen,
    updateScreenCamera,
  }
}
