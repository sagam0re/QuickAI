import sql from "../configs/db.js";

export const getUserCreations = async (req, res) => {
    try {
        const {userId} = req.auth();
        const creations = await sql`SELECT * FROM creations WHERE user_id = ${userId} ORDER BY created_at DESC`;
        
        res.json({ success: true, creations });
    } catch (error) {
        console.error(error.message);
        res.json({ success: false, error: error.message });
    }
};

export const getPublishedCreations = async (req, res) => {
    try {
        const creations = await sql`SELECT * FROM creations WHERE published = true ORDER BY created_at DESC`;

        res.json({ success: true, creations });
    } catch (error) {
        console.error(error.message);
        res.json({ success: false, error: error.message });
    }
};

export const toggleLikeCreations = async (req, res) => {
    try {
        const {userId} = req.auth();
        const {id} = req.body;

        const [creation] = await sql`SELECT * FROM creations WHERE id = ${id}`;
        if (!creation) {
            return res.json({ success: false, error: 'Creation not found' });
        }

        const currentLikes = creation.likes;
        const userIdStr = userId.toString();

        let updatedLikes;
        let message;
        if (currentLikes.includes(userIdStr)) {
            // Unlike
            updatedLikes = currentLikes.filter(id => id !== userIdStr);
            message = 'Creation unliked';
        } else {
            // Like
            updatedLikes = [...currentLikes, userIdStr];
            message = 'Creation liked';
        }

        const formattedArray = `${updatedLikes.json(',')}`;

        await sql`UPDATE creations SET likes = ${sql(formattedArray)}::text[] WHERE id = ${id}`;

        res.json({ success: true, message, message });
    } catch (error) {
        console.error(error.message);
        res.json({ success: false, error: error.message });
    }
};
