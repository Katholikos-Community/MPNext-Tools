"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { FamilyService, PartialSaveError } from "@/services/familyService";
import { GooglePlacesService } from "@/services/googlePlacesService";
import { getCurrentUserIdFromSession } from "@/components/shared-actions/user";
import type {
  ContactSearchResult,
  FamilyDefaults,
  FamilyLookups,
  Household,
  SaveProgress,
} from "@/lib/dto/family";
import type { PlacePrediction, PlaceDetails } from "@/lib/providers/google-places";

export type ActionError = { success: false; error: string; progress?: SaveProgress };

async function getSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session;
}

export async function searchContacts(term: string): Promise<ContactSearchResult[]> {
  await getSession();
  const service = await FamilyService.getInstance();
  return service.searchContacts(term);
}

export async function fetchFamilyLookups(): Promise<FamilyLookups> {
  await getSession();
  const service = await FamilyService.getInstance();
  return service.getLookups();
}

export async function fetchFamilyDefaults(): Promise<FamilyDefaults> {
  await getSession();
  const service = await FamilyService.getInstance();
  return service.getDefaults();
}

export async function fetchHousehold(
  contactId: number,
): Promise<{ success: true; household: Household } | ActionError> {
  try {
    await getSession();
    const service = await FamilyService.getInstance();
    const household = await service.getHousehold(contactId);
    if (!household) return { success: false, error: "Household not found" };
    return { success: true, household };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to load household",
    };
  }
}

export async function resolveContactIdFromPage(args: {
  tableName: string;
  primaryKey: string;
  recordId: number;
  contactIdField: string;
}): Promise<{ success: true; contactId: number | null } | ActionError> {
  try {
    await getSession();
    const service = await FamilyService.getInstance();
    const contactId = await service.resolveContactIdFromPage(
      args.tableName,
      args.primaryKey,
      args.recordId,
      args.contactIdField,
    );
    return { success: true, contactId };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to resolve contact",
    };
  }
}

export async function fetchNextEnvelopeNumber(): Promise<number> {
  await getSession();
  const service = await FamilyService.getInstance();
  return service.getNextEnvelopeNumber();
}

export async function placesEnabled(): Promise<boolean> {
  await getSession();
  const service = await GooglePlacesService.getInstance();
  return service.isEnabled();
}

export async function placeAutocomplete(
  input: string,
  sessionToken: string,
): Promise<PlacePrediction[]> {
  await getSession();
  if (input.trim().length < 3) return [];
  const service = await GooglePlacesService.getInstance();
  if (!service.isEnabled()) return [];
  return service.autocomplete(input, sessionToken);
}

export async function placeDetails(
  placeId: string,
  sessionToken: string,
): Promise<{ success: true; details: PlaceDetails } | ActionError> {
  try {
    await getSession();
    const service = await GooglePlacesService.getInstance();
    const details = await service.getPlaceDetails(placeId, sessionToken);
    return { success: true, details };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch place details",
    };
  }
}

export async function saveFamily(
  household: Household,
): Promise<{ success: true; progress: SaveProgress } | ActionError> {
  try {
    const session = await getSession();
    const userId = await getCurrentUserIdFromSession(session);
    const service = await FamilyService.getInstance();
    const progress = await service.saveHousehold(household, userId);
    return { success: true, progress };
  } catch (error) {
    if (error instanceof PartialSaveError) {
      return { success: false, error: error.message, progress: error.progress };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to save family",
    };
  }
}
