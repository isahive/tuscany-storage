import mongoose, { Schema, Document } from 'mongoose'

export interface IProductDocument extends Document {
  name: string
  price: number        // cents — retail price charged to tenant
  cost: number         // cents — wholesale cost (for margin tracking)
  taxRate: number      // percentage, e.g. 8.25
  description: string
  inventory: number    // current stock count, -1 = unlimited
  active: boolean
  createdAt: Date
  updatedAt: Date
}

const ProductSchema = new Schema<IProductDocument>(
  {
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true },
    cost: { type: Number, default: 0 },
    taxRate: { type: Number, default: 0 },
    description: { type: String, default: '' },
    inventory: { type: Number, default: -1 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
)

ProductSchema.index({ active: 1 })

export default mongoose.models.Product || mongoose.model<IProductDocument>('Product', ProductSchema)
