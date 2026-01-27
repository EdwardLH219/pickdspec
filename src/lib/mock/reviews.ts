import { Review, ReviewTheme, ReviewSourceType } from "@/lib/types";

// ============================================
// REVIEW CONTENT TEMPLATES
// ============================================

interface ReviewTemplate {
  rating: number;
  sentiment: "positive" | "neutral" | "negative";
  sentimentScore: number;
  titles: string[];
  contents: string[];
  themeExcerpts: { themeId: string; excerpt: string; sentiment: "positive" | "neutral" | "negative"; score: number }[];
}

const positiveTemplates: ReviewTemplate[] = [
  {
    rating: 5,
    sentiment: "positive",
    sentimentScore: 9.2,
    titles: ["Absolutely fantastic!", "Best dining experience", "Will definitely return", "Exceeded expectations"],
    contents: [
      "What an incredible experience! The food was outstanding - every dish was perfectly prepared and presented beautifully. Our server was attentive without being intrusive, and the ambiance was perfect for our anniversary dinner. The seafood platter was the freshest I've had in years. Can't wait to come back!",
      "From start to finish, everything was perfect. The menu had excellent variety, and our waiter gave great recommendations. The prices are very fair for the quality you receive. The restaurant was spotlessly clean and the atmosphere was wonderful. Highly recommend!",
      "This place never disappoints. We've been coming here for months and the quality is always consistent. Staff remembers our preferences, food is always delicious, and the view is unbeatable. Worth every penny!",
    ],
    themeExcerpts: [
      { themeId: "theme-1", excerpt: "food was outstanding - every dish was perfectly prepared", sentiment: "positive", score: 9.5 },
      { themeId: "theme-3", excerpt: "server was attentive without being intrusive", sentiment: "positive", score: 9.0 },
      { themeId: "theme-6", excerpt: "ambiance was perfect for our anniversary dinner", sentiment: "positive", score: 9.2 },
    ],
  },
  {
    rating: 5,
    sentiment: "positive",
    sentimentScore: 8.8,
    titles: ["Hidden gem!", "Amazing food and service", "New favorite restaurant", "Spectacular"],
    contents: [
      "Just discovered this place and I'm blown away. The grilled fish was cooked to perfection, and the sides were creative and delicious. Service was prompt and friendly. The outdoor seating area is beautiful. Already planning my next visit!",
      "Everything exceeded our expectations. The staff went above and beyond to accommodate our dietary restrictions. Food came out quickly and was absolutely delicious. Great value for the quality. The clean, modern decor adds to the experience.",
      "Five stars isn't enough! The attention to detail here is remarkable. From the warm welcome to the perfectly timed courses, everything was spot on. The local ingredients really shine through in every dish.",
    ],
    themeExcerpts: [
      { themeId: "theme-1", excerpt: "grilled fish was cooked to perfection", sentiment: "positive", score: 9.0 },
      { themeId: "theme-2", excerpt: "Food came out quickly", sentiment: "positive", score: 8.5 },
      { themeId: "theme-4", excerpt: "Great value for the quality", sentiment: "positive", score: 8.8 },
    ],
  },
  {
    rating: 4,
    sentiment: "positive",
    sentimentScore: 7.5,
    titles: ["Great experience overall", "Really enjoyed it", "Solid choice", "Very good"],
    contents: [
      "Had a lovely dinner here. The food was delicious and well-portioned. Service was good, though we had to wait a bit for our drinks. The atmosphere is relaxed and welcoming. Would recommend for a casual night out.",
      "Good food, friendly staff, nice setting. The menu has something for everyone. Prices are reasonable. Only minor issue was the noise level during peak hours, but that's expected. Will come back!",
      "Enjoyed our meal very much. The starters were exceptional, mains were solid. Staff was helpful with wine pairing. Clean facilities and comfortable seating. A reliable choice for quality dining.",
    ],
    themeExcerpts: [
      { themeId: "theme-1", excerpt: "food was delicious and well-portioned", sentiment: "positive", score: 8.0 },
      { themeId: "theme-3", excerpt: "friendly staff", sentiment: "positive", score: 7.5 },
      { themeId: "theme-7", excerpt: "menu has something for everyone", sentiment: "positive", score: 7.8 },
    ],
  },
];

