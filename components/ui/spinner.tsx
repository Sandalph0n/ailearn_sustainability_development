import { cn } from "@/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import { Loading03Icon } from "@hugeicons/core-free-icons"

// `strokeWidth` bị loại khỏi props: `React.ComponentProps<"svg">` khai nó là `string | number`,
// còn `HugeiconsIcon` chỉ nhận `number`. Component này tự đặt giá trị nên bên ngoài không cần
// truyền vào. (Bản shadcn sinh ra thiếu chỗ này nên `tsc` báo lỗi.)
function Spinner({
  className,
  ...props
}: Omit<React.ComponentProps<"svg">, "strokeWidth">) {
  return (
    <HugeiconsIcon
      icon={Loading03Icon}
      strokeWidth={2}
      data-slot="spinner"
      role="status"
      aria-label="Loading"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  )
}

export { Spinner }
