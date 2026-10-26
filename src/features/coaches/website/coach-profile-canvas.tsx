"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { Eye, Pencil, Settings2 } from "lucide-react";
import { useActor } from "@/auth/client/actor-provider";
import { useAuthSession } from "@/auth/client/session-provider";
import {
  COACH_DISCIPLINES,
  type CoachProjection,
  type CoachGymOption,
} from "@/domain/coaches";
import type { CoachPublicHandleResult } from "@/domain/coach-public-url";
import type { OwnedCoachMedia } from "@/domain/coach-media";
import type { LocationSearchConfiguration } from "@/location";
import {
  updateCoachProfileAction,
  type CoachProfileActionState,
} from "@/app/profile/coach/actions";
import { CoachWorkspaceHeader } from "../coach-workspace-header";
import { CoachPictureSettings } from "../coach-picture-settings";
import { CoachPublicUrlSettings } from "../coach-public-url-settings";
import { CoachTrainingLocationManager } from "../coach-training-location-manager";
import {
  coachWithPortraitOverride,
  type CoachPortraitOverride,
} from "../coach-portrait-preview";
import { PublicCoachWebsite } from "./public-coach-website";
import {
  CoachWebsiteEditor,
  type CoachWebsiteEditorSnapshot,
} from "./coach-website-editor";
import { CoachMediaGallery } from "./coach-media-gallery";
import { ProfileEditDrawer } from "./profile-edit-drawer";
import type { ProfileEditField } from "./profile-edit-region";
import { profilePreviewWebsite } from "./profile-edit-preview";
import "./profile-edit-canvas.css";

type Presentation = Omit<
  ComponentProps<typeof PublicCoachWebsite>,
  "onEdit" | "sectionControls"
>;
type Props = {
  coach: CoachProjection;
  gyms: readonly CoachGymOption[];
  ownerDisplayName: string;
  publicUrl: CoachPublicHandleResult;
  locationSearchConfiguration: LocationSearchConfiguration;
  presentation: Presentation | null;
  scheduleLinks: { availability: string; calendar: string };
};
type Details = Pick<
  CoachProjection,
  "displayName" | "bio" | "disciplines" | "timezone" | "visibility"
>;
function detailsOf(coach: CoachProjection): Details {
  const { displayName, bio, disciplines, timezone, visibility } = coach;
  return { displayName, bio, disciplines, timezone, visibility };
}
const INITIAL: CoachProfileActionState = {
  status: "idle",
  message: "",
  errors: [],
};
const CONTENT = new Set([
  "brandLabel",
  "introduction",
  "approach",
  "experience",
  "focusLabels",
  "faqs",
  "links",
]);
type Panel =
  | "content"
  | "banner"
  | "rate"
  | "media"
  | "portrait"
  | "details"
  | "locations"
  | "settings";
const titles: Record<Panel, string> = {
  content: "About you",
  banner: "Banner image",
  rate: "Starting rate",
  media: "Training photos & video",
  portrait: "Coach picture",
  details: "Profile details",
  locations: "Training locations",
  settings: "Profile visibility & public URL",
};

export function CoachProfileCanvas(props: Props) {
  const { actor } = useActor();
  const { session } = useAuthSession();
  const scope =
    session.status === "signed-in" &&
    actor.status === "authorized" &&
    ["approved", "demo"].includes(actor.coachAccessStatus)
      ? `${session.subject}:${actor.demoRun.slug}:${actor.profile.slug}:${actor.coachAccessStatus}:${props.coach.profileId}`
      : null;
  const [initialScope] = useState(scope);
  if (!scope || scope !== initialScope)
    return (
      <section className="protected-access-state" role="alert">
        <h1>Reload your coach profile</h1>
        <p>
          Your account or editing access changed. Reload to verify your profile.
        </p>
        <button
          className="button dark"
          onClick={() => window.location.reload()}
        >
          Reload profile
        </button>
      </section>
    );
  return <ScopedCanvas key={scope} {...props} />;
}

