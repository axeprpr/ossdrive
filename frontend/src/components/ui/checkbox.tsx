import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "../../lib/utils";

export function Checkbox({ className, ...props }: CheckboxPrimitive.CheckboxProps) { return <CheckboxPrimitive.Root className={cn("peer h-4 w-4 shrink-0 rounded border border-[#c6d8c8] bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8fb398] data-[state=checked]:border-[#5f8969] data-[state=checked]:bg-[#5f8969]", className)} {...props}><CheckboxPrimitive.Indicator className="flex items-center justify-center text-white"><Check className="h-3 w-3" /></CheckboxPrimitive.Indicator></CheckboxPrimitive.Root>; }
