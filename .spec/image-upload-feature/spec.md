# Image Upload to Cloudflare R2 Specification

## Problem & Solution

**Problem**: Users need to upload images and get shareable URLs for use in blog posts, documentation, and notes.

**Solution**: Auto-upload photos sent to Telegram bot → Cloudflare R2 storage → Return public URL → Store metadata in database alongside note content.

**Returns**: Public Cloudflare R2 URL stored in `z_note_images` table with note association.

## Component API

```typescript
// Image Uploader Service
interface UploadResult {
  cloudflareUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

interface UploadOptions {
  originalFileName?: string;
  mimeType: string;
}

class ImageUploader {
  uploadImage(buffer: Buffer, options: UploadOptions): Promise<UploadResult>;
}

// Database Operations
interface NoteImage {
  id: string;
  note_id: string;
  telegram_file_id: string;
  telegram_file_unique_id: string;
  cloudflare_url: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  width?: number;
  height?: number;
  created_at: string;
  updated_at: string;
}

async function saveNoteImages(
  noteId: string,
  images: Omit<NoteImage, 'id' | 'created_at' | 'updated_at'>[]
): Promise<void>;
```

## Usage Example

```typescript
// User sends photo to bot
// Bot handler extracts photo and uploads
const file = await ctx.api.getFile(photo.file_id);
const buffer = await downloadFromTelegram(file);

const result = await imageUploader.uploadImage(buffer, {
  originalFileName: file.file_path?.split('/').pop(),
  mimeType: 'image/jpeg',
});

// Save to database
await noteOps.saveNoteImages(noteId, [{
  telegram_file_id: photo.file_id,
  telegram_file_unique_id: photo.file_unique_id,
  cloudflare_url: result.cloudflareUrl,
  file_name: result.fileName,
  file_size: result.fileSize,
  mime_type: result.mimeType,
  width: photo.width,
  height: photo.height,
}]);
```

## Core Flow

```
User sends photo with optional caption
  ↓
Bot downloads from Telegram (largest size)
  ↓
Upload to R2 with unique filename (timestamp-uuid-sanitized.ext)
  ↓
Save note (caption or "(Image)") + image record
  ↓
Reply with public URL
```

## User Stories

**US-1: Single Photo Upload**
User sends photo with caption "Product screenshot". Bot uploads to R2, saves note with caption, returns public URL. User copies URL for blog post.

**US-2: Photo Without Caption**
User sends photo without caption. Bot uploads to R2, saves note with "(Image)" placeholder, returns URL. Photo stored and searchable via `/notes`.

**US-3: Large Photo Rejection**
User sends 25MB photo. Bot rejects with "Image too large. Max size: 19MB" error. User compresses and resends successfully.

## MVP Scope

**Included**:
- Auto-upload photos (no command needed)
- Cloudflare R2 storage with S3 SDK
- Unique filename generation (`timestamp-uuid-sanitized.ext`)
- Caption saved as note content
- Database table `z_note_images` with RLS
- File size validation (19MB limit)
- MIME type validation (JPG, PNG, WebP)
- Display images in `/notes` list
- Error handling with user-friendly messages

**NOT Included** (Future):
- Image compression/optimization → 🔧 Robust
- Thumbnail generation → 🔧 Robust
- Album support (multiple photos) → 🔧 Robust
- Delete image command → 🔧 Robust
- OCR text extraction → 🚀 Advanced
- Visual similarity search → 🚀 Advanced
- Watermark overlay → 🚀 Advanced
- Private images with signed URLs → 🚀 Advanced

## Cloudflare R2 Configuration

**Public Access Setup**:

Cloudflare R2 offers two methods for public bucket access:

1. **Public Development URL (r2.dev)** - For testing/development:
   - Format: `https://pub-xxxxx.r2.dev`
   - Enable via R2 Dashboard → Bucket Settings → Public Access → "Allow Access"
   - **Limitations**: Rate limited, no cache, testing only
   - **Use case**: Development and testing

