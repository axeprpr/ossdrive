import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "../../lib/utils";
export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;
export function TooltipContent({ className, ...props }: TooltipPrimitive.TooltipContentProps) { return <TooltipPrimitive.Portal><TooltipPrimitive.Content sideOffset={6} className={cn("z-50 max-w-[420px] rounded-md border border-[#d8e5d8] bg-[#fffffc] px-2.5 py-1.5 text-xs text-[#34463a] shadow-lg", className)} {...props} /></TooltipPrimitive.Portal>; }
