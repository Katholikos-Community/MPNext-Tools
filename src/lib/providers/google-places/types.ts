export interface PlacePrediction {
  placeId: string;
  primary: string;
  secondary: string;
  full: string;
}

export interface PlaceDetails {
  placeId: string;
  formattedAddress: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  countryCode: string;
}
