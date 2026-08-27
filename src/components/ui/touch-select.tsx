import * as React from "react"
import { Check, ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

export interface TouchSelectOption {
  value: string
  label: string
}

interface TouchSelectProps {
  value: string
  onValueChange: (value: string) => void
  options: TouchSelectOption[]
  /** Extra classes for the trigger button. */
  className?: string
  /** Extra classes for the option list. */
  contentClassName?: string
  id?: string
  disabled?: boolean
  "aria-label"?: string
  "aria-labelledby"?: string
}

/**
 * A select that renders its option list in the page instead of handing it to
 * the platform.
 *
 * The OS-native `<select>` we used before draws its popup with the *Android*
 * theme, which knows nothing about the in-app theme: options came out white on
 * white. Radix's `Select` is themed correctly but portals its content, and the
 * portal loses touch events inside Capacitor's WebViews. This keeps the list in
 * the normal DOM — no portal, no platform chrome — so touch works and the
 * palette is ours.
 */
export const TouchSelect = React.forwardRef<HTMLButtonElement, TouchSelectProps>(
  (
    {
      value,
      onValueChange,
      options,
      className,
      contentClassName,
      id,
      disabled,
      "aria-label": ariaLabel,
      "aria-labelledby": ariaLabelledBy,
    },
    forwardedRef
  ) => {
    const [open, setOpen] = React.useState(false)
    // Flip the list above the trigger when the trigger sits low in the
    // viewport, so the options aren't stranded under the fold of a drawer.
    const [dropUp, setDropUp] = React.useState(false)
    const wrapperRef = React.useRef<HTMLDivElement>(null)
    const triggerRef = React.useRef<HTMLButtonElement>(null)
    const listRef = React.useRef<HTMLDivElement>(null)

    React.useImperativeHandle(forwardedRef, () => triggerRef.current as HTMLButtonElement)

    const selected = options.find((option) => option.value === value)

    React.useEffect(() => {
      if (!open) return

      const handlePointerDown = (event: PointerEvent | MouseEvent) => {
        if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false)
      }
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          setOpen(false)
          triggerRef.current?.focus()
        }
      }

      document.addEventListener("pointerdown", handlePointerDown, true)
      document.addEventListener("keydown", handleKeyDown)
      return () => {
        document.removeEventListener("pointerdown", handlePointerDown, true)
        document.removeEventListener("keydown", handleKeyDown)
      }
    }, [open])

    // Bring the current value into view once the list is up.
    React.useEffect(() => {
      if (!open) return
      const current = listRef.current?.querySelector<HTMLElement>('[data-selected="true"]')
      current?.scrollIntoView?.({ block: "nearest" })
    }, [open])

    const toggle = () => {
      if (disabled) return
      const rect = triggerRef.current?.getBoundingClientRect()
      if (rect) setDropUp(rect.bottom > window.innerHeight * 0.6)
      setOpen((wasOpen) => !wasOpen)
    }

    const moveFocus = (from: number, delta: number) => {
      const items = listRef.current?.querySelectorAll<HTMLElement>('[role="option"]')
      if (!items?.length) return
      const next = Math.min(Math.max(from + delta, 0), items.length - 1)
      items[next]?.focus()
    }

    return (
      <div ref={wrapperRef} className="relative">
        <button
          ref={triggerRef}
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          disabled={disabled}
          onClick={toggle}
          className={cn(
            "flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-left text-sm text-foreground",
            "ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
        >
          <span className="truncate">{selected?.label ?? ""}</span>
          <ChevronDown
            className={cn("h-4 w-4 shrink-0 opacity-50 transition-transform", open && "rotate-180")}
            aria-hidden="true"
          />
        </button>

        {open && (
          <div
            ref={listRef}
            role="listbox"
            aria-label={ariaLabel}
            className={cn(
              "absolute inset-x-0 z-50 max-h-64 overflow-y-auto overscroll-contain rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
              dropUp ? "bottom-full mb-1" : "top-full mt-1",
              contentClassName
            )}
          >
            {options.map((option, index) => {
              const isSelected = option.value === value
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  data-selected={isSelected}
                  onClick={() => {
                    onValueChange(option.value)
                    setOpen(false)
                    triggerRef.current?.focus()
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown") {
                      event.preventDefault()
                      moveFocus(index, 1)
                    } else if (event.key === "ArrowUp") {
                      event.preventDefault()
                      moveFocus(index, -1)
                    }
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-sm px-2 py-2.5 text-left text-sm",
                    "focus:bg-accent focus:text-accent-foreground focus:outline-none hover:bg-accent hover:text-accent-foreground",
                    isSelected && "font-medium"
                  )}
                >
                  <Check
                    className={cn("h-4 w-4 shrink-0", !isSelected && "opacity-0")}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 whitespace-normal break-words">{option.label}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }
)
TouchSelect.displayName = "TouchSelect"
