import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"

import { cn } from "../../lib/utils"

// 使用 Radix + shadcn 的标准实现，确保：
// - 初始未选中时拇指在最左
// - 选中时拇指平滑移动到最右且不会消失
// - 不依赖 peer 派生状态，直接使用组件自身的 data-state
const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      "peer relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center justify-start rounded-full border-2 border-transparent overflow-hidden transition-colors",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-gray-300",
      className
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        "pointer-events-none absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-all duration-200",
        "data-[state=checked]:left-auto data-[state=checked]:right-0.5 data-[state=unchecked]:left-0.5 data-[state=unchecked]:right-auto"
      )}
    />
  </SwitchPrimitive.Root>
))
Switch.displayName = SwitchPrimitive.Root.displayName

export { Switch }