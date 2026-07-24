export const CFG = {
  // 通用对局参数，时间单位为秒。
  match: {
    // 固定模拟频率。
    tickRate: 60,
    // 单次渲染帧最多累积的模拟时间，避免切后台后瞬移。
    maxFrameDelta: 0.05,
    // 启动加载阶段的相机高度。
    initialCameraHeight: 5,
  },
  // 各模式的规则参数。实体和系统不直接读取这里的模式分支。
  modes: {
    classic: {
      // 每支队伍的人数，包含玩家所在队伍的玩家。
      teamSize: 20,
      // 任一队伍达到该击杀数后结束比赛。
      killTarget: 150,
      // Bot 阵亡后的复活等待时间。
      respawnTime: 5,
      // Bot 出生点周围的随机散布范围。
      spawnScatter: 4,
    },
    zombie: {
      // 玩家之外的盟军 AI 数量。
      alliedBotCount: 7,
      // 盟军 AI 定时复活等待时间。
      alliedRespawnTime: 8,
      // 盟军出生点和敌方生成点的随机散布范围。
      spawnScatter: 3,
      // 第一波丧尸数量、每波增量和生成节奏。
      waveStartCount: 32,
      waveIncrement: 8,
      waveSpawnInterval: 0.5,
      waveIntermission: 10,
      // 同时存活的丧尸上限。
      maxConcurrent: 128,
      // 盟军 AI 的活动范围中心与半径。
      guardRadius: 28,
      fortress: {
        x: 0,
        z: 0,
        maxHealth: 2000,
        radius: 16,
        attackRadius: 11,
        bottomRadius: 21,
        topRadius: 11,
        deckHeight: 4.2,
      },
      enemy: {
        maxHealth: 100,
        speed: 3.2,
        radius: 0.46,
        attackRange: 2.0,
        targetSearchRadius: 42,
        // 丧尸响应附近同类追击目标的范围。
        reinforcementRadius: 24,
        // 丧尸主动重新选择目标的间隔。
        perceptionInterval: 0.16,
        // 丧尸丢失人类后的追踪记忆时间。
        targetMemory: 1.5,
        // 新目标至少近多少米才会打断当前追踪，避免目标抖动。
        targetSwitchBias: 2.4,
        // 丧尸听到玩家开火声的最大距离与记忆时间。
        playerShotHearingDistance: 64,
        playerShotMemory: 3.5,
        // 丧尸局部绕障和同类分离参数。
        movementLookAhead: 2.4,
        movementProbeAngle: 0.72,
        separationDistance: 1.15,
        separationWeight: 1.25,
        stuckTimeout: 0.65,
        stuckDistance: 0.22,
        attackInterval: 1.1,
        attackDamage: 12,
      },
    },
  },
  // 菜单和暂停界面中的玩家设置默认值。
  settings: {
    // 主音量，范围通常为 0 到 1。
    masterVolume: 0.65,
    // 鼠标和触摸视角灵敏度倍率。
    mouseSensitivity: 1,
  },
  // 武器和射击手感参数。
  weapon: {
    // 弹匣、备弹、换弹和攻击间隔。
    // 每个弹匣的弹药数量。
    magazineSize: 8,
    // 玩家初始备用弹药数量。
    reserveAmmo: 96,
    // 非空弹匣的换弹时长。
    reloadDuration: 1.75,
    // 打空弹匣后的换弹时长。
    emptyReloadDuration: 1.55,
    // 两次射击之间的最短间隔。
    fireDelay: 0.15,
    // 打空弹匣后自动开始换弹的延迟。
    emptyReloadDelay: 0.42,
    // 刺刀攻击动画时长。
    meleeAnimationDuration: 0.58,
    // 枪机往复动画时长。
    boltAnimationDuration: 0.36,
    // 两次近战攻击之间的最短间隔。
    meleeDelay: 0.72,
    // 近战判定距离。
    meleeRange: 2.55,
    // 近战命中伤害。
    meleeDamage: 100,
    // 散布值是方向向量偏移量，越大越不准。
    // 玩家静止时的基础射击散布。
    baseSpread: 0.005,
    // 射击散布的最大值。
    maxSpread: 0.08,
    // 连续射击额外散布的上限。
    spreadBloomMax: 0.02,
    // 连续射击散布每秒恢复量。
    spreadBloomRecovery: 0.04,
    // 玩家每次非瞄准射击增加的散布。
    spreadBloomPerShot: 0.005,
    // 玩家瞄准射击每次增加的散布。
    aimedSpreadBloomPerShot: 0.004,
    // 瞄准时的散布倍率。
    aimingSpreadMultiplier: 0.28,
    // 蹲伏时的散布倍率。
    crouchingSpreadMultiplier: 0.65,
    // 冲刺时的散布倍率。
    sprintingSpreadMultiplier: 2.6,
    // 普通移动时的散布倍率。
    movingSpreadMultiplier: 1.6,
    // 离地时的散布倍率。
    airborneSpreadMultiplier: 1.8,
    // 换弹状态下的散布倍率。
    reloadingSpreadMultiplier: 1.35,
    // 玩家开始计算移动散布的速度阈值。
    playerMovingThreshold: 0.4,
    // 玩家射击时的后坐力和屏幕震动。
    // 玩家腰射的垂直后坐力。
    hipRecoilPitch: 0.02,
    // 玩家瞄准时的垂直后坐力。
    aimingRecoilPitch: 0.01,
    // 每次射击附加的随机垂直后坐力。
    recoilPitchRandom: 0.005,
    // 玩家腰射的水平后坐力。
    hipRecoilYaw: 0.01,
    // 玩家瞄准时的水平后坐力。
    aimingRecoilYaw: 0.004,
    // 玩家腰射的横滚后坐力。
    hipRecoilRoll: 0.015,
    // 玩家瞄准时的横滚后坐力。
    aimingRecoilRoll: 0.008,
    // 开镜时枪模额外机械后坐相对实际视角后坐的倍率。
    aimingViewModelRecoilMultiplier: 0.22,
    // 玩家腰射时的屏幕震动强度。
    hipFireShake: 0.15,
    // 玩家瞄准射击时的屏幕震动强度。
    aimingFireShake: 0.08,
  },
  // 可在部署界面选择的主武器。高射速武器以远距衰减和散布换取近战压制力。
  weapons: {
    garand: {
      modelId: 'garand',
      name: 'M1 加兰德',
      fireMode: '半自动',
      automatic: false,
      magazineSize: 8,
      reserveAmmo: 80,
      fireDelay: 0.18,
      reloadDuration: 1.75,
      emptyReloadDuration: 1.55,
      bodyDamage: 35,
      headDamage: 100,
      effectiveRange: 72,
      minDamageMultiplier: 0.78,
      baseSpread: 0.005,
      spreadBloomPerShot: 0.005,
      aimedSpreadBloomPerShot: 0.004,
      recoilMultiplier: 1,
      modelScale: [1, 1, 1],
      bayonet: true,
    },
    shotgun: {
      modelId: 'shotgun',
      name: 'M1897 霰弹枪',
      fireMode: '泵动',
      automatic: false,
      magazineSize: 5,
      reserveAmmo: 45,
      fireDelay: 0.8,
      reloadDuration: 2.1,
      emptyReloadDuration: 2.35,
      bodyDamage: 17,
      headDamage: 24,
      effectiveRange: 24,
      minDamageMultiplier: 0.35,
      baseSpread: 0.032,
      spreadBloomPerShot: 0.005,
      aimedSpreadBloomPerShot: 0.008,
      recoilMultiplier: 1.2,
      modelScale: [1.02, 1.02, 1.02],
      bayonet: false,
      pellets: 8,
    },
    thompson: {
      modelId: 'thompson',
      name: 'M1A1 汤姆逊',
      fireMode: '全自动',
      automatic: true,
      magazineSize: 30,
      reserveAmmo: 120,
      fireDelay: 0.095,
      reloadDuration: 2.15,
      emptyReloadDuration: 2.35,
      bodyDamage: 20,
      headDamage: 58,
      effectiveRange: 28,
      minDamageMultiplier: 0.5,
      baseSpread: 0.011,
      spreadBloomPerShot: 0.004,
      aimedSpreadBloomPerShot: 0.004,
      recoilMultiplier: 0.7,
      modelScale: [1.02, 1.02, 1.02],
      bayonet: true,
    },
    bar: {
      modelId: 'bar',
      name: 'M1918 BAR',
      fireMode: '全自动',
      automatic: true,
      magazineSize: 20,
      reserveAmmo: 80,
      fireDelay: 0.12,
      reloadDuration: 2.45,
      emptyReloadDuration: 2.65,
      bodyDamage: 30,
      headDamage: 86,
      effectiveRange: 60,
      minDamageMultiplier: 0.72,
      baseSpread: 0.009,
      spreadBloomPerShot: 0.0045,
      aimedSpreadBloomPerShot: 0.005,
      recoilMultiplier: 0.96,
      modelScale: [1.04, 1.04, 1.04],
      bayonet: true,
    },
  },
  grenades: {
    frag: {
      name: 'MK II 破片手雷',
      kind: 'frag',
      count: 2,
      fuse: 2.6,
      throwSpeed: 22,
      radius: 12,
      damage: 110,
      color: 0x4f6f58,
    },
    smoke: {
      name: 'M18 烟雾弹',
      kind: 'smoke',
      count: 2,
      fuse: 1.4,
      throwSpeed: 21,
      radius: 8,
      duration: 12,
      color: 0x12b6d2,
    },
  },
  items: {
    medkit: {
      name: '急救包',
      kind: 'heal',
      uses: 1,
      amount: 50,
    },
    ammoPouch: {
      name: '携行弹药包',
      kind: 'ammo',
      uses: 1,
    },
  },
  loadout: {
    defaultWeapon: 'garand',
    defaultGrenade: 'frag',
    defaultItem: 'medkit',
  },
  grenade: {
    cooldown: 0.8,
    gravity: 13,
    throwLift: 0.14,
    bounce: 0.38,
    aiMinDistance: 6,
    aiMaxDistance: 42,
    aiThrowChancePerSecond: 0.55,
    aiSmokeChancePerSecond: 0.75,
    aiPredictionTime: 0.42,
    aiFriendlyFireRadius: 7,
    // AI 投掷时使用的目标行为和数量门槛。
    aiTargetAdvanceSpeed: 1.2,
    aiTargetFireMemory: 0.9,
    aiThreatPressureThreshold: 0.65,
    aiFragSingleTargetMaxDistance: 18,
    aiSmokeMinThreatCount: 2,
    aiSmokeMinDistance: 5,
    aiSmokeMaxDistance: 30,
    aiSmokeHealthThreshold: 62,
    aiSmokeSuppressionThreshold: 0.38,
    aiCooldownMin: 5,
    aiCooldownRange: 4,
  },
  supply: {
    interactRadius: 3.4,
    aiArrivalDistance: 2.7,
    cooldown: 8,
  },
  // 玩家生命、移动、视角和受击反馈参数。
  player: {
    // 玩家的最大生命值。
    maxHealth: 100,
    // 玩家移动碰撞半径。
    radius: 0.4,
    // 玩家站立时的高度。
    standHeight: 1.7,
    // 玩家蹲伏时的高度。
    crouchHeight: 1.1,
    // 玩家头部命中体相对半径倍率。
    headHitboxRadiusMultiplier: 0.78,
    // 玩家身体命中体顶部相对高度偏移。
    bodyHitboxHeightOffset: 0.22,
    // 玩家头部命中体底部相对高度偏移。
    headHitboxHeightOffset: 0.32,
    // 玩家普通移动速度。
    walkSpeed: 5.2,
    // 玩家蹲伏移动速度。
    crouchSpeed: 2.2,
    // 玩家冲刺速度。
    sprintSpeed: 9.5,
    // 玩家下落加速度。
    gravity: 18,
    // 玩家跳跃初速度。
    jumpVelocity: 6,
    // 玩家松开移动输入后的速度保留倍率。
    movementDamping: 0.8,
    // 玩家站立和蹲伏高度的过渡速度。
    crouchTransitionSpeed: 10,
    // 玩家每秒生命恢复量。
    healthRegen: 4,
    // 玩家默认视野角。
    baseFov: 60,
    // 玩家瞄准时的视野角。
    aimingFov: 50,
    // 玩家冲刺时的视野角。
    sprintingFov: 75,
    // 视角输入到相机旋转的基础倍率。
    lookSensitivity: 0.0011,
    // 瞄准时的视角灵敏度倍率。
    aimingLookMultiplier: 0.5,
    // 视角上下旋转距离垂直方向的保留角度。
    pitchLimit: 0.1,
    // 玩家受击时的基础垂直视角后坐力。
    damageRecoilPitchBase: 0.008,
    // 玩家受击后坐力随伤害增加的倍率。
    damageRecoilPitchScale: 0.00008,
    // 玩家受击时的水平视角扰动。
    damageRecoilYaw: 0.012,
    // 玩家受击时的横滚视角扰动。
    damageRecoilRoll: 0.01,
    // 玩家死亡后进入部署界面的等待时间。
    deathTimer: 3,
    // 玩家死亡镜头下沉动画时长。
    deathCameraDuration: 1,
    // 玩家死亡镜头下沉距离。
    deathCameraDrop: 0.8,
    // 玩家死亡镜头横滚幅度。
    deathCameraRoll: 0.3,
    // 玩家死亡镜头俯仰幅度。
    deathCameraPitch: 0.2,
    // 玩家死亡时播放痛苦音效的概率。
    deathPainChance: 0.45,
    // 玩家屏幕震动累积强度上限。
    shakeTraumaMax: 1,
    // 玩家屏幕震动强度每秒衰减量。
    shakeRecovery: 1.75,
    // 玩家死亡时的屏幕震动强度。
    deathShake: 0.4,
  },
  // Bot 视野、移动、战术状态和命中体参数。
  bot: {
    // Bot 最大生命值。
    maxHealth: 100,
    // Bot 移动碰撞半径。
    radius: 0.4,
    // Bot 技能值随机范围的下限。
    skillMin: 0.25,
    // Bot 技能值随机范围的宽度。
    skillRange: 0.35,
    // Bot 最大视野距离。
    viewDistance: 70,
    // Bot 两次主动扫描之间的时间，避免每帧重复遍历整张地图。
    perceptionInterval: 0.14,
    // 每次扫描最多进行精确视线检测的候选数。
    maxPerceptionTargets: 8,
    // 队友共享可疑目标的最大距离。
    communicationRadius: 38,
    // 队友共享情报的保留时间。
    sharedContactMemory: 2.4,
    // 导航网格单元边长。
    navigationCellSize: 4.5,
    // 单次寻路允许展开的最大节点数。
    navigationMaxSearchNodes: 900,
    // 导航路径重新计算的最短间隔。
    navigationRepathInterval: 0.45,
    // 直线路径检测缓存时长。
    navigationDirectCheckInterval: 0.18,
    // 导航路径点到达判定距离。
    navigationWaypointArrivalDistance: 1.7,
    // Bot 听到玩家开火声的最大距离。
    playerShotHearingDistance: 90,
    // Bot 根据玩家开火声搜索的最长时间。
    playerShotMemory: 4,
    // Bot 发现目标后的反应时间基准。
    reactionTime: 0.5,
    // 视野判定：前方夹角阈值、视线起点高度和最小侧视距离。
    // Bot 视野前方点积阈值。
    viewForwardThreshold: 0.3,
    // Bot 近距离目标允许绕过前方点积限制的距离。
    viewForwardMinDistance: 5,
    // Bot 视线检测起点高度。
    viewOriginHeight: 1.6,
    // Bot 射击和目标判断时使用的高度。
    targetHeight: 1,
    // Bot 巡逻区域相对地图半径的比例。
    patrolAreaRatio: 0.42,
    // Bot 到达巡逻点的判定距离。
    patrolArrivalDistance: 2,
    // Bot 巡逻速度。
    patrolSpeed: 2.9,
    // Bot 搜索目标时的移动速度。
    alertSpeed: 4.6,
    // Bot 到达搜索点的判定距离。
    alertArrivalDistance: 3,
    // Bot 丢失目标后转入搜索状态的等待时间。
    lostTargetTime: 3,
    // Bot 搜索掩体的最大距离。
    coverSearchDistance: 40,
    // 掩体评分中拉开与敌人距离的权重。
    coverEnemyWeight: 0.5,
    // 掩体评分中自身到掩体距离的权重。
    coverDistanceWeight: 0.3,
    // 掩体距离评分的基础偏移。
    coverDistanceBias: 12,
    // Bot 低于该生命值时优先寻找掩体。
    lowHealthThreshold: 40,
    // Bot 重新评估掩体的时间间隔。
    coverRefreshInterval: 5,
    // Bot 站到掩体背后的额外安全距离。
    coverStandOff: 0.65,
    // Bot 探身点相对掩体边缘的距离。
    coverPeekOffset: 0.9,
    // Bot 到达掩体后等待探身的最短时间。
    coverPeekIntervalMin: 0.8,
    // Bot 到达掩体后等待探身的随机时间范围。
    coverPeekIntervalRange: 1.2,
    // Bot 单次探身的最长时间。
    coverPeekDuration: 1.15,
    // Bot 与目标距离超过该值时向目标靠近。
    engageFarDistance: 50,
    // Bot 远距离接敌时的移动速度。
    engageFarSpeed: 5.2,
    // Bot 与目标距离低于该值时后撤。
    engageCloseDistance: 14,
    // Bot 近距离后撤速度。
    engageCloseSpeed: 4.6,
    // Bot 横向走位速度。
    engageStrafeSpeed: 3.5,
    // Bot 横向走位切换频率。
    engageStrafeFrequency: 0.8,
    // Bot 相对武器有效射程的理想交战距离倍率。
    idealRangeMultiplier: 0.62,
    // Bot 低于弹匣该比例时，在安全状态主动换弹。
    tacticalReloadThreshold: 0.32,
    // Bot 感到敌人数量优势时触发撤退或找掩体的倍率。
    outnumberedRatio: 1.35,
    // Bot 接敌后首次射击的基础延迟。
    engageFireBaseDelay: 0.7,
    // Bot 技能对射击延迟的影响范围。
    engageFireSkillDelay: 0.9,
    // Bot 到达掩体的判定距离。
    seekCoverArrivalDistance: 1.5,
    // Bot 到达掩体后转入侧翼状态的概率。
    seekCoverFlankChance: 0.3,
    // Bot 侧翼状态的持续时间。
    flankDuration: 6,
    // Bot 侧翼移动速度。
    flankSpeed: 4.6,
    // Bot 侧翼移动时沿目标方向的偏移。
    flankForwardBias: -0.3,
    // Bot 射击后短时间内的压制累积衰减速度。
    suppressionRecovery: 0.8,
    // Bot 进入脱困处理前允许被卡住的时间。
    stuckTimeout: 0.7,
    // Bot 判定为没有前进的最小位移。
    stuckDistance: 0.28,
    // Bot 局部避障的前视距离。
    movementLookAhead: 2.8,
    // Bot 局部避障候选方向的最大偏转角。
    movementProbeAngle: 0.62,
    // Bot 与队友保持的最小距离。
    separationDistance: 1.35,
    // Bot 队友分离力的强度。
    separationWeight: 1.7,
    // Bot 低于该生命值或没有弹药时会考虑前往补给站。
    resupplyHealthThreshold: 28,
    // Bot 备用弹药低于该比例时会考虑前往补给站。
    resupplyAmmoRatio: 0.18,
    // Bot 的转身、命中体和受伤音效触发概率。
    // Bot 低于该速度时视为静止。
    stationarySpeedThreshold: 0.1,
    // Bot 转向目标的跟随速度。
    turnSpeed: 6,
    // Bot 身体命中体宽度。
    hitboxBodyWidth: 0.77,
    // Bot 身体命中体深度。
    hitboxBodyDepth: 0.56,
    // Bot 身体命中体顶部高度。
    hitboxBodyMaxY: 1.52,
    // Bot 头部命中体宽度。
    hitboxHeadWidth: 0.46,
    // Bot 头部命中体深度。
    hitboxHeadDepth: 0.46,
    // Bot 头部命中体底部高度。
    hitboxHeadMinY: 1.5,
    // Bot 头部命中体顶部高度。
    hitboxHeadMaxY: 1.96,
    // Bot 非致命受击时播放痛苦音效的概率。
    painChance: 0.25,
    // Bot 阵亡时播放痛苦音效的概率。
    deathPainChance: 0.4,
  },
  // 子弹命中、伤害和弹道提示参数。
  combat: {
    // 子弹最大射程。
    bulletRange: 200,
    // 子弹命中身体时的伤害。
    bodyDamage: 35,
    // 子弹命中头部时的伤害。
    headDamage: 100,
    // 子弹曳光线相对枪口的起始偏移。
    tracerOriginOffset: 0.1,
    // 子弹经过玩家附近时播放掠过音效的最大距离。
    bulletWhizDistance: 30,
    // 子弹掠过判定的最小方向点积。
    bulletWhizAlignmentMin: 0.95,
    // 子弹掠过判定的最大方向点积。
    bulletWhizAlignmentMax: 0.999,
  },
  // 鼠标、触摸摇杆和陀螺仪输入参数。
  input: {
    // 触摸滑动位移转换为视角输入的倍率。
    touchLookScale: 5,
    // 陀螺仪姿态变化转换为视角输入的倍率。
    gyroLookScale: 500,
    // 陀螺仪输入死区。
    gyroDeadzone: 0.0015,
    // 陀螺仪输入平滑倍率。
    gyroSmoothing: 0.3,
    // 单次陀螺仪姿态变化的最大步长。
    gyroMaxStep: 0.08,
    // 触摸摇杆默认半径。
    touchStickRadius: 56,
    // 触摸摇杆半径下限。
    touchStickMinRadius: 40,
    // 触摸摇杆移动死区。
    touchStickDeadzone: 0.12,
    // 摇杆达到该输入强度后触发冲刺。
    touchSprintThreshold: 0.82,
    // 输入归零判定的最小阈值。
    inputEpsilon: 0.001,
  },
  // 部署界面、出生点争夺判定和镜头过渡参数。
  deployment: {
    // 出生点周围用于判断交战的半径。
    contestedRadius: 20,
    // 出生点附近达到该敌人数后标记为交战。
    contestedEnemyCount: 2,
    // 战术俯视镜头的地图边缘留白倍率。
    cameraMargin: 1.05,
    // 经典模式战术俯视镜头的高度缩放。
    cameraHeightScale: 0.9,
    // 丧尸模式战术俯视镜头的高度缩放。
    zombieCameraHeightScale: 0.4,
    // 进入部署界面的镜头动画时长。
    toScreenDuration: 1.15,
    // 进入部署界面时中间镜头的水平位置比例。
    toScreenMidPositionRatio: 0.35,
    // 进入部署界面时中间镜头的最低高度增量。
    toScreenMidHeightOffset: 18,
    // 进入部署界面时中间镜头相对俯视高度比例。
    toScreenMidHeightRatio: 0.45,
    // 进入部署界面时俯仰角回正的时间点。
    toScreenPitchResetStart: 0.95,
    // 进入部署界面时横滚角回正的时间点。
    toScreenRollResetStart: 0.85,
    // 从出生点选择到落地的镜头动画时长。
    deployDuration: 1.45,
    // 出生动画中间镜头的高度比例。
    deployMidHeightRatio: 0.55,
    // 出生动画中间镜头的最大高度。
    deployMidHeightMax: 72,
    // 出生动画俯仰角回正的起始时间点。
    deployPitchResetStart: 0.5,
    // 出生动画俯仰角回正的结束时间点。
    deployPitchResetEnd: 0.95,
    // 出生动画水平角回正的起始时间点。
    deployYawResetStart: 0.68,
    // 出生动画水平角回正的结束时间点。
    deployYawResetEnd: 0.98,
    // 出生动画开始显示落地暗角的时间点。
    landingVignetteStart: 0.86,
    // 出生动画触发落地音效和震动的时间点。
    landingImpactStart: 0.88,
  },
  // 枪口火光、弹壳、火花、烟雾和血液特效参数。
  effects: {
    // 子弹曳光线的显示时长。
    tracerLife: 0.05,
    // 子弹曳光线的初始透明度。
    tracerOpacity: 0.65,
    // 第一人称枪口火光的显示时长。
    firstPersonMuzzleLife: 0.05,
    // Bot 枪口火光的显示时长。
    botMuzzleLife: 0.06,
    // 第一人称枪口烟雾数量。
    firstPersonSmokeCount: 1,
    // Bot 枪口烟雾数量。
    botSmokeCount: 1,
    // 枪口烟雾的透明度和基础生命周期。
    muzzleSmokeOpacity: 0.08,
    smokeLife: 0.22,
    // 手雷烟雾团的数量和最大透明度。
    smokeCloudPuffCount: 24,
    smokeCloudOpacity: 0.28,
    // 每个后续烟雾粒子的生命周期增量。
    smokeLifeStep: 0.09,
    // 玩家枪口烟团的生命周期。
    smokePuffLife: 0.34,
    // 弹壳粒子的生命周期。
    shellLife: 1.4,
    // 弹壳下落加速度。
    shellGravity: 9.8,
    // 弹壳落地后的垂直反弹倍率。
    shellBounce: -0.28,
    // 弹壳落地后的水平速度保留倍率。
    shellHorizontalDamping: 0.65,
    // 弹壳落地后的旋转速度保留倍率。
    shellRotationDamping: 0.6,
    // 弹壳落地时播放声音的概率。
    shellDropChance: 0.4,
    // 命中障碍物时生成的火花数量。
    sparkCount: 4,
    // 火花粒子的生命周期。
    sparkLife: 0.7,
    // 火花下落加速度。
    sparkGravity: 6,
    // 命中障碍物时尘土粒子的生命周期。
    dustLife: 0.5,
    // 命中角色时生成的血液粒子数量。
    bloodCount: 6,
    // 血液粒子的生命周期。
    bloodLife: 1,
    // 血液粒子的下落加速度。
    bloodGravity: 9,
  },
  // HUD 阈值、准星尺寸和提示持续时间，时间单位为毫秒。
  hud: {
    // 玩家低于该生命值时显示低血量状态。
    lowHealthThreshold: 30,
    // 玩家弹药不高于该数量时显示低弹量提示。
    lowAmmoThreshold: 2,
    // 准星的基础间距。
    crosshairBaseGap: 4,
    // 射击散布转换为准星间距的倍率。
    crosshairSpreadScale: 520,
    // 准星的基础尺寸。
    crosshairBaseSize: 22,
    // 准星线段长度。
    crosshairLength: 8,
    // 连杀统计的有效时间窗口。
    killStreakWindow: 3500,
    // 击杀提示开始淡出的延迟。
    killNotifyOutDelay: 1500,
    // 击杀提示清理样式的延迟。
    killNotifyCleanupDelay: 1900,
    // 受击暗角的显示时长。
    damageVignetteDuration: 400,
    // 方向伤害提示的显示时长。
    directionDamageDuration: 800,
    // 击杀 feed 单条消息的显示时长。
    killFeedItemDuration: 5000,
    // 击杀 feed 同时保留的最大消息数。
    killFeedMaxItems: 6,
    // 中央提示默认显示时长。
    centerMessageDuration: 2000,
    // 道具和补给反馈的显示时长。
    actionMessageDuration: 1600,
  },
  // Web Audio 同时播放的声音数量限制。
  audio: {
    // 达到该数量后降低普通声音的播放优先级。
    maxVoices: 24,
    // 允许超过最大声音数的额外声音数量。
    overflowVoices: 10,
  },
  // 相机、雾效、像素比和阴影的运行时渲染参数。
  render: {
    // 相机近裁剪面距离。
    cameraNear: 0.04,
    // 相机远裁剪面距离。
    cameraFar: 1200,
    // 指数平方雾密度，远处渐进消隐而不产生硬交界线。
    fogDensity: 0.0038,
    // 桌面设备的像素比上限。
    desktopPixelRatio: 1.25,
    // 触摸设备的像素比上限。
    touchPixelRatio: 2,
    // 纹理各向异性过滤等级上限。
    maxAnisotropy: 4,
    // 主光源阴影贴图尺寸。
    shadowMapSize: 2048,
    // 主光源阴影视锥的水平边界。
    shadowCameraBound: 120,
    // 主光源阴影视锥的近裁剪面。
    shadowCameraNear: 10,
    // 主光源阴影视锥的远裁剪面。
    shadowCameraFar: 300,
  },
  // 启动加载进度和各阶段等待时间，时间单位为毫秒。
  boot: {
    // 加载界面初始进度。
    initialProgress: 4,
    // 世界生成完成时的加载进度。
    worldProgress: 18,
    // 掩体阶段的加载进度。
    coverProgress: 28,
    // 部署单位阶段的加载进度。
    botProgress: 36,
    // AI 初始化阶段的加载进度。
    aiProgress: 42,
    // 音频加载开始时的进度。
    audioProgress: 45,
    // 音频加载占用的进度区间。
    audioProgressRange: 51,
    // 世界阶段后的等待时间。
    initialDelay: 40,
    // 中间加载阶段的等待时间。
    coverDelay: 20,
    // 加载完成后显示菜单前的等待时间。
    readyDelay: 200,
    // 加载界面淡出后显示菜单的延迟。
    menuFadeDelay: 600,
  },
}

// 启动加载界面按顺序显示的阶段文案。
export const LOAD_STEPS = [
  '正在装配武器...',
  '生成战场地形...',
  '构筑防御工事...',
  '部署作战单位...',
  '初始化AI系统...',
  '加载战斗音效...',
  '准备就绪...',
]

const audioModules = import.meta.glob('./audio/*.ogg', {
  eager: true,
  query: '?url',
  import: 'default',
})

export const AUDIO_FILES = Object.fromEntries(
  Object.entries(audioModules).map(([path, url]) => [
    path.split('/').pop().replace('.ogg', ''),
    url,
  ])
)
