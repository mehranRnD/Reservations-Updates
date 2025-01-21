const slackEndpoint = "/api/slack"; // Server-side Slack endpoint

// Define the mapping of listingMapId to apartment names
const apartmentMapping = {
  288675: "1F-17 (S)",
  288676: "9F-85 (3B)",
  288677: "1F-14 (2B)",
  288678: "9F-82 (1B)",
  288679: "7F-64 (1B)",
  288681: "6F-54 (1B)",
  288682: "GF-09 (S)",
  288683: "8f-74 (2B)",
  288684: "2F-24 (2B)",
  288685: "7F-70 (2B)",
  288686: "2F-22 (3B)",
  288687: "2F-25 (2B)",
  288688: "1F-12 (2B)",
  288689: "7F-65 (2B)",
  288690: "GF-01 (S)",
  288691: "3F-27 (1B)",
  288723: "8f-73 (1B)",
  288724: "9F-88 (2B)",
  288726: "7F-63 (1B)",
  288977: "3F-34 (2B)",
  305055: "GF-04 (2B)",
  305069: "3F-28 (1B)",
  305327: "5F-49 (3B)",
  306032: "2F-18 (1B)",
  306543: "8F-79 (2B)",
  307143: "1F-15 (1B)",
  309909: "GF-06 (2B)",
  323227: "4F-42 (2B)",
  323229: "1F-10(A) (S)",
  323258: "1F-10(B) (1B)",
  323261: "1F-10(C) (S)",
  336255: "8F-80 (S)",
};

// Fetch reservations and display in the table
async function fetchReservations() {
  try {
    const response = await fetch("/api/reservations");
    const data = await response.json();
    const reservationsBody = document.getElementById("reservations");
    reservationsBody.innerHTML = ""; // Clear existing content

    const reservations = data.result;

    if (Array.isArray(reservations) && reservations.length > 0) {
      window.oldReservations = reservations; // Store data for later comparison

      reservations.forEach((reservation, index) => {
        const apartmentName =
          apartmentMapping[reservation.listingMapId] ||
          reservation.listingMapId;

        const row = document.createElement("tr");
        row.setAttribute("data-id", reservation.hostawayReservationId);

        row.innerHTML = `
          <td>${index + 1}</td>
          <td>${reservation.hostawayReservationId || ""}</td>
          <td>${apartmentName || ""}</td>
          <td>${reservation.arrivalDate || ""}</td>
          <td>${reservation.departureDate || ""}</td>
          <td>${reservation.totalPrice || ""}</td>
          <td>${reservation.currency || ""}</td>
          <td>${reservation.channelName || ""}</td>
          <td>${reservation.guestName || ""}</td>
          <td>${reservation.phone || ""}</td>
          <td>${reservation.status || ""}</td>
          <td>${reservation.numberOfGuests || ""}</td>
          <td>${reservation.nights || ""}</td>
          <td>${reservation.airbnbListingBasePrice || ""}</td>
          <td>${reservation.airbnbTotalPaidAmount || ""}</td>
        `;

        reservationsBody.appendChild(row);
      });
    } else {
      reservationsBody.innerHTML =
        '<tr><td colspan="15">No reservations found for the last three months.</td></tr>';
    }
  } catch (error) {
    console.error("Error fetching reservations:", error);
    document.getElementById("reservations").innerHTML =
      '<tr><td colspan="15">Error fetching reservations.</td></tr>';
  }
}

// Send a message to Slack
async function sendMessageToSlack(message) {
  try {
    const response = await fetch(slackEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: message }),
    });

    if (response.ok) {
      console.log("Slack response:", await response.text());
    } else {
      console.error(`Slack error: ${response.statusText}`);
    }
  } catch (error) {
    console.error("Error sending to Slack:", error);
  }
}

// Generate Slack message
function generateSlackMessage(
  reservationId,
  guestName,
  apartmentName,
  updates
) {
  const emojiHeader = "📢 *Updated field for ID*:";
  const fields = [
    `*Name*: ${guestName || "N/A"} has booked ${apartmentName || "N/A"}`,
  ];

  updates.forEach(({ field, oldValue, newValue }) => {
    fields.push(
      `*${field}*: Changed from ${oldValue || "N/A"} to ${newValue || "N/A"}`
    );
  });

  return `${emojiHeader} *${reservationId}*\n${fields.join("\n")}`;
}

// Update reservations and detect changes
async function updateAllReservations() {
  try {
    const response = await fetch("/api/reservations");
    const data = await response.json();
    const updatedReservations = data.result;
    let hasUpdates = false;

    const fieldDisplayNames = {
      guestName: "Name",
      totalPrice: "Price",
      apartmentName: "Apartment",
      arrivalDate: "Arrival Date",
      departureDate: "Departure Date",
      numberOfGuests: "Number of Guests",
      nights: "Number of Nights",
    };

    const fieldsToCheck = Object.keys(fieldDisplayNames);

    updatedReservations.forEach((reservation) => {
      if (reservation.status === "modified") {
        const oldReservation = window.oldReservations.find(
          (r) => r.hostawayReservationId === reservation.hostawayReservationId
        );

        const updates = [];
        fieldsToCheck.forEach((field) => {
          const oldValue = oldReservation ? oldReservation[field] : null;
          const newValue = reservation[field];

          if (
            oldValue !== newValue &&
            oldValue !== null &&
            oldValue !== "N/A"
          ) {
            updates.push({
              field: fieldDisplayNames[field],
              oldValue,
              newValue,
            });
          }
        });

        if (updates.length > 0) {
          hasUpdates = true;
          const apartmentName =
            apartmentMapping[reservation.listingMapId] || "Unknown Apartment";
          const message = generateSlackMessage(
            reservation.hostawayReservationId,
            reservation.guestName,
            apartmentName,
            updates
          );
          sendMessageToSlack(message);
        }
      }
    });

    if (!hasUpdates) {
      sendMessageToSlack(
        "✅ There are currently no updates to the reservations. Wait for the updates."
      );
    }

    window.oldReservations = updatedReservations;
  } catch (error) {
    console.error("Error updating reservations:", error);
  }
}



// Set an interval to call updateAllReservations every 10 minutes (600000 ms)
setInterval(() => {
  console.log("Triggering updateAllReservations...");
  updateAllReservations();
}, 600000); // 600000 ms = 10 minutes


// Expose functions globally
window.fetchReservations = fetchReservations;
window.updateAllReservations = updateAllReservations;

// Load reservations on page load
fetchReservations();
