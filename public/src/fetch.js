const slackEndpoint = "/api/slack"; // Server-side Slack endpoint
const slackWebhookUrl2 = "https://hooks.slack.com/services/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";

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

// Function to calculate number of nights between check-in (3 PM) and check-out (12 PM)
function calculateNights(checkIn, checkOut) {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const diffTime = Math.abs(end - start);
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

// Function to download today's check-outs
async function downloadReservations() {
  try {
    const today = new Date().toISOString().split("T")[0];
    const response = await fetch("/api/reservations");
    const data = await response.json();
    const reservations = data.result;

    // Filter reservations for today's check-outs
    const todayCheckouts = reservations.filter(
      (reservation) => reservation.departureDate === today
    );

    if (todayCheckouts.length === 0) {
      console.log("No check-outs for today!");
      return;
    }

    // Create data for Excel
    const excelData = [
      [
        "No.",
        "Name",
        "Room Number",
        "Channel",
        "Price",
        "Check-in Date",
        "Check-out Date",
        "Nights",
        "Review Taken?",
        "Platform",
        "Rating /5",
        "Suggestion about stay",
        "Complaints",
        "Status",
        "Suggestions for FD"
      ], // Headers
    ];

    // Add data rows
    todayCheckouts.forEach((reservation, index) => {
      const apartmentName =
        apartmentMapping[reservation.listingMapId] || "Unknown Apartment";
      const nights = calculateNights(
        reservation.arrivalDate,
        reservation.departureDate
      );

      excelData.push([
        index + 1,
        reservation.guestName,
        apartmentName,
        reservation.channelName,
        `${reservation.totalPrice} ${reservation.currency}`,
        `${reservation.arrivalDate} `,
        `${reservation.departureDate} `,
        nights,
      ]);
    });

    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(excelData);

    // Set column widths
    const colWidths = [
      { wch: 3 },  // No.
      { wch: 23 }, // Name
      { wch: 13 }, // Room Number
      { wch: 12 }, // Channel
      { wch: 13 }, // Price
      { wch: 15 }, // Check-in Date
      { wch: 15 }, // Check-out Date
      { wch: 5 }, // Nights
      { wch: 12 }, // Review Taken?
      { wch: 10 }, // Platform
      { wch: 6 }, // Rating /5
      { wch: 20 }, // Suggestion about stay
      { wch: 20 }, // Complaints
      { wch: 10 }, // Status
      { wch: 20 }, // Suggestions for FD
    ];
    
    ws["!cols"] = colWidths;

    // Set font style for all cells
    for (let cell in ws) {
      if (cell[0] === "!") continue; // Skip special keys like !ref

      // Apply the font style for all cells
      ws[cell].s = {
        font: {
          name: "Segoe UI",
          sz: 7,
        },
      };
    }

    // Make headers bold and apply font settings for headers as well
    const range = XLSX.utils.decode_range(ws["!ref"]);
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cell = XLSX.utils.encode_cell({ r: 0, c: C });
      ws[cell].s = {
        font: {
          name: "Segoe UI",
          sz: 7,
          bold: true,
        },
      };
    }

    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Today's Check-outs");

    // Get today's date in DD-MM-YYYY format for filename
    const dateStr = new Date().toLocaleDateString("en-GB").replace(/\//g, "-");

    // Download the file
    const wopts = {
      bookType: "xlsx",
      bookSST: false,
      type: "binary",
      cellStyles: true,
    };
    XLSX.writeFile(wb, `Check-outs_${dateStr}.xlsx`, wopts);

    // Also log to console for reference
    console.log(`Today's Check-outs (Total: ${todayCheckouts.length}):`);
    todayCheckouts.forEach((reservation, index) => {
      const apartmentName =
        apartmentMapping[reservation.listingMapId] || "Unknown Apartment";
      const nights = calculateNights(
        reservation.arrivalDate,
        reservation.departureDate
      );

      console.log(`
Check-out #${index + 1}
Guest Name: ${reservation.guestName}
Apartment: ${apartmentName}
Channel: ${reservation.channelName}
Price: ${reservation.totalPrice} ${reservation.currency}
Check-in: ${reservation.arrivalDate} 
Check-out: ${reservation.departureDate} 
Nights: ${nights}
-------------------`);
    });
  } catch (error) {
    console.error("Error fetching today's check-outs:", error);
  }
}

window.downloadReservations = downloadReservations;
window.fetchReservations = fetchReservations;
window.updateAllReservations = updateAllReservations;
fetchReservations();
