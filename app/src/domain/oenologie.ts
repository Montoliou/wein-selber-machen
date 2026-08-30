// Önologische Rechnungen. Rein, deterministisch, ohne Seiteneffekte.
// Jede Funktion liefert neben dem Wert eine Herkunftsangabe, damit die UI
// Unsicherheit sichtbar machen kann (Audit-Regel 15).

export interface Rechenergebnis {
  wert: number
  einheit: string
  formel: string
  sicherheit: 'gemessen' | 'gerechnet' | 'geschaetzt'
  hinweise: string[]
}

/** Kaliumpyrosulfit K2S2O5: molare Masse 222,32 g/mol, setzt 2x SO2 (128,13 g/mol) frei. */
export const SO2_ANTEIL_KPS = (2 * 64.065) / 222.32   // ≈ 0,5764
/** 1 g Kaliumpyrosulfit liefert rechnerisch so viel SO2 in mg. */
export const SO2_MG_PRO_G_KPS = SO2_ANTEIL_KPS * 1000  // ≈ 576,4

/** pKa der schwefligen Säure, erste Dissoziationsstufe. */
export const PKA_SO2 = 1.81

/** Zielkorridor molekulares SO2 für trockenen Rotwein (mg/L). */
export const MOLEKULAR_ZIEL_ROT = { min: 0.5, max: 0.8 }

export function oechsleAusSg(sg: number): number {
  return (sg - 1) * 1000
}

export function sgAusOechsle(oe: number): number {
  return 1 + oe / 1000
}

/** Näherung; für Hobbyzwecke ausreichend, nicht für amtliche Angaben. */
export function brixAusOechsle(oe: number): number {
  return oe / 4.25
}

/**
 * Klassische deutsche Faustformel: Alkohol %vol ≈ °Oe / 8.
 * Bewusst als 'geschaetzt' markiert — der reale Wert hängt von Hefe,
 * Temperatur und Vergärungsgrad ab.
 */
export function alkoholPotenzial(oechsle: number): Rechenergebnis {
  return {
    wert: Math.round((oechsle / 8) * 10) / 10,
    einheit: '% vol',
    formel: '°Oe ÷ 8',
    sicherheit: 'geschaetzt',
    hinweise: ['Faustformel. Abweichung ±0,5 % vol je nach Hefe und Gärverlauf.'],
  }
}

/**
 * Zuckerzugabe zum Anheben des Mostgewichts.
 * 2,5 g Zucker je Liter heben um ca. 1 °Oe (entspricht 1 kg auf 100 L ≈ +4 °Oe).
 */
export function zuckerFuerOechsle(volumenLiter: number, istOe: number, zielOe: number): Rechenergebnis {
  const delta = zielOe - istOe
  const gramm = Math.max(0, volumenLiter * delta * 2.5)
  const hinweise: string[] = []
  const zielAlk = zielOe / 8
  if (delta <= 0) hinweise.push('Ziel liegt nicht über dem Istwert — keine Zugabe nötig.')
  if (zielAlk > 14) {
    hinweise.push(`Zielalkohol ~${zielAlk.toFixed(1)} % vol übersteigt die Toleranz gängiger Reinzuchthefen (ca. 14 % vol). Risiko einer stecken bleibenden Gärung mit Restzucker.`)
  }
  if (gramm > 0) {
    hinweise.push(`Zucker erhöht das Volumen um ca. ${(gramm / 1000 * 0.6).toFixed(2)} L.`)
    hinweise.push('In warmem Most oder etwas Saft vollständig auflösen, nicht trocken einstreuen.')
  }
  return {
    wert: Math.round(gramm),
    einheit: 'g Haushaltszucker',
    formel: `${volumenLiter} L × ${delta} °Oe × 2,5 g/(L·°Oe)`,
    sicherheit: 'gerechnet',
    hinweise,
  }
}

/**
 * Molekulares SO2 aus freiem SO2 und pH.
 * molekular = frei / (1 + 10^(pH − pKa))
 */
export function molekularesSo2(freiMgL: number, ph: number): Rechenergebnis {
  const wert = freiMgL / (1 + Math.pow(10, ph - PKA_SO2))
  const hinweise: string[] = []
  if (wert < MOLEKULAR_ZIEL_ROT.min) hinweise.push('Unter dem Schutzkorridor 0,5–0,8 mg/L — mikrobiologisch angreifbar.')
  if (wert > MOLEKULAR_ZIEL_ROT.max * 1.5) hinweise.push('Deutlich über dem Korridor — sensorisch als stechend wahrnehmbar.')
  return {
    wert: Math.round(wert * 100) / 100,
    einheit: 'mg/L molekular',
    formel: `${freiMgL} ÷ (1 + 10^(${ph} − 1,81))`,
    sicherheit: 'gerechnet',
    hinweise,
  }
}

/** Für den Zielkorridor benötigter freier SO2 bei gegebenem pH. */
export function freierSo2Ziel(ph: number, molekularZiel = 0.6): Rechenergebnis {
  const wert = molekularZiel * (1 + Math.pow(10, ph - PKA_SO2))
  return {
    wert: Math.round(wert),
    einheit: 'mg/L freier SO₂',
    formel: `${molekularZiel} × (1 + 10^(${ph} − 1,81))`,
    sicherheit: 'gerechnet',
    hinweise: [
      'Zielwert, kein Istwert. Ohne Titration des freien SO₂ bleibt der Istwert unbekannt.',
    ],
  }
}

