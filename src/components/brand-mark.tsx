import Image from "next/image";
import {
  BRAND_LOGO_DARK_PUBLIC_PATH,
  BRAND_LOGO_LIGHT_PUBLIC_PATH,
} from "@/lib/brand";

const wordmarkClass =
  "font-semibold tracking-tight text-zinc-800 dark:text-zinc-100";

/** Logo + “MIDAS Capital” wordmark. Default row layout for header; `stacked` = logo above name, larger. */
export function BrandMark({ variant = "inline" }: { variant?: "inline" | "stacked" }) {
  const isStacked = variant === "stacked";
  const logoLight = (
    <Image
      src={BRAND_LOGO_LIGHT_PUBLIC_PATH}
      alt="MIDAS"
      width={500}
      height={500}
      className={
        isStacked
          ? "h-36 w-36 shrink-0 object-contain dark:hidden sm:h-44 sm:w-44 md:h-52 md:w-52"
          : "h-20 w-20 shrink-0 object-contain dark:hidden sm:h-24 sm:w-24"
      }
      priority
      unoptimized
    />
  );
  const logoDark = (
    <Image
      src={BRAND_LOGO_DARK_PUBLIC_PATH}
      alt="MIDAS"
      width={500}
      height={500}
      className={
        isStacked
          ? "hidden h-36 w-36 shrink-0 object-contain dark:block sm:h-44 sm:w-44 md:h-52 md:w-52"
          : "hidden h-20 w-20 shrink-0 object-contain dark:block sm:h-24 sm:w-24"
      }
      priority
      unoptimized
    />
  );

  if (isStacked) {
    return (
      <span className="inline-flex max-w-full flex-col items-center gap-4 text-center sm:gap-5">
        <span className="relative flex shrink-0 items-center justify-center">
          {logoLight}
          {logoDark}
        </span>
        <span className={`text-2xl sm:text-3xl md:text-4xl ${wordmarkClass}`}>MIDAS Capital</span>
      </span>
    );
  }

  return (
    <span className="inline-flex max-w-full flex-wrap items-center gap-2.5 sm:gap-3">
      {logoLight}
      {logoDark}
      <span className={`text-xl sm:text-2xl ${wordmarkClass}`}>MIDAS Capital</span>
    </span>
  );
}
