// 通用动作引擎：通道互斥、进度推进、时间轴标记。
// 同通道同时只跑一个动作；标记按进度触发一次；完成后保留到 flush，供表现层采样到 progress=1。

export function createActionEngine() {
  const channels = new Map()

  function play(def, params = {}) {
    if (!def?.id || !def?.channel) {
      throw new Error('动作定义必须包含 id 与 channel')
    }
    const duration = resolveDuration(def, params)
    if (!(duration > 0)) {
      throw new Error(`动作 ${def.id} 的 duration 必须大于 0`)
    }
    const markers = resolveMarkers(def, params)
      .map(marker => ({ at: marker.at, name: marker.name, fired: false }))
      .sort((a, b) => a.at - b.at)
    const runtime = {
      id: def.id,
      channel: def.channel,
      duration,
      time: 0,
      progress: 0,
      params,
      markers,
      done: false,
    }
    channels.set(def.channel, runtime)
    return runtime
  }

  function update(dt) {
    const events = []
    for (const runtime of channels.values()) {
      if (runtime.done) continue
      runtime.time += dt
      runtime.progress = Math.min(1, runtime.time / runtime.duration)
      for (const marker of runtime.markers) {
        if (marker.fired || runtime.progress < marker.at) continue
        marker.fired = true
        events.push({
          type: 'marker',
          action: runtime.id,
          channel: runtime.channel,
          name: marker.name,
          params: runtime.params,
          progress: runtime.progress,
        })
      }
      if (runtime.progress < 1) continue
      runtime.done = true
      events.push({
        type: 'complete',
        action: runtime.id,
        channel: runtime.channel,
        params: runtime.params,
        progress: 1,
      })
    }
    return events
  }

  // 表现层采样 progress=1 后再清掉已完成动作。
  function flush() {
    for (const [channel, runtime] of channels) {
      if (runtime.done) channels.delete(channel)
    }
  }

  function cancel(channel) {
    const runtime = channels.get(channel)
    if (!runtime) return null
    channels.delete(channel)
    return runtime
  }

  function cancelAll() {
    channels.clear()
  }

  function get(id) {
    for (const runtime of channels.values()) {
      if (runtime.id === id) return runtime
    }
    return null
  }

  function isActive(id) {
    const runtime = get(id)
    return !!runtime && !runtime.done
  }

  function isBusy(...channelNames) {
    for (const name of channelNames) {
      const runtime = channels.get(name)
      if (runtime && !runtime.done) return true
    }
    return false
  }

  return {
    play,
    update,
    flush,
    cancel,
    cancelAll,
    get,
    isActive,
    isBusy,
  }
}

export function createPlayerWeaponActions(weaponConfig) {
  return {
    bolt: {
      id: 'bolt',
      channel: 'bolt',
      duration: () => weaponConfig.boltAnimationDuration,
    },
    reload: {
      id: 'reload',
      channel: 'hands',
      duration: params =>
        params.empty ? params.emptyReloadDuration : params.reloadDuration,
    },
    melee: {
      id: 'melee',
      channel: 'hands',
      duration: () => weaponConfig.meleeAnimationDuration,
      markers: [
        { at: 0.22, name: 'prep' },
        { at: 0.36, name: 'hit' },
      ],
    },
    queueReload: {
      id: 'queueReload',
      channel: 'queueReload',
      duration: () => weaponConfig.emptyReloadDelay,
    },
  }
}

function resolveDuration(def, params) {
  return typeof def.duration === 'function' ? def.duration(params) : def.duration
}

function resolveMarkers(def, params) {
  if (!def.markers) return []
  return typeof def.markers === 'function' ? def.markers(params) : def.markers
}
