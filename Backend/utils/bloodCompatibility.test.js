const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  BLOOD_GROUPS,
  canDonateTo,
  getCompatibleDonorGroups,
  getRecipientGroupsForDonor,
} = require("./bloodCompatibility");

/** Expected RBC compatibility: donor → recipient */
const EXPECTED = {
  "O-": ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"],
  "O+": ["O+", "A+", "B+", "AB+"],
  "A-": ["A-", "A+", "AB-", "AB+"],
  "A+": ["A+", "AB+"],
  "B-": ["B-", "B+", "AB-", "AB+"],
  "B+": ["B+", "AB+"],
  "AB-": ["AB-", "AB+"],
  "AB+": ["AB+"],
};

describe("bloodCompatibility", () => {
  for (const donor of BLOOD_GROUPS) {
    it(`donor ${donor} → correct recipients`, () => {
      const allowed = getRecipientGroupsForDonor(donor);
      assert.deepEqual(allowed.sort(), EXPECTED[donor].sort());
    });
  }

  it("AB+ recipient accepts O-, O+, A-, A+, B-, B+, AB-, AB+", () => {
    const donors = getCompatibleDonorGroups("AB+");
    assert.deepEqual(donors.sort(), BLOOD_GROUPS.sort());
  });

  it("AB- recipient accepts O-, A-, B-, AB-", () => {
    const donors = getCompatibleDonorGroups("AB-");
    assert.deepEqual(donors.sort(), ["O-", "A-", "B-", "AB-"].sort());
  });

  it("A+ recipient accepts O-, O+, A-, A+", () => {
    const donors = getCompatibleDonorGroups("A+");
    assert.deepEqual(donors.sort(), ["O-", "O+", "A-", "A+"].sort());
  });

  it("O- recipient accepts only O-", () => {
    const donors = getCompatibleDonorGroups("O-");
    assert.deepEqual(donors, ["O-"]);
  });

  it("all donor/recipient pairs match canDonateTo", () => {
    for (const donor of BLOOD_GROUPS) {
      for (const recipient of BLOOD_GROUPS) {
        const expected = EXPECTED[donor].includes(recipient);
        assert.equal(
          canDonateTo(donor, recipient),
          expected,
          `${donor} → ${recipient}`
        );
      }
    }
  });

  it("getCompatibleDonorGroups inverts getRecipientGroupsForDonor", () => {
    for (const recipient of BLOOD_GROUPS) {
      const donors = getCompatibleDonorGroups(recipient);
      for (const d of BLOOD_GROUPS) {
        const shouldInclude = canDonateTo(d, recipient);
        assert.equal(
          donors.includes(d),
          shouldInclude,
          `recipient ${recipient}, donor ${d}`
        );
      }
    }
  });
});
