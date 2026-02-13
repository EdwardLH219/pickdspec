/**
 * Activation Templates
 * 
 * Theme-specific templates for generating marketing activation content.
 */

import type { ThemeCategory } from '@prisma/client';
import type { ThemeTemplateConfig, OfferSuggestion } from './types';

// Theme-specific configuration for content generation
export const THEME_TEMPLATES: Record<ThemeCategory, ThemeTemplateConfig> = {
  PRODUCT: {
    aspect: 'food quality and menu',
    positiveAdjectives: ['delicious', 'fresh', 'flavorful', 'exceptional', 'mouthwatering'],
    improvements: ['elevated', 'refined', 'enhanced', 'upgraded', 'perfected'],
    callToActions: [
      'Come taste the difference!',
      'Experience our improved menu today.',
      'Your taste buds will thank you!',
      'Book your table and discover our new flavors.',
    ],
    hashtags: ['#FreshFood', '#FoodieFinds', '#TasteTheDifference', '#QualityMatters', '#ChefSpecial'],
    offerSuggestions: [
      {
        title: 'Taste Test Tuesday',
        description: 'Complimentary tasting portion of our signature dish with any main order',
        type: 'special',
        relevanceThreshold: 0.2,
      },
      {
        title: 'New Menu Launch Special',
        description: '15% off any new menu item this week',
        type: 'discount',
        relevanceThreshold: 0.3,
      },
      {
        title: 'Chef\'s Choice Bundle',
        description: 'Starter + Main + Dessert at a special price',
        type: 'bundle',
        relevanceThreshold: 0.25,
      },
    ],
  },

  SERVICE: {
    aspect: 'customer service',
    positiveAdjectives: ['friendly', 'attentive', 'professional', 'warm', 'exceptional'],
    improvements: ['enhanced', 'elevated', 'improved', 'transformed', 'refined'],
    callToActions: [
      'Experience our improved service firsthand!',
      'Let us show you hospitality at its finest.',
      'Visit us and feel the difference.',
      'Your satisfaction is our priority – come see!',
    ],
    hashtags: ['#CustomerFirst', '#ServiceExcellence', '#Hospitality', '#WeCare', '#FiveStarService'],
    offerSuggestions: [
      {
        title: 'VIP Treatment',
        description: 'Complimentary welcome drink for all guests this weekend',
        type: 'special',
        relevanceThreshold: 0.2,
      },
      {
        title: 'Loyalty Appreciation',
        description: 'Double loyalty points for returning customers',
        type: 'loyalty',
        relevanceThreshold: 0.25,
      },
    ],
  },

  VALUE: {
    aspect: 'value for money',
    positiveAdjectives: ['excellent', 'unbeatable', 'great', 'fantastic', 'amazing'],
    improvements: ['improved', 'enhanced', 'optimized', 'refined', 'upgraded'],
    callToActions: [
      'Great taste, great value – visit us today!',
      'Quality doesn\'t have to break the bank.',
      'Experience premium without the premium price.',
      'Treat yourself – you deserve it!',
    ],
    hashtags: ['#ValueForMoney', '#AffordableLuxury', '#SmartDining', '#GreatDeals', '#BudgetFriendly'],
    offerSuggestions: [
      {
        title: 'Lunch Special',
        description: '2-course lunch menu at R99 (Mon-Fri)',
        type: 'bundle',
        relevanceThreshold: 0.15,
      },
      {
        title: 'Early Bird Discount',
        description: '20% off for tables seated before 6pm',
        type: 'discount',
        relevanceThreshold: 0.2,
      },
      {
        title: 'Kids Eat Free',
        description: 'One free kids meal per adult main on Sundays',
        type: 'special',
        relevanceThreshold: 0.25,
      },
    ],
  },

  AMBIANCE: {
    aspect: 'atmosphere and ambiance',
    positiveAdjectives: ['cozy', 'inviting', 'vibrant', 'relaxing', 'charming'],
    improvements: ['transformed', 'refreshed', 'elevated', 'enhanced', 'revitalized'],
    callToActions: [
      'Come experience our refreshed space!',
      'The perfect spot for your next gathering.',
      'Discover our new vibe – book now!',
      'A dining experience you won\'t forget.',
    ],
    hashtags: ['#VibeCheck', '#CozySpots', '#DiningExperience', '#Ambiance', '#RestaurantVibes'],
    offerSuggestions: [
      {
        title: 'Date Night Package',
        description: 'Romantic 3-course dinner for two with complimentary bubbly',
        type: 'bundle',
        relevanceThreshold: 0.2,
      },
      {
        title: 'Group Gathering',
        description: '10% off for parties of 6 or more',
        type: 'discount',
        relevanceThreshold: 0.25,
      },
    ],
  },

  CLEANLINESS: {
    aspect: 'cleanliness and hygiene',
    positiveAdjectives: ['spotless', 'pristine', 'immaculate', 'sparkling', 'impeccable'],
    improvements: ['elevated', 'enhanced', 'upgraded', 'improved', 'reinforced'],
    callToActions: [
      'Dine with confidence in our spotless space.',
      'Your health and comfort matter to us.',
      'Experience cleanliness you can trust.',
      'We\'ve raised the bar – come see for yourself!',
    ],
    hashtags: ['#CleanDining', '#HygieneFirst', '#SafeToEat', '#SpotlessSpace', '#CleanAndFresh'],
    offerSuggestions: [
      {
        title: 'Fresh Start Special',
        description: 'Complimentary sanitizer and wipes at every table',
        type: 'special',
        relevanceThreshold: 0.15,
      },
    ],
  },

  LOCATION: {
    aspect: 'location and accessibility',
    positiveAdjectives: ['convenient', 'accessible', 'central', 'easy-to-find', 'well-located'],
    improvements: ['improved', 'enhanced', 'upgraded', 'expanded', 'optimized'],
    callToActions: [
      'Finding us has never been easier!',
      'Conveniently located for your dining pleasure.',
      'Pop in – we\'re right around the corner!',
      'Easy to reach, hard to forget.',
    ],
    hashtags: ['#LocalEats', '#ConvenientDining', '#EasyAccess', '#NearYou', '#LocalFavorite'],
    offerSuggestions: [
      {
        title: 'Free Parking',
        description: 'Complimentary validated parking for all diners',
        type: 'special',
        relevanceThreshold: 0.2,
      },
      {
        title: 'Delivery Launch',
        description: 'Free delivery on first order over R150',
        type: 'discount',
        relevanceThreshold: 0.3,
      },
    ],
  },

  OTHER: {
    aspect: 'overall experience',
    positiveAdjectives: ['excellent', 'wonderful', 'fantastic', 'amazing', 'outstanding'],
    improvements: ['enhanced', 'improved', 'elevated', 'upgraded', 'refined'],
    callToActions: [
      'Come experience the difference!',
      'We\'ve been listening – visit us today.',
      'Better than ever – book your table!',
      'Your feedback made us better.',
    ],
    hashtags: ['#DiningOut', '#RestaurantLife', '#FoodLovers', '#EatLocal', '#SupportLocal'],
    offerSuggestions: [
      {
        title: 'Thank You Special',
        description: '10% off your next visit as our thank you',
        type: 'discount',
        relevanceThreshold: 0.2,
      },
    ],
  },
};

