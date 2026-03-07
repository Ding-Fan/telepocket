# OpenClaw Guide: Saving Images to Telepocket

Use this guide only for the Telepocket image-save feature.

## Purpose

When the user wants to save screenshots, photos, design references, or image-based notes into Telepocket, use the `notes.save` MCP tool with an `images` array.

Do not create a separate storage path. Do not write directly to Supabase.

## Tool To Use

Use `notes.save`.

The image feature is part of `notes.save`, not a separate tool.

## Required Rule

Always send:
- `content`
- `idempotency_key`

For images, each image should include at least one locator:
- `url`, or
- `cloudflare_url`, or
- `telegram_file_id`

For stable retries, strongly prefer:
- `image_source_id`

## Image Payload Shape

```json
{
  "content": "Save these image references for later.",
  "idempotency_key": "openclaw-images-001",
  "source": "openclaw",
  "source_item_id": "optional-external-message-id",
  "images": [
    {
      "url": "https://example.com/reference.png",
      "image_source_id": "reference-image-001",
      "file_name": "reference.png",
      "file_size": 123456,
      "mime_type": "image/png",
      "width": 1440,
      "height": 900
    }
  ]
}
```

## Image Fields

Each image object may contain:

- `url`
- `cloudflare_url`
- `image_source_id`
- `telegram_file_id`
- `telegram_file_unique_id`
- `file_name`
- `file_size`
- `mime_type`
- `width`
- `height`

## Best Practices

1. Use one `idempotency_key` per save request.
2. Use one stable `image_source_id` per image when possible.
3. If the image URL may expire or change, `image_source_id` is especially important.
4. Include `mime_type`, `file_name`, and dimensions when available.
5. Put user context in `content`, even if the main asset is the image.

## Recommended Patterns

### Save one image with a note

```json
{
  "content": "Save this dashboard mockup for the redesign project.",
  "idempotency_key": "openclaw-dashboard-mockup-001",
  "source": "openclaw",
  "images": [
    {
      "url": "https://example.com/dashboard.png",
      "image_source_id": "dashboard-mockup-v1",
      "file_name": "dashboard.png",
      "mime_type": "image/png",
      "width": 1440,
      "height": 900
    }
  ]
}
```

### Save multiple images in one note

```json
{
  "content": "Save these inspiration images for the landing page refresh.",
  "idempotency_key": "openclaw-landing-inspiration-001",
  "source": "openclaw",
  "images": [
    {
      "url": "https://example.com/hero-1.jpg",
      "image_source_id": "landing-hero-1",
      "file_name": "hero-1.jpg",
      "mime_type": "image/jpeg"
    },
    {
      "url": "https://example.com/hero-2.jpg",
      "image_source_id": "landing-hero-2",
      "file_name": "hero-2.jpg",
      "mime_type": "image/jpeg"
    }
  ]
}
```

### Save Telegram-originated image metadata

```json
{
  "content": "Save this Telegram image note.",
  "idempotency_key": "openclaw-telegram-image-001",
  "source": "openclaw",
  "images": [
    {
      "telegram_file_id": "AgACAg...",
      "telegram_file_unique_id": "AQAD...",
      "image_source_id": "telegram-photo-AQAD...",
      "cloudflare_url": "https://cdn.example.com/photo.jpg",
      "file_name": "photo.jpg",
      "mime_type": "image/jpeg",
      "width": 1280,
      "height": 720
    }
  ]
}
```

## Save Then Summarize

If the user says to save an image and summarize it:

1. call `notes.save`
2. read `note_id` from the result
3. call `notes.summarize` with that `note_id`

## Expected Result Shape

```json
{
  "note_id": "uuid",
  "created": true,
  "deduplicated": false,
  "link_count": 0,
  "image_count": 1,
  "links": [],
  "images": []
}
```

## Failure Prevention

Do not:
- omit `idempotency_key`
- send image objects with no locator
- use random values on retries
- bypass Telepocket and write directly to Supabase

## Short Rule Set For OpenClaw

- use `notes.save`
- include `images`
- include `idempotency_key`
- prefer `image_source_id`
- save first, summarize second
