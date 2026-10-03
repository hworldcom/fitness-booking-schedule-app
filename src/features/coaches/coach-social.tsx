"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { Eye, EyeOff, MessageSquareText, UserPlus, Users } from "lucide-react";
import type {
  CoachFollowState,
  CoachPost,
  CoachPostPage,
} from "@/domain/coach-social";
import {
  updateCoachFollowAction,
  type CoachFollowActionState,
} from "@/app/coaches/[slug]/actions";
import {
  createCoachPostAction,
  updateCoachPostVisibilityAction,
  type CoachPostActionState,
} from "@/app/coach/posts/actions";

const INITIAL_COACH_POST_ACTION_STATE: CoachPostActionState = Object.freeze({
  status: "idle",
  message: "",
});

function postDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function CoachFollowControl({
  coachProfileId,
  coachSlug,
  coachDisplayName,
  state,
}: {
  coachProfileId: string;
  coachSlug: string;
  coachDisplayName: string;
  state: CoachFollowState;
}) {
  const initialState: CoachFollowActionState = Object.freeze({
    status: "idle",
    message: "",
    following: state.status === "authorized" && state.following,
  });
  const [actionState, action, pending] = useActionState(
    updateCoachFollowAction,
    initialState,
  );

  if (state.status === "authorized" && state.isOwnProfile) {
    return (
      <Link className="button secondary" href="/coach/posts">
        Manage posts
      </Link>
    );
  }
  if (state.status !== "authorized") {
    return (
      <div className="coach-follow-guest">
        <Link
          className="button lime"
          href={`/sign-in?returnTo=${encodeURIComponent(`/coaches/${coachSlug}`)}`}
        >
          <UserPlus size={17} aria-hidden="true" /> Sign in to follow
        </Link>
        {state.status === "unavailable" ? (
          <small role="alert">Follow status is temporarily unavailable.</small>
        ) : null}
      </div>
    );
  }

  const nextFollowing = !actionState.following;
  return (
    <form action={action} className="coach-follow-form">
      <input type="hidden" name="coachProfileId" value={coachProfileId} />
      <input type="hidden" name="coachSlug" value={coachSlug} />
      <input type="hidden" name="following" value={String(nextFollowing)} />
      <button
        className={actionState.following ? "button secondary" : "button lime"}
        type="submit"
        disabled={pending}
        aria-label={`${actionState.following ? "Unfollow" : "Follow"} ${coachDisplayName}`}
      >
        <UserPlus size={17} aria-hidden="true" />
        {pending
          ? "Saving…"
          : actionState.following
            ? "Following"
            : "Follow coach"}
      </button>
      {actionState.message ? (
        <small
          role={actionState.status === "saved" ? "status" : "alert"}
          aria-live="polite"
        >
          {actionState.message}
        </small>
      ) : null}
    </form>
  );
}

export function CoachRecentPosts({ posts }: { posts: readonly CoachPost[] }) {
  return (
    <section
      className="coach-recent-posts"
      aria-labelledby="recent-posts-title"
    >
      <div className="coach-social-heading">
        <div>
          <span className="eyebrow">COACH NOTES</span>
          <h2 id="recent-posts-title">Recent posts</h2>
        </div>
        <MessageSquareText size={25} aria-hidden="true" />
      </div>
      {posts.length === 0 ? (
        <p className="coach-social-empty">
          This coach has not published a post yet.
        </p>
      ) : (
        <div className="coach-post-list">
          {posts.map((post) => (
            <CoachPostCard key={post.id} post={post} showCoach={false} />
          ))}
        </div>
      )}
    </section>
  );
}

export function FollowingFeed({ page }: { page: CoachPostPage }) {
  return (
    <div className="coach-social-page">
      <header className="coach-social-hero">
        <span className="eyebrow">YOUR COACH NETWORK</span>
        <h1>Following</h1>
        <p>Short training notes from the coaches you chose to follow.</p>
      </header>
      {page.posts.length === 0 ? (
        <section className="coach-social-empty-state">
          <Users size={28} aria-hidden="true" />
          <h2>Your feed is quiet.</h2>
          <p>Follow a visible coach to see their newest posts here.</p>
          <Link className="button lime" href="/explore">
            Find coaches
          </Link>
        </section>
      ) : (
        <section
          className="coach-feed"
          aria-label="Posts from followed coaches"
        >
          {page.posts.map((post) => (
            <CoachPostCard key={post.id} post={post} showCoach />
          ))}
          {page.nextCursor ? (
            <Link
              className="button secondary coach-feed-more"
              href={`/following?cursor=${encodeURIComponent(page.nextCursor)}`}
            >
              Load older posts
            </Link>
          ) : null}
        </section>
      )}
    </div>
  );
}

