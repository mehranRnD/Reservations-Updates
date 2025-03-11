const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3001;

const slackWebhookUrl1 = "https://hooks.slack.com/services/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";
// Middleware to serve static files
app.use(express.static('public'));
app.use(bodyParser.json());

app.get('/api/reservations', async (req, res) => {
  try {
      const response = await axios.get(process.env.HOSTAWAY_API_URL, {
          headers: {
              'Authorization': `Bearer ${process.env.HOSTAWAY_API_KEY}`,
          },
      });

      // 🔥 Check if Hostaway returns modification data
      if (!response.data || !response.data.result) {
          return res.status(500).send('Error fetching reservations: No valid data');
      }

      const reservations = response.data.result.map(reservation => ({
          ...reservation,
          modifiedByUserId: reservation.modifiedByUserId || null // Ensure this is captured
      }));

      res.json({ result: reservations });
  } catch (error) {
      console.error('Error fetching reservations:', error.response?.data || error.message);
      res.status(500).send('Error fetching reservations');
  }
});

app.get('/api/users', async (req, res) => {
    try {
      const response = await axios.get('https://api.hostaway.com/v1/users', {
        headers: {
          'Authorization': `Bearer ${process.env.HOSTAWAY_API_KEY}`
        }
      });
      res.json(response.data);
    } catch (error) {
      console.error('Error fetching users:', error.response?.data || error.message);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  app.put('/api/reservations/:id', async (req, res) => {
    try {
        const reservationId = req.params.id;
        const { userId, userName, ...updateData } = req.body;

        // 🔥 Debugging - Log received userId and userName
        console.log(`🔹 Received update for reservation ID: ${reservationId}`);
        console.log(`🔹 User ID: ${userId}`);
        console.log(`🔹 User Name: ${userName}`);

        if (!userId || !userName) {
            console.error("❌ Missing userId or userName in request body.");
            return res.status(400).json({ error: "userId and userName are required" });
        }

        const updateUrl = `${process.env.HOSTAWAY_API_URL}/${reservationId}?forceOverbooking=1`;
        const response = await axios.put(updateUrl, updateData, {
            headers: {
                'Authorization': `Bearer ${process.env.HOSTAWAY_API_UPDATE_KEY}`,
                'Content-Type': 'application/json',
            },
        });

        // console.log(`✅ User ${userName} (ID: ${userId}) modified reservation ID: ${reservationId}`);

        res.json(response.data);
    } catch (error) {
        console.error('❌ Error updating reservation:', error.response?.data || error.message);
        res.status(500).send('Error updating reservation');
    }
});






app.post("/api/slack", async (req, res) => {
    try {
      const { text } = req.body;
      await axios.post(slackWebhookUrl1, { text }, {
        headers: { "Content-Type": "application/json" },
      });
      res.status(200).send("Message sent to Slack");
    } catch (error) {
      console.error("Error sending message to Slack:", error.message);
      res.status(500).send("Error sending message to Slack");
    }
  });
  

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
