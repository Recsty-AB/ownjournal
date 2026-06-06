// Resolve the request's origin country (ISO 3166-1 alpha-2, uppercase) or
// null if it can't be determined.
//
// Primary source is the Cloudflare `cf-ipcountry` header (present in the
// Supabase Edge runtime). Falls back to an ipapi.co lookup on the client IP
// from `x-forwarded-for`. Shared by `detect-location` (currency hinting) and
// `create-checkout` (UK VAT / NETP compliance guard) so both use identical
// IP-country logic.
export async function getRequestCountry(req: Request): Promise<string | null> {
  // Cloudflare-provided country (fast path, no external call).
  const cfCountry = req.headers.get("cf-ipcountry");
  if (cfCountry && cfCountry !== "XX") {
    return cfCountry.toUpperCase();
  }

  // Fallback: geolocate the client IP via ipapi.co.
  const forwardedFor = req.headers.get("x-forwarded-for");
  const clientIp = forwardedFor?.split(",")[0]?.trim();
  if (!clientIp) {
    return null;
  }

  try {
    const geoResponse = await fetch(`https://ipapi.co/${clientIp}/country/`, {
      headers: { "User-Agent": "OwnJournal/1.0" },
    });

    if (!geoResponse.ok) {
      return null;
    }

    const countryCode = (await geoResponse.text()).trim();

    // ipapi.co returns "Undefined" for invalid IPs.
    if (!countryCode || countryCode === "Undefined" || countryCode.length !== 2) {
      return null;
    }

    return countryCode.toUpperCase();
  } catch (error) {
    console.error("getRequestCountry: geolocation lookup failed:", error);
    return null;
  }
}
