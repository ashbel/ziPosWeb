import * as React from "react"
import { HexColorPicker, HexColorInput } from "react-colorful"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { EyeDropper } from "lucide-react"

interface ColorPickerProps {
  color: string
  onChange: (color: string) => void
  className?: string
}

export function ColorPicker({ color, onChange, className }: ColorPickerProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-[110px] justify-start text-left font-normal",
            !color && "text-muted-foreground",
            className
          )}
        >
          <div
            className="mr-2 h-4 w-4 rounded-full border"
            style={{ backgroundColor: color }}
          />
          {color ? color.toUpperCase() : "Pick a color"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-4">
        <div className="space-y-4">
          <HexColorPicker color={color} onChange={onChange} />
          <div className="flex items-center space-x-2">
            <HexColorInput
              color={color}
              onChange={onChange}
              className="h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              prefixed
            />
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                if ("EyeDropper" in window) {
                  const eyeDropper = new (window as any).EyeDropper()
                  eyeDropper
                    .open()
                    .then((result: { sRGBHex: string }) => {
                      onChange(result.sRGBHex)
                    })
                    .catch(() => {
                      // User cancelled the eyedropper
                    })
                }
              }}
            >
              <EyeDropper className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-8 gap-2">
            {[
              "#FF0000",
              "#00FF00",
              "#0000FF",
              "#FFFF00",
              "#00FFFF",
              "#FF00FF",
              "#000000",
              "#FFFFFF",
            ].map((swatch) => (
              <button
                key={swatch}
                className="h-6 w-6 rounded-md border"
                style={{ backgroundColor: swatch }}
                onClick={() => onChange(swatch)}
              />
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
} 