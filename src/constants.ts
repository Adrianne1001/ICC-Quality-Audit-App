export const DEPARTMENTS = [
  'Practice Management & Delivery',
  'Business Application Consulting',
  'Engineering & Architecture',
  'Quality Assurance & Testing',
  'Application Support',
] as const;

export type Department = typeof DEPARTMENTS[number];

export const COMPANY_WIDE_DEPARTMENT = 'Company-wide';
