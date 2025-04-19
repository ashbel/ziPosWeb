import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Minus, Plus } from "lucide-react"

interface NumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  value?: number
  onChange?: (value: number) => void
  min?: number
  max?: number
  step?: number
  format?: (value: number) => string
  parse?: (value: string) => number
}

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  format = (value) => value.toString(),
  parse = (value) => {
    const parsed = parseFloat(value)
    return isNaN(parsed) ? 0 : parsed
  },
  className,
  ...props
}: NumberInputProps) {
  const [inputValue, setInputValue] = React.useState(format(value ?? 0))

  React.useEffect(() => {
    setInputValue(format(value ?? 0))
  }, [value, format])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)
    const parsed = parse(newValue)
    if (!isNaN(parsed)) {
      onChange?.(parsed)
    }
  }

  const handleBlur = () => {
    const parsed = parse(inputValue)
    const clamped = clamp(parsed, min, max)
    setInputValue(format(clamped))
    onChange?.(clamped)
  }

  const increment = () => {
    const newValue = clamp((value ?? 0) + step, min, max)
    setInputValue(format(newValue))
    onChange?.(newValue)
  }

  const decrement = () => {
    const newValue = clamp((value ?? 0) - step, min, max)
    setInputValue(format(newValue))
    onChange?.(newValue)
  }

  return (
    <div className="flex items-center space-x-2">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={decrement}
        disabled={min !== undefined && (value ?? 0) <= min}
      >
        <Minus className="h-4 w-4" />
      </Button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={inputValue}
        onChange={handleChange}
        onBlur={handleBlur}
        className={cn(
          "flex h-8 w-16 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={increment}
        disabled={max !== undefined && (value ?? 0) >= max}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  )
}

function clamp(value: number, min?: number, max?: number) {
  if (min !== undefined) {
    value = Math.max(min, value)
  }
  if (max !== undefined) {
    value = Math.min(max, value)
  }
  return value
} 