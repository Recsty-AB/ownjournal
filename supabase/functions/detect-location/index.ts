import { corsHeaders } from "../_shared/cors.ts";
import { getRequestCountry } from "../_shared/geo.ts";

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const country = await getRequestCountry(req);

    if (!country) {
      return new Response(
        JSON.stringify({ country: null, error: "Could not determine country" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ country }),
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
