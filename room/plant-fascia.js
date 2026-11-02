/** Fixed instrument rows stay above the access doors, with a separate LED row.
 * Positions are measured in the original cabinet's local coordinate system. */
export function decoratePlantUnit(
  unit,
  id,
  index,
  side,
  floor,
  { box, sign, instrument, tr, materials },
) {
  const cooling = id === 'cooling',
    chiller = Boolean(unit.userData.centralChiller),
    ups = id === 'ups';
  const original = unit.getObjectByName(
    cooling
      ? 'crac_cooling_unit_cabinet_LOD0_5'
      : ups
        ? 'ups_telemetry_display'
        : 'pdu_telemetry_display',
  );
  if (original) original.visible = false;
  const front = cooling ? (chiller ? 0.458 : 0.448) : ups ? 0.429 : 0.369,
    centerY = cooling ? 1.84 : ups ? 1.8 : 1.785,
    screenAt = [cooling ? -0.18 : ups ? -0.2 : -0.27, centerY, front],
    screenSize = cooling ? [0.37, 0.17] : ups ? [0.34, 0.145] : [0.44, 0.13];
  box(
    unit,
    [screenSize[0] + 0.018, screenSize[1] + 0.018, 0.014],
    [screenAt[0], screenAt[1], front - 0.009],
    materials.shellDark,
  );
  const readout = instrument(unit, screenAt, ...screenSize, true);
  readout.userData.fasciaRole = 'readout';
  const code = cooling ? (chiller ? 'CHILLER' : 'STARTER') : ups ? 'UPS' : 'ATS';
  const identity = sign(
    unit,
    `${code} ${String(index + 1).padStart(2, '0')}${side < 0 ? 'A' : 'B'}`,
    `ROOT / ${tr(`Untergeschoss ${floor}`)}`,
    [cooling ? 0.2 : ups ? 0.2 : 0.27, centerY, front],
    cooling ? 0.23 : ups ? 0.3 : 0.4,
    cooling ? 0.1 : ups ? 0.125 : 0.13,
  );
  identity.userData.fasciaRole = 'identity';
  unit.traverse((node) => {
    if (cooling && /^crac_cooling_unit_cabinet_LOD0_[67]$/.test(node.name)) node.position.y += 0.1;
    if (/^led_ups_status_/.test(node.name)) node.position.y = 1.94;
    if (/^led_distribution_/.test(node.name)) node.position.y = 1.88;
  });
  if (id === 'distribution') {
    sign(
      unit,
      'STROMVERTEILUNG',
      'ATS / 3~ 400 V',
      [0, 1.97, front],
      1.0,
      0.105,
    ).userData.fasciaRole = 'heading';
    for (const source of [-1, 1])
      sign(
        unit,
        source < 0 ? 'QUELLE A' : 'QUELLE B',
        'L1 · L2 · L3',
        [source * 0.29, 1.64, 0.361],
        0.43,
        0.075,
      ).userData.fasciaRole = 'source';
  }
}
