import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { connectDB } from '@/lib/db'
import Post from '@/models/Post'

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Storage tips, facility updates, and resources from Tuscany Village Self Storage.',
}

export const revalidate = 300 // 5 min

interface PostListItem {
  _id: string
  title: string
  slug: string
  excerpt: string
  coverImageUrl?: string
  author: string
  publishedAt: Date
  tags: string[]
}

async function getPosts(): Promise<PostListItem[]> {
  try {
    await connectDB()
    const docs = await Post.find({ status: 'published' })
      .sort({ publishedAt: -1 })
      .limit(50)
      .lean()
    return docs.map((d: any) => ({
      _id: d._id.toString(),
      title: d.title,
      slug: d.slug,
      excerpt: d.excerpt ?? '',
      coverImageUrl: d.coverImageUrl,
      author: d.author ?? 'Tuscany Village Self Storage',
      publishedAt: d.publishedAt,
      tags: d.tags ?? [],
    }))
  } catch {
    return []
  }
}

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(date))

export default async function BlogPage() {
  const posts = await getPosts()
  return (
    <>
      <section className="relative overflow-hidden bg-brown py-20 sm:py-24">
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-tan/40 to-transparent" />
        <div className="relative z-10 mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <div className="mb-5 flex items-center justify-center gap-3">
            <div className="h-px w-12 bg-tan/40" />
            <div className="h-1.5 w-1.5 rounded-full bg-tan/60" />
            <div className="h-px w-12 bg-tan/40" />
          </div>
          <h1 className="font-serif text-4xl font-bold leading-tight text-cream sm:text-5xl">
            From the <span className="text-tan">Blog</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-cream/60 sm:text-lg">
            Tips, updates, and resources to make storage easier.
          </p>
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          {posts.length === 0 ? (
            <div className="mx-auto max-w-md text-center py-12">
              <p className="text-base text-muted">
                No posts yet. Check back soon — we&apos;re working on great content for you.
              </p>
            </div>
          ) : (
            <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <li key={post._id}>
                  <Link
                    href={`/blog/${post.slug}`}
                    className="group block rounded-2xl border border-mid bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-brown/[0.06] overflow-hidden h-full"
                  >
                    {post.coverImageUrl && (
                      <div className="relative h-44 w-full overflow-hidden">
                        <Image
                          src={post.coverImageUrl}
                          alt={post.title}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        />
                      </div>
                    )}
                    <div className="p-6">
                      <p className="mb-2 text-xs uppercase tracking-widest text-tan">
                        {formatDate(post.publishedAt)}
                      </p>
                      <h2 className="font-serif text-xl font-semibold text-brown leading-snug group-hover:text-tan transition-colors">
                        {post.title}
                      </h2>
                      {post.excerpt && (
                        <p className="mt-3 text-sm leading-relaxed text-muted line-clamp-3">{post.excerpt}</p>
                      )}
                      <p className="mt-4 text-xs font-semibold text-tan">
                        Read more &rarr;
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  )
}
