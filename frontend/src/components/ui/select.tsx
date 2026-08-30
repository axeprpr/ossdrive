import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "../../lib/utils";

export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;
export const SelectTrigger = React.forwardRef<React.ElementRef<typeof SelectPrimitive.Trigger>, React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>>(({ className, children, ...props }, ref) => <SelectPrimitive.Trigger ref={ref} className={cn("flex h-8 w-auto items-center justify-between gap-2 rounded-md border border-[#cfe0d0] bg-[#fffffc] px-2 text-xs text-[#4d7657] outline-none focus:ring-2 focus:ring-[#dcecdc]", className)} {...props}>{children}<SelectPrimitive.Icon><ChevronDown className="h-3.5 w-3.5 opacity-70" /></SelectPrimitive.Icon></SelectPrimitive.Trigger>);
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;
export const SelectContent = React.forwardRef<React.ElementRef<typeof SelectPrimitive.Content>, React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>>(({ className, children, position="popper", ...props }, ref) => <SelectPrimitive.Portal><SelectPrimitive.Content ref={ref} position={position} className={cn("relative z-50 min-w-[8rem] overflow-hidden rounded-md border border-[#d8e5d8] bg-white p-1 text-xs text-[#34463a] shadow-lg", className)} {...props}><SelectPrimitive.ScrollUpButton><ChevronUp className="mx-auto h-3 w-3" /></SelectPrimitive.ScrollUpButton><SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport><SelectPrimitive.ScrollDownButton><ChevronDown className="mx-auto h-3 w-3" /></SelectPrimitive.ScrollDownButton></SelectPrimitive.Content></SelectPrimitive.Portal>);
SelectContent.displayName = SelectPrimitive.Content.displayName;
export const SelectItem = React.forwardRef<React.ElementRef<typeof SelectPrimitive.Item>, React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>>(({ className, children, ...props }, ref) => <SelectPrimitive.Item ref={ref} className={cn("relative flex cursor-pointer select-none items-center rounded px-2 py-1.5 outline-none data-[highlighted]:bg-[#edf6eb] data-[highlighted]:text-[#416e4d]", className)} {...props}><SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText><SelectPrimitive.ItemIndicator className="absolute right-2"><Check className="h-3 w-3" /></SelectPrimitive.ItemIndicator></SelectPrimitive.Item>);
SelectItem.displayName = SelectPrimitive.Item.displayName;
