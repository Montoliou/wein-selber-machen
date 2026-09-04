const pfade: Record<string, string> = {
  traube: '<circle cx="8" cy="7" r="2.3"/><circle cx="13" cy="7" r="2.3"/><circle cx="5.5" cy="11.5" r="2.3"/><circle cx="10.5" cy="11.5" r="2.3"/><circle cx="15.5" cy="11.5" r="2.3"/><circle cx="8" cy="16" r="2.3"/><circle cx="13" cy="16" r="2.3"/><path d="M10.5 4C11 2.5 12 1.7 14 1.5M11 4c-1.8-.9-3.3-.8-4.6.2"/>',
  kalender: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>',
  buch: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4H6.5A2.5 2.5 0 0 0 4 6.5z"/><path d="M4 6.5v13M8 8h8M8 11h6"/>',
  mehr: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1z"/>',
  messung: '<path d="M14 4.5a4 4 0 0 0-4 4V15a4 4 0 1 0 8 0V8.5a4 4 0 0 0-4-4z"/><path d="M14 8v7M10 12h4M6 4h3M6 8h2M6 12h2"/>',
  rechner: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h.01M16 19h.01"/>',
  gate: '<path d="M5 21V4h14v17M5 8h14M9 8v13M15 8v13"/>',
  pfeil: '<path d="m15 18-6-6 6-6"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  suche: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  klima: '<path d="M14 14.8V5a4 4 0 0 0-8 0v9.8a6 6 0 1 0 8 0z"/><path d="M10 9v8"/>',
  warnung: '<path d="M12 3 2.8 20h18.4z"/><path d="M12 9v4M12 17h.01"/>',
  kamera: '<path d="M4 7h3l1.5-2h7L17 7h3v12H4z"/><circle cx="12" cy="13" r="3"/>',
  runde: '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v6h-6"/><circle cx="12" cy="12" r="2"/>',
  journal: '<path d="M5 3h14v18H5zM8 3v18M11 8h5M11 12h5M11 16h3"/>',
}

export function icon(name: keyof typeof pfade, klasse = ''): string {
  return `<svg class="icon ${klasse}" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${pfade[name]}</svg>`
}
