import { useState, useCallback } from 'react';
import { z } from 'zod';
import { validateForm, ValidationResult } from '../utils/validation';

interface UseFormValidationOptions<T> {
  schema: z.ZodSchema<T>;
  onSuccess?: (data: T) => void | Promise<void>;
}

interface UseFormValidationReturn<T> {
  errors: Record<string, string> | undefined;
  isValid: boolean;
  validate: (data: unknown) => ValidationResult<T>;
  validateField: (field: string, value: unknown, allData: unknown) => string | undefined;
  clearErrors: () => void;
  clearFieldError: (field: string) => void;
  setErrors: (errors: Record<string, string>) => void;
}

export function useFormValidation<T>({
  schema,
}: UseFormValidationOptions<T>): UseFormValidationReturn<T> {
  const [errors, setErrors] = useState<Record<string, string> | undefined>(undefined);

  const validate = useCallback(
    (data: unknown): ValidationResult<T> => {
      const result = validateForm(schema, data);
      if (!result.success) {
        setErrors(result.errors);
      } else {
        setErrors(undefined);
      }
      return result;
    },
    [schema]
  );

  const validateField = useCallback(
    (field: string, _value: unknown, allData: unknown): string | undefined => {
      const result = validateForm(schema, allData);
      if (!result.success && result.errors?.[field]) {
        setErrors((prev) => ({
          ...prev,
          [field]: result.errors![field],
        }));
        return result.errors[field];
      } else {
        setErrors((prev) => {
          if (!prev) return prev;
          const { [field]: __, ...rest } = prev;
          return Object.keys(rest).length > 0 ? rest : undefined;
        });
        return undefined;
      }
    },
    [schema]
  );

  const clearErrors = useCallback(() => {
    setErrors(undefined);
  }, []);

  const clearFieldError = useCallback((field: string) => {
    setErrors((prev) => {
      if (!prev) return prev;
      const { [field]: __, ...rest } = prev;
      return Object.keys(rest).length > 0 ? rest : undefined;
    });
  }, []);

  return {
    errors,
    isValid: !errors || Object.keys(errors).length === 0,
    validate,
    validateField,
    clearErrors,
    clearFieldError,
    setErrors,
  };
}
