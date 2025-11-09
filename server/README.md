# Stjorna - Server

## Development server

Run `npm run start` to start the development server on `localhost:3000`

## Testing

Run `npm run test` to run the complete test suite

## Documentation

Run `apidoc:public` to generate the public API for the remote feature
Run `apidoc:private` to generate the complete API documentation for Stjorna

## Features

### Image Generation

Stjorna now includes an image generation API that allows you to create placeholder images programmatically. This is useful for products or categories that don't have images yet.

**Endpoint:** `POST /api/v1/generate-image`

**Parameters:**
- `width` (optional, default: 800): Image width in pixels (1-4000)
- `height` (optional, default: 600): Image height in pixels (1-4000)
- `text` (optional, default: "Placeholder"): Text to display on the image
- `backgroundColor` (optional, default: "#cccccc"): Background color in hex format
- `textColor` (optional, default: "#333333"): Text color in hex format
- `format` (optional, default: "jpeg"): Image format ('jpeg' or 'png')
- `category` (optional, default: "products"): Storage category ('products' or 'categories')

**Example Request:**
```bash
curl -X POST http://localhost:3000/api/v1/generate-image \
  -H "Content-Type: application/json" \
  -H "x-stjorna-userid: your-user-id" \
  -d '{
    "width": 400,
    "height": 300,
    "text": "My Product",
    "backgroundColor": "#ff0000",
    "textColor": "#ffffff",
    "format": "png"
  }'
```

**Example Response:**
```json
{
  "imageUrl": "/data/uploads/userid/products/abc123.png",
  "message": "Image generated successfully",
  "details": {
    "width": 400,
    "height": 300,
    "text": "My Product",
    "format": "png",
    "category": "products"
  }
}
```
