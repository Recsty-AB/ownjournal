import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Try to get country from Cloudflare headers (available in Deno Deploy/Supabase)
    const cfCountry = req.headers.get("cf-ipcountry");
    if (cfCountry && cfCountry !== "XX") {
      return new Response(
        JSON.stringify({ country: cfCountry, source: "cloudflare" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fallback: Get client IP from x-forwarded-for header
    const forwardedFor = req.headers.get("x-forwarded-for");
    const clientIp = forwardedFor?.split(",")[0]?.trim();

    if (!clientIp) {
      return new Response(
        JSON.stringify({ country: null, error: "Could not determine IP" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use ipapi.co for geolocation (free tier: 1000 requests/day)
    const geoResponse = await fetch(`https://ipapi.co/${clientIp}/country/`, {
      headers: { "User-Agent": "OwnJournal/1.0" },
    });

    if (!geoResponse.ok) {
      return new Response(
        JSON.stringify({ country: null, error: "Geolocation service unavailable" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const countryCode = await geoResponse.text();
    
    // ipapi.co returns "Undefined" for invalid IPs
    if (!countryCode || countryCode === "Undefined" || countryCode.length !== 2) {
      return new Response(
        JSON.stringify({ country: null, error: "Could not determine country" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ country: countryCode.toUpperCase(), source: "ipapi" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error detecting location:", error);
    return new Response(
      JSON.stringify({ country: null, error: "Internal error" }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
