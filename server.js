const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

const slackWebhookUrl = "https://hooks.slack.com/services/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";

// Middleware to serve static files
app.use(express.static('public'));
app.use(bodyParser.json());

// Route to fetch reservation details
app.get('/api/reservations', async (req, res) => {
    try {
        const response = await axios.get(process.env.HOSTAWAY_API_URL, {
            headers: {
                'Authorization': `Bearer ${process.env.HOSTAWAY_API_KEY}`,
            },
        });
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching reservations:', error.response?.data || error.message);
        res.status(500).send('Error fetching reservations');
    }
});

// Route to update a reservation
app.put('/api/reservations/:id', async (req, res) => {
    try {
        const reservationId = req.params.id;
        const updateUrl = `${process.env.HOSTAWAY_API_URL}/${reservationId}?forceOverbooking=1`;
        const response = await axios.put(updateUrl, req.body, {
            headers: {
                'Authorization': `Bearer ${process.env.HOSTAWAY_API_UPDATE_KEY}`,
                'Content-Type': 'application/json',
            },
        });
        res.json(response.data);
    } catch (error) {
        console.error('Error updating reservation:', error.response?.data || error.message);
        res.status(500).send('Error updating reservation');
    }
});

app.post("/api/slack", async (req, res) => {
    try {
      const { text } = req.body;
      await axios.post(slackWebhookUrl, { text }, {
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
