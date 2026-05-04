'use client'

import { forwardRef, useCallback, useState } from 'react'
import { cn } from '@/lib/utils'
import { EMAIL_REGEX } from '@shared/validators/auth.schema'

interface EmailInputProps {
  /** Controlled value */
  value: string
  onChange: (value: string) => void
  /** External error message to display */
  error?: string
  /** Field label. Defaults to "Email address" */
  label?: string
  /** HTML id for the input. Defaults to "email" */
  id?: string
  /** Placeholder text. Defaults to "you@example.com" */
  placeholder?: string
  /** Whether the field is disabled */
  disabled?: boolean
  /** Auto-focus on mount */
  autoFocus?: boolean
  /** Called on blur — needed for react-hook-form onTouched mode */
  onBlur?: () => void
  /** Additional className for the wrapper div */
  className?: string
}

/**
 * Reusable email input with validation and error display.
 * Works standalone or with react-hook-form (via value/onChange).
 *
 * Validation: standard email format regex.
 * Shows inline error only on blur if the value is non-empty and invalid.
 */
export const EmailInput = forwardRef<HTMLInputElement, EmailInputProps>(
  function EmailInput(
    {
      value,
      onChange,
      error,
      label = 'Email address',
      id = 'email',
      placeholder = 'you@example.com',
      disabled = false,
      autoFocus = false,
      onBlur: externalOnBlur,
      className,
    },
    ref,
  ) {
    const [touched, setTouched] = useState(false)

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.value.toLowerCase())
      },
      [onChange],
    )

    const handleBlur = useCallback(() => {
      setTouched(true)
      if (value !== value.trim()) {
        onChange(value.trim())
      }
      externalOnBlur?.()
    }, [externalOnBlur, value, onChange])

    const isValid = EMAIL_REGEX.test(value)
    const showFormatError = touched && value.length > 0 && !isValid && !error

    return (
      <div className={cn('space-y-1.5', className)}>
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-neutral-700">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          type="email"
          autoFocus={autoFocus}
          autoComplete="email"
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={disabled}
          placeholder={placeholder}
          aria-invalid={!!(error || showFormatError)}
          aria-describedby={error || showFormatError ? `${id}-error` : undefined}
          className={cn(
            'input w-full',
            (error || showFormatError) && 'border-error-500 focus:ring-error-50',
          )}
        />
        {(error || showFormatError) && (
          <p id={`${id}-error`} role="alert" className="text-xs text-error-500">
            {error || 'Please enter a valid email address'}
          </p>
        )}
      </div>
    )
  },
)

/** Check if an email string is valid (for use in parent components) */
export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email)
}
