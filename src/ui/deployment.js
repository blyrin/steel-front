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
  spawnPoints,
  camera,
  renderer,
  audio,
  input,
  config,
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

  function isContested(spawn) {
    let enemyNear = 0
    for (const bot of state.bots) {
      if (bot.team === state.player.team || !bot.alive) continue
      if (Math.hypot(bot.position.x - spawn.x, bot.position.z - spawn.z) < 15) enemyNear++
    }
    return enemyNear >= 2
  }

  function getGodHeight() {
    const half = config.mapSize * 0.5
    const vFov = THREE.MathUtils.degToRad(camera.fov)
    const margin = 1.08
    const heightForZ = (half * margin) / Math.tan(vFov / 2)
    const heightForX = (half * margin) / (Math.tan(vFov / 2) * camera.aspect)
    return Math.max(heightForZ, heightForX)
  }

  function setGodCamera() {
    godPos.set(0, getGodHeight(), 0)
    camera.up.copy(worldUp)
    camera.position.copy(godPos)
    camera.rotation.order = 'YXZ'
    camera.rotation.set(-Math.PI / 2, 0, 0)
  }

  function updateMarkers() {
    for (const { el, spawn, statusEl } of markers) {
      project.set(spawn.x, 0.5, spawn.z).project(camera)
      const x = (project.x * 0.5 + 0.5) * innerWidth
      const y = (-project.y * 0.5 + 0.5) * innerHeight
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`
      const contested = isContested(spawn)
      el.classList.toggle('contested', contested)
      statusEl.textContent = contested ? '交战' : '安全'
    }
  }

  function buildMarkers() {
    dom.spawnMarkers.replaceChildren()
    markers = spawnPoints[state.player.team].map((spawn, index) => {
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
    buildMarkers()
    dom.deployScreen.classList.add('show')
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
      startPos.x * 0.35,
      Math.max(startPos.y + 18, godPos.y * 0.45),
      startPos.z * 0.35
    )

    screenAnimTime = 0
    markers = []
    dom.spawnMarkers.replaceChildren()
    dom.deployScreen.classList.remove('show')
    deploy.phase = 'to_deploy'
  }

  function updateToScreen(dt) {
    screenAnimTime += dt
    const duration = 1.15
    const progress = Math.min(1, screenAnimTime / duration)
    const t = progress * progress * (3 - 2 * progress)

    bezier2(camPos, startPos, midPos, godPos, t)
    const pitch = THREE.MathUtils.lerp(startPitch, -Math.PI / 2, smoothstep(0, 0.95, progress))
    const yaw = lerpAngle(startYaw, 0, smoothstep(0, 0.95, progress))
    const roll = THREE.MathUtils.lerp(startRoll, 0, smoothstep(0, 0.85, progress))

    camera.up.copy(worldUp)
    camera.position.copy(camPos)
    camera.rotation.order = 'YXZ'
    camera.rotation.set(pitch, yaw, roll)

    if (progress < 1) return
    enterDeployUi()
  }

  function startAnimation(index) {
    if (!state.running || deploy.phase !== 'deploy_screen') return
    const spawn = spawnPoints[state.player.team][index]
    deploy.phase = 'deploying'
    deploy.animTime = 0
    deploy.spawnPoint = spawn
    landed = false
    endYaw = Math.atan2(Math.sin(state.player.yaw), Math.cos(state.player.yaw))
    state.player.yaw = endYaw
    markers = []
    dom.spawnMarkers.replaceChildren()
    dom.deployScreen.classList.remove('show')

    startPos.copy(camera.position)
    midPos.set(spawn.x, Math.min(startPos.y * 0.55, 72), spawn.z)
    endPos.set(spawn.x, 1.7, spawn.z)

    state.player.weapon.setVisible(false)
    audio.whoosh()
  }

  function update(dt) {
    deploy.animTime += dt
    const duration = 1.45
    const progress = Math.min(1, deploy.animTime / duration)
    const spawn = deploy.spawnPoint
    const t = progress * progress * (3 - 2 * progress)

    bezier2(camPos, startPos, midPos, endPos, t)

    // 前半段保持俯视；先抬 pitch，再短路径回正 yaw，避免顶视时原地转圈
    const pitch = THREE.MathUtils.lerp(-Math.PI / 2, 0, smoothstep(0.5, 0.95, progress))
    const yaw = lerpAngle(0, endYaw, smoothstep(0.68, 0.98, progress))

    camera.up.copy(worldUp)
    camera.position.copy(camPos)
    camera.rotation.order = 'YXZ'
    camera.rotation.set(pitch, yaw, 0)

    if (progress > 0.86) {
      dom.deployVignette.classList.add('landing')
      if (!landed && progress > 0.88) {
        landed = true
        audio.impact()
        state.player.addShake(0.4)
      }
    }

    if (progress < 1) return

    camera.up.copy(worldUp)
    camera.rotation.order = 'YXZ'
    camera.rotation.set(0, endYaw, 0)
    camera.position.copy(endPos)
    deploy.phase = 'none'
    state.player.alive = true
    state.player.health = state.player.maxHealth
    state.player.ammo = state.player.magSize
    state.player.reserveAmmo = 96
    state.player.position.set(spawn.x, 1.7, spawn.z)
    state.player.velocity.set(0, 0, 0)
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
