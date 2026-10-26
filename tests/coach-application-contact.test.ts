import assert from "node:assert/strict";
import test from "node:test";
import {
  parseCoachApplicationContact,
  validateCoachApplicationContact,
} from "@/domain/coach-application-contact";

const contact = {
  phoneNumber: "+4915123456789",
  instagramUrl: null,
  facebookUrl: null,
  linkedinUrl: null,
};

test("application contacts require an international phone and allow all socials to be empty", () => {
  assert.deepEqual(
    validateCoachApplicationContact({
      ...contact,
      phoneNumber: " +49 (151) 234-56789 ",
      instagramUrl: "  ",
    }),
    { valid: true, value: contact },
  );
  for (const phoneNumber of [
    null,
    "",
    "015123456789",
    "+0123456789",
    "+123456",
    "+1234567890123456",
    "+49coach",
    "+49\n15123456789",
    "+4915123456789;ext=1",
    "+" + "1".repeat(80),
  ])
    assert.equal(
      validateCoachApplicationContact({ ...contact, phoneNumber }).valid,
      false,
    );
});

test("each optional social accepts its HTTPS platform profile URL and rejects spoofing, unsafe schemes and oversized input", () => {
  for (const [field, host, pathname] of [
    ["instagramUrl", "instagram.com", "coach_test"],
    ["facebookUrl", "facebook.com", "profile.php?id=123"],
    ["linkedinUrl", "linkedin.com", "in/coach-test"],
  ]) {
    for (const prefix of ["", "www."])
      assert.equal(
        validateCoachApplicationContact({
          ...contact,
          [field]: `https://${prefix}${host}/${pathname}`,
        }).valid,
        true,
      );
    for (const value of [
      `http://${host}/${pathname}`,
      `https://${host}.evil.test/${pathname}`,
      `https://${host}@evil.test/${pathname}`,
      `https://evil.test/${host}/${pathname}`,
      `https://${host}:444/${pathname}`,
      `https://${host}/`,
      `https://${host}/coach%0d%0aBcc`,
      `https://${host}/coach name`,
      `https://${host}/<script>`,
      `https://${host}/` + "a".repeat(501),
      "javascript:alert(1)",
      "@coach",
      false,
    ])
      assert.equal(
        validateCoachApplicationContact({ ...contact, [field]: value }).valid,
        false,
        String(value),
      );
  }
});

test("contact projections fail closed on malformed/noncanonical data and strip additional fields", () => {
  assert.deepEqual(
    parseCoachApplicationContact({
      ...contact,
      revision: 2,
      secret: "ignored",
    }),
    { ...contact, revision: 2 },
  );
  for (const value of [
    null,
    [],
    {},
    { ...contact, revision: 0 },
    { ...contact, revision: 1.5 },
    { ...contact, revision: 1000001 },
    { ...contact, revision: 1, phoneNumber: "+49 15123456789" },
    { ...contact, revision: 1, instagramUrl: undefined },
  ])
    assert.throws(
      () => parseCoachApplicationContact(value),
      /Invalid application contact/,
    );
});
