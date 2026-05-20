import type { PlacePrediction, PlaceDetails } from "./types";

const AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
const PLACE_DETAILS_URL_BASE = "https://places.googleapis.com/v1/places";

interface AutocompleteResponse {
  suggestions?: Array<{
    placePrediction?: {
      placeId: string;
      text?: { text?: string };
      structuredFormat?: {
        mainText?: { text?: string };
        secondaryText?: { text?: string };
      };
    };
  }>;
}

interface PlaceDetailsResponse {
  id: string;
  formattedAddress?: string;
  addressComponents?: Array<{
    longText?: string;
    shortText?: string;
    types?: string[];
  }>;
}

export class GooglePlacesProvider {
  constructor(private readonly apiKey: string) {
    if (!apiKey) {
      throw new Error("GooglePlacesProvider requires a non-empty API key");
    }
  }

  async autocomplete(input: string, sessionToken: string): Promise<PlacePrediction[]> {
    const trimmed = input.trim();
    if (trimmed.length < 3) return [];

    const res = await fetch(AUTOCOMPLETE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask":
          "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat",
      },
      body: JSON.stringify({
        input: trimmed,
        sessionToken,
        includedPrimaryTypes: ["street_address", "premise", "subpremise"],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Google Places autocomplete failed: ${res.status} ${errText}`);
    }

    const data = (await res.json()) as AutocompleteResponse;
    return (data.suggestions ?? [])
      .map((s) => s.placePrediction)
      .filter((p): p is NonNullable<typeof p> => Boolean(p?.placeId))
      .map((p) => ({
        placeId: p.placeId,
        primary: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
        secondary: p.structuredFormat?.secondaryText?.text ?? "",
        full: p.text?.text ?? "",
      }));
  }

  async getPlaceDetails(placeId: string, sessionToken: string): Promise<PlaceDetails> {
    const url = new URL(`${PLACE_DETAILS_URL_BASE}/${encodeURIComponent(placeId)}`);
    url.searchParams.set("sessionToken", sessionToken);

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask": "id,formattedAddress,addressComponents",
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Google Places details failed: ${res.status} ${errText}`);
    }

    const data = (await res.json()) as PlaceDetailsResponse;
    const components = data.addressComponents ?? [];

    const pick = (type: string, prefer: "long" | "short" = "long"): string => {
      const c = components.find((x) => x.types?.includes(type));
      if (!c) return "";
      return (prefer === "short" ? c.shortText : c.longText) ?? "";
    };

    const streetNumber = pick("street_number");
    const route = pick("route");
    const addressLine1 = [streetNumber, route].filter(Boolean).join(" ").trim();
    const city =
      pick("locality") ||
      pick("postal_town") ||
      pick("sublocality_level_1") ||
      pick("administrative_area_level_2");
    const state = pick("administrative_area_level_1", "short");
    const postalCode = pick("postal_code");
    const countryCode = pick("country", "short");

    return {
      placeId: data.id,
      formattedAddress: data.formattedAddress ?? "",
      addressLine1,
      city,
      state,
      postalCode,
      countryCode,
    };
  }
}