// GBP Post templates
export const GBP_POST_TEMPLATES = [
  `🌟 Exciting news from {tenantName}! 🌟

We've {improvement} our {aspect}, and our guests are loving it! 

{callToAction}

{hashtags}`,

  `Great things are happening at {tenantName}! ✨

Thanks to your valuable feedback, we've made meaningful improvements to our {aspect}. 

Come taste the results – we can't wait to welcome you!

{hashtags}`,

  `{tenantName} Update 📣

We're proud to share that we've been working hard on our {aspect}, and the results speak for themselves.

{callToAction}

{hashtags}`,
];

// Review prompt templates
export const REVIEW_PROMPT_TEMPLATES = [
  `Hi! Thank you for dining with us at {tenantName}. 

We've recently made improvements to our {aspect}, and we'd love to hear what you think! 

If you enjoyed your experience, would you mind leaving us a review? Your feedback helps us continue to improve.

[Review Link]`,

  `Thanks for visiting {tenantName}! 🙏

We've been working on enhancing our {aspect} based on guest feedback. Did you notice the difference?

We'd really appreciate if you could share your experience in a quick review. It means the world to us!

[Review Link]`,

  `Hello from {tenantName}!

We hope you had a {positiveAdjective} experience with us. We've recently focused on improving our {aspect}, and your opinion matters to us.

Would you take a moment to share your thoughts? Your review helps other food lovers discover us!

[Review Link]`,
];

// Offer suggestion templates
export const OFFER_TEMPLATES = {
  discount: `💰 {title}

{description}

Valid this week only. Show this post or mention it when booking!

T&Cs apply. Not valid with other offers.`,

  bundle: `🎁 {title}

{description}

Perfect for sharing with friends and family!

Book now to secure your spot.`,

  loyalty: `⭐ {title}

{description}

Thank you for being part of our family. Your loyalty means everything!

Ask about our loyalty program for more rewards.`,

  special: `🎉 {title}

{description}

Limited time offer – don't miss out!

Call or book online to reserve.`,
};

// Helper to pick random item from array
export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Helper to generate hashtag string
export function formatHashtags(tags: string[]): string {
  return tags.slice(0, 5).join(' ');
}
