import { z } from 'zod';

// ==================== COMMON VALIDATIONS ====================

const requiredString = (field: string) => z.string().min(1, `${field} zorunludur`);

const optionalString = z.string().optional().or(z.literal(''));

const positiveNumber = (field: string) =>
  z
    .string()
    .min(1, `${field} zorunludur`)
    .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
      message: `${field} pozitif bir sayı olmalıdır`,
    });

const nonNegativeNumber = (field: string) =>
  z
    .string()
    .refine((val) => val === '' || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0), {
      message: `${field} negatif olamaz`,
    })
    .optional();

const dateString = (field: string) => z.string().min(1, `${field} zorunludur`);

const optionalDate = z.string().optional().or(z.literal(''));

const emailValidation = z
  .string()
  .optional()
  .or(z.literal(''))
  .refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
    message: 'Geçerli bir e-posta adresi giriniz',
  });

const phoneValidation = z
  .string()
  .optional()
  .or(z.literal(''))
  .refine((val) => !val || /^[0-9+\-\s()]+$/.test(val), {
    message: 'Geçerli bir telefon numarası giriniz',
  });

const ibanValidation = z
  .string()
  .optional()
  .or(z.literal(''))
  .refine(
    (val) =>
      !val || /^[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}([A-Z0-9]?){0,16}$/.test(val.replace(/\s/g, '')),
    {
      message: 'Geçerli bir IBAN giriniz',
    }
  );

const tcNumberValidation = z
  .string()
  .optional()
  .or(z.literal(''))
  .refine((val) => !val || /^[1-9][0-9]{10}$/.test(val), {
    message: 'Geçerli bir TC Kimlik No giriniz (11 haneli)',
  });

const taxNumberValidation = z
  .string()
  .optional()
  .or(z.literal(''))
  .refine((val) => !val || /^[0-9]{10}$/.test(val), {
    message: 'Geçerli bir Vergi No giriniz (10 haneli)',
  });

// ==================== COMPANY SCHEMA ====================

export const companySchema = z.object({
  type: z.enum(['person', 'company'], {
    message: 'Hesap türü seçiniz',
  }),
  account_type: z.enum(['customer', 'supplier', 'subcontractor', 'investor'], {
    message: 'Hesap tipi seçiniz',
  }),
  name: requiredString('Firma/Kişi adı'),
  tc_number: tcNumberValidation,
  profession: optionalString,
  tax_office: optionalString,
  tax_number: taxNumberValidation,
  trade_registry_no: optionalString,
  contact_person: optionalString,
  phone: phoneValidation,
  email: emailValidation,
  address: optionalString,
  bank_name: optionalString,
  iban: ibanValidation,
  notes: optionalString,
});

export type CompanyFormData = z.infer<typeof companySchema>;

// ==================== PROJECT SCHEMA ====================

export const projectSchema = z
  .object({
    code: requiredString('Proje kodu'),
    name: requiredString('Proje adı'),
    ownership_type: z.enum(['own', 'client'], {
      message: 'Proje türü seçiniz',
    }),
    client_company_id: optionalString,
    status: z.enum(['planned', 'active', 'completed', 'cancelled'], {
      message: 'Durum seçiniz',
    }),
    project_type: z
      .enum(['residential', 'villa', 'commercial', 'mixed', 'infrastructure', 'renovation'])
      .optional()
      .or(z.literal('')),
    location: optionalString,
    total_area: nonNegativeNumber('Toplam alan'),
    unit_count: nonNegativeNumber('Birim sayısı'),
    estimated_budget: nonNegativeNumber('Tahmini bütçe'),
    planned_start: optionalDate,
    planned_end: optionalDate,
    actual_start: optionalDate,
    actual_end: optionalDate,
    description: optionalString,
  })
  .refine(
    (data) => {
      // End date must be after start date
      if (data.planned_start && data.planned_end) {
        return new Date(data.planned_end) >= new Date(data.planned_start);
      }
      return true;
    },
    {
      message: 'Planlanan bitiş tarihi, başlangıç tarihinden önce olamaz',
      path: ['planned_end'],
    }
  )
  .refine(
    (data) => {
      if (data.actual_start && data.actual_end) {
        return new Date(data.actual_end) >= new Date(data.actual_start);
      }
      return true;
    },
    {
      message: 'Gerçek bitiş tarihi, başlangıç tarihinden önce olamaz',
      path: ['actual_end'],
    }
  );

