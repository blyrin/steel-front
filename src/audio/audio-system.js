import * as THREE from 'three'

export class AudioSystem {
  constructor(camera, files, config) {
    this.camera = camera
    this.files = files
    this.ctx = null
    this.enabled = false
    this.masterGain = null
    this.masterVolume = config.settings.masterVolume
    this.dryGain = null
    this.wetIn = null
    this.wetGain = null
    this.convolver = null
    this.compressor = null
    this.slapIn = null
    this.buffers = {}
    this.ready = false
    this.graphReady = false
    this.ambienceGain = null
    this.ambienceSrc = null
    this._fwd = new THREE.Vector3()
    this._up = new THREE.Vector3()
    this.active = 0
    this.maxVoices = config.audio.maxVoices
    this.overflowVoices = config.audio.overflowVoices
    this._lastWorldShot = 0
  }

  _ensureGraph() {
    if (this.graphReady) return
    this.ctx = new (window.AudioContext || window.webkitAudioContext)()

    this.compressor = this.ctx.createDynamicsCompressor()
    this.compressor.threshold.value = -18
    this.compressor.knee.value = 18
    this.compressor.ratio.value = 2.2
    this.compressor.attack.value = 0.003
    this.compressor.release.value = 0.22
    this.masterGain = this.ctx.createGain()
    this.masterGain.gain.value = this.masterVolume
    this.masterGain.connect(this.compressor)
    this.compressor.connect(this.ctx.destination)

    this.dryGain = this.ctx.createGain()
    this.dryGain.gain.value = 0.95
    this.dryGain.connect(this.masterGain)

    this.wetGain = this.ctx.createGain()
    this.wetGain.gain.value = 0.2
    this.convolver = this.ctx.createConvolver()
    this.convolver.buffer = this._makeOutdoorIR(1.15)
    const wetHP = this.ctx.createBiquadFilter()
    wetHP.type = 'highpass'
    wetHP.frequency.value = 240
    const wetLP = this.ctx.createBiquadFilter()
    wetLP.type = 'lowpass'
    wetLP.frequency.value = 3800
    this.wetIn = this.ctx.createGain()
    this.wetIn.gain.value = 1
    this.wetIn.connect(this.convolver)
    this.convolver.connect(wetHP)
    wetHP.connect(wetLP)
    wetLP.connect(this.wetGain)
    this.wetGain.connect(this.masterGain)

    this.slapIn = this.ctx.createGain()
    this.slapIn.gain.value = 1
    const slapLP = this.ctx.createBiquadFilter()
    slapLP.type = 'lowpass'
    slapLP.frequency.value = 2800
    const delayL = this.ctx.createDelay(0.25)
    const delayR = this.ctx.createDelay(0.25)
    delayL.delayTime.value = 0.05
    delayR.delayTime.value = 0.08
    const dGainL = this.ctx.createGain()
    dGainL.gain.value = 0.14
    const dGainR = this.ctx.createGain()
    dGainR.gain.value = 0.11
    const merger = this.ctx.createChannelMerger(2)
    const slapWet = this.ctx.createGain()
    slapWet.gain.value = 0.16
    this.slapIn.connect(slapLP)
    slapLP.connect(delayL)
    slapLP.connect(delayR)
    delayL.connect(dGainL)
    delayR.connect(dGainR)
    dGainL.connect(merger, 0, 0)
    dGainR.connect(merger, 0, 1)
    merger.connect(this.dryGain)
    slapLP.connect(slapWet)
    slapWet.connect(this.wetIn)

    this.enabled = true
    this.graphReady = true
  }

