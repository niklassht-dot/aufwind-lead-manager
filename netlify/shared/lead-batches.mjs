/* ==========================================================
   Lead-Pakete, die beim nächsten Laden einmalig in die gemeinsame
   Liste übernommen werden (atomar, ohne Doppelte – Abgleich über
   den Firmennamen). Jedes Paket wird nur einmal angewendet; wer
   danach einen Lead löscht, bekommt ihn nicht zurück.
   ========================================================== */

export const LEAD_BATCHES = [
  {
    id: "2026-11-10-bmb-stralsund",
    leads: [
      {
        company: "Bau- und Montagebetrieb Reich (BMB Stralsund)",
        contact: "Thomas Reich (staatl. gepr. Bautechniker)",
        phone: "0176 40553731",
        website: "https://www.bmb-stralsund.de",
        status: "Entwurf in Arbeit",
        notes: "Mail-Antwort 10.11.2026: „Wir können einen Termin vereinbaren und dann dürfen Sie mich überzeugen.“ → Termin vorschlagen, Entwurf zum Termin mitbringen.\nTribseer Wiesen 52, Stralsund\nE-Mail: t.reich@bmb-stralsund.de · info@bmb-stralsund.de"
      }
    ]
  },
  {
    id: "2026-11-08-fahrradverleih-garz",
    leads: [
      {
        company: "Fahrradverleih Garz",
        contact: "",
        phone: "",
        website: "https://www.mein-fahrradverleih.de",
        status: "Entwurf in Arbeit",
        notes: "Mail-Antwort (Wochenende 07./08.11.2026): „Ja schick gerne rüber“.\nFahrradverleih in Garz (Rügen). Telefon und Ansprechpartner nicht gefunden – beim Entwurf-Versand erfragen bzw. im Impressum der Website nachsehen.\nE-Mail: kontakt@mein-fahrradverleih.de"
      }
    ]
  },
  {
    id: "2026-11-06-pieper-catering",
    leads: [
      {
        company: "Pieper Catering",
        contact: "René Pieper",
        phone: "03821 7098010",
        website: "https://www.pieper-catering.de",
        status: "Entwurf in Arbeit",
        notes: "Mail-Antwort 06.11.2026: „Sie sind wirklich hartnäckig… Wenn es Sie glücklich macht, schicken Sie mir gern Ihren unverbindlichen Entwurf.“ → eher skeptisch, Entwurf muss sofort überzeugen.\nAm Bleicherberg 1a, 18311 Ribnitz-Damgarten\nE-Mail: info@pieper-catering.de"
      }
    ]
  },
  {
    id: "2026-11-06-instantly-antworten-2",
    leads: [
      {
        company: "Dog Working Team Hundeschule",
        contact: "Antje Kretschmann",
        phone: "",
        website: "https://www.dog-working-team.de",
        status: "Entwurf in Arbeit",
        notes: "Mail-Antwort 06.11.2026: „Den Entwurf schaue ich mir gern an, sofern er kostenlos ist. Den Preis für eine neue Seite hätte ich auch gern gleich gewusst.“ → antworten: Entwurf kostenlos + Preis nennen.\nTelefon/Ort nicht gefunden – beim Antworten erfragen.\nE-Mail: info@dog-working-team.de"
      },
      {
        company: "Tischlerei Salzwedel",
        contact: "Dirk Salzwedel",
        phone: "0381 6006913",
        website: "https://www.tischlerei-salzwedel.de",
        status: "Entwurf in Arbeit",
        notes: "Mail-Antwort 06.11.2026: „Ich würde mir Ihren Entwurf mal unverbindlich ansehen. Grüße aus Bentwisch.“\nAm Umspannwerk 2, 18182 Bentwisch\nE-Mail: info@tischlerei-salzwedel.de"
      },
      {
        company: "Bauservice Nord GmbH",
        contact: "Felix Puschmann (GF)",
        phone: "0385 6173974",
        website: "https://www.bauservice-nord.com",
        status: "Entwurf in Arbeit",
        notes: "Mail-Antwort 06.11.2026: „Moin, na ich bin gespannt, gern her damit.“\nWerkstraße 305, 19061 Schwerin · Mobil 0151 15150120 · Fax 0385 6173976 · HRB 9338 AG Schwerin\nE-Mail: info@bauservice-nord.com"
      }
    ]
  },
  {
    id: "2026-11-06-instantly-antworten",
    leads: [
      {
        company: "Kiteschule Rügen",
        contact: "Tim Dallmann",
        phone: "+49 157 73990523",
        website: "https://www.kiteschule-ruegen.de",
        status: "Entwurf in Arbeit",
        notes: "Mail-Antwort 06.11.2026: „Moin Niklas :) endlich mal ein Local! Klar – gerne, schau ich mir gerne an.“ → sehr positiv, Local-Bonus nutzen.\nKiteschule auf Rügen + Kiteclub in Sri Lanka (kiteclub-kalpitiya.com). Buchung läuft über eigene App: getstoked.web.app/book. Slogan „GET STOKED“.\nE-Mail: info@kiteschule-ruegen.de"
      },
      {
        company: "Reethäuser auf Rügen (Rohrhus Service- und Vermittlungs GmbH)",
        contact: "Rainer Behling (GF)",
        phone: "038308 5480",
        website: "https://www.rohrhus-ruegen.de",
        status: "Entwurf in Arbeit",
        notes: "Mail-Antwort 06.11.2026: „Ja gerne“.\nVermietung von Reetdach-Ferienhäusern auf Mönchgut (auch über Booking/Expedia gelistet).\nDorfstr. 07, 18586 Mönchgut\nE-Mail: kontakt@rohrhus-ruegen.de · ruegen-rohrhus@t-online.de"
      },
      {
        company: "igroup Internetagentur",
        contact: "Nikolai Tauscher (Geschäftsführung)",
        phone: "+49 7253 9875600",
        website: "https://www.i-group.de",
        status: "Entwurf in Arbeit",
        notes: "Mail-Antwort 06.11.2026: „Sehr gerne, ab dafür mit dem Entwurf, schick mal rüber, wir sind gespannt, wieviel mehr da geht 😊👍“\nAchtung: selbst Webdesign-Agentur (Bad Schönborn, BW) → Entwurf muss technisch/gestalterisch klar überzeugen.\nE-Mail: n.tauscher@i-group.de · info@i-group.de · facebook.com/igroup.internetagentur"
      }
    ]
  },
  {
    id: "2026-11-05-blumencafe-ruegen",
    leads: [
      {
        company: "Blumencafé Rügen – Sök di wat ut!",
        contact: "Christin Kieck",
        phone: "038391 769932",
        website: "https://www.blumencafe-ruegen.de",
        status: "Entwurf in Arbeit",
        notes: "Mail-Antwort 05.11.2026: „Ist dies mit Kosten für mich verbunden?“ → kurz antworten (Entwurf kostenlos & unverbindlich) und Entwurf schicken.\nCafé + Floristik: hausgemachte Kuchen/Torten, Baumkuchen aus eigenem Ofen, Aufstriche & Säfte aus regionalem Obst, Sträuße/Gestecke/Kränze, Hochzeitsfloristik, Sommergarten mit Tieren.\nGerhart-Hauptmann-Str. 6, 18556 Wiek (Rügen)\nE-Mail: info@blumencafe-ruegen.de"
      }
    ]
  },
  {
    id: "2026-11-05-ruegen-architektur",
    leads: [
      {
        company: "Rügen Architektur",
        contact: "Mathias Schurig (Architekt M.Sc.)",
        phone: "0151 16576301",
        website: "https://www.pi-ip.de",
        status: "Anrufen",
        notes: "Architekturbüro: vom Einfamilienhaus bis zum Industriegebäude (Sanierung, Bauantrag, Planung, Bauüberwachung) + Prototyping (Handmade, 3D-Druck, CNC).\nBergener Str. 16, 18573 Altefähr (Rügen)\nAktuelle Seite: IONOS-Baukasten, wenig Inhalt, Domain passt nicht zum Namen (pi-ip.de), Kontakt-Mail ist eine GMX-Adresse (whitewater81@gmx.de) → Ansatzpunkte für den Entwurf.\nTelefon steht auf der Website ohne führende 0 – vor dem Anruf prüfen."
      }
    ]
  },
  {
    id: "2026-11-03-coach-ayk",
    leads: [
      {
        company: "Coach Ayk – Online Fitness Coach",
        contact: "Ayk Brammann",
        phone: "",
        website: "https://coachayk.com",
        status: "Entwurf in Arbeit",
        notes: "Mail-Antwort 02.11.2026: „Ist dein/euer Entwurf kostenfrei?“ → kurz antworten (ja, unverbindlich) und Entwurf schicken.\nOnline Coaching + Personal Training (Remote Coach, Training über TrueCoach-App). Aktuelle Seite mit Baukasten (IONOS MyWebsite Now) gebaut, keine Telefonnummer und kein Ort auf der Website.\nE-Mail: contact@coachayk.com · Instagram: @aykbrammann"
      }
    ]
  },
  {
    id: "2026-11-02-neptun",
    leads: [
      {
        company: "Neptun Fachhandel e.K.",
        contact: "Roland Stade",
        phone: "0381 683637",
        website: "https://www.neptunfachhandel.de",
        status: "Entwurf in Arbeit",
        notes: "Mail-Antwort 02.11.2026 (über Instantly): „ja“ → möchte den Entwurf.\nGartengeräte-Fachhandel (u. a. Husqvarna-Händler, Motorgeräte, Wartung/Reparatur) · Neubrandenburger Str. 2c, 18055 Rostock\nE-Mail: info@neptunfachhandel.de"
      }
    ]
  },
  {
    id: "2026-10-29-mail-antworten",
    leads: [
      {
        company: "Tasler Immobilienbewertung",
        contact: "Matthias Tasler",
        phone: "+49 174 33 13 13 3",
        website: "https://www.tasler-immobilienbewertung.de",
        status: "Entwurf in Arbeit",
        notes: "Mail-Antwort: „Wenn es keine 0815 KI-Seite ist, bin ich an einem Entwurf interessiert.“ → Entwurf muss individuell/hochwertig wirken.\nDiplom-Sachverständiger für Immobilienbewertung (DIA), DIAZert (LS), MBA Immobilienmanagement.\nE-Mail: kontakt@tasler-immobilienbewertung.de"
      },
      {
        company: "Kartoffelkogge",
        contact: "Michaela Güllstorf & Sascha Rath",
        phone: "0157 54 83 84 12",
        website: "https://www.kartoffelkogge.de",
        status: "Entwurf in Arbeit",
        notes: "Mail-Antwort: „Danke für das Angebot. Wir schauen uns das gern einmal an.“\nGüllstorf & Rath GbR · Parkstr. 7, 18057 Rostock\nE-Mail: info@kartoffelkogge.de"
      },
      {
        company: "Hannes Brandenburg – Privatkoch & Event",
        contact: "Hannes Brandenburg",
        phone: "0172 3233 027",
        website: "",
        status: "Entwurf in Arbeit",
        notes: "Mail-Antwort: „Na los“.\nCatering · Kochkurse · Pop-up-Events · Mietkoch. Zu sehen bei NDR Nordtour („Der Pop-up-König“, Probekochen für „From Garden to Table“).\nE-Mail: kontakthannesbrandenburg@gmail.com\nWebsite + Instagram sind in seiner Signatur verlinkt – Adresse aus der Mail übernehmen."
      },
      {
        company: "Burwitz Legendär Rostock",
        contact: "Anja Düwiger",
        phone: "+49 381 37 566 733",
        website: "https://www.burwitz-legendaer.de",
        status: "Entwurf in Arbeit",
        notes: "Mail-Antwort: „Na dann sind wir ja mal gespannt 😊“\nMathias & Anja Düwiger GbR · Neuer Markt 16, 18055 Rostock\nE-Mail: a.duewiger@burwitz-legendaer.de · Fax +49 381 37 566 734"
      },
      {
        company: "Oceans 7 (Ocean's Heaven 7 GmbH)",
        contact: "Frank Sofka (Geschäftsführer)",
        phone: "+49 15565 413084",
        website: "https://www.oceans-7.de",
        status: "Entwurf in Arbeit",
        notes: "Hat per Mail geantwortet (Entwurf gewünscht).\nRestaurant (Fisch/Seafood) · Kempowski-Ufer 7, 18055 Rostock · HRB 16307 AG Rostock\nE-Mail: info@oceans-7.de\nTelefon laut Restaurantportal, noch nicht bestätigt."
      },
      {
        company: "Hafenpub Port 36",
        contact: "Michael Weber",
        phone: "+49 381 25264568",
        website: "https://www.port36-rostock.de",
        status: "Entwurf in Arbeit",
        notes: "Mail-Antwort: „Wann möchtest Du uns das zeigen, was du entwickelt hast. Bitte Entwurf senden.“\nWokrenter Str. 36, 18055 Rostock\nE-Mail: port36-rostock@web.de"
      },
      {
        company: "Haustechnik Sagard",
        contact: "v. Einsiedel",
        phone: "038302 2004",
        website: "https://www.haustechnik-sagard.de",
        status: "Entwurf in Arbeit",
        notes: "Mail-Antwort: „Sie können gern unverbindlich den Entwurf senden. Vielleicht überzeugt er mich ja.“\nSassnitzer Str. 18, 18551 Sagard (Rügen)\nE-Mail: info@haustechnik-sagard.de"
      }
    ]
  }
];

export const companyKey = (s) =>
  String(s || "").toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z0-9äöüß]/g, "");
