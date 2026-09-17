import mongoose, { Schema, Document } from 'mongoose';

export interface AccountDocument extends Document {
  tenantId: mongoose.Types.ObjectId;
  name: string;
  code?: string;
  description?: string;
  openingBalance: number;
  currentBalance: number;
  isDefault?: boolean;
  status: 'active' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}

const AccountSchema = new Schema<AccountDocument>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true },
    code: { type: String },
    description: { type: String },
    openingBalance: { type: Number, default: 0 },
    currentBalance: { type: Number, default: 0 },
    isDefault: { type: Boolean, default: false },
    status: { type: String, enum: ['active', 'archived'], default: 'active' },
  },
  { timestamps: true }
);

AccountSchema.index({ tenantId: 1, name: 1 });

export const Account = mongoose.model<AccountDocument>('Account', AccountSchema);
