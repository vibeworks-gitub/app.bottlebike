import Image from "next/image";
import { cn } from "@/lib/utils";

type LogoProps = {
  variant?: "mark" | "full";
  size?: number;
  className?: string;
};

export function Logo({ variant = "mark", size = 32, className }: LogoProps) {
  if (variant === "full") {
    return (
      <Image
        src="/logo.svg"
        alt="bottlebike"
        width={size * 4}
        height={(size * 4 * 440) / 680}
        priority
        className={cn("h-auto w-auto", className)}
        style={{ width: "auto", height: size }}
      />
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Image
        src="/logomark.svg"
        alt="bottlebike"
        width={size}
        height={size}
        priority
      />
    </span>
  );
}
