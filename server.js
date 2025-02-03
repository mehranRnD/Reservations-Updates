const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3001;

const slackWebhookUrl1 = process.env.SLACK_WEBHOOK_URL;
const HOSTAWAY_API_KEY = process.env.HOSTAWAY_API_KEY;
const HOSTAWAY_API_URL = process.env.HOSTAWAY_API_URL;
const HOSTAWAY_USER_URL = "https://api.hostaway.com/v1/user";

// Middleware
app.use(express.static("public"));
app.use(bodyParser.json());

// In-memory user cache for fast lookup
let usersCache = [];

// Function to fetch all users from Hostaway and store in cache
async function fetchUsers() {
    try {
        console.log("🔄 Fetching latest user list...");
        const response = await axios.get("https://api.hostaway.com/v1/users", {
            headers: { "Authorization": `Bearer ${HOSTAWAY_API_KEY}` },
        });

        usersCache = response.data.result || [];
        console.log(`✅ User list updated: ${usersCache.length} users loaded`);
    } catch (error) {
        console.error("❌ Error fetching users:", error.response?.data || error.message);
    }
}

// Fetch users initially and refresh every 10 seconds
fetchUsers();
setInterval(fetchUsers, 10 * 1000); // Refresh every 10 seconds

// Fetch all reservations (with modification tracking)
app.get("/api/reservations", async (req, res) => {
    try {
        console.log("🔄 Fetching reservations...");
        const response = await axios.get(HOSTAWAY_API_URL, {
            headers: { "Authorization": `Bearer ${HOSTAWAY_API_KEY}` },
        });

        const reservations = response.data.result.map((reservation) => {
            const modifiedByUserId = reservation.modifiedByUserId || null;

            // DEBUG: Print reservation to check if modifiedByUserId exists
            console.log(`🛠 Reservation ${reservation.hostawayReservationId} - modifiedByUserId:`, modifiedByUserId);

            let modifiedByUser = "Unknown";

            if (modifiedByUserId) {
                // Ensure both IDs are treated as strings for accurate matching
                const foundUser = usersCache.find((user) => String(user.id) === String(modifiedByUserId));

                if (foundUser) {
                    modifiedByUser = foundUser.name;
                    console.log(`✅ Found modifying user: ${modifiedByUser} (ID: ${modifiedByUserId})`);
                } else {
                    console.log(`❌ No user found for ID: ${modifiedByUserId}`);
                }
            } else {
                console.log(`⚠️ No 'modifiedByUserId' found for reservation ID: ${reservation.hostawayReservationId}`);
            }

            return {
                ...reservation,
                modifiedByUser, // Attach the name of the user who modified the reservation
            };
        });

        res.json({ result: reservations });
    } catch (error) {
        console.error("❌ Error fetching reservations:", error.response?.data || error.message);
        res.status(500).send("Error fetching reservations");
    }
});

// Fetch a specific user by ID
app.get("/api/user/:id", async (req, res) => {
    try {
        const userId = req.params.id;
        console.log(`🔄 Fetching details for user ID: ${userId}`);
        const response = await axios.get(`${HOSTAWAY_USER_URL}/${userId}`, {
            headers: { "Authorization": `Bearer ${HOSTAWAY_API_KEY}` },
        });

        res.json(response.data);
    } catch (error) {
        console.error(`❌ Error fetching user (ID: ${userId}):`, error.response?.data || error.message);
        res.status(500).send("Error fetching user");
    }
});

// Update reservation (same as before)
app.put("/api/reservations/:id", async (req, res) => {
    try {
        const reservationId = req.params.id;
        const updateUrl = `${HOSTAWAY_API_URL}/${reservationId}?forceOverbooking=1`;

        const response = await axios.put(updateUrl, req.body, {
            headers: {
                "Authorization": `Bearer ${process.env.HOSTAWAY_API_UPDATE_KEY}`,
                "Content-Type": "application/json",
            },
        });

        res.json(response.data);
    } catch (error) {
        console.error("❌ Error updating reservation:", error.response?.data || error.message);
        res.status(500).send("Error updating reservation");
    }
});

// Send message to Slack
app.post("/api/slack", async (req, res) => {
    try {
        const { text } = req.body;
        console.log("📩 Sending message to Slack:", text);
        await axios.post(slackWebhookUrl1, { text }, {
            headers: { "Content-Type": "application/json" },
        });
        res.status(200).send("Message sent to Slack");
    } catch (error) {
        console.error("❌ Error sending message to Slack:", error.message);
        res.status(500).send("Error sending message to Slack");
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`✅ Server is running on http://localhost:${PORT}`);
});
