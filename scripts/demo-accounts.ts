// Fictional demo accounts for local development and the panel demo.
// The names are invented and the example.test domain cannot receive email.
// Every address ending in @example.test is demo data and is excluded from
// pilot metrics.

export type DemoAccount = {
  key: 'admin' | 'buyer' | 'seller' | 'pending'
  email: string
  fullName: string
  program: string
  yearLevel: number
  isAdmin: boolean
  approvalStatus: 'approved' | 'pending'
}

export const DEMO_EMAIL_DOMAIN = 'example.test'

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    key: 'admin',
    email: 'admin@example.test',
    fullName: 'Rosa Villanueva',
    program: 'BS Information Technology',
    yearLevel: 4,
    isAdmin: true,
    approvalStatus: 'approved',
  },
  {
    key: 'buyer',
    email: 'buyer@example.test',
    fullName: 'Carla Mendoza',
    program: 'BS Civil Engineering',
    yearLevel: 1,
    isAdmin: false,
    approvalStatus: 'approved',
  },
  {
    key: 'seller',
    email: 'seller@example.test',
    fullName: 'Paolo Santos',
    program: 'BS Information Technology',
    yearLevel: 4,
    isAdmin: false,
    approvalStatus: 'approved',
  },
  {
    key: 'pending',
    email: 'pending@example.test',
    fullName: 'Miguel Tan',
    program: 'BS Mechanical Engineering',
    yearLevel: 3,
    isAdmin: false,
    approvalStatus: 'pending',
  },
]

export const CATEGORIES = [
  { name: 'Calculators', slug: 'calculators' },
  { name: 'Reference books', slug: 'reference-books' },
  { name: 'Drafting tools', slug: 'drafting-tools' },
  { name: 'Project kits', slug: 'project-kits' },
  { name: 'Other supplies', slug: 'other-supplies' },
]
