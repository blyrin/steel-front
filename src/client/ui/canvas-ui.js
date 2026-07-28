import * as THREE from 'three'
import { rayHitObstacle } from '#simulation'

const COLORS = {
  ink: '#12181b',
  paper: '#d7ddd8',
  panel: '#1d262a',
  panel2: '#2a3539',
  line: '#66757a',
  text: '#f0f3eb',
  muted: '#9faeaa',
  ally: '#66c2ce',
  axis: '#e06f63',
  gold: '#e7c568',
  green: '#72a77a',
  danger: '#e6504c',
}

const PIXEL_SCALE = 1.5
const TOUCH_ICONS = {
  fire: '●',
  aim: '＋',
  jump: '↑',
  crouch: '↓',
  reload: 'R',
  melee: 'F',
  grenade: 'G',
  item: 'H',
  supply: 'E',
  weapon: '↔',
  scoreboard: '≡',
  pause: 'Ⅱ',
}

function inside(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

export function createCanvasUi({ state, deploy, config }) {
  const canvas = document.createElement('canvas')
  canvas.id = 'uiCanvas'
  canvas.setAttribute('aria-label', '游戏界面')
  document.body.appendChild(canvas)
  const ctx = canvas.getContext('2d', { alpha: true })
  ctx.imageSmoothingEnabled = false

  let camera = null
  let width = 960
  let height = 540
  let touchMode = false
  let screen = 'boot'
  let gameVisible = false
  let paused = false
  let rotateVisible = false
  let selectedMode = 'classic'
  let modeDefinitions = []
  let records = []
  let deployment = null
  let endData = null
  let getMode = () => null
  let dirty = true
  let lastDraw = 0
  let fps = 0
  let fpsFrames = 0
  let fpsLast = 0
  let activeSlider = null
  let activeTouch = new Map()
  let handlers = {}
  let touchHandlers = {}
  let touchVisible = false
  let stickOffset = { x: 0, y: 0 }
  let scoreboardVisible = false
  let deathText = ''
  let hitMarkerUntil = 0
  let damageUntil = 0
  let directionDamage = null
  let centerMessage = null
  let actionMessage = null
  let killNotice = null
  const killFeed = []
  const touchLabels = {
    fire: '开火', aim: '瞄准', jump: '跳跃', crouch: '蹲下', reload: '装弹',
    melee: '刺刀', grenade: '手雷', item: '道具', supply: '补给', weapon: '副',
    scoreboard: '战况', pause: '暂停',
  }
  const touchActive = {}
  const hits = []
  const healthBarPosition = new THREE.Vector3()
  const actorScreenPosition = new THREE.Vector3()
  const visibilityTarget = new THREE.Vector3()
  const visibilityDirection = new THREE.Vector3()
  const healthBarUntil = new WeakMap()

  function resize() {
    if (touchMode && innerHeight > innerWidth) {
      width = 360
      height = Math.max(540, Math.round((width * innerHeight) / innerWidth))
    } else {
      height = touchMode ? 360 : 540
      width = Math.max(640, Math.round((height * innerWidth) / innerHeight))
    }
    canvas.width = Math.round(width * PIXEL_SCALE)
    canvas.height = Math.round(height * PIXEL_SCALE)
    ctx.setTransform(PIXEL_SCALE, 0, 0, PIXEL_SCALE, 0, 0)
    ctx.imageSmoothingEnabled = false
    dirty = true
  }

  function font(size, weight = 600) {
    ctx.font = `${weight} ${Math.round(size)}px "Microsoft YaHei", ui-monospace, monospace`
    ctx.textBaseline = 'middle'
    ctx.letterSpacing = '0px'
  }

  function text(value, x, y, size = 11, color = COLORS.text, align = 'left', weight = 600) {
    font(size, weight)
    ctx.fillStyle = color
    ctx.textAlign = align
    ctx.fillText(String(value ?? ''), Math.round(x), Math.round(y))
  }

  function box(x, y, w, h, fill = COLORS.panel) {
    ctx.fillStyle = fill
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
  }

  function button(rect, label, action, selected = false, color = COLORS.panel2, fontSize = 10, accent = COLORS.ally) {
    box(rect.x, rect.y, rect.w, rect.h, selected ? COLORS.gold : color)
    if (!selected) {
      ctx.fillStyle = accent
      ctx.fillRect(rect.x, rect.y, 2, rect.h)
    }
    while (fontSize > 6) {
      font(fontSize, 700)
      if (ctx.measureText(label).width <= rect.w - 10) break
      fontSize--
    }
    text(label, rect.x + rect.w / 2, rect.y + rect.h / 2, fontSize, selected ? COLORS.ink : COLORS.text, 'center', 700)
    hits.push({ ...rect, action })
  }

  function backdrop(color = COLORS.paper) {
    ctx.fillStyle = color
    ctx.fillRect(0, 0, width, height)
    ctx.fillStyle = 'rgba(18,24,27,.08)'
    for (let y = 8; y < height; y += 20) {
      for (let x = 8; x < width; x += 20) ctx.fillRect(x, y, 1, 1)
    }
  }

  function drawBoot() {
    backdrop('#cbd2c5')
    const cx = width / 2
    text('钢 铁 前 线', cx, height * 0.38, 29, COLORS.ink, 'center', 800)
    text('STEEL FRONT', cx, height * 0.45, 10, COLORS.axis, 'center', 700)
    const w = Math.min(360, width * 0.55)
    box(cx - w / 2, height * 0.56, w, 10, '#737d78')
    ctx.fillStyle = COLORS.gold
    ctx.fillRect(cx - w / 2 + 1, height * 0.56 + 1, (w - 2) * (state.uiBootProgress || 0), 8)
    text(state.uiBootStatus || '正在装配武器...', cx, height * 0.62, 9, '#465056', 'center')
  }

  function drawMenu() {
    if (touchMode && height > width) {
      drawPortraitMenu()
      return
    }
    backdrop('#c7cec1')
    const left = Math.max(28, width * 0.06)
    text('STEEL FRONT', left, 52, 27, COLORS.ink, 'left', 800)
    text('作战终端', left, 78, 9, '#58666a')
    const cardW = Math.min(300, (width * 0.52 - 24) / Math.max(1, modeDefinitions.length))
    modeDefinitions.forEach((definition, index) => {
      const rect = { x: left + index * (cardW + 10), y: 108, w: cardW, h: 78 }
      const selected = definition.id === selectedMode
      box(rect.x, rect.y, rect.w, rect.h, selected ? '#8fa196' : COLORS.panel)
      ctx.fillStyle = selected ? COLORS.gold : COLORS.axis
      ctx.fillRect(rect.x, rect.y, 3, rect.h)
      text(definition.name, rect.x + 14, rect.y + 23, 15, selected ? COLORS.ink : COLORS.text, 'left', 700)
      text(definition.description, rect.x + 14, rect.y + 51, 9, selected ? '#303b38' : COLORS.muted)
      hits.push({ ...rect, action: 'mode', value: definition.id })
    })
    button({ x: left, y: 202, w: Math.min(300, width * 0.34), h: 38 }, '进入战场', 'start', true)
    drawSlider(left, 286, Math.min(300, width * 0.34), '总音量', 'volume', state.settings.masterVolume * 100, 0, 100)
    drawSlider(left, 338, Math.min(300, width * 0.34), '鼠标灵敏度', 'sensitivity', state.settings.mouseSensitivity * 100, 20, 200)

    const rx = Math.max(width * 0.58, left + 360)
    const rw = width - rx - left
    box(rx, 42, rw, height - 84, COLORS.panel)
    ctx.fillStyle = COLORS.gold
    ctx.fillRect(rx, 42, 3, height - 84)
    text('战绩档案', rx + 18, 69, 15, COLORS.gold, 'left', 700)
    records.slice(0, 9).forEach(([label, value], index) => {
      const y = 105 + index * 36
      if (index % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,.04)'
        ctx.fillRect(rx + 10, y - 14, rw - 20, 28)
      }
      text(label, rx + 18, y, 9, COLORS.muted)
      text(value, rx + rw - 18, y, 12, COLORS.text, 'right', 700)
    })
    text('WASD 移动  ·  鼠标射击  ·  TAB 战况  ·  ESC 暂停', left, height - 24, 8, '#4b585b')
  }

  function drawPortraitMenu() {
    backdrop('#c7cec1')
    const margin = 20
    const contentW = width - margin * 2
    text('STEEL FRONT', margin, 30, 22, COLORS.ink, 'left', 800)
    text('作战终端', margin, 51, 8, '#58666a')
    const gap = 8
    const cardW = (contentW - gap) / 2
    modeDefinitions.forEach((definition, index) => {
      const rect = { x: margin + index * (cardW + gap), y: 72, w: cardW, h: 70 }
      const selected = definition.id === selectedMode
      box(rect.x, rect.y, rect.w, rect.h, selected ? '#8fa196' : COLORS.panel)
      ctx.fillStyle = selected ? COLORS.gold : COLORS.axis
      ctx.fillRect(rect.x, rect.y, 3, rect.h)
      text(definition.name, rect.x + 11, rect.y + 21, 12, selected ? COLORS.ink : COLORS.text, 'left', 700)
      text(definition.description, rect.x + 11, rect.y + 48, 7, selected ? '#303b38' : COLORS.muted)
      hits.push({ ...rect, action: 'mode', value: definition.id })
    })
    button({ x: margin, y: 160, w: contentW, h: 36 }, '进入战场', 'start', true)
    drawSlider(margin, 232, contentW - 36, '总音量', 'volume', state.settings.masterVolume * 100, 0, 100)
    drawSlider(margin, 276, contentW - 36, '鼠标灵敏度', 'sensitivity', state.settings.mouseSensitivity * 100, 20, 200)

    const panelY = 312
    box(margin, panelY, contentW, height - panelY - 20, COLORS.panel)
    ctx.fillStyle = COLORS.gold
    ctx.fillRect(margin, panelY, 3, height - panelY - 20)
    text('战绩档案', margin + 14, panelY + 23, 13, COLORS.gold, 'left', 700)
    const cellW = (contentW - 28) / 2
    records.slice(0, 9).forEach(([label, value], index) => {
      const column = index % 2
      const row = Math.floor(index / 2)
      const x = margin + 12 + column * (cellW + 4)
      const y = panelY + 51 + row * 34
      ctx.fillStyle = row % 2 === 0 ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.08)'
      ctx.fillRect(x, y - 13, cellW, 28)
      text(label, x + 7, y - 6, 7, COLORS.muted)
      text(value, x + 7, y + 8, 10, COLORS.text, 'left', 700)
    })
  }

  function drawSlider(x, y, w, label, action, value, min, max, dark = false) {
    text(label, x, y - 12, 8, dark ? COLORS.muted : COLORS.ink)
    const rect = { x, y, w, h: 12 }
    box(x, y, w, 12, dark ? '#313d40' : '#68736f')
    const ratio = (value - min) / (max - min)
    ctx.fillStyle = COLORS.gold
    ctx.fillRect(x + 1, y + 1, (w - 2) * ratio, 10)
    ctx.fillStyle = dark ? COLORS.text : COLORS.ink
    ctx.fillRect(x + 1 + (w - 2) * ratio - 2, y - 2, 4, 16)
    text(Math.round(value), x + w + 10, y + 6, 8, dark ? COLORS.text : COLORS.ink)
    hits.push({ ...rect, action: 'slider', setting: action, min, max })
  }

  function drawHud(now) {
    if (!state.player || deploy.phase !== 'none') return
    const player = state.player
    const mode = getMode()?.getHudState()
    drawActorHealthBars(now)
    if (mode) {
      const topW = 220
      const x = width / 2 - topW / 2
      box(x, 8, topW, 30, 'rgba(18,24,27,.66)')
      ctx.fillStyle = COLORS.ally
      ctx.fillRect(x, 8, 3, 30)
      ctx.fillStyle = COLORS.axis
      ctx.fillRect(x + topW - 3, 8, 3, 30)
      text(`${mode.alliesLabel}  ${mode.alliesScore}`, width / 2 - 52, 18, 11, COLORS.ally, 'center', 700)
      text(`${mode.axisScore}  ${mode.axisLabel}`, width / 2 + 52, 18, 11, COLORS.axis, 'center', 700)
      text(mode.targetText, width / 2, 31, 7, COLORS.muted, 'center')
    }

    box(16, height - 48, 168, 30, 'rgba(18,24,27,.82)')
    text('HP', 24, height - 38, 7, COLORS.muted)
    text(`${Math.ceil(player.health)} / ${player.maxHealth}`, 176, height - 38, 8, COLORS.text, 'right', 700)
    ctx.fillStyle = '#4a5554'
    ctx.fillRect(24, height - 28, 152, 4)
    ctx.fillStyle = player.health < 30 ? COLORS.danger : COLORS.green
    ctx.fillRect(24, height - 28, 152 * clamp(player.health / player.maxHealth, 0, 1), 4)

    const equipmentX = width - 236
    box(equipmentX, height - 58, 220, 40, 'rgba(18,24,27,.82)')
    text(player.activeSlot === 2 ? player.secondaryData.name : player.weaponData.name, equipmentX + 8, height - 48, 8, COLORS.gold, 'left', 700)
    const onSecondary = player.activeSlot === 2
    const onRpg = onSecondary && player.secondaryData.kind === 'rpg'
    const ammo = onSecondary ? (onRpg ? (player.rpgLoaded ? 1 : 0) : player.secondaryCount) : player.ammo
    const reserve = onSecondary ? player.secondaryCount - ammo : player.reserveAmmo
    const ammoText = onSecondary && !onRpg ? `${ammo} 枚` : `${ammo} / ${Math.max(0, reserve)}`
    text(ammoText, width - 24, height - 48, 10, COLORS.text, 'right', 700)
    drawEquipmentState(player, equipmentX + 8, height - 28, 204)

    drawMinimap(width - 128, 8, 120)
    text(`${fps} FPS`, 2, 8, 8, '#ffffff')
    if (!player.aiming && !deathText) drawCrosshair(player)
    if (now < hitMarkerUntil) drawHitMarker()
    if (now < damageUntil) drawDamageBorder()
    if (directionDamage && now < directionDamage.until) drawDirectionDamage(directionDamage.source, now)
    else directionDamage = null
    drawTimedText(now)
    drawFeed(now)
    if (scoreboardVisible) drawScoreboard()
    if (deathText) drawDeath()
  }

  function drawActorHealthBars(now) {
    if (!camera) return
    for (const actor of state.actors) {
      if (!actor.alive) {
        healthBarUntil.delete(actor)
        continue
      }
      healthBarPosition.set(actor.position.x, actor.position.y + 2.45, actor.position.z).project(camera)
      if (healthBarPosition.z < -1 || healthBarPosition.z > 1 || Math.abs(healthBarPosition.x) > 1.08 || Math.abs(healthBarPosition.y) > 1.08) continue
      const x = (healthBarPosition.x * 0.5 + 0.5) * width
      const y = (-healthBarPosition.y * 0.5 + 0.5) * height
      actorScreenPosition.set(actor.position.x, actor.position.y + 1.05, actor.position.z).project(camera)
      const actorX = (actorScreenPosition.x * 0.5 + 0.5) * width
      const actorY = (-actorScreenPosition.y * 0.5 + 0.5) * height
      const nearCrosshair = Math.hypot(actorX - width / 2, actorY - height / 2) < 34
      const shownUntil = healthBarUntil.get(actor) || 0
      if (!nearCrosshair && shownUntil <= now) {
        healthBarUntil.delete(actor)
        continue
      }
      if (!hasActorLineOfSight(actor)) continue
      if (nearCrosshair) healthBarUntil.set(actor, now + config.hud.healthBarHoldDuration)
      drawActorHealth(actor, x, y)
    }
  }

  function hasActorLineOfSight(actor) {
    visibilityTarget.set(actor.position.x, actor.position.y + 1.25, actor.position.z)
    visibilityDirection.subVectors(visibilityTarget, camera.position)
    const distance = visibilityDirection.length()
    visibilityDirection.multiplyScalar(1 / distance)
    for (const obstacle of state.obstacles) {
      if (obstacle.type === 'ground' || obstacle.type === 'crater') continue
      if (rayHitObstacle(camera.position, visibilityDirection, obstacle, distance) != null) return false
    }
    return true
  }

  function drawActorHealth(actor, x, y) {
    const barW = 28
    ctx.fillStyle = 'rgba(18,24,27,.82)'
    ctx.fillRect(x - barW / 2, y - 11, barW, 3)
    ctx.fillStyle = actor.health / actor.maxHealth < 0.3
      ? COLORS.danger
      : actor.team === state.player.team ? COLORS.ally : COLORS.axis
    ctx.fillRect(x - barW / 2 + 1, y - 10, (barW - 2) * clamp(actor.health / actor.maxHealth, 0, 1), 1)
  }

  function drawEquipmentState(player, x, y, w) {
    const secondary = player.secondaryData.kind === 'rpg'
      ? `RPG ${player.rpgLoaded ? '已装' : '空'} ${player.secondaryCount}`
      : `C4 ×${player.secondaryCount}`
    const grenade = `${player.grenadeData.kind === 'frag' ? '破片' : '烟雾'} ×${player.grenadeCount}`
    const item = `${player.itemData.kind === 'heal' ? '急救' : '弹药'} ×${player.itemUses}`
    const entries = [
      [secondary, player.activeSlot === 2],
      [grenade, false],
      [item, false],
    ]
    const itemW = w / entries.length
    entries.forEach(([label, active], index) => {
      const itemX = x + index * itemW
      ctx.fillStyle = active ? 'rgba(231,197,104,.22)' : 'rgba(255,255,255,.04)'
      ctx.fillRect(itemX, y - 7, itemW - 2, 14)
      text(label, itemX + itemW / 2 - 1, y, 7, active ? COLORS.gold : COLORS.muted, 'center', active ? 700 : 600)
    })
  }

  function drawCrosshair(player) {
    const spread = player.currentSpread || player.getSpread()
    const gap = 7 + spread * config.hud.crosshairSpreadScale
    const cx = width / 2
    const cy = height / 2
    ctx.fillStyle = '#f4f1d8'
    ctx.fillRect(cx - 1, cy - gap - 8, 2, 6)
    ctx.fillRect(cx - 1, cy + gap + 2, 2, 6)
    ctx.fillRect(cx - gap - 8, cy - 1, 6, 2)
    ctx.fillRect(cx + gap + 2, cy - 1, 6, 2)
    ctx.fillRect(cx - 1, cy - 1, 2, 2)
  }

  function drawHitMarker() {
    const cx = width / 2
    const cy = height / 2
    ctx.strokeStyle = '#fff1be'
    ctx.lineWidth = 3
    for (const [sx, sy] of [[-1,-1],[1,-1],[-1,1],[1,1]]) {
      ctx.beginPath()
      ctx.moveTo(cx + sx * 7, cy + sy * 7)
      ctx.lineTo(cx + sx * 14, cy + sy * 14)
      ctx.stroke()
    }
  }

  function drawDamageBorder() {
    ctx.strokeStyle = 'rgba(210,49,45,.72)'
    ctx.lineWidth = 18
    ctx.strokeRect(4, 4, width - 8, height - 8)
  }

  function drawDirectionDamage(source, now) {
    const position = source.position || source
    const angle = Math.atan2(position.x - state.player.position.x, -(position.z - state.player.position.z)) + state.player.yaw
    const radius = 86 + Math.sin(now * 0.012) * 3
    const cx = width / 2 + Math.sin(angle) * radius
    const cy = height / 2 - Math.cos(angle) * radius
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(angle)
    ctx.fillStyle = COLORS.danger
    ctx.beginPath()
    ctx.moveTo(0, -8)
    ctx.lineTo(-7, 5)
    ctx.lineTo(0, 2)
    ctx.lineTo(7, 5)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

  function drawTimedText(now) {
    if (centerMessage && now < centerMessage.until) {
      text(centerMessage.big, width / 2, height * 0.34, 23, COLORS.gold, 'center', 800)
      text(centerMessage.text, width / 2, height * 0.4, 12, COLORS.text, 'center', 700)
    }
    if (actionMessage && now < actionMessage.until)
      text(actionMessage.text, width / 2, height * 0.7, 10, COLORS.gold, 'center', 700)
    if (killNotice && now < killNotice.until) {
      text(killNotice.title, width / 2, height * 0.72, 17, COLORS.gold, 'center', 800)
      text(killNotice.sub, width / 2, height * 0.76, 9, COLORS.text, 'center')
    }
  }

  function drawFeed(now) {
    while (killFeed[0] && killFeed[0].until <= now) killFeed.shift()
    killFeed.slice(-6).reverse().forEach((item, index) => {
      const y = (touchMode ? 66 : 24) + index * 17
      ctx.fillStyle = 'rgba(18,24,27,.72)'
      ctx.fillRect(16, y - 7, 188, 14)
      ctx.fillStyle = item.type === 'player' ? COLORS.gold : COLORS.axis
      ctx.fillRect(16, y - 7, 2, 14)
      text(`${item.killer}  >  ${item.victim}`, 23, y, 8, item.type === 'player' ? COLORS.gold : COLORS.text)
    })
  }

  function drawMinimap(x, y, size) {
    box(x, y, size, size, 'rgba(18,24,27,.82)')
    const scale = (size - 10) / state.mapSize
    for (const obstacle of state.obstacles) {
      if (obstacle.x == null || !['building', 'tank', 'sandbag'].includes(obstacle.type)) continue
      ctx.fillStyle = '#758078'
      ctx.fillRect(x + size / 2 + obstacle.x * scale - 1, y + size / 2 + obstacle.z * scale - 1, 3, 3)
    }
    for (const actor of state.actors) {
      if (!actor.alive) continue
      ctx.fillStyle = actor.team === 'allies' ? COLORS.ally : COLORS.axis
      ctx.fillRect(x + size / 2 + actor.position.x * scale - 2, y + size / 2 + actor.position.z * scale - 2, 4, 4)
    }
    if (state.player?.alive) {
      const px = x + size / 2 + state.player.position.x * scale
      const py = y + size / 2 + state.player.position.z * scale
      ctx.save()
      ctx.translate(px, py)
      ctx.rotate(-state.player.yaw)
      ctx.fillStyle = COLORS.gold
      ctx.beginPath()
      ctx.moveTo(0, -6)
      ctx.lineTo(-4, 5)
      ctx.lineTo(0, 2)
      ctx.lineTo(4, 5)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }
  }

  function drawScoreboard() {
    const compact = touchMode
    const panelW = Math.min(720, width - (compact ? 32 : 80))
    const x = (width - panelW) / 2
    const y = compact ? 40 : 78
    const panelH = height - y - (compact ? 18 : 62)
    box(x, y, panelW, panelH, 'rgba(18,24,27,.96)')
    text('战 况', width / 2, y + (compact ? 18 : 25), compact ? 13 : 16, COLORS.gold, 'center', 700)
    const allies = [{ name: '你', kills: state.player.kills, deaths: state.player.deaths, me: true }, ...state.actors.filter(a => a.team === 'allies')]
    const axis = state.actors.filter(a => a.team !== 'allies')
    const teamY = y + (compact ? 40 : 62)
    drawTeamRows(allies, x + 22, teamY, panelW / 2 - 34, COLORS.ally, compact)
    drawTeamRows(axis, x + panelW / 2 + 12, teamY, panelW / 2 - 34, COLORS.axis, compact)
  }

  function drawTeamRows(entries, x, y, w, color, compact) {
    entries.sort((a, b) => b.kills - a.kills || a.deaths - b.deaths)
    text('士兵', x, y, compact ? 8 : 9, color)
    text('K  D', x + w, y, compact ? 8 : 9, color, 'right')
    const rowGap = compact ? 15 : 19
    entries.slice(0, compact ? 13 : 14).forEach((entry, index) => {
      const rowY = y + (compact ? 18 : 24) + index * rowGap
      const rowH = compact ? 13 : 17
      ctx.fillStyle = index % 2 === 0 ? 'rgba(255,255,255,.045)' : 'rgba(0,0,0,.12)'
      ctx.fillRect(x - 4, rowY - Math.floor(rowH / 2), w + 8, rowH)
      if (entry.me) {
        ctx.fillStyle = 'rgba(224,189,98,.15)'
        ctx.fillRect(x - 4, rowY - Math.floor(rowH / 2), w + 8, rowH)
      }
      text(entry.name || '士兵', x, rowY, compact ? 7 : 8, entry.alive === false ? '#707773' : COLORS.text)
      text(`${entry.kills || 0}  ${entry.deaths || 0}`, x + w, rowY, compact ? 7 : 8, COLORS.muted, 'right')
    })
  }

  function drawDeath() {
    ctx.fillStyle = 'rgba(28,8,8,.56)'
    ctx.fillRect(0, 0, width, height)
    text('阵 亡', width / 2, height * 0.44, 29, COLORS.axis, 'center', 800)
    text(deathText, width / 2, height * 0.52, 10, COLORS.text, 'center')
  }

  function drawDeployment() {
    if (!deployment) return
    ctx.fillStyle = 'rgba(8,13,15,.24)'
    ctx.fillRect(0, 0, width, height)
    const panelH = 72
    box(0, 0, width, panelH, 'rgba(18,24,27,.94)')
    const groups = deployment.loadoutGroups
    const groupAccents = [COLORS.gold, COLORS.ally, COLORS.axis, COLORS.green]
    const totalItems = groups.reduce((sum, group) => sum + group.items.length, 0)
    const startX = 16
    const availableW = width - 32
    let groupX = startX
    groups.forEach((group, groupIndex) => {
      const accent = groupAccents[groupIndex]
      const groupW = (availableW - (groups.length - 1) * 14) * group.items.length / totalItems
      ctx.fillStyle = accent
      ctx.fillRect(groupX, 8, 3, 8)
      text(group.label, groupX + 8, 12, 8, accent, 'left', 700)
      const itemW = (groupW - (group.items.length - 1) * 4) / group.items.length
      group.items.forEach((item, index) => {
        const rect = { x: groupX + index * (itemW + 4), y: 25, w: itemW, h: 32 }
        button(rect, item.name, `loadout:${group.kind}:${item.id}`, item.selected, '#303c40', 8, accent)
      })
      if (groupIndex < groups.length - 1) {
        ctx.fillStyle = 'rgba(102,117,122,.48)'
        ctx.fillRect(groupX + groupW + 6, 8, 1, 50)
      }
      groupX += groupW + (groupIndex < groups.length - 1 ? 14 : 0)
    })
    deployment.markers.forEach((marker, index) => {
      const markerX = (marker.x / innerWidth) * width
      const markerY = (marker.y / innerHeight) * height
      const rect = { x: markerX - 35, y: markerY - 21, w: 70, h: 42 }
      box(rect.x, rect.y, rect.w, rect.h, marker.contested ? '#713d39' : '#38584e')
      text(`${marker.id} ${marker.name}`, rect.x + rect.w / 2, rect.y + 15, 8, COLORS.text, 'center', 700)
      text(marker.contested ? '交战' : '安全', rect.x + rect.w / 2, rect.y + 29, 7, marker.contested ? '#ffc0aa' : '#bde0bd', 'center')
      hits.push({ ...rect, action: `spawn:${index}` })
    })
  }

  function drawPause() {
    ctx.fillStyle = 'rgba(7,11,13,.7)'
    ctx.fillRect(0, 0, width, height)
    const panelW = 348
    const panelH = 252
    const x = width / 2 - panelW / 2
    const y = height / 2 - panelH / 2
    box(x, y, panelW, panelH, '#1b2428')
    ctx.fillStyle = COLORS.gold
    ctx.fillRect(x + 24, y + 18, 3, 16)
    text('战斗暂停', x + 34, y + 26, 17, COLORS.text, 'left', 700)
    text('PAUSED / 作战设置', x + 24, y + 45, 7, COLORS.muted)
    ctx.fillStyle = COLORS.line
    ctx.fillRect(x + 24, y + 60, panelW - 48, 1)
    text('音频与控制', x + 24, y + 76, 7, COLORS.gold, 'left', 700)
    drawSlider(x + 24, y + 100, 264, '总音量', 'volume', state.settings.masterVolume * 100, 0, 100, true)
    drawSlider(x + 24, y + 140, 264, '鼠标灵敏度', 'sensitivity', state.settings.mouseSensitivity * 100, 20, 200, true)
    button({ x: x + 24, y: y + 166, w: panelW - 48, h: 30 }, '继续战斗', 'resume', true)
    button({ x: x + 24, y: y + 208, w: 145, h: 26 }, '重新部署', 'redeploy', false, COLORS.panel2, 9, COLORS.green)
    button({ x: x + 179, y: y + 208, w: 145, h: 26 }, '退出战场', 'quit', false, '#5c3433', 9, COLORS.axis)
  }

  function drawEnd() {
    ctx.fillStyle = 'rgba(9,13,14,.78)'
    ctx.fillRect(0, 0, width, height)
    const x = width / 2 - 280
    const y = 52
    box(x, y, 560, height - 104, COLORS.panel)
    ctx.fillStyle = endData.won ? COLORS.gold : COLORS.axis
    ctx.fillRect(x, y, 560, 3)
    text(endData.title, width / 2, y + 38, 25, endData.won ? COLORS.gold : COLORS.axis, 'center', 800)
    endData.stats.forEach((line, index) => text(line, x + 40, y + 84 + index * 27, 9, COLORS.text))
    button({ x: width / 2 - 110, y: height - 102, w: 220, h: 34 }, '再战一场', 'restart', true)
  }

  function drawRotate() {
    backdrop('#cbd2c5')
    text('↻', width / 2, height * 0.35, 34, COLORS.axis, 'center', 800)
    text('请横屏游玩', width / 2, height * 0.5, 20, COLORS.ink, 'center', 700)
  }

  function touchRect(x, y, w, h) {
    return { x: (x / innerWidth) * width, y: (y / innerHeight) * height, w: (w / innerWidth) * width, h: (h / innerHeight) * height }
  }

  function pixelPanel(rect, fill, notch = 4) {
    ctx.fillStyle = fill
    ctx.beginPath()
    ctx.moveTo(rect.x + notch, rect.y)
    ctx.lineTo(rect.x + rect.w, rect.y)
    ctx.lineTo(rect.x + rect.w, rect.y + rect.h - notch)
    ctx.lineTo(rect.x + rect.w - notch, rect.y + rect.h)
    ctx.lineTo(rect.x, rect.y + rect.h)
    ctx.lineTo(rect.x, rect.y + notch)
    ctx.closePath()
    ctx.fill()
  }

  function drawTouchButton(action, rect, accent) {
    const active = touchActive[action]
    const fill = active
      ? COLORS.gold
      : action === 'fire' ? 'rgba(112,43,40,.94)' : 'rgba(18,24,27,.9)'
    pixelPanel(rect, fill, Math.min(5, rect.w * 0.1))
    ctx.fillStyle = active ? COLORS.ink : accent
    ctx.fillRect(rect.x + 5, rect.y + rect.h - 3, rect.w - 10, 3)
    const iconColor = active ? COLORS.ink : action === 'fire' ? COLORS.text : accent
    const labelColor = active ? COLORS.ink : COLORS.text
    text(TOUCH_ICONS[action], rect.x + rect.w / 2, rect.y + rect.h * 0.4, rect.h >= 58 ? 18 : 12, iconColor, 'center', 700)
    text(touchLabels[action], rect.x + rect.w / 2, rect.y + rect.h * 0.72, rect.h >= 58 ? 8 : 7, labelColor, 'center', 700)
    hits.push({ ...rect, action: `touch:${action}` })
  }

  function drawTouch() {
    const stick = touchRect(16, innerHeight - 196, 132, 132)
    pixelPanel(stick, 'rgba(18,24,27,.32)', 8)
    ctx.fillStyle = 'rgba(102,194,206,.18)'
    ctx.fillRect(stick.x + stick.w / 2 - 1, stick.y + 14, 2, stick.h - 28)
    ctx.fillRect(stick.x + 14, stick.y + stick.h / 2 - 1, stick.w - 28, 2)
    const kx = stick.x + stick.w / 2 + (stickOffset.x / innerWidth) * width
    const ky = stick.y + stick.h / 2 + (stickOffset.y / innerHeight) * height
    pixelPanel({ x: kx - 20, y: ky - 20, w: 40, h: 40 }, 'rgba(102,194,206,.84)', 5)
    ctx.fillStyle = COLORS.ink
    ctx.fillRect(kx - 5, ky - 1, 10, 2)
    ctx.fillRect(kx - 1, ky - 5, 2, 10)
    hits.push({ ...stick, action: 'touch:stick' })

    const buttons = [
      ['fire', innerWidth - 108, innerHeight - 152, 88, 88, COLORS.axis],
      ['aim', innerWidth - 202, innerHeight - 132, 68, 68, COLORS.ally],
      ['jump', innerWidth - 96, innerHeight - 230, 64, 58, COLORS.gold],
      ['crouch', innerWidth - 190, innerHeight - 224, 62, 54, COLORS.green],
      ['reload', innerWidth / 2 - 156, innerHeight - 62, 48, 48, COLORS.text],
      ['melee', innerWidth / 2 - 104, innerHeight - 62, 48, 48, COLORS.axis],
      ['grenade', innerWidth / 2 - 52, innerHeight - 62, 48, 48, COLORS.gold],
      ['item', innerWidth / 2, innerHeight - 62, 48, 48, COLORS.ally],
      ['supply', innerWidth / 2 + 52, innerHeight - 62, 48, 48, COLORS.text],
      ['weapon', innerWidth / 2 + 104, innerHeight - 62, 48, 48, COLORS.green],
      ['scoreboard', 14, 14, 64, 40, COLORS.ally],
      ['pause', 84, 14, 64, 40, COLORS.gold],
    ]
    for (const [action, x, y, w, h, color] of buttons) {
      const rect = touchRect(x, y, w, h)
      drawTouchButton(action, rect, color)
    }
  }

  function render(now = performance.now()) {
    if (!fpsLast) fpsLast = now
    fpsFrames++
    const fpsElapsed = now - fpsLast
    if (fpsElapsed >= 500) {
      fps = Math.round((fpsFrames * 1000) / fpsElapsed)
      fpsFrames = 0
      fpsLast = now
      dirty = true
    }
    if (!dirty && now - lastDraw < 33) return
    lastDraw = now
    dirty = false
    hits.length = 0
    ctx.clearRect(0, 0, width, height)
    if (screen === 'boot') drawBoot()
    else if (screen === 'menu') drawMenu()
    else if (gameVisible) {
      drawHud(now)
      if (deployment?.visible) drawDeployment()
      if (paused) drawPause()
      if (endData) drawEnd()
      if (touchVisible && !paused && !deployment?.visible && !endData) drawTouch()
    }
    if (rotateVisible) drawRotate()
  }

  function logicalPosition(event) {
    return { x: (event.clientX / innerWidth) * width, y: (event.clientY / innerHeight) * height }
  }

  function findHit(event) {
    const point = logicalPosition(event)
    for (let i = hits.length - 1; i >= 0; i--) if (inside(point.x, point.y, hits[i])) return hits[i]
    return null
  }

  function updateSlider(hit, event) {
    const point = logicalPosition(event)
    const value = hit.min + clamp((point.x - hit.x) / hit.w, 0, 1) * (hit.max - hit.min)
    handlers.onSetting?.(hit.setting, value)
    dirty = true
  }

  canvas.addEventListener('pointerdown', event => {
    const hit = findHit(event)
    if (hit?.action === 'slider') {
      activeSlider = hit
      canvas.setPointerCapture(event.pointerId)
      updateSlider(hit, event)
      return
    }
    if (hit?.action?.startsWith('touch:')) {
      const action = hit.action.slice(6)
      activeTouch.set(event.pointerId, action)
      canvas.setPointerCapture(event.pointerId)
      touchHandlers.down?.(action, event)
      return
    }
    if (touchVisible && gameVisible && !paused && !deployment?.visible) {
      activeTouch.set(event.pointerId, 'look')
      canvas.setPointerCapture(event.pointerId)
      touchHandlers.down?.('look', event)
    }
  })

  canvas.addEventListener('pointermove', event => {
    if (activeSlider) updateSlider(activeSlider, event)
    if (activeTouch.has(event.pointerId)) touchHandlers.move?.(event)
  })

  canvas.addEventListener('pointerup', event => {
    if (activeSlider) {
      activeSlider = null
      return
    }
    const touchAction = activeTouch.get(event.pointerId)
    if (touchAction) {
      activeTouch.delete(event.pointerId)
      touchHandlers.up?.(event)
      return
    }
    const hit = findHit(event)
    if (!hit) return
    if (hit.action === 'start') handlers.onStart?.()
    else if (hit.action === 'mode') handlers.onMode?.(hit.value)
    else if (hit.action === 'resume') handlers.onResume?.()
    else if (hit.action === 'redeploy') handlers.onRedeploy?.()
    else if (hit.action === 'quit') handlers.onQuit?.()
    else if (hit.action === 'restart') handlers.onRestart?.()
    else if (hit.action.startsWith('spawn:')) handlers.onSpawn?.(Number(hit.action.split(':')[1]))
    else if (hit.action.startsWith('loadout:')) {
      const [, kind, id] = hit.action.split(':')
      handlers.onLoadout?.(kind, id)
    }
    dirty = true
  })
  canvas.addEventListener('pointercancel', event => {
    activeTouch.delete(event.pointerId)
    activeSlider = null
    touchHandlers.up?.(event)
  })

  window.addEventListener('resize', resize)
  resize()

  return {
    canvas,
    setCamera(value) { camera = value },
    bindRuntime(callback) { getMode = callback },
    setHandlers(value) { handlers = value },
    setTouchHandlers(value) { touchHandlers = value },
    setBoot(progress, status) {
      state.uiBootProgress = clamp(progress / 100, 0, 1)
      if (status) state.uiBootStatus = status
      dirty = true
    },
    showMenu() { screen = 'menu'; gameVisible = false; dirty = true },
    showGame() { screen = 'game'; gameVisible = true; endData = null; dirty = true },
    setModes(definitions, selected) { modeDefinitions = definitions; selectedMode = selected; dirty = true },
    setSelectedMode(id) { selectedMode = id; dirty = true },
    setRecords(entries) { records = entries; dirty = true },
    setPaused(value) { paused = value; dirty = true },
    setRotateVisible(value) { rotateVisible = value; dirty = true },
    setDeployment(value) { deployment = value; dirty = true },
    setTouchMode(value) { touchMode = value; resize() },
    setTouchVisible(value) { touchVisible = value; dirty = true },
    setTouchLabel(action, label) { touchLabels[action] = label; dirty = true },
    setTouchActive(action, value) { touchActive[action] = value; dirty = true },
    setStickOffset(x, y) { stickOffset = { x, y }; dirty = true },
    getTouchStickRect() { return { left: 16, top: innerHeight - 196, width: 132, height: 132 } },
    showHitMarker() { hitMarkerUntil = performance.now() + 160; dirty = true },
    showDamage() { damageUntil = performance.now() + config.hud.damageVignetteDuration; dirty = true },
    showDirectionDamage(source) { directionDamage = { source, until: performance.now() + config.hud.directionDamageDuration }; dirty = true },
    showCenter(textValue, duration, big = '') { centerMessage = { text: textValue, big, until: performance.now() + duration }; dirty = true },
    showAction(textValue, duration) { actionMessage = { text: textValue, until: performance.now() + duration }; dirty = true },
    showKillNotice(title, sub, duration) { killNotice = { title, sub, until: performance.now() + duration }; dirty = true },
    addFeed(item, duration) { killFeed.push({ ...item, until: performance.now() + duration }); dirty = true },
    showDeath(textValue) { deathText = textValue; dirty = true },
    hideDeath() { deathText = ''; dirty = true },
    setScoreboardVisible(value) { scoreboardVisible = value; dirty = true },
    showEnd(data) { endData = data; paused = false; deployment = null; dirty = true },
    invalidate() { dirty = true },
    render,
    resize,
  }
}
