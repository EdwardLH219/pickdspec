#!/usr/bin/env python3
"""
Generate test Outscraper JSON files with mixed reviews to trigger recommendations.
"""

import json
import random
import hashlib
import time
from datetime import datetime, timedelta

# Restaurant configurations
RESTAURANTS = [
    {
        "name": "Bella Notte Italian",
        "filename": "test-bella-notte-italian.json",
        "place_id": "ChIJtest_bella_notte_123",
        "city": "Cape Town",
        "address": "123 Long Street, Cape Town, 8001",
        "category": "Italian Restaurant",
        "issues": ["SERVICE"],  # Will have service complaints
        "rating_dist": {"5": 35, "4": 25, "3": 15, "2": 15, "1": 10},
    },
    {
        "name": "Big Mike's Burgers",
        "filename": "test-big-mikes-burgers.json",
        "place_id": "ChIJtest_big_mikes_456",
        "city": "Johannesburg",
        "address": "45 Main Road, Sandton, 2196",
        "category": "Burger Restaurant",
        "issues": ["CLEANLINESS"],
        "rating_dist": {"5": 30, "4": 30, "3": 15, "2": 15, "1": 10},
    },
    {
        "name": "Sakura Sushi House",
        "filename": "test-sakura-sushi-house.json",
        "place_id": "ChIJtest_sakura_789",
        "city": "Durban",
        "address": "78 Beach Road, Umhlanga, 4320",
        "category": "Japanese Restaurant",
        "issues": ["VALUE"],
        "rating_dist": {"5": 25, "4": 25, "3": 20, "2": 20, "1": 10},
    },
    {
        "name": "The Rustic Tavern",
        "filename": "test-rustic-tavern.json",
        "place_id": "ChIJtest_rustic_101",
        "city": "Stellenbosch",
        "address": "12 Dorp Street, Stellenbosch, 7600",
        "category": "Pub",
        "issues": ["AMBIANCE"],
        "rating_dist": {"5": 30, "4": 25, "3": 20, "2": 15, "1": 10},
    },
    {
        "name": "Spice Route Curry House",
        "filename": "test-spice-route-curry.json",
        "place_id": "ChIJtest_spice_202",
        "city": "Pretoria",
        "address": "234 Church Street, Pretoria, 0002",
        "category": "Indian Restaurant",
        "issues": ["SERVICE", "VALUE"],  # Multiple issues
        "rating_dist": {"5": 20, "4": 25, "3": 20, "2": 20, "1": 15},
    },
]

# Review templates by sentiment and theme
POSITIVE_REVIEWS = {
    "FOOD": [
        "The food here is absolutely incredible! Best {dish} I've ever had.",
        "Delicious food, cooked to perfection. The {dish} was outstanding.",
        "Amazing flavors, fresh ingredients. Will definitely come back for the {dish}.",
        "Food quality is top notch. The {dish} melted in my mouth.",
        "Every dish was perfectly seasoned. Loved the {dish}!",
        "The chef clearly knows what they're doing. {dish} was divine.",
        "Fresh, tasty, and beautifully presented. The {dish} was a highlight.",
    ],
    "SERVICE": [
        "Staff were incredibly friendly and attentive throughout our meal.",
        "Excellent service from start to finish. Our waiter was fantastic.",
        "The team here really knows how to make you feel welcome.",
        "Couldn't fault the service - prompt, professional, and friendly.",
        "Staff went above and beyond to accommodate our requests.",
    ],
    "VALUE": [
        "Great value for money! Portions are generous and prices fair.",
        "Worth every cent. You get so much food for the price.",
        "Excellent quality at reasonable prices. Will be back!",
        "Best value restaurant in the area without a doubt.",
    ],
    "AMBIANCE": [
        "Beautiful atmosphere, perfect for a special occasion.",
        "Lovely decor and great vibe. Very comfortable.",
        "The ambiance is wonderful - cozy and welcoming.",
        "Great setting, nice music, overall lovely experience.",
    ],
    "CLEANLINESS": [
        "Spotlessly clean. You can tell they take hygiene seriously.",
        "Immaculate restaurant, tables always clean.",
        "Very hygienic, clean restrooms, well-maintained.",
    ],
}

