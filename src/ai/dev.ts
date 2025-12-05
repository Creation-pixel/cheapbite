'use server';
import { config } from 'dotenv';
config();

import '@/ai/flows/recipe-generator';
import '@/ai/flows/identify-from-image';
import '@/ai/flows/generate-for-meal';
import '@/ai/flows/tts';
import '@/ai/tools/location';
import '@/ai/flows/generate-food-image';
import '@/ai/flows/beverage-generator';
import '@/ai/flows/identify-beverage-from-image';
import '@/ai/flows/generate-beverage-image';
import '@/ai/flows/grocery-list-processor';
import '@/ai/flows/product-label-analyzer';
import '@/aikys/generate-product-image';
import '@/ai/flows/analyze-post-image';
