import Image from "next/image";
import { cn } from "@/lib/utils";

const W = 680;
const H = 440;

export function Logo({
  size = 56,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const width = Math.round((size * W) / H);
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