const neutralTemplates: ReviewTemplate[] = [
  {
    rating: 3,
    sentiment: "neutral",
    sentimentScore: 5.5,
    titles: ["It was okay", "Average experience", "Nothing special", "Mixed feelings"],
    contents: [
      "The food was decent but nothing memorable. Service was a bit slow during our visit. The location is nice but the restaurant itself could use some updating. Prices felt a bit high for what we got. Might try again to give it another chance.",
      "Had both good and not-so-good moments. Appetizers were great, but main course was underwhelming. Staff seemed overwhelmed. The place was clean though. It's an okay option if nothing else is available.",
      "Middle of the road experience. Some dishes hit, others miss. The wait for a table was longer than expected despite having a reservation. Once seated, things improved. Ambiance is pleasant.",
    ],
    themeExcerpts: [
      { themeId: "theme-1", excerpt: "food was decent but nothing memorable", sentiment: "neutral", score: 5.5 },
      { themeId: "theme-2", excerpt: "Service was a bit slow", sentiment: "negative", score: 4.0 },
      { themeId: "theme-4", excerpt: "Prices felt a bit high for what we got", sentiment: "neutral", score: 5.0 },
    ],
  },
  {
    rating: 3,
    sentiment: "neutral",
    sentimentScore: 5.0,
    titles: ["Could be better", "Just okay", "Room for improvement", "Not bad"],
    contents: [
      "The restaurant has potential but isn't quite there yet. Food quality varies - some dishes are good, others need work. Staff tries hard but seems understaffed. The setting is lovely though. Hoping they improve.",
      "Average dining experience. The menu looked promising but execution was inconsistent. Service was friendly but forgetful. Cleanliness was fine. Prices are fair. Nothing to complain about, nothing to rave about.",
      "Came with high expectations based on reviews but left feeling it was just okay. The seafood was fresh but over-seasoned. Nice view compensated for the mediocre meal. Might give it another try.",
    ],
    themeExcerpts: [
      { themeId: "theme-1", excerpt: "Food quality varies - some dishes are good, others need work", sentiment: "neutral", score: 5.0 },
      { themeId: "theme-3", excerpt: "Staff tries hard but seems understaffed", sentiment: "neutral", score: 5.5 },
      { themeId: "theme-6", excerpt: "setting is lovely", sentiment: "positive", score: 7.0 },
    ],
  },
];

const negativeTemplates: ReviewTemplate[] = [
  {
    rating: 2,
    sentiment: "negative",
    sentimentScore: 3.0,
    titles: ["Disappointing", "Expected more", "Won't return", "Below average"],
    contents: [
      "Unfortunately, our experience was poor. The food took forever to arrive and was lukewarm when it did. The server seemed disinterested. For the prices they charge, I expected much better. The only positive was the nice decor.",
      "Not impressed at all. My steak was overcooked despite asking for medium-rare. Had to ask multiple times for water refills. The table wasn't properly cleaned when we sat down. Definitely overpriced for what you get.",
      "Disappointing visit. We waited 20 minutes to be seated even with a reservation. Food was bland and portions were small. Staff was apologetic but that doesn't fix the meal. Won't be rushing back.",
    ],
    themeExcerpts: [
      { themeId: "theme-2", excerpt: "food took forever to arrive and was lukewarm", sentiment: "negative", score: 2.5 },
      { themeId: "theme-3", excerpt: "server seemed disinterested", sentiment: "negative", score: 3.0 },
      { themeId: "theme-4", excerpt: "overpriced for what you get", sentiment: "negative", score: 2.5 },
    ],
  },
  {
    rating: 1,
    sentiment: "negative",
    sentimentScore: 1.5,
    titles: ["Terrible experience", "Avoid this place", "Very disappointed", "Worst meal ever"],
    contents: [
      "Absolutely terrible. The food was cold, the service was rude, and we found a hair in our salad. When we complained, the manager was dismissive. This place has really gone downhill. Save your money and go elsewhere.",
      "One of the worst dining experiences I've had. Waited 45 minutes for our food, and when it arrived, it was wrong. The bathroom was disgusting. Staff couldn't care less. Never again.",
      "Do not waste your time or money here. The menu prices don't match what you actually get. Our waiter forgot our order twice. Food was inedible - sent it back. Just awful all around.",
    ],
    themeExcerpts: [
      { themeId: "theme-1", excerpt: "food was cold", sentiment: "negative", score: 1.5 },
      { themeId: "theme-5", excerpt: "bathroom was disgusting", sentiment: "negative", score: 1.0 },
      { themeId: "theme-3", excerpt: "service was rude", sentiment: "negative", score: 1.5 },
    ],
  },
];