NEGATIVE_REVIEWS = {
    "FOOD": [
        "Food was cold and bland. Very disappointed with the {dish}.",
        "The {dish} was overcooked and tasteless. Won't be ordering again.",
        "Quality has gone downhill. {dish} was stale and unappetizing.",
        "Portion sizes have shrunk but prices increased. {dish} was mediocre.",
        "Food took forever and arrived lukewarm. The {dish} was a letdown.",
    ],
    "SERVICE": [
        "Service was terrible. Waited 20 minutes just to get menus.",
        "Staff seemed disinterested and rude. Had to ask multiple times for things.",
        "Worst service I've experienced. Our waiter forgot our order twice.",
        "Incredibly slow service, staff were nowhere to be found.",
        "Staff attitude was poor. Felt like we were bothering them.",
        "Had to wait forever to get the bill. Staff ignoring us.",
        "Service has really deteriorated. Used to be so much better.",
    ],
    "VALUE": [
        "Way overpriced for what you get. Not worth the money at all.",
        "Prices have gone up significantly but portions have shrunk.",
        "Terrible value. Much better options elsewhere for the same price.",
        "Feel completely ripped off. Small portions, big prices.",
        "Used to be good value but now it's just expensive and mediocre.",
        "Highway robbery. The bill was shocking for what we received.",
    ],
    "AMBIANCE": [
        "Too noisy, couldn't hear each other talk. Music was way too loud.",
        "Place is looking tired and run down. Needs a renovation.",
        "Uncomfortable seating and poor lighting. Not a pleasant atmosphere.",
        "Way too crowded and chaotic. Tables crammed together.",
        "Cold and drafty. The atmosphere was really unpleasant.",
        "Decor is outdated and the place smells musty.",
    ],
    "CLEANLINESS": [
        "Tables were sticky and floor was dirty. Hygiene is a concern.",
        "Restrooms were filthy. Lost my appetite after visiting.",
        "Saw a cockroach near our table. Absolutely disgusting.",
        "Cutlery had food residue on it. Very unhygienic.",
        "Place needs a deep clean. Dust everywhere.",
        "Glasses had lipstick marks. Clearly not washed properly.",
    ],
}

NEUTRAL_REVIEWS = [
    "It was okay. Nothing special but not bad either.",
    "Average experience overall. Food was decent.",
    "Not the best, not the worst. Probably won't rush back.",
    "Mixed feelings. Some things were good, others not so much.",
    "Middle of the road. Expected more based on reviews.",
    "It was fine. Just an ordinary meal out.",
    "Unremarkable experience. Neither impressed nor disappointed.",
]

DISHES = {
    "Italian Restaurant": ["pasta carbonara", "margherita pizza", "lasagna", "risotto", "tiramisu", "gnocchi"],
    "Burger Restaurant": ["classic burger", "bacon cheeseburger", "mushroom burger", "loaded fries", "milkshake"],
    "Japanese Restaurant": ["salmon sashimi", "dragon roll", "miso ramen", "teriyaki chicken", "tempura"],
    "Pub": ["fish and chips", "burger", "ribs", "wings", "nachos", "steak"],
    "Indian Restaurant": ["butter chicken", "lamb curry", "biryani", "tikka masala", "naan bread", "samosas"],
}

AUTHOR_NAMES = [
    "John", "Sarah", "Mike", "Emma", "David", "Lisa", "James", "Anna", "Chris", "Kate",
    "Tom", "Jessica", "Daniel", "Sophie", "Andrew", "Rachel", "Mark", "Emily", "Paul", "Amy",
    "Steven", "Lauren", "Kevin", "Michelle", "Brian", "Nicole", "Robert", "Ashley", "William", "Megan",
    "Richard", "Stephanie", "Matthew", "Jennifer", "Jason", "Amanda", "Timothy", "Heather", "Joseph", "Brittany",
    "Thabo", "Nomsa", "Sipho", "Zanele", "Kagiso", "Lerato", "Bongani", "Naledi", "Tshepo", "Palesa",
    "Pieter", "Annemarie", "Johan", "Liesl", "Willem", "Marietjie", "Francois", "Elmarie", "Hendrik", "Rina",
]


