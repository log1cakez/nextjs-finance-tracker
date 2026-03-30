import Image from "next/image";
import {
  BRAND_LOGO_DARK_PUBLIC_PATH,
  BRAND_LOGO_LIGHT_PUBLIC_PATH,
} from "@/lib/brand";

/** Header / auth: logo image + “Finance Tracker” wordmark. */
export function BrandMark() {
  return (
    <span className="inline-flex max-w-full flex-wrap items-center gap-2.5 sm:gap-3">
      <Image
        src={BRAND_LOGO_LIGHT_PUBLIC_PATH}
        alt="MIDAS"
        width={500}
        height={500}
        className="h-20 w-20 shrink-0 object-contain dark:hidden sm:h-24 sm:w-24"
        priority
        unoptimized
      />
      <Image
        src={BRAND_LOGO_DARK_PUBLIC_PATH}
        alt="MIDAS"
        width={500}
        height={500}
        className="hidden h-20 w-20 shrink-0 object-contain dark:block sm:h-24 sm:w-24"
        priority
        unoptimized
      />
      <span className="text-xl font-semibold tracking-tight text-zinc-800 sm:text-2xl dark:text-zinc-100">
        MIDAS Finance Tracker
      </span>
    </span>
  );
}
