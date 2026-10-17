"use client";

export function AccountGenderField({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const legacyValue = value && value !== "Male" && value !== "Female";
  return (
    <label className="account-settings-field">
      Gender <span className="account-optional">(optional)</span>
      <select
        name="gender"
        autoComplete="sex"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value || null)}
      >
        <option value="">Not provided</option>
        <option value="Male">Male</option>
        <option value="Female">Female</option>
        {legacyValue && (
          <option value={value} disabled>
            {value} (previously entered)
          </option>
        )}
      </select>
      <span>
        {legacyValue
          ? "Your previous entry is kept until you choose a new option or clear it."
          : "Choose Male or Female, or leave this empty."}
      </span>
    </label>
  );
}