def generate_review_id():
    """Generate a realistic-looking review ID."""
    chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    return "Ci9DQUF" + "".join(random.choices(chars, k=50))


def generate_author_id():
    """Generate a numeric author ID."""
    return str(random.randint(100000000000000000, 999999999999999999))


def generate_timestamp(days_back_max=365):
    """Generate a timestamp within the last year."""
    days_back = random.randint(1, days_back_max)
    dt = datetime.now() - timedelta(days=days_back, hours=random.randint(0, 23), minutes=random.randint(0, 59))
    return int(dt.timestamp())


def generate_review(rating, restaurant, issues):
    """Generate a single review with appropriate content for the rating."""
    dishes = DISHES.get(restaurant["category"], ["signature dish"])
    dish = random.choice(dishes)
    
    # Determine what kind of review to generate
    if rating >= 4:
        # Positive review - pick random positive themes
        themes = random.sample(list(POSITIVE_REVIEWS.keys()), k=random.randint(1, 3))
        parts = []
        for theme in themes:
            template = random.choice(POSITIVE_REVIEWS[theme])
            parts.append(template.format(dish=dish))
        text = " ".join(parts)
        food_score = str(random.choice([4, 5]))
        service_score = str(random.choice([4, 5]))
        atmosphere_score = str(random.choice([4, 5]))
    elif rating <= 2:
        # Negative review - focus on the restaurant's issues
        if issues and random.random() < 0.7:  # 70% chance to complain about the issue
            theme = random.choice(issues)
            text = random.choice(NEGATIVE_REVIEWS.get(theme, NEGATIVE_REVIEWS["SERVICE"])).format(dish=dish)
            # Maybe add another complaint
            if random.random() < 0.4:
                other_theme = random.choice(list(NEGATIVE_REVIEWS.keys()))
                text += " " + random.choice(NEGATIVE_REVIEWS[other_theme]).format(dish=dish)
        else:
            # Random negative themes
            themes = random.sample(list(NEGATIVE_REVIEWS.keys()), k=random.randint(1, 2))
            parts = [random.choice(NEGATIVE_REVIEWS[t]).format(dish=dish) for t in themes]
            text = " ".join(parts)
        food_score = str(random.choice([1, 2, 3]))
        service_score = str(random.choice([1, 2, 3]))
        atmosphere_score = str(random.choice([1, 2, 3]))
    else:
        # Neutral review (3 stars)
        text = random.choice(NEUTRAL_REVIEWS)
        if random.random() < 0.5:
            # Add some specifics
            if issues and random.random() < 0.5:
                theme = random.choice(issues)
                text += " " + random.choice(NEGATIVE_REVIEWS.get(theme, NEGATIVE_REVIEWS["SERVICE"])).format(dish=dish)
            else:
                text += f" The {dish} was decent."
        food_score = str(random.choice([3, 4]))
        service_score = str(random.choice([2, 3, 4]))
        atmosphere_score = str(random.choice([3, 4]))
    
    author_name = random.choice(AUTHOR_NAMES)
    timestamp = generate_timestamp()
    
    # Maybe add owner response for negative reviews
    owner_answer = None
    owner_answer_timestamp = None
    if rating <= 2 and random.random() < 0.3:
        owner_answer = f"Thank you for your feedback, {author_name}. We're sorry to hear about your experience and are working to improve."
        owner_answer_timestamp = timestamp + random.randint(86400, 604800)  # 1-7 days later
    
    return {
        "google_id": restaurant["place_id"],
        "review_id": generate_review_id(),
        "review_pagination_id": generate_review_id(),
        "author_link": f"https://www.google.com/maps/contrib/{generate_author_id()}?hl=en",
        "author_title": author_name,
        "author_id": generate_author_id(),
        "author_image": f"https://lh3.googleusercontent.com/a-/ALV-{generate_review_id()[:20]}=s120-c-rp-mo-ba4-br100",
        "author_reviews_count": random.randint(1, 200),
        "author_ratings_count": random.randint(0, 50),
        "review_text": text,
        "review_img_urls": None,
        "review_img_url": None,
        "review_questions": {
            "Price per person": random.choice(["R 100–200", "R 200–300", "R 300–400", "R 400–500"]),
            "Food": food_score,
            "Service": service_score,
            "Atmosphere": atmosphere_score,
            "Noise level": random.choice(["Quiet", "Moderate noise", "Lively"]),
            "Special events": "No special event",
            "Wait time": random.choice(["No wait", "0–10 min", "10–20 min", "20–30 min", "More than 30 min"]),
        },
        "review_photo_ids": None,
        "owner_answer": owner_answer,
        "owner_answer_timestamp": owner_answer_timestamp,
        "owner_answer_timestamp_datetime_utc": None,
        "review_link": f"https://www.google.com/maps/reviews/data=!4m8!14m7!1m6!2m5!1s{generate_review_id()[:30]}",
        "review_rating": rating,
        "review_timestamp": timestamp,
        "review_datetime_utc": datetime.fromtimestamp(timestamp).strftime("%m/%d/%Y %H:%M:%S"),
        "review_likes": random.choice([None, 0, 1, 2, 3]) if rating >= 4 else None,
        "reviews_id": str(random.randint(-9999999999999999999, 9999999999999999999)),
    }


