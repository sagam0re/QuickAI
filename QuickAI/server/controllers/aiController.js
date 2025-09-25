import OpenAI from "openai";
import sql from "../configs/db.js";
import { clerkClient } from "@clerk/express";
import crypto from "crypto";
import {v2 as cloudinary} from 'cloudinary';

const AI = new OpenAI({
    apiKey: process.env.GEMINI_API_KEY,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
});

export const generateArticle = async (req, res) => {
    try {
        const {userId} = req.auth;
        const {prompt, length} = req.body;
        const plan = req.plan;
        const free_usage = req.free_usage;

        if(plan !== 'premium' && free_usage >= 10) {
            return res.json({success: false, error: 'Free usage limit exceeded. Please upgrade to premium plan.'});
        }

        const response = await AI.chat.completions.create({
            model: "gemini-2.0-flash",
            messages: [
                {
                    role: "user",
                    content: prompt
                }
            ],
            max_tokens: length,
            temperature: 0.7,
        });

        const content = response.choices[0].message.content;

        await sql`INSERT INTO creations 
        (user_id, prompt, content, type) 
        VALUES (${userId}, ${prompt}, ${content}, 'article')`;

        if(plan !== 'premium') {
            await clerkClient.users.updateUser(userId, {
                privateMetadata: { free_usage: free_usage + 1 }
            });
        }

        res.json({success: true, content});

    } catch (error) {
        console.error(error.message);
        res.json({ success: false, error: error.message });
    }
}

export const generateBlogTitle = async (req, res) => {
    try {
        const { userId } = req.auth;
        const { prompt } = req.body;
        const plan = req.plan;
        const free_usage = req.free_usage;

        if(plan !== 'premium' && free_usage >= 10) {
            return res.json({success: false, error: 'Free usage limit exceeded. Please upgrade to premium plan.'});
        }

        const response = await AI.chat.completions.create({
            model: "gemini-2.0-flash",
            messages: [
                {
                    role: "user",
                    content: prompt
                }
            ],
            max_tokens: 100,
            temperature: 0.7,
        });

        const content = response.choices[0].message.content;

        await sql`INSERT INTO creations 
        (user_id, prompt, content, type) 
        VALUES (${userId}, ${prompt}, ${content}, 'blog_title')`;

        if(plan !== 'premium') {
            await clerkClient.users.updateUser(userId, {
                privateMetadata: { free_usage: free_usage + 1 }
            });
        }

        res.json({success: true, content});

    } catch (error) {
        console.error(error.message);
        res.json({ success: false, error: error.message });
    }
}

// export const generateImage = async (req, res) => {
//     try {
//         const { userId } = req.auth;
//         const { prompt, publish } = req.body;
//         const plan = req.plan;

//         if(plan !== 'premium') {
//             return res.json({success: false, error: 'Image generation is available for premium users only.'});
//         }

//         const formDate = new FormData();
//         formDate.append('prompt', prompt);

//         const {data} = await axios.post('https://clipdrop-api.co/text-to-image/v1', formDate, {
//             headers: {
//                 'x-api-key': process.env.CLIPDROP_API_KEY,
//             },
//             responseType: 'arraybuffer'
//         })

//         const base64Image = `data:image/png;base64,${Buffer.from(data, 'binary').toString('base64')}`;

//         const {secure_url} = await cloudinary.uploader.upload(base64Image);

//         await sql`INSERT INTO creations 
//         (user_id, prompt, content, type, publish) 
//         VALUES (${userId}, ${prompt}, ${secure_url}, 'image', ${publish ?? false})`;

//         res.json({success: true, content: secure_url});

//     } catch (error) {
//         console.error(error.message);
//         res.json({ success: false, error: error.message });
//     }
// }

export const generateImage = async (req, res) => {
    try {
        const { userId } = req.auth;
        const { prompt, publish } = req.body;
        const plan = req.plan;

        if(plan !== 'premium') {
            return res.json({success: false, error: 'Image generation is available for premium users only.'});
        }

        const width  = 1024;
        const height = 1024;
        const seed   = 24078;
        const model  = "flux";  // "flux", "sdxl", "nanobanana",etc.
        const folder = "pollinations";

        // Build Pollinations URL (Cloudinary will fetch it)
        const pollinationsUrl = buildPollinationsUrl({ prompt, width, height, seed, model });

        // Stable public_id so same prompt+params map to same Cloudinary asset
        const signature = promptHash(JSON.stringify({ prompt, width, height, seed, model }));
        const public_id = `${folder}/${signature}`;

        // Upload by URL (no buffering on your server)
        const uploadResult = await cloudinary.uploader.upload(pollinationsUrl, {
        public_id,
        folder,                 // keeps it neatly organized
        overwrite: false,       // don’t replace if already uploaded
        resource_type: "image", // explicit
        unique_filename: false, // we’re controlling the public_id
        use_filename: false,
        context: { prompt }     // optional: attach prompt as metadata
        });     

        await sql`INSERT INTO creations 
                (user_id, prompt, content, type, publish) 
                VALUES (${userId}, ${prompt}, ${uploadResult.secure_url}, 'image', ${publish ?? false})`;

                res.json({success: true, content: uploadResult.secure_url});
    } catch (error) {
        console.error(error.message);
        res.json({ success: false, error: error.message });
    }
}

export const removeImageBackground = async (req, res) => {
    try {
        const { userId } = req.auth;
        const { prompt, publish } = req.body;
        const plan = req.plan;

        if(plan !== 'premium') {
            return res.json({success: false, error: 'Image generation is available for premium users only.'});
        }

        const width  = 1024;
        const height = 1024;
        const seed   = 24078;
        const model  = "flux";  // "flux", "sdxl", "nanobanana",etc.
        const folder = "pollinations";

        // Build Pollinations URL (Cloudinary will fetch it)
        const pollinationsUrl = buildPollinationsUrl({ prompt, width, height, seed, model });

        // Stable public_id so same prompt+params map to same Cloudinary asset
        const signature = promptHash(JSON.stringify({ prompt, width, height, seed, model }));
        const public_id = `${folder}/${signature}`;

        // Upload by URL (no buffering on your server)
        const uploadResult = await cloudinary.uploader.upload(pollinationsUrl, {
        public_id,
        folder,                 // keeps it neatly organized
        overwrite: false,       // don’t replace if already uploaded
        resource_type: "image", // explicit
        unique_filename: false, // we’re controlling the public_id
        use_filename: false,
        context: { prompt }     // optional: attach prompt as metadata
        });     

        await sql`INSERT INTO creations 
                (user_id, prompt, content, type, publish) 
                VALUES (${userId}, ${prompt}, ${uploadResult.secure_url}, 'image', ${publish ?? false})`;

                res.json({success: true, content: uploadResult.secure_url});
    } catch (error) {
        console.error(error.message);
        res.json({ success: false, error: error.message });
    }
}



// helpers for Pollinations + Cloudinary

function buildPollinationsUrl({ prompt, width, height, seed, model }) {
  const base = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`;
  const url = new URL(base);
  if (width)  url.searchParams.set("width",  String(width));
  if (height) url.searchParams.set("height", String(height));
  if (seed)   url.searchParams.set("seed",   String(seed));
  if (model)  url.searchParams.set("model",  String(model)); // e.g. "flux", "sdxl" (varies)
  return url.toString();
}

function promptHash(input) {
  return crypto.createHash("sha256").update(input).digest("hex").slice(0, 24);
}