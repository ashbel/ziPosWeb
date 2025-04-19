import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Clock } from "lucide-react"

interface TimePickerProps {
  value: string
  onChange: (value: string) => void
  className?: string
}

export function TimePicker({ value, onChange, className }: TimePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [hours, setHours] = React.useState(0)
  const [minutes, setMinutes] = React.useState(0)

  React.useEffect(() => {
    if (value) {
      const [h, m] = value.split(":").map(Number)
      setHours(h)
      setMinutes(m)
    }
  }, [value])

  const handleHoursChange = (h: number) => {
    setHours(h)
    onChange(`${h.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`)
  }

  const handleMinutesChange = (m: number) => {
    setMinutes(m)
    onChange(`${hours.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-[110px] justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <Clock className="mr-2 h-4 w-4" />
          {value || "Pick a time"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4">
        <div className="flex space-x-4">
          <div className="space-y-2">
            <div className="text-sm font-medium">Hours</div>
            <div className="grid grid-cols-4 gap-1">
              {Array.from({ length: 24 }, (_, i) => (
                <Button
                  key={i}
                  variant={hours === i ? "default" : "outline"}
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => handleHoursChange(i)}
                >
                  {i.toString().padStart(2, "0")}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium">Minutes</div>
            <div className="grid grid-cols-4 gap-1">
              {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
                <Button
                  key={m}
                  variant={minutes === m ? "default" : "outline"}
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => handleMinutesChange(m)}
                >
                  {m.toString().padStart(2, "0")}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
} 