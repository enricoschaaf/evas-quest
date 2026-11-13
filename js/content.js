/* ======================================================================
   INHALTE ZUM ANPASSEN — Texte, Fotos, Werbung, Abschlussnachricht.
   Fotos einfach nach assets/photos/ legen und hier eintragen.
   ====================================================================== */
window.CONTENT = {
  birthdayName: 'Eva',
  from: ['Laurenz', 'Enrico', 'Hannah', 'Magnus'],

  // Persönliche Nachricht im Finale (Zeilen werden einzeln angezeigt)
  message: [
    'Liebe Eva,',
    'du hast alle Welten gemeistert!',
    'Wir wünschen dir ein Jahr voller Gipfel, Pilze, Sonnenuntergänge und guter Menschen um dich herum.',
    '[HIER EURE PERSÖNLICHE NACHRICHT / DAS GESCHENK]'
  ],

  // Fotos für die Galerie im Finale
  gallery: ['assets/photos/wald.jpg', 'assets/photos/laufgruppe.jpg', 'assets/photos/hannah.jpg', 'assets/photos/heirat.jpg'],

  // Die Level in Reihenfolge. ad = Index in ADS, die nach dem Level gezeigt wird (oder null); music = Musikstück der Welt; joker: false = kein Überspringen-Joker (Hinweise gibt's im echten Leben)
  levels: [
    { id: 'bottles', world: 'Picknick-Lichtung', icon: 'bottle',   ad: [4, 0], music: 'bottles' },
    { id: 'runner',  world: 'Funkloch-Pfad',     icon: 'nowifi',   ad: 3,    music: 'runner1' },
    { id: 'run_rhythm', world: 'Laufstrecke',     icon: 'shoe',     ad: null, music: null },
    { id: 'flappy_party', world: 'Disko-Sturm',  icon: 'disco',    ad: 1,    music: 'disco' },
    { id: 'landing', world: 'Turbulenzen-Tal',   icon: 'plane',    ad: [5, 2], music: 'tense' },
    { id: 'jump',    world: 'Gipfelsturm',       icon: 'mountain', ad: null, music: 'game', joker: false }
  ],

  // Werbung. kind: 'ki' (KI-Werbung), 'wir' (Werbung von uns, mit euren Fotos) oder 'play' (spielbare Werbung, play = Spiel-id)
  // In levels kann ad auch eine Liste sein: [4, 0] = zwei Spots hintereinander
  ads: [
    { kind: 'ki', img: 'assets/gen/ad_pilz.png', fallbackEmoji: '🍄',
      brand: 'PILZ ROYALE™', headline: 'Der Premium-Pilz.', sub: 'Jetzt mit 30 % mehr Pilz. Handverlesen von einer KI, die noch nie einen Wald gesehen hat.',
      cta: 'Jetzt vorbestellen', price: 'nur 499,99 € / Stück' },
    { kind: 'wir', img: 'assets/photos/wald.jpg', fallbackEmoji: '🌲',
      brand: 'LAURENZ & MAGNUS GmbH', headline: 'Waldspaziergänge mit Profis.', sub: 'Wir lachen über alles. Wir tragen deinen Rucksack nicht. 5 Sterne von unseren Müttern.',
      cta: 'Termin buchen', price: 'Erste Wanderung gratis*', fine: '*Gratis heißt: du zahlst die Brotzeit.' },
    { kind: 'ki', img: 'assets/gen/ad_schuh.png', fallbackEmoji: '🥾',
      brand: 'GIPFELBOOST 3000', headline: 'Wanderschuhe mit Raketenantrieb.', sub: 'Warum laufen, wenn du fliegen kannst? Gipfel in 4 Sekunden. Landung nicht inklusive.',
      cta: 'Abheben', price: 'ab 3 Raten à 999 €' },
    { kind: 'wir', img: 'assets/photos/heirat.jpg', imgPos: '50% 15%', fallbackEmoji: '💍',
      brand: 'HERZBLATT IM WALD 💘', headline: 'Zu verheiraten: Niklas. 1× Mann, top gepflegt.', sub: 'Macht fast alleine Feuer. Trägt blaue Hosen mit Überzeugung. Lächelt auf Kommando. Bier und Campingstuhl inklusive.',
      cta: 'Jetzt Date anfragen 💍', price: 'Status: Hochzeit geplant 💍', fine: 'Nur für Bewerberinnen namens Eva.' },
    { kind: 'play', play: 'ad_kniffel', fallbackEmoji: '🎲',
      brand: 'KNIFFLIG™ – Das Würfelspiel', headline: 'Nur 1 % schaffen das!', sub: 'Würfle einen Fünferpasch und die Werbung ist weg. Oder warte 5 Sekunden wie ein Normalo.',
      cta: 'Jetzt installieren', price: 'Gratis* (*enthält 4.000 In-App-Käufe)' },
    { kind: 'play', play: 'ad_tutto', fallbackEmoji: '🎲',
      brand: 'ZOCK & ROLL™', headline: 'Zocken wie die Profis!', sub: 'Sammle 1000 Punkte und die Werbung verschwindet. Oder warte. Wie ein Feigling.',
      cta: 'Jetzt zocken', price: 'Ab 18. Spielen kann süchtig machen. Würfeln auch.' }
  ]
};