function ScopedCanvas({
  coach,
  gyms,
  ownerDisplayName,
  publicUrl,
  locationSearchConfiguration,
  presentation,
  scheduleLinks,
}: Props) {
  const router = useRouter();
  const source = JSON.stringify(detailsOf(coach));
  const [details, setDetails] = useState({
    source,
    saved: detailsOf(coach),
    draft: detailsOf(coach),
    editing: false,
  });
  // A calendar refresh may update locations, but must retain an open details draft.
  if (details.source !== source)
    setDetails({
      source,
      saved: detailsOf(coach),
      draft: details.editing ? details.draft : detailsOf(coach),
      editing: details.editing,
    });
  const [website, setWebsite] = useState<CoachWebsiteEditorSnapshot | null>(
    null,
  );
  const [media, setMedia] = useState<OwnedCoachMedia | null>(null);
  const [mediaPending, setMediaPending] = useState(false);
  const [mediaAccessLost, setMediaAccessLost] = useState(false);
  const revokeMediaAccess = useCallback(() => setMediaAccessLost(true), []);
  const [portrait, setPortrait] = useState<CoachPortraitOverride | null>(null);
  const [savedOnly, setSavedOnly] = useState(false);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [field, setField] = useState<string | null>(null);
  const requestedEdit = useRef<"content" | "rate" | null>(null);
  useEffect(() => {
    const requested = requestedEdit.current;
    const state = requested === "content" ? website?.content : website?.rate;
    if (
      requested &&
      panel === requested &&
      state?.saved &&
      !state.busy &&
      !state.recovery
    ) {
      requestedEdit.current = null;
      if (requested === "content") website?.editContent();
      else website?.editRate();
    }
  }, [panel, website]);
  const [result, saveDetails, pending] = useActionState(
    async (previous: CoachProfileActionState, data: FormData) => {
      const next = await updateCoachProfileAction(previous, data);
      if (next.status === "saved") {
        const value = {
          ...details.draft,
          displayName: details.draft.displayName.trim().replace(/\s+/g, " "),
          bio: details.draft.bio.trim().replace(/\s+/g, " "),
          timezone: details.draft.timezone.trim().replace(/\s+/g, " "),
          disciplines: COACH_DISCIPLINES.filter((discipline) =>
            data.getAll("disciplines").includes(discipline),
          ),
        };
        setDetails((current) => ({
          ...current,
          saved: value,
          draft: value,
          editing: false,
        }));
        router.refresh();
      }
      return next;
    },
    INITIAL,
  );
  const unsaved =
    details.editing ||
    !!website?.content.editing ||
    !!website?.rate.editing ||
    mediaPending;
  useEffect(() => {
    const refresh = () => router.refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [router]);
  useEffect(() => {
    if (!unsaved) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);
  function open(next: Panel, focus: string | null = null) {
    setPanel(next);
    setField(focus);
    if ((next === "details" || next === "settings") && !details.editing)
      setDetails((current) => ({
        ...current,
        draft: current.saved,
        editing: true,
      }));
  }
  function edit(key: ProfileEditField) {
    if (CONTENT.has(key)) {
      requestedEdit.current = "content";
      open("content", key);
    } else if (key === "rate") {
      requestedEdit.current = "rate";
      open("rate");
    } else if (["displayName", "bio", "disciplines"].includes(key))
      open("details", key);
    else open(key as Panel);
  }
  function change<K extends keyof Details>(key: K, value: Details[K]) {
    setDetails((current) => ({
      ...current,
      draft: { ...current.draft, [key]: value },
      editing: true,
    }));
  }
  if (
    mediaAccessLost ||
    website?.content.accessLost ||
    website?.rate.accessLost
  )
    return (
      <section role="alert" className="protected-access-state">
        <h1>Profile editing access changed</h1>
        <button onClick={() => window.location.reload()}>
          Reload to verify your account
        </button>
      </section>
    );
  const savedCoach = coachWithPortraitOverride(
    { ...coach, ...details.saved },
    portrait,
  )!;
  const previewCoach = {
    ...savedCoach,
    ...(!savedOnly && details.editing ? details.draft : details.saved),
  };
  const previewWebsite = profilePreviewWebsite(
    website,
    savedOnly,
    presentation?.state.website,
  );
  const shownMedia = media ? (savedOnly ? media.published : media) : null;
  const handoff = (href: string, label: string): ReactNode => (
    <a
      className="button secondary"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {label} ↗
    </a>
  );
  const detailFields = (
    <>
      <label className="coach-field">
        <span>Display name</span>
        <input
          name="displayName"
          value={details.draft.displayName}
          maxLength={80}
          required
          onChange={(event) => change("displayName", event.target.value)}
        />
      </label>
      <label className="coach-field">
        <span>Biography</span>
        <textarea
          name="bio"
          rows={6}
          value={details.draft.bio}
          minLength={40}
          maxLength={1200}
          required
          onChange={(event) => change("bio", event.target.value)}
        />
        <small>
          40–1200 characters. This appears in your About me section.
        </small>
      </label>
      <fieldset className="profile-discipline-options">
        <legend>Disciplines (choose 1–4)</legend>
        {COACH_DISCIPLINES.map((discipline) => (
          <label key={discipline}>
            <input
              type="checkbox"
              name="disciplines"
              value={discipline}
              checked={details.draft.disciplines.includes(discipline)}
              onChange={(event) =>
                change(
                  "disciplines",
                  event.target.checked
                    ? [...details.draft.disciplines, discipline]
                    : details.draft.disciplines.filter(
                        (value) => value !== discipline,
                      ),
                )
              }
            />{" "}
            {discipline}
          </label>
        ))}
      </fieldset>
      <label className="coach-field">
        <span>Profile timezone</span>
        <input
          name="timezone"
          value={details.draft.timezone}
          maxLength={80}
          required
          onChange={(event) => change("timezone", event.target.value)}
        />
      </label>
      <label className="coach-field">
        <span>Discovery visibility</span>
        <select
          name="visibility"
          value={details.draft.visibility}
          onChange={(event) =>
            change("visibility", event.target.value as Details["visibility"])
          }
        >
          <option value="hidden">Hidden — only you can see your profile</option>
          <option value="visible">
            Visible — publish your approved profile
          </option>
        </select>
        <small>
          Public URL confirmation is separate. Saving visibility may publish
          your saved profile content.
        </small>
      </label>
    </>
  );
  const location = coach.location;
  const locationFields = {
    selectedGymId: coach.selectedGymId ?? "",
    locationLabel: location.kind === "independent" ? location.label : "",
    latitude: location.kind === "independent" ? location.latitude : "",
    longitude: location.kind === "independent" ? location.longitude : "",
    locationSource:
      location.source === "permanent-geocoding"
        ? "permanent-geocoding"
        : "manual",
    locationProvider:
      location.kind === "independent" &&
      location.source === "permanent-geocoding"
        ? (location.provider ?? "")
        : "",
    locationConfirmation: "confirmed",
  };
  return (
    <div className="coach-workspace coach-profile-canvas">
      <CoachWorkspaceHeader
        coach={savedCoach}
        ownerDisplayName={ownerDisplayName}
        view="profile"
        profileReturnHref="/coach"
      />
      <header className="profile-canvas-toolbar">
        <div>
          <span className="eyebrow">YOUR COACH PROFILE</span>
          <h1>{savedOnly ? "Saved preview" : "Make it yours."}</h1>
          <p>
            {savedOnly
              ? "Your saved content, in the visitor layout."
              : "Click text or an image to edit it. See your changes here as you type."}
          </p>
        </div>
        <div className="profile-canvas-actions">
          <button
            type="button"
            className="button secondary"
            aria-pressed={savedOnly}
            onClick={() => {
              setSavedOnly(!savedOnly);
              setPanel(null);
            }}
          >
            {savedOnly ? <Pencil size={16} /> : <Eye size={16} />}{" "}
            {savedOnly ? "Back to editing" : "Saved preview"}
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={() => open("settings", "visibility")}
          >
            <Settings2 size={16} /> Profile settings
          </button>
        </div>
        <div className="profile-canvas-status" role="status">
          <span>
            {savedCoach.visibility === "visible"
              ? "Visible profile"
              : "Hidden profile · private preview"}
          </span>
          <span>
            {unsaved
              ? "Draft changes kept · save each section when ready"
              : "Changes save in each editing panel"}
          </span>
        </div>
      </header>
      {website &&
        [website.content, website.rate].some(
          ({ saved, busy, recovery, message }) =>
            recovery !== null || (!saved && !busy && message !== ""),
        ) && (
          <p className="profile-canvas-notice" role="status">
            Some saved content could not be verified. Open its editing panel to
            load or review the latest version.
          </p>
        )}
      <PublicCoachWebsite
        {...presentation}
        state={{
          status: "ready",
          coach: previewCoach,
          slots: [],
          website: previewWebsite,
        }}
        ownProfile
        ownerPreview
        onEdit={savedOnly ? undefined : edit}
        sectionControls={
          savedOnly
            ? undefined
            : {
                services: handoff(
                  "/coach/session-types",
                  "Manage session types",
                ),
                groups: handoff("/coach/events", "Manage group sessions"),
                locations: (
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => open("locations")}
                  >
                    Edit training locations
                  </button>
                ),
              }
        }
        mediaContent={
          shownMedia ? (
            <CoachMediaGallery media={shownMedia} slug={null} />
          ) : (
            <p role="status">
              Training photos and video are not loaded yet. Open the media panel
              to check them.
            </p>
          )
        }
        marketplace={
          <div className="profile-canvas-schedule">
            <header>
              <div>
                <span className="eyebrow">YOUR AVAILABILITY</span>
                <h2>Schedule</h2>
                <p>
                  This reflects saved availability. Calendar changes open in a
                  separate tab; your profile draft stays here.
                </p>
              </div>
              <div className="profile-canvas-actions">
                {handoff(scheduleLinks.availability, "Edit availability")}
                {handoff(scheduleLinks.calendar, "Open calendar")}
              </div>
            </header>
            {presentation?.marketplace ?? (
              <section id="private-schedule" role="status">
                <h3>Public schedule is not available</h3>
                <p>
                  {savedCoach.visibility === "hidden"
                    ? "Your profile is hidden. Use your calendar to review and edit private availability."
                    : "We couldn’t verify the public schedule. Use your calendar or reload to try again."}
                </p>
              </section>
            )}
          </div>
        }
      />
      <ProfileEditDrawer
        open={panel !== null}
        title={panel ? titles[panel] : "Edit profile"}
        field={field}
        focusReady={panel !== "content" || !!website?.content.editing}
        onClose={() => setPanel(null)}
      >
        <div
          data-active-panel={panel ?? ""}
          className="profile-canvas-editor-panels"
        >
          <div
            hidden={
              !["content", "banner", "rate", "media"].includes(panel ?? "")
            }
          >
            <CoachWebsiteEditor
              coach={savedCoach}
              publicationAllowed
              canvas
              onSnapshot={setWebsite}
              onMediaChange={setMedia}
              onMediaPendingChange={setMediaPending}
              onMediaAccessLost={revokeMediaAccess}
            />
          </div>
          <div hidden={panel !== "portrait"}>
            <CoachPictureSettings
              coach={savedCoach}
              publicationAllowed
              onImageChange={(imageUrl) =>
                setPortrait({
                  profileId: coach.profileId,
                  baseImageUrl: coach.portraitUrl,
                  imageUrl,
                })
              }
            />
          </div>
          <div hidden={panel !== "details" && panel !== "settings"}>
            <form action={saveDetails}>
              <fieldset disabled={pending} className="profile-details-fields">
                <legend className="sr-only">
                  Profile details and visibility
                </legend>
                {detailFields}
                {Object.entries(locationFields).map(([name, value]) => (
                  <input key={name} type="hidden" name={name} value={value} />
                ))}
              </fieldset>
              {result.status !== "idle" && (
                <div role={result.status === "saved" ? "status" : "alert"}>
                  <p>{result.message}</p>
                  {result.errors.length > 0 && (
                    <ul>
                      {result.errors.map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              <div className="profile-canvas-actions">
                <button className="button dark" disabled={pending}>
                  Save profile details
                </button>
                <button
                  type="button"
                  className="button secondary"
                  disabled={pending}
                  onClick={() =>
                    setDetails((current) => ({
                      ...current,
                      draft: current.saved,
                      editing: false,
                    }))
                  }
                >
                  Cancel profile edits
                </button>
              </div>
            </form>
            <div hidden={panel !== "settings"}>
              <CoachPublicUrlSettings
                key={
                  publicUrl.status === "ready"
                    ? `${publicUrl.username}:${publicUrl.revision}:${publicUrl.confirmed}`
                    : publicUrl.status
                }
                initial={publicUrl}
                visible={savedCoach.visibility === "visible"}
              />
            </div>
          </div>
          <div hidden={panel !== "locations"}>
            <CoachTrainingLocationManager
              coach={coach}
              gyms={gyms}
              searchConfiguration={locationSearchConfiguration}
              publicationAllowed
            />
          </div>
        </div>
      </ProfileEditDrawer>
    </div>
  );
}
