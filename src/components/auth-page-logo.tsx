import Image from "next/image";
import {
  BRAND_LOGO_DARK_PUBLIC_PATH,
  BRAND_LOGO_LIGHT_PUBLIC_PATH,
} from "@/lib/brand";

/** Centered logo + wordmark above sign-in / register forms. */
export function AuthPageLogo() {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <Image
        src={BRAND_LOGO_LIGHT_PUBLIC_PATH}
        alt="MIDAS"
        width={500}
        height={500}
        className="h-52 w-52 object-contain dark:hidden sm:h-60 sm:w-60"
        priority
        unoptimized
      />
      <Image
        src={BRAND_LOGO_DARK_PUBLIC_PATH}
        alt="MIDAS"
        width={500}
        height={500}
        className="hidden h-52 w-52 object-contain dark:block sm:h-60 sm:w-60"
        priority
        unoptimized
      />
      <span className="text-2xl font-semibold tracking-tight text-zinc-800 sm:text-3xl dark:text-zinc-100">
        Finance Tracker
      </span>
    </div>
  );
}
