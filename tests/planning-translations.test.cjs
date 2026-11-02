'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const createPlanningEnglish = require('../locales/planning-en.js');

const catalog = createPlanningEnglish((value) => value);
const pairs = new Map(catalog.pairs);

function translate(value) {
  if (pairs.has(value)) return pairs.get(value);
  for (const [pattern, replacement] of catalog.patterns) {
    const match = value.match(pattern);
    if (!match) continue;
    return typeof replacement === 'function'
      ? replacement(...match)
      : value.replace(pattern, replacement);
  }
  return value;
}

test('planning catalog translates newly added dashboard, customer, facility and roster labels', () => {
  for (const [source, expected] of [
    ['Vorfall braucht eine Entscheidung', 'An incident needs a decision'],
    ['Kundenbestand', 'Customer portfolio'],
    ['Standortnavigator', 'Location navigator'],
    ['Keine Agenten für diesen Filter', 'No agents match this filter'],
    ['Alle anzeigen', 'Show all'],
    [
      'Wähle einen verfügbaren Techniker für die Wartung.',
      'Choose an available technician for maintenance.',
    ],
    [
      'Der Zustandsgrenzwert muss zwischen 50 und 80 Prozent liegen.',
      'The condition threshold must be between 50% and 80%.',
    ],
    ['Ungültige Richtlinie für vorbeugende Wartung.', 'Invalid preventive maintenance policy.'],
    ['Kundenwachstum', 'Customer growth'],
    ['Liefertermin verbindlich zusagen', 'Commit to delivery date'],
    [
      'Dienstpriorität gespeichert. Andere Dienste teilen die verbleibende Kapazität.',
      'Service priority saved. Other services share the remaining capacity.',
    ],
  ])
    assert.equal(translate(source), expected, source);
});

test('dynamic maintenance logs and equipment requirements preserve IDs and numeric values', () => {
  assert.equal(
    translate(
      'Vorbeugende Rackwartung gestartet: rack-42; 180 Credits, 2 Ersatzteile, 540 Technikerarbeit.',
    ),
    'Preventive rack maintenance started on rack-42: 180 CR, 2 spare parts and 540 technician work.',
  );
  assert.equal(
    translate('Rackwartung für rack-42 eingeplant.'),
    'Rack maintenance scheduled for rack-42.',
  );
  assert.equal(
    translate('Benötigt 3 Ersatzteile; vorhanden sind 1.'),
    '3 spare parts required; 1 available.',
  );
  assert.equal(translate('Untergeschoss 2 · Raum 5'), 'Basement 2 · Room 5');
  assert.equal(
    translate(
      'Musterkunde: Erweiterung bis zum vereinbarten Liefertermin zugesagt; 420 Credits sind reserviert.',
    ),
    'Musterkunde: Expansion committed by the agreed delivery deadline; 420 CR reserved.',
  );
  assert.equal(
    translate('Musterkunde: Erweiterung rechtzeitig bereitgestellt.'),
    'Musterkunde: Expansion provisioned on time.',
  );
});

test('planning, growth and maintenance copy covers budget caps, delivery guarantees and service reserves', () => {
  for (const [source, expected] of [
    [
      'Das Stundenbudget des Ablaufplans ist 0. Lege unter Budgets & Beschaffung ein Budget fest, damit Maßnahmen starten können.',
      'The operations plan budget is 0 per hour. Set a budget under Budgets & procurement to let tasks start.',
    ],
    [
      'Ein Tagesbudget von 0 verhindert Wartungsstarts.',
      'A daily budget of 0 prevents maintenance from starting.',
    ],
    ['Tagesbudget (CR, 0 = keine Wartung)', 'Daily budget (CR, 0 = no maintenance)'],
    [
      'Zufriedene Bestandskunden können später Erweiterungen anfragen. Zusagen brauchen Kapazität und Einrichtung.',
      'Satisfied existing customers may request expansions later. Commitments require capacity and setup.',
    ],
    [
      'Die verbleibende Kundenversorgung läge unter der festgelegten Reserve.',
      'Remaining customer service delivery would fall below the required reserve.',
    ],
    ['Wartet auf freie Kapazität', 'Waiting for available capacity'],
    ['Einrichtung läuft', 'Provisioning in progress'],
    [
      'Maßnahme eingeplant. Ausführung innerhalb deiner Budgetgrenzen.',
      'Task scheduled. It will run within your spending limits.',
    ],
    [
      'Das Stundenbudget für geplante Maßnahmen reicht nicht aus.',
      'The hourly budget for scheduled tasks is insufficient.',
    ],
    [
      'Der aktuelle Preis überschreitet deine Freigabe.',
      'The current price exceeds your spending limit.',
    ],
    [
      'Geschützte Reserve oder Sparziel würden unterschritten.',
      'This would breach the protected reserve or savings target.',
    ],
    ['Mindestversorgung nach Wartung', 'Minimum service after maintenance'],
  ])
    assert.equal(translate(source), expected, source);
});
