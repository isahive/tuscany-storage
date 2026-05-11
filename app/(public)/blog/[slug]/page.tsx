import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { connectDB } from '@/lib/db'
import Post from '@/models/Post'

export const revalidate = 300

interface RouteParams {
  params: Promise<{ slug: string }>
}

async function getPost(slug: string) {
  try {
    await connectDB()
    const doc = await Post.findOne({ slug, status: 'published' }).lean() as any
    if (!doc) return null
    return {
      _id: doc._id.toString(),
      title: doc.title,
      slug: doc.slug,
      excerpt: doc.excerpt ?? '',
      content: doc.content,
      coverImageUrl: doc.coverImageUrl,
      author: doc.author ?? 'Tuscany Village Self Storage',
      publishedAt: doc.publishedAt,
      tags: doc.tags ?? [],
    }
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) return { title: 'Post not found' }
  return {
    title: post.title,
    description: post.excerpt || post.title,
    openGraph: { images: post.coverImageUrl ? [post.coverImageUrl] : [] },
  }
}

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(date))

export default async function PostPage({ params }: RouteParams) {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) notFound()

  return (
    <article className="bg-white">
      <header className="relative overflow-hidden bg-brown py-20">
        <div className="relative z-10 mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <Link
            href="/blog"
            className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-tan hover:text-tan-light transition-colors"
          >
            &larr; Back to blog
          </Link>
          <p className="mb-3 text-xs uppercase tracking-[0.25em] text-tan">{formatDate(post.publishedAt)}</p>
          <h1 className="font-serif text-3xl font-bold leading-tight text-cream sm:text-4xl lg:text-5xl">
            {post.title}
          </h1>
          {post.excerpt && (
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-cream/60 sm:text-lg">{post.excerpt}</p>
          )}
          <p className="mt-6 text-sm text-cream/50">By {post.author}</p>
        </div>
      </header>

      {post.coverImageUrl && (
        <div className="bg-white">
          <div className="mx-auto -mt-12 max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="relative h-64 w-full overflow-hidden rounded-2xl shadow-xl sm:h-96">
              <Image
                src={post.coverImageUrl}
                alt={post.title}
                fill
                className="object-cover"
                priority
                sizes="(max-width: 1024px) 100vw, 1024px"
              />
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <div
          className="prose prose-lg max-w-none prose-headings:font-serif prose-headings:text-brown prose-p:text-brown/80 prose-a:text-tan hover:prose-a:text-tan-light prose-strong:text-brown"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        {post.tags.length > 0 && (
          <div className="mt-12 flex flex-wrap gap-2 border-t border-mid pt-8">
            {post.tags.map((tag: string) => (
              <span
                key={tag}
                className="rounded-full bg-cream px-3 py-1 text-xs font-medium text-brown"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  )
}
