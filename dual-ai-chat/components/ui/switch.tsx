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
      // relative + overflow-hidden：允许拇指绝对定位并裁剪边缘，避免位移时出现错位/溢出
      "peer relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent overflow-hidden transition-colors",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-gray-300",
      className
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        // 绝对定位 + inset-y-0.5：上下各 2px 间距，h-6(24px) - 4px = h-5 正好贴齐内边缘
        "pointer-events-none absolute inset-y-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow ring-0 transition-all duration-200",
        // 未选中贴左，选中贴右；避免使用 translate 引起的 1px 漂移
        "data-[state=checked]:left-auto data-[state=checked]:right-0.5 data-[state=unchecked]:left-0.5 data-[state=unchecked]:right-auto"
      )}
    />
  </SwitchPrimitive.Root>
))
Switch.displayName = SwitchPrimitive.Root.displayName

export { Switch }