def generate_restaurant_data(restaurant, num_reviews=500):
    """Generate complete restaurant data with reviews."""
    # Generate ratings based on distribution
    ratings = []
    for rating, percentage in restaurant["rating_dist"].items():
        count = int(num_reviews * percentage / 100)
        ratings.extend([int(rating)] * count)
    
    # Fill any remaining
    while len(ratings) < num_reviews:
        ratings.append(random.randint(1, 5))
    
    random.shuffle(ratings)
    
    # Generate reviews
    reviews = []
    for rating in ratings:
        review = generate_review(rating, restaurant, restaurant["issues"])
        reviews.append(review)
    
    # Calculate average rating
    avg_rating = sum(ratings) / len(ratings)
    
    # Build place data
    place_data = {
        "query": restaurant["name"],
        "name": restaurant["name"],
        "name_for_emails": restaurant["name"].lower().replace(" ", ""),
        "place_id": restaurant["place_id"],
        "google_id": restaurant["place_id"],
        "kgmid": f"/g/test_{restaurant['place_id'][-10:]}",
        "full_address": restaurant["address"],
        "borough": None,
        "street": restaurant["address"].split(",")[0],
        "postal_code": restaurant["address"].split(",")[-1].strip().split()[-1],
        "area_service": None,
        "country_code": "ZA",
        "country": "South Africa",
        "city": restaurant["city"],
        "us_state": None,
        "state": None,
        "plus_code": None,
        "latitude": round(-33.9 + random.random() * 0.2, 6),
        "longitude": round(18.4 + random.random() * 0.2, 6),
        "h3": None,
        "time_zone": "Africa/Johannesburg",
        "site": f"https://www.{restaurant['name'].lower().replace(' ', '')}.co.za",
        "phone": f"+27 {random.randint(10, 99)} {random.randint(100, 999)} {random.randint(1000, 9999)}",
        "type": restaurant["category"],
        "category": restaurant["category"],
        "subtypes": restaurant["category"],
        "rating": round(avg_rating, 1),
        "reviews": num_reviews,
        "reviews_data": reviews,
    }
    
    return place_data


def main():
    print("Generating test restaurant data...")
    
    for restaurant in RESTAURANTS:
        print(f"  Creating {restaurant['name']} ({restaurant['filename']})...")
        data = generate_restaurant_data(restaurant, num_reviews=500)
        
        filepath = f"/Users/edward/Code/PickdSpec/demo-data/outscraper/{restaurant['filename']}"
        with open(filepath, "w") as f:
            json.dump(data, f, indent=2)
        
        # Print summary
        reviews = data["reviews_data"]
        ratings = [r["review_rating"] for r in reviews]
        print(f"    - {len(reviews)} reviews, avg rating: {sum(ratings)/len(ratings):.2f}")
        print(f"    - Issues targeted: {restaurant['issues']}")
    
    print("\nDone! Created 5 test restaurant files.")


if __name__ == "__main__":
    main()
