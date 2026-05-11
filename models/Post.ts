import mongoose, { Schema, Document, Types } from 'mongoose'

export interface IPostDocument extends Document {
  title: string
  slug: string
  excerpt: string
  content: string
  coverImageUrl?: string
  author: string
  publishedAt: Date
  status: 'draft' | 'published'
  tags: string[]
  authorId?: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const PostSchema = new Schema<IPostDocument>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    excerpt: { type: String, default: '' },
    content: { type: String, required: true },
    coverImageUrl: { type: String },
    author: { type: String, default: 'Tuscany Village Self Storage' },
    publishedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['draft', 'published'], default: 'published' },
    tags: [{ type: String }],
    authorId: { type: Schema.Types.ObjectId, ref: 'Tenant' },
  },
  { timestamps: true },
)

PostSchema.index({ status: 1, publishedAt: -1 })
PostSchema.index({ tags: 1 })

export default mongoose.models.Post || mongoose.model<IPostDocument>('Post', PostSchema)
