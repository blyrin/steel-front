import * as THREE from 'three'
import { MODE_DEFINITIONS, rayHitObstacle } from '#simulation'
import { CFG } from '../game/config.js'
import { createGame } from '../game/game.js'
import { createDeployState, createGameState } from '../game/state.js'
import { LocalSession, NetworkSession } from '../session/session.js'

const COLORS = {
  ink: '#080c0d',
  paper: '#c9c3ae',
  panel: '#151b1c',
  panel2: '#222a2a',
  line: '#626b66',
  text: '#f3efe2',
  muted: '#aaa999',
  ally: '#79b9bb',
  axis: '#d46b5f',
  gold: '#d8b45f',
  green: '#789b72',
  danger: '#dc4e45',
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

function detectTouchDevice() {
  return window.matchMedia('(pointer: coarse)').matches ||
    navigator.maxTouchPoints > 0 && window.matchMedia('(hover: none)').matches
}

function createCanvasUi({ state, deploy, config }) {
  const canvas = document.createElement('canvas')
  canvas.id = 'uiCanvas'
  canvas.setAttribute('aria-label', '游戏界面')
  document.body.appendChild(canvas)
  const keyboardInput = document.createElement('input')
  keyboardInput.tabIndex = -1
  keyboardInput.autocomplete = 'off'
  keyboardInput.style.cssText = 'position:fixed;left:0;bottom:0;width:1px;height:1px;opacity:0;pointer-events:none'
  document.body.appendChild(keyboardInput)
  const ctx = canvas.getContext('2d', { alpha: true })
  ctx.imageSmoothingEnabled = false

  let camera = null
  let width = 960
  let height = 540
  let touchMode = false
  let screen = 'boot'
  let gameVisible = false
  let paused = false
  let pauseStopsMatch = true
  let rotateVisible = false
  let selectedMode = 'classic'
  let modeDefinitions = []
  let records = []
  let portal = null
  let portalTransitionKey = ''
  let portalEnteredAt = performance.now()
  let activePortalField = null
  let hoveredAction = null
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
  const blockedPointers = new Set()
  let handlers = {}
  let touchHandlers = {}
  let touchVisible = false
  let stickOffset = { x: 0, y: 0 }
  let scoreboardVisible = false
  let chatOpen = false
  let chatChannels = []
  let chatChannel = 'world'
  let chatValue = ''
  const chatMessages = []
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
    const hovered = hoveredAction === action
    ctx.fillStyle = selected ? COLORS.gold : color
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
    if (hovered && !selected) {
      ctx.fillStyle = 'rgba(255,255,255,.08)'
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
    }
    ctx.fillStyle = selected ? '#f0d783' : accent
    ctx.globalAlpha = selected ? 0.78 + Math.sin(performance.now() * 0.006) * 0.22 : 1
    ctx.fillRect(rect.x, rect.y, selected ? rect.w : hovered ? 5 : 3, selected ? 2 : rect.h)
    ctx.globalAlpha = 1
    while (fontSize > 6) {
      font(fontSize, 700)
      if (ctx.measureText(label).width <= rect.w - 16) break
      fontSize--
    }
    text(label, rect.x + rect.w / 2, rect.y + rect.h / 2, fontSize, selected ? COLORS.ink : COLORS.text, 'center', 700)
    hits.push({ ...rect, action })
  }

  function backdrop(color = COLORS.paper) {
    ctx.fillStyle = color
    ctx.fillRect(0, 0, width, height)
    ctx.fillStyle = 'rgba(8,12,13,.1)'
    for (let y = 8; y < height; y += 20) {
      for (let x = 8; x < width; x += 20) ctx.fillRect(x, y, 1, 1)
    }
  }

  function battlefieldBackdrop() {
    const background = ctx.createLinearGradient(0, 0, 0, height)
    background.addColorStop(0, '#333b39')
    background.addColorStop(1, '#111716')
    ctx.fillStyle = background
    ctx.fillRect(0, 0, width, height)
    ctx.fillStyle = 'rgba(235,224,192,.04)'
    for (let y = 5; y < height; y += 7) ctx.fillRect(0, y, width, 1)
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

  function drawPortal(now) {
    battlefieldBackdrop()
    const transition = clamp((now - portalEnteredAt) / 240, 0, 1)
    const eased = 1 - (1 - transition) ** 3
    ctx.save()
    ctx.globalAlpha = eased
    ctx.translate(0, (1 - eased) * 10)
    const compact = width < 700
    const margin = compact ? 16 : Math.max(28, width * 0.045)
    text('钢 铁 前 线', margin, compact ? 29 : 35, compact ? 18 : 22, COLORS.text, 'left', 800)
    text('STEEL FRONT  /  FIELD OPERATIONS', margin, compact ? 50 : 59, 7, COLORS.gold, 'left', 700)
    if (!compact) text('作战终端  01', width - margin, 36, 8, COLORS.muted, 'right', 700)

    const x = margin
    const y = compact ? 68 : 78
    const panelW = width - margin * 2
    const panelH = height - y - (compact ? 42 : 34)
    box(x, y, panelW, panelH, 'rgba(13,18,18,.92)')
    ctx.strokeStyle = 'rgba(222,205,157,.24)'
    ctx.strokeRect(x + 0.5, y + 0.5, panelW - 1, panelH - 1)
    const pad = compact ? 15 : 24
    const titleY = y + (compact ? 25 : 30)
    text(portal.title, x + pad, titleY, compact ? 16 : 20, COLORS.text, 'left', 800)
    if (portal.account) {
      if (portal.account.logout) {
        const logoutRect = { x: x + panelW - pad - 54, y: titleY - 12, w: 54, h: 24 }
        button(logoutRect, '退出', 'portal:logout', false, 'rgba(255,255,255,.04)', 7, COLORS.axis)
        text(portal.account.label, logoutRect.x - 10, titleY, compact ? 7 : 8, COLORS.ally, 'right', 700)
      } else {
        const rect = { x: x + panelW - pad - 62, y: titleY - 12, w: 62, h: 24 }
        button(rect, '登录', 'portal:login', false, 'rgba(255,255,255,.04)', 7, COLORS.gold)
      }
    } else if (portal.profile) {
      text(portal.profile, x + panelW - pad, titleY, compact ? 7 : 9, COLORS.ally, 'right', 700)
    }
    ctx.fillStyle = 'rgba(216,180,95,.35)'
    ctx.fillRect(x + pad, y + 65, panelW - pad * 2, 1)

    const split = !compact && panelW >= 760
    const contentX = x + pad
    const contentY = y + 80
    const actionW = split ? Math.min(250, panelW * 0.3) : panelW - pad * 2
    const contentW = split ? panelW - pad * 3 - actionW : panelW - pad * 2
    const actionX = split ? x + panelW - pad - actionW : contentX
    let cursorY = contentY

    for (const field of portal.fields || []) {
      text(field.label, contentX, cursorY, 8, COLORS.gold, 'left', 700)
      const rect = { x: contentX, y: cursorY + 12, w: contentW, h: compact ? 36 : 38 }
      box(rect.x, rect.y, rect.w, rect.h, activePortalField === field.id ? '#303a38' : '#202726')
      ctx.strokeStyle = 'rgba(255,255,255,.1)'
      ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1)
      const value = field.password ? '●'.repeat(field.value.length) : field.value
      text(value || field.placeholder || '', rect.x + 12, rect.y + rect.h / 2, 9, value ? COLORS.text : '#777b72')
      hits.push({ ...rect, action: `portal-field:${field.id}` })
      cursorY += compact ? 60 : 64
    }

    const rows = portal.rows || []
    const actionCount = (portal.actions || []).length
    const mobileActionRows = compact ? Math.ceil(actionCount / 2) : 0
    const rowsBottom = split ? y + panelH - pad : y + panelH - pad - mobileActionRows * 38 - (actionCount ? 12 : 0)
    const visibleRows = Math.max(0, Math.floor((rowsBottom - cursorY) / 34))
    rows.slice(0, visibleRows).forEach((row, index) => {
      const rowY = cursorY + index * 34
      if (!row.section) {
        box(contentX, rowY, contentW, 29, index % 2 ? 'rgba(255,255,255,.035)' : '#202726')
        ctx.fillStyle = row.accent || (row.muted ? COLORS.line : (index === 0 ? COLORS.gold : COLORS.ally))
        ctx.fillRect(contentX, rowY, 2, 29)
      }
      const reserve = row.action ? 76 : 12
      ctx.save()
      ctx.beginPath()
      ctx.rect(contentX + 10, rowY, contentW - reserve - 6, 29)
      ctx.clip()
      text(row.label, contentX + 11, rowY + 15, compact ? 7 : 8, row.muted ? COLORS.muted : COLORS.text)
      ctx.restore()
      if (row.action) button({ x: contentX + contentW - 70, y: rowY + 5, w: 62, h: 19 }, row.actionLabel || '选择', `portal:${row.action}`, row.selected, '#303a38', 7)
    })
    if (rows.length > visibleRows) text(`另有 ${rows.length - visibleRows} 项未显示`, contentX, rowsBottom - 5, 7, COLORS.muted)

    const actions = portal.actions || []
    if (split) {
      let actionY = contentY
      for (let index = 0; index < actions.length; index++) {
        const entry = actions[index]
        const paired = entry.paired && actions[index + 1]?.paired
        if (paired) {
          const gap = 7
          const itemW = (actionW - gap) / 2
          for (let pairIndex = 0; pairIndex < 2; pairIndex++) {
            const pairEntry = actions[index + pairIndex]
            const rect = { x: actionX + pairIndex * (itemW + gap), y: actionY, w: itemW, h: 34 }
            button(rect, pairEntry.label, `portal:${pairEntry.id}`, pairEntry.primary,
              pairEntry.danger ? '#4b2927' : '#252d2c', 8, pairEntry.accent || (pairEntry.danger ? COLORS.axis : COLORS.ally))
          }
          index++
        } else {
          const rect = { x: actionX, y: actionY, w: actionW, h: 34 }
          button(rect, entry.label, `portal:${entry.id}`, entry.primary,
            entry.danger ? '#4b2927' : '#252d2c', 9, entry.accent || (entry.danger ? COLORS.axis : COLORS.ally))
        }
        actionY += 42
      }
    } else if (actions.length) {
      const gap = 7
      const itemW = (actionW - gap) / 2
      const startY = y + panelH - pad - mobileActionRows * 38
      actions.forEach((entry, index) => {
        const rect = { x: actionX + (index % 2) * (itemW + gap), y: startY + Math.floor(index / 2) * 38, w: itemW, h: 31 }
        button(rect, entry.label, `portal:${entry.id}`, entry.primary, entry.danger ? '#4b2927' : '#252d2c', 8, entry.accent || (entry.danger ? COLORS.axis : COLORS.ally))
      })
    }

    if (portal.status) {
      const statusW = Math.min(width - margin * 2, 420)
      const statusX = width - margin - statusW
      box(statusX, height - 29, statusW, 20, portal.error ? 'rgba(86,28,25,.9)' : 'rgba(13,18,18,.82)')
      text(portal.status, statusX + 9, height - 19, 7, portal.error ? '#ffaaa0' : COLORS.muted)
    }
    ctx.restore()
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
      const friendlyIsAllies = player.team === 'allies'
      const friendlyLabel = friendlyIsAllies ? mode.alliesLabel : mode.axisLabel
      const friendlyScore = friendlyIsAllies ? mode.alliesScore : mode.axisScore
      const enemyLabel = friendlyIsAllies ? mode.axisLabel : mode.alliesLabel
      const enemyScore = friendlyIsAllies ? mode.axisScore : mode.alliesScore
      const friendlyColor = friendlyIsAllies ? COLORS.ally : COLORS.axis
      const enemyColor = friendlyIsAllies ? COLORS.axis : COLORS.ally
      const topW = 220
      const x = width / 2 - topW / 2
      box(x, 8, topW, 30, 'rgba(18,24,27,.66)')
      ctx.fillStyle = friendlyColor
      ctx.fillRect(x, 8, 3, 30)
      ctx.fillStyle = enemyColor
      ctx.fillRect(x + topW - 3, 8, 3, 30)
      text(`${friendlyLabel}  ${friendlyScore}`, width / 2 - 52, 18, 11, friendlyColor, 'center', 700)
      text(`${enemyScore}  ${enemyLabel}`, width / 2 + 52, 18, 11, enemyColor, 'center', 700)
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
    if (directionDamage && now < directionDamage.until) {
      drawDirectionDamage(directionDamage.source, now)
    } else {
      directionDamage = null
    }
    drawTimedText(now)
    drawFeed(now)
    if (scoreboardVisible) drawScoreboard()
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
      const human = actor.actorKind === 'player'
      const nameAlwaysVisible = human && actor.team === state.player.team
      const shownUntil = healthBarUntil.get(actor) || 0
      const healthVisible = nearCrosshair || shownUntil > now
      if (!healthVisible && !nameAlwaysVisible) {
        healthBarUntil.delete(actor)
        continue
      }
      const actorVisible = hasActorLineOfSight(actor)
      if (nearCrosshair && actorVisible) healthBarUntil.set(actor, now + config.hud.healthBarHoldDuration)
      if (healthVisible && actorVisible) drawActorHealth(actor, x, y)
      if (human && (nameAlwaysVisible || healthVisible && actorVisible)) drawActorName(actor, x, y)
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
      : actor.team === 'allies' ? COLORS.ally : COLORS.axis
    ctx.fillRect(x - barW / 2 + 1, y - 10, (barW - 2) * clamp(actor.health / actor.maxHealth, 0, 1), 1)
  }

  function drawActorName(actor, x, y) {
    const maxWidth = 96
    let fontSize = 8
    while (fontSize > 6) {
      font(fontSize, 700)
      if (ctx.measureText(actor.name).width <= maxWidth) break
      fontSize--
    }
    text(actor.name, clamp(x, maxWidth / 2, width - maxWidth / 2), y - 16, fontSize,
      actor.team === 'allies' ? COLORS.ally : COLORS.axis, 'center', 700)
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
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
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
    if (actionMessage && now < actionMessage.until) {
      text(actionMessage.text, width / 2, height * 0.7, 10, COLORS.gold, 'center', 700)
    }
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
    const me = { name: '你', kills: state.player.kills, deaths: state.player.deaths, alive: state.player.alive, me: true }
    const friendly = state.actors.filter(actor => actor.team === state.player.team)
    const enemy = state.actors.filter(actor => actor.team !== state.player.team)
    friendly.unshift(me)
    const friendlyLabel = state.player.team === 'allies' ? '盟军' : '轴心'
    const enemyLabel = state.player.team === 'allies' ? '轴心' : '盟军'
    const friendlyColor = state.player.team === 'allies' ? COLORS.ally : COLORS.axis
    const enemyColor = state.player.team === 'allies' ? COLORS.axis : COLORS.ally
    const teamY = y + (compact ? 40 : 62)
    drawTeamRows(friendly, x + 22, teamY, panelW / 2 - 34, friendlyColor, compact, friendlyLabel)
    drawTeamRows(enemy, x + panelW / 2 + 12, teamY, panelW / 2 - 34, enemyColor, compact, enemyLabel)
  }

  function drawTeamRows(entries, x, y, w, color, compact, label) {
    entries.sort((a, b) => b.kills - a.kills || a.deaths - b.deaths)
    text(`${label}士兵`, x, y, compact ? 8 : 9, color)
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
    text('阵 亡', width / 2, height * 0.42, 29, COLORS.axis, 'center', 800)
    text('击杀者', width / 2, height * 0.5, 8, COLORS.muted, 'center', 700)
    text(deathText, width / 2, height * 0.55, 16, COLORS.text, 'center', 800)
  }

  function drawDeployment() {
    if (!deployment) return
    ctx.fillStyle = 'rgba(8,13,15,.24)'
    ctx.fillRect(0, 0, width, height)
    deployment.markers.forEach((marker, index) => {
      const markerX = (marker.x / innerWidth) * width
      const markerY = (marker.y / innerHeight) * height
      const rect = { x: markerX - 35, y: markerY - 21, w: 70, h: 42 }
      ctx.fillStyle = marker.contested ? '#713d39' : '#38584e'
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
      text(`${marker.id} ${marker.name}`, rect.x + rect.w / 2, rect.y + 15, 8, COLORS.text, 'center', 700)
      text(marker.contested ? '交战' : '安全', rect.x + rect.w / 2, rect.y + 29, 7, marker.contested ? '#ffc0aa' : '#bde0bd', 'center')
      hits.push({ ...rect, action: `spawn:${index}` })
    })

    const groups = deployment.loadoutGroups
    const groupAccents = [COLORS.gold, COLORS.ally, COLORS.axis, COLORS.green]
    const panelW = clamp(width * 0.22, 154, 210)
    const panelX = [12, width - panelW - 12]
    ;[groups.slice(0, 2), groups.slice(2)].forEach((panelGroups, panelIndex) => {
      const panelH = 20 + panelGroups.reduce((sum, group) => sum + 26 + Math.ceil(group.items.length / 2) * 32, 0)
      const x = panelX[panelIndex]
      const y = (height - panelH) / 2
      box(x, y, panelW, panelH, 'rgba(18,24,27,.94)')
      let groupY = y + 12
      panelGroups.forEach(group => {
        const accent = groupAccents[groups.indexOf(group)]
        ctx.fillStyle = accent
        ctx.fillRect(x + 10, groupY, 3, 10)
        text(group.label, x + 19, groupY + 5, 8, accent, 'left', 700)
        groupY += 18
        const gap = 4
        const itemW = (panelW - 24 - gap) / 2
        group.items.forEach((item, index) => {
          const rect = {
            x: x + 10 + index % 2 * (itemW + gap),
            y: groupY + Math.floor(index / 2) * 32,
            w: itemW,
            h: 27,
          }
          const action = `loadout:${group.kind}:${item.id}`
          ctx.fillStyle = item.selected ? COLORS.gold : '#303c40'
          ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
          if (hoveredAction === action && !item.selected) {
            ctx.fillStyle = 'rgba(255,255,255,.08)'
            ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
          }
          text(item.name, rect.x + rect.w / 2, rect.y + rect.h / 2, 7,
            item.selected ? COLORS.ink : COLORS.text, 'center', 700)
          hits.push({ ...rect, action })
        })
        groupY += Math.ceil(group.items.length / 2) * 32 + 8
      })
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
    text(pauseStopsMatch ? '战斗暂停' : '作战菜单', x + 34, y + 26, 17, COLORS.text, 'left', 700)
    text(pauseStopsMatch ? 'PAUSED / 作战设置' : '联机游戏不会暂停', x + 24, y + 45, 7, pauseStopsMatch ? COLORS.muted : COLORS.axis)
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

  function drawRecentChat(now) {
    if (chatOpen || !chatChannels.length) return
    const recent = chatMessages.filter(message =>
      chatChannels.includes(message.channel) && now - message.receivedAt < 10_000).slice(-5)
    if (!recent.length) return
    const labels = { world: '世界', room: '房间', squad: '小队' }
    const panelW = Math.min(gameVisible ? 250 : 330, width - 32)
    const lineH = 19
    const panelH = recent.length * lineH + 12
    const x = 16
    const y = gameVisible ? height / 2 - panelH / 2 : height - panelH - 38
    if (!gameVisible) box(x, y, panelW, panelH, 'rgba(10,15,16,.72)')
    recent.forEach((message, index) => {
      const age = now - message.receivedAt
      ctx.globalAlpha = age > 8000 ? 1 - (age - 8000) / 2000 : 1
      const lineY = y + 12 + index * lineH
      const color = message.channel === 'squad' ? COLORS.green : message.channel === 'room' ? COLORS.ally : COLORS.gold
      text(`[${labels[message.channel]}]`, x + 9, lineY, 7, color, 'left', 700)
      ctx.save()
      ctx.beginPath()
      ctx.rect(x + 44, lineY - 8, panelW - 53, 16)
      ctx.clip()
      text(`${message.displayName}: ${message.text}`, x + 46, lineY, 8, COLORS.text)
      ctx.restore()
      ctx.globalAlpha = 1
    })
  }

  function drawChat() {
    if (!chatOpen) return
    const panelW = Math.min(360, width - 32)
    const panelH = Math.min(196, height - 32)
    const x = 16
    const y = height - panelH - 16
    box(x, y, panelW, panelH, 'rgba(10,15,16,.94)')
    ctx.strokeStyle = 'rgba(216,180,95,.45)'
    ctx.strokeRect(x + 0.5, y + 0.5, panelW - 1, panelH - 1)
    const labels = { world: '世界', room: '房间', squad: '小队' }
    let tabX = x + 12
    for (const channel of chatChannels) {
      const selected = channel === chatChannel
      const tabW = 52
      const action = `chat-channel:${channel}`
      if (selected) box(tabX, y + 10, tabW, 22, '#465450')
      else if (hoveredAction === action) box(tabX, y + 10, tabW, 22, 'rgba(255,255,255,.08)')
      text(labels[channel], tabX + tabW / 2, y + 21, 8, selected ? COLORS.gold : COLORS.muted, 'center', 700)
      hits.push({ x: tabX, y: y + 10, w: tabW, h: 22, action })
      tabX += tabW + 4
    }
    const closeRect = { x: x + panelW - 34, y: y + 8, w: 22, h: 22 }
    if (hoveredAction === 'chat-close') box(closeRect.x, closeRect.y, closeRect.w, closeRect.h, 'rgba(255,255,255,.08)')
    text('X', closeRect.x + closeRect.w / 2, closeRect.y + closeRect.h / 2, 9, COLORS.muted, 'center', 700)
    hits.push({ ...closeRect, action: 'chat-close' })
    ctx.fillStyle = 'rgba(255,255,255,.1)'
    ctx.fillRect(x + 12, y + 39, panelW - 24, 1)
    const visible = chatMessages.filter(message => chatChannels.includes(message.channel)).slice(-6)
    visible.forEach((message, index) => {
      const lineY = y + 53 + index * 18
      const color = message.channel === 'squad' ? COLORS.green : message.channel === 'room' ? COLORS.ally : COLORS.gold
      text(`[${labels[message.channel]}]`, x + 12, lineY, 7, color, 'left', 700)
      ctx.save()
      ctx.beginPath()
      ctx.rect(x + 47, lineY - 8, panelW - 59, 16)
      ctx.clip()
      text(`${message.displayName}: ${message.text}`, x + 49, lineY, 8, COLORS.text)
      ctx.restore()
    })
    const inputY = y + panelH - 35
    box(x + 12, inputY, panelW - 24, 24, '#202928')
    ctx.strokeStyle = COLORS.line
    ctx.strokeRect(x + 12.5, inputY + 0.5, panelW - 25, 23)
    ctx.save()
    ctx.beginPath()
    ctx.rect(x + 20, inputY, panelW - 40, 24)
    ctx.clip()
    text(chatValue || '输入消息...', x + 20, inputY + 12, 8, chatValue ? COLORS.text : COLORS.muted)
    ctx.restore()
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
    if (screen === 'boot') {
      drawBoot()
    } else if (screen === 'portal') {
      drawPortal(now)
    } else if (screen === 'menu') {
      drawMenu()
    } else if (gameVisible) {
      drawHud(now)
      if (deathText) drawDeath()
      if (deployment?.visible) drawDeployment()
      if (paused) drawPause()
      if (endData) drawEnd()
      if (touchVisible && !paused && !deployment?.visible && !endData) drawTouch()
    }
    drawRecentChat(now)
    drawChat()
    if (rotateVisible) drawRotate()
  }

  function logicalPosition(event) {
    return { x: (event.clientX / innerWidth) * width, y: (event.clientY / innerHeight) * height }
  }

  function findHit(event) {
    if (rotateVisible) return null
    const point = logicalPosition(event)
    for (let i = hits.length - 1; i >= 0; i--) {
      const hit = hits[i]
      if (inside(point.x, point.y, hit) && (!chatOpen || hit.action.startsWith('chat-'))) return hit
    }
    return null
  }

  function updateSlider(hit, event) {
    const point = logicalPosition(event)
    const value = hit.min + clamp((point.x - hit.x) / hit.w, 0, 1) * (hit.max - hit.min)
    handlers.onSetting?.(hit.setting, value)
    dirty = true
  }

  canvas.addEventListener('pointerdown', event => {
    if (rotateVisible) {
      blockedPointers.add(event.pointerId)
      return
    }
    if (chatOpen) {
      event.preventDefault()
      return
    }
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
    if (blockedPointers.has(event.pointerId)) return
    if (activeSlider) updateSlider(activeSlider, event)
    if (activeTouch.has(event.pointerId)) touchHandlers.move?.(event)
    if (!touchMode && !activeSlider && !activeTouch.has(event.pointerId)) {
      const action = findHit(event)?.action || null
      if (action !== hoveredAction) {
        hoveredAction = action
        canvas.style.cursor = action ? 'pointer' : 'default'
        dirty = true
      }
    }
  })
  canvas.addEventListener('pointerleave', () => {
    hoveredAction = null
    canvas.style.cursor = 'default'
    dirty = true
  })

  canvas.addEventListener('pointerup', event => {
    if (blockedPointers.delete(event.pointerId)) return
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
    if (hit.action === 'chat-close') {
      chatOpen = false
      keyboardInput.blur()
      handlers.onChatToggle?.(false)
    } else if (hit.action.startsWith('chat-channel:')) {
      chatChannel = hit.action.slice(13)
      keyboardInput.focus({ preventScroll: true })
    } else if (hit.action === 'start') {
      handlers.onStart?.()
    } else if (hit.action === 'mode') {
      handlers.onMode?.(hit.value)
    } else if (hit.action === 'resume') {
      handlers.onResume?.()
    } else if (hit.action === 'redeploy') {
      handlers.onRedeploy?.()
    } else if (hit.action === 'quit') {
      handlers.onQuit?.()
    } else if (hit.action === 'restart') {
      handlers.onRestart?.()
    } else if (hit.action.startsWith('spawn:')) {
      handlers.onSpawn?.(Number(hit.action.split(':')[1]))
    } else if (hit.action.startsWith('loadout:')) {
      const [, kind, id] = hit.action.split(':')
      handlers.onLoadout?.(kind, id)
    } else if (hit.action.startsWith('portal-field:')) {
      activePortalField = hit.action.slice(13)
      const field = portal.fields.find(item => item.id === activePortalField)
      keyboardInput.type = field.password ? 'password' : 'text'
      keyboardInput.maxLength = field.maxLength || 128
      keyboardInput.value = field.value
      keyboardInput.focus({ preventScroll: true })
    } else if (hit.action.startsWith('portal:')) handlers.onPortalAction?.(hit.action.slice(7))
    dirty = true
  })
  canvas.addEventListener('pointercancel', event => {
    blockedPointers.delete(event.pointerId)
    activeTouch.delete(event.pointerId)
    activeSlider = null
    touchHandlers.up?.(event)
  })

  window.addEventListener('resize', resize)
  keyboardInput.addEventListener('input', () => {
    if (chatOpen) {
      chatValue = keyboardInput.value
      dirty = true
    } else if (screen === 'portal' && activePortalField) handlers.onPortalInput?.(activePortalField, keyboardInput.value)
  })
  keyboardInput.addEventListener('keydown', event => {
    if (chatOpen) {
      if (event.isComposing) return
      if (event.key === 'Enter') {
        const value = chatValue.trim()
        if (value) handlers.onChatSend?.(chatChannel, value)
        chatValue = ''
        keyboardInput.value = ''
      } else if (event.key === 'Escape') {
        chatOpen = false
        keyboardInput.blur()
        handlers.onChatToggle?.(false)
      } else if (event.key === 'Tab' || event.ctrlKey || event.metaKey || event.altKey || event.key.length > 1) {
        event.preventDefault()
        event.stopPropagation()
        return
      } else {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      dirty = true
      return
    }
    if (event.key !== 'Enter') return
    event.preventDefault()
    handlers.onPortalSubmit?.()
  })
  window.addEventListener('keydown', event => {
    if (rotateVisible) {
      event.preventDefault()
      return
    }
    if (event.code === 'KeyT' && chatChannels.length && document.activeElement !== keyboardInput) {
      chatOpen = true
      chatValue = ''
      keyboardInput.type = 'text'
      keyboardInput.maxLength = 160
      keyboardInput.value = ''
      keyboardInput.focus({ preventScroll: true })
      handlers.onChatToggle?.(true)
      event.preventDefault()
      event.stopPropagation()
      dirty = true
      return
    }
    if (screen !== 'portal') return
    if (event.key === 'Escape') {
      handlers.onPortalBack?.()
      event.preventDefault()
      return
    }
    if (!activePortalField || document.activeElement === keyboardInput) return
    const field = portal?.fields?.find(item => item.id === activePortalField)
    if (!field) return
    if (event.key === 'Enter') {
      handlers.onPortalSubmit?.()
    } else if (event.key === 'Backspace') {
      handlers.onPortalInput?.(field.id, field.value.slice(0, -1))
    } else if (event.key === 'Tab') {
      const fields = portal.fields
      activePortalField = fields[(fields.indexOf(field) + 1) % fields.length]?.id || null
    } else if (event.key.length === 1 && field.value.length < (field.maxLength || 128)) {
      handlers.onPortalInput?.(field.id, field.value + event.key)
    } else {
      return
    }
    event.preventDefault()
    dirty = true
  }, true)
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
    showMenu() {
      screen = 'menu'
      gameVisible = false
      dirty = true
    },
    showPortal(value) {
      const transitionKey = value.title
      if (screen !== 'portal' || transitionKey !== portalTransitionKey) {
        portalTransitionKey = transitionKey
        portalEnteredAt = performance.now()
        hoveredAction = null
      }
      portal = value
      screen = 'portal'
      gameVisible = false
      if (!value.fields?.some(field => field.id === activePortalField)) activePortalField = value.focus || null
      dirty = true
    },
    showGame() {
      screen = 'game'
      gameVisible = true
      endData = null
      dirty = true
    },
    setModes(definitions, selected) {
      modeDefinitions = definitions
      selectedMode = selected
      dirty = true
    },
    setSelectedMode(id) {
      selectedMode = id
      dirty = true
    },
    setRecords(entries) {
      records = entries
      dirty = true
    },
    setPaused(value, stopsMatch = true) {
      paused = value
      pauseStopsMatch = stopsMatch
      dirty = true
    },
    setRotateVisible(value) {
      rotateVisible = value
      if (value) {
        activeSlider = null
        activeTouch.clear()
        keyboardInput.blur()
      }
      dirty = true
    },
    setDeployment(value) {
      deployment = value
      dirty = true
    },
    setTouchMode(value) {
      touchMode = value
      resize()
    },
    setTouchVisible(value) {
      touchVisible = value
      dirty = true
    },
    setTouchLabel(action, label) {
      touchLabels[action] = label
      dirty = true
    },
    setTouchActive(action, value) {
      touchActive[action] = value
      dirty = true
    },
    setStickOffset(x, y) {
      stickOffset = { x, y }
      dirty = true
    },
    getTouchStickRect() { return { left: 16, top: innerHeight - 196, width: 132, height: 132 } },
    showHitMarker() {
      hitMarkerUntil = performance.now() + 160
      dirty = true
    },
    showDamage() {
      damageUntil = performance.now() + config.hud.damageVignetteDuration
      dirty = true
    },
    showDirectionDamage(source) {
      directionDamage = { source, until: performance.now() + config.hud.directionDamageDuration }
      dirty = true
    },
    showCenter(textValue, duration, big = '') {
      centerMessage = { text: textValue, big, until: performance.now() + duration }
      dirty = true
    },
    showAction(textValue, duration) {
      actionMessage = { text: textValue, until: performance.now() + duration }
      dirty = true
    },
    showKillNotice(title, sub, duration) {
      killNotice = { title, sub, until: performance.now() + duration }
      dirty = true
    },
    addFeed(item, duration) {
      killFeed.push({ ...item, until: performance.now() + duration })
      dirty = true
    },
    showDeath(textValue) {
      deathText = textValue
      dirty = true
    },
    hideDeath() {
      deathText = ''
      dirty = true
    },
    setScoreboardVisible(value) {
      scoreboardVisible = value
      dirty = true
    },
    setChatChannels(channels) {
      chatChannels = channels
      if (!chatChannels.includes(chatChannel)) chatChannel = chatChannels[0] || 'world'
      if (!chatChannels.length && chatOpen) {
        chatOpen = false
        keyboardInput.blur()
        handlers.onChatToggle?.(false)
      }
      dirty = true
    },
    addChatMessage(message) {
      chatMessages.push({ ...message, receivedAt: performance.now() })
      if (chatMessages.length > 50) chatMessages.shift()
      dirty = true
    },
    showEnd(data) {
      endData = data
      paused = false
      deployment = null
      dirty = true
    },
    invalidate() { dirty = true },
    render,
    resize,
    destroy() {
      canvas.remove()
      keyboardInput.remove()
    },
  }
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: options.body ? { 'content-type': 'application/json' } : undefined,
    ...options, body: options.body ? JSON.stringify(options.body) : undefined,
  })
  const text = await response.text()
  if (!response.ok) throw new Error(text || `HTTP ${response.status}`)
  return text ? JSON.parse(text) : null
}

export function createClient() {
  const state = createGameState()
  const deploy = createDeployState()
  const ui = createCanvasUi({ state, deploy, config: CFG })
  const touchDevice = detectTouchDevice()

  function syncPageOrientation() {
    ui.setRotateVisible(touchDevice && innerHeight > innerWidth)
  }

  async function lockLandscape() {
    const root = document.documentElement
    if (!document.fullscreenElement && root.requestFullscreen) {
      await root.requestFullscreen({ navigationUI: 'hide' })
    }
    if (window.screen.orientation?.lock) await window.screen.orientation.lock('landscape')
  }

  ui.setTouchMode(touchDevice)
  syncPageOrientation()
  window.addEventListener('resize', syncPageOrientation)
  window.addEventListener('orientationchange', syncPageOrientation)
  if (touchDevice) {
    document.addEventListener('pointerdown', () => {
      lockLandscape().catch(console.error)
    }, { capture: true, once: true })
  }

  let user = null
  let room = null
  let rooms = []
  let playerId = null
  let status = ''
  let statusError = false
  let networkConnected = false
  let screen = 'choice'
  let register = false
  let selectedMode = 'classic'
  let selectedTeam = 'allies'
  let visibility = 'public'
  let leaderboardMode = 'classic'
  let profileRows = []
  let activeSession = null
  const fields = { username: '', displayName: '', password: '', roomName: '', invite: '' }
  const session = {
    send(message) { return activeSession?.send(message) ?? false },
    sendInput(input) { return activeSession?.sendInput(input) ?? false },
    canPause() { return activeSession?.canPause?.() ?? false },
    setPaused(paused) { activeSession?.setPaused?.(paused) },
    resultStats(context) { return activeSession?.resultStats?.(context) ?? [] },
  }
  const game = createGame({ session, ui, state, deploy, getPlayerId: () => playerId })
  const networkSession = new NetworkSession({
    status(value) {
      networkConnected = value === 'online'
      syncChatContext()
      setStatus(value === 'online' ? '已连接联机服务器' : value === 'connecting' ? '正在连接...' : '连接已断开')
    },
    latency(value) { game.setLatency(value) },
    disconnected() { if (room) setStatus('连接中断，正在恢复席位...') },
    message: handleMessage,
  })

  function setStatus(value, error = false) {
    status = value
    statusError = error
    render()
  }

  function field(id, label, placeholder, password = false, maxLength = 128) {
    return { id, label, placeholder, password, maxLength, value: fields[id] }
  }

  function syncChatContext() {
    if (!networkConnected || activeSession !== networkSession) return ui.setChatChannels([])
    if (!room) return ui.setChatChannels(['world'])
    ui.setChatChannels(screen === 'game' ? ['room', 'squad'] : ['world', 'room', 'squad'])
  }

  function render() {
    syncChatContext()
    const common = { status, error: statusError }
    if (screen === 'choice') {
      const modeRows = MODE_DEFINITIONS.map(mode => {
        const records = state.records[mode.id]
        return {
          label: `${mode.name}　${records.matches} 场　${records.wins} 胜　${records.kills} 击杀`,
          action: `select-mode:${mode.id}`,
          actionLabel: mode.id === selectedMode ? '已选择' : '选择',
          selected: mode.id === selectedMode,
        }
      })
      const roomRows = user ? rooms.map(item => ({
        label: `${item.name}　${item.modeId === 'classic' ? '经典' : '丧尸'}　${item.players}/${item.capacity}`,
        action: `join:${item.id}`,
        actionLabel: '加入',
      })) : []
      ui.showPortal({
        ...common,
        title: '作战部署',
        account: user
          ? { label: user.displayName, logout: true }
          : { label: '登录' },
        rows: modeRows.concat(user ? [
          { label: '联机房间', muted: true, section: true },
          ...(roomRows.length ? roomRows : [{ label: '暂无公开房间', muted: true }]),
        ] : []),
        actions: [
          ...(selectedMode === 'classic' ? [
            { id: 'team', label: `单人：${selectedTeam === 'allies' ? '盟军' : '轴心'}`, paired: true,
              accent: selectedTeam === 'allies' ? COLORS.ally : COLORS.axis },
            { id: 'offline-start', label: '单人作战', primary: true, paired: true },
          ] : [{ id: 'offline-start', label: '单人作战', primary: true }]),
          { id: `quick:${selectedMode}`, label: '快速匹配' },
          ...(user ? [{ id: 'create', label: '创建房间' }, { id: 'invite', label: '邀请码' },
            { id: 'stats', label: '战绩排行' }] : []),
        ],
      })
    } else if (screen === 'auth') {
      ui.showPortal({
        ...common, title: register ? '创建账号' : '账号登录', focus: 'username',
        fields: [field('username', '用户名', '3-20 位字母、数字或下划线', false, 20),
          ...(register ? [field('displayName', '战场昵称', '最多 16 个字符', false, 16)] : []),
          field('password', '密码', register ? '至少 10 位' : '账号密码', true)],
        actions: [{ id: 'auth-submit', label: register ? '注册并登录' : '登录', primary: true },
          { id: 'auth-toggle', label: register ? '已有账号' : '创建账号' }, { id: 'choice', label: '返回' }],
      })
    } else if (screen === 'create') {
      ui.showPortal({
        ...common,
        title: '创建房间',
        fields: [field('roomName', '房间名称', `${user.displayName}的房间`, false, 20)],
        actions: [{ id: 'mode', label: selectedMode === 'classic' ? '模式：经典' : '模式：丧尸' },
          { id: 'visibility', label: visibility === 'public' ? '公开房' : '私密房' },
          { id: 'create-submit', label: '创建', primary: true }, { id: 'lobby', label: '返回大厅' }],
      })
    } else if (screen === 'invite') {
      ui.showPortal({
        ...common, title: '邀请码加入', fields: [field('invite', '6 位邀请码', '例如 A3H7KP', false, 6)],
        actions: [{ id: 'invite-submit', label: '加入房间', primary: true }, { id: 'lobby', label: '返回大厅' }],
      })
    } else if (screen === 'room') {
      showRoomCanvas(common)
    } else if (screen === 'stats') {
      ui.showPortal({
        ...common,
        title: `战绩排行　${leaderboardMode === 'classic' ? '经典' : '丧尸'}`,
        rows: profileRows.map(label => ({ label })),
        actions: [{ id: 'leaderboard-mode', label: leaderboardMode === 'classic' ? '丧尸' : '经典' },
          { id: 'lobby', label: '返回' }],
      })
    }
  }

  function showRoomCanvas(common = { status, error: statusError }) {
    screen = 'room'
    syncChatContext()
    const ownMember = room.members.find(member => member.userId === user.id)
    ui.showPortal({
      ...common,
      title: room.name,
      profile: `${user.displayName}　${room.modeId === 'classic' ? '经典' : '丧尸'}　${room.status}${room.invite ? `　${room.invite}` : ''}`,
      rows: [...room.members]
        .sort((a, b) => (a.team === 'allies' ? 0 : 1) - (b.team === 'allies' ? 0 : 1))
        .map(member => ({
          label: `[${member.team === 'allies' ? '盟军' : '轴心'}]  ${member.displayName}${member.connected ? '' : ' · 掉线'}`,
          accent: member.team === 'allies' ? COLORS.ally : COLORS.axis,
          action: room.hostId === user.id && member.userId !== user.id && room.status === 'waiting' ? `kick:${member.userId}` : null,
          actionLabel: '移除',
        })),
      actions: [
        ...(room.modeId === 'classic' && !['active', 'results'].includes(room.status) ? [{
          id: 'change-team',
          label: `当前：${ownMember?.team === 'allies' ? '盟军' : '轴心'} · 切换${ownMember?.team === 'allies' ? '轴心' : '盟军'}`,
          accent: ownMember?.team === 'allies' ? COLORS.ally : COLORS.axis,
        }] : []),
        ...(room.hostId === user.id && room.status === 'waiting' ? [{ id: 'start-match', label: '开始对局', primary: true }] : []),
        { id: 'leave-room', label: '退出房间', danger: true },
      ],
    })
  }

  async function checkSession() {
    try {
      user = (await api('/api/auth/session')).user
      if (user) {
        activeSession = networkSession
        networkSession.connect()
      }
      screen = 'choice'
      render()
    } catch (error) { setStatus(error.message, true) }
  }

  function enterLobby() {
    activeSession = networkSession
    screen = 'choice'
    room = null
    networkSession.connect()
    render()
  }

  async function startLocal(modeId) {
    activeSession = new LocalSession({ message: handleMessage }, state.records)
    activeSession.start(modeId, modeId === 'classic' ? selectedTeam : 'allies')
    await game.preparePresentation()
  }

  async function submitAuth() {
    try {
      const result = await api(`/api/auth/${register ? 'register' : 'login'}`, {
        method: 'POST', body: {
          username: fields.username, displayName: fields.displayName, password: fields.password,
        },
      })
      user = result.user
      fields.password = ''
      enterLobby()
    } catch (error) { setStatus(error.message, true) }
  }

  async function showStats() {
    try {
      const [profile, leaderboard] = await Promise.all([
        api('/api/multiplayer/profile'),
        api(`/api/multiplayer/leaderboard?mode=${leaderboardMode}`),
      ])
      const ownRows = profile.stats
        .filter(row => row.mode === leaderboardMode)
        .map(row => `我的　${row.scope === 'ranked' ? '排位' : '全部'}　${row.matches} 场　${row.wins} 胜　${row.kills} 击杀　${row.deaths} 阵亡　波次 ${row.highest_wave}`)
      const rankRows = leaderboard.entries.map((row, index) => `${index + 1}.　${row.display_name}　${row.wins} 胜　${row.kills} 击杀　${row.deaths} 阵亡　波次 ${row.highest_wave}`)
      profileRows = ownRows.concat(rankRows)
      if (!profileRows.length) profileRows = ['暂无数据']
      screen = 'stats'
      render()
    } catch (error) { setStatus(error.message, true) }
  }

  async function action(id) {
    if (id.startsWith('select-mode:')) {
      selectedMode = id.slice(12)
      render()
    } else if (id === 'offline-start') {
      await startLocal(selectedMode)
    } else if (id === 'login') {
      screen = 'auth'
      render()
    } else if (id === 'choice') {
      screen = 'choice'
      render()
    } else if (id === 'auth-toggle') {
      register = !register
      render()
    } else if (id === 'auth-submit') {
      await submitAuth()
    } else if (id === 'lobby') {
      enterLobby()
    } else if (id.startsWith('quick:')) {
      if (!user) {
        screen = 'auth'
        render()
      } else {
        networkSession.send({ type: 'quick_match', modeId: id.slice(6) })
      }
    } else if (id.startsWith('join:')) {
      networkSession.send({ type: 'join_room', roomId: id.slice(5) })
    } else if (id.startsWith('kick:')) {
      networkSession.send({ type: 'kick_member', userId: id.slice(5) })
    } else if (id === 'create') {
      screen = 'create'
      render()
    } else if (id === 'mode') {
      selectedMode = selectedMode === 'classic' ? 'zombie' : 'classic'
      render()
    } else if (id === 'team') {
      selectedTeam = selectedTeam === 'allies' ? 'axis' : 'allies'
      render()
    } else if (id === 'visibility') {
      visibility = visibility === 'public' ? 'private' : 'public'
      render()
    } else if (id === 'create-submit') {
      networkSession.send({
        type: 'create_room',
        modeId: selectedMode,
        visibility,
        name: fields.roomName.trim() || `${user.displayName}的房间`,
      })
    } else if (id === 'invite') {
      screen = 'invite'
      render()
    } else if (id === 'invite-submit') {
      networkSession.send({ type: 'join_room', invite: fields.invite.trim().toUpperCase() })
    } else if (id === 'change-team') {
      const ownTeam = room.members.find(member => member.userId === user.id)?.team
      networkSession.send({ type: 'change_team', team: ownTeam === 'allies' ? 'axis' : 'allies' })
    } else if (id === 'start-match') {
      networkSession.send({ type: 'start_match' })
    } else if (id === 'leave-room') {
      networkSession.send({ type: 'leave_room' })
    } else if (id === 'stats') {
      leaderboardMode = selectedMode
      await showStats()
    } else if (id === 'leaderboard-mode') {
      leaderboardMode = leaderboardMode === 'classic' ? 'zombie' : 'classic'
      await showStats()
    } else if (id === 'logout') {
      networkSession.close()
      activeSession = null
      await api('/api/auth/logout', { method: 'POST' })
      user = null
      rooms = []
      screen = 'choice'
      render()
    }
  }

  function handleMessage(message) {
    if (message.type === 'hello' || message.type === 'lobby_snapshot') {
      rooms = message.rooms ?? rooms
      user = message.user || user
      if (screen === 'choice') render()
    } else if (message.type === 'joined') {
      room = message.room
      playerId = message.playerId
      showRoomCanvas()
    } else if (message.type === 'room_state') {
      room = message.room
      if (!game.active) showRoomCanvas()
    } else if (message.type === 'left') {
      enterLobby()
    } else if (message.type === 'match_start') {
      screen = 'game'
      syncChatContext()
      playerId = message.playerId || playerId
      game.boot(message.map, message.snapshot)
    } else if (message.type === 'snapshot') {
      game.snapshot(message.snapshot)
    } else if (message.type === 'events') {
      game.events(message.events)
    } else if (message.type === 'match_end') {
      game.end(message.snapshot)
    } else if (message.type === 'chat') {
      ui.addChatMessage(message)
    } else if (message.type === 'kicked') {
      room = null
      screen = 'choice'
      setStatus('你已被房主移出')
    } else if (message.type === 'error') setStatus(message.message, true)
  }

  ui.setHandlers({
    onPortalAction: action,
    onPortalBack() {
      if (screen === 'choice') return
      if (screen === 'room') action('leave-room')
      else if (['create', 'invite', 'stats'].includes(screen)) action('lobby')
      else action('choice')
    },
    onPortalSubmit: () => screen === 'auth' ? submitAuth() : null,
    onChatToggle(value) { game.setChatOpen(value) },
    onChatSend(channel, text) {
      networkSession.send({ type: 'chat', channel, text })
    },
    onPortalInput(id, value) {
      fields[id] = value;
      render()
    },
    onResume: () => game.togglePause(), onQuit: () => game.leave(),
    onRedeploy: () => game.redeploy(), onSetting: (setting, value) => game.applySetting(setting, value),
    onRestart: () => game.leave(), onSpawn: index => game.deploy(index),
    onLoadout: (kind, id) => game.selectLoadout(kind, id),
  })

  return {
    start() {
      checkSession()
      game.animate()
    }
  }
}
