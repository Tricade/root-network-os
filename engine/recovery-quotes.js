/** Recovery quotes: internal simulation domain, composed by engine.js. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['recovery-quotes'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function createDomain(context) {
    // Late domain calls avoid circular module imports; no simulation state is stored here.

    function cashReason(s, amount) {
      if (amount <= 0) return '';
      return s.credits < amount
        ? `Benötigt ${Math.ceil(amount)} Credits; verfügbar sind ${Math.floor(s.credits)}.`
        : '';
    }

    function makeOption({
      key,
      label,
      description,
      cost = 0,
      parts = 0,
      duration = 0,
      enabled = true,
      reason = '',
      researchLoss = 0,
      workLoss = 0,
      researchRestore = 0,
      workRestore = 0,
      reputationLoss = 0,
    }) {
      return {
        key,
        label,
        description,
        cost,
        parts,
        duration,
        enabled,
        reason,
        researchLoss,
        workLoss,
        researchRestore,
        workRestore,
        reputationLoss,
      };
    }

    function repairQuotes(s, server) {
      const scale = 1 + Math.max(0, s.sector - 1) * 0.18 + Math.max(0, s.servers.length - 1) * 0.03;
      const repairable = server.status === 'failed' || server.condition < 60;
      const locked =
        s.resilience.operation ||
        s.resilience.incident ||
        s.facility.operation ||
        s.facility.centralOperation;
      const reason = locked
        ? 'Eine andere Wartungs- oder Krisenmaßnahme läuft.'
        : repairable
          ? ''
          : 'Dieser Server ist ausreichend intakt.';
      const condition = server.condition;
      const options = [
        {
          key: 'patch',
          label: 'Schnellreparatur',
          cost: Math.ceil((78 + Math.max(0, 60 - condition) * 1.7) * scale),
          parts: 1,
          duration: 60,
          result: Math.max(condition, 60),
          workPct: 0,
        },
        {
          key: 'overhaul',
          label: 'Generalüberholung',
          cost: Math.ceil((260 + Math.max(0, 100 - condition) * 2.1) * scale),
          parts: 2,
          duration: 240,
          result: 100,
          workPct: 0,
        },
        {
          key: 'manual',
          label: 'Manuelle Wiederherstellung',
          cost: 0,
          parts: 0,
          duration: 600,
          result: Math.max(condition, 45),
          workPct: 0.1,
        },
      ];
      return options.map((x) => {
        const workLoss = s.jobs.reduce((sum, j) => sum + j.work * x.workPct, 0);
        const shortage =
          s.resilience.parts < x.parts
            ? `Benötigt ${x.parts} Ersatzteile, vorhanden sind ${s.resilience.parts}.`
            : cashReason(s, x.cost);
        const disabledReason = reason || shortage;
        return {
          ...makeOption({
            key: x.key,
            label: x.label,
            cost: x.cost,
            parts: x.parts,
            duration: x.duration,
            enabled: !disabledReason && repairable,
            reason: disabledReason,
            workLoss,
            description: `${x.cost} Credits, ${x.parts} Ersatzteile, ${x.duration} Sekunden Ausfallzeit; Zustand danach ${Math.round(x.result)}%.${workLoss ? ` Dabei gehen ${workLoss.toFixed(1)} Arbeitseinheiten verloren.` : ' Kein Auftragsfortschritt geht verloren.'}`,
          }),
          condition: x.result,
        };
      });
    }

    function corruptionRestoreQuote(s) {
      const backup = s.resilience.backup;
      const targetResearch = backup ? backup.protectedResearch : 0;
      const byId = new Map(backup ? backup.jobs.map((j) => [j.id, j.work]) : []);
      let workLoss = 0,
        workRestore = 0;
      for (const job of s.jobs) {
        const target = backup && byId.has(job.id) ? byId.get(job.id) : 0;
        workLoss += Math.max(0, job.work - target);
        workRestore += Math.max(0, target - job.work);
      }
      const researchLoss = Math.max(0, s.research - targetResearch);
      const researchRestore = Math.max(0, targetResearch - s.research);
      return {
        targetResearch,
        jobTargets: s.jobs.map((j) => ({
          id: j.id,
          work: backup && byId.has(j.id) ? byId.get(j.id) : 0,
        })),
        researchLoss,
        researchRestore,
        workLoss,
        workRestore,
      };
    }

    function incidentQuotes(s) {
      const incident = s.resilience.incident;
      if (!incident) return null;
      const locked = Boolean(
        s.resilience.operation ||
        s.facility.operation ||
        s.facility.centralOperation ||
        incident.resolution,
      );
      const baseReason =
        s.facility.operation || s.facility.centralOperation
          ? 'Die laufende Infrastrukturmaßnahme muss zuerst abgeschlossen werden.'
          : locked
            ? 'Die Krisenmaßnahme läuft bereits; ihre Folgen sind festgelegt.'
            : '';
      const scale = 1 + Math.max(0, s.sector - 1) * 0.18;
      let rows;
      if (incident.kind === 'power')
        rows = [
          {
            key: 'reroute',
            label: 'Last umleiten',
            cost: Math.ceil(150 * scale),
            parts: 0,
            duration: 90,
            condition: 64,
            reputationLoss: 0,
            workPct: 0.08,
            text: 'Leitet die betroffenen Knoten zurück auf einen sicheren Betriebsmodus.',
          },
          {
            key: 'replace',
            label: 'Schaltmodul ersetzen',
            cost: Math.ceil(280 * scale),
            parts: 1,
            duration: 210,
            condition: 90,
            reputationLoss: 0,
            workPct: 0,
            text: 'Ersetzt das defekte Modul und stellt die volle Netzleistung wieder her.',
          },
          {
            key: 'manual',
            label: 'Manuelle Notumschaltung',
            cost: 0,
            parts: 0,
            duration: 480,
            condition: 48,
            reputationLoss: 2,
            workPct: 0.12,
            text: 'Kostenfrei, aber langsam; der Kunde erhält eine Gutschrift und laufende Arbeit geht teilweise verloren.',
          },
        ];
      else if (incident.kind === 'cooling')
        rows = [
          {
            key: 'shed_load',
            label: 'Last abwerfen',
            cost: 0,
            parts: 0,
            duration: 150,
            condition: 58,
            reputationLoss: 1,
            workPct: 0.2,
            text: 'Schaltet betroffene Knoten vorsichtig wieder frei, senkt aber laufende Auftragsarbeit.',
          },
          {
            key: 'cooling_unit',
            label: 'Kühlaggregat tauschen',
            cost: Math.ceil(330 * scale),
            parts: 2,
            duration: 300,
            condition: 96,
            reputationLoss: 0,
            workPct: 0,
            text: 'Tauscht das Aggregat und bringt die betroffenen Knoten fast in den Neuzustand.',
          },
          {
            key: 'manual',
            label: 'Notlüftung öffnen',
            cost: 0,
            parts: 0,
            duration: 660,
            condition: 45,
            reputationLoss: 3,
            workPct: 0.16,
            text: 'Kostenfreie Notlösung mit langem Stillstand und eingeschränkter Leistung.',
          },
        ];
      else {
        const restore = corruptionRestoreQuote(s);
        rows = [
          {
            key: 'restore_backup',
            label: 'Letzte Betriebssicherung laden',
            cost: Math.ceil(190 * scale),
            parts: 0,
            duration: 180,
            condition: 82,
            reputationLoss: 0,
            workPct: 0,
            text: 'Stellt den letzten validierten Stand wieder her.',
            researchLoss: restore.researchLoss,
            researchRestore: restore.researchRestore,
            workLoss: restore.workLoss,
            workRestore: restore.workRestore,
            backupRestore: true,
          },
          {
            key: 'rebuild',
            label: 'Datenbestand neu aufbauen',
            cost: Math.ceil(360 * scale),
            parts: 1,
            duration: 420,
            condition: 90,
            reputationLoss: 2,
            workPct: 0.35,
            text: 'Rekonstruiert den Datenbestand aus aktiven Knoten.',
          },
          {
            key: 'manual',
            label: 'Manuelle Datenrettung',
            cost: 0,
            parts: 0,
            duration: 900,
            condition: 42,
            reputationLoss: 6,
            workPct: 0.6,
            text: 'Kostenfreie Notrettung; langsam, mit starkem Fortschritts- und Ansehensverlust.',
          },
        ];
        if (!s.resilience.backup) rows[0].unavailable = 'Es gibt noch keine Betriebssicherung.';
      }
      return rows.map((x) => {
        const share = context.incidentShare(s);
        const workLoss =
          (x.backupRestore
            ? x.workLoss
            : s.jobs.reduce((sum, j) => sum + j.work * (x.workPct || 0), 0)) * share;
        const researchLoss =
          (x.backupRestore
            ? x.researchLoss
            : incident.kind === 'corruption'
              ? s.research * (x.key === 'manual' ? 0.6 : x.key === 'rebuild' ? 0.2 : 0)
              : 0) * share;
        if (x.researchRestore) x.researchRestore *= share;
        if (x.workRestore) x.workRestore *= share;
        const shortage =
          x.unavailable ||
          (s.resilience.parts < x.parts
            ? `Benötigt ${x.parts} Ersatzteile, vorhanden sind ${s.resilience.parts}.`
            : cashReason(s, x.cost));
        const reason = baseReason || shortage;
        let detail = `${x.cost} Credits, ${x.parts} Ersatzteile und ${x.duration} Sekunden Krisenbetrieb.`;
        detail += ` Zustand der betroffenen Knoten danach ${x.condition}%.`;
        if (researchLoss) detail += ` Verlust: ${researchLoss.toFixed(1)} Forschung.`;
        if (x.researchRestore)
          detail += ` Wiederherstellung: ${x.researchRestore.toFixed(1)} Forschung aus der Sicherung.`;
        if (workLoss) detail += ` Verlust: ${workLoss.toFixed(1)} Arbeitseinheiten.`;
        if (x.workRestore)
          detail += ` Wiederherstellung: ${x.workRestore.toFixed(1)} gespeicherte Arbeitseinheiten.`;
        if (x.reputationLoss) detail += ` Ansehensverlust: ${x.reputationLoss}.`;
        return {
          ...makeOption({
            key: x.key,
            label: x.label,
            cost: x.cost,
            parts: x.parts,
            duration: x.duration,
            enabled: !reason,
            reason,
            researchLoss,
            workLoss,
            researchRestore: x.researchRestore || 0,
            workRestore: x.workRestore || 0,
            reputationLoss: x.reputationLoss,
            description: `${x.text} ${detail}`,
          }),
          condition: x.condition,
        };
      });
    }
    return { cashReason, makeOption, repairQuotes, corruptionRestoreQuote, incidentQuotes };
  };
});
