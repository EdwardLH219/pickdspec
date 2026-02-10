# Demo Review Data

This folder contains sample review CSV files for testing the Pick'd system.

## Files

| File | Restaurant | Reviews | Date Range |
|------|-----------|---------|------------|
| `waterfront_reviews_batch1.csv` | V&A Waterfront | 15 | Nov-Dec 2025 |
| `waterfront_reviews_batch2.csv` | V&A Waterfront | 15 | Dec 2025 - Jan 2026 |
| `stellenbosch_reviews_batch1.csv` | Stellenbosch | 15 | Nov-Dec 2025 |
| `stellenbosch_reviews_batch2.csv` | Stellenbosch | 15 | Dec 2025 - Jan 2026 |

**Total: 60 reviews** with a realistic mix of positive, neutral, and negative sentiment.

## CSV Format

All files use the same column structure:

```csv
content,date,rating,title,author
```

| Column | Required | Description |
|--------|----------|-------------|
| content | Yes | Review text content |
| date | Yes | Review date (YYYY-MM-DD format) |
| rating | No | Star rating (1-5) |
| title | No | Review title |
| author | No | Reviewer name |

## How to Upload

1. **Login** to the portal as Owner or Manager
2. Go to **Data Sources** page
3. Select the appropriate **connector** (Website/CSV for each branch)
4. Click **Upload File**
5. Select the CSV file
6. Map columns (use defaults: content, date, rating, title, author)
7. Process the upload

## Column Mapping

When uploading, use these column mappings:

```json
{
  "content": "content",
  "reviewDate": "date",
  "rating": "rating",
  "title": "title",
  "authorName": "author"
}
```

## Themes Coverage

The reviews are designed to cover common restaurant themes:
- **Service** - waiter behavior, speed, attentiveness
- **Food Quality** - taste, freshness, cooking
- **Cleanliness** - hygiene issues, dirty tables
- **Value** - pricing, portions
- **Ambiance** - noise, views, atmosphere
- **Wait Time** - delays, slow service

## Sentiment Distribution

Each batch contains approximately:
- 5-6 positive reviews (rating 4-5)
- 4-5 neutral reviews (rating 3)
- 4-5 negative reviews (rating 1-2)

## No OpenAI Required

The sentiment analysis uses a **stub provider** with keyword matching for testing. No API keys are required. The system will still generate meaningful sentiment scores based on positive/negative keywords in the review text.

To enable OpenAI (production):
1. Set `OPENAI_API_KEY` environment variable
2. The system will automatically use OpenAI for more accurate sentiment analysis
