/**
 * Red blood cell (RBC) donation compatibility.
 * Hospital request bloodGroup = recipient needed type.
 * Donor bloodGroup = who can donate TO that recipient.
 */

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

/** Donor type → recipient types they can donate RBCs to */
const DONOR_TO_RECIPIENTS = {
  "O-": ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"],
  "O+": ["O+", "A+", "B+", "AB+"],
  "A-": ["A-", "A+", "AB-", "AB+"],
  "A+": ["A+", "AB+"],
  "B-": ["B-", "B+", "AB-", "AB+"],
  "B+": ["B+", "AB+"],
  "AB-": ["AB-", "AB+"],
  "AB+": ["AB+"],
};

const normalizeBloodGroup = (group) => {
  if (!group || typeof group !== "string") return "";
  return group.trim().toUpperCase().replace(/\s+/g, "");
};

/** Map common variants to canonical A+, O-, etc. */
const normalizeCanonical = (group) => {
  const raw = normalizeBloodGroup(group);
  if (!raw) return "";

  const rh = raw.endsWith("+") || raw.endsWith("-") ? raw.slice(-1) : "";
  const abo = raw.replace(/[+-]/g, "");

  if (!["A", "B", "AB", "O"].includes(abo) || (rh !== "+" && rh !== "-")) {
    return raw;
  }

  return `${abo}${rh}`;
};

const canDonateTo = (donorGroup, recipientGroup) => {
  const donor = normalizeCanonical(donorGroup);
  const recipient = normalizeCanonical(recipientGroup);

  if (!donor || !recipient) return false;

  const allowedRecipients = DONOR_TO_RECIPIENTS[donor];
  if (!allowedRecipients) return false;

  return allowedRecipients.includes(recipient);
};

/** Donor blood types that can fulfill a hospital request for recipientGroup */
const getCompatibleDonorGroups = (recipientGroup) => {
  const recipient = normalizeCanonical(recipientGroup);
  if (!recipient) return [];

  return BLOOD_GROUPS.filter((donor) => canDonateTo(donor, recipient));
};

/** Recipient types a donor can help (for listing open requests) */
const getRecipientGroupsForDonor = (donorGroup) => {
  const donor = normalizeCanonical(donorGroup);
  if (!donor) return [];

  return DONOR_TO_RECIPIENTS[donor] || [];
};

module.exports = {
  BLOOD_GROUPS,
  DONOR_TO_RECIPIENTS,
  normalizeBloodGroup,
  normalizeCanonical,
  canDonateTo,
  getCompatibleDonorGroups,
  getRecipientGroupsForDonor,
};
