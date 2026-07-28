import * as THREE from 'three'
import { getObstacleNormal, sweepSphereObstacle } from './collision.js'

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
        particle.onComplete?.(particle)
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
    const coreOffset = firstPerson ? 0.04 : 0.08
    const coreScale = firstPerson ? 0.065 : 0.11
    const flareOffset = firstPerson ? 0.11 : 0.15
    const flareRadius = firstPerson ? 0.055 : 0.1
    const flareHeight = firstPerson ? 0.18 : 0.26
    const sideOffset = firstPerson ? 0.02 : 0.05
    const sideScale = firstPerson ? 0.085 : 0.128
    const sideThickness = firstPerson ? 0.025 : 0.037
    const smokeOpacity = effectsConfig.muzzleSmokeOpacity
    const core = take(
      'core',
      () => createMesh('core', new THREE.MeshBasicMaterial({ color: 0xfff6d0, transparent: true }))
    )
    core.position.copy(pos).addScaledVector(direction, coreOffset)
    core.scale.setScalar(coreScale)
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
    flare.position.copy(pos).addScaledVector(direction, flareOffset)
    flare.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction)
    flare.scale.set(flareRadius, flareHeight, flareRadius)

    const side = take(
      'side',
      () => createMesh('side', new THREE.MeshBasicMaterial({ color: 0xffc45a, transparent: true }))
    )
    side.position.copy(pos).addScaledVector(direction, sideOffset)
    side.scale.set(sideScale, sideThickness, sideThickness)
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
        core.scale.setScalar(coreScale * (0.65 + (1 - progress) * 2.0))
        flare.material.opacity = progress * 0.8
        flare.scale.set(
          flareRadius * (0.8 + (1 - progress) * 1.55),
          flareHeight * (0.8 + (1 - progress) * 1.55),
          flareRadius * (0.8 + (1 - progress) * 1.55)
        )
        side.material.opacity = progress * 0.75
        side.scale.set(
          sideScale * (1.7 + (1 - progress) * 1.1),
          sideThickness * (0.5 + (1 - progress) * 0.45),
          sideThickness * (0.5 + (1 - progress) * 0.45)
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
      puff.material.opacity = smokeOpacity
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
          particle.mesh.material.opacity = (1 - time / particle.maxLife) * smokeOpacity
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
    puff.material.opacity = effectsConfig.muzzleSmokeOpacity
    addParticle({
      mesh: puff,
      poolType: 'smoke',
      type: 'smoke',
      life: effectsConfig.smokePuffLife,
      maxLife: effectsConfig.smokePuffLife,
      update: (dt, time, particle) => {
        particle.mesh.material.opacity =
          (1 - time / particle.maxLife) * effectsConfig.muzzleSmokeOpacity
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

  function stickParticle(particle, normal) {
    if (normal) particle.mesh.position.addScaledVector(normal, 0.02)
    particle.vel.set(0, 0, 0)
    particle.stuck = true
    return true
  }

  function simulateThrownBody(dt, particle, radius, options = {}) {
    const bounce = options.bounce ?? config.grenade.bounce
    const stick = !!options.stick
    particle.vel.y -= config.grenade.gravity * dt
    const previous = particle.mesh.position.clone()
    const next = previous.clone().addScaledVector(particle.vel, dt)
    let obstacleHit = null
    let obstacleHitTime = Infinity
    for (const obstacle of state.obstacles) {
      if (obstacle.type === 'ground' || obstacle.type === 'crater') continue
      const hitTime = sweepSphereObstacle(previous, next, radius, obstacle)
      if (hitTime == null || hitTime >= obstacleHitTime) continue
      obstacleHit = obstacle
      obstacleHitTime = hitTime
    }

    const previousGround = state.groundHeightAt(previous.x, previous.z) + radius
    const nextGround = state.groundHeightAt(next.x, next.z) + radius
    let groundHitTime = Infinity
    if (previous.y <= previousGround + 0.002 && particle.vel.y <= 0) groundHitTime = 0
    else if (next.y <= nextGround) {
      const distance = previous.y - previousGround - (next.y - nextGround)
      groundHitTime =
        distance > 1e-6
          ? THREE.MathUtils.clamp((previous.y - previousGround) / distance, 0, 1)
          : 0
    }

    if (groundHitTime < Infinity && groundHitTime <= obstacleHitTime) {
      particle.mesh.position.copy(previous).lerp(next, groundHitTime)
      particle.mesh.position.y =
        state.groundHeightAt(particle.mesh.position.x, particle.mesh.position.z) + radius
      if (stick) return stickParticle(particle)
      particle.vel.y = Math.abs(particle.vel.y) * bounce
      particle.vel.x *= 0.68
      particle.vel.z *= 0.68
      return false
    }

    if (obstacleHit) {
      particle.mesh.position.copy(previous).lerp(next, obstacleHitTime)
      const normalData = getObstacleNormal(particle.mesh.position, obstacleHit, particle.vel)
      const normal = new THREE.Vector3(normalData.x, normalData.y, normalData.z)
      if (stick) return stickParticle(particle, normal)
      if (particle.vel.dot(normal) < 0) particle.vel.reflect(normal).multiplyScalar(0.62)
      particle.mesh.position.addScaledVector(normal, 0.004)
      return false
    }

    particle.mesh.position.copy(next)
    return false
  }

  function spawnThrownGrenade(origin, velocity, grenade, onDetonate) {
    const radius = 0.09
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 8, 6),
      new THREE.MeshToonMaterial({
        color: grenade.color,
      })
    )
    mesh.position.copy(origin)
    addParticle({
      mesh,
      type: 'grenade',
      life: grenade.fuse,
      maxLife: grenade.fuse,
      vel: velocity.clone(),
      update: (dt, time, particle) => {
        simulateThrownBody(dt, particle, radius)
        particle.mesh.rotation.x += dt * 9
        particle.mesh.rotation.z += dt * 7
      },
      onComplete: () => onDetonate(mesh.position.clone()),
    })
  }

  function spawnThrownC4(origin, velocity, secondary) {
    const radius = 0.11
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.1, 0.14),
      new THREE.MeshToonMaterial({ color: secondary.color })
    )
    mesh.position.copy(origin)
    const charge = {
      mesh,
      secondary,
      position: mesh.position,
      particle: null,
      active: true,
    }
    const particle = {
      mesh,
      type: 'c4',
      life: 120,
      maxLife: 120,
      vel: velocity.clone(),
      stuck: false,
      update: (dt, time, particleState) => {
        if (!charge.active) {
          particleState.life = 0
          return
        }
        if (particleState.stuck) {
          particleState.life = particleState.maxLife
          return
        }
        if (!simulateThrownBody(dt, particleState, radius, { stick: true })) {
          particleState.mesh.rotation.x += dt * 8
          particleState.mesh.rotation.z += dt * 6
        }
      },
    }
    charge.particle = particle
    addParticle(particle)
    return charge
  }

  function removeCharge(charge) {
    charge.active = false
    charge.particle.life = 0
  }

  function createRocketMesh(color) {
    const rocket = new THREE.Group()
    const bodyMat = new THREE.MeshToonMaterial({ color })
    const noseMat = new THREE.MeshToonMaterial({ color: 0x2f3528 })
    // 本地朝向 -Z，与相机前向一致。
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.36, 8), bodyMat)
    body.rotation.x = Math.PI / 2
    rocket.add(body)
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.14, 8), noseMat)
    nose.rotation.x = -Math.PI / 2
    nose.position.z = -0.22
    rocket.add(nose)
    return rocket
  }

  function orientRocket(mesh, direction) {
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), direction)
  }

  function spawnRocket(origin, velocity, secondary, muzzle, onHit) {
    const radius = 0.08
    const mesh = createRocketMesh(secondary.color)
    mesh.position.copy(muzzle || origin)
    const direction = velocity.clone().normalize()
    orientRocket(mesh, direction)
    let hitPosition = null
    addParticle({
      mesh,
      type: 'rocket',
      life: 4,
      maxLife: 4,
      vel: velocity.clone(),
      update: (dt, time, particle) => {
        const previous = particle.mesh.position.clone()
        const next = previous.clone().addScaledVector(particle.vel, dt)
        let hitTime = Infinity
        for (const obstacle of state.obstacles) {
          if (obstacle.type === 'ground' || obstacle.type === 'crater') continue
          const t = sweepSphereObstacle(previous, next, radius, obstacle)
          if (t != null && t < hitTime) hitTime = t
        }
        for (const actor of state.actors) {
          if (!actor.alive) continue
          for (const hitbox of actor.getHitboxes()) {
            const t = sweepSphereObstacle(previous, next, radius, hitbox)
            if (t != null && t < hitTime) hitTime = t
          }
        }
        const previousGround = state.groundHeightAt(previous.x, previous.z) + radius
        const nextGround = state.groundHeightAt(next.x, next.z) + radius
        if (next.y <= nextGround) {
          const distance = previous.y - previousGround - (next.y - nextGround)
          const groundHitTime =
            distance > 1e-6
              ? THREE.MathUtils.clamp((previous.y - previousGround) / distance, 0, 1)
              : 0
          if (groundHitTime < hitTime) hitTime = groundHitTime
        }
        if (hitTime < Infinity) {
          particle.mesh.position.copy(previous).lerp(next, hitTime)
          hitPosition = particle.mesh.position.clone()
          particle.life = 0
          return
        }
        particle.mesh.position.copy(next)
        orientRocket(particle.mesh, particle.vel.clone().normalize())
      },
      onComplete: () => onHit((hitPosition || mesh.position).clone()),
    })
  }

  function spawnExplosion(position, radius) {
    const r = Math.max(0.5, radius)
    const origin = position.clone()
    origin.y = Math.max(0.55, position.y)

    // 核心白亮闪光 → 约 0.45r
    const core = new THREE.Mesh(
      geometry.core,
      new THREE.MeshBasicMaterial({ color: 0xfff4b0, transparent: true, depthWrite: false })
    )
    const coreStart = r * 0.04
    const coreEnd = r * 0.45
    core.position.copy(origin)
    core.scale.setScalar(coreStart)
    addParticle({
      mesh: core,
      type: 'explosion',
      life: 0.26,
      maxLife: 0.26,
      update: (dt, time, particle) => {
        const p = time / particle.maxLife
        particle.mesh.scale.setScalar(coreStart + (coreEnd - coreStart) * Math.min(1, p * 2.4))
        particle.mesh.material.opacity = Math.max(0, 1 - p * 1.35)
      },
    })

    // 外层火球 → 约 1.0r
    const fireball = new THREE.Mesh(
      geometry.side,
      new THREE.MeshBasicMaterial({ color: 0xff7a28, transparent: true, depthWrite: false })
    )
    const fireStart = r * 0.06
    const fireEnd = r
    fireball.position.copy(origin)
    fireball.scale.setScalar(fireStart)
    addParticle({
      mesh: fireball,
      type: 'explosion',
      life: 0.58,
      maxLife: 0.58,
      update: (dt, time, particle) => {
        const p = time / particle.maxLife
        particle.mesh.scale.setScalar(fireStart + (fireEnd - fireStart) * Math.pow(p, 0.5))
        particle.mesh.material.opacity = Math.max(0, 0.92 * (1 - p) * (1 - p * 0.3))
        particle.mesh.material.color.setHex(p < 0.4 ? 0xff7a28 : 0x5c4634)
      },
    })

    // 短促点光
    const light = take('light', () => new THREE.PointLight(0xffa040, 0, 8))
    light.visible = true
    light.position.copy(origin)
    light.distance = r * 2.4
    const lightIntensity = 0.55 * r
    light.intensity = lightIntensity
    addParticle({
      mesh: light,
      poolType: 'light',
      type: 'explosion-light',
      life: 0.32,
      maxLife: 0.32,
      update: (dt, time, particle) => {
        const p = time / particle.maxLife
        particle.mesh.intensity = lightIntensity * (1 - p) * (1 - p)
      },
    })

    // 高速火花：飞散距离约 0.8r
    for (let i = 0; i < 18; i++) {
      const spark = take(
        'spark',
        () => createMesh('spark', new THREE.MeshBasicMaterial({ color: 0xffaa30, transparent: true }))
      )
      const sparkScale = r * (0.002 + Math.random() * 0.002)
      spark.position.copy(origin)
      spark.scale.setScalar(sparkScale)
      spark.material.opacity = 1
      spark.material.color.setHex(Math.random() < 0.35 ? 0xfff0a0 : 0xff8a30)
      const speed = r * (1.2 + Math.random() * 1.8)
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        0.2 + Math.random() * 1.4,
        (Math.random() - 0.5) * 2
      )
        .normalize()
        .multiplyScalar(speed)
      const life = 0.35 + Math.random() * 0.45
      addParticle({
        mesh: spark,
        poolType: 'spark',
        type: 'explosion-spark',
        life,
        maxLife: life,
        vel,
        update: (dt, time, particle) => {
          particle.vel.y -= 10 * dt
          particle.mesh.position.addScaledVector(particle.vel, dt)
          particle.vel.multiplyScalar(0.97)
          particle.mesh.material.opacity = 1 - time / particle.maxLife
          particle.mesh.scale.setScalar(sparkScale * (1 - time / particle.maxLife * 0.5))
        },
      })
    }

    // 外扩烟团：扩散到约 1.1r
    for (let i = 0; i < 10; i++) {
      const smoke = take(
        'smoke',
        () =>
          createMesh(
            'smoke',
            new THREE.MeshBasicMaterial({
              color: 0x7a6a58,
              transparent: true,
              depthWrite: false,
            })
          )
      )
      const angle = (i / 10) * Math.PI * 2 + Math.random() * 0.45
      const dist = r * (0.12 + Math.random() * 0.28)
      smoke.position.set(
        origin.x + Math.cos(angle) * dist,
        origin.y + r * Math.random() * 0.06,
        origin.z + Math.sin(angle) * dist
      )
      smoke.material.color.setHex(Math.random() < 0.4 ? 0x6a5a48 : 0x8c8070)
      const baseScale = r * (0.05 + Math.random() * 0.06)
      smoke.scale.setScalar(baseScale)
      smoke.material.opacity = 0.5
      const speed = r * (0.45 + Math.random() * 0.55)
      const outward = new THREE.Vector3(
        Math.cos(angle) * speed,
        r * (0.12 + Math.random() * 0.18),
        Math.sin(angle) * speed
      )
      const maxLife = 0.9 + Math.random() * 0.6
      addParticle({
        mesh: smoke,
        poolType: 'smoke',
        type: 'explosion-smoke',
        life: maxLife,
        maxLife,
        vel: outward,
        update: (dt, time, particle) => {
          const p = time / particle.maxLife
          particle.mesh.position.addScaledVector(particle.vel, dt)
          particle.vel.multiplyScalar(0.91)
          particle.vel.y += dt * r * 0.08
          particle.mesh.material.opacity = 0.5 * (1 - p)
          particle.mesh.scale.setScalar(baseScale * (1 + p * 3.6))
        },
      })
    }

    // 地面尘土环：外推到约 1.0r
    for (let i = 0; i < 8; i++) {
      const dust = take(
        'dust',
        () => createMesh('dust', new THREE.MeshBasicMaterial({ color: 0xc4a078, transparent: true }))
      )
      const angle = (i / 8) * Math.PI * 2 + Math.random() * 0.4
      dust.position.set(origin.x, Math.max(0.12, origin.y * 0.25), origin.z)
      const dustStart = r * 0.025
      dust.scale.setScalar(dustStart)
      dust.material.opacity = 0.48
      const speed = r * (0.9 + Math.random() * 0.35)
      const vel = new THREE.Vector3(
        Math.cos(angle) * speed,
        r * (0.05 + Math.random() * 0.1),
        Math.sin(angle) * speed
      )
      addParticle({
        mesh: dust,
        poolType: 'dust',
        type: 'explosion-dust',
        life: 0.75,
        maxLife: 0.75,
        vel,
        update: (dt, time, particle) => {
          const p = time / particle.maxLife
          particle.mesh.position.addScaledVector(particle.vel, dt)
          particle.vel.multiplyScalar(0.88)
          particle.mesh.material.opacity = 0.48 * (1 - p)
          particle.mesh.scale.setScalar(dustStart + r * 0.14 * p)
        },
      })
    }
  }

  function spawnSmokeCloud(position, radius, duration) {
    const puffCount = effectsConfig.smokeCloudPuffCount
    // 随机拉伸轴，让整体烟雾团略不规则
    const stretchAngle = Math.random() * Math.PI * 2
    const stretchX = Math.cos(stretchAngle)
    const stretchZ = Math.sin(stretchAngle)
    const stretch = 0.65 + Math.random() * 0.7
    for (let i = 0; i < puffCount; i++) {
      const smoke = new THREE.Mesh(
        geometry.smoke,
        new THREE.MeshBasicMaterial({
          color: Math.random() < 0.35 ? 0x9bdbe1 : 0xd5e6df,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        })
      )
      const angle = Math.random() * Math.PI * 2
      const distance = radius * Math.sqrt(Math.random()) * (0.45 + Math.random() * 0.55)
      let ox = Math.cos(angle) * distance
      let oz = Math.sin(angle) * distance
      const along = ox * stretchX + oz * stretchZ
      const acrossX = ox - along * stretchX
      const acrossZ = oz - along * stretchZ
      ox = along * stretchX * stretch + acrossX / Math.max(stretch, 0.5)
      oz = along * stretchZ * stretch + acrossZ / Math.max(stretch, 0.5)
      smoke.position.set(
        position.x + ox,
        position.y + 0.3 + Math.random() * 2.0,
        position.z + oz
      )
      const scaleX = 0.6 + Math.random() * 1.0
      const scaleY = 0.5 + Math.random() * 0.95
      const scaleZ = 0.6 + Math.random() * 1.0
      smoke.scale.set(scaleX, scaleY, scaleZ)
      smoke.rotation.set(
        (Math.random() - 0.5) * 0.8,
        Math.random() * Math.PI * 2,
        (Math.random() - 0.5) * 0.8
      )
      const rise = 0.012 + Math.random() * 0.03
      const spin = 0.04 + Math.random() * 0.1
      addParticle({
        mesh: smoke,
        type: 'grenade-smoke',
        life: duration,
        maxLife: duration,
        update: (dt, time, particle) => {
          const fadeIn = Math.min(1, time / 1.2)
          const fadeOut = Math.min(1, particle.life / 2)
          particle.mesh.material.opacity = effectsConfig.smokeCloudOpacity * fadeIn * fadeOut
          particle.mesh.position.y += dt * rise
          particle.mesh.rotation.y += dt * spin
          const grow = 1 + Math.min(time, 4) * 0.08
          particle.mesh.scale.set(scaleX * grow, scaleY * grow, scaleZ * grow)
        },
      })
    }
  }

  return {
    update,
    addTracer,
    spawnMuzzleFlash,
    spawnShell,
    spawnSmokePuff,
    spawnSpark,
    spawnBlood,
    spawnThrownGrenade,
    spawnThrownC4,
    spawnRocket,
    removeCharge,
    spawnExplosion,
    spawnSmokeCloud,
  }
}
