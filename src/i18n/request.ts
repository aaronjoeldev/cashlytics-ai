import { getRequestConfig } from "next-intl/server";
import { getUserPreferences } from "@/lib/user-preferences";

export default getRequestConfig(async () => {
  // Stored user setting first, cookie as fallback for signed-out pages
  const { locale } = await getUserPreferences();

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: "Europe/Berlin",
  };
});