// Branch-specific positive excerpts
const branch1Excerpts = [
  { themeId: "theme-9", excerpt: "the ocean view was breathtaking", sentiment: "positive" as const, score: 9.5 },
  { themeId: "theme-10", excerpt: "seafood was incredibly fresh", sentiment: "positive" as const, score: 9.0 },
  { themeId: "theme-9", excerpt: "watching the sunset from our table was magical", sentiment: "positive" as const, score: 9.2 },
  { themeId: "theme-10", excerpt: "the catch of the day was perfectly prepared", sentiment: "positive" as const, score: 8.8 },
];

const branch2Excerpts = [
  { themeId: "theme-11", excerpt: "the garden seating is absolutely lovely", sentiment: "positive" as const, score: 9.0 },
  { themeId: "theme-12", excerpt: "you can taste the freshness of local produce", sentiment: "positive" as const, score: 8.8 },
  { themeId: "theme-11", excerpt: "outdoor patio was perfect for lunch", sentiment: "positive" as const, score: 8.5 },
  { themeId: "theme-12", excerpt: "loved that they source from local farms", sentiment: "positive" as const, score: 9.0 },
];

// ============================================
// AUTHOR NAMES
// ============================================

const authorNames = [
  "Sarah M.", "John D.", "Mike R.", "Emma L.", "David K.", "Lisa P.", "James W.", "Anna S.",
  "Robert H.", "Jennifer T.", "Michael B.", "Amanda C.", "Chris F.", "Rachel G.", "Daniel N.",
  "Michelle O.", "Steven Q.", "Laura V.", "Kevin X.", "Nicole Y.", "Brian Z.", "Samantha A.",
  "Thomas E.", "Catherine I.", "Andrew J.", "Elizabeth U.", "Matthew L.", "Jessica P.",
  "Ryan M.", "Megan S.", "Justin T.", "Ashley W.", "Brandon C.", "Stephanie D.", "Tyler F.",
  "Kayla G.", "Austin H.", "Brittany K.", "Dylan L.", "Amber N.", "Cody O.", "Courtney R.",
  "Ethan V.", "Hannah B.", "Logan J.", "Olivia M.", "Nathan P.", "Sophia Q.", "Caleb S.",
  "Ava T.", "Isaac W.", "Chloe X.", "Liam Y.", "Zoe Z.", "Noah A.", "Lily B.", "Mason C.",
  "Grace D.", "Lucas E.", "Ella F.", "Jackson G.", "Scarlett H.", "Aiden I.", "Victoria J.",
];

// ============================================
// GENERATE REVIEWS
// ============================================

const sources: ReviewSourceType[] = ["google", "hellopeter", "facebook", "tripadvisor"];
const branchIds = ["branch-1", "branch-2"];

