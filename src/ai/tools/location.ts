'use server';
/**
 * @fileOverview Location-based tools for the AI agent.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

export const getUserLocation = ai.defineTool(
  {
    name: 'getUserLocation',
    description: 'Gets the user\'s current geographical location to provide context-aware recipe suggestions.',
    inputSchema: z.object({}),
    outputSchema: z.string(),
  },
  async () => {
    // In a real application, this could be implemented using a browser's geolocation API
    // or by looking up the user's IP address. For this demo, we'll return a default.
    return "Northern California, USA";
  }
);

export const getNearbyStores = ai.defineTool(
  {
    name: 'getNearbyStores',
    description: 'Finds types of grocery stores near the user to understand ingredient availability.',
    inputSchema: z.object({}),
    outputSchema: z.array(z.string()),
  },
  async () => {
    // This would ideally use a location and a maps API.
    // We will return a simulated list for now.
    return ["Safeway", "Trader Joe's", "Whole Foods", "Local Farmers Market"];
  }
);
