
'use server';

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { type Recipe, type GroceryList } from './types';

// Function to initialize Firebase Admin SDK
function initializeFirebaseAdmin() {
  if (getApps().length === 0) {
    // In a deployed App Hosting environment, applicationDefault() will find the credentials.
    // In local development, it requires the GOOGLE_APPLICATION_CREDENTIALS env var.
    initializeApp();
  }
}

// Ensure Firebase Admin is initialized before it's used
initializeFirebaseAdmin();

const firestore = getFirestore();
const storage = getStorage();

const generateKeywords = (text: string): string[] => {
    if (!text) return [];
    const words = text.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    return [...new Set(words)];
};

export async function createPostWithImage(formData: FormData) {
  try {
    const authorId = formData.get('authorId') as string;
    if (!authorId) {
      throw new Error('User is not authenticated.');
    }

    // Fetch author's public profile for denormalization
    const authorSnap = await firestore.collection('publicProfiles').doc(authorId).get();
    if (!authorSnap.exists) {
      throw new Error('Author profile not found.');
    }
    const authorData = authorSnap.data();

    const postData: any = {
      authorId: authorId,
      author: {
        displayName: authorData?.displayName || 'Anonymous',
        photoURL: authorData?.photoURL || null,
        username: authorData?.username || '',
      },
      content: formData.get('content') as string,
      createdAt: new Date(),
      likeCount: 0,
      commentCount: 0,
      isPublic: true,
    };
    
    // Handle optional text fields
    const location = formData.get('location');
    if (location) postData.location = location as string;

    const externalVideoUrl = formData.get('externalVideoUrl');
    if (externalVideoUrl) postData.externalVideoUrl = externalVideoUrl as string;
    
    const tags = formData.get('tags');
    if (tags) {
        postData.tags = (tags as string).split(',').map(tag => tag.trim().toLowerCase()).filter(Boolean);
    }

    // Handle JSON attachments
    const recipeString = formData.get('recipe');
    if (recipeString) {
        const recipe: Recipe = JSON.parse(recipeString as string);
        postData.recipe = { ...recipe, id: undefined, savedAt: undefined };
    }
    const groceryListString = formData.get('groceryList');
    if (groceryListString) {
        const groceryList: GroceryList = JSON.parse(groceryListString as string);
        postData.groceryList = { ...groceryList, id: undefined, savedAt: undefined };
    }

    // Handle image upload
    const imageFile = formData.get('image') as File | null;
    if (imageFile) {
      const buffer = Buffer.from(await imageFile.arrayBuffer());
      const fileName = `${authorId}/${Date.now()}-${imageFile.name}`;
      const file = storage.bucket().file(`posts/${fileName}`);
      
      await file.save(buffer, {
        metadata: { contentType: imageFile.type },
      });
      // Make the file publicly accessible.
      await file.makePublic();
      
      postData.mediaURL = file.publicUrl();
    }
    
    // Generate searchable terms
    let postSearchableTerms: string[] = [
        ...generateKeywords(postData.content), 
        ...(postData.tags || [])
    ];
    if (postData.recipe) {
        const recipeKeywords = generateKeywords(postData.recipe.title);
        const ingredientKeywords = postData.recipe.ingredients.flatMap((ing: string) => generateKeywords(ing));
        postSearchableTerms.push(...recipeKeywords, ...ingredientKeywords);
    }
    postData.searchableTerms = [...new Set(postSearchableTerms)];


    // Save post to Firestore
    await firestore.collection('posts').add(postData);

    return { success: true };
  } catch (error: any) {
    console.error('Error creating post:', error);
    // Log the full error on the server for better debugging
    console.error(error.stack);
    return { success: false, error: error.message || 'Failed to create post.' };
  }
}
