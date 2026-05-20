import { z } from "zod";

export const FamilyAddressSchema = z.object({
  addressId: z.number().int(),
  addressLine1: z.string().nullable(),
  addressLine2: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  region: z.string().nullable(),
  postalCode: z.string(),
  countryCode: z.string().nullable(),
});

export type FamilyAddress = z.infer<typeof FamilyAddressSchema>;

export const FamilyMemberParticipantSchema = z.object({
  participantId: z.number().int(),
  participantTypeId: z.number().int(),
  notes: z.string().nullable().optional(),
});

export type FamilyMemberParticipant = z.infer<typeof FamilyMemberParticipantSchema>;

export const FamilyMemberSchema = z.object({
  contactId: z.number().int(),
  displayName: z.string().optional(),
  firstName: z.string(),
  middleName: z.string(),
  maidenName: z.string(),
  lastName: z.string(),
  nickname: z.string(),
  prefixId: z.number().int(),
  suffixId: z.number().int(),
  birthDate: z.string().nullable(),
  genderId: z.number().int(),
  maritalStatusId: z.number().int(),
  mobilePhone: z.string(),
  emailAddress: z.string(),
  bulkEmailOpt: z.boolean(),
  envelopeNo: z.number().int().nullable(),
  contactStatusId: z.number().int(),
  primaryLanguageId: z.number().int().nullable(),
  faithBackgroundId: z.number().int().nullable(),
  householdPositionId: z.number().int(),
  participant: FamilyMemberParticipantSchema.nullable(),
  donorId: z.number().int().nullable(),
  isDonor: z.boolean(),
});

export type FamilyMember = z.infer<typeof FamilyMemberSchema>;

export const HouseholdSchema = z.object({
  householdId: z.number().int(),
  householdName: z.string(),
  householdPhone: z.string(),
  congregationId: z.number().int(),
  sourceId: z.number().int(),
  address: FamilyAddressSchema,
  alternateMailingAddress: FamilyAddressSchema,
  seasonStart: z.string().nullable(),
  seasonEnd: z.string().nullable(),
  repeatsAnnually: z.boolean(),
  areHeadsMarried: z.boolean(),
  members: z.array(FamilyMemberSchema),
});

export type Household = z.infer<typeof HouseholdSchema>;

export interface LookupOption {
  id: number;
  name: string;
}

export interface StateOption {
  code: string;
  name: string;
}

export interface CountryOption {
  code: string;
  name: string;
}

export interface FamilyLookups {
  congregations: LookupOption[];
  sources: LookupOption[];
  householdPositions: LookupOption[];
  participantTypes: LookupOption[];
  maritalStatuses: LookupOption[];
  prefixes: LookupOption[];
  suffixes: LookupOption[];
  genders: LookupOption[];
  contactStatuses: LookupOption[];
  primaryLanguages: LookupOption[];
  faithBackgrounds: LookupOption[];
  states: StateOption[];
  countries: CountryOption[];
}

export interface FamilyDefaults {
  congregationId: number;
  sourceId: number;
  countryCode: string;
  state: string;
  householdPositionId: number;
  participantTypeId: number;
  showEnvelopeNumbers: boolean;
}

export interface ContactSearchResult {
  contactId: number;
  displayName: string;
  detail: string;
}

export interface SavedMemberId {
  tempContactId: number;
  contactId: number;
  participantId: number | null;
  donorId: number | null;
  envelopeNo: number | null;
  envelopeBumped: boolean;
}

export interface SaveProgress {
  mainAddressId: number | null;
  altAddressId: number | null;
  householdId: number | null;
  members: SavedMemberId[];
}

export function emptyAddress(): FamilyAddress {
  return {
    addressId: 0,
    addressLine1: null,
    addressLine2: null,
    city: null,
    state: null,
    region: null,
    postalCode: "",
    countryCode: null,
  };
}

export function emptyMember(contactId: number, lastName: string, defaults: FamilyDefaults): FamilyMember {
  return {
    contactId,
    firstName: "",
    middleName: "",
    maidenName: "",
    lastName,
    nickname: "",
    prefixId: 0,
    suffixId: 0,
    birthDate: null,
    genderId: 0,
    maritalStatusId: 0,
    mobilePhone: "",
    emailAddress: "",
    bulkEmailOpt: false,
    envelopeNo: null,
    contactStatusId: 1,
    primaryLanguageId: null,
    faithBackgroundId: null,
    householdPositionId: defaults.householdPositionId,
    participant: { participantId: 0, participantTypeId: defaults.participantTypeId, notes: null },
    donorId: null,
    isDonor: false,
  };
}

export function emptyHousehold(defaults: FamilyDefaults, lastName = ""): Household {
  return {
    householdId: 0,
    householdName: lastName,
    householdPhone: "",
    congregationId: defaults.congregationId,
    sourceId: defaults.sourceId,
    address: { ...emptyAddress(), countryCode: defaults.countryCode, state: defaults.state },
    alternateMailingAddress: { ...emptyAddress(), countryCode: defaults.countryCode, state: defaults.state },
    seasonStart: null,
    seasonEnd: null,
    repeatsAnnually: false,
    areHeadsMarried: false,
    members: [
      emptyMember(-1, lastName, defaults),
      emptyMember(-2, lastName, defaults),
    ],
  };
}
