import Image from "next/image";
import { BRAND_LOGO_PUBLIC_PATH } from "@/lib/brand";

/** Header / auth: logo image + “Finance Tracker” wordmark. */
export function BrandMark() {
  return (
    <span className="inline-flex max-w-full flex-wrap items-center gap-2.5 sm:gap-3">
      <Image
        src={BRAND_LOGO_PUBLIC_PATH}
        alt="MIDAS"
        width={500}
        height={500}
        className="h-16 w-16 shrink-0 object-contain sm:h-[4.5rem] sm:w-[4.5rem]"
        priority
        unoptimized
      />
      <span className="text-xl font-semibold tracking-tight text-zinc-800 sm:text-2xl dark:text-zinc-100">
        Finance Tracker
      </span>
    </span>
  );
}
