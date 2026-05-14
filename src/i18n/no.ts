export const t = {
  appName: 'Perlemonster',
  tagline: 'Lag ditt eget perlemønster!',

  // Home
  pathATitle: 'Last opp bilde',
  pathADesc: 'Gjør et foto eller tegning om til et perlemønster',
  pathBTitle: 'Få idéer',
  pathBDesc: 'La Perlemonsteret tegne noe for deg',
  footer: 'Bildene dine forlater aldri datamaskinen din.',

  // Upload
  uploadTitle: 'Last opp et bilde',
  uploadDrop: 'Slipp bildet her, eller',
  uploadBrowse: 'velg fil',
  uploadHint: 'JPG, PNG eller WebP • maks 10 MB',
  uploadBack: '← Tilbake',

  // Crop
  cropTitle: 'Klipp ut firkant',
  cropHint: 'Dra og endre størrelse på firkanten',
  cropNext: 'Bruk dette utsnitt →',
  cropBack: '← Last opp nytt',

  // Convert
  convertTitle: 'Innstillinger',
  convertColors: 'Antall farger',
  convertStyle: 'Stil',
  convertGlatt: 'Glatt',
  convertSkarp: 'Skarp',
  convertGlattDesc: 'Myk overgang mellom farger',
  convertSkarpDesc: 'Tydelige kanter',
  convertGo: 'Lag perlemønster! 🎉',
  convertBack: '← Klipp på nytt',
  convertConverting: 'Lager mønster…',

  // TagPicker
  tagPickerTitle: 'Hva vil du lage?',
  tagMoodLabel: 'Velg stemning',
  tagSubjectLabel: 'Velg motiv',
  tagSizeLabel: 'Velg størrelse',
  sizes: [
    { id: 'small',    label: 'Liten',     desc: '11×11' },
    { id: 'portrait', label: 'Portrett',  desc: '13×21' },
    { id: 'square',   label: 'Kvadrat',   desc: '19×19' },
    { id: 'large',    label: 'Stor',      desc: '29×29' },
  ] as { id: string; label: string; desc: string }[],
  tagGenerate: 'Lag idé! ✨',
  tagGenerating: 'Perlemonsteret tegner…',
  tagNew: '🎲 Gi meg en ny',
  tagBack: '← Tilbake',
  tagMoodRequired: 'Velg minst én stemning',
  tagSubjectRequired: 'Velg et motiv',
  tagCounter: (used: number, max: number) => `${used} av ${max} idéer i dag`,
  tagRateLimit: 'Du har laget mange idéer i dag! Prøv igjen i morgen, eller last opp et bilde.',
  tagError: 'Perlemonsteret sover. Prøv igjen om et øyeblikk! 😴',

  moods: [
    { id: 'søt',     label: 'Søt 🥰' },
    { id: 'morsom',  label: 'Morsom 😄' },
    { id: 'skummel', label: 'Skummel 👻' },
    { id: 'kul',     label: 'Kul 😎' },
    { id: 'magisk',  label: 'Magisk 🪄' },
    { id: 'snill',   label: 'Snill 💚' },
  ],

  subjects: [
    { id: 'dyr',      label: 'Dyr 🐱' },
    { id: 'monster',  label: 'Monster 👹' },
    { id: 'mat',      label: 'Mat 🍕' },
    { id: 'romvesen', label: 'Romvesen 👽' },
    { id: 'eventyr',  label: 'Eventyr 🦄' },
    { id: 'kjøretøy', label: 'Kjøretøy 🚀' },
    { id: 'natur',    label: 'Natur 🌸' },
    { id: 'robot',    label: 'Robot 🤖' },
  ],

  // Edit
  editTitle: 'Rediger mønster',
  editUndo: '↩ Angre',
  editRedo: '↪ Gjenta',
  editReset: '🔄 Start på nytt',
  editColorPicker: 'Velg farge:',
  editNext: 'Ferdig! →',
  editBack: '← Tilbake',

  // Export
  exportTitle: 'Perfekt! Klar for PDF? 🎉',
  exportNameLabel: 'Navn på mønsteret (valgfritt)',
  exportNamePlaceholder: 'F.eks. Min katt, Romraketten…',
  exportPdf: '🖨️ Last ned PDF',
  exportShare: '🔗 Del med en venn',
  exportShareDone: '✅ Lenke kopiert!',
  exportNew: '🏠 Lag et nytt',
  exportBack: '← Rediger mer',
} as const
