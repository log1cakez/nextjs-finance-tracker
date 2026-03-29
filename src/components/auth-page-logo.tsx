import Image from "next/image";
import { BRAND_LOGO_PUBLIC_PATH } from "@/lib/brand";

/** Centered logo + wordmark above sign-in / register forms. */
export function AuthPageLogo() {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <Image
        src={BRAND_LOGO_PUBLIC_PATH}
        alt="MIDAS"
        width={500}
        height={500}
        className="h-44 w-44 object-contain sm:h-52 sm:w-52"
        priority
        unoptimized
      />
      <span className="text-2xl font-semibold tracking-tight text-zinc-800 sm:text-3xl dark:text-zinc-100">
        Finance Tracker
      </span>
    </div>
  );
}
