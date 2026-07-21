import * as THREE from 'three'

export function createEffectsSystem({ scene, state, audio, config }) {
  const effectsConfig = config.effects
  const pools = {
    tracer: [],
    core: [],
    flare: [],
    side: [],
    smoke: [],
    shell: [],
    spark: [],
    dust: [],
    blood: [],
    light: [],
  }

  const geometry = {
    core: new THREE.SphereGeometry(1, 6, 4),
    flare: new THREE.ConeGeometry(1, 1, 5, 1, true),
    side: new THREE.SphereGeometry(1, 6, 4),
    smoke: new THREE.SphereGeometry(1, 5, 3),
    shell: new THREE.CylinderGeometry(1, 1, 1, 6),
    spark: new THREE.SphereGeometry(1, 4, 3),
    dust: new THREE.SphereGeometry(1, 4, 3),
    blood: new THREE.SphereGeometry(1, 4, 3),
  }

  function take(type, create) {
    return pools[type].pop() || create()
  }

  function release(type, object) {
    object.visible = false
    pools[type].push(object)
  }

  function addParticle(particle) {
    particle.mesh.visible = true
    scene.add(particle.mesh)
    state.particles.push(particle)
  }

  function update(dt) {
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const particle = state.particles[i]
      particle.life -= dt
      if (particle.life <= 0) {
        scene.remove(particle.mesh)
        particle.onComplete?.()
        if (particle.poolType) release(particle.poolType, particle.mesh)
        state.particles.splice(i, 1)
      } else {
        particle.update?.(dt, particle.maxLife - particle.life, particle)
      }
    }
  }

  function createTracer() {
    const tracer = new THREE.Line(
      new THREE.BufferGeometry().setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array(6), 3)
      ),
      new THREE.LineBasicMaterial({
        color: 0xfff06a,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
      })
    )
    tracer.frustumCulled = true
    tracer.matrixAutoUpdate = false
    return tracer
  }

  function addTracer(origin, end) {
    const tracer = take('tracer', createTracer)
    const positions = tracer.geometry.attributes.position
    tracer.position.copy(origin)
    tracer.quaternion.identity()
    tracer.scale.set(1, 1, 1)
    tracer.updateMatrix()
    positions.setXYZ(0, 0, 0, 0)
    positions.setXYZ(1, end.x - origin.x, end.y - origin.y, end.z - origin.z)
    positions.needsUpdate = true
    tracer.geometry.computeBoundingSphere()
    tracer.material.opacity = effectsConfig.tracerOpacity
    addParticle({
      mesh: tracer,
      poolType: 'tracer',
      type: 'tracer',
      life: effectsConfig.tracerLife,
      maxLife: effectsConfig.tracerLife,
      update: (dt, time, particle) => {
        tracer.material.opacity = effectsConfig.tracerOpacity * (1 - time / particle.maxLife)
      },
    })
  }

  function createMesh(type, material) {
    return new THREE.Mesh(geometry[type], material)
  }

  function spawnMuzzleFlash(pos, dir, firstPerson = false) {
    const direction = dir.clone().normalize()
    const core = take(
      'core',
      () => createMesh('core', new THREE.MeshBasicMaterial({ color: 0xfff6d0, transparent: true }))
    )
    core.position.copy(pos).addScaledVector(direction, firstPerson ? 0.04 : 0.08)
    core.scale.setScalar(firstPerson ? 0.065 : 0.11)
    core.material.opacity = 0.98

    const flare = take(
      'flare',
      () =>
        createMesh(
          'flare',
          new THREE.MeshBasicMaterial({
            color: 0xff9028,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
          })
        )
    )
    flare.position.copy(pos).addScaledVector(direction, firstPerson ? 0.11 : 0.15)
    flare.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction)
    const flareRadius = firstPerson ? 0.055 : 0.1
    const flareHeight = firstPerson ? 0.18 : 0.26
    flare.scale.set(flareRadius, flareHeight, flareRadius)

    const side = take(
      'side',
      () => createMesh('side', new THREE.MeshBasicMaterial({ color: 0xffc45a, transparent: true }))
    )
    side.position.copy(pos).addScaledVector(direction, firstPerson ? 0.02 : 0.05)
    side.scale.set(firstPerson ? 0.085 : 0.128, firstPerson ? 0.025 : 0.037, firstPerson ? 0.025 : 0.037)
    side.material.opacity = 0.75

    const light = firstPerson
      ? take('light', () => new THREE.PointLight(0xffa040, 0, 8))
      : null
    if (light) {
      light.visible = true
      light.position.copy(pos)
      light.distance = 5
      light.intensity = 2.8
    }
    flare.visible = true
    side.visible = true
    scene.add(flare)
    scene.add(side)
    if (light) scene.add(light)

    const life = firstPerson ? effectsConfig.firstPersonMuzzleLife : effectsConfig.botMuzzleLife
    addParticle({
      mesh: core,
      poolType: 'core',
      type: 'flash',
      life,
      maxLife: life,
      update: (dt, time) => {
        const progress = 1 - time / life
        core.material.opacity = progress * 0.98
        core.scale.setScalar((firstPerson ? 0.065 : 0.11) * (0.65 + (1 - progress) * 2.0))
        flare.material.opacity = progress * 0.8
        flare.scale.set(
          flareRadius * (0.8 + (1 - progress) * 1.55),
          flareHeight * (0.8 + (1 - progress) * 1.55),
          flareRadius * (0.8 + (1 - progress) * 1.55)
        )
        side.material.opacity = progress * 0.75
        side.scale.set(
          (firstPerson ? 0.085 : 0.128) * (1.7 + (1 - progress) * 1.1),
          (firstPerson ? 0.025 : 0.037) * (0.5 + (1 - progress) * 0.45),
          (firstPerson ? 0.025 : 0.037) * (0.5 + (1 - progress) * 0.45)
        )
        light && (light.intensity = progress * 2.8)
      },
      onComplete: () => {
        scene.remove(flare)
        scene.remove(side)
        release('flare', flare)
        release('side', side)
        if (light) {
          scene.remove(light)
          release('light', light)
        }
      },
    })

    const count = firstPerson ? effectsConfig.firstPersonSmokeCount : effectsConfig.botSmokeCount
    for (let i = 0; i < count; i++) {
      const puff = take(
        'smoke',
        () =>
          createMesh(
            'smoke',
            new THREE.MeshBasicMaterial({
              color: 0xb8d5dd,
              transparent: true,
              depthWrite: false,
            })
          )
      )
      puff.position.copy(pos).addScaledVector(direction, 0.08 + i * 0.04)
      puff.scale.setScalar(0.045)
      puff.material.opacity = firstPerson ? 0.22 : 0.4
      const velocity = direction
        .clone()
        .multiplyScalar(0.55 + Math.random() * 0.45)
        .add(
          new THREE.Vector3(
            (Math.random() - 0.5) * 0.4,
            0.18 + Math.random() * 0.28,
            (Math.random() - 0.5) * 0.4
          )
        )
      const maxLife = effectsConfig.smokeLife + i * effectsConfig.smokeLifeStep
      addParticle({
        mesh: puff,
        poolType: 'smoke',
        type: 'smoke',
        life: maxLife,
        maxLife,
        vel: velocity,
        update: (dt, time, particle) => {
          particle.mesh.position.addScaledVector(particle.vel, dt)
          particle.vel.multiplyScalar(0.91)
          particle.mesh.material.opacity = (1 - time / particle.maxLife) * (firstPerson ? 0.22 : 0.4)
          particle.mesh.scale.setScalar(0.045 * (1 + time * 2.6))
        },
      })
    }
  }

  function spawnShell(pos, right = null, up = null) {
    const shell = take(
      'shell',
      () =>
        createMesh(
          'shell',
          new THREE.MeshBasicMaterial({ color: 0xf4c84a })
        )
    )
    shell.position.copy(pos)
    shell.scale.set(0.0065, 0.028, 0.0065)
    shell.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI)
    const rightAxis = right ? right.clone().normalize() : new THREE.Vector3(1, 0, 0)
    const upAxis = up ? up.clone().normalize() : new THREE.Vector3(0, 1, 0)
    const forward = new THREE.Vector3().crossVectors(upAxis, rightAxis).normalize()
    const velocity = rightAxis
      .multiplyScalar(2.2 + Math.random() * 0.9)
      .addScaledVector(upAxis, 1.4 + Math.random() * 0.7)
      .addScaledVector(forward, -0.3 + Math.random() * 0.4)
    let landed = false
    addParticle({
      mesh: shell,
      poolType: 'shell',
      type: 'shell',
      life: effectsConfig.shellLife,
      maxLife: effectsConfig.shellLife,
      vel: velocity,
      rotVel: new THREE.Vector3(8 + Math.random() * 10, 6 + Math.random() * 8, 4 + Math.random() * 6),
      update: (dt, time, particle) => {
        particle.vel.y -= effectsConfig.shellGravity * dt
        particle.mesh.position.addScaledVector(particle.vel, dt)
        particle.mesh.rotation.x += particle.rotVel.x * dt
        particle.mesh.rotation.y += particle.rotVel.y * dt
        particle.mesh.rotation.z += particle.rotVel.z * dt
        if (particle.mesh.position.y < 0.02) {
          if (!landed) {
            landed = true
            if (Math.random() < effectsConfig.shellDropChance) audio.shellDrop(particle.mesh.position)
          }
          particle.mesh.position.y = 0.02
          particle.vel.y *= effectsConfig.shellBounce
          particle.vel.x *= effectsConfig.shellHorizontalDamping
          particle.vel.z *= effectsConfig.shellHorizontalDamping
          particle.rotVel.multiplyScalar(effectsConfig.shellRotationDamping)
        }
      },
    })
  }

  function spawnSmokePuff(pos) {
    const puff = take(
      'smoke',
      () =>
        createMesh(
          'smoke',
          new THREE.MeshBasicMaterial({ color: 0xb5d1d9, transparent: true, depthWrite: false })
        )
    )
    puff.position.copy(pos)
    puff.scale.setScalar(0.06)
    puff.material.opacity = 0.12
    addParticle({
      mesh: puff,
      poolType: 'smoke',
      type: 'smoke',
      life: effectsConfig.smokePuffLife,
      maxLife: effectsConfig.smokePuffLife,
      update: (dt, time, particle) => {
        particle.mesh.material.opacity = (1 - time / particle.maxLife) * 0.12
        particle.mesh.scale.setScalar(0.06 * (1 + time * 2.6))
        particle.mesh.position.y += dt * 0.18
      },
    })
  }

  function spawnSpark(pos, dir) {
    for (let i = 0; i < effectsConfig.sparkCount; i++) {
      const spark = take(
        'spark',
        () => createMesh('spark', new THREE.MeshBasicMaterial({ color: 0xffaa30, transparent: true }))
      )
      spark.position.copy(pos)
      spark.scale.setScalar(0.015)
      spark.material.opacity = 1
      const velocity = dir
        .clone()
        .multiplyScalar(-1)
        .add(
          new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 2, (Math.random() - 0.5) * 2)
        )
        .multiplyScalar(2)
      addParticle({
        mesh: spark,
        poolType: 'spark',
        type: 'spark',
        life: effectsConfig.sparkLife,
        maxLife: effectsConfig.sparkLife,
        vel: velocity,
        update: (dt, time, particle) => {
          particle.vel.y -= effectsConfig.sparkGravity * dt
          particle.mesh.position.addScaledVector(particle.vel, dt)
          particle.mesh.material.opacity = 1 - time / particle.maxLife
        },
      })
    }
    const dust = take(
      'dust',
      () => createMesh('dust', new THREE.MeshBasicMaterial({ color: 0xd79979, transparent: true }))
    )
    dust.position.copy(pos)
    dust.scale.setScalar(0.1)
    dust.material.opacity = 0.5
    addParticle({
      mesh: dust,
      poolType: 'dust',
      type: 'dust',
      life: effectsConfig.dustLife,
      maxLife: effectsConfig.dustLife,
      update: (dt, time, particle) => {
        particle.mesh.material.opacity = (1 - time / particle.maxLife) * 0.5
        particle.mesh.scale.setScalar(0.1 * (1 + time * 4))
      },
    })
  }

  function spawnBlood(pos) {
    for (let i = 0; i < effectsConfig.bloodCount; i++) {
      const blood = take(
        'blood',
        () => createMesh('blood', new THREE.MeshBasicMaterial({ color: 0xe83f5b }))
      )
      blood.position.copy(pos)
      blood.scale.setScalar(0.025)
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 3,
        Math.random() * 2,
        (Math.random() - 0.5) * 3
      )
      addParticle({
        mesh: blood,
        poolType: 'blood',
        type: 'blood',
        life: effectsConfig.bloodLife,
        maxLife: effectsConfig.bloodLife,
        vel: velocity,
        update: (dt, time, particle) => {
          particle.vel.y -= effectsConfig.bloodGravity * dt
          particle.mesh.position.addScaledVector(particle.vel, dt)
          if (particle.mesh.position.y < 0.02) {
            particle.mesh.position.y = 0.02
            particle.vel.set(0, 0, 0)
          }
        },
      })
    }
  }

  return { update, addTracer, spawnMuzzleFlash, spawnShell, spawnSmokePuff, spawnSpark, spawnBlood }
}