  async preload(onProgress) {
    if (this.ready) {
      onProgress?.(1)
      return
    }
    this._ensureGraph()
    const entries = Object.entries(this.files)
    let done = 0
    const report = () => onProgress?.(done / entries.length)
    report()
    await Promise.all(
      entries.map(async ([name, url]) => {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`音频加载失败: ${name}`)
        const raw = await res.arrayBuffer()
        this.buffers[name] = await this.ctx.decodeAudioData(raw.slice(0))
        done++
        report()
      })
    )
    this.ready = true
    onProgress?.(1)
  }

  async init() {
    this._ensureGraph()
    if (!this.ready) await this.preload()
    if (this.ctx.state === 'suspended') await this.ctx.resume()
    this.startAmbience()
  }

  _makeOutdoorIR(seconds) {
    const rate = this.ctx.sampleRate
    const len = Math.floor(rate * seconds)
    const buf = this.ctx.createBuffer(2, len, rate)
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch)
      for (let i = 0; i < len; i++) {
        const t = i / rate
        let earlyReflection = 0
        if (t > 0.018 && t < 0.1)
          earlyReflection = (Math.random() * 2 - 1) * Math.exp(-(t - 0.018) * 20) * 0.5
        const tail =
          (Math.random() * 2 - 1) * Math.exp(-t * 2.1) * (0.18 + 0.06 * Math.sin(t * 9 + ch))
        data[i] = earlyReflection + tail
      }
      if (ch === 1) {
        for (let i = len - 1; i > 14; i--) data[i] = data[i] * 0.92 + data[i - 14] * 0.16
      }
    }
    return buf
  }

  updateListener() {
    if (!this.ready || !this.ctx) return
    const listener = this.ctx.listener
    const position = this.camera.position
    this.camera.getWorldDirection(this._fwd)
    this._up.setFromMatrixColumn(this.camera.matrixWorld, 1)
    if (listener.positionX) {
      listener.positionX.value = position.x
      listener.positionY.value = position.y
      listener.positionZ.value = position.z
      listener.forwardX.value = this._fwd.x
      listener.forwardY.value = this._fwd.y
      listener.forwardZ.value = this._fwd.z
      listener.upX.value = this._up.x
      listener.upY.value = this._up.y
      listener.upZ.value = this._up.z
    } else {
      listener.setPosition(position.x, position.y, position.z)
      listener.setOrientation(
        this._fwd.x,
        this._fwd.y,
        this._fwd.z,
        this._up.x,
        this._up.y,
        this._up.z
      )
    }
  }

  _setPos(node, pos) {
    const y = pos.y ?? 1.2
    if (node.positionX) {
      node.positionX.value = pos.x
      node.positionY.value = y
      node.positionZ.value = pos.z
    } else {
      node.setPosition(pos.x, y, pos.z)
    }
  }

  play(
    keys,
    {
      vol = 1,
      rate = 1,
      rateJitter = 0,
      pos = null,
      ref = 24,
      max = 140,
      rolloff = 0.3,
      wet = 0,
      slap = false,
      priority = 0,
    } = {}
  ) {
    if (!this.enabled || !this.ready) return
    if (this.ctx.state === 'suspended') this.ctx.resume()
    if (this.active >= this.maxVoices && priority < 1) return
    if (this.active >= this.maxVoices + this.overflowVoices) return

    if (pos && this.camera.position.distanceTo(pos) > max) return
    const list = Array.isArray(keys) ? keys : [keys]
    const buf = this.buffers[list[Math.floor(Math.random() * list.length)]]
    if (!buf) return

    const src = this.ctx.createBufferSource()
    src.buffer = buf
    src.playbackRate.value = rate * (1 + (Math.random() * 2 - 1) * rateJitter)
    const gain = this.ctx.createGain()
    gain.gain.value = vol
    src.connect(gain)

    if (pos) {
      const panner = this.ctx.createPanner()
      panner.panningModel = 'equalpower'
      panner.distanceModel = 'linear'
      panner.refDistance = ref
      panner.maxDistance = max
      panner.rolloffFactor = rolloff
      panner.coneInnerAngle = 360
      panner.coneOuterAngle = 360
      this._setPos(panner, pos)
      gain.connect(panner)
      panner.connect(this.dryGain)
      if (wet > 0.02) {
        const send = this.ctx.createGain()
        send.gain.value = wet
        panner.connect(send)
        send.connect(this.wetIn)
      }
    } else {
      gain.connect(this.dryGain)
      if (wet > 0.02) {
        const send = this.ctx.createGain()
        send.gain.value = wet
        gain.connect(send)
        send.connect(this.wetIn)
      }
      if (slap) gain.connect(this.slapIn)
    }

    this.active++
    src.onended = () => {
      this.active = Math.max(0, this.active - 1)
    }
    src.start(0)
    return src
  }

  startAmbience() {
    if (!this.ready || this.ambienceSrc) return
    const buf = this.buffers.ambience
    if (!buf) return
    if (this.ctx.state === 'suspended') this.ctx.resume()
    this.ambienceGain = this.ctx.createGain()
    this.ambienceGain.gain.value = 0
    const ambHP = this.ctx.createBiquadFilter()
    ambHP.type = 'highpass'
    ambHP.frequency.value = 90
    const ambLP = this.ctx.createBiquadFilter()
    ambLP.type = 'lowpass'
    ambLP.frequency.value = 5600
    const ambWet = this.ctx.createGain()
    ambWet.gain.value = 0.12
    const src = this.ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    src.connect(ambHP)
    ambHP.connect(ambLP)
    ambLP.connect(this.ambienceGain)
    this.ambienceGain.connect(this.dryGain)
    ambLP.connect(ambWet)
    ambWet.connect(this.wetIn)
    src.start(0)
    this.ambienceSrc = src
    this.ambienceVol = 0.28
    this.ambienceGain.gain.linearRampToValueAtTime(this.ambienceVol, this.ctx.currentTime + 1.4)
  }

  setMasterVolume(volume) {
    this.masterVolume = volume
    if (this.masterGain) this.masterGain.gain.value = volume
  }

  setAmbienceMuted(muted) {
    if (!this.ambienceGain) return
    const time = this.ctx.currentTime
    this.ambienceGain.gain.cancelScheduledValues(time)
    this.ambienceGain.gain.setValueAtTime(this.ambienceGain.gain.value, time)
    this.ambienceGain.gain.linearRampToValueAtTime(
      muted ? 0 : this.ambienceVol || 0.28,
      time + 0.25
    )
  }

  rifleShot() {
    this.play('rifle_01', {
      vol: 0.9,
      rateJitter: 0.025,
      wet: 0.2,
      slap: true,
      priority: 2,
    })
  }
  reload() {
    this.play('reload_insert', { vol: 0.7, rateJitter: 0.02, priority: 1 })
  }
  reloadStage(stage) {
    if (stage === 'open')
      this.play(['reload_click', 'bolt_release'], {
        vol: 0.55,
        rateJitter: 0.03,
        priority: 1,
      })
    else if (stage === 'insert')
      this.play(['reload_insert', 'reload_lock'], {
        vol: 0.72,
        rateJitter: 0.02,
        priority: 1,
      })
    else if (stage === 'seat') this.play('reload_click2', { vol: 0.5, rate: 0.95, priority: 1 })
    else if (stage === 'close') this.play('bolt_release', { vol: 0.62, rate: 1.05, priority: 1 })
  }
  ping() {
    this.play('ping', { vol: 0.72, rateJitter: 0.04, priority: 2 })
    this.play('clip_eject', { vol: 0.42, rate: 1.05, priority: 1 })
  }
  step() {
    this.play(['step_01', 'step_02', 'step_03'], {
      vol: 0.24,
      rateJitter: 0.1,
    })
  }
  whoosh() {
    this.play(['whoosh', 'whoosh2'], {
      vol: 0.55,
      rate: 0.85,
      rateJitter: 0.05,
      wet: 0.12,
      priority: 1,
    })
  }
  impact() {
    this.play('land', {
      vol: 0.75,
      rateJitter: 0.04,
      wet: 0.12,
      slap: true,
      priority: 1,
    })
  }

  grenadeExplosion(pos) {
    this.play(['distant_01', 'distant_02'], {
      vol: 1.15,
      rate: 0.72,
      rateJitter: 0.05,
      pos,
      ref: 30,
      max: 150,
      rolloff: 0.24,
      wet: 0.22,
      priority: 2,
    })
  }

  botShot(pos) {
    if (!pos) return
    const now = performance.now()
    if (now - this._lastWorldShot < 40) return
    const distance = this.camera.position.distanceTo(pos)
    if (distance > 120) return
    this._lastWorldShot = now
    if (distance > 55)
      this.play(['distant_01', 'distant_02'], {
        vol: 0.72,
        rateJitter: 0.05,
        pos,
        ref: 35,
        max: 150,
        rolloff: 0.24,
        wet: 0.18,
      })
    else if (distance > 28)
      this.play(['rifle_03', 'rifle_04', 'distant_01'], {
        vol: 0.78,
        rateJitter: 0.05,
        pos,
        ref: 28,
        max: 140,
        rolloff: 0.26,
        wet: 0.12,
        priority: 1,
      })
    else
      this.play(['rifle_01', 'rifle_02', 'rifle_03', 'rifle_04'], {
        vol: 0.84,
        rateJitter: 0.05,
        pos,
        ref: 22,
        max: 130,
        rolloff: 0.28,
        wet: 0.1,
        priority: 1,
      })
  }

  hitFlesh(pos) {
    this.play(['hit_01', 'hit_02', 'hit_03'], {
      vol: 0.38,
      rateJitter: 0.08,
      pos: pos || null,
      ref: 18,
      max: 80,
      rolloff: 0.35,
      priority: 1,
    })
  }
  pain(chance = 0.3, pos = null) {
    if (Math.random() >= chance) return
    this.play(['pain_01', 'pain_02', 'pain_03'], {
      vol: 0.22,
      rateJitter: 0.06,
      pos,
      ref: 18,
      max: 80,
      rolloff: 0.35,
    })
  }
  bodyFall(pos) {
    this.play(['body_fall', 'body_fall2'], {
      vol: 0.35,
      rateJitter: 0.05,
      pos: pos || null,
      ref: 16,
      max: 70,
      rolloff: 0.35,
    })
  }
  bulletWhiz(pos) {
    this.play('whiz', {
      vol: 0.08,
      rate: 1.15 + Math.random() * 0.3,
      rateJitter: 0.05,
      pos: pos || null,
      ref: 12,
      max: 40,
      rolloff: 0.4,
    })
  }
  ricochet(pos) {
    this.play('ricochet', {
      vol: 0.45,
      rateJitter: 0.1,
      pos: pos || null,
      ref: 20,
      max: 90,
      rolloff: 0.3,
      wet: 0.08,
    })
  }
  shellDrop(pos) {
    if (pos && this.camera.position.distanceTo(pos) > 24) return
    this.play('shell_drop', {
      vol: 0.36,
      rateJitter: 0.08,
      pos: pos || null,
      ref: 10,
      max: 30,
      rolloff: 0.4,
    })
  }
  stabSwing() {
    this.play(['stab_swing', 'stab_swing2'], {
      vol: 0.55,
      rate: 1.05,
      rateJitter: 0.06,
      wet: 0.08,
      priority: 1,
    })
  }
  stabHitFlesh(pos) {
    this.play('stab_hit', {
      vol: 0.55,
      rateJitter: 0.05,
      pos: pos || null,
      ref: 6,
      max: 30,
      priority: 1,
    })
    this.play('stab_flesh', {
      vol: 0.4,
      rateJitter: 0.05,
      pos: pos || null,
      ref: 6,
      max: 30,
      priority: 1,
    })
  }
  stabHitMetal(pos) {
    this.play('stab_metal', {
      vol: 0.45,
      rateJitter: 0.06,
      pos: pos || null,
      ref: 7,
      max: 35,
      priority: 1,
    })
  }
  killConfirm(kind = 'normal') {
    if (kind === 'head') this.play('kill_head', { vol: 1.35, rate: 1.12, priority: 2 })
    else
      this.play('kill_confirm', {
        vol: 1.15,
        rate: 1 + Math.random() * 0.04,
        priority: 2,
      })
  }
}
