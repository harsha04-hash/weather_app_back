import mongoose from 'mongoose';

const SearchSchema = new mongoose.Schema(
  {
    city: { type: String, required: true },
    cityLower: { type: String, required: true, unique: true, index: true },
  },
  { timestamps: true }
);

// Optional: ensure cityLower sync
SearchSchema.pre('save', function (next) {
  if (this.isModified('city')) {
    this.cityLower = this.city.toLowerCase();
  }
  next();
});

export const Search = mongoose.model('Search', SearchSchema);
