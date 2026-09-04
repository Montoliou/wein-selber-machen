export type LayoutKlasse = 'telefon' | 'tablet' | 'schreibtisch'

/**
 * Einzige Quelle fuer die drei Oberflaechenklassen. Die Grenzwerte sind Teil
 * des abgenommenen UX-Konzepts; CSS leitet daraus keine zweite Logik ab.
 */
export function layoutKlasse(breite: number): LayoutKlasse {
  if (breite < 600) return 'telefon'
  if (breite < 1200) return 'tablet'
  return 'schreibtisch'
}
