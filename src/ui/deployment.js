import * as THREE from 'three'

function smoothstep(edge0, edge1, x) {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1)
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
  dom,
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
  let markers = []
  let landed = false
  let endYaw = 0
  let startPitch = 0
  let startYaw = 0
  let startRoll = 0
  let screenAnimTime = 0
  let loadoutBuilt = false

  function refreshLoadoutSelection() {
    const selected = state.settings.loadout
    for (const button of dom.loadoutPanel.querySelectorAll('[data-loadout-kind]')) {
      button.classList.toggle('selected', selected[button.dataset.loadoutKind] === button.dataset.id)
    }
  }

  function buildLoadoutOptions() {
    if (loadoutBuilt) {
      refreshLoadoutSelection()
      return
    }
    loadoutBuilt = true
    const groups = [
      ['weapon', config.weapons, dom.loadoutWeapons],
      ['grenade', config.grenades, dom.loadoutGrenades],
      ['item', config.items, dom.loadoutItems],
    ]
    for (const [kind, entries, container] of groups) {
      for (const [id, data] of Object.entries(entries)) {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'loadout-option'
        button.dataset.loadoutKind = kind
        button.dataset.id = id
        const name = document.createElement('span')
        name.className = 'loadout-option-name'
        name.textContent = data.name
        const detail = document.createElement('span')
        detail.className = 'loadout-option-detail'
        if (kind === 'weapon') detail.textContent = `${data.fireMode} · ${data.magazineSize} 发`
        else if (kind === 'grenade') detail.textContent = `${data.count} 枚`
        else detail.textContent = `${data.uses} 次`
        button.append(name, detail)
        button.addEventListener('click', () => {
          if (deploy.phase !== 'deploy_screen') return
          state.settings.loadout[kind] = id
          state.player.applyLoadout(state.settings.loadout)
          hud.updateAmmo()
          saveSettings(state.settings)
          refreshLoadoutSelection()
        })
        container.appendChild(button)
      }
    }
    refreshLoadoutSelection()
  }

  function isContested(spawn) {
    let enemyNear = 0
    for (const bot of state.actors) {
      if (bot.team === state.player.team || !bot.alive) continue
      if (
        Math.hypot(bot.position.x - spawn.x, bot.position.z - spawn.z) <
        config.deployment.contestedRadius
      )
        enemyNear++
    }
    return enemyNear >= config.deployment.contestedEnemyCount
  }

  function getGodHeight() {
    const half = config.match.mapSize * 0.5
    const vFov = THREE.MathUtils.degToRad(camera.fov)
    const heightScale =
      state.mapId === 'zombie'
        ? config.deployment.zombieCameraHeightScale
        : config.deployment.cameraHeightScale
    const margin = config.deployment.cameraMargin
    const heightForZ = (half * margin) / Math.tan(vFov / 2)
    const heightForX = (half * margin) / (Math.tan(vFov / 2) * camera.aspect)
    return Math.max(heightForZ, heightForX) * heightScale
  }

  function setGodCamera() {
    godPos.set(0, getGodHeight(), 0)
    camera.up.copy(worldUp)
    camera.position.copy(godPos)
    camera.rotation.order = 'YXZ'
    camera.rotation.set(-Math.PI / 2, 0, 0)
  }

  function updateMarkers() {
    const panelRight = dom.loadoutPanel.getBoundingClientRect().right
    for (const { el, spawn, statusEl } of markers) {
      project.set(spawn.x, state.groundHeightAt(spawn.x, spawn.z) + 0.5, spawn.z).project(camera)
      const x = THREE.MathUtils.clamp(
        (project.x * 0.5 + 0.5) * innerWidth,
        panelRight + 52,
        innerWidth - 52
      )
      const y = THREE.MathUtils.clamp(
        (-project.y * 0.5 + 0.5) * innerHeight,
        42,
        innerHeight - 42
      )
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`
      const contested = isContested(spawn)
      el.classList.toggle('contested', contested)
      statusEl.textContent = contested ? '交战' : '安全'
    }
  }

  function buildMarkers() {
    dom.spawnMarkers.replaceChildren()
    const spawnPoints = getSpawnPoints(state.player.team)
    markers = spawnPoints.map((spawn, index) => {
      const contested = isContested(spawn)
      const el = document.createElement('button')
      el.type = 'button'
      el.className = `spawn-marker${contested ? ' contested' : ''}`
      const id = document.createElement('span')
      id.className = 'spawn-marker-id'
      id.textContent = spawn.id
      const name = document.createElement('span')
      name.className = 'spawn-marker-name'
      name.textContent = spawn.name
      const statusEl = document.createElement('span')
      statusEl.className = 'spawn-marker-status'
      statusEl.textContent = contested ? '交战' : '安全'
      el.append(id, name, statusEl)
      el.addEventListener('click', () => startAnimation(index))
      dom.spawnMarkers.appendChild(el)
      return { el, spawn, statusEl }
    })
    updateMarkers()
  }

  function enterDeployUi() {
    deploy.phase = 'deploy_screen'
    setGodCamera()
    dom.deployScreen.classList.add('show')
    buildLoadoutOptions()
    buildMarkers()
  }

  function showScreen() {
    input.reset()
    input.updateTouchUi?.()
    if (document.pointerLockElement) document.exitPointerLock()
    dom.crosshair.classList.add('hidden')
    dom.healthWrap.classList.add('hidden')
    dom.ammoWrap.classList.add('hidden')
    dom.lowAmmo.classList.remove('show')
    dom.lowAmmo.classList.add('hidden')
    dom.controls.classList.add('hidden')

    startPos.copy(camera.position)
    camera.rotation.order = 'YXZ'
    startPitch = camera.rotation.x
    startYaw = Math.atan2(Math.sin(camera.rotation.y), Math.cos(camera.rotation.y))
    startRoll = camera.rotation.z
    godPos.set(0, getGodHeight(), 0)
    midPos.set(
      startPos.x * config.deployment.toScreenMidPositionRatio,
      Math.max(
        startPos.y + config.deployment.toScreenMidHeightOffset,
        godPos.y * config.deployment.toScreenMidHeightRatio
      ),
      startPos.z * config.deployment.toScreenMidPositionRatio
    )

    screenAnimTime = 0
    markers = []
    dom.spawnMarkers.replaceChildren()
    dom.deployScreen.classList.remove('show')
    deploy.phase = 'to_deploy'
  }

  function updateToScreen(dt) {
    screenAnimTime += dt
    const duration = config.deployment.toScreenDuration
    const progress = Math.min(1, screenAnimTime / duration)
    const t = smoothstep(0, 1, progress)

    bezier2(camPos, startPos, midPos, godPos, t)
    const pitch = THREE.MathUtils.lerp(
      startPitch,
      -Math.PI / 2,
      smoothstep(0, config.deployment.toScreenPitchResetStart, progress)
    )
    const yaw = lerpAngle(startYaw, 0, smoothstep(0, config.deployment.toScreenPitchResetStart, progress))
    const roll = THREE.MathUtils.lerp(
      startRoll,
      0,
      smoothstep(0, config.deployment.toScreenRollResetStart, progress)
    )

    camera.up.copy(worldUp)
    camera.position.copy(camPos)
    camera.rotation.order = 'YXZ'
    camera.rotation.set(pitch, yaw, roll)

    if (progress < 1) return
    enterDeployUi()
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
    markers = []
    dom.spawnMarkers.replaceChildren()
    dom.deployScreen.classList.remove('show')

    startPos.copy(camera.position)
    midPos.set(
      spawn.x,
      Math.min(
        startPos.y * config.deployment.deployMidHeightRatio,
        config.deployment.deployMidHeightMax
      ),
      spawn.z
    )
    const spawnHeight = state.groundHeightAt(spawn.x, spawn.z)
    endPos.set(spawn.x, spawnHeight + config.player.standHeight, spawn.z)

    state.player.weapon.setVisible(false)
    audio.whoosh()
  }

  function update(dt) {
    deploy.animTime += dt
    const duration = config.deployment.deployDuration
    const progress = Math.min(1, deploy.animTime / duration)
    const spawn = deploy.spawnPoint
    const t = smoothstep(0, 1, progress)

    bezier2(camPos, startPos, midPos, endPos, t)

    // 前半段保持俯视；先抬 pitch，再短路径回正 yaw，避免顶视时原地转圈
    const pitch = THREE.MathUtils.lerp(
      -Math.PI / 2,
      0,
      smoothstep(
        config.deployment.deployPitchResetStart,
        config.deployment.deployPitchResetEnd,
        progress
      )
    )
    const yaw = lerpAngle(
      0,
      endYaw,
      smoothstep(
        config.deployment.deployYawResetStart,
        config.deployment.deployYawResetEnd,
        progress
      )
    )

    camera.up.copy(worldUp)
    camera.position.copy(camPos)
    camera.rotation.order = 'YXZ'
    camera.rotation.set(pitch, yaw, 0)

    if (progress > config.deployment.landingVignetteStart) {
      dom.deployVignette.classList.add('landing')
      if (!landed && progress > config.deployment.landingImpactStart) {
        landed = true
        audio.impact()
        state.player.addShake(0.4)
      }
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
    player.position.set(
      spawn.x,
      state.groundHeightAt(spawn.x, spawn.z) + config.player.standHeight,
      spawn.z
    )
    player.velocity.set(0, 0, 0)
    state.player.weapon.setVisible(true)
    dom.deployVignette.classList.remove('landing')
    dom.crosshair.classList.remove('hidden')
    dom.healthWrap.classList.remove('hidden')
    dom.ammoWrap.classList.remove('hidden')
    dom.lowAmmo.classList.remove('hidden')
    dom.controls.classList.remove('hidden')
    if (input.isTouchMode?.()) {
      input.updateTouchUi?.()
    } else {
      renderer.domElement.requestPointerLock()
    }
  }

  function updateScreenCamera() {
    setGodCamera()
    updateMarkers()
  }

  return { showScreen, startAnimation, update, updateToScreen, updateScreenCamera }
}
