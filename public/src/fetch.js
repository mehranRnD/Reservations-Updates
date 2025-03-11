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
    // console.log("📌 Hostaway Reservation Response:", data.result); // Debugging


    const reservationsBody = document.getElementById("reservations");
    reservationsBody.innerHTML = ""; // Clear existing content

    const reservations = data.result;

    if (Array.isArray(reservations) && reservations.length > 0) {
      window.oldReservations = reservations; // Store for comparison

      reservations.forEach((reservation, index) => {
        const apartmentName =
          apartmentMapping[reservation.listingMapId] || reservation.listingMapId;

        const modifiedByUserId = reservation.modifiedByUserId || null; // Extract modifiedByUserId
        const userName = window.hostawayUsers[modifiedByUserId] || "Unknown User";

        // console.log(`🔹 Reservation ID ${reservation.hostawayReservationId} modified by: ${modifiedByUserId} (${userName})`);

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
          <td>${userName}</td> <!-- Display the user who modified the reservation -->
        `;

        reservationsBody.appendChild(row);
      });
    } else {
      reservationsBody.innerHTML =
        '<tr><td colspan="15">No reservations found for the last three months.</td></tr>';
    }
  } catch (error) {
    console.error("❌ Error fetching reservations:", error);
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
function generateSlackMessage(reservationId, guestName, apartmentName, updates, userName) {
  const emojiHeader = "📢 *Updated field for ID*:";
  const fields = [
    `*Name*: ${guestName || "N/A"} has booked ${apartmentName || "N/A"}`,
  ];

  updates.forEach(({ field, oldValue, newValue }) => {
    fields.push(
      `*${field}*: Changed from ${oldValue || "N/A"} to ${newValue || "N/A"}`
    );
  });

  // 🔥 Ensure the correct user name is displayed
  fields.push(`*Modifications by*: ${userName || "Unknown User"}`);

  return `${emojiHeader} *${reservationId}*\n${fields.join("\n")}`;
}



async function fetchUsers() {
  try {
    const response = await fetch('/api/users');
    const data = await response.json();
    // console.log("📌 Fetching users...");

    if (!response.ok) throw new Error(data.error || 'Failed to fetch users');

    // 🔥 Store users dynamically in an object for easy lookup
    window.hostawayUsers = {};
    data.result.forEach(user => {
      window.hostawayUsers[user.id] = `${user.firstName} ${user.lastName || ""}`;
    });

    // console.log("✅ Hostaway users fetched and stored:", window.hostawayUsers);
  } catch (error) {
    console.error('❌ User Fetch Error:', error.message);
  }
}


async function updateAllReservations() {
  try {
    const response = await fetch("/api/reservations");
    const data = await response.json();
    console.log("📌 Fetching updated reservations...");
    console.log("🔹 Response Data:", data.result);

    const updatedReservations = data.result;
    let hasUpdates = false;

    const fieldsToCheck = ["guestName", "totalPrice", "arrivalDate", "departureDate", "numberOfGuests", "nights"];

    updatedReservations.forEach((reservation) => {
      if (reservation.status === "modified") {
        const oldReservation = window.oldReservations.find(
          (r) => r.hostawayReservationId === reservation.hostawayReservationId
        );

        const updates = [];
        fieldsToCheck.forEach((field) => {
          const oldValue = oldReservation ? oldReservation[field] : null;
          const newValue = reservation[field];

          if (oldValue !== newValue) {
            updates.push({ field, oldValue, newValue });
          }
        });

        if (updates.length > 0) {
          hasUpdates = true;

          // 🔥 Ensure `modifiedByUserId` is retrieved properly
          const modifiedByUserId = reservation.modifiedByUserId || null;
          const userName = window.hostawayUsers[modifiedByUserId] || "Unknown User";

          console.log(`🔹 Reservation ${reservation.hostawayReservationId} modified by ${modifiedByUserId} (${userName})`);

          // Send userId and userName in the PUT request
          fetch(`/api/reservations/${reservation.hostawayReservationId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: modifiedByUserId, userName, ...reservation }),
          });

          // Send Slack notification with correct user
          const message = generateSlackMessage(
            reservation.hostawayReservationId,
            reservation.guestName,
            apartmentMapping[reservation.listingMapId],
            updates,
            userName
          );
          sendMessageToSlack(message);
        }
      }
    });

    if (!hasUpdates) {
      sendMessageToSlack("✅ There are currently no updates to the reservations.");
    }

    window.oldReservations = updatedReservations;
  } catch (error) {
    console.error("❌ Error updating reservations:", error);
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
        "Suggestions for FD",
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
      { wch: 3 }, // No.
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

async function fetchRevenue() {
  try {
    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];
    console.log(`Today's date: ${today}`);

    // First, fetch all reservations to get their IDs
    const reservationsResponse = await fetch("https://api.hostaway.com/v1/reservations", {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiI4MDA2NiIsImp0aSI6IjZkODk5MWMyZTI4MGQ0NDg3NmNhNDUyZmYxMWU5ZTcxNDFhNDJhMGIzMmViNzA3ZTQyMDFhYjY4OWQ3NDc2Yjk0NDZlZjA2NTZhY2QzMDkxIiwiaWF0IjoxNzIzOTk0NTQxLjcxOTMyNiwibmJmIjoxNzIzOTk0NTQxLjcxOTMyNywiZXhwIjoyMDM5NTI3MzQxLjcxOTMzMSwic3ViIjoiIiwic2NvcGVzIjpbImdlbmVyYWwiXSwic2VjcmV0SWQiOjM5NDM0fQ.aCE9HtgvxqTLuftdSe3I75s8DocQoBz949WG-NTot-qIzWRmruShmqkZNs8rtA_CyNNocOr_fahkXZBK3hHxQ4G6QxX9z8acQ_mJ68Wz5YKT39A6gAmu--5Ux_W6xdMpzb8J6f4SrdDJneC3RIWweT3KvZ832VIm1AmQDgHgJ7k',
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json'
      }
    });
    const reservationsData = await reservationsResponse.json();
    
    if (!reservationsData.result || !Array.isArray(reservationsData.result)) {
      console.log("No reservations found");
      return;
    }

    console.log("=== Checking Reservation Dates ===");
    
    // Log all reservation dates for debugging
    reservationsData.result.forEach(reservation => {
      console.log(`Reservation ID: ${reservation.id}`);
      console.log(`Arrival Date: ${reservation.arrivalDate}`);
      console.log(`Reservation Date: ${reservation.reservationDate}`);
      console.log('-------------------------');
    });

    let grandTotal = 0;
    let todayReservationsCount = 0;
    
    // Fetch financial details for each reservation
    for (const reservation of reservationsData.result) {
      // Check if this reservation is for today
      if (reservation.reservationDate === today) {
        todayReservationsCount++;
        const reservationId = reservation.id;

        try {
          const financeResponse = await fetch(`https://api.hostaway.com/v1/financeStandardField/reservation/${reservationId}`, {
            method: 'GET',
            headers: {
              'Authorization': 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiI4MDA2NiIsImp0aSI6IjZkODk5MWMyZTI4MGQ0NDg3NmNhNDUyZmYxMWU5ZTcxNDFhNDJhMGIzMmViNzA3ZTQyMDFhYjY4OWQ3NDc2Yjk0NDZlZjA2NTZhY2QzMDkxIiwiaWF0IjoxNzIzOTk0NTQxLjcxOTMyNiwibmJmIjoxNzIzOTk0NTQxLjcxOTMyNywiZXhwIjoyMDM5NTI3MzQxLjcxOTMzMSwic3ViIjoiIiwic2NvcGVzIjpbImdlbmVyYWwiXSwic2VjcmV0SWQiOjM5NDM0fQ.aCE9HtgvxqTLuftdSe3I75s8DocQoBz949WG-NTot-qIzWRmruShmqkZNs8rtA_CyNNocOr_fahkXZBK3hHxQ4G6QxX9z8acQ_mJ68Wz5YKT39A6gAmu--5Ux_W6xdMpzb8J6f4SrdDJneC3RIWweT3KvZ832VIm1AmQDgHgJ7k',
              'Cache-Control': 'no-cache',
              'Content-Type': 'application/json'
            }
          });

          const financeData = await financeResponse.json();

          if (financeData.result) {
            // Sum up all the specified fields
            const fieldsToSum = [
              'damageDeposit', 'guestChannelFee', 'hostChannelFee', 'baseRate',
              'salesTax', 'cityTax', 'otherTaxes', 'cleaningFeeValue',
              'additionalCleaningFee', 'parkingFee', 'towelChangeFee',
              'midstayCleaningFee', 'roomRequestFee', 'reservationChangeFee',
              'checkinFee', 'lateCheckoutFee', 'otherFees', 'creditCardFee',
              'kitchenLinenFee', 'linenPackageFee', 'transferFee', 'wristbandFee',
              'extraBedsFee', 'serviceFee', 'bedLinenFee', 'bookingFee',
              'petFee', 'skiPassFee', 'tourismFee', 'childrenExtraFee',
              'resortFee', 'resortFeeAirbnb', 'communityFeeAirbnb',
              'managementFeeAirbnb', 'linenFeeAirbnb', 'weeklyDiscount',
              'roomTax', 'transientOccupancyTax', 'lodgingTax', 'hotelTax',
              'guestNightlyTax', 'guestStayTax', 'guestPerPersonPerNightTax',
              'propertyRentTax', 'priceForExtraPerson', 'monthlyDiscount',
              'cancellationPayout', 'cancellationHostFee', 'couponDiscount',
              'shareholderDiscount', 'lastMinuteDiscount', 'employeeDiscount',
              'otherSpecialDiscount', 'paymentServiceProcessingFees',
              'bookingComCancellationGuestFee', 'bookingcomPaymentProcessingFee',
              'insuranceFee', 'airbnbClosedResolutionsSum', 'airbnbOpenResolutionsSum',
              'airbnbPayoutSum', 'airbnbTransientOccupancyTax', 'airbnbPassThroughTax',
              'hostCancellationPenalty', 'originalTotalPrice', 'earlyCheckinFee',
              'guestServiceFee'
            ];

            let total = 0;
            fieldsToSum.forEach(field => {
              if (financeData.result[field] && typeof financeData.result[field] === 'number') {
                total += financeData.result[field];
              }
            });

            grandTotal += total;

            // Display individual reservation total
            console.log(`ID: ${reservationId} Total: ${total}`);
          }

          // Add a small delay to avoid hitting rate limits
          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
          console.error(`Error fetching finance details for reservation ${reservationId}`);
        }
      }
    }

    if (todayReservationsCount === 0) {
      console.log("No reservations found for today");
    } else {
      console.log("===========================");
      console.log(`Total Reservations Today: ${todayReservationsCount}`);
      console.log(`GRAND TOTAL: ${grandTotal}`);
    }
    console.log("=== End of Today's Totals ===");

  } catch (error) {
    console.error("Error in fetchRevenue:", error);
  }
}

async function initializeApp() {
  await fetchUsers(); // Fetch users first
  await fetchReservations(); // Then fetch reservations
}
initializeApp();

window.fetchUsers = fetchUsers;
window.downloadReservations = downloadReservations;
window.fetchReservations = fetchReservations;
window.updateAllReservations = updateAllReservations;
window.fetchRevenue = fetchRevenue;
fetchReservations();
