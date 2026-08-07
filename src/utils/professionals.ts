export type IdentityVerificationStatus =
  | "unverified"
  | "pending"
  | "approved"
  | "rejected"
  | "revoked"
  | "expired";

export type ProfessionalCredentialStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "revoked"
  | "expired"
  | "withdrawn";

export type ProfessionalRoleScope =
  | "category"
  | "activity";

export type ProfessionalRequirement =
  | "none"
  | "preferred"
  | "required";

export type ProfessionalRoleOption = {
  id: string;
  name: string;
  description: string | null;
  scope_type: ProfessionalRoleScope;
  category_id: string;
  category_name?: string | null;
  activity_id: string | null;
  activity_name?: string | null;
  requires_identity_verification: boolean;
};

export type MyProfessionalCredential = {
  id: string;
  professional_role_id: string;
  role_name: string;
  category_name: string;
  activity_name: string | null;
  professional_title: string | null;
  credential_type: string;
  issuer: string;
  credential_number: string | null;
  issued_at: string | null;
  expires_at: string | null;
  evidence_path: string | null;
  status: ProfessionalCredentialStatus;
  review_note: string | null;
  approved_at: string | null;
  created_at: string;
};

export type MyProfessionalProfile = {
  identity: {
    status: IdentityVerificationStatus;
    verified_at: string | null;
    expires_at: string | null;
  };
  roles: ProfessionalRoleOption[];
  credentials: MyProfessionalCredential[];
};

export type PublicProfessionalCredential = {
  id: string;
  role_name: string;
  professional_title: string | null;
  category_name: string;
  activity_name: string | null;
  issuer: string;
  approved_at: string | null;
  expires_at: string | null;
  scope_type: ProfessionalRoleScope;
};

export type PublicProfessionalStatus = {
  identity_verified: boolean;
  credentials: PublicProfessionalCredential[];
};

export type AdminProfessionalRole =
  ProfessionalRoleOption & {
    slug: string;
    is_active: boolean;
    sort_order: number;
  };

export type AdminProfessionalCredential = {
  id: string;
  user_id: string;
  full_name: string | null;
  username: string;
  email: string | null;
  professional_role_id: string;
  role_name: string;
  category_name: string;
  activity_name: string | null;
  professional_title: string | null;
  credential_type: string;
  issuer: string;
  credential_number: string | null;
  issued_at: string | null;
  expires_at: string | null;
  evidence_path: string | null;
  application_note: string | null;
  status: ProfessionalCredentialStatus;
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
};

export type AdminProfessionalCatalogue = {
  categories: Array<{
    id: string;
    name: string;
  }>;
  activities: Array<{
    id: string;
    name: string;
    category_id: string;
  }>;
  roles: AdminProfessionalRole[];
  credentials: AdminProfessionalCredential[];
};

export type AdminProfessionalPerson = {
  user_id: string;
  full_name: string | null;
  username: string;
  email: string | null;
  avatar_url: string | null;
  identity_status: IdentityVerificationStatus;
  identity_verified_at: string | null;
  identity_expires_at: string | null;
  approved_credential_count: number;
};

export function slugifyProfessionalRole(
  value: string
) {
  return value
    .trim()
    .toLocaleLowerCase("en-US")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

export function getCredentialStatusClasses(
  status: ProfessionalCredentialStatus
) {
  if (status === "approved") {
    return "border-green-200 bg-green-50 text-green-800";
  }

  if (status === "pending") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  if (
    status === "rejected" ||
    status === "revoked"
  ) {
    return "border-red-200 bg-red-50 text-red-800";
  }

  return "border-gray-200 bg-gray-100 text-gray-700";
}

export function getIdentityLabel(
  status: IdentityVerificationStatus
) {
  if (status === "approved") {
    return "Identity verified";
  }

  if (status === "pending") {
    return "Identity review pending";
  }

  if (status === "revoked") {
    return "Identity verification revoked";
  }

  if (status === "expired") {
    return "Identity verification expired";
  }

  if (status === "rejected") {
    return "Identity verification not approved";
  }

  return "Identity not verified";
}
