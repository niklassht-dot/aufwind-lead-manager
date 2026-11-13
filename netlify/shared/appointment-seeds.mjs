/* ==========================================================
   Termine, die einmalig in den gemeinsamen Kalender übernommen
   werden (Abgleich mit dem Lead über den Firmennamen).
   Jedes Paket nur einmal – gelöschte Termine kommen nicht zurück.
   ========================================================== */

export const APPOINTMENT_SEEDS = [
  {
    id: "2026-11-13-gespraeche-bmb-gumpfer",
    items: [
      {
        date: "2026-11-18",
        time: "16:00",
        duration: 60,
        type: "Persönliches Gespräch",
        status: "vorgemerkt",
        leadName: "Bau- und Montagebetrieb Reich (BMB Stralsund)",
        title: "Persönliches Gespräch BMB",
        location: "Stralsund (Tribseer Wiesen 52?) – Ort noch bestätigen",
        notes: "Herr Reich: „Wir können einen Termin vereinbaren und dann dürfen Sie mich überzeugen.“ Entwurf mitbringen."
      },
      {
        date: "2026-11-20",
        time: "14:30",
        duration: 60,
        type: "Persönliches Gespräch",
        status: "vorgemerkt",
        leadName: "Café Gumpfer",
        title: "Persönliches Gespräch Café Gumpfer",
        location: "Café Gumpfer, Am Ozeaneum, Stralsund",
        notes: "Terminvorschlag geschickt – Bestätigung abwarten."
      }
    ]
  }
];