export interface SchwefelVorschlag {
  kpsGramm: Rechenergebnis
  zielFrei: Rechenergebnis | null
  phBekannt: boolean
  bindungshinweis: string
}

/**
 * Schwefel-Dosierung. Ohne pH gibt es bewusst keinen Punktwert,
 * sondern eine Spanne (Audit-Regel 2 und 15).
 */
export function schwefelDosierung(
  volumenLiter: number,
  ph: number | null,
  freiIstMgL: number | null,
  molekularZiel = 0.6,
): SchwefelVorschlag {
  const hinweise: string[] = []
  let zielFreiMgL: number
  let zielFrei: Rechenergebnis | null = null

  if (ph !== null) {
    zielFrei = freierSo2Ziel(ph, molekularZiel)
    zielFreiMgL = zielFrei.wert
  } else {
    // Ohne pH: konservativer Mittelwert für Rotwein pH 3,4–3,8
    zielFreiMgL = 35
    hinweise.push('Kein pH-Wert vorhanden. Gerechnet wird mit einem Pauschalziel von 35 mg/L freiem SO₂ — das kann bei hohem pH deutlich zu wenig sein.')
  }

  const fehlend = freiIstMgL !== null
    ? Math.max(0, zielFreiMgL - freiIstMgL)
    : zielFreiMgL

  if (freiIstMgL === null) {
    hinweise.push('Freier SO₂ ist nicht gemessen. Die Rechnung unterstellt einen Ausgangswert von 0 mg/L und liefert damit eine Obergrenze, keine Punktdosis.')
  }

  // Bindungsverlust: bei der ersten Schwefelung nach der Gärung bleibt
  // erfahrungsgemäß nur ein Teil frei. Konservativ 50 % ansetzen.
  const bruttoMg = volumenLiter * fehlend / 0.5
  const gramm = bruttoMg / SO2_MG_PRO_G_KPS

  hinweise.push('Kaliumpyrosulfit vorher in wenig Wein oder Wasser auflösen, nie trocken einstreuen.')

  return {
    kpsGramm: {
      wert: Math.round(gramm * 100) / 100,
      einheit: 'g Kaliumpyrosulfit',
      formel: `(${volumenLiter} L × ${Math.round(fehlend)} mg/L ÷ 0,5 Bindungsfaktor) ÷ ${Math.round(SO2_MG_PRO_G_KPS)} mg/g`,
      sicherheit: freiIstMgL !== null && ph !== null ? 'gerechnet' : 'geschaetzt',
      hinweise,
    },
    zielFrei,
    phBekannt: ph !== null,
    bindungshinweis: 'Ein Teil des zugegebenen SO₂ bindet sofort an Zucker, Acetaldehyd und Farbstoffe. Ohne Titration ist der tatsächliche freie SO₂ danach unbekannt.',
  }
}

/** Hefenährsalz nach Herstellerangabe: bis 30 g je 100 L, in drei Portionen. */
export const NAEHRSALZ_MAX_G_PRO_100L = 30
export const NAEHRSALZ_PORTIONEN = 3

export function naehrsalzPlan(volumenLiter: number): {
  gesamtMax: number
  proPortion: number
  hinweise: string[]
} {
  const gesamt = (volumenLiter / 100) * NAEHRSALZ_MAX_G_PRO_100L
  return {
    gesamtMax: Math.round(gesamt * 10) / 10,
    proPortion: Math.round((gesamt / NAEHRSALZ_PORTIONEN) * 10) / 10,
    hinweise: [
      `Höchstmenge ${Math.round(gesamt * 10) / 10} g für ${volumenLiter} L, verteilt auf ${NAEHRSALZ_PORTIONEN} Gaben in der ersten Gärwoche.`,
      'Jede Portion vorher in ca. 100 ml Most oder Saft auflösen.',
      'Nach etwa zwei Dritteln des Gärverlaufs nimmt die Hefe keinen Stickstoff mehr auf — späte Gaben bleiben als Bakteriennahrung im Wein.',
      '2025 wurden 10 g auf einmal in einen kleinen Ansatz gegeben. Das war die Fehldosierung, die hier verhindert wird.',
    ],
  }
}

/** Kopfraum als Anteil des Füllvolumens. */
export function kopfraumAnteil(fuellLiter: number, kopfraumLiter: number): number {
  if (fuellLiter <= 0) return 0
  return kopfraumLiter / fuellLiter
}

/** Erwartete Weinausbeute aus entrappten roten Trauben (Maischegärung inkl. Presswein). */
export function ausbeuteAusTrauben(kgEntrappt: number): { min: number; max: number; hinweis: string } {
  return {
    min: Math.round(kgEntrappt * 0.65),
    max: Math.round(kgEntrappt * 0.75),
    hinweis: 'Erfahrungswert 65–75 L je 100 kg entrappter roter Trauben, Presswein eingerechnet.',
  }
}

/** Benötigtes Brutto-Gärvolumen: Maische darf höchstens zu 70 % einfüllen (Tresterhut steigt). */
export const MAX_FUELLGRAD_MAISCHE = 0.7

export function maischeVolumen(kgEntrappt: number): number {
  return Math.round(kgEntrappt * 0.9)
}

export function benoetigtesGaervolumen(kgEntrappt: number): number {
  return Math.round(maischeVolumen(kgEntrappt) / MAX_FUELLGRAD_MAISCHE)
}
