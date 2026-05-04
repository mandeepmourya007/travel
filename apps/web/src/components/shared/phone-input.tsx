'use client'

import { forwardRef, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { INDIAN_PHONE_REGEX } from '@shared/validators/auth.schema'

interface PhoneInputProps {
  /** Controlled value — digits only, no country code */
  value: string
  onChange: (value: string) => void
  /** External error message to display */
  error?: string
  /** Field label. Defaults to "Phone number" */
  label?: string
  /** HTML id for the input. Defaults to "phone" */
  id?: string
  /** Placeholder text. Defaults to "9876543210" */
  placeholder?: string
  /** Whether the field is disabled */
  disabled?: boolean
  /** Auto-focus on mount */
  autoFocus?: boolean
  /** Country code prefix. Defaults to "+91" */
  countryCode?: string
  /** Called on blur — needed for react-hook-form onTouched mode */
  onBlur?: () => void
  /** Additional className for the wrapper div */
  className?: string
}

/**
 * Reusable phone input with +91 prefix, digit-only filtering, and validation.
 * Works standalone or with react-hook-form (via value/onChange).
 *
 * Validation: 10-digit Indian number starting with 6-9 (uses shared INDIAN_PHONE_REGEX).
 * Shows inline error for invalid format only after user types 10 digits.
 */
export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  function PhoneInput(
    {
      value,
      onChange,
      error,
      label = 'Phone number',
      id = 'phone',
      placeholder = '9876543210',
      disabled = false,
      autoFocus = false,
      countryCode = '+91',
      onBlur,
      className,
    },
    ref,
  ) {
    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const digits = e.target.value.replace(/\D/g, '').slice(0, 10)
        onChange(digits)
      },
      [onChange],
    )

    const isComplete = value.length === 10
    const isValid = INDIAN_PHONE_REGEX.test(value)
    const showFormatError = isComplete && !isValid && !error

    return (
      <div className={cn('space-y-1.5', className)}>
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-neutral-700">
            {label}
          </label>
        )}
        <div className="flex gap-2">
          <span
            className="flex items-center rounded-lg border border-neutral-200 bg-neutral-100
                       px-3 text-sm font-medium text-neutral-500"
          >
            {countryCode}
          </span>
          <input
            ref={ref}
            id={id}
            type="tel"
            inputMode="numeric"
            autoFocus={autoFocus}
            maxLength={10}
            value={value}
            onChange={handleChange}
            onBlur={onBlur}
            disabled={disabled}
            placeholder={placeholder}
            aria-invalid={!!(error || showFormatError)}
            aria-describedby={error || showFormatError ? `${id}-error` : undefined}
            className={cn(
              'input flex-1',
              (error || showFormatError) && 'border-error-500 focus:ring-error-50',
            )}
          />
        </div>
        {(error || showFormatError) && (
          <p id={`${id}-error`} role="alert" className="text-xs text-error-500">
            {error || 'Must be a valid 10-digit Indian mobile number'}
          </p>
        )}
      </div>
    )
  },
)