export type ProjectFormData = z.infer<typeof projectSchema>;

// ==================== TRANSACTION SCHEMA ====================

export const transactionSchema = z.object({
  type: z.enum(['invoice_out', 'payment_in', 'invoice_in', 'payment_out'], {
    message: 'İşlem türü seçiniz',
  }),
  date: dateString('Tarih'),
  description: requiredString('Açıklama'),
  amount: positiveNumber('Tutar'),
  currency: z.enum(['TRY', 'USD', 'EUR']).default('TRY'),
  category_id: optionalString,
  company_id: optionalString,
  project_id: optionalString,
  document_no: optionalString,
  notes: optionalString,
});

export type TransactionFormData = z.infer<typeof transactionSchema>;

// Firma hesabı için basitleştirilmiş işlem şeması
export const companyTransactionSchema = z.object({
  type: z.enum(['invoice_out', 'invoice_in'], {
    message: 'İşlem türü seçiniz',
  }),
  date: dateString('Tarih'),
  description: requiredString('Açıklama'),
  amount: positiveNumber('Tutar'),
  category_id: optionalString,
  document_no: optionalString,
  notes: optionalString,
});

export type CompanyTransactionFormData = z.infer<typeof companyTransactionSchema>;

// ==================== MATERIAL SCHEMA ====================

export const materialSchema = z.object({
  code: requiredString('Malzeme kodu'),
  name: requiredString('Malzeme adı'),
  category: optionalString,
  unit: requiredString('Birim'),
  min_stock: z
    .string()
    .refine((val) => val === '' || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0), {
      message: 'Minimum stok negatif olamaz',
    })
    .default('0'),
  notes: optionalString,
});

export type MaterialFormData = z.infer<typeof materialSchema>;

// ==================== STOCK MOVEMENT SCHEMA ====================

export const stockMovementSchema = z.object({
  material_id: requiredString('Malzeme'),
  movement_type: z.enum(['in', 'out', 'adjustment', 'waste'], {
    message: 'Hareket türü seçiniz',
  }),
  quantity: positiveNumber('Miktar'),
  unit_price: nonNegativeNumber('Birim fiyat'),
  project_id: optionalString,
  company_id: optionalString,
  date: dateString('Tarih'),
  description: optionalString,
  document_no: optionalString,
});

export type StockMovementFormData = z.infer<typeof stockMovementSchema>;

// ==================== CATEGORY SCHEMA ====================

export const categorySchema = z.object({
  name: requiredString('Kategori adı'),
  type: z.enum(['invoice_out', 'invoice_in', 'payment'], {
    message: 'Kategori türü seçiniz',
  }),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Geçerli bir renk seçiniz')
    .default('#6366f1'),
});

export type CategoryFormData = z.infer<typeof categorySchema>;

// ==================== VALIDATION HELPER ====================

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: Record<string, string>;
}

export function validateForm<T>(schema: z.ZodSchema<T>, data: unknown): ValidationResult<T> {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors: Record<string, string> = {};
  // Zod 4.x uses 'issues' with PropertyKey[] path
  const issues = result.error.issues;

  for (const issue of issues) {
    const path = issue.path.map((p) => String(p)).join('.');
    if (!errors[path]) {
      errors[path] = issue.message;
    }
  }

  return { success: false, errors };
}

// ==================== FORM ERROR DISPLAY ====================

export function getFieldError(
  errors: Record<string, string> | undefined,
  field: string
): string | undefined {
  return errors?.[field];
}

export function hasFieldError(errors: Record<string, string> | undefined, field: string): boolean {
  return !!errors?.[field];
}