export function CoachPostManager({
  posts,
  coachSlug,
}: {
  posts: readonly CoachPost[];
  coachSlug: string;
}) {
  return (
    <div className="coach-social-page">
      <header className="coach-social-hero">
        <span className="eyebrow">COACH WORKSPACE</span>
        <h1>Share a training note.</h1>
        <p>
          Publish concise text updates for followers. Posts do not claim live
          availability and can be hidden without deleting their record.
        </p>
        <Link
          className="coach-social-profile-link"
          href={`/coaches/${coachSlug}`}
        >
          View public profile
        </Link>
      </header>
      <CoachPostComposer />
      <section className="coach-owned-posts" aria-labelledby="your-posts-title">
        <div className="coach-social-heading">
          <div>
            <span className="eyebrow">POST HISTORY</span>
            <h2 id="your-posts-title">Your posts</h2>
          </div>
        </div>
        {posts.length === 0 ? (
          <p className="coach-social-empty">No posts yet.</p>
        ) : (
          <div className="coach-post-list">
            {posts.map((post) => (
              <OwnedCoachPost key={post.id} post={post} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function CoachPostComposer() {
  const [state, action, pending] = useActionState(
    createCoachPostAction,
    INITIAL_COACH_POST_ACTION_STATE,
  );
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === "saved") formRef.current?.reset();
  }, [state.status]);
  return (
    <form ref={formRef} action={action} className="coach-post-composer">
      <label htmlFor="coach-post-body">Post text</label>
      <textarea
        id="coach-post-body"
        name="body"
        rows={5}
        maxLength={500}
        placeholder="Share one useful training idea…"
        required
      />
      <div className="coach-post-composer-actions">
        <small>1–500 characters · text only</small>
        <button className="button dark" type="submit" disabled={pending}>
          {pending ? "Publishing…" : "Publish post"}
        </button>
      </div>
      {state.message ? (
        <p
          role={state.status === "saved" ? "status" : "alert"}
          aria-live="polite"
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

function OwnedCoachPost({ post }: { post: CoachPost }) {
  const [state, action, pending] = useActionState(
    updateCoachPostVisibilityAction,
    INITIAL_COACH_POST_ACTION_STATE,
  );
  const nextVisibility = post.visibility === "visible" ? "hidden" : "visible";
  return (
    <article className="coach-post-card">
      <div className="coach-post-meta">
        <time dateTime={post.publishedAt}>{postDate(post.publishedAt)}</time>
        <span className={`coach-post-visibility ${post.visibility}`}>
          {post.visibility}
        </span>
      </div>
      <p>{post.body}</p>
      <form action={action} className="coach-post-visibility-form">
        <input type="hidden" name="postId" value={post.id} />
        <input type="hidden" name="visibility" value={nextVisibility} />
        <button className="button secondary" type="submit" disabled={pending}>
          {nextVisibility === "hidden" ? (
            <EyeOff size={16} aria-hidden="true" />
          ) : (
            <Eye size={16} aria-hidden="true" />
          )}
          {pending
            ? "Saving…"
            : nextVisibility === "hidden"
              ? "Hide post"
              : "Restore post"}
        </button>
        {state.message ? (
          <small role={state.status === "saved" ? "status" : "alert"}>
            {state.message}
          </small>
        ) : null}
      </form>
    </article>
  );
}

function CoachPostCard({
  post,
  showCoach,
}: {
  post: CoachPost;
  showCoach: boolean;
}) {
  return (
    <article className="coach-post-card">
      <div className="coach-post-meta">
        {showCoach ? (
          <Link href={`/coaches/${post.coachSlug}`}>
            {post.coachDisplayName}
          </Link>
        ) : null}
        <time dateTime={post.publishedAt}>{postDate(post.publishedAt)}</time>
      </div>
      <p>{post.body}</p>
    </article>
  );
}
