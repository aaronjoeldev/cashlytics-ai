import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-accent dark:bg-white/5 animate-pulse rounded-xl", className)}
      {...props}
    />
  )
}

export { Skeleton }
