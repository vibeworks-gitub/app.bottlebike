import Image from "next/image";
import { cn } from "@/lib/utils";

const FULL_W = 680;
const FULL_H = 440;

type LogoProps = {
  variant?: "mark" | "full";
  size?: number;
  className?: string;
};

export function Logo({ variant = "mark", size = 32, className }: LogoProps) {
  if (variant === "full") {
    const width = Math.round((size * FULL_W) / FULL_H);
    return (
      <Image
        src="/logo.svg"
        alt="bottle bike"
        width={width}
        height={size}
        priority
        className={cn("select-none", className)}
      />
    );
  }

  return (
    <Image
      src="/logomark.svg"
      alt="bottle bike"
      width={size}
      height={size}
      priority
      className={cn("select-none", className)}
    />
  );
}
