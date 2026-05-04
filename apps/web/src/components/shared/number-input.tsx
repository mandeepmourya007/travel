'use client'

import { forwardRef, useCallback, useState } from 'react'
import { cn } from '@/lib/utils'

interface NumberInputProps {
  /** Controlled string value (avoids NaN issues with empty fields) */
  value: string
  onChange: (value: string) => void
  /** External error message to display */
  error?: string
  /** Field label */
  label?: string
  /** HTML id */
  id?: string
  /** Placeholder text */
  placeholder?: string
  /** Minimum allowed value (validated on blur) */
  min?: number
  /** Maximum allowed value (validated on blur) */
  max?: number
  /** Allow decimal numbers. Defaults to false (integers only) */
  allowDecimal?: boolean
  /** Whether the field is disabled */
  disabled?: boolean
  /** Auto-focus on mount */
  autoFocus?: boolean
  /** Prefix text (e.g. "₹") shown inside the input */
  prefix?: string
  /** Suffix text (e.g. "people") shown after the input */
  suffix?: string
  /** Additional className for the wrapper div */
  className?: string
  /** Called on blur — needed for react-hook-form onTouched mode */
  onBlur?: () => void
  /** Additional className for the input element */
  inputClassName?: string
}

/**
 * Reusable number input — no browser spin buttons, digit-only filtering,
 * min/max validation on blur with clear error messages.
 *
 * Uses `inputMode="decimal"` or `"numeric"` for proper mobile keyboards
 * while keeping `type="text"` to eliminate browser default spinners.
 */
export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  function NumberInput(
    {
      value,
      onChange,
      error: externalError,
      label,
      id,
      placeholder,
      min,
      max,
      allowDecimal = false,
      disabled = false,
      autoFocus = false,
      prefix,
      suffix,
      onBlur: externalOnBlur,
      className,
      inputClassName,
    },
    ref,
  ) {
    const [internalError, setInternalError] = useState<string | null>(null)

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value

        // Allow empty
        if (raw === '') {
          onChange('')
          setInternalError(null)
          return
        }

        // Allow minus sign at start (for negative numbers if min < 0)
        if (raw === '-' && (min === undefined || min < 0)) {
          onChange('-')
          return
        }

        // Filter: digits only (+ optional decimal point + optional leading minus)
        const pattern = allowDecimal ? /^-?\d*\.?\d*$/ : /^-?\d*$/
        if (!pattern.test(raw)) return

        onChange(raw)
        setInternalError(null)
      },
      [onChange, allowDecimal, min],
    )

    const handleBlur = useCallback(() => {
      const str = String(value)
      if (str === '' || str === '-') {
        setInternalError(null)
        return
      }

      const num = Number(str)
      if (isNaN(num)) {
        setInternalError('Please enter a valid number')
        return
      }

      if (min !== undefined && num < min) {
        setInternalError(`Must be at least ${min}`)
        return
      }

      if (max !== undefined && num > max) {
        setInternalError(`Must be at most ${max}`)
        return
      }

      setInternalError(null)
    }, [value, min, max])

    const onBlurCombined = useCallback(() => {
      handleBlur()
      externalOnBlur?.()
    }, [handleBlur, externalOnBlur])

    const error = externalError || internalError
    const hasError = !!error

    return (
      <div className={cn('space-y-1.5', className)}>
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-neutral-700">
            {label}
          </label>
        )}
        <div className={cn('flex items-center', suffix && 'gap-2')}>
          {prefix && (
            <span className="flex items-center rounded-l-lg border border-r-0 border-neutral-200 bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-500">
              {prefix}
            </span>
          )}
          <input
            ref={ref}
            id={id}
            type="text"
            inputMode={allowDecimal ? 'decimal' : 'numeric'}
            autoFocus={autoFocus}
            value={value}
            onChange={handleChange}
            onBlur={onBlurCombined}
            disabled={disabled}
            placeholder={placeholder}
            aria-invalid={hasError}
            aria-describedby={hasError ? `${id}-error` : undefined}
            className={cn(
              'input w-full tabular-nums',
              prefix && 'rounded-l-none',
              hasError && 'border-error-500 focus:ring-error-50',
              inputClassName,
            )}
          />
          {suffix && (
            <span className="shrink-0 text-sm text-neutral-500">{suffix}</span>
          )}
        </div>
        {hasError && (
          <p id={`${id}-error`} role="alert" className="text-xs text-error-500">
            {error}
          </p>
        )}
      </div>
    )
  },
)