2. **Custom Domain** - For production:
   - Uses your own domain (e.g., `https://cdn.yourdomain.com`)
   - Requires domain added to Cloudflare DNS
   - **Benefits**: Cloudflare Cache, no rate limits, bot management
   - **Use case**: Production deployments

**Environment Variables Required**:
```bash
CLOUDFLARE_R2_ACCOUNT_ID=your-account-id
CLOUDFLARE_R2_ACCESS_KEY_ID=your-access-key-id
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your-secret-access-key
CLOUDFLARE_R2_BUCKET_NAME=blog-nextra-storage
CLOUDFLARE_R2_PUBLIC_URL=https://pub-xxxxx.r2.dev  # Or custom domain
```

**AWS SDK Configuration** (Critical):
```typescript
const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
  forcePathStyle: true  // REQUIRED for R2 compatibility
});
```

**Note**: `forcePathStyle: true` is mandatory. Without it, R2 returns "InvalidArgument: Authorization" error.

## Database Schema

```sql
CREATE TABLE z_note_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES z_notes(id) ON DELETE CASCADE,
  telegram_file_id TEXT NOT NULL,
  telegram_file_unique_id TEXT NOT NULL,
  cloudflare_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_note_images_note_id ON z_note_images(note_id);
CREATE INDEX idx_note_images_telegram_file_id ON z_note_images(telegram_file_id);
CREATE INDEX idx_note_images_created_at ON z_note_images(created_at DESC);
```

## Acceptance Criteria (MVP)

**Functional**:
- [ ] Photos auto-upload when sent to bot
- [ ] Public URLs generated and accessible
- [ ] Caption saved as note content
- [ ] No caption uses "(Image)" placeholder
- [ ] File size validation (reject >19MB)
- [ ] MIME type validation (JPG, PNG, WebP only)
- [ ] Unique filenames prevent collisions
- [ ] Images display in `/notes` list

**Database**:
- [ ] `z_note_images` table created with correct schema
- [ ] Foreign key CASCADE delete works
- [ ] RLS policies active (service_role + public)
- [ ] 3 indexes created and utilized

**UI/UX**:
- [ ] Bot replies with confirmation + URL
- [ ] URLs are copyable and accessible
- [ ] Error messages user-friendly
- [ ] Upload completes in <10s

**Security**:
- [ ] Unique filenames prevent URL guessing
- [ ] File size validation prevents abuse
- [ ] MIME type validation prevents malicious files
- [ ] RLS policies protect database access

## Future Tiers

**🔧 Robust** (+16h): Image compression before upload, thumbnail generation (200x200), album support via media_group_id, delete image command, GIF support.

**🚀 Advanced** (+24h): OCR text extraction with searchable field, visual similarity search using pgvector, watermark overlay with configurable opacity, private images with signed URLs and expiration.

---

**Status**: ✅ MVP Implemented & Deployed (2025-11-03) | **Actual Effort**: ~16 hours

**Implementation Notes**:
- Database migration applied successfully (z_note_images table with RLS)
- AWS SDK v3 (@aws-sdk/client-s3) installed for R2 compatibility
- Photo handler integrated with Grammy bot (src/bot/noteHandlers.ts)
- Images displayed in /notes list before links
- PM2 production deployment configured (ecosystem.config.js)

**Key Learnings**:
1. **forcePathStyle Required**: AWS SDK v3 must have `forcePathStyle: true` for R2. Without it, R2 returns "InvalidArgument: Authorization" error.
2. **Public URL Configuration**: Use Public Development URL (r2.dev) for testing. For production, use custom domain with Cloudflare Cache enabled.
3. **Circular Dependency Fix**: Moved photo handler to noteHandlers.ts to avoid client.ts ↔ handlers.ts circular import.
4. **PM2 Deployment**: Changed from `pnpm dev` (ts-node) to `pnpm start` (compiled dist/) to avoid circular dependency issues in production.

**Tested & Working**:
- ✅ Photo upload to R2 bucket
- ✅ Public URL generation and accessibility
- ✅ Database records created correctly
- ✅ Bot replies with URL confirmation
- ✅ Caption saved as note content
