import Image from "next/image";
import { cn } from "@/lib/utils";

const VARIANTS = {
  blue: "/logo-blue.svg",
  black: "/logo-black.svg",
  white: "/logo-white.svg",
} as const;

export type LogoVariant = keyof typeof VARIANTS;

export function Logo({
  size = 56,
  variant = "blue",
  className,
}: {
  size?: number;
  variant?: LogoVariant;
  className?: string;
}) {
  return (
    <Image
      src={VARIANTS[variant]}
      alt="bottle bike"
      width={size}
      height={size}
      priority
      className={cn("select-none", className)}
    />
  );
}
