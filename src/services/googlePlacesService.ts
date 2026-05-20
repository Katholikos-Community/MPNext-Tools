import { GooglePlacesProvider } from "@/lib/providers/google-places";
import type { PlacePrediction, PlaceDetails } from "@/lib/providers/google-places";

export class GooglePlacesService {
  private static instance: GooglePlacesService;
  private provider: GooglePlacesProvider | null = null;

  private constructor() {}

  public static async getInstance(): Promise<GooglePlacesService> {
    if (!GooglePlacesService.instance) {
      GooglePlacesService.instance = new GooglePlacesService();
    }
    return GooglePlacesService.instance;
  }

  public isEnabled(): boolean {
    return Boolean(process.env.GOOGLE_PLACES_API_KEY);
  }

  private getProvider(): GooglePlacesProvider {
    if (this.provider) return this.provider;
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GOOGLE_PLACES_API_KEY is not configured. Add it to .env.local to enable address autocomplete.",
      );
    }
    this.provider = new GooglePlacesProvider(apiKey);
    return this.provider;
  }

  async autocomplete(input: string, sessionToken: string): Promise<PlacePrediction[]> {
    return this.getProvider().autocomplete(input, sessionToken);
  }

  async getPlaceDetails(placeId: string, sessionToken: string): Promise<PlaceDetails> {
    return this.getProvider().getPlaceDetails(placeId, sessionToken);
  }
}
