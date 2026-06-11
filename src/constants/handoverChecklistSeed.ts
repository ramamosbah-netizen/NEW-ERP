// ============================================================
// JEET ERP — Handover Checklist Default Requirements
// ============================================================

export interface SeedHandoverRequirement {
  category: 'T&C' | 'Snags' | 'O&M' | 'Warranty' | 'SIRA' | 'Training' | 'Commercial';
  requirement: string;
  mandatory: boolean;
  sort: number;
}

export const HANDOVER_CHECKLIST_SEED: SeedHandoverRequirement[] = [
  // T&C Category
  {
    category: 'T&C',
    requirement: 'All system Testing & Commissioning packages completed and approved by witnesses',
    mandatory: true,
    sort: 10
  },
  {
    category: 'T&C',
    requirement: 'T&C Reports compiled and signed off by Client Representative',
    mandatory: true,
    sort: 20
  },

  // Snag List Category
  {
    category: 'Snags',
    requirement: 'All critical and major snags resolved, closed, and verified',
    mandatory: true,
    sort: 30
  },
  {
    category: 'Snags',
    requirement: 'Minor snags either resolved or deferred to DLP with signed client authorization',
    mandatory: true,
    sort: 40
  },

  // O&M Category
  {
    category: 'O&M',
    requirement: 'Operation & Maintenance (O&M) manuals compiled and uploaded to DMS',
    mandatory: true,
    sort: 50
  },
  {
    category: 'O&M',
    requirement: 'Final Approved As-Built Drawings filed under project DMS space',
    mandatory: true,
    sort: 60
  },

  // Warranty Category
  {
    category: 'Warranty',
    requirement: 'Manufacturer warranty certificates for all major equipment uploaded to DMS',
    mandatory: true,
    sort: 70
  },
  {
    category: 'Warranty',
    requirement: 'JEET Installation warranty certificate issued and signed',
    mandatory: true,
    sort: 80
  },

  // SIRA Category
  {
    category: 'SIRA',
    requirement: 'SIRA inspection successfully passed and SIRA connection certificate uploaded (applicable if CCTV present)',
    mandatory: false,
    sort: 90
  },

  // Training Category
  {
    category: 'Training',
    requirement: 'Client operational training conducted, attendee logs signed and uploaded',
    mandatory: true,
    sort: 100
  },

  // Commercial Category
  {
    category: 'Commercial',
    requirement: 'Final progress invoice submitted and approved',
    mandatory: true,
    sort: 110
  },
  {
    category: 'Commercial',
    requirement: 'Retention release draft invoice (50%) generated and scheduled in the retention ledger',
    mandatory: true,
    sort: 120
  }
];
