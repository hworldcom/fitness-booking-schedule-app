import Link from "next/link";
import { ArrowUpRight, Search } from "lucide-react";
import { Empty } from "@/components/ui";
import type { PublicCatalogueResult } from "@/domain/catalogue";
import { discoveryCatalogue } from "@/features/discovery/catalogue";
import { searchCatalogue } from "@/features/discovery/queries";

export function SearchScreen({
  query,
  catalogueResult,
}: {
  query: string;
  catalogueResult: PublicCatalogueResult;
}) {
  const catalogue =
    catalogueResult.status === "ready"
      ? discoveryCatalogue(catalogueResult.catalogue.gyms)
      : [];
  const results = searchCatalogue(catalogue, query);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">FIND YOUR NEXT PLAN</span>
          <h1>
            Find your people<span className="lime-text">.</span>
          </h1>
          <p>Search the illustrative participating-gym preview.</p>
        </div>
      </div>
      <form
        action="/search"
        className="catalogue-search"
        role="search"
        aria-label="Catalogue search"
      >
        <Search size={19} aria-hidden="true" />
        <input
          aria-label="Search the public catalogue"
          name="q"
          defaultValue={query}
          key={query}
          maxLength={200}
          placeholder="Try strength, yoga or a gym name…"
        />
        <button className="button dark" type="submit">
          Search
        </button>
      </form>
      <p className="small-copy">
        Public demonstration catalogue · No account or wallet needed to browse.
      </p>
      {catalogueResult.status === "error" ? (
        <div className="catalogue-state" role="status">
          <Empty
            title="The gym catalogue is unavailable."
            description={catalogueResult.message}
          />
          <Link href="/coming-soon" className="button secondary">
            Join the waitlist
          </Link>
        </div>
      ) : catalogueResult.status === "empty" ? (
        <div className="catalogue-state" role="status">
          <Empty
            title="No participating gyms are available yet."
            description="Join the waitlist while the fictional catalogue is prepared."
          />
          <Link href="/coming-soon" className="button secondary">
            Join the waitlist
          </Link>
        </div>
      ) : catalogueResult.status === "loading" ? (
        <div className="catalogue-state" role="status">
          <Empty
            title="Loading the gym catalogue…"
            description="The fictional catalogue is being prepared."
          />
        </div>
      ) : query ? (
        <>
          <div className="results-label">
            <strong>
              {results.length} {results.length === 1 ? "result" : "results"} for
              “{query}”
            </strong>
            <Link href="/search" className="text-link">
              Clear search
            </Link>
          </div>
          <section className="search-group">
            <h2>Gyms</h2>
            {results.map((item) => (
              <Link
                href={item.href}
                key={item.href}
                className="discovery-result"
              >
                <span>
                  <small>{item.activity} · Illustrative gym</small>
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
                </span>
                <ArrowUpRight size={20} aria-hidden="true" />
              </Link>
            ))}
          </section>
          {!results.length && (
            <div className="empty">
              <h2>No matches this time.</h2>
              <p>
                Try an activity, area or gym name, or browse the catalogue
                below.
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="search-suggestions">
          <h2>A little inspiration</h2>
          <div className="chips">
            {["Strength", "Muay Thai", "Fabrik", "Yoga"].map((term) => (
              <Link
                className="chip"
                href={`/search?q=${encodeURIComponent(term)}`}
                key={term}
              >
                {term}
              </Link>
            ))}
          </div>
        </div>
      )}
      <div className="discovery-links">
        <Link className="button secondary" href="/explore">
          Explore gyms
        </Link>
        <Link className="button secondary" href="/how-it-works">
          How access works
        </Link>
      </div>
    </>
  );
}
