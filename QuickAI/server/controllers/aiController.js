import OpenAI from "openai";
import sql from "../configs/db.js";
import { clerkClient } from "@clerk/express";
import crypto from "crypto";
import {v2 as cloudinary} from 'cloudinary';
import fs from 'fs';
import pdf from 'pdf-parse/lib/pdf-parse.js';

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
        const folder = "generated";

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
        const { prompt } = req.query;
        const file = req.file;
        const plan = req.plan;

        if(plan !== 'premium') {
            return res.json({success: false, error: 'Image generation is available for premium users only.'});
        }
         if (!file?.path) {
           return res.json({ success: false, error: 'No file uploaded.' });
        }

        const width  = 1024;
        const height = 1024;

        const folder = "bg_transformation";

        // Stable public_id so same prompt+params map to same Cloudinary asset
        const signature = promptHash(JSON.stringify({ action: 'gen_background_replace', prompt, width, height }));
        const public_id = `${folder}/${signature}`;   

        // Cloudinary expects prompt text in the effect qualifier; URL-encode it
        const promptQualifier = (prompt && String(prompt).trim().length)
                ? `gen_background_replace:prompt_${encodeURIComponent(String(prompt).trim())}`
                : 'gen_background_replace';

        const uploadResult = await cloudinary.uploader.upload(file.path, {
        public_id,
        folder,
        overwrite: true,
        resource_type: 'image',
        unique_filename: false,
        use_filename: false,

        // Generate background from the prompt, then normalize output
        eager: [
            { effect: promptQualifier },
            { width, height, crop: 'fill', gravity: 'auto' },
            { fetch_format: 'auto', quality: 'auto' }
        ],
        eager_async: false,          // wait until the derived image is ready
        context: prompt ? { prompt } : undefined
        });

        // Prefer the eager result URL (the transformed asset we just generated)
        const outUrl =
        uploadResult?.eager?.[0]?.secure_url ||
        uploadResult?.secure_url;  

                await sql`INSERT INTO creations 
                        (user_id, prompt, content, type) 
                        VALUES (${userId}, ${prompt}, ${outUrl}, 'image')`;

                res.json({success: true, content: outUrl, public_id: uploadResult.public_id });
    } catch (error) {
        console.error(error.message);
        res.json({ success: false, error: error.message, stack: error.stack } );
    }
}


export const removeImageObject = async (req, res) => {
    try {
        const { userId } = req.auth;
        const { object } = req.query;
        const file = req.file;
        const plan = req.plan;

        if(plan !== 'premium') {
            return res.json({success: false, error: 'Image generation is available for premium users only.'});
        }
         if (!file?.path) {
           return res.json({ success: false, error: 'No file uploaded.' });
        }

        const width  = 1024;
        const height = 1024;

        const folder = "bg_transformation";

        // Stable public_id so same prompt+params map to same Cloudinary asset
        const signature = promptHash(JSON.stringify({ action: 'gen_background_replace', object, width, height }));
        const public_id = `${folder}/${signature}`;   


        const uploadResult = await cloudinary.uploader.upload(file.path, {
        public_id,
        folder,
        overwrite: true,
        resource_type: 'image',
        unique_filename: false,
        use_filename: false,
        });

        const imageUrl = cloudinary.url(uploadResult.public_id, {
            secure: true,
            transformation: [
                { effect: `gen_remove:${object}` },
            ],
            resource_type: 'image',
        });

                await sql`INSERT INTO creations 
                        (user_id, prompt, content, type) 
                        VALUES (${userId}, ${`Removed ${object} from the image`}, ${imageUrl}, 'image')`;

                res.json({success: true, content: imageUrl, public_id: uploadResult.public_id });
    } catch (error) {
        console.error(error.message);
        res.json({ success: false, error: error.message, stack: error.stack } );
    }
}


export const resumeReview = async (req, res) => {
    try {
        const { userId } = req.auth;
        const resume = req.file;
        const plan = req.plan;

        if(plan !== 'premium') {
            return res.json({success: false, error: 'Image generation is available for premium users only.'});
        }
         if (!resume?.path) {
           return res.json({ success: false, error: 'No resume file uploaded.' });
        }

        if (resume.size > 5*1024*1024) { // 5MB limit
            return res.json({ success: false, error: 'File size exceeds 5MB limit.' });
        }

        const dataBuffer = fs.readFileSync(resume.path);
        const pdfData = await pdf(dataBuffer);
        const prompt = `Review my resume and suggest improvements:\n\n${pdfData.text}`;

        const response = await AI.chat.completions.create({
            model: "gemini-2.0-flash",
            messages: [
                {
                    role: "user",
                    content: prompt
                }
            ],
            max_tokens: 1000,
            temperature: 0.7,
        });

        const content = response.choices[0].message.content;

         await sql`INSERT INTO creations 
                        (user_id, prompt, content, type) 
                        VALUES (${userId}, 'Reviewed resume', ${content}, 'resume_review')`;

        res.json({success: true, content});
    } catch (error) {
        console.error(error.message);
        res.json({ success: false, error: error.message, stack: error.stack } );
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

// export function getBgRemovedUrl(publicId, prompt = "Minimalist background with a soft pastel gradient even lighting") {
//   return cloudinary.url(publicId, {
//     secure: true,
//     transformation: [
//       // plain background removal:
//       { effect: `gen_background:prompt_${prompt}` },
//       // or keep fine edges (fur/hair):
//       // { effect: "background_removal:fineedges_y" }
//       { fetch_format: "auto", quality: "auto" }
//     ],
//   });
// }

// // Make a URL that removes an object by prompt
// export function objectRemovedUrl(publicId, removePrompt, { removeAll = false } = {}) {
//   // example prompt: "the traffic cone" or "logos"
//   const effect = `gen_remove:prompt_${removePrompt}${removeAll ? ";multiple_true" : ""}`;
//   return cloudinary.url(publicId, {
//     secure: true,
//     transformation: [{ effect }, { fetch_format: "auto", quality: "auto" }],
//   });
// }