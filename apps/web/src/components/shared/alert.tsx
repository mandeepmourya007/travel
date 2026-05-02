import { cn } from '@/lib/utils'
import { CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react'

type AlertVariant = 'success' | 'warning' | 'error' | 'info'

interface AlertProps {
  variant: AlertVariant
  title?: string
  children: React.ReactNode
  className?: string
}

const VARIANT_STYLES: Record<AlertVariant, string> = {
  success: 'bg-success-50 text-success-500 border-success-200',
  warning: 'bg-warning-50 text-warning-500 border-warning-200',
  error: 'bg-error-50 text-error-500 border-error-200',
  info: 'bg-info-50 text-info-500 border-info-200',
}

const VARIANT_ICONS: Record<AlertVariant, React.ElementType> = {
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
  info: Info,
}

export function Alert({ variant, title, children, className }: AlertProps) {
  const Icon = VARIANT_ICONS[variant]

  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 rounded-lg border p-4 text-sm leading-relaxed',
        VARIANT_STYLES[variant],
        className,
      )}
    >
      <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
      <div>
        {title && <p className="font-semibold mb-0.5">{title}</p>}
        <div>{children}</div>
      </div>
    </div>
  )
}
