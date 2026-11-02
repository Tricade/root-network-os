/** Commercial UI and message translations; proper customer names stay unchanged. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  if (root) root.RootCustomersEnglish = factory;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (translate) {
  return {
    pairs: [
      [
        'Diese Kundenanfrage ist nicht mehr verfügbar.',
        'This customer enquiry is no longer available.',
      ],
      [
        'Die Vertragsverwaltung dieses Raums ist ausgelastet.',
        "This room's contract capacity is full.",
      ],
      [
        'Dieser Kunde benötigt gerade keinen Agenteneinsatz.',
        'This customer does not currently need an agent assignment.',
      ],
      ['Dieser Agent ist gerade nicht verfügbar.', 'This agent is currently unavailable.'],
      ['Aktiver Kundenvertrag nicht gefunden.', 'Active customer contract not found.'],
      ['Dieser Kunde wird bereits betreut.', 'This customer is already receiving support.'],
      ['Es liegt keine offene Kundenanfrage vor.', 'There is no open customer request.'],
      [
        'Ein Rückgewinnungsversuch ist gerade nicht möglich.',
        'A retention attempt is not currently available.',
      ],
      ['Ungültige Kundenautomatik.', 'Invalid customer automation setting.'],
      ['Unbekannter Kundenauftrag.', 'Unknown customer action.'],
      [
        'Neue Verträge entstehen aus eingehenden Kundenanfragen.',
        'New contracts come from incoming customer enquiries.',
      ],
      [
        'Kundenvertrag angenommen. Einrichtung wartet auf einen verfügbaren Agenten.',
        'Customer contract accepted. Setup is waiting for an available agent.',
      ],
      ['Kundenauftrag gespeichert.', 'Customer action saved.'],
      ['Diensteinheiten', 'service units'],
      ['Agentenzeit', 'agent time'],
      ['Kündigungsgrund', 'Cancellation reason'],
      ['Basisumsatz je Diensteinheit', 'Base revenue per service unit'],
      ['Wartet auf Agent', 'Waiting for an agent'],
      ['Einmalige Kosten', 'One-time cost'],
      ['Verfügbarer Agent', 'Available agent'],
      [
        'Neue Anfragen werden nur bei passender Kapazität, verfügbarer Teamkapazität, Geldreserve und verbleibendem Stundenbudget angenommen. Bezahlte Einrichtungen und Betreuungen warten bei Bedarf auf einen freien Agenten.',
        'New enquiries are accepted only when capacity, team capacity, cash reserves and the remaining hourly budget allow it. Paid setups and support wait for an available agent when needed.',
      ],
      ['Kundenbudget / Stunde', 'Customer budget / hour'],
      ['Budget speichern', 'Save budget'],
      [
        'Die Einrichtung bindet einen Agenten. Kapazität ist sofort reserviert; Einnahmen beginnen nach der Einrichtung. Spätere Ausfälle können Beschwerden, Zahlungsausgleich und Kündigungen auslösen.',
        'Setup assigns an agent and reserves capacity immediately. Revenue begins once setup is complete. Later outages can lead to complaints, service credits and cancellation notices.',
      ],
      ['Aktive Verträge', 'Active contracts'],
      ['Raumbetrieb & Versorgung', 'Room operations & supply'],
      [
        'Anfragen sind noch keine Zusagen. Prüfe Raum, Reserve und Kosten; eine Ablehnung kostet keine Reputation. Neue Anfragen kommen automatisch. Unbeantwortete Anfragen laufen nach vier Stunden aus.',
        'Enquiries are not commitments. Check room capacity, reserves and costs; declining does not affect reputation. New enquiries arrive automatically and expire after four hours.',
      ],
      ['Verträge an diesem Standort', 'Contracts at this location'],
      [
        'Einrichtung reserviert Hardware und bindet einen Agenten. Umsatz beginnt nach der Einrichtung und hängt von der tatsächlichen Versorgung ab. Kurze Störungen sind reparierbar; anhaltende Defizite führen zu Beschwerden und Kündigungsfristen. Auch gesunde Kunden können zum Vertragsende aus geschäftlichen Gründen wechseln. Automatische Verlängerung garantiert keine ewige Bindung.',
        'Setup reserves hardware and assigns an agent. Revenue begins after setup and depends on actual service delivery. Short outages can be repaired; ongoing deficits lead to complaints and cancellation notices. Even satisfied customers may leave for business reasons at the end of a contract. Automatic renewal does not guarantee a permanent relationship.',
      ],
      ['Reserviert / verfügbar', 'Reserved / available'],
      ['Kapazitätsprofil & Reserven', 'Capacity profile & reserves'],
      ['Team & Betreuungskapazität', 'Team & support capacity'],
      ['Kundenplätze', 'Customer slots'],
      [
        'Ein Team betreut 24 Einheiten. Eine Teamleitung kann jeweils nur einen Raum leiten. Ihr Bonus pausiert während Einsätzen und Selbstwartung. Teams und Agenten verursachen laufende Kosten.',
        'One team supports 24 units. Each team lead can manage one room. Their bonus pauses during assignments and self-maintenance. Teams and agents have ongoing costs.',
      ],
      [
        'Zentralbetrieb ersetzt lokale Versorgung. Lokale Reserve bleibt bei Hybridversorgung erhalten. Zentrale Kapazität wird nur unter angeschlossenen Racks geteilt; die USV schützt nur angeschlossene Stromkreise.',
        'Central operation replaces local supply. Hybrid supply retains local reserves. Central capacity is shared only by connected racks; the UPS protects only connected circuits.',
      ],
      ['Geschäft', 'Business'],
      ['Team & Entwicklung', 'Team & development'],
      ['Kunden & Verträge', 'Customers & contracts'],
      ['Projektaufträge', 'Projects'],
      ['Racks & Server', 'Racks & servers'],
      ['Gebäude & Versorgung', 'Buildings & utilities'],
      ['Störungen & Backups', 'Incidents & backups'],
      ['Ereignisprotokoll', 'Activity log'],
      ['Erfolge', 'Achievements'],
      [
        'Ziele, Fortschritte und abholbereite Belohnungen an einem Ort.',
        'Goals, progress and available rewards in one place.',
      ],
      ['KUNDENANFRAGE', 'CUSTOMER ENQUIRY'],
      ['Laufzeit', 'Contract term'],
      ['Einrichtung', 'Setup'],
      ['Agent auswählen', 'Choose agent'],
      ['Agent zuweisen', 'Assign agent'],
      ['Betreuung prüfen', 'Review support'],
      ['Rückgewinnung prüfen', 'Review retention'],
      ['Kündigung angekündigt', 'Cancellation notice'],
      ['Versorgungsprobleme', 'Service delivery problems'],
      ['Kundenbudget', 'Customer budget'],
      ['Zusammenlegung', 'Consolidation'],
      ['Anbieterwechsel', 'Provider change'],
      ['Vertragsende', 'End of term'],
      ['Zufriedenheit', 'Satisfaction'],
      ['Verbleibende Laufzeit', 'Remaining term'],
      ['Rückfrage zum Vertrag', 'Contract enquiry'],
      ['Versorgung nach Betreuung beobachten', 'Monitor service after support'],
      ['Beschwerde zur Dienstversorgung', 'Service delivery complaint'],
      ['Kundenautomatik', 'Customer automation'],
      ['Kundenanfragen automatisch annehmen', 'Accept customer enquiries automatically'],
      ['Kundenagenten automatisch zuweisen', 'Assign customer agents automatically'],
      [
        'Passende Kundenanfragen automatisch annehmen',
        'Accept suitable customer enquiries automatically',
      ],
      ['Agenten automatisch zuweisen', 'Assign agents automatically'],
      ['Im aktuellen Stundenfenster ausgegeben', 'Spent in the current hourly window'],
      ['Vertragslaufzeit ab Einrichtung', 'Contract term after setup'],
      [
        'Betreuung ersetzt keine Reparatur. Rückgewinnung gelingt nur bei ausreichender Versorgung und kann auch aus geschäftlichen Gründen abgelehnt werden. Bezahlte Einsätze warten ohne weiteren Kostenabzug auf einen verfügbaren Agenten.',
        'Support does not replace repairs. Retention requires adequate service and may be declined for business reasons. Paid assignments wait for an available agent without further charges.',
      ],
      [
        'Kunden fragen Dienste an. Dein Team richtet sie ein und betreut verbindliche Verträge.',
        'Customers request services. Your team provisions them and supports binding contracts.',
      ],
      ['Geschäftsbilanz', 'Business performance'],
      ['Vertragsstandort', 'Contract location'],
      ['Ressourcen am Vertragsstandort', 'Resources at this contract location'],
      ['Anfrageeingang', 'Incoming enquiries'],
      ['Neue Kundenanfragen sind unterwegs', 'New customer enquiries are on the way'],
      [
        'Dein Anfrageeingang füllt sich automatisch, während dein Betrieb weiterläuft.',
        'Your enquiry inbox fills automatically while operations continue.',
      ],
      ['Noch keine Kunden an diesem Standort', 'No customers at this location yet'],
      [
        'Nimm eine passende Kundenanfrage an. Die Einrichtung benötigt einen verfügbaren Agenten.',
        'Accept a suitable customer enquiry. Provisioning requires an available agent.',
      ],
      ['Vertragsstandards für neue Zusagen', 'Contract defaults for new commitments'],
      ['Beendete Kundenverträge', 'Ended customer contracts'],
      ['Technische Raumversorgung', 'Technical room supply'],
      [
        'Dieser Raum ist beim Umbau drei Minuten offline. Zentrale Versorgung betrifft nur angeschlossene Räume; lokale Reserve kann weiterhin Leistung liefern.',
        'This room is offline for three minutes during conversion. Central supply affects connected rooms; local reserve can continue providing capacity.',
      ],
      [
        'Raumprofile, Reserve und Teams beeinflussen die zugesagte Kundenversorgung. Teams verursachen laufende Kosten; bestehende Premiumzusagen bleiben bis zur Verlängerung bindend.',
        'Room profiles, reserves and teams affect committed customer service. Teams have ongoing costs; existing premium obligations remain binding until renewal.',
      ],
      ['Kundeneinrichtung', 'Customer provisioning'],
      ['Kundenrückgewinnung', 'Customer retention'],
      ['Kundenbetreuung', 'Customer support'],
      ['Ungültige Kundenverwaltung.', 'Invalid customer ledger.'],
    ],
    patterns: [
      [
        /^Forschung abgeschlossen: (.+?), Stufe (\d+)\.$/,
        (_, name, level) => `Research complete: ${translate(name, 'en')}, level ${level}.`,
      ],
      [
        /^(\d+) Erfolge freigeschaltet\. Belohnungen warten unter Erfolge\.$/,
        '$1 achievements unlocked. Rewards are available under Achievements.',
      ],
      ...[
        ['^Noch (.+?) FP nötig$', '$1 RP required'],
        [
          '^(.+?): Vertrag angenommen\\. Ein Agent muss den Dienst einrichten\\.$',
          '$1: Contract accepted. An agent must set up the service.',
        ],
        [
          '^(.+?): Dienst eingerichtet\\. Der Vertrag läuft jetzt\\.$',
          '$1: Service set up. The contract is now active.',
        ],
        [
          '^(.+?): Kundenanfrage bearbeitet\\. Die technische Versorgung bleibt entscheidend\\.$',
          '$1: Customer request handled. Technical service availability remains critical.',
        ],
        ['^(.+?): Rückgewinnung erfolgreich\\.$', '$1: Customer retained successfully.'],
        ['^(.+?): Rückgewinnung abgelehnt\\.$', '$1: Customer retention declined.'],
        [
          '^(.+?): Kundenvertrag beendet \\(sla\\)\\.$',
          '$1: Customer contract ended (service level issues).',
        ],
        [
          '^(.+?): Kundenvertrag beendet \\(budget\\)\\.$',
          '$1: Customer contract ended (customer budget).',
        ],
        [
          '^(.+?): Kundenvertrag beendet \\(consolidation\\)\\.$',
          '$1: Customer contract ended (consolidation).',
        ],
        [
          '^(.+?): Kundenvertrag beendet \\(competitor\\)\\.$',
          '$1: Customer contract ended (provider change).',
        ],
        [
          '^(.+?): Kundenvertrag beendet \\(term\\)\\.$',
          '$1: Customer contract ended (end of term).',
        ],
        [
          '^(.+?): Beschwerde wegen unzureichender Versorgung\\.$',
          '$1: Complaint about insufficient service availability.',
        ],
        [
          '^(.+?): Kündigung wegen anhaltender Versorgungsprobleme angekündigt\\.$',
          '$1: Cancellation notice issued due to ongoing service problems.',
        ],
        [
          '^(.+?): Kündigung zum Vertragsende angekündigt \\(sla\\)\\.$',
          '$1: Cancellation announced for the end of the contract (service level issues).',
        ],
        [
          '^(.+?): Kündigung zum Vertragsende angekündigt \\(budget\\)\\.$',
          '$1: Cancellation announced for the end of the contract (customer budget).',
        ],
        [
          '^(.+?): Kündigung zum Vertragsende angekündigt \\(consolidation\\)\\.$',
          '$1: Cancellation announced for the end of the contract (consolidation).',
        ],
        [
          '^(.+?): Kündigung zum Vertragsende angekündigt \\(competitor\\)\\.$',
          '$1: Cancellation announced for the end of the contract (provider change).',
        ],
        ['^(.+?): Kundenvertrag verlängert\\.$', '$1: Customer contract renewed.'],
      ].map(([pattern, replacement]) => [new RegExp(pattern), replacement]),
    ],
  };
});
