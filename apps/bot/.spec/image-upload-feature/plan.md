# Image Upload to Cloudflare R2 Implementation Plan

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Storage Provider** | Cloudflare R2 | Already configured bucket (blog-nextra-storage), S3-compatible API, cost-effective |
| **SDK** | AWS S3 SDK v3 (@aws-sdk/client-s3) | R2 is S3-compatible, official AWS SDK, well-maintained |
| **Database Schema** | Separate `z_note_images` table | Supports multiple images per note, clean separation, follows existing z_notes/z_links pattern |
| **Upload Trigger** | Auto-upload on photo receive | Follows existing text message handler pattern, no new commands needed |
| **Filename Strategy** | `timestamp-uuid-sanitized.ext` | Prevents collisions and URL guessing, preserves original name for reference |
| **File Size Limit** | 19MB (Telegram 20MB - 1MB buffer) | User requested 1MB safety margin |
| **Display Format** | Bulleted URLs (before links) | Consistent with existing link display in `/notes` |

## Codebase Integration Strategy

**Service Layer**: `src/services/imageUploader.ts`
- Singleton pattern (matches `linkExtractor`, `metadataFetcher`)
- S3Client initialization with R2 endpoint
- Validation methods (size, MIME type)

**Database Layer**: `src/database/noteOperations.ts` (extend existing)
- Add `saveNoteImages()` method
- Add `getNoteImages()` method
- Follow existing error handling pattern with `handleDatabaseError()`

**Bot Handler**: `src/bot/handlers.ts` (extend existing)
- Add `handlePhotoMessage()` function (parallels `processMessage()`)
- Register handler in `client.ts`: `bot.on('message:photo')`
- Reuse existing authorization check pattern

**Display**: `src/bot/linkFormatter.ts` (extend existing)
- Update `formatNoteForDisplay()` to include images section
- Images shown before links (both bulleted lists)

## Technical Approach

**Existing Patterns to Follow**:
1. **Service Pattern**: Study `src/services/linkExtractor.ts` for singleton service class
2. **Database Operations**: Study `src/database/noteOperations.ts` for Supabase operations
3. **Error Handling**: Use `handleDatabaseError()` from `src/utils/errorHandler.ts`
4. **Validation**: Use patterns from `src/utils/validation.ts`

**Component Composition**:
- ImageUploader validates → uploads → returns URL
- Photo handler downloads → calls ImageUploader → saves to database
- Display formatter retrieves images → formats as bulleted list

**Upload Flow**:
```
Grammy photo event → handlePhotoMessage()
  ↓
Extract largest photo + caption
  ↓
Download from Telegram (fetch API)
  ↓
ImageUploader.uploadImage() → R2 via S3 SDK
  ↓
saveNote() + saveNoteImages() (parallel to existing saveNoteWithLinks)
  ↓
Reply with URL
```

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| **R2 upload failures** | Retry once, log error, show user-friendly message |
| **Large file memory usage** | Validate size before download, stream upload (future optimization) |
| **Telegram download timeout** | 30s timeout, clear error message |
| **Database save failure after upload** | Log R2 URL for manual cleanup, future: implement rollback |
| **URL guessing/enumeration** | UUID in filename makes URLs unguessable (128-bit entropy) |

## Integration Points

**Database**: `supabase/migrations/create_note_images_table.sql`
**Environment**: `.env` (add 5 R2 variables)
**Bot Client**: `src/bot/client.ts` (register photo handler)
**Display**: `src/bot/linkFormatter.ts` (format images)

## Success Criteria

**Technical**:
- S3 SDK connects to R2 successfully
- File size validation works (19MB limit)
- Unique filenames generated (no collisions)
- Database foreign key CASCADE delete works

**User**:
- Upload completes in <10s
- Public URLs are accessible
- Error messages are clear and actionable
- Images appear in `/notes` list

**Business**:
- No external API costs (R2 storage only)
- Follows existing codebase patterns
- Easy to extend (compression, thumbnails)

## Robust Product (+16h)

Image compression with Sharp library, thumbnail generation (200x200), album support via media_group_id grouping, delete image command (`/delete-image <id>`), GIF support.

## Advanced Product (+24h)

OCR text extraction with searchable field, visual similarity search using pgvector embeddings, watermark overlay with configurable position/opacity, private images with signed URLs and expiration.

---

**Status**: ✅ MVP Complete (2025-11-03) | **Actual**: ~16 hours | **Next**: Add R2 credentials & test

**What Was Built**:
- ✅ Migration: z_note_images table with indexes and RLS
- ✅ Service: ImageUploader with S3Client, validation, unique filenames
- ✅ Database: saveNoteImages() and getNoteImages() methods
- ✅ Handler: handlePhotoMessage() auto-uploads to R2
- ✅ Display: Images shown in /notes list with formatNoteForDisplay()
- ✅ Integration: Registered photo handler in bot client

**Dependencies Met**: AWS SDK v3 installed | **Pending**: R2 credentials for testing
