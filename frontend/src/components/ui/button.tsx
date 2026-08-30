import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";

const buttonVariants = cva("inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8fb398] disabled:pointer-events-none disabled:opacity-45", { variants: { variant: { default: "bg-[#5f8969] text-white hover:bg-[#416e4d]", outline: "border border-[#cfe0d0] bg-[#fffffc] text-[#4d7657] hover:bg-[#f0f8ef]", ghost: "text-[#5d8067] hover:bg-[#edf6eb]", destructive: "border border-[#e3cdcd] bg-[#fffffc] text-[#a35b61] hover:bg-[#fff3f2]" }, size: { default: "h-8 px-3", icon: "h-8 w-8 p-0" } }, defaultVariants: { variant: "default", size: "default" } });
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> { asChild?: boolean }
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild=false, ...props }, ref) => { const Comp = asChild ? Slot : "button"; return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props}/>; });
Button.displayName = "Button";
export { Button, buttonVariants };
export function IconButton({ label, className, children, ...props }: ButtonProps & { label: string }) { return <TooltipProvider><Tooltip><TooltipTrigger asChild><Button aria-label={label} size="icon" variant="outline" className={cn("shrink-0", className)} {...props}>{children}</Button></TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip></TooltipProvider>; }