// Generate 120 reviews over 6 months (Aug 2025 - Jan 2026)
function generateReviews(): { reviews: Review[]; reviewThemes: ReviewTheme[] } {
  const reviews: Review[] = [];
  const reviewThemes: ReviewTheme[] = [];
  
  // Distribution: 55% positive (5-4 stars), 25% neutral (3 stars), 20% negative (2-1 stars)
  // Use a shuffled pattern to spread sentiment types across all dates
  const sentimentPattern = [
    "pos5", "pos4", "pos5", "pos4", "pos4",  // 5 reviews
    "pos5", "pos4", "neu", "neg2", "pos4",   // 5 reviews - includes negative
    "pos4", "pos5", "neu", "pos4", "neg1",   // 5 reviews - includes 1-star
    "pos5", "pos4", "neu", "pos4", "neg2",   // 5 reviews
  ]; // 20 items, repeat 6 times for 120 reviews

  const getTemplateForPattern = (pattern: string) => {
    switch (pattern) {
      case "pos5": return { templates: positiveTemplates, index: 0 };
      case "pos4": return { templates: positiveTemplates, index: 2 };
      case "neu": return { templates: neutralTemplates, index: 0 };
      case "neg2": return { templates: negativeTemplates, index: 0 };
      case "neg1": return { templates: negativeTemplates, index: 1 };
      default: return { templates: positiveTemplates, index: 0 };
    }
  };

  // Generate dates over 6 months
  const startDate = new Date("2025-08-01");
  const endDate = new Date("2026-01-27");
  const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  for (let i = 0; i < 120; i++) {
    const branchId = branchIds[i % 2];
    const source = sources[i % 4];
    const patternIndex = i % sentimentPattern.length;
    const templateInfo = getTemplateForPattern(sentimentPattern[patternIndex]);
    const template = templateInfo.templates[templateInfo.index % templateInfo.templates.length];
    
    // Deterministic date distribution
    const dayOffset = Math.floor((i / 120) * totalDays) + (i % 5);
    const reviewDate = new Date(startDate.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    
    // Select content deterministically
    const titleIndex = i % template.titles.length;
    const contentIndex = i % template.contents.length;
    const authorIndex = i % authorNames.length;
    
    // Determine if responded (70% of reviews get responses, newer ones more likely)
    const responded = i % 10 < 7;
    const responseDate = responded
      ? new Date(reviewDate.getTime() + (1 + (i % 3)) * 24 * 60 * 60 * 1000).toISOString()
      : undefined;

    const review: Review = {
      id: `review-${i + 1}`,
      branchId,
      source,
      rating: template.rating,
      title: template.titles[titleIndex],
      content: template.contents[contentIndex],
      author: authorNames[authorIndex],
      date: reviewDate.toISOString(),
      responded,
      responseDate,
      sentiment: template.sentiment,
      sentimentScore: template.sentimentScore + (i % 10) * 0.05 - 0.25,
    };
    
    reviews.push(review);

    // Create theme mappings
    let themeIndex = 0;
    for (const themeExcerpt of template.themeExcerpts) {
      reviewThemes.push({
        id: `rt-${i + 1}-${themeIndex}`,
        reviewId: review.id,
        themeId: themeExcerpt.themeId,
        sentiment: themeExcerpt.sentiment,
        sentimentScore: themeExcerpt.score + (i % 5) * 0.1 - 0.2,
        excerpt: themeExcerpt.excerpt,
      });
      themeIndex++;
    }

    // Add branch-specific themes for positive reviews
    if (template.sentiment === "positive") {
      const branchExcerpts = branchId === "branch-1" ? branch1Excerpts : branch2Excerpts;
      const excerptIndex = i % branchExcerpts.length;
      reviewThemes.push({
        id: `rt-${i + 1}-${themeIndex}`,
        reviewId: review.id,
        themeId: branchExcerpts[excerptIndex].themeId,
        sentiment: branchExcerpts[excerptIndex].sentiment,
        sentimentScore: branchExcerpts[excerptIndex].score,
        excerpt: branchExcerpts[excerptIndex].excerpt,
      });
    }
  }

  return { reviews, reviewThemes };
}

const generatedData = generateReviews();

export const mockReviews: Review[] = generatedData.reviews;
export const mockReviewThemes: ReviewTheme[] = generatedData.reviewThemes;
