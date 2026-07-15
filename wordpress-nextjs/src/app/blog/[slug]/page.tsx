import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getPostBySlug, getPosts } from "@/lib/wordpress";
import BlogShareButton from "@/components/blog/BlogShareButton";
import RelatedPostsSidebar from "@/components/blog/RelatedPostsSidebar";
import type { WPPost } from "@/types/wordpress";
import WpRenderedHtml from "@/components/cms/WpRenderedHtml";
import { getAcfSeoCopy, getMetadata } from "@/lib/wordpress/seo";
import { getCurrentUrlAndRoute, mergeSiteUrlMetadata } from "@/lib/site-url";
import JsonLd from "@/components/JsonLd";
import {
  blogPostingJsonLd,
  extractPostTagKeywords,
  faqPageJsonLd,
  parseAcfFaqField,
  stripHtml,
  upgradeHttpToHttpsUrl,
} from "@/lib/json-ld";
import "./blog-details.css";
import { BlogPostScrollToBreadcrumb } from "./BlogPostScrollToBreadcrumb";

export const revalidate = 3600;

interface BlogPostProps {
  params: Promise<{
    slug: string;
  }>;
}

const RELATED_POSTS_LIMIT = 4;

async function getRelatedPosts(current: WPPost): Promise<WPPost[]> {
  const fetchAndFilter = async (categories?: number[]) => {
    const posts = await getPosts({
      per_page: RELATED_POSTS_LIMIT + 1,
      categories,
      orderby: "date",
      order: "desc",
    });
    return posts.filter((p) => p.id !== current.id);
  };

  let related = await fetchAndFilter(
    current.categories?.length ? current.categories : undefined,
  );

  if (related.length < RELATED_POSTS_LIMIT && current.categories?.length) {
    related = await fetchAndFilter();
  }

  return related.slice(0, RELATED_POSTS_LIMIT);
}

/* SEO Metadata */
export async function generateMetadata({
  params,
}: BlogPostProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    return { title: "Post Not Found" };
  }

  return mergeSiteUrlMetadata(getMetadata(post), `/blog/${slug}`);
}

export default async function BlogPost({ params }: BlogPostProps) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const featuredImage = post._embedded?.["wp:featuredmedia"]?.[0];
  const author = post._embedded?.author?.[0];

  const { currentUrl: articleUrl } = await getCurrentUrlAndRoute(`/blog/${slug}`);
  const articleHttps = upgradeHttpToHttpsUrl(articleUrl);
  const headline = stripHtml(post.title.rendered);
  const excerpt = stripHtml(post.excerpt.rendered);
  const acfSeo = getAcfSeoCopy(post);
  const seoTitle = acfSeo?.title || headline;
  const seoDescription = acfSeo?.description || excerpt || headline;
  const imageUrl = featuredImage?.source_url as string | undefined;
  // const authorName = author?.name as string | undefined;
  const authorName = "Car Sales Brisbane";
  const heroHtml =
    typeof post.acf?.hero_section === "string"
      ? post.acf.hero_section.trim()
      : "";
  const relatedPosts = await getRelatedPosts(post);

  const blogPostingLd = blogPostingJsonLd({
    headline,
    alternativeHeadline: seoTitle,
    imageUrl,
    keywords: extractPostTagKeywords(post),
    url: articleHttps,
    datePublished: post.date,
    dateModified: post.modified,
    description: seoDescription,
    authorName,
  });
  // console.log("post.acf?.faq", post.acf?.faq);
  const faqLd = faqPageJsonLd(articleHttps, parseAcfFaqField(post.acf?.faq));


  return (
    <div className="bg-white min-vh-100">
      <JsonLd data={blogPostingLd} />
      {faqLd ? (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            ...faqLd,
          }}
        />
      ) : null}
      <BlogPostScrollToBreadcrumb slug={slug} />
      {/* <div className="container pt-4">
        <nav id="blog-breadcrumb" aria-label="Breadcrumb">
          <ol className="breadcrumb mb-3">
            <li className="breadcrumb-item">
              <Link href="/">Home</Link>
            </li>
            <li className="breadcrumb-item">
              <Link href="/blog">Blog</Link>
            </li>
            <li className="breadcrumb-item active" aria-current="page">
              {headline}
            </li>
          </ol>
        </nav>
      </div> */}

      {heroHtml ? (
        <WpRenderedHtml
          as="section"
          className="cs-page-hero py-3"
          html={heroHtml}
        />
      ) : null}

      <section className="py-5">
        <div className="container">
          <div className="row g-5">
            <div className="col-lg-8">
              <article aria-labelledby="blog-post-title">
                <h1
                  id="blog-post-title"
                  className={heroHtml ? "visually-hidden" : "h2 fw-bold mb-4"}
                >
                  {headline}
                </h1>
                <WpRenderedHtml html={post.content.rendered} />
              </article>
            </div>
            <div className="col-lg-4">
              <aside className="blog-sidebar">
                <BlogShareButton title={headline} shareUrl={articleHttps} />
                <RelatedPostsSidebar posts={relatedPosts} />
              </aside>
            </div>
          </div>
        </div>
      </section>

      {/* Footer Navigation */}
      {/* <div className="container">
        <div className="px-4 py-4 mb-4  border">
          <h3 className="h4 fw-bold mb-4">Continue Reading</h3>
          <Link
            href="/blog"
            className="d-inline-flex align-items-center fw-bold text-primary text-decoration-none"
          >
            ← Back to Blog
          </Link>
        </div>
      </div> */}
    </div>
  );
}
