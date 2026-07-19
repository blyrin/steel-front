import { CFG } from './config.js'

const SETTINGS_KEY = 'steel-front-settings'

function loadSettings() {
  const raw = localStorage.getItem(SETTINGS_KEY)
  if (!raw) {
    return {
      masterVolume: CFG.masterVolume,
      mouseSensitivity: CFG.mouseSensitivity,
    }
  }
  const data = JSON.parse(raw)
  return {
    masterVolume: data.masterVolume ?? CFG.masterVolume,
    mouseSensitivity: data.mouseSensitivity ?? CFG.mouseSensitivity,
  }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export function createGameState() {
  return {
    running: false,
    paused: false,
    loading: true,
    alliesScore: 0,
    axisScore: 0,
    player: null,
    bots: [],
    particles: [],
    obstacles: [],
    coverPoints: [],
    startTime: 0,
    settings: loadSettings(),
  }
}

export function createDeployState() {
  return {
    phase: 'none',
    deathTimer: 0,
    animTime: 0,
    spawnPoint: null,
  }
}
