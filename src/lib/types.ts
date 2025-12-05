

import type { Timestamp } from 'firebase/firestore';

// Represents the private user document in /users/{uid}
export type User = {
  uid: string;
  username: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  bio?: string;
  coverPhotoUrl?: string;
  createdAt: Timestamp;
  followers?: string[];
  following?: string[];
  tagline?: string;
  accentColor?: string;
  websiteLink?: string;
  socialLink?: string;
  gender?: 'male' | 'female' | 'other' | 'unspecified';
};

// Represents the public user document in /publicProfiles/{uid}
export type PublicUserProfile = {
  uid: string;
  username: string;
  displayName: string | null;
  displayName_lowercase?: string;
  photoURL: string | null;
  bio?: string;
  coverPhotoUrl?: string;
  followerCount?: number;
  followingCount?: number;
  searchableTerms?: string[];
  tagline?: string;
  accentColor?: string;
  websiteLink?: string;
  socialLink?: string;
  gender?: 'male' | 'female' | 'other' | 'unspecified';
};


export type NutritionalInfo = {
  calories?: number;
  protein?: number;
  totalFat?: number;
  saturatedFat?: number;
  transFat?: number;
  cholesterol?: number;
  sodium?: number;
  totalCarbohydrates?: number;
  dietaryFiber?: number;
  totalSugars?: number;
  addedSugars?: number;
};

export type CostInfo = {
    totalCost: number;
    ingredientCosts: {
        name: string;
        cost: number;
    }[];
};

export type Recipe = {
  title: string;
  description?: string;
  ingredients: string[];
  instructions: string[];
  servingSize: string;
  nutritionalInfo?: NutritionalInfo;
  costInfo?: CostInfo;
  missingIngredientsCount?: number;
  imageUrl?: string;
  keywords?: string[];
  title_lowercase?: string;
  ingredients_lowercase?: string[];
};

export type SavedRecipe = Recipe & {
  id: string;
  savedAt: Timestamp;
}

export type BeverageRecipe = {
  title: string;
  description?: string;
  ingredients: string[];
  instructions: string[];
  glassware: string;
  isAlcoholic: boolean;
  imageUrl?: string;
};

export type SavedBeverage = BeverageRecipe & {
  id: string;
  savedAt: Timestamp;
};

export type IngredientAnalysis = {
    name: string;
    risk: 'Risk-Free' | 'Low Risk' | 'Moderate Risk' | 'Hazardous';
    explanation: string;
};

export type ProductLabelCard = {
    productName: string;
    overallScore: number;
    overallRisk: 'Risk-Free' | 'Low Risk' | 'Moderate Risk' | 'Hazardous';
    nutritionalScore: number;
    ingredientScore: number;
    summary: string;
    ingredients: IngredientAnalysis[];
    imageUrl?: string;
};

export type SavedProductLabel = ProductLabelCard & {
    id: string;
    savedAt: Timestamp;
};


export type Post = {
  id: string;
  authorId: string;
  author: { // Denormalized author data for quick display
    displayName: string | null;
    photoURL: string | null;
    username?: string;
  };
  content: string;
  location?: string;
  mediaURL?: string;
  recipe?: Recipe;
  beverageRecipe?: BeverageRecipe;
  groceryList?: GroceryList;
  productLabel?: ProductLabelCard;
  createdAt: Timestamp;
  likeCount: number;
  commentCount: number;
  isPublic: boolean;
  searchableTerms?: string[];
  tags?: string[];
  externalVideoUrl?: string;
};

export type Comment = {
  id: string;
  postId: string;
  authorId: string;
  author: { // Denormalized author data
    displayName: string | null;
    photoURL: string | null;
    username: string;
  };
  text: string;
  createdAt: Timestamp;
};

export type Like = {
  id: string; // User's UID
  createdAt: Timestamp;
};

export type Conversation = {
    id: string; // The ID of the conversation document (often the peer's UID)
    peerId: string; // The UID of the other user in the conversation
    peerData: {
      displayName: string | null;
      photoURL: string | null;
    };
    lastMessage: string;
    lastUpdatedAt: Timestamp;
};

export type Message = {
  id: string;
  senderId: string;
  text: string;
  createdAt: Timestamp;
  read: boolean;
};

export type Event = {
  id: string;
  title: string;
  description: string;
  createdBy: string;
  startTime: Timestamp;
  endTime: Timestamp;
  location: string;
  participantIds: string[]; // All users involved (creator + invitees)
  attendees: string[]; // Users who have RSVP'd 'yes'
  status: 'scheduled' | 'cancelled';
};

export type DailyMealPlan = {
  breakfast: Recipe | null;
  lunch: Recipe | null;
  dinner: Recipe | null;
}

export type MealPlan = {
    week: {
        [key: string]: DailyMealPlan | null;
    }
}

export type GroceryItem = {
    name: string;
    quantity: string;
    cost?: number;
};

export type GroceryCategory = {
    name: string;
    items: GroceryItem[];
};

export type GroceryList = {
    id: string;
    title: string;
    categories: GroceryCategory[];
    totalCost: number;
    currency: string;
    savedAt: Timestamp;
};

export type SavedGroceryList = GroceryList & {
  id: string;
  savedAt: Timestamp;
};

export type Notification = {
    id: string;
    type: 'like' | 'comment' | 'follow';
    senderId: string;
    sender: { // Denormalized sender data
        displayName: string | null;
        photoURL: string | null;
    };
    recipientId: string;
    postId?: string; // ID of the post that was liked/commented on
    postContent?: string; // A snippet of the post content
    commentText?: string; // A snippet of the comment
    read: boolean;
    createdAt: Timestamp;
};
