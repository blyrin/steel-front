import * as THREE from 'three'

export function createEffectsSystem({ scene, state, audio }) {
  function update(dt) {
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const particle = state.particles[i]
      particle.life -= dt
      if (particle.life <= 0) {
        scene.remove(particle.mesh)
        particle.onComplete?.()
        state.particles.splice(i, 1)
      } else {
        particle.update?.(dt, particle.maxLife - particle.life, particle)
      }
    }
  }

  function addTracer(origin, end) {
    const geometry = new THREE.BufferGeometry().setFromPoints([origin, end])
    const material = new THREE.LineBasicMaterial({
      color: 0xffcc66,
      transparent: true,
      opacity: 0.6,
    })
    const tracer = new THREE.Line(geometry, material)
    scene.add(tracer)
    state.particles.push({
      mesh: tracer,
      type: 'tracer',
      life: 0.05,
      maxLife: 0.05,
      update: () => {
        material.opacity *= 0.85
      },
    })
  }

  function spawnMuzzleFlash(pos, dir, firstPerson = false) {
    const direction = dir.clone().normalize()
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(firstPerson ? 0.07 : 0.12, 6, 4),
      new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.95 })
    )
    core.position.copy(pos).addScaledVector(direction, firstPerson ? 0.04 : 0.08)
    scene.add(core)
    const flare = new THREE.Mesh(
      new THREE.ConeGeometry(firstPerson ? 0.05 : 0.09, firstPerson ? 0.16 : 0.22, 6, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xffa040,
        transparent: true,
        opacity: 0.75,
        side: THREE.DoubleSide,
      })
    )
    flare.position.copy(pos).addScaledVector(direction, firstPerson ? 0.1 : 0.14)
    flare.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction)
    scene.add(flare)
    const side = new THREE.Mesh(
      new THREE.SphereGeometry(firstPerson ? 0.045 : 0.07, 5, 3),
      new THREE.MeshBasicMaterial({ color: 0xffcc66, transparent: true, opacity: 0.7 })
    )
    side.position.copy(pos).addScaledVector(direction, firstPerson ? 0.02 : 0.05)
    side.scale.set(1.6, 0.55, 0.55)
    scene.add(side)
    const light = new THREE.PointLight(0xffaa40, firstPerson ? 2.2 : 3.2, firstPerson ? 4 : 6)
    light.position.copy(pos)
    scene.add(light)
    const life = firstPerson ? 0.045 : 0.055
    state.particles.push({
      mesh: core,
      type: 'flash',
      life,
      maxLife: life,
      update: (dt, time) => {
        const progress = 1 - time / life
        core.material.opacity = progress * 0.95
        core.scale.setScalar(0.7 + (1 - progress) * 1.8)
        flare.material.opacity = progress * 0.75
        flare.scale.setScalar(0.85 + (1 - progress) * 1.4)
        side.material.opacity = progress * 0.7
        side.scale.set(
          1.6 + (1 - progress),
          0.55 + (1 - progress) * 0.4,
          0.55 + (1 - progress) * 0.4
        )
        light.intensity = progress * (firstPerson ? 2.2 : 3.2)
      },
      onComplete: () => {
        scene.remove(light)
        scene.remove(flare)
        scene.remove(side)
      },
    })

    const count = firstPerson ? 2 : 3
    for (let i = 0; i < count; i++) {
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(0.04, 4, 3),
        new THREE.MeshBasicMaterial({
          color: 0xc8b8a8,
          transparent: true,
          opacity: firstPerson ? 0.18 : 0.35,
        })
      )
      puff.position.copy(pos).addScaledVector(direction, 0.08 + i * 0.04)
      scene.add(puff)
      const velocity = direction
        .clone()
        .multiplyScalar(0.6 + Math.random() * 0.4)
        .add(
          new THREE.Vector3(
            (Math.random() - 0.5) * 0.35,
            0.15 + Math.random() * 0.25,
            (Math.random() - 0.5) * 0.35
          )
        )
      const maxLife = 0.35 + i * 0.08
      state.particles.push({
        mesh: puff,
        type: 'smoke',
        life: maxLife,
        maxLife,
        vel: velocity,
        update: (dt, time, particle) => {
          particle.mesh.position.addScaledVector(particle.vel, dt)
          particle.vel.multiplyScalar(0.92)
          particle.mesh.material.opacity =
            (1 - time / particle.maxLife) * (firstPerson ? 0.18 : 0.35)
          particle.mesh.scale.setScalar(1 + time * 2.4)
        },
      })
    }
  }

  function spawnShell(pos, right = null, up = null) {
    const shell = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.007, 0.028, 6),
      new THREE.MeshStandardMaterial({ color: 0xc0a040, metalness: 0.85, roughness: 0.28 })
    )
    shell.position.copy(pos)
    shell.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI)
    scene.add(shell)
    const rightAxis = right ? right.clone().normalize() : new THREE.Vector3(1, 0, 0)
    const upAxis = up ? up.clone().normalize() : new THREE.Vector3(0, 1, 0)
    const forward = new THREE.Vector3().crossVectors(upAxis, rightAxis).normalize()
    const velocity = rightAxis
      .multiplyScalar(2.2 + Math.random() * 0.9)
      .addScaledVector(upAxis, 1.4 + Math.random() * 0.7)
      .addScaledVector(forward, -0.3 + Math.random() * 0.4)
    let landed = false
    state.particles.push({
      mesh: shell,
      type: 'shell',
      life: 1.4,
      maxLife: 1.4,
      vel: velocity,
      rotVel: new THREE.Vector3(
        8 + Math.random() * 10,
        6 + Math.random() * 8,
        4 + Math.random() * 6
      ),
      update: (dt, time, particle) => {
        particle.vel.y -= 9.8 * dt
        particle.mesh.position.addScaledVector(particle.vel, dt)
        particle.mesh.rotation.x += particle.rotVel.x * dt
        particle.mesh.rotation.y += particle.rotVel.y * dt
        particle.mesh.rotation.z += particle.rotVel.z * dt
        if (particle.mesh.position.y < 0.02) {
          if (!landed) {
            landed = true
            if (Math.random() < 0.4) audio.shellDrop(particle.mesh.position)
          }
          particle.mesh.position.y = 0.02
          particle.vel.y *= -0.28
          particle.vel.x *= 0.65
          particle.vel.z *= 0.65
          particle.rotVel.multiplyScalar(0.6)
        }
      },
    })
  }

  function spawnSmokePuff(pos) {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 4, 3),
      new THREE.MeshBasicMaterial({ color: 0xb0a090, transparent: true, opacity: 0.12 })
    )
    puff.position.copy(pos)
    scene.add(puff)
    state.particles.push({
      mesh: puff,
      type: 'smoke',
      life: 0.55,
      maxLife: 0.55,
      update: (dt, time, particle) => {
        particle.mesh.material.opacity = (1 - time / 0.55) * 0.12
        particle.mesh.scale.setScalar(1 + time * 2.6)
        particle.mesh.position.y += dt * 0.18
      },
    })
  }

  function spawnSpark(pos, dir) {
    for (let i = 0; i < 6; i++) {
      const spark = new THREE.Mesh(
        new THREE.SphereGeometry(0.015, 4, 3),
        new THREE.MeshBasicMaterial({ color: 0xffaa30, transparent: true })
      )
      spark.position.copy(pos)
      scene.add(spark)
      const velocity = dir
        .clone()
        .multiplyScalar(-1)
        .add(
          new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 2, (Math.random() - 0.5) * 2)
        )
        .multiplyScalar(2)
      state.particles.push({
        mesh: spark,
        type: 'spark',
        life: 0.3,
        maxLife: 0.3,
        vel: velocity,
        update: (dt, time, particle) => {
          particle.vel.y -= 6 * dt
          particle.mesh.position.addScaledVector(particle.vel, dt)
          particle.mesh.material.opacity = 1 - time / 0.3
        },
      })
    }
    const dust = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 4, 3),
      new THREE.MeshBasicMaterial({ color: 0xa09080, transparent: true, opacity: 0.5 })
    )
    dust.position.copy(pos)
    scene.add(dust)
    state.particles.push({
      mesh: dust,
      type: 'dust',
      life: 0.5,
      maxLife: 0.5,
      update: (dt, time, particle) => {
        particle.mesh.material.opacity = (1 - time / 0.5) * 0.5
        particle.mesh.scale.setScalar(1 + time * 4)
      },
    })
  }

  function spawnBlood(pos) {
    for (let i = 0; i < 10; i++) {
      const blood = new THREE.Mesh(
        new THREE.SphereGeometry(0.025, 4, 3),
        new THREE.MeshBasicMaterial({ color: 0x8a1010 })
      )
      blood.position.copy(pos)
      scene.add(blood)
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 3,
        Math.random() * 2,
        (Math.random() - 0.5) * 3
      )
      state.particles.push({
        mesh: blood,
        type: 'blood',
        life: 0.8,
        maxLife: 0.8,
        vel: velocity,
        update: (dt, time, particle) => {
          particle.vel.y -= 9 * dt
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
