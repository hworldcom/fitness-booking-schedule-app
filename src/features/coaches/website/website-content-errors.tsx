import type { Ref } from "react";
import type { CoachWebsiteContentIssue } from "@/domain/coach-website";

export function websiteContentFieldId(prefix: string, field: string) {
  return `${prefix}-${field.replaceAll(".", "-")}`;
}

export function WebsiteFieldErrors({
  id,
  issues,
}: {
  id: string;
  issues: readonly CoachWebsiteContentIssue[];
}) {
  return issues.length ? (
    <span id={id} className="website-field-errors">
      {issues.map((issue, index) => (
        <span key={index}>{issue.message}</span>
      ))}
    </span>
  ) : null;
}

export function WebsiteContentErrorSummary({
  prefix,
  issues,
  summaryRef,
}: {
  prefix: string;
  issues: readonly CoachWebsiteContentIssue[];
  summaryRef?: Ref<HTMLDivElement>;
}) {
  if (!issues.length) return null;
  return (
    <div
      ref={summaryRef}
      tabIndex={-1}
      className="website-content-errors"
      role="alert"
      aria-labelledby={`${prefix}-errors-title`}
    >
      <h4 id={`${prefix}-errors-title`}>Website content was not saved</h4>
      <p>
        Fix the following {issues.length === 1 ? "problem" : "problems"}. Your
        draft is retained.
      </p>
      <ul>
        {issues.map((issue, index) => (
          <li key={index}>
            <a
              href={`#${websiteContentFieldId(prefix, issue.field)}`}
              onClick={(event) => {
                const field = document.getElementById(
                  websiteContentFieldId(prefix, issue.field),
                );
                if (field) {
                  event.preventDefault();
                  field.focus();
                }
              }}
            >
              {issue.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
