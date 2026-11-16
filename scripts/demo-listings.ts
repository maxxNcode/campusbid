// Fictional demo listings for local development and the panel demo.
// Each photo in scripts/seed-photos/ is a plain grey placeholder that says
// "PLACEHOLDER IMAGE" and "Not a photo of a real item"; none is a real photo.
// Sold items get one completed request from the demo buyer, so their history
// matches how an item becomes sold in the app.

export type DemoListing = {
  photo: string // file name in scripts/seed-photos/, without .png
  seller: 'seller' | 'buyer'
  categorySlug: string
  program: string
  title: string
  description: string
  price: string
  condition: 'new' | 'like_new' | 'good' | 'fair' | 'poor'
  modelOrEdition: string | null
  includedParts: string | null
  knownDefects: string
  status: 'active' | 'sold' | 'withdrawn'
}

// Listed in this order, so the last one is the newest.
export const DEMO_LISTINGS: DemoListing[] = [
  {
    photo: 'dsa-java-6th',
    seller: 'seller',
    categorySlug: 'reference-books',
    program: 'BS Information Technology',
    title: 'Data Structures and Algorithms in Java, 6th ed.',
    description: 'Used for Data Structures in second year. Binding is tight and all pages are there.',
    price: '750.00',
    condition: 'good',
    modelOrEdition: '6th edition',
    includedParts: null,
    knownDefects: 'Pencil notes in chapters 7 to 9.',
    status: 'sold',
  },
  {
    photo: 'casio-fx-570ms',
    seller: 'seller',
    categorySlug: 'calculators',
    program: 'BS Mechanical Engineering',
    title: 'Casio fx-570MS calculator',
    description: 'Reliable scientific calculator, fine for exams that do not allow programmable models.',
    price: '380.00',
    condition: 'fair',
    modelOrEdition: 'fx-570MS',
    includedParts: 'Slide cover included.',
    knownDefects: 'Battery is weak and the display is slightly faded.',
    status: 'sold',
  },
  {
    photo: 'mechanical-pencil-set',
    seller: 'seller',
    categorySlug: 'other-supplies',
    program: 'BS Mechanical Engineering',
    title: 'Mechanical pencil set (0.3, 0.5, 0.7 mm)',
    description: 'Three drafting mechanical pencils with spare leads, used for one semester of drawing.',
    price: '120.00',
    condition: 'good',
    modelOrEdition: null,
    includedParts: 'Three pencils and one tube of 0.5 mm leads.',
    knownDefects: 'Clip on the 0.7 mm pencil is bent.',
    status: 'withdrawn',
  },
  {
    photo: 'technical-drawing-15th',
    seller: 'seller',
    categorySlug: 'reference-books',
    program: 'BS Mechanical Engineering',
    title: 'Technical Drawing with Engineering Graphics, 15th ed.',
    description: 'Reference book for engineering drawing and descriptive geometry courses.',
    price: '900.00',
    condition: 'fair',
    modelOrEdition: '15th edition',
    includedParts: null,
    knownDefects: 'Highlighting in chapters 3 to 5; the front cover corner is bent.',
    status: 'active',
  },
  {
    photo: 'strength-of-materials',
    seller: 'buyer',
    categorySlug: 'reference-books',
    program: 'BS Civil Engineering',
    title: 'Strength of Materials reference book',
    description: 'Covers stress, strain, torsion and beam deflection. Useful for second-year civil students.',
    price: '600.00',
    condition: 'good',
    modelOrEdition: '4th edition',
    includedParts: null,
    knownDefects: 'Previous owner wrote a name on the first page.',
    status: 'active',
  },
  {
    photo: 't-square-24in',
    seller: 'seller',
    categorySlug: 'drafting-tools',
    program: 'BS Civil Engineering',
    title: 'T-square, 24 inch',
    description: 'Wooden T-square with a clear acrylic edge for plate work on a standard drawing board.',
    price: '180.00',
    condition: 'good',
    modelOrEdition: null,
    includedParts: null,
    knownDefects: 'Small nick on the head; the edge is still straight.',
    status: 'active',
  },
  {
    photo: 'breadboard-multimeter',
    seller: 'buyer',
    categorySlug: 'project-kits',
    program: 'BS Information Technology',
    title: 'Breadboard and digital multimeter bundle',
    description: 'Full-size breadboard and a basic digital multimeter for circuits and IoT projects.',
    price: '550.00',
    condition: 'fair',
    modelOrEdition: null,
    includedParts: 'Breadboard, multimeter, two test leads.',
    knownDefects: 'One probe tip is worn.',
    status: 'active',
  },
  {
    photo: 'triangular-scale',
    seller: 'buyer',
    categorySlug: 'drafting-tools',
    program: 'BS Civil Engineering',
    title: 'Triangular engineering scale ruler',
    description: '30 cm triangular scale with six metric scales for plans and site drawings.',
    price: '150.00',
    condition: 'like_new',
    modelOrEdition: null,
    includedParts: null,
    knownDefects: 'None known.',
    status: 'active',
  },
  {
    photo: 'arduino-uno-kit',
    seller: 'seller',
    categorySlug: 'project-kits',
    program: 'BS Information Technology',
    title: 'Arduino Uno starter kit',
    description: 'Starter kit from my embedded systems class. Board tested and working last week.',
    price: '1200.00',
    condition: 'like_new',
    modelOrEdition: 'Uno R3',
    includedParts: 'Board, USB cable, breadboard and about 40 jumper wires. The LCD module is missing.',
    knownDefects: 'None known.',
    status: 'active',
  },
  {
    photo: 'casio-fx-991es-plus',
    seller: 'seller',
    categorySlug: 'calculators',
    program: 'BS Civil Engineering',
    title: 'Casio fx-991ES Plus scientific calculator',
    description: 'Scientific calculator with equation and matrix modes. Works well, solar and battery.',
    price: '650.00',
    condition: 'good',
    modelOrEdition: 'fx-991ES Plus',
    includedParts: 'Hard cover included; no manual.',
    knownDefects: 'Light scratches on the cover.',
    status: 'active',
  },
]